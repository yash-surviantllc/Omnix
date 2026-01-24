-- =============================================
-- 004: MONITORING & UTILITIES
-- Unified Migration for Omnix Manufacturing
-- Source: 007_wip_alerts.sql
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. WIP ALERT CONFIGURATION
-- =============================================
CREATE TABLE IF NOT EXISTS wip_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_utilization', 'high_avg_time', 'bottleneck', 'stage_delayed')),
    stage_name VARCHAR(100),  -- NULL means applies to all stages
    threshold_value DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notify_roles TEXT[] DEFAULT ARRAY['Supervisor', 'Admin'],
    notify_emails TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_config_type ON wip_alert_config(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_config_stage ON wip_alert_config(stage_name);
CREATE INDEX IF NOT EXISTS idx_alert_config_active ON wip_alert_config(is_active);

COMMENT ON TABLE wip_alert_config IS 'Configuration for WIP alerts and thresholds';

-- =============================================
-- 2. WIP ALERT HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS wip_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_config_id UUID REFERENCES wip_alert_config(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    current_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_alert_history_config ON wip_alert_history(alert_config_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_stage ON wip_alert_history(stage_name);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON wip_alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged ON wip_alert_history(is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON wip_alert_history(created_at DESC);

COMMENT ON TABLE wip_alert_history IS 'Historical record of all WIP alerts triggered';

-- =============================================
-- 3. NOTIFICATION LOG
-- =============================================
CREATE TABLE IF NOT EXISTS wip_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_history_id UUID REFERENCES wip_alert_history(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'sms', 'in_app', 'webhook')),
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_alert ON wip_notification_log(alert_history_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON wip_notification_log(status);

COMMENT ON TABLE wip_notification_log IS 'Log of all notifications sent for WIP alerts';

-- =============================================
-- 4. TRIGGERS
-- =============================================
CREATE TRIGGER update_alert_config_updated_at BEFORE UPDATE ON wip_alert_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- =============================================
-- 5. STOCK ALERT LOGIC (Function Check)
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
                    AND created_at > NOW() - INTERVAL '1 hour'
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
                    AND created_at > NOW() - INTERVAL '1 hour'
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
                    AND created_at > NOW() - INTERVAL '30 minutes'
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. SEED DATA
-- =============================================
INSERT INTO wip_alert_config (alert_type, stage_name, threshold_value, notify_roles, is_active)
VALUES 
    ('low_utilization', NULL, 70.0, ARRAY['Supervisor', 'Admin'], true),
    ('high_avg_time', NULL, 120.0, ARRAY['Supervisor'], true),
    ('stage_delayed', NULL, 0, ARRAY['Supervisor', 'Admin'], true)
ON CONFLICT DO NOTHING;
