-- =============================================
-- WIP ALERTS AND NOTIFICATIONS SCHEMA
-- Supervisor alerts for low utilization and bottlenecks
-- =============================================

-- =============================================
-- ALERT CONFIGURATION TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wip_alert_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_utilization', 'high_avg_time', 'bottleneck', 'stage_delayed')),
    stage_name VARCHAR(100),  -- NULL means applies to all stages
    threshold_value DECIMAL(10,2) NOT NULL,  -- e.g., 70 for 70% utilization
    is_active BOOLEAN DEFAULT true,
    notify_roles TEXT[] DEFAULT ARRAY['Supervisor', 'Admin'],  -- Array of roles to notify
    notify_emails TEXT[],  -- Optional specific email addresses
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_config_type ON wip_alert_config(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_config_stage ON wip_alert_config(stage_name);
CREATE INDEX IF NOT EXISTS idx_alert_config_active ON wip_alert_config(is_active);

COMMENT ON TABLE wip_alert_config IS 'Configuration for WIP alerts and thresholds';
COMMENT ON COLUMN wip_alert_config.threshold_value IS 'Threshold value - meaning depends on alert_type (e.g., 70 = 70% for utilization)';

-- =============================================
-- ALERT HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wip_alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_config_id UUID REFERENCES wip_alert_config(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    current_value DECIMAL(10,2),  -- Current metric value that triggered alert
    threshold_value DECIMAL(10,2),  -- Threshold that was exceeded
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB  -- Additional context (orders_count, units_count, etc.)
);

CREATE INDEX IF NOT EXISTS idx_alert_history_config ON wip_alert_history(alert_config_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_stage ON wip_alert_history(stage_name);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON wip_alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged ON wip_alert_history(is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON wip_alert_history(created_at DESC);

COMMENT ON TABLE wip_alert_history IS 'Historical record of all WIP alerts triggered';

-- =============================================
-- NOTIFICATION LOG TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wip_notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_history_id UUID REFERENCES wip_alert_history(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'sms', 'in_app', 'webhook')),
    recipient VARCHAR(255) NOT NULL,  -- Email, phone, user_id, or webhook URL
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_log_alert ON wip_notification_log(alert_history_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON wip_notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON wip_notification_log(notification_type);

COMMENT ON TABLE wip_notification_log IS 'Log of all notifications sent for WIP alerts';

-- =============================================
-- TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_alert_config_updated_at ON wip_alert_config;
CREATE TRIGGER update_alert_config_updated_at BEFORE UPDATE ON wip_alert_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DEFAULT ALERT CONFIGURATIONS
-- =============================================
INSERT INTO wip_alert_config (alert_type, stage_name, threshold_value, notify_roles, is_active)
VALUES 
    -- Low utilization alerts (< 70%)
    ('low_utilization', NULL, 70.0, ARRAY['Supervisor', 'Admin'], true),
    
    -- High average time alerts (> 120% of target)
    ('high_avg_time', NULL, 120.0, ARRAY['Supervisor'], true),
    
    -- Stage delayed alerts
    ('stage_delayed', NULL, 0, ARRAY['Supervisor', 'Admin'], true)
ON CONFLICT DO NOTHING;

-- =============================================
-- FUNCTION TO CHECK AND CREATE ALERTS
-- =============================================
CREATE OR REPLACE FUNCTION check_wip_alerts()
RETURNS void AS $$
DECLARE
    stage_record RECORD;
    config_record RECORD;
    alert_message TEXT;
    alert_severity VARCHAR(20);
BEGIN
    -- Check each active stage against alert configurations
    FOR stage_record IN 
        SELECT * FROM wip_stage_metrics WHERE is_active = true
    LOOP
        -- Check low utilization
        FOR config_record IN 
            SELECT * FROM wip_alert_config 
            WHERE alert_type = 'low_utilization' 
            AND is_active = true
            AND (stage_name IS NULL OR stage_name = stage_record.stage_name)
        LOOP
            IF stage_record.utilization_percentage < config_record.threshold_value THEN
                alert_message := format(
                    'Low utilization detected in %s: %s%% (threshold: %s%%)',
                    stage_record.stage_name,
                    ROUND(stage_record.utilization_percentage, 1),
                    config_record.threshold_value
                );
                
                alert_severity := CASE 
                    WHEN stage_record.utilization_percentage < config_record.threshold_value * 0.5 THEN 'critical'
                    WHEN stage_record.utilization_percentage < config_record.threshold_value * 0.8 THEN 'warning'
                    ELSE 'info'
                END;
                
                -- Create alert if not already exists in last hour
                INSERT INTO wip_alert_history (
                    alert_config_id, alert_type, stage_name, severity, message,
                    current_value, threshold_value, metadata
                )
                SELECT 
                    config_record.id,
                    'low_utilization',
                    stage_record.stage_name,
                    alert_severity,
                    alert_message,
                    stage_record.utilization_percentage,
                    config_record.threshold_value,
                    jsonb_build_object(
                        'orders_count', stage_record.orders_count,
                        'units_count', stage_record.units_count,
                        'avg_time_minutes', stage_record.avg_time_minutes,
                        'health_status', stage_record.health_status
                    )
                WHERE NOT EXISTS (
                    SELECT 1 FROM wip_alert_history
                    WHERE alert_type = 'low_utilization'
                    AND stage_name = stage_record.stage_name
                    AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
                );
            END IF;
        END LOOP;
        
        -- Check high average time
        FOR config_record IN 
            SELECT * FROM wip_alert_config 
            WHERE alert_type = 'high_avg_time' 
            AND is_active = true
            AND (stage_name IS NULL OR stage_name = stage_record.stage_name)
        LOOP
            IF stage_record.avg_time_minutes > (stage_record.target_time_minutes * config_record.threshold_value / 100) THEN
                alert_message := format(
                    'High average time in %s: %s min (target: %s min)',
                    stage_record.stage_name,
                    ROUND(stage_record.avg_time_minutes, 1),
                    ROUND(stage_record.target_time_minutes, 1)
                );
                
                INSERT INTO wip_alert_history (
                    alert_config_id, alert_type, stage_name, severity, message,
                    current_value, threshold_value, metadata
                )
                SELECT 
                    config_record.id,
                    'high_avg_time',
                    stage_record.stage_name,
                    'warning',
                    alert_message,
                    stage_record.avg_time_minutes,
                    stage_record.target_time_minutes,
                    jsonb_build_object(
                        'orders_count', stage_record.orders_count,
                        'units_count', stage_record.units_count
                    )
                WHERE NOT EXISTS (
                    SELECT 1 FROM wip_alert_history
                    WHERE alert_type = 'high_avg_time'
                    AND stage_name = stage_record.stage_name
                    AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
                );
            END IF;
        END LOOP;
        
        -- Check stage delayed
        IF stage_record.health_status = 'delayed' THEN
            FOR config_record IN 
                SELECT * FROM wip_alert_config 
                WHERE alert_type = 'stage_delayed' 
                AND is_active = true
                AND (stage_name IS NULL OR stage_name = stage_record.stage_name)
            LOOP
                alert_message := format(
                    'Stage %s is delayed - %s orders, %s units in queue',
                    stage_record.stage_name,
                    stage_record.orders_count,
                    stage_record.units_count
                );
                
                INSERT INTO wip_alert_history (
                    alert_config_id, alert_type, stage_name, severity, message,
                    current_value, threshold_value, metadata
                )
                SELECT 
                    config_record.id,
                    'stage_delayed',
                    stage_record.stage_name,
                    'critical',
                    alert_message,
                    stage_record.utilization_percentage,
                    0,
                    jsonb_build_object(
                        'orders_count', stage_record.orders_count,
                        'units_count', stage_record.units_count,
                        'avg_time_minutes', stage_record.avg_time_minutes,
                        'target_time_minutes', stage_record.target_time_minutes
                    )
                WHERE NOT EXISTS (
                    SELECT 1 FROM wip_alert_history
                    WHERE alert_type = 'stage_delayed'
                    AND stage_name = stage_record.stage_name
                    AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 minutes'
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_wip_alerts IS 'Check WIP metrics against alert configurations and create alerts';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- View alert configurations
-- SELECT * FROM wip_alert_config ORDER BY alert_type, stage_name;

-- View recent alerts
-- SELECT * FROM wip_alert_history ORDER BY created_at DESC LIMIT 20;

-- View unacknowledged alerts
-- SELECT * FROM wip_alert_history WHERE is_acknowledged = false ORDER BY severity DESC, created_at DESC;

-- View notification log
-- SELECT * FROM wip_notification_log ORDER BY created_at DESC LIMIT 20;
