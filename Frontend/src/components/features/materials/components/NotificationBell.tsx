import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Package, MapPin, User, Calendar, FileText, Clock, Layers, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

interface MaterialRequestNotification {
    notification_id: string;
    is_read: boolean;
    created_at: string;
    requisition_number: string;
    work_order_number?: string;
    department: string;
    requesting_stage?: string;
    requested_by: string;
    shift?: string;
    status: string;
    items: Array<{
        rm_code: string;
        material_description: string;
        quantity_requested: number;
        unit_of_measure: string;
        priority: string;
    }>;
    sku_id?: string;
    product_name?: string;
    reference_id?: string; // Material Requisition ID
    notification_type?: string;
}

interface NotificationBellProps {
    language?: 'en' | 'hi';
}

const translations = {
    en: {
        notifications: 'Material Request Notifications',
        noNotifications: 'No new notifications',
        markAllRead: 'Mark All Read',
        requisitionNumber: 'Requisition #',
        workOrder: 'Work Order',
        department: 'Department',
        requestedBy: 'Requested By',
        shift: 'Shift',
        items: 'Items',
        rmCode: 'RM Code',
        quantity: 'Quantity',
        priority: 'Priority',
        viewDetails: 'View Details',
        close: 'Close',
        approve: 'Approve Request',
        requestingStage: 'Requesting Stage',
        itemsRequested: 'items requested',
        clickToViewDetails: 'Click to view full details',
        materialDetails: 'Material Details',
        description: 'Description'
    },
    hi: {
        notifications: 'सामग्री अनुरोध सूचनाएं',
        noNotifications: 'कोई नई सूचना नहीं',
        markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
        requisitionNumber: 'अनुरोध #',
        workOrder: 'वर्क ऑर्डर',
        department: 'विभाग',
        requestedBy: 'द्वारा अनुरोध किया गया',
        shift: 'शिफ्ट',
        items: 'आइटम',
        rmCode: 'आरएम कोड',
        quantity: 'मात्रा',
        priority: 'प्राथमिकता',
        viewDetails: 'विवरण देखें',
        close: 'बंद करें',
        approve: 'अनुरोध स्वीकृत करें',
        requestingStage: 'अनुरोध चरण',
        itemsRequested: 'आइटम अनुरोध किए गए',
        clickToViewDetails: 'पूर्ण विवरण देखने के लिए क्लिक करें',
        materialDetails: 'सामग्री विवरण',
        description: 'विवरण'
    }
};

export function NotificationBell({ language = 'en' }: NotificationBellProps) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [showPanel, setShowPanel] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<MaterialRequestNotification | null>(null);
    const [notifications, setNotifications] = useState<MaterialRequestNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [approving, setApproving] = useState(false);

    const t = translations[language];

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (showPanel) {
            fetchNotifications();
        }
    }, [showPanel]);

    const fetchUnreadCount = async () => {
        try {
            const response = await apiClient.get<{ unread_count: number }>('/notifications/unread-count?role=inventory');
            setUnreadCount(response.unread_count);
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    };

    const approveRequest = async () => {
        if (!selectedNotification?.reference_id) return;

        setApproving(true);
        try {
            await apiClient.post(`/material-requisitions/${selectedNotification.reference_id}/approve`);

            // Update local state to reflect approval immediately
            setNotifications(prev => prev.map(n =>
                n.notification_id === selectedNotification.notification_id
                    ? { ...n, status: 'Approved' }
                    : n
            ));

            // Also update the selected notification to hide the button
            setSelectedNotification(prev => prev ? { ...prev, status: 'Approved' } : null);

            setShowDetailModal(false);
            alert('Request approved successfully!');
        } catch (error) {
            console.error('Failed to approve request:', error);
            alert('Failed to approve request: ' + (error as any).message);
        } finally {
            setApproving(false);
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<MaterialRequestNotification[]>('/notifications/material-requests');
            setNotifications(response);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.notification_id);
        if (unreadIds.length === 0) return;

        try {
            await apiClient.post('/notifications/mark-read', {
                notification_ids: unreadIds
            });

            // Update local state
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
        }
    };

    const handleNotificationClick = async (notification: MaterialRequestNotification) => {
        setSelectedNotification(notification);
        setShowDetailModal(true);
        setShowPanel(false); // Close the notification panel when opening detail modal

        // Mark as read if unread
        if (!notification.is_read) {
            try {
                await apiClient.post('/notifications/mark-read', {
                    notification_ids: [notification.notification_id]
                });

                // Update local state
                setNotifications(notifications.map(n =>
                    n.notification_id === notification.notification_id ? { ...n, is_read: true } : n
                ));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (error) {
                console.error('Failed to mark notification as read:', error);
            }
        }
    };



    return (
        <>
            {/* Bell Icon Button - REFINED */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowPanel(!showPanel);
                }}
                className="relative p-2.5 hover:bg-zinc-100 rounded-lg transition-all duration-200 group"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-zinc-700 group-hover:text-zinc-900 transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg border-2 border-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Dropdown Panel - WIDER & SIDE-BY-SIDE */}
            {showPanel && createPortal(
                <div className="fixed inset-0 z-[9998] flex items-start justify-end p-4" onClick={() => setShowPanel(false)}>
                    <div
                        className="relative z-[9999] bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col mt-16 border border-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-zinc-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bell className="w-5 h-5" />
                                    <h2 className="text-lg font-semibold">{t.notifications}</h2>
                                    {unreadCount > 0 && (
                                        <span className="bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAllAsRead();
                                            }}
                                            className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md transition-colors font-medium border border-white/20"
                                        >
                                            {t.markAllRead}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowPanel(false)}
                                        className="p-1 hover:bg-white/10 rounded transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Side-by-Side Grid Layout */}
                        <div className="flex-1 overflow-hidden bg-zinc-50 relative">
                            {loading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                                    Loading...
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                                    <Bell className="w-12 h-12 text-zinc-300 mb-3" />
                                    <p>{t.noNotifications}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-zinc-200">

                                    {/* Left Column: Pending Requests */}
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                                            <span>Pending Requests</span>
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700 hover:bg-gray-200">
                                                {notifications.filter(n => n.status !== 'Approved').length}
                                            </Badge>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {notifications.filter(n => n.status !== 'Approved').length === 0 ? (
                                                <div className="text-center py-8 text-sm text-gray-400 italic">No pending requests</div>
                                            ) : (
                                                notifications.filter(n => n.status !== 'Approved').map(notification => (
                                                    <NotificationItem
                                                        key={notification.notification_id}
                                                        notification={notification}
                                                        onClick={() => handleNotificationClick(notification)}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Approved Requests */}
                                    <div className="flex flex-col h-full overflow-hidden bg-white/50">
                                        <div className="px-4 py-2 text-xs font-bold text-green-600 uppercase tracking-wider bg-green-50/50 border-b border-green-100 flex items-center justify-between sticky top-0 z-10">
                                            <span className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Approved Requests
                                            </span>
                                            <Badge variant="outline" className="text-[10px] h-5 border-green-200 text-green-700 bg-green-50">
                                                {notifications.filter(n => n.status === 'Approved').length}
                                            </Badge>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {notifications.filter(n => n.status === 'Approved').length === 0 ? (
                                                <div className="text-center py-8 text-sm text-gray-400 italic">No approved requests</div>
                                            ) : (
                                                notifications.filter(n => n.status === 'Approved').map(notification => (
                                                    <NotificationItem
                                                        key={notification.notification_id}
                                                        notification={notification}
                                                        onClick={() => handleNotificationClick(notification)}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Detailed Notification Modal - PORTAL Rendered */}
            {showDetailModal && selectedNotification && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}>
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 border-b border-zinc-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold">
                                            {selectedNotification.requisition_number}
                                        </h2>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge className={`text-[10px] px-2 h-5 border-0 ${getStatusColor(selectedNotification.status)}`}>
                                                {selectedNotification.status}
                                            </Badge>
                                            <span className="text-xs text-white/60 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(selectedNotification.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
                            <div className="grid grid-cols-2 gap-2">
                                {selectedNotification.work_order_number && (
                                    <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-medium text-zinc-500">{t.workOrder}</div>
                                                <div className="font-semibold text-sm text-zinc-900 truncate">{selectedNotification.work_order_number}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="p-3 bg-white rounded-lg border border-zinc-200 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-zinc-600" />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-zinc-500">{t.department}</div>
                                            <div className="font-semibold text-sm text-zinc-900 truncate">{selectedNotification.department}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-white rounded-lg border border-zinc-200 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-zinc-600" />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-medium text-zinc-500">{t.requestedBy}</div>
                                            <div className="font-semibold text-sm text-zinc-900 truncate">{selectedNotification.requested_by}</div>
                                        </div>
                                    </div>
                                </div>
                                {selectedNotification.shift && (
                                    <div className="p-3 bg-white rounded-lg border border-zinc-200 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-zinc-600" />
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-medium text-zinc-500">{t.shift}</div>
                                                <div className="font-semibold text-sm text-zinc-900">{selectedNotification.shift}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Materials Section */}
                            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-3">
                                <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-blue-600" />
                                    {t.materialDetails} ({selectedNotification.items.length})
                                </h3>
                                <div className="space-y-2">
                                    {selectedNotification.items.map((item, idx) => (
                                        <div key={idx} className="border border-zinc-200 rounded-lg p-3 hover:shadow-sm hover:border-blue-200 transition-all bg-white">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-zinc-900 text-sm">{item.rm_code}</span>
                                                        <Badge className={`${getPriorityColor(item.priority)} text-[10px] px-1.5 py-0`}>
                                                            {item.priority}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-zinc-700 mb-2 line-clamp-2">{item.material_description}</p>
                                                    <div className="inline-flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded">
                                                        <span className="text-[10px] font-medium text-zinc-600">{t.quantity}:</span>
                                                        <span className="font-bold text-blue-700 text-xs">
                                                            {item.quantity_requested} {item.unit_of_measure}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 border-t border-zinc-200 bg-white flex justify-end gap-3">
                            <Button onClick={() => setShowDetailModal(false)} variant="outline" size="sm">
                                {t.close}
                            </Button>
                            {selectedNotification.status?.trim().toLowerCase() !== 'approved' && (
                                <Button
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to approve this request?')) {
                                            await approveRequest();
                                        }
                                    }}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded shadow-sm text-xs font-medium"
                                    size="sm"
                                    disabled={approving}
                                >
                                    {approving ? 'Approving...' : (t.approve || 'Approve Request')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

// --- Helper Components & Functions ---

function getPriorityColor(priority: string) {
    switch (priority?.toLowerCase()) {
        case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
        case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
        default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
}

function getStatusColor(status: string) {
    switch (status?.toLowerCase()) {
        case 'approved': return 'bg-green-100 text-green-800 border-green-200';
        case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
        case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
}

function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function NotificationItem({ notification, onClick }: { notification: MaterialRequestNotification; onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-blue-50/50' : ''}`}
        >
            <div className="flex gap-3">
                <div className={`mt-1 p-1.5 rounded-full shrink-0 ${notification.notification_type === 'material_request'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-green-100 text-green-600'
                    }`}>
                    <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm text-gray-900 truncate pr-2">
                            {notification.requisition_number}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatTimeAgo(notification.created_at)}
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                        Material Request from <span className="font-medium">{notification.department}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-gray-100 text-gray-600 border-gray-200">
                            {notification.items.length} Items
                        </Badge>
                        {notification.status && (
                            <Badge className={`text-[10px] px-1.5 h-5 ${getStatusColor(notification.status)}`}>
                                {notification.status}
                            </Badge>
                        )}
                    </div>
                </div>
                {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                )}
            </div>
        </div>
    );
}
