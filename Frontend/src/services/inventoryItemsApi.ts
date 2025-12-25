import axios from 'axios';
import { MaterialData } from '@/types/inventory';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api/v1/inventory-items`;

// Get auth token from Zustand persisted storage
const getAuthToken = () => {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed.state?.accessToken || null;
    }
  } catch (error) {
    console.error('Error reading auth token:', error);
  }
  return null;
};

// Configure axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response types
export interface InventoryItemResponse {
  id: string;
  material_code: string;
  material_name: string;
  category: string | null;
  quantity: number;
  allocated_quantity: number;
  free_quantity: number;
  unit: string;
  location: string | null;
  reorder_level: number;
  status: 'sufficient' | 'low' | 'critical' | 'out_of_stock';
  unit_cost: number;
  total_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemsSummary {
  total_materials: number;
  low_stock_count: number;
  critical_count: number;
  out_of_stock_count: number;
  sufficient_count: number;
  total_value: number;
}

export interface TransactionResponse {
  id: string;
  inventory_item_id: string;
  material_code: string;
  material_name: string;
  transaction_type: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  reason: string | null;
  notes: string | null;
  transaction_date: string;
}

// API Functions
export const inventoryItemsApi = {
  // List all inventory items
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
  }): Promise<InventoryItemResponse[]> {
    const response = await api.get('/', { params });
    return response.data;
  },

  // Get inventory summary
  async getSummary(): Promise<InventoryItemsSummary> {
    const response = await api.get('/summary');
    return response.data;
  },

  // Get single item
  async get(id: string): Promise<InventoryItemResponse> {
    const response = await api.get(`/${id}`);
    return response.data;
  },

  // Create new item
  async create(data: {
    material_code: string;
    material_name: string;
    category?: string;
    quantity: number;
    unit: string;
    location?: string;
    reorder_level: number;
    unit_cost: number;
    description?: string;
  }): Promise<InventoryItemResponse> {
    const response = await api.post('/', data);
    return response.data;
  },

  // Update item
  async update(id: string, data: {
    material_name?: string;
    category?: string;
    quantity?: number;
    unit?: string;
    location?: string;
    reorder_level?: number;
    unit_cost?: number;
    description?: string;
  }): Promise<InventoryItemResponse> {
    const response = await api.put(`/${id}`, data);
    return response.data;
  },

  // Delete item
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/${id}`);
    return response.data;
  },

  // Adjust inventory
  async adjust(data: {
    inventory_item_id: string;
    adjustment_quantity: number;
    reason: string;
    notes?: string;
  }): Promise<InventoryItemResponse> {
    const response = await api.post('/adjust', data);
    return response.data;
  },

  // Get transactions
  async getTransactions(params?: {
    item_id?: string;
    transaction_type?: string;
    limit?: number;
  }): Promise<TransactionResponse[]> {
    const response = await api.get('/transactions/list', { params });
    return response.data;
  },

  // Get item transactions
  async getItemTransactions(itemId: string, limit?: number): Promise<TransactionResponse[]> {
    const response = await api.get(`/${itemId}/transactions`, { params: { limit } });
    return response.data;
  },

  // Get stock alerts
  async getAlerts(): Promise<any[]> {
    const response = await api.get('/alerts/active');
    return response.data;
  },

  // Bulk import
  async bulkImport(items: any[]): Promise<{ success: any[]; failed: any[] }> {
    const response = await api.post('/bulk/import', items);
    return response.data;
  },
};

// Helper function to convert API response to MaterialData format
export const convertToMaterialData = (item: InventoryItemResponse): MaterialData => {
  return {
    id: item.id,
    materialCode: item.material_code,
    materialName: item.material_name,
    available: item.quantity,
    unit: item.unit,
    location: item.location || '',
    reorderLevel: item.reorder_level,
    status: item.status,
    unitCost: item.unit_cost,
  };
};

// Helper function to convert MaterialData to API format
export const convertFromMaterialData = (data: MaterialData) => {
  return {
    material_code: data.materialCode,
    material_name: data.materialName,
    quantity: data.available,
    unit: data.unit,
    location: data.location,
    reorder_level: data.reorderLevel,
    unit_cost: data.unitCost,
  };
};
