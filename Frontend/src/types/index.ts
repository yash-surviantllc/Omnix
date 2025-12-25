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

// Re-export data types
export type {
  BOMItem,
  InventoryItem,
  ProductionOrder,
  WIPStage,
  StageHealth,
} from '@/data';
