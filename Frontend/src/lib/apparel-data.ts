// Re-export data from centralized location
export {
  SKUs,
  BOM_DATA,
  INVENTORY_STOCK,
  PRODUCTION_ORDERS,
  WIP_STAGES,
  type BOMItem,
  type InventoryItem,
  type ProductionOrder,
  type WIPStage,
  type StageHealth,
} from '@/data';

import { BOM_DATA, INVENTORY_STOCK } from '@/data';

export function calculateMaterialRequirements(sku: string, qty: number) {
  const bom = BOM_DATA[sku];
  if (!bom) return [];

  return bom.map(item => {
    const requiredQty = item.qty * qty;
    const available = INVENTORY_STOCK[item.material]?.qty || 0;
    const shortage = Math.max(0, requiredQty - available);

    return {
      material: item.material,
      required: Math.ceil(requiredQty * 10) / 10,
      available,
      shortage: Math.ceil(shortage * 10) / 10,
      unit: item.unit,
      unitCost: item.unitCost
    };
  });
}