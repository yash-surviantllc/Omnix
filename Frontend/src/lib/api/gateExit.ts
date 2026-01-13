import { apiClient } from './client';

export interface GateExitMaterial {
    material_code?: string;
    material_name: string;
    quantity: number;
    uom: string;
}

export interface GateExitCreate {
    exit_type: string;
    destination: string;
    vehicle_no?: string;
    driver_name?: string;
    linked_document?: string;
    materials: GateExitMaterial[];
    remarks?: string;
}

export interface GateExitResponse {
    id: string;
    exit_number: string;
    exit_type: string;
    destination: string;
    vehicle_no?: string;
    driver_name?: string;
    linked_document?: string;
    status: string;
    materials: GateExitMaterial[];
    remarks?: string;
    created_at: string;
}

export interface GateExitStats {
    total_exits: number;
    ready: number;
    verified: number;
    dispatched: number;
    today_exits: number;
}

export const gateExitApi = {
    create: async (data: GateExitCreate): Promise<GateExitResponse> => {
        return apiClient.post<GateExitResponse>('/gate-exits/', data);
    },

    list: async (params?: { limit?: number; offset?: number }): Promise<GateExitResponse[]> => {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.offset) queryParams.append('offset', params.offset.toString());

        return apiClient.get<GateExitResponse[]>(`/gate-exits/?${queryParams.toString()}`);
    },

    getStats: async (): Promise<GateExitStats> => {
        return apiClient.get<GateExitStats>('/gate-exits/stats');
    },

    get: async (id: string): Promise<GateExitResponse> => {
        return apiClient.get<GateExitResponse>(`/gate-exits/${id}`);
    }
};
