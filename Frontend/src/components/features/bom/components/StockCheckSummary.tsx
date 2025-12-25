import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MaterialItem {
  id: number;
  material: string;
  qtyPerUnit: number;
  unit: string;
  status: string;
}

interface StockCheckSummaryProps {
  materials: MaterialItem[];
  translations: {
    stockCheck: string;
    for: string;
    units: string;
    required?: string;
    orderNeeded?: string;
    allSufficient?: string;
  };
  language: string;
}

export function StockCheckSummary({ materials, translations: t, language }: StockCheckSummaryProps) {
  const shortages = materials.filter((item) => item.status === 'shortage');

  return (
    <Card className="p-6 bg-blue-50 border-blue-200">
      <h3 className="text-blue-900 mb-3">{t.stockCheck}</h3>
      <div className="space-y-2">
        {shortages.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
            <div>
              <div>{item.material}</div>
              <div className="text-sm text-zinc-600">
                {t.required || (language === 'en' ? 'Required' : 'आवश्यक')}: {item.qtyPerUnit * 100} {item.unit} {t.for} 100 {t.units}
              </div>
            </div>
            <Badge className="bg-red-500">
              {t.orderNeeded || (language === 'en' ? 'Order needed' : 'ऑर्डर चाहिए')}
            </Badge>
          </div>
        ))}
        {shortages.length === 0 && (
          <div className="text-center py-4 text-emerald-700">
            {t.allSufficient || (language === 'en' ? 'All materials are sufficient!' : 'सभी सामग्री पर्याप्त हैं!')}
          </div>
        )}
      </div>
    </Card>
  );
}
