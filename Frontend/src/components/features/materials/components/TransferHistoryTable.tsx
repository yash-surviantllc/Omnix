import { Badge } from '@/components/ui/badge';

interface TransferRecord {
  id: string;
  transfer_number: string;
  material: string;
  quantity: string | number;
  unit: string;
  from_location: string;
  to_location: string;
  status: string;
  date: string;
}

interface TransferHistoryTableProps {
  transfers: TransferRecord[];
  onViewDetails?: (transfer: TransferRecord) => void;
  translations: {
    transferId: string;
    material: string;
    quantity: string;
    from: string;
    to: string;
    status: string;
    date: string;
    viewDetails: string;
    noTransfers: string;
    createFirst: string;
  };
}

export function TransferHistoryTable({ transfers, onViewDetails, translations: t }: TransferHistoryTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Rejected':
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">{t.noTransfers}</p>
        <p className="text-sm text-zinc-400 mt-1">{t.createFirst}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.transferId}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.material}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.quantity}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.from}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.to}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.status}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600">{t.date}</th>
            <th className="text-left p-3 text-sm font-medium text-zinc-600"></th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr key={transfer.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
              <td className="p-3 text-sm font-medium text-zinc-900">{transfer.transfer_number}</td>
              <td className="p-3 text-sm text-zinc-700">{transfer.material}</td>
              <td className="p-3 text-sm text-zinc-700">{transfer.quantity} {transfer.unit}</td>
              <td className="p-3 text-sm text-zinc-700">{transfer.from_location}</td>
              <td className="p-3 text-sm text-zinc-700">{transfer.to_location}</td>
              <td className="p-3">
                <Badge className={`text-xs font-medium ${getStatusColor(transfer.status)}`}>
                  {transfer.status}
                </Badge>
              </td>
              <td className="p-3 text-sm text-zinc-500">{new Date(transfer.date).toLocaleDateString()}</td>
              <td className="p-3 text-right">
                {onViewDetails && (
                  <button
                    onClick={() => onViewDetails(transfer)}
                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
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
