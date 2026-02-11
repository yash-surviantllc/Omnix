import { apiClient } from './client';

export interface QCDefect {
    id?: string;
    defect_type: 'Rework' | 'Scrap';
    reason: string;
    quantity: number;
    photo_url?: string;
    notes?: string;
}

export interface QCInspection {
    id: string;
    inspection_number: string;
    purchase_order_id?: string;
    purchase_order_number?: string;
    work_order_id?: string;
    work_order_number?: string;
    product_id: string;
    product_name?: string;
    product_code?: string;
    quantity_checked: number;
    passed_qty: number;
    rework_qty: number;
    scrap_qty: number;
    status: 'Pending' | 'In Progress' | 'Completed';
    inspector_id?: string;
    inspector_name?: string;
    notes?: string;
    defects: QCDefect[];
    created_at: string;
    updated_at: string;
}

export interface QCStats {
    total_inspections: number;
    today_inspections: number;
    pending_rework: number;
    pass_rate: number;
}

export interface OrderLookupResponse {
    order_type: 'purchase_order' | 'work_order';
    order_id: string;
    order_number: string;
    product_id: string;
    product_name?: string;
    product_code?: string;
    quantity: number;
    completed_qty: number;
    status: string;
}

export interface CreateQCInspectionPayload {
    purchase_order_id?: string;
    work_order_id?: string;
    product_id: string;
    quantity_checked: number;
    passed_qty: number;
    rework_qty: number;
    scrap_qty: number;
    status: 'Pending' | 'In Progress' | 'Completed';
    notes?: string;
    defects: QCDefect[];
}

export const qcApi = {
    create: async (data: CreateQCInspectionPayload): Promise<QCInspection> => {
        return apiClient.post<QCInspection>('/qc/', data);
    },

    getAll: async (params?: { page?: number; limit?: number; status?: string }): Promise<QCInspection[]> => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.status) queryParams.append('status', params.status);

        const url = `/qc/?${queryParams.toString()}`;
        return apiClient.get<QCInspection[]>(url);
    },

    getStats: async (): Promise<QCStats> => {
        return apiClient.get<QCStats>('/qc/stats/');
    },

    async getById(id: string): Promise<QCInspection> {
        return apiClient.get<QCInspection>(`/qc/${id}`);
    },

    async lookupOrder(orderNumber: string): Promise<OrderLookupResponse> {
        return apiClient.get<OrderLookupResponse>(`/qc/lookup/${encodeURIComponent(orderNumber)}`);
    },

    async getTrends(): Promise<{ date: string; yield: number }[]> {
        return apiClient.get<{ date: string; yield: number }[]>('/qc/trends');
    }
};
