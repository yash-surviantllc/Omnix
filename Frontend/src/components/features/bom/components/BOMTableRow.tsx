import { Edit, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface BOMTableRowProps {
  id: number;
  material: string;
  qtyPerUnit: number;
  unit: string;
  unitCost?: number;
  stockAvailable: number;
  status: string;
  editableUnitCost?: number;
  onUnitCostChange: (id: number, value: number) => void;
  translations: {
    sufficient: string;
    shortage: string;
  };
}

export function BOMTableRow({
  id,
  material,
  qtyPerUnit,
  unit,
  unitCost,
  stockAvailable,
  status,
  editableUnitCost,
  onUnitCostChange,
  translations: t
}: BOMTableRowProps) {
  const getStatusBadge = () => {
    if (status === 'sufficient') {
      return (
        <Badge className="bg-emerald-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {t.sufficient}
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {t.shortage}
      </Badge>
    );
  };

  return (
    <tr className="border-b hover:bg-zinc-50">
      <td className="p-4">{material}</td>
      <td className="p-4">{qtyPerUnit}</td>
      <td className="p-4">{unit}</td>
      <td className="p-4">{stockAvailable} {unit}</td>
      <td className="p-4">{getStatusBadge()}</td>
      <td className="p-4">
        <Input
          type="number"
          value={editableUnitCost ?? unitCost ?? ''}
          onChange={(e) => onUnitCostChange(id, Number(e.target.value))}
          className="w-28 h-9 text-right"
          placeholder="0"
        />
      </td>
      <td className="p-4">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
