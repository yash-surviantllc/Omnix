// Mock Data for Manufacturing OS
// NOTE: Mock data cleared for production - data now comes from backend API

export const SKUs: Record<string, string> = {};

export interface BOMItem {
  material: string;
  qty: number;
  unit: string;
  unitCost?: number;
}

export const BOM_DATA: Record<string, BOMItem[]> = {};

export interface InventoryItem {
  materialCode: string;
  qty: number;
  unit: string;
  location: string;
}

export const INVENTORY_STOCK: Record<string, InventoryItem> = {};

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

export const PRODUCTION_ORDERS: ProductionOrder[] = [];

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

export const WIP_STAGES: WIPStage[] = [];
