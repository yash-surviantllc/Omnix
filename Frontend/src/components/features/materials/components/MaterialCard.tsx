import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MaterialCardProps {
  name: string;
  code: string;
  stock: number;
  location: string;
  uom: string;
  onSelect: () => void;
}

export function MaterialCard({ name, code, stock, location, uom, onSelect }: MaterialCardProps) {
  return (
    <button
      onClick={onSelect}
      className="p-4 border-2 border-zinc-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
    >
      <div className="flex items-start justify-between mb-3">
        <Package className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600" />
        <Badge className="bg-zinc-100 text-zinc-700 border-zinc-300 text-xs">
          {code}
        </Badge>
      </div>
      
      <div className="mb-2">
        <div className="text-zinc-900 mb-1">{name}</div>
        <div className="flex items-center gap-1 text-xs text-zinc-600">
          <span>{location}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
        <span className="text-sm text-zinc-600">Stock</span>
        <span className="text-sm font-medium text-zinc-900">
          {stock.toLocaleString()} {uom}
        </span>
      </div>
    </button>
  );
}
