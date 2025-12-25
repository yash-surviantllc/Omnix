import { XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SKUs } from '@/lib/apparel-data';

interface NewOrderData {
  product: string;
  quantity: string;
  dueDate: string;
  priority: string;
  customerName: string;
  stage: string;
  assignedTeam: string;
  notes: string;
  shiftNumber: string;
  startTime: string;
  endTime: string;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: NewOrderData;
  onOrderDataChange: (data: NewOrderData) => void;
  onSubmit: () => void;
  translations: {
    createNewOrder: string;
    selectProduct: string;
    chooseProduct: string;
    enterQuantity: string;
    units: string;
    selectDueDate: string;
    orderPriority: string;
    normal: string;
    high: string;
    urgent: string;
    customerName: string;
    enterCustomer: string;
    productionStage: string;
    assignTeam: string;
    selectTeam: string;
    orderNotes: string;
    enterNotes: string;
    requiredFields: string;
    createOrder: string;
    cancel: string;
    shiftNumber: string;
    shift1: string;
    shift2: string;
    shift3: string;
    productionTimeline: string;
    startTime: string;
    endTime: string;
    selectStartTime: string;
    selectEndTime: string;
  };
}

export function NewOrderModal({
  isOpen,
  onClose,
  orderData,
  onOrderDataChange,
  onSubmit,
  translations: t
}: NewOrderModalProps) {
  if (!isOpen) return null;

  const updateField = (field: keyof NewOrderData, value: string) => {
    onOrderDataChange({ ...orderData, [field]: value });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-hidden">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t.createNewOrder}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XCircle className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.selectProduct} <span className="text-red-500">*</span>
              </label>
              <select
                value={orderData.product}
                onChange={(e) => updateField('product', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t.chooseProduct}</option>
                {Object.entries(SKUs).map(([code, name]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.enterQuantity} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={orderData.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                  placeholder="0"
                  className="flex-1"
                />
                <span className="flex items-center px-3 bg-zinc-100 rounded-lg text-sm text-zinc-600">
                  {t.units}
                </span>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.selectDueDate} <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={orderData.dueDate}
                onChange={(e) => updateField('dueDate', e.target.value)}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.orderPriority}
              </label>
              <div className="flex gap-2">
                {['normal', 'high', 'urgent'].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => updateField('priority', priority)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      orderData.priority === priority
                        ? priority === 'urgent' 
                          ? 'bg-red-500 text-white border-red-500'
                          : priority === 'high'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    {t[priority as keyof typeof t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.customerName}
              </label>
              <Input
                value={orderData.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
                placeholder={t.enterCustomer}
              />
            </div>

            {/* Production Stage */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.productionStage}
              </label>
              <select
                value={orderData.stage}
                onChange={(e) => updateField('stage', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Material Planning">Material Planning</option>
                <option value="Cutting">Cutting</option>
                <option value="Sewing">Sewing</option>
                <option value="Quality Check">Quality Check</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>

            {/* Assign Team */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.assignTeam}
              </label>
              <select
                value={orderData.assignedTeam}
                onChange={(e) => updateField('assignedTeam', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t.selectTeam}</option>
                <option value="Team A">Team A - Cutting Department</option>
                <option value="Team B">Team B - Sewing Department</option>
                <option value="Team C">Team C - Quality Control</option>
                <option value="Team D">Team D - Packaging</option>
              </select>
            </div>

            {/* Shift Number */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.shiftNumber}
              </label>
              <select
                value={orderData.shiftNumber}
                onChange={(e) => updateField('shiftNumber', e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Shift 1">{t.shift1}</option>
                <option value="Shift 2">{t.shift2}</option>
                <option value="Shift 3">{t.shift3}</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t.orderNotes}
              </label>
              <textarea
                value={orderData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={t.enterNotes}
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Required Fields Note */}
            <p className="text-xs text-zinc-500">
              <span className="text-red-500">*</span> {t.requiredFields}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t.cancel}
            </Button>
            <Button 
              onClick={onSubmit} 
              className="flex-1"
              disabled={!orderData.product || !orderData.quantity || !orderData.dueDate}
            >
              {t.createOrder}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
