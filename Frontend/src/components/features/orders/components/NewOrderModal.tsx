import { XCircle, Clock, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { productsApi, bomApi } from '@/lib/api/bom';
import { Plus, ArrowRight } from 'lucide-react';

interface OrderItem {
  id: string; // Internal ID for keys
  product: string;
  quantity: string;
}

interface NewOrderData {
  items: OrderItem[];
  dueDate: string;
  priority: string;
  notes: string;
  startDate?: string;
  endDate?: string;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: NewOrderData;
  onOrderDataChange: (data: NewOrderData) => void;
  onSubmit: () => void;
  products?: Record<string, { name: string; code: string; unit?: string }>; // Products from backend API
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
  products = {},
  translations: t,
  onProductCreated
}: NewOrderModalProps & { onProductCreated?: () => void }) {
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickProduct, setQuickProduct] = useState({ code: '', name: '', unit: 'pcs' });
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const handleQuickCreate = async () => {
    if (!quickProduct.code || !quickProduct.name) return;
    try {
      setIsCreatingProduct(true);
      // 1. Create Product
      const product = await productsApi.createProduct({
        ...quickProduct,
        category: 'Finished Goods', // Default for POs
        description: 'Created via Quick Add in PO'
      });

      // 2. Create Default Empty BOM (Required for PO Creation)
      await bomApi.createBOM({
        product_id: product.id,
        materials: [] // Empty BOM initially
      });

      setShowQuickCreate(false);
      setQuickProduct({ code: '', name: '', unit: 'pcs' });
      if (onProductCreated) onProductCreated();
    } catch (err) {
      console.error('Failed to create product/BOM:', err);
      // Ideally show toast error here
      alert('Failed to create product or BOM. Please try again.');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  if (!isOpen) return null;

  const updateField = (field: keyof NewOrderData, value: any) => {
    onOrderDataChange({ ...orderData, [field]: value });
  };

  const addItem = () => {
    const newItems = [...orderData.items, { id: Math.random().toString(36).substr(2, 9), product: '', quantity: '' }];
    updateField('items', newItems);
  };

  const removeItem = (id: string) => {
    const newItems = orderData.items.filter(item => item.id !== id);
    updateField('items', newItems);
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    const newItems = orderData.items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    updateField('items', newItems);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-none">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white rounded-t-lg">
              <h2 className="text-xl font-semibold text-zinc-900">{t.createNewOrder}</h2>
              <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full hover:bg-zinc-100">
                <XCircle className="h-5 w-5 text-zinc-500" />
              </Button>
            </div>

            <div className="p-6 pt-2 overflow-y-auto flex-1 space-y-6">
              {/* Multi-SKU Items */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-700">
                  {t.selectProduct} & {t.enterQuantity} <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {orderData.items.map((item) => (
                    <div key={item.id} className="flex gap-3 items-start bg-zinc-50 p-4 rounded-xl border border-zinc-200 transition-all hover:bg-zinc-100/50">
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <select
                            value={item.product}
                            onChange={(e) => updateItem(item.id, 'product', e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
                          >
                            <option value="">{t.chooseProduct}</option>
                            {Object.entries(products).map(([id, product]) => (
                              <option key={id} value={id}>
                                {product.code.padEnd(15, '\u00A0')} | {product.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowQuickCreate(true)}
                            className="shrink-0 border-zinc-300 text-zinc-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50"
                            title="Quick Create Product"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <p className="text-[10px] text-zinc-400 italic">
                            Unit: {products[item.product]?.unit || 'pcs'}
                          </p>
                          <a
                            href="/bom"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                          >
                            Product not listed? Create New <ArrowRight className="h-2.5 w-2.5" />
                          </a>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            placeholder={t.enterQuantity}
                            className="flex-1 h-10 rounded-lg bg-white"
                          />
                          <span className="flex items-center px-4 bg-zinc-200/50 rounded-lg text-xs font-medium text-zinc-600">
                            {t.units}
                          </span>
                        </div>
                      </div>
                      {orderData.items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg mt-1"
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="w-full border-dashed border-zinc-300 hover:border-emerald-500 hover:text-emerald-600 py-6 text-sm font-medium bg-zinc-50/50"
                >
                  + Add Another Product
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">
                    {t.selectDueDate} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={orderData.dueDate}
                    onChange={(e) => updateField('dueDate', e.target.value)}
                    className="w-full h-10 rounded-lg bg-white"
                  />
                </div>
                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">
                    {t.orderPriority}
                  </label>
                  <select
                    value={orderData.priority}
                    onChange={(e) => updateField('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm h-10 bg-white"
                  >
                    <option value="Normal">{t.normal}</option>
                    <option value="High">{t.high}</option>
                    <option value="Urgent">{t.urgent}</option>
                  </select>
                </div>
              </div>

              {/* Production Timeline Section */}
              <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4">
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  {t.productionTimeline || 'Production Timeline'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-blue-700">
                      {t.startTime || 'Start Time'}
                    </label>
                    <Input
                      type="datetime-local"
                      value={orderData.startDate || ''}
                      onChange={(e) => updateField('startDate', e.target.value)}
                      className="w-full h-10 rounded-lg bg-white border-blue-200 focus:ring-blue-500/20 shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-blue-700">
                      {t.endTime || 'End Time'}
                    </label>
                    <Input
                      type="datetime-local"
                      value={orderData.endDate || ''}
                      onChange={(e) => updateField('endDate', e.target.value)}
                      className="w-full h-10 rounded-lg bg-white border-blue-200 focus:ring-blue-500/20 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700">
                  {t.orderNotes}
                </label>
                <textarea
                  value={orderData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder={t.enterNotes}
                  rows={3}
                  className="w-full px-4 py-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm bg-white"
                />
              </div>

              {/* Order Summary Section */}
              {orderData.items.some(item => item.product && item.quantity) && (
                <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 space-y-3">
                  <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    Order Summary
                  </h3>
                  <div className="space-y-2">
                    {orderData.items.map((item, idx) => {
                      const product = products[item.product];
                      if (!product || !item.quantity) return null;
                      return (
                        <div key={item.id} className="flex justify-between items-center text-sm bg-white/50 p-2 rounded-lg border border-emerald-50">
                          <span className="text-zinc-600 font-medium">
                            {idx + 1}. {product.code} - {product.name}
                          </span>
                          <span className="text-emerald-700 font-bold px-2 py-0.5 bg-emerald-100 rounded-md">
                            {item.quantity} {t.units}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Required Fields Note */}
              <p className="text-xs text-zinc-400 italic">
                <span className="text-red-500">*</span> {t.requiredFields}
              </p>
            </div>

            <div className="flex gap-3 p-6 pt-4 border-t bg-zinc-50/50 rounded-b-lg">
              <Button variant="outline" onClick={onClose} className="flex-1 h-11 font-medium rounded-lg border-zinc-300 hover:bg-white transition-colors">
                {t.cancel}
              </Button>
              <Button
                onClick={onSubmit}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={orderData.items.some(item => !item.product || !item.quantity) || !orderData.dueDate}
              >
                {t.createOrder}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Create Product Modal Overlay */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20">
          <Card className="w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 border-emerald-100 ring-4 ring-black/5">
            <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              New Product (Quick)
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Product Code</label>
                <Input
                  value={quickProduct.code}
                  onChange={e => setQuickProduct(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. PRD-001"
                  className="h-9 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Product Name</label>
                <Input
                  value={quickProduct.name}
                  onChange={e => setQuickProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Cotton Shirt"
                  className="h-9 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Unit</label>
                <select
                  value={quickProduct.unit}
                  onChange={e => setQuickProduct(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="mtr">Meters (mtr)</option>
                  <option value="box">Box</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowQuickCreate(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickCreate}
                  disabled={!quickProduct.code || !quickProduct.name || isCreatingProduct}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isCreatingProduct ? 'Creating...' : 'Create Product'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </>
  );
}
