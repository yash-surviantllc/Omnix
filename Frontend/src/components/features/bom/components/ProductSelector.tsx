import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface ProductSelectorProps {
  products: string[];
  productNames: Record<string, string>;
  selectedProduct: string;
  onSelectProduct: (product: string) => void;
  productionQty: number;
  onProductionQtyChange: (qty: number) => void;
  translations: {
    selectProduct: string;
    productionQuantity?: string;
  };
}

export function ProductSelector({
  products,
  productNames,
  selectedProduct,
  onSelectProduct,
  productionQty,
  onProductionQtyChange,
  translations: t
}: ProductSelectorProps) {
  return (
    <Card className="p-6">
      <label className="block mb-2 text-zinc-600">{t.selectProduct}</label>
      <div className="flex flex-col sm:flex-row gap-2">
        {products.map((product) => (
          <Button
            key={product}
            variant={selectedProduct === product ? 'default' : 'outline'}
            onClick={() => onSelectProduct(product)}
            className="justify-start sm:flex-1"
          >
            <div className="flex flex-col items-start">
              <span className="font-semibold">{product}</span>
              <span className="text-xs opacity-80">{productNames[product]}</span>
            </div>
          </Button>
        ))}
      </div>
      
      <div className="mt-4">
        <label className="block mb-2 text-zinc-600">
          {t.productionQuantity || 'Production Quantity'}
        </label>
        <Input
          type="number"
          value={productionQty}
          onChange={(e) => onProductionQtyChange(Number(e.target.value))}
          className="max-w-xs"
        />
      </div>
    </Card>
  );
}
