export type View = 
  | 'dashboard' 
  | 'orders' 
  | 'working-order'
  | 'bom' 
  | 'wip' 
  | 'transfer' 
  | 'material-request' 
  | 'qc' 
  | 'inventory' 
  | 'gate-entry' 
  | 'gate-exit'
  | 'settings';

export type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';

export interface NavigationItem {
  id: View;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Local type definitions (mock data removed)
export interface BOMItem {
  material: string;
  qty: number;
  unit: string;
  unitCost?: number;
}

export interface InventoryItem {
  materialCode: string;
  qty: number;
  unit: string;
  location: string;
}

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
