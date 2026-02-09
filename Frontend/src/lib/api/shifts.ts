import { apiClient } from './client';

export interface Shift {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ShiftCreate {
    name: string;
    start_time: string;
    end_time: string;
    is_active?: boolean;
}

export interface ShiftUpdate {
    name?: string;
    start_time?: string;
    end_time?: string;
    is_active?: boolean;
}

export const shiftsApi = {
    list: async (): Promise<Shift[]> => {
        return apiClient.get<Shift[]>('/shifts/');
    },

    create: async (data: ShiftCreate): Promise<Shift> => {
        return apiClient.post<Shift>('/shifts/', data);
    },

    update: async (id: string, data: ShiftUpdate): Promise<Shift> => {
        return apiClient.put<Shift>(`/shifts/${id}`, data);
    },

    delete: async (id: string): Promise<{ message: string }> => {
        return apiClient.delete<{ message: string }>(`/shifts/${id}`);
    }
};
