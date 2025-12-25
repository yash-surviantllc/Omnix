import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TransferData {
  material: string;
  materialCode: string;
  availableStock: number;
  currentLocation: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  transferReason: string;
  uom: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferData: Partial<TransferData>;
  onTransferDataChange: (data: Partial<TransferData>) => void;
  onConfirm: () => void;
  errors: Record<string, string>;
  translations: {
    transferMaterial: string;
    availableStock: string;
    currentLocation: string;
    transferQuantity: string;
    enterQuantity: string;
    fromLocation: string;
    toLocation: string;
    selectDestination: string;
    transferReason: string;
    selectReason: string;
    cancel: string;
    confirmTransfer: string;
    reasons: Record<string, string>;
    locations: Record<string, string>;
  };
}

export function TransferModal({
  isOpen,
  onClose,
  transferData,
  onTransferDataChange,
  onConfirm,
  errors,
  translations: t
}: TransferModalProps) {
  if (!isOpen) return null;

  const updateField = (field: keyof TransferData, value: string | number) => {
    onTransferDataChange({ ...transferData, [field]: value });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl">{t.transferMaterial}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Material Info */}
            <div className="p-3 bg-zinc-50 rounded-lg">
              <div className="text-lg font-medium">{transferData.material}</div>
              <div className="text-sm text-zinc-600">{transferData.materialCode}</div>
            </div>

            {/* Available Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-600">{t.availableStock}</label>
                <div className="font-medium">
                  {transferData.availableStock?.toLocaleString()} {transferData.uom}
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-600">{t.currentLocation}</label>
                <div className="font-medium">{transferData.currentLocation}</div>
              </div>
            </div>

            {/* Transfer Quantity */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t.transferQuantity}</label>
              <Input
                type="number"
                min="1"
                max={transferData.availableStock}
                value={transferData.quantity || ''}
                onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)}
                placeholder={t.enterQuantity}
                className={errors.quantity ? 'border-red-500' : ''}
              />
              {errors.quantity && (
                <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>
              )}
            </div>

            {/* From Location (readonly) */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t.fromLocation}</label>
              <Input value={transferData.fromLocation || ''} disabled />
            </div>

            {/* To Location */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t.toLocation}</label>
              <select
                value={transferData.toLocation || ''}
                onChange={(e) => updateField('toLocation', e.target.value)}
                className={`w-full p-2 border rounded-md ${errors.toLocation ? 'border-red-500' : 'border-zinc-300'}`}
              >
                <option value="">{t.selectDestination}</option>
                {Object.entries(t.locations).map(([key, label]) => (
                  <option key={key} value={label} disabled={label === transferData.fromLocation}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.toLocation && (
                <p className="text-xs text-red-500 mt-1">{errors.toLocation}</p>
              )}
            </div>

            {/* Transfer Reason */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t.transferReason}</label>
              <select
                value={transferData.transferReason || ''}
                onChange={(e) => updateField('transferReason', e.target.value)}
                className={`w-full p-2 border rounded-md ${errors.transferReason ? 'border-red-500' : 'border-zinc-300'}`}
              >
                <option value="">{t.selectReason}</option>
                {Object.entries(t.reasons).map(([key, label]) => (
                  <option key={key} value={label}>{label}</option>
                ))}
              </select>
              {errors.transferReason && (
                <p className="text-xs text-red-500 mt-1">{errors.transferReason}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                {t.cancel}
              </Button>
              <Button onClick={onConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {t.confirmTransfer}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
