import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { Product } from '@/lib/api/bom';

type AddMaterialModalProps = {
  show: boolean;
  onClose: () => void;
  onAdd: () => void;
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

export function AddMaterialModal({
  show,
  onClose,
  onAdd,
  rawMaterials,
  material,
  setMaterial,
  language
}: AddMaterialModalProps) {
  if (!show) return null;

  const translations = {
    en: {
      addMaterial: 'Add Material',
      selectMaterial: 'Select Material',
      quantity: 'Quantity',
      unit: 'Unit',
      unitCost: 'Unit Cost',
      scrapPercentage: 'Scrap %',
      cancel: 'Cancel',
      add: 'Add'
    },
    hi: {
      addMaterial: 'सामग्री जोड़ें',
      selectMaterial: 'सामग्री चुनें',
      quantity: 'मात्रा',
      unit: 'यूनिट',
      unitCost: 'यूनिट कीमत',
      scrapPercentage: 'स्क्रैप %',
      cancel: 'रद्द करें',
      add: 'जोड़ें'
    },
    kn: {
      addMaterial: 'ಸಾಮಗ್ರಿ ಸೇರಿಸಿ',
      selectMaterial: 'ಸಾಮಗ್ರಿ ಆಯ್ಕೆಮಾಡಿ',
      quantity: 'ಪ್ರಮಾಣ',
      unit: 'ಯೂನಿಟ್',
      unitCost: 'ಯೂನಿಟ್ ವೆಚ್ಚ',
      scrapPercentage: 'ಸ್ಕ್ರ್ಯಾಪ್ %',
      cancel: 'ರದ್ದುಮಾಡಿ',
      add: 'ಸೇರಿಸಿ'
    },
    ta: {
      addMaterial: 'பொருள் சேர்க்கவும்',
      selectMaterial: 'பொருள் தேர்ந்தெடுக்கவும்',
      quantity: 'அளவு',
      unit: 'அலகு',
      unitCost: 'அலகு செலவு',
      scrapPercentage: 'ஸ்கிராப் %',
      cancel: 'ரத்துசெய்',
      add: 'சேர்'
    },
    te: {
      addMaterial: 'మెటీరియల్ జోడించండి',
      selectMaterial: 'మెటీరియల్ ఎంచుకోండి',
      quantity: 'పరిమాణం',
      unit: 'యూనిట్',
      unitCost: 'యూనిట్ ఖర్చు',
      scrapPercentage: 'స్క్రాప్ %',
      cancel: 'రద్దుచేయి',
      add: 'జోడించు'
    },
    mr: {
      addMaterial: 'सामग्री जोडा',
      selectMaterial: 'सामग्री निवडा',
      quantity: 'प्रमाण',
      unit: 'यूनिट',
      unitCost: 'यूनिट किंमत',
      scrapPercentage: 'स्क्रैप %',
      cancel: 'रद्द करा',
      add: 'जोडा'
    },
    gu: {
      addMaterial: 'સામગ્રી ઉમેરો',
      selectMaterial: 'સામગ્રી પસંદ કરો',
      quantity: 'જથ્થો',
      unit: 'યૂનિટ',
      unitCost: 'યૂનિટ કિંમત',
      scrapPercentage: 'સ્ક્રેપ %',
      cancel: 'રદ કરો',
      add: 'ઉમેરો'
    },
    pa: {
      addMaterial: 'ਸਮੱਗਰੀ ਜੋੜੋ',
      selectMaterial: 'ਸਮੱਗਰੀ ਚੁਣੋ',
      quantity: 'ਮਾਤਰਾ',
      unit: 'ਯੂਨਿਟ',
      unitCost: 'ਯੂਨਿਟ ਕੀਮਤ',
      scrapPercentage: 'ਸਕ੍ਰੈਪ %',
      cancel: 'ਰੱਦ ਕਰੋ',
      add: 'ਜੋੜੋ'
    }
  };
  const t = translations[language];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold">{t.addMaterial}</h2>
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
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
        <div className="p-4 border-t flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={onAdd}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!material.materialId || !material.quantity}
          >
            {t.add}
          </Button>
        </div>
      </Card>
    </div>
  );
}
