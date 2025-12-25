// Mock Data for Manufacturing OS

export const SKUs: Record<string, string> = {
  'TS-001': 'Basic Cotton T-Shirt',
  'HD-001': 'Fleece Hoodie',
  'TR-001': 'Polyester Track Pants'
};

export interface BOMItem {
  material: string;
  qty: number;
  unit: string;
  unitCost?: number;
}

export const BOM_DATA: Record<string, BOMItem[]> = {
  'TS-001': [
    { material: 'Cotton Fabric', qty: 1.25, unit: 'm', unitCost: undefined },
    { material: 'Rib Fabric', qty: 0.20, unit: 'm', unitCost: undefined },
    { material: 'Labels', qty: 1, unit: 'pcs', unitCost: undefined },
    { material: 'Sewing Thread', qty: 30, unit: 'm', unitCost: undefined },
    { material: 'Polybag', qty: 1, unit: 'pcs', unitCost: undefined }
  ],
  'HD-001': [
    { material: 'Fleece Fabric', qty: 2.20, unit: 'm', unitCost: undefined },
    { material: 'Rib Fabric', qty: 0.35, unit: 'm', unitCost: undefined },
    { material: 'Zipper', qty: 1, unit: 'pcs', unitCost: undefined },
    { material: 'Drawcord', qty: 1.5, unit: 'm', unitCost: undefined },
    { material: 'Labels', qty: 1, unit: 'pcs', unitCost: undefined },
    { material: 'Thread', qty: 40, unit: 'm', unitCost: undefined },
    { material: 'Packaging Box', qty: 1, unit: 'pcs', unitCost: undefined }
  ],
  'TR-001': [
    { material: 'Polyester Fabric', qty: 1.70, unit: 'm', unitCost: undefined },
    { material: 'Elastic Band', qty: 0.80, unit: 'm', unitCost: undefined },
    { material: 'Zipper Pocket', qty: 2, unit: 'pcs', unitCost: undefined },
    { material: 'Thread', qty: 35, unit: 'm', unitCost: undefined },
    { material: 'Labels', qty: 1, unit: 'pcs', unitCost: undefined },
    { material: 'Polybag', qty: 1, unit: 'pcs', unitCost: undefined }
  ]
};

export interface InventoryItem {
  materialCode: string;
  qty: number;
  unit: string;
  location: string;
}

export const INVENTORY_STOCK: Record<string, InventoryItem> = {
  'Cotton Fabric': { materialCode: 'FAB-COT-001', qty: 800, unit: 'm', location: 'RM Store A' },
  'Fleece Fabric': { materialCode: 'FAB-FLE-002', qty: 1200, unit: 'm', location: 'RM Store A' },
  'Polyester Fabric': { materialCode: 'FAB-POL-003', qty: 950, unit: 'm', location: 'RM Store B' },
  'Rib Fabric': { materialCode: 'FAB-RIB-004', qty: 500, unit: 'm', location: 'RM Store A' },
  'Sewing Thread': { materialCode: 'THR-SEW-100', qty: 10000, unit: 'm', location: 'Store Room' },
  'Thread': { materialCode: 'THR-GEN-101', qty: 10000, unit: 'm', location: 'Store Room' },
  'Zipper': { materialCode: 'ACC-ZIP-200', qty: 650, unit: 'pcs', location: 'Accessories' },
  'Zipper Pocket': { materialCode: 'ACC-ZIP-201', qty: 1200, unit: 'pcs', location: 'Accessories' },
  'Drawcord': { materialCode: 'ACC-DRA-300', qty: 2000, unit: 'm', location: 'Accessories' },
  'Elastic Band': { materialCode: 'ACC-ELA-301', qty: 1700, unit: 'm', location: 'Accessories' },
  'Labels': { materialCode: 'PKG-LAB-400', qty: 5000, unit: 'pcs', location: 'Packaging' },
  'Polybag': { materialCode: 'PKG-PLY-401', qty: 4000, unit: 'pcs', location: 'Packaging' },
  'Packaging Box': { materialCode: 'PKG-BOX-402', qty: 1200, unit: 'pcs', location: 'Packaging' }
};

export interface ProductionOrder {
  id: string;
  sku: string;
  product: string;
  qty: number;
  completed: number;
  dueDate: string;
  status: 'planned' | 'in_progress' | 'completed';
  stage: string;
  progress: number;
}

export const PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: 'PO-1001',
    sku: 'TS-001',
    product: 'Basic Cotton T-Shirt',
    qty: 600,
    completed: 0,
    dueDate: '2025-02-10',
    status: 'planned',
    stage: 'Planning',
    progress: 0
  },
  {
    id: 'PO-1002',
    sku: 'HD-001',
    product: 'Fleece Hoodie',
    qty: 400,
    completed: 0,
    dueDate: '2025-02-15',
    status: 'planned',
    stage: 'Planning',
    progress: 0
  },
  {
    id: 'PO-1003',
    sku: 'TR-001',
    product: 'Polyester Track Pants',
    qty: 750,
    completed: 0,
    dueDate: '2025-02-20',
    status: 'planned',
    stage: 'Planning',
    progress: 0
  }
];

export type StageHealth = 'healthy' | 'warning' | 'delayed';

export interface WIPStage {
  id: number;
  name: string;
  items: number;
  capacity: number;
  health: StageHealth;
  avgTime: number;
  targetAvgTime: number;
  utilization: number;
  orders: number;
  units: number;
  delay: number;
}

export const WIP_STAGES: WIPStage[] = [
  { id: 1, name: 'Cutting', items: 120, capacity: 1000, health: 'healthy', avgTime: 15, targetAvgTime: 12, utilization: 72, orders: 2, units: 120, delay: 0 },
  { id: 2, name: 'Sewing', items: 85, capacity: 800, health: 'warning', avgTime: 45, targetAvgTime: 40, utilization: 85, orders: 2, units: 85, delay: 0 },
  { id: 3, name: 'Finishing', items: 60, capacity: 600, health: 'healthy', avgTime: 20, targetAvgTime: 18, utilization: 68, orders: 1, units: 60, delay: 0 },
  { id: 4, name: 'QC', items: 45, capacity: 500, health: 'delayed', avgTime: 30, targetAvgTime: 25, utilization: 92, orders: 1, units: 45, delay: 2 },
  { id: 5, name: 'Packing', items: 30, capacity: 1000, health: 'healthy', avgTime: 10, targetAvgTime: 8, utilization: 45, orders: 1, units: 30, delay: 0 }
];
