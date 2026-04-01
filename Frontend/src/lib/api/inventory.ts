import { apiClient } from './client';
import { MaterialData } from '@/types/inventory';

export interface InventoryItemResponse {
    id: string;
    product_id?: string | null;
    material_code: string;
    material_name: string;
    category: string | null;
    quantity: number;
    allocated_quantity: number;
    free_quantity: number;
    unit: string;
    location: string | null;
    reorder_level: number;
    status: 'Sufficient' | 'Low Stock' | 'Critical' | 'Out of Stock';
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

export const inventoryItemsApi = {
    // List all inventory items
    list: async (params?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        category?: string;
    }): Promise<InventoryItemResponse[]> => {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) queryParams.append(key, value.toString());
            });
        }
        return apiClient.get<InventoryItemResponse[]>(`/inventory-items/?${queryParams.toString()}`, {
            useCache: true,
            ttl: 300 // 5 minutes
        });
    },

    // Get inventory summary
    getSummary: async (): Promise<InventoryItemsSummary> => {
        return apiClient.get<InventoryItemsSummary>('/inventory-items/summary');
    },

    // Get single item
    get: async (id: string): Promise<InventoryItemResponse> => {
        return apiClient.get<InventoryItemResponse>(`/inventory-items/${id}`);
    },

    // Create new item
    create: async (data: {
        material_code: string;
        material_name: string;
        category?: string;
        quantity: number;
        unit: string;
        location?: string;
        reorder_level: number;
        unit_cost: number;
        description?: string;
    }): Promise<InventoryItemResponse> => {
        const response = await apiClient.post<InventoryItemResponse>('/inventory-items/', data);
        apiClient.invalidateCache('/inventory-items/');
        return response;
    },

    // Update item
    update: async (id: string, data: {
        material_name?: string;
        category?: string;
        quantity?: number;
        unit?: string;
        location?: string;
        reorder_level?: number;
        unit_cost?: number;
        description?: string;
    }): Promise<InventoryItemResponse> => {
        const response = await apiClient.put<InventoryItemResponse>(`/inventory-items/${id}`, data);
        apiClient.invalidateCache('/inventory-items/');
        return response;
    },

    // Delete item
    delete: async (id: string): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>(`/inventory-items/${id}`);
        apiClient.invalidateCache('/inventory-items/');
        return response;
    },

    // Adjust inventory
    adjust: async (data: {
        inventory_item_id: string;
        adjustment_quantity: number;
        reason: string;
        notes?: string;
    }): Promise<InventoryItemResponse> => {
        const response = await apiClient.post<InventoryItemResponse>('/inventory-items/adjust', data);
        apiClient.invalidateCache('/inventory-items/');
        return response;
    },

    // Get transactions
    getTransactions: async (params?: {
        item_id?: string;
        transaction_type?: string;
        limit?: number;
    }): Promise<TransactionResponse[]> => {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) queryParams.append(key, value.toString());
            });
        }
        return apiClient.get<TransactionResponse[]>(`/inventory-items/transactions/list?${queryParams.toString()}`);
    },

    // Get item transactions
    getItemTransactions: async (itemId: string, limit?: number): Promise<TransactionResponse[]> => {
        const queryParams = new URLSearchParams();
        if (limit) queryParams.append('limit', limit.toString());
        return apiClient.get<TransactionResponse[]>(`/inventory-items/${itemId}/transactions?${queryParams.toString()}`);
    },

    // Get stock alerts
    getAlerts: async (): Promise<any[]> => {
        return apiClient.get<any[]>('/inventory-items/alerts/active');
    },

    // Bulk import
    bulkImport: async (items: any[]): Promise<{ success: any[]; failed: any[] }> => {
        const response = await apiClient.post<{ success: any[]; failed: any[] }>('/inventory-items/bulk/import', items);
        apiClient.invalidateCache('/inventory-items/');
        return response;
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
