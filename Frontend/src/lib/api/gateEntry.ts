import { apiClient } from './client';

export interface GateEntryMaterial {
    id?: string;
    gate_entry_id?: string;
    material_code?: string;
    material_name: string;
    quantity: number;
    uom: string;
    created_at?: string;
    updated_at?: string;
}

export interface GateEntryResponse {
    id: string;
    entry_number: string;
    entry_type: string;
    vendor: string;
    vehicle_no?: string;
    driver_name?: string;
    linked_document?: string;
    destination_department: string;
    status: string;
    remarks?: string;
    photos?: string[];
    materials: GateEntryMaterial[];
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface GateEntryListItem {
    id: string;
    entry_number: string;
    entry_type: string;
    vendor: string;
    vehicle_no?: string;
    driver_name?: string;
    destination_department: string;
    status: string;
    linked_document?: string;
    material_count: number;
    first_material_name?: string;
    total_items?: number;
    created_at: string;
}

export interface GateEntryStats {
    total_entries: number;
    arrived: number;
    under_verification: number;
    accepted: number;
    rejected: number;
    today_entries: number;
    by_type: Record<string, number>;
    by_department: Record<string, number>;
}

export interface CreateGateEntryData {
    entry_type: string;
    vendor: string;
    vehicle_no?: string;
    driver_name?: string;
    linked_document?: string;
    destination_department: string;
    remarks?: string;
    photos?: string[];
    materials: {
        material_code?: string;
        material_name: string;
        quantity: number;
        uom: string;
    }[];
}

export interface UpdateGateEntryData {
    entry_type?: string;
    vendor?: string;
    vehicle_no?: string;
    driver_name?: string;
    linked_document?: string;
    destination_department?: string;
    status?: string;
    remarks?: string;
    photos?: string[];
    materials?: {
        material_code?: string;
        material_name: string;
        quantity: number;
        uom: string;
    }[];
}

export const gateEntryApi = {
    // List all gate entries
    list: async (params?: {
        page?: number;
        limit?: number;
        status?: string;
        entry_type?: string;
        search?: string;
        date_from?: string;
        date_to?: string;
    }): Promise<GateEntryListItem[]> => {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) queryParams.append(key, value.toString());
            });
        }
        return apiClient.get<GateEntryListItem[]>(`/gate-entries/?${queryParams.toString()}`);
    },

    // Get gate entry statistics
    getStats: async (): Promise<GateEntryStats> => {
        return apiClient.get<GateEntryStats>('/gate-entries/stats');
    },

    // Get single gate entry
    get: async (id: string): Promise<GateEntryResponse> => {
        return apiClient.get<GateEntryResponse>(`/gate-entries/${id}`);
    },

    // Create new gate entry
    create: async (data: CreateGateEntryData): Promise<GateEntryResponse> => {
        return apiClient.post<GateEntryResponse>('/gate-entries/', data);
    },

    // Update gate entry
    update: async (id: string, data: UpdateGateEntryData): Promise<GateEntryResponse> => {
        return apiClient.put<GateEntryResponse>(`/gate-entries/${id}`, data);
    },

    // Update gate entry status
    updateStatus: async (id: string, data: {
        status: string;
        remarks?: string;
    }): Promise<GateEntryResponse> => {
        return apiClient.put<GateEntryResponse>(`/gate-entries/${id}/status`, data);
    },

    // Delete gate entry
    delete: async (id: string): Promise<{ message: string }> => {
        return apiClient.delete<{ message: string }>(`/gate-entries/${id}`);
    }
};
