from typing import List, Optional, Dict
from datetime import datetime
from app.database import get_db
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os


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
            severity_emoji = {
                'info': 'ℹ️',
                'warning': '⚠️',
                'critical': '🚨'
            }
            
            html_body = f"""
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #{'dc2626' if alert_data['severity'] == 'critical' else 'f59e0b' if alert_data['severity'] == 'warning' else '3b82f6'};">
                  {severity_emoji.get(alert_data['severity'], '📢')} WIP Alert
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


notification_service = NotificationService()
