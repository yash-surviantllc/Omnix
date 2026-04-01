import { Badge } from '@/components/ui/badge';
import { 
  X, MapPin, Calendar, User, 
  ArrowRightLeft, FileText, Clock, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
  type: 'transfer' | 'request';
  translations?: any;
}

export function MaterialDetailModal({ isOpen, onClose, title, data, type }: DetailModalProps) {
  if (!isOpen || !data) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Approved':
      case 'Fulfilled':
      case 'Issued':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending':
      case 'In Progress':
      case 'Reviewed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Rejected':
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatNumber = (num: any) => {
    const val = parseFloat(num);
    if (isNaN(val)) return '0';
    return val > 1000 ? val.toLocaleString() : val.toString();
  };

  const qty = type === 'transfer' ? data.quantity : (data.total_quantity || data.item_count || data.items?.length || 0);
  const unit = type === 'transfer' ? (data.unit || 'Units') : (data.total_quantity ? 'Units' : 'Items');

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${type === 'transfer' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {type === 'transfer' ? <ArrowRightLeft className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
              <p className="text-xs text-zinc-500 font-mono">#{data.transfer_number || data.requisition_number || data.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-50">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Calendar className="w-4 h-4" />
              {new Date(data.created_at || data.date).toLocaleDateString()}
            </div>
            <Badge className={`px-3 py-1 rounded-full border ${getStatusColor(data.status)}`}>
              {data.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  {type === 'transfer' ? 'Material' : 'Department'}
                </label>
                <div className="text-lg font-bold text-zinc-900">
                  {type === 'transfer' ? data.material : data.department}
                </div>
                {type === 'transfer' && data.product_code && (
                  <div className="text-xs text-zinc-500 mt-1 font-mono bg-zinc-50 px-2 py-0.5 rounded inline-block">
                    {data.product_code}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Quantity</label>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-zinc-900">{formatNumber(qty)}</span>
                  <span className="text-sm font-medium text-zinc-500 uppercase">{unit}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {type === 'transfer' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Source</label>
                    <div className="flex items-center gap-2 text-zinc-700">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-semibold">{data.from_location}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Destination</label>
                    <div className="flex items-center gap-2 text-zinc-900">
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-semibold">{data.to_location}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-zinc-400" />
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block">Requested By</label>
                      <div className="text-sm font-semibold text-zinc-900">{data.requested_by}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block">Timestamp</label>
                      <div className="text-sm font-semibold text-zinc-900">
                        {new Date(data.updated_at || data.created_at || data.date).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items Section for Requests */}
          {type === 'request' && data.items && data.items.length > 0 && (
            <div className="pt-4 mt-4 border-t border-zinc-100">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-3">Itemized List ({data.items.length})</label>
              <div className="bg-white border border-zinc-100 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold border-b border-zinc-100">
                    <tr>
                      <th className="px-4 py-2">Material</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {data.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">{item.material_description || item.rm_code}</div>
                          <div className="text-[10px] text-zinc-400 font-mono uppercase">{item.rm_code}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-zinc-900">{formatNumber(item.quantity_requested)}</div>
                          <div className="text-[10px] text-zinc-400 uppercase">{item.unit_of_measure}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {(data.notes || data.reason) && (
            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2 mb-1 text-amber-700">
                <FileText className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Comments</span>
              </div>
              <p className="text-sm text-amber-900 italic">"{data.notes || data.reason}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 flex items-center justify-end bg-zinc-50/10">
          <Button 
            onClick={onClose} 
            className={`h-10 px-8 rounded-lg font-semibold transition-all active:scale-95 flex items-center gap-2 ${
              type === 'transfer' 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
