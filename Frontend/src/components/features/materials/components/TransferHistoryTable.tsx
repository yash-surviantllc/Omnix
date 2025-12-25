import { Badge } from '@/components/ui/badge';

interface TransferRecord {
  id: string;
  material: string;
  quantity: string;
  from: string;
  to: string;
  status: string;
  date: string;
  reason: string;
}

interface TransferHistoryTableProps {
  transfers: TransferRecord[];
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

export function TransferHistoryTable({ transfers, translations: t }: TransferHistoryTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return status;
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
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr key={transfer.id} className="border-b border-zinc-100 hover:bg-zinc-50">
              <td className="p-3 text-sm font-medium">{transfer.id}</td>
              <td className="p-3 text-sm">{transfer.material}</td>
              <td className="p-3 text-sm">{transfer.quantity}</td>
              <td className="p-3 text-sm">{transfer.from}</td>
              <td className="p-3 text-sm">{transfer.to}</td>
              <td className="p-3">
                <Badge className={`text-xs ${getStatusColor(transfer.status)}`}>
                  {getStatusLabel(transfer.status)}
                </Badge>
              </td>
              <td className="p-3 text-sm text-zinc-600">{transfer.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
