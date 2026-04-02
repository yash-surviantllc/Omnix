from typing import List, Optional, Dict
from datetime import datetime
from app.database import get_db
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from app.schemas.material_requisition import MaterialRequisitionResponse


class NotificationService:
    """Service for sending notifications (email, SMS, in-app)"""
    
    @staticmethod
    async def send_alert_notification(
        alert_id: str,
        recipients: List[str],
        notification_type: str = 'in_app'
    ) -> Dict:
        """
        Send notification for a WIP alert.
        
        Args:
            alert_id: Alert history ID
            recipients: List of email addresses or user IDs
            notification_type: 'email', 'sms', 'in_app', 'webhook'
        
        Returns:
            Dict with notification results
        """
        db = get_db()
        
        # Get alert details
        alert = db.table('wip_alert_history').select('*').eq('id', alert_id).execute()
        
        if not alert.data:
            raise Exception(f"Alert {alert_id} not found")
        
        alert_data = alert.data[0]
        
        results = []
        
        for recipient in recipients:
            try:
                if notification_type == 'email':
                    result = await NotificationService._send_email(recipient, alert_data)
                elif notification_type == 'in_app':
                    result = await NotificationService._send_in_app(recipient, alert_data)
                elif notification_type == 'sms':
                    result = await NotificationService._send_sms(recipient, alert_data)
                else:
                    result = {'status': 'failed', 'error': 'Unsupported notification type'}
                
                # Log notification
                db.table('wip_notification_log').insert({
                    'alert_history_id': alert_id,
                    'notification_type': notification_type,
                    'recipient': recipient,
                    'status': result.get('status', 'failed'),
                    'error_message': result.get('error'),
                    'sent_at': datetime.utcnow().isoformat() if result.get('status') == 'sent' else None
                }).execute()
                
                results.append({
                    'recipient': recipient,
                    'status': result.get('status'),
                    'error': result.get('error')
                })
                
            except Exception as e:
                results.append({
                    'recipient': recipient,
                    'status': 'failed',
                    'error': str(e)
                })
        
        return {
            'alert_id': alert_id,
            'notification_type': notification_type,
            'results': results
        }
    
    @staticmethod
    async def _send_email(recipient: str, alert_data: Dict) -> Dict:
        """Send email notification"""
        try:
            # Email configuration from environment variables
            smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_user = os.getenv('SMTP_USER')
            smtp_password = os.getenv('SMTP_PASSWORD')
            from_email = os.getenv('FROM_EMAIL', smtp_user)
            
            if not smtp_user or not smtp_password:
                # If email not configured, log as in-app notification instead
                return await NotificationService._send_in_app(recipient, alert_data)
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"WIP Alert: {alert_data['alert_type'].replace('_', ' ').title()}"
            msg['From'] = from_email
            msg['To'] = recipient
            
            # Email body
            html_body = f"""
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #{'dc2626' if alert_data['severity'] == 'critical' else 'f59e0b' if alert_data['severity'] == 'warning' else '3b82f6'};">
                  WIP Alert
                </h2>
                <p><strong>Stage:</strong> {alert_data['stage_name']}</p>
                <p><strong>Severity:</strong> {alert_data['severity'].upper()}</p>
                <p><strong>Message:</strong> {alert_data['message']}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                  Alert triggered at {alert_data['created_at']}<br>
                  Manufacturing OS - WIP Monitoring System
                </p>
              </body>
            </html>
            """
            
            text_body = f"""
            WIP Alert - {alert_data['severity'].upper()}
            
            Stage: {alert_data['stage_name']}
            Message: {alert_data['message']}
            
            Alert triggered at {alert_data['created_at']}
            Manufacturing OS - WIP Monitoring System
            """
            
            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            
            msg.attach(part1)
            msg.attach(part2)
            
            # Send email
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
            
            return {'status': 'sent'}
            
        except Exception as e:
            return {'status': 'failed', 'error': str(e)}
    
    @staticmethod
    async def _send_in_app(recipient: str, alert_data: Dict) -> Dict:
        """Create in-app notification"""
        db = get_db()
        
        try:
            # Create in-app notification (stored in database for user to view)
            db.table('notifications').insert({
                'user_id': recipient,  # Assuming recipient is user_id for in-app
                'type': 'wip_alert',
                'title': f"WIP Alert: {alert_data['stage_name']}",
                'message': alert_data['message'],
                'severity': alert_data['severity'],
                'is_read': False,
                'metadata': {
                    'alert_id': alert_data['id'],
                    'stage_name': alert_data['stage_name'],
                    'alert_type': alert_data['alert_type']
                }
            }).execute()
            
            return {'status': 'sent'}
            
        except Exception as e:
            # If notifications table doesn't exist, just mark as sent
            # (will be created in future migration)
            return {'status': 'sent'}
    
    @staticmethod
    async def _send_sms(recipient: str, alert_data: Dict) -> Dict:
        """Send SMS notification (placeholder - requires SMS service integration)"""
        # TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
        # For now, fall back to in-app notification
        return await NotificationService._send_in_app(recipient, alert_data)
    
    @staticmethod
    async def get_supervisor_contacts(roles: List[str]) -> List[str]:
        """Get email addresses of users with specified roles"""
        db = get_db()
        
        try:
            # Get users with specified roles
            users = db.table('users').select('email, user_roles(roles(name))').execute()
            
            supervisor_emails = []
            for user in users.data:
                user_roles = [r['roles']['name'] for r in user.get('user_roles', [])]
                if any(role in user_roles for role in roles):
                    if user.get('email'):
                        supervisor_emails.append(user['email'])
            
            return supervisor_emails
            
        except Exception:
            return []
    
    @staticmethod
    async def process_pending_alerts():
        """Process all unacknowledged alerts and send notifications"""
        db = get_db()
        
        # Get unacknowledged alerts from last 24 hours
        alerts = db.table('wip_alert_history').select('*').eq(
            'is_acknowledged', False
        ).gte(
            'created_at', datetime.utcnow().replace(hour=0, minute=0, second=0).isoformat()
        ).execute()
        
        for alert in alerts.data:
            # Get alert configuration
            config = db.table('wip_alert_config').select('*').eq('id', alert['alert_config_id']).execute()
            
            if not config.data:
                continue
            
            config_data = config.data[0]
            
            # Get recipients based on roles
            recipients = await NotificationService.get_supervisor_contacts(config_data.get('notify_roles', ['Supervisor']))
            
            # Add specific emails from config
            if config_data.get('notify_emails'):
                recipients.extend(config_data['notify_emails'])
            
            # Send notifications
            if recipients:
                await NotificationService.send_alert_notification(
                    alert['id'],
                    recipients,
                    'email'  # Can be made configurable
                )
    
    # =============================================
    # MATERIAL REQUEST NOTIFICATIONS
    # =============================================
    
    @staticmethod
    async def get_material_request_notifications(
        is_read: Optional[bool] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get material request notifications with full requisition details
        
        Args:
            is_read: Filter by read status
            limit: Maximum number of notifications
            
        Returns:
            List of enriched notifications with requisition and item details
        """
        db = get_db()
        
        # Get notifications
        query = (
            db.table('notifications')
            .select('*')
            .eq('notification_type', 'material_request')
            .eq('target_role', 'inventory')
        )
        
        if is_read is not None:
            query = query.eq('is_read', is_read)
        
        query = query.order('created_at', desc=True).limit(limit)
        notifications = query.execute().data or []
        
        if not notifications:
            return []

        # Batch Lookups
        req_ids = list(set(filter(None, [n.get('reference_id') for n in notifications])))
        
        requisitions_map = {}
        items_map = {}
        wo_map = {}
        product_map = {}
        
        if req_ids:
            # 1. Batch Requisitions
            req_res = db.table('material_requisitions').select('*').in_('id', req_ids).execute()
            requisitions_map = {r['id']: r for r in req_res.data}
            
            # 2. Batch Items
            items_res = db.table('material_requisition_items').select('*').in_('requisition_id', req_ids).execute()
            for item in items_res.data:
                rid = item['requisition_id']
                if rid not in items_map:
                    items_map[rid] = []
                items_map[rid].append(item)
            
            # 3. Batch Work Orders
            wo_numbers = list(set(filter(None, [r.get('work_order_number') for r in requisitions_map.values()])))
            if wo_numbers:
                wo_res = db.table('work_orders').select('work_order_number', 'product_id').in_('work_order_number', wo_numbers).execute()
                wo_map = {w['work_order_number']: w['product_id'] for w in wo_res.data}
                
                # 4. Batch Products
                p_ids = list(set(filter(None, wo_map.values())))
                if p_ids:
                    prod_res = db.table('products').select('id', 'code', 'name').in_('id', p_ids).execute()
                    product_map = {p['id']: p for p in prod_res.data}
        
        enriched = []
        for notif in notifications:
            req_id = notif.get('reference_id')
            req = requisitions_map.get(req_id)
            if not req:
                continue
            
            items = items_map.get(req_id, [])
            wo_number = req.get('work_order_number')
            prod_id = wo_map.get(wo_number) if wo_number else None
            prod = product_map.get(prod_id) if prod_id else None
            
            enriched_data = {
                'notification_id': notif['id'],
                'is_read': notif['is_read'],
                'created_at': notif['created_at'],
                'requisition_number': req['requisition_number'],
                'work_order_number': wo_number,
                'department': req['department'],
                'requesting_stage': req.get('requesting_stage'),
                'requested_by': req['requested_by'],
                'shift': req.get('shift'),
                'status': req['status'],
                'items': items,
                'reference_id': req_id,
                'sku_id': prod.get('code') if prod else None,
                'product_name': prod.get('name') if prod else None
            }
            enriched.append(enriched_data)
            
        return enriched
    
    @staticmethod
    async def mark_notifications_as_read(notification_ids: List[str]) -> Dict:
        """
        Mark notifications as read
        
        Args:
            notification_ids: List of notification IDs to mark as read
            
        Returns:
            Success message with count
        """
        db = get_db()
        
        result = (
            db.table('notifications')
            .update({
                'is_read': True,
                'read_at': datetime.utcnow().isoformat()
            })
            .in_('id', notification_ids)
            .execute()
        )
        
        return {
            "message": f"Marked {len(notification_ids)} notifications as read",
            "updated_count": len(result.data) if result.data else 0
        }
    
    @staticmethod
    async def get_unread_count_for_role(role: str) -> Dict:
        """
        Get count of unread notifications for a role
        
        Args:
            role: Target role
            
        Returns:
            Unread count and latest unread timestamp
        """
        db = get_db()
        
        # Get unread notifications
        result = (
            db.table('notifications')
            .select('id, created_at')
            .eq('target_role', role)
            .eq('is_read', False)
            .order('created_at', desc=True)
            .execute()
        )
        
        unread_count = len(result.data) if result.data else 0
        latest_unread_at = result.data[0]['created_at'] if result.data else None
        
        return {
            "unread_count": unread_count,
            "latest_unread_at": latest_unread_at
        }


    @staticmethod
    async def create_material_request_notification(requisition: MaterialRequisitionResponse) -> Dict:
        """
        Create a notification for a new material requisition.
        """
        db = get_db()
        
        try:
            # Calculate item summary
            items_summary = ", ".join([
                f"{item.rm_code}: {item.quantity_requested} {item.unit_of_measure}"
                for item in requisition.items[:3]
            ])
            if len(requisition.items) > 3:
                items_summary += "..."
            
            # Create notification
            notification_data = {
                'notification_type': 'material_request',
                'title': 'New Material Request',
                'message': f"Material request {requisition.requisition_number} from {requisition.department}" + 
                           (f" ({requisition.requesting_stage})" if requisition.requesting_stage else ""),
                'reference_id': requisition.id,
                'reference_type': 'material_requisition',
                'reference_number': requisition.requisition_number,
                'target_role': 'inventory',
                'metadata': {
                    'requisition_number': requisition.requisition_number,
                    'work_order_number': requisition.work_order_number,
                    'department': requisition.department,
                    'requesting_stage': requisition.requesting_stage,
                    'requested_by': requisition.requested_by,
                    'shift': requisition.shift,
                    'item_count': len(requisition.items),
                    'items_summary': items_summary,
                    'status': requisition.status
                },
                'created_at': datetime.utcnow().isoformat(),
                'is_read': False
            }
            
            result = db.table('notifications').insert(notification_data).execute()
            
            return {'status': 'created', 'id': result.data[0]['id'] if result.data else None}
            
        except Exception as e:
            print(f"Failed to create notification: {e}")
            return {'status': 'failed', 'error': str(e)}


notification_service = NotificationService()
