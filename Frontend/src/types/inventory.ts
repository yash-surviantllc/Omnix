/**
 * TypeScript interfaces for Inventory Management
 */

export interface InventoryItem {
  id: string;
  materialName: string;
  materialCode: string;
  qty: number;
  unit: string;
  location: string;
  reorderLevel: number;
  status: 'sufficient' | 'low' | 'critical';
  unitCost: number;
}

export interface InventoryFormData {
  materialCode: string;
  materialName: string;
  available: string;
  unit: string;
  location: string;
  reorderLevel: string;
  status: string;
  unitCost: string;
}

export interface MaterialData {
  id?: string;
  materialCode: string;
  materialName: string;
  available: number;
  unit: string;
  location: string;
  reorderLevel: number;
  status: string;
  unitCost: number;
}

export interface InventoryDisplayItem {
  id: string;
  material: string;
  materialCode: string;
  available: string;
  allocated: string;
  free: string;
  location: string;
  reorderLevel: string;
  status: 'sufficient' | 'low' | 'critical';
  unit: string;
  availableNum: number;
  freeNum: number;
}

export type InventoryData = Record<string, InventoryItem>;

export type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
