-- =============================================
-- ALERTS AND MONITORING SCHEMA
-- Combines alert configurations, alert history, and notification logs
-- =============================================

SET search_path TO public;

-- Ensure helper can be safely re-invoked even if indexes already exist from earlier runs
CREATE OR REPLACE FUNCTION ensure_index_exists(
    p_table_name TEXT,
    p_index_name TEXT,
    p_index_sql TEXT
) RETURNS VOID AS $$
DECLARE
    v_index_reg regclass;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = p_table_name
    ) THEN
        v_index_reg := to_regclass(format('public.%I', p_index_name));

        IF v_index_reg IS NULL THEN
            BEGIN
                EXECUTE p_index_sql;
            EXCEPTION WHEN duplicate_table THEN
                RAISE NOTICE 'Index % already exists, skipping', p_index_name;
            END;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ALERT CONFIGURATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS alert_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    alert_type VARCHAR(50) NOT NULL, -- 'STOCK_LOW', 'STOCK_CRITICAL', 'QUALITY_ISSUE', 'MACHINE_DOWNTIME', 'SCHEDULE_DELAY'
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    is_active BOOLEAN DEFAULT true,
    condition_type VARCHAR(20) NOT NULL CHECK (condition_type IN ('THRESHOLD', 'PATTERN', 'STATUS')),
    condition_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    notification_channels TEXT[] NOT NULL DEFAULT ARRAY['EMAIL', 'IN_APP']::TEXT[],
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of user IDs or email addresses
    cooldown_minutes INTEGER DEFAULT 60, -- Minimum minutes between alerts of same type
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- =============================================
-- ALERT RULES
-- =============================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_config_id UUID NOT NULL REFERENCES alert_configs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    entity_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'WORK_ORDER', 'MACHINE', 'QUALITY_CHECK'
    entity_filter JSONB NOT NULL DEFAULT '{}'::jsonb, -- Filter criteria for the entity
    condition_operator VARCHAR(10) NOT NULL CHECK (condition_operator IN ('>', '<', '=', '!=', '>=', '<=', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH')),
    condition_value TEXT NOT NULL,
    condition_duration_seconds INTEGER DEFAULT 0, -- Condition must be true for this duration (in seconds) before triggering
    active_from TIME, -- Time of day when this rule is active (NULL means always)
    active_to TIME,   -- Time of day when this rule becomes inactive (NULL means always)
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher numbers mean higher priority
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ALERT HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_config_id UUID NOT NULL REFERENCES alert_configs(id) ON DELETE CASCADE,
    alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED')),
    entity_type VARCHAR(50), -- 'PRODUCT', 'WORK_ORDER', etc.
    entity_id UUID, -- ID of the related entity
    context_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Additional context data
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolved_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- NOTIFICATION LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_history_id UUID REFERENCES alert_history(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP', 'WEBHOOK', 'SLACK', 'TEAMS')),
    recipient TEXT NOT NULL, -- Could be email, phone number, user ID, etc.
    subject TEXT,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ')),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ALERT SUPPRESSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS alert_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_config_id UUID REFERENCES alert_configs(id) ON DELETE CASCADE,
    entity_type VARCHAR(50), -- If NULL, applies to all entities of the alert type
    entity_id UUID, -- If NULL, applies to all entities of the type
    reason TEXT NOT NULL,
    suppressed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suppressed_until TIMESTAMPTZ, -- NULL means suppressed indefinitely
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- WIP-SPECIFIC ALERTS (BACKWARD COMPATIBILITY)
-- =============================================

CREATE TABLE IF NOT EXISTS wip_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_utilization','high_avg_time','bottleneck','stage_delayed')),
    stage_name VARCHAR(100),
    threshold_value DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    notify_roles TEXT[] DEFAULT ARRAY['Supervisor','Admin'],
    notify_emails TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS wip_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_config_id UUID REFERENCES wip_alert_config(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
    message TEXT NOT NULL,
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wip_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_history_id UUID REFERENCES wip_alert_history(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email','sms','in_app','webhook')),
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wip_alert_config_type ON wip_alert_config(alert_type);
CREATE INDEX IF NOT EXISTS idx_wip_alert_config_stage ON wip_alert_config(stage_name);
CREATE INDEX IF NOT EXISTS idx_wip_alert_history_stage ON wip_alert_history(stage_name);
CREATE INDEX IF NOT EXISTS idx_wip_alert_history_severity ON wip_alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_wip_notification_log_alert ON wip_notification_log(alert_history_id);

-- =============================================
-- INDEXES
-- =============================================

SELECT ensure_index_exists('alert_configs', 'idx_alert_configs_alert_type', 'CREATE INDEX idx_alert_configs_alert_type ON alert_configs(alert_type);');
SELECT ensure_index_exists('alert_configs', 'idx_alert_configs_is_active', 'CREATE INDEX idx_alert_configs_is_active ON alert_configs(is_active);');

SELECT ensure_index_exists('alert_rules', 'idx_alert_rules_alert_config_id', 'CREATE INDEX idx_alert_rules_alert_config_id ON alert_rules(alert_config_id);');
SELECT ensure_index_exists('alert_rules', 'idx_alert_rules_entity_type', 'CREATE INDEX idx_alert_rules_entity_type ON alert_rules(entity_type);');
SELECT ensure_index_exists('alert_rules', 'idx_alert_rules_is_active', 'CREATE INDEX idx_alert_rules_is_active ON alert_rules(is_active);');

SELECT ensure_index_exists('alert_history', 'idx_alert_history_alert_config_id', 'CREATE INDEX idx_alert_history_alert_config_id ON alert_history(alert_config_id);');
SELECT ensure_index_exists('alert_history', 'idx_alert_history_alert_rule_id', 'CREATE INDEX idx_alert_history_alert_rule_id ON alert_history(alert_rule_id);');
SELECT ensure_index_exists('alert_history', 'idx_alert_history_status', 'CREATE INDEX idx_alert_history_status ON alert_history(status);');
SELECT ensure_index_exists('alert_history', 'idx_alert_history_severity', 'CREATE INDEX idx_alert_history_severity ON alert_history(severity);');
SELECT ensure_index_exists('alert_history', 'idx_alert_history_entity', 'CREATE INDEX idx_alert_history_entity ON alert_history(entity_type, entity_id);');
SELECT ensure_index_exists('alert_history', 'idx_alert_history_created_at', 'CREATE INDEX idx_alert_history_created_at ON alert_history(created_at);');

SELECT ensure_index_exists('notification_logs', 'idx_notification_logs_alert_history_id', 'CREATE INDEX idx_notification_logs_alert_history_id ON notification_logs(alert_history_id);');
SELECT ensure_index_exists('notification_logs', 'idx_notification_logs_channel', 'CREATE INDEX idx_notification_logs_channel ON notification_logs(channel);');
SELECT ensure_index_exists('notification_logs', 'idx_notification_logs_status', 'CREATE INDEX idx_notification_logs_status ON notification_logs(status);');
SELECT ensure_index_exists('notification_logs', 'idx_notification_logs_created_at', 'CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);');

SELECT ensure_index_exists('alert_suppressions', 'idx_alert_suppressions_alert_config_id', 'CREATE INDEX idx_alert_suppressions_alert_config_id ON alert_suppressions(alert_config_id);');
SELECT ensure_index_exists('alert_suppressions', 'idx_alert_suppressions_entity', 'CREATE INDEX idx_alert_suppressions_entity ON alert_suppressions(entity_type, entity_id);');
SELECT ensure_index_exists('alert_suppressions', 'idx_alert_suppressions_suppressed_until', 'CREATE INDEX idx_alert_suppressions_suppressed_until ON alert_suppressions(suppressed_until);');

SELECT ensure_index_exists('wip_alert_config', 'idx_wip_alert_config_type', 'CREATE INDEX idx_wip_alert_config_type ON wip_alert_config(alert_type);');
SELECT ensure_index_exists('wip_alert_config', 'idx_wip_alert_config_stage', 'CREATE INDEX idx_wip_alert_config_stage ON wip_alert_config(stage_name);');
SELECT ensure_index_exists('wip_alert_history', 'idx_wip_alert_history_stage', 'CREATE INDEX idx_wip_alert_history_stage ON wip_alert_history(stage_name);');
SELECT ensure_index_exists('wip_alert_history', 'idx_wip_alert_history_severity', 'CREATE INDEX idx_wip_alert_history_severity ON wip_alert_history(severity);');
SELECT ensure_index_exists('wip_notification_log', 'idx_wip_notification_log_alert', 'CREATE INDEX idx_wip_notification_log_alert ON wip_notification_log(alert_history_id);');

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_alert_history_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
    IF NEW.status = 'ACKNOWLEDGED' AND OLD.status != 'ACKNOWLEDGED' THEN
        NEW.acknowledged_at = NOW();
        NEW.acknowledged_by = current_user;
    ELSIF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
        NEW.resolved_at = NOW();
        NEW.resolved_by = current_user;
    END IF;

    RETURN NEW;
END;
$func$;

-- Apply triggers to all tables with updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_alert_configs_updated_at'
        AND tgrelid = 'alert_configs'::regclass
    ) THEN
        CREATE TRIGGER update_alert_configs_updated_at
        BEFORE UPDATE ON alert_configs
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_alert_rules_updated_at'
        AND tgrelid = 'alert_rules'::regclass
    ) THEN
        CREATE TRIGGER update_alert_rules_updated_at
        BEFORE UPDATE ON alert_rules
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_alert_history_updated_at'
        AND tgrelid = 'alert_history'::regclass
    ) THEN
        CREATE TRIGGER update_alert_history_updated_at
        BEFORE UPDATE ON alert_history
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_notification_logs_updated_at'
        AND tgrelid = 'notification_logs'::regclass
    ) THEN
        CREATE TRIGGER update_notification_logs_updated_at
        BEFORE UPDATE ON notification_logs
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_alert_suppressions_updated_at'
        AND tgrelid = 'alert_suppressions'::regclass
    ) THEN
        CREATE TRIGGER update_alert_suppressions_updated_at
        BEFORE UPDATE ON alert_suppressions
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_update_alert_history_status'
        AND tgrelid = 'alert_history'::regclass
    ) THEN
        CREATE TRIGGER trg_update_alert_history_status
        BEFORE UPDATE OF status ON alert_history
        FOR EACH ROW
        EXECUTE FUNCTION update_alert_history_status();
    END IF;
END $$;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to check for active alerts and trigger notifications
CREATE OR REPLACE FUNCTION check_and_trigger_alerts()
RETURNS TRIGGER AS $$
DECLARE
    alert_record RECORD;
    alert_config_record RECORD;
    notification_channels TEXT[];
    recipient_record JSONB;
    notification_id UUID;
    should_alert BOOLEAN;
    alert_id UUID;
    alert_message TEXT;
    alert_title TEXT;
    entity_data JSONB;
    suppression_exists BOOLEAN;
BEGIN
    -- This is a simplified example. In a real implementation, you would:
    -- 1. Check conditions based on the alert rules
    -- 2. Check for active suppressions
    -- 3. Check cooldown periods
    -- 4. Create alert history records
    -- 5. Queue notifications
    
    -- For demonstration, we'll just log that the function was called
    RAISE NOTICE 'Checking alerts for entity type: %, entity ID: %', TG_TABLE_NAME, NEW.id;
    
    -- In a real implementation, you would return NEW to continue the operation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default alert configurations
INSERT INTO alert_configs (id, name, description, alert_type, severity, condition_type, condition_config, notification_channels, recipients, cooldown_minutes)
VALUES 
    -- Stock level alerts
    ('00000000-0000-0000-0001-000000000001', 'Low Stock Alert', 'Triggers when inventory falls below minimum level', 'STOCK_LOW', 'MEDIUM', 'THRESHOLD', '{"field": "available_quantity", "threshold": 10}', ARRAY['EMAIL', 'IN_APP'], '[{"type": "ROLE", "value": "inventory_manager"}]', 1440),
    ('00000000-0000-0000-0001-000000000002', 'Critical Stock Alert', 'Triggers when inventory is critically low', 'STOCK_CRITICAL', 'HIGH', 'THRESHOLD', '{"field": "available_quantity", "threshold": 5}', ARRAY['SMS', 'EMAIL', 'IN_APP'], '[{"type": "ROLE", "value": "inventory_manager"}, {"type": "ROLE", "value": "production_manager"}]', 240),
    
    -- Production alerts
    ('00000000-0000-0000-0001-000000000003', 'Production Delay Alert', 'Triggers when a work order is delayed', 'SCHEDULE_DELAY', 'HIGH', 'THRESHOLD', '{"field": "delay_minutes", "threshold": 60}', ARRAY['EMAIL', 'IN_APP'], '[{"type": "ROLE", "value": "production_supervisor"}]', 60),
    ('00000000-0000-0000-0001-000000000004', 'Quality Issue Alert', 'Triggers when quality issues are detected', 'QUALITY_ISSUE', 'HIGH', 'STATUS', '{"field": "status", "value": "FAILED"}', ARRAY['EMAIL', 'IN_APP', 'SLACK'], '[{"type": "ROLE", "value": "quality_manager"}]', 0)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    severity = EXCLUDED.severity,
    condition_config = EXCLUDED.condition_config,
    notification_channels = EXCLUDED.notification_channels,
    recipients = EXCLUDED.recipients,
    cooldown_minutes = EXCLUDED.cooldown_minutes,
    updated_at = NOW();

-- Insert default alert rules
INSERT INTO alert_rules (id, alert_config_id, name, description, entity_type, entity_filter, condition_operator, condition_value, condition_duration_seconds, is_active)
VALUES
    -- Rule for low stock
    ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'Raw Material Low Stock', 'Triggers when raw material stock is low', 'PRODUCT', '{"category": "RAW_MATERIAL"}', '<', '10', 300, true),
    
    -- Rule for critical stock
    ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002', 'Raw Material Critical Stock', 'Triggers when raw material stock is critical', 'PRODUCT', '{"category": "RAW_MATERIAL"}', '<', '5', 60, true),
    
    -- Rule for production delays
    ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000003', 'Work Order Delay', 'Triggers when a work order is delayed by more than 1 hour', 'WORK_ORDER', '{}', '>', '60', 300, true),
    
    -- Rule for quality issues
    ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000004', 'Quality Check Failed', 'Triggers when a quality check fails', 'QUALITY_CHECK', '{}', '=', 'FAILED', 0, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    entity_filter = EXCLUDED.entity_filter,
    condition_operator = EXCLUDED.condition_operator,
    condition_value = EXCLUDED.condition_value,
    condition_duration_seconds = EXCLUDED.condition_duration_seconds,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =============================================
-- TRIGGERS FOR ALERT CHECKING
-- =============================================

-- Example trigger for product updates
DO $$
BEGIN
    -- Only create the trigger if the products table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        -- Drop the trigger if it exists to avoid conflicts
        DROP TRIGGER IF EXISTS trg_check_product_alerts ON products;
        
        -- Create the trigger to monitor product active status changes
        CREATE TRIGGER trg_check_product_alerts
        AFTER INSERT OR UPDATE OF is_active ON products
        FOR EACH ROW
        EXECUTE FUNCTION check_and_trigger_alerts();
        
        RAISE NOTICE 'Created product alerts trigger on is_active changes';
    END IF;
    
    -- Create a separate trigger for inventory changes if the inventory table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
        DROP TRIGGER IF EXISTS trg_check_inventory_alerts ON inventory;
        
        CREATE TRIGGER trg_check_inventory_alerts
        AFTER INSERT OR UPDATE OF available_qty, allocated_qty ON inventory
        FOR EACH ROW
        EXECUTE FUNCTION check_and_trigger_alerts();
        
        RAISE NOTICE 'Created inventory alerts trigger on quantity changes';
    END IF;
END $$;

-- Example trigger for work order updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_check_work_order_alerts'
        AND tgrelid = 'work_orders'::regclass
    ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_orders') THEN
        CREATE TRIGGER trg_check_work_order_alerts
        AFTER INSERT OR UPDATE OF status, actual_end, actual_start ON work_orders
        FOR EACH ROW
        EXECUTE FUNCTION check_and_trigger_alerts();
    END IF;
END $$;

-- =============================================
-- COMMENTS
-- =============================================

-- Table comments
COMMENT ON TABLE alert_configs IS 'Configuration for different types of alerts';
COMMENT ON TABLE alert_rules IS 'Rules that define when alerts should be triggered';
COMMENT ON TABLE alert_history IS 'Historical record of all triggered alerts';
COMMENT ON TABLE notification_logs IS 'Log of all notifications sent for alerts';
COMMENT ON TABLE alert_suppressions IS 'Temporary suppressions for specific alerts';
COMMENT ON TABLE wip_alert_config IS 'Legacy WIP alert configuration for stage-based monitoring';
COMMENT ON TABLE wip_alert_history IS 'Legacy WIP alert history records';
COMMENT ON TABLE wip_notification_log IS 'Legacy WIP alert notifications';

-- Column comments
COMMENT ON COLUMN alert_configs.condition_config IS 'JSON configuration for the alert condition';
COMMENT ON COLUMN alert_configs.notification_channels IS 'Array of channels to send notifications (EMAIL, SMS, IN_APP, etc.)';
COMMENT ON COLUMN alert_configs.recipients IS 'JSON array of recipient configurations (users, roles, or direct emails)';
COMMENT ON COLUMN alert_rules.entity_filter IS 'JSON filter to match specific entities';
COMMENT ON COLUMN alert_history.context_data IS 'Additional context data about the alert';
COMMENT ON COLUMN alert_history.acknowledged_by IS 'User who acknowledged the alert';
COMMENT ON COLUMN alert_history.resolved_by IS 'User who resolved the alert';
COMMENT ON COLUMN notification_logs.recipient IS 'The target of the notification (email, user ID, etc.)';
COMMENT ON COLUMN notification_logs.metadata IS 'Additional metadata about the notification';

-- Create view for active alerts
CREATE OR REPLACE VIEW vw_active_alerts AS
SELECT 
    h.id,
    h.alert_config_id,
    c.name AS alert_name,
    h.title,
    h.message,
    h.severity,
    h.status,
    h.entity_type,
    h.entity_id,
    h.context_data,
    h.acknowledged_by,
    h.acknowledged_at,
    h.resolved_by,
    h.resolved_at,
    h.created_at,
    h.updated_at
FROM 
    alert_history h
    JOIN alert_configs c ON h.alert_config_id = c.id
WHERE 
    h.status != 'RESOLVED' 
    AND h.status != 'SUPPRESSED';

-- Add comment for the view
COMMENT ON VIEW vw_active_alerts IS 'View showing all currently active (unresolved) alerts';

-- Function comments
COMMENT ON FUNCTION check_and_trigger_alerts() IS 'Main function to check conditions and trigger alerts';
COMMENT ON FUNCTION update_alert_history_status() IS 'Automatically updates timestamps when alert status changes';
