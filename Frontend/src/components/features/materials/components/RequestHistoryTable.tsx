import { Badge } from '@/components/ui/badge';
import { Clock, User, Building2, Package } from 'lucide-react';

interface RequisitionRecord {
  id: string;
  requisition_number: string;
  work_order_number?: string;
  department: string;
  requested_by: string;
  status: string;
  created_at: string;
  item_count: number;
  total_quantity?: number;
}

interface RequestHistoryTableProps {
  requests: RequisitionRecord[];
  onViewDetails?: (request: RequisitionRecord) => void;
  translations: {
    requestId: string;
    department: string;
    requestedBy: string;
    items: string;
    status: string;
    date: string;
    viewDetails: string;
    noRequests: string;
    createFirst: string;
  };
}

export function RequestHistoryTable({ requests, onViewDetails, translations: t }: RequestHistoryTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Fulfilled':
      case 'Issued':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Pending':
      case 'Reviewed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Rejected':
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-zinc-200">
        <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6 text-zinc-400" />
        </div>
        <p className="text-zinc-500">{t.noRequests}</p>
        <p className="text-sm text-zinc-400 mt-1">{t.createFirst}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-zinc-200">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="text-left p-4 text-sm font-semibold text-zinc-600">{t.requestId}</th>
            <th className="text-left p-4 text-sm font-semibold text-zinc-600">{t.department}</th>
            <th className="text-left p-4 text-sm font-semibold text-zinc-600">{t.requestedBy}</th>
            <th className="text-left p-4 text-sm font-semibold text-zinc-600">{t.items}</th>
            <th className="text-left p-4 text-sm font-semibold text-zinc-600">{t.status}</th>
            <th className="text-left p-4 text-sm font-semibold text-zinc-600">{t.date}</th>
            <th className="text-left p-4 text-sm font-semibold text-zinc-600"></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors last:border-0 font-sans">
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-zinc-900">{request.requisition_number}</span>
                  {request.work_order_number && (
                    <span className="text-[10px] text-zinc-500 uppercase tracking-tight">WO: {request.work_order_number}</span>
                  )}
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700 font-medium">{request.department}</span>
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700">{request.requested_by}</span>
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700 font-medium">{request.item_count} Items</span>
                </div>
              </td>
              <td className="p-4">
                <Badge className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 ${getStatusColor(request.status)}`}>
                  {request.status}
                </Badge>
              </td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-600">{new Date(request.created_at).toLocaleDateString()}</span>
                  <span className="text-[10px] text-zinc-400">{new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </td>
              <td className="p-4 text-right">
                {onViewDetails && (
                  <button
                    onClick={() => onViewDetails(request)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors"
                  >
                    {t.viewDetails}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
