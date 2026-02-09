-- =============================================
-- 006: NOTIFICATIONS SYSTEM
-- Notification system for material requests and transfers
-- Consolidation of: 008, 013
-- =============================================

SET search_path TO public;

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type VARCHAR(50) NOT NULL,  -- 'material_request', 'transfer_approved', etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,  -- Links to material_requisitions.id, material_transfers.id, etc.
    reference_type VARCHAR(50),  -- 'material_requisition', 'material_transfer', etc.
    reference_number VARCHAR(50),  -- MR-2026-0001, TR-2026-0001, etc.
    target_role VARCHAR(50),  -- 'inventory', 'warehouse', 'production', etc.
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Specific user (optional)
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Auto-delete old notifications
    metadata JSONB,  -- Additional data (work_order, rm_code, quantity, etc.)
    CONSTRAINT chk_target CHECK (target_role IS NOT NULL OR target_user_id IS NOT NULL)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role, is_read) WHERE target_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id, is_read) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read) WHERE is_read = FALSE;

-- 3. REMOVAL OF TRIGGERS (From 013: Fix Notifications)
-- Trigger-based notification creation is removed in favor of service-layer logic
DROP TRIGGER IF EXISTS trg_create_material_request_notification ON material_requisitions;
DROP FUNCTION IF EXISTS create_material_request_notification();

-- 4. FUNCTION TO AUTO-DELETE OLD NOTIFICATIONS
-- Delete notifications older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_read = TRUE;
    
    -- Also delete expired notifications
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. HELPER VIEW FOR UNREAD COUNTS
CREATE OR REPLACE VIEW vw_notification_counts AS
SELECT 
    target_role,
    COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
    COUNT(*) as total_count,
    MAX(created_at) FILTER (WHERE is_read = FALSE) as latest_unread_at
FROM notifications
WHERE target_role IS NOT NULL
GROUP BY target_role;

-- 6. COMMENTS
COMMENT ON TABLE notifications IS 'System notifications for material requests, transfers, and other events';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: material_request, transfer_approved, etc.';
COMMENT ON COLUMN notifications.reference_id IS 'UUID reference to the source record (requisition, transfer, etc.)';
COMMENT ON COLUMN notifications.reference_number IS 'Human-readable reference number (MR-2026-0001, etc.)';
COMMENT ON COLUMN notifications.target_role IS 'Target role for the notification (inventory, warehouse, production)';
COMMENT ON COLUMN notifications.metadata IS 'JSON data with additional context (work_order, items, quantities, etc.)';
COMMENT ON VIEW vw_notification_counts IS 'Summary of unread notification counts by role';
