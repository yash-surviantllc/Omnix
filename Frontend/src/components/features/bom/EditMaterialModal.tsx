import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { Product } from '@/lib/api/bom';

type EditMaterialModalProps = {
  show: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  rawMaterials: Product[];
  material: {
    materialId: string;
    quantity: string;
    unit: string;
    unitCost: string;
    scrapPercentage: string;
  };
  setMaterial: (material: any) => void;
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function EditMaterialModal({
  show,
  onClose,
  onUpdate,
  onDelete,
  rawMaterials,
  material,
  setMaterial,
  language
}: EditMaterialModalProps) {
  if (!show) return null;

  const t = {
    en: {
      editMaterial: 'Edit Material',
      selectMaterial: 'Select Material',
      quantity: 'Quantity',
      unit: 'Unit',
      unitCost: 'Unit Cost',
      scrapPercentage: 'Scrap %',
      cancel: 'Cancel',
      update: 'Update',
      delete: 'Delete Material'
    },
    hi: {
      editMaterial: 'सामग्री संपादित करें',
      selectMaterial: 'सामग्री चुनें',
      quantity: 'मात्रा',
      unit: 'यूनिट',
      unitCost: 'यूनिट कीमत',
      scrapPercentage: 'स्क्रैप %',
      cancel: 'रद्द करें',
      update: 'अपडेट करें',
      delete: 'सामग्री हटाएं'
    }
  }[language] || {
    editMaterial: 'Edit Material',
    selectMaterial: 'Select Material',
    quantity: 'Quantity',
    unit: 'Unit',
    unitCost: 'Unit Cost',
    scrapPercentage: 'Scrap %',
    cancel: 'Cancel',
    update: 'Update',
    delete: 'Delete Material'
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold">{t.editMaterial}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Material Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.selectMaterial}
            </label>
            <select
              value={material.materialId}
              onChange={(e) => setMaterial({ ...material, materialId: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t.selectMaterial}</option>
              {rawMaterials.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.code} - {mat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.quantity}
            </label>
            <Input
              type="number"
              step="0.01"
              value={material.quantity}
              onChange={(e) => setMaterial({ ...material, quantity: e.target.value })}
              placeholder="0.00"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.unit}
            </label>
            <select
              value={material.unit}
              onChange={(e) => setMaterial({ ...material, unit: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="kg">kg</option>
              <option value="m">m</option>
              <option value="pcs">pcs</option>
              <option value="liter">liter</option>
            </select>
          </div>

          {/* Unit Cost */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.unitCost}
            </label>
            <Input
              type="number"
              step="0.01"
              value={material.unitCost}
              onChange={(e) => setMaterial({ ...material, unitCost: e.target.value })}
              placeholder="0.00"
            />
          </div>

          {/* Scrap Percentage */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.scrapPercentage}
            </label>
            <Input
              type="number"
              step="0.1"
              value={material.scrapPercentage}
              onChange={(e) => setMaterial({ ...material, scrapPercentage: e.target.value })}
              placeholder="0.0"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3 justify-between">
          <Button
            variant="outline"
            onClick={onDelete}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            {t.delete}
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={onUpdate}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!material.materialId || !material.quantity}
            >
              {t.update}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
