import { apiClient } from './client';

// ============================================
// TYPES
// ============================================

export interface Stage {
    id: string;
    name: string;
    code: string;
    sequence_number: number;
    target_avg_time_minutes: number;
    color: string;
    icon?: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface StageCreate {
    name: string;
    code: string;
    sequence_number: number;
    target_avg_time_minutes: number;
    color?: string;
    icon?: string;
    description?: string;
    is_active?: boolean;
}

export interface StageUpdate {
    name?: string;
    code?: string;
    sequence_number?: number;
    target_avg_time_minutes?: number;
    color?: string;
    icon?: string;
    description?: string;
    is_active?: boolean;
}

export interface StageUsageStats {
    id: string;
    name: string;
    code: string;
    sequence_number: number;
    is_active: boolean;
    products_using_stage: number;
    active_work_orders: number;
    is_in_use: boolean;
}

export interface ProductStageAssignment {
    stage_id: string;
    sequence_number: number;
    is_required?: boolean;
    estimated_time_minutes?: number;
    notes?: string;
}

export interface ProductStageDetail {
    id: string;
    name: string;
    code: string;
    sequence_number: number;
    target_avg_time_minutes: number;
    color: string;
    icon?: string;
    description?: string;
    is_required: boolean;
    is_active: boolean;
}

export interface ProductStagesResponse {
    product_id: string;
    product_name?: string;
    stages: ProductStageDetail[];
    total_estimated_time: number;
}

export interface BulkStageAssignment {
    product_id: string;
    stages: ProductStageAssignment[];
}

export interface StageReorderRequest {
    stage_orders: Array<{
        stage_id: string;
        sequence_number: number;
    }>;
}

// ============================================
// API CLIENT
// ============================================

export const stagesApi = {
    // ============================================
    // STAGE MANAGEMENT
    // ============================================

    /**
     * List all WIP stages
     * @param activeOnly - Filter to active stages only (default: true)
     */
    listStages: async (activeOnly: boolean = true): Promise<Stage[]> => {
        return apiClient.get<Stage[]>(`/stages/?active_only=${activeOnly}`);
    },

    /**
     * Get a specific stage by ID
     */
    getStage: async (stageId: string): Promise<Stage> => {
        return apiClient.get<Stage>(`/stages/${stageId}`);
    },

    /**
     * Create a new WIP stage
     */
    createStage: async (stageData: StageCreate): Promise<Stage> => {
        return apiClient.post<Stage>('/stages', stageData);
    },

    /**
     * Update a WIP stage
     */
    updateStage: async (stageId: string, stageData: StageUpdate): Promise<Stage> => {
        return apiClient.put<Stage>(`/stages/${stageId}`, stageData);
    },

    /**
     * Delete a stage
     * @param stageId - ID of the stage to delete
     * @param force - If true, attempts hard delete (will fail if stage is in use)
     */
    deleteStage: async (stageId: string, force: boolean = false): Promise<{ message: string }> => {
        return apiClient.delete<{ message: string }>(`/stages/${stageId}?force=${force}`);
    },

    /**
     * Get usage statistics for a stage
     */
    getStageUsage: async (stageId: string): Promise<StageUsageStats> => {
        return apiClient.get<StageUsageStats>(`/stages/${stageId}/usage`);
    },

    /**
     * Reorder stages by updating sequence numbers
     */
    reorderStages: async (reorderData: StageReorderRequest): Promise<Stage[]> => {
        return apiClient.post<Stage[]>('/stages/reorder', reorderData);
    },

    // ============================================
    // PRODUCT-STAGE ASSIGNMENTS
    // ============================================

    /**
     * Get stages configured for a specific product
     * If the product has custom stage assignments, returns those.
     * Otherwise, returns the default active stages.
     */
    getProductStages: async (productId: string): Promise<ProductStagesResponse> => {
        return apiClient.get<ProductStagesResponse>(`/stages/product/${productId}`);
    },

    /**
     * Assign stages to a product (replaces existing assignments)
     */
    assignProductStages: async (assignment: BulkStageAssignment): Promise<ProductStagesResponse> => {
        return apiClient.post<ProductStagesResponse>('/stages/product/assign', assignment);
    },

    /**
     * Remove custom stage assignments for a product
     * After removal, the product will use the default active stages.
     */
    removeProductStages: async (productId: string): Promise<{ message: string }> => {
        return apiClient.delete<{ message: string }>(`/stages/product/${productId}`);
    },

    /**
     * Get list of products that use a specific stage
     */
    getProductsUsingStage: async (stageId: string): Promise<Array<{ id: string; code: string; name: string }>> => {
        return apiClient.get<Array<{ id: string; code: string; name: string }>>(`/stages/${stageId}/products`);
    },
};
