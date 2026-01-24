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
export type StageHealth = 'healthy' | 'warning' | 'delayed';
