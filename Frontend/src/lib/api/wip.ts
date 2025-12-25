import { apiClient } from './client';

// ============================================
// TYPES
// ============================================

export interface WIPStageMetrics {
  id: string;
  name: string;
  orders: number;
  units: number;
  avgTime: number;
  targetAvgTime: number;
  utilization: number;
  health: 'healthy' | 'warning' | 'delayed';
}

export interface WIPDashboard {
  stages: WIPStageMetrics[];
  total_orders: number;
  total_units: number;
  avg_cycle_time: number;
  bottleneck_stage: string | null;
  last_updated: string;
}

export interface WIPSummaryStats {
  total_orders: number;
  total_units: number;
  avg_cycle_time_minutes: number;
  bottleneck_stage: string | null;
  stages_healthy: number;
  stages_warning: number;
  stages_delayed: number;
}

export interface BottleneckAlert {
  stage_name: string;
  utilization_percentage: number;
  avg_time_minutes: number;
  target_time_minutes: number;
  orders_count: number;
  units_count: number;
  severity: 'warning' | 'critical';
}

export interface WorkingOrder {
  id: string;
  work_order_number: string;
  production_order_id: string;
  operation: string;
  workstation: string | null;
  assigned_team: string | null;
  target_qty: number;
  completed_qty: number;
  rejected_qty: number;
  unit: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkingOrderCreate {
  production_order_id: string;
  operation: string;
  workstation?: string;
  assigned_team?: string;
  target_qty: number;
  unit: string;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  scheduled_start?: string;
  scheduled_end?: string;
  notes?: string;
}

export interface WorkingOrderUpdate {
  operation?: string;
  workstation?: string;
  assigned_team?: string;
  target_qty?: number;
  completed_qty?: number;
  rejected_qty?: number;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  notes?: string;
}

export interface StagePerformanceHistory {
  id: string;
  stage_name: string;
  date: string;
  orders_processed: number;
  units_processed: number;
  avg_time_minutes: number;
  utilization_percentage: number;
  efficiency_percentage: number;
  created_at: string;
}

// ============================================
// WIP API CLIENT
// ============================================

export const wipApi = {
  // Dashboard
  getDashboard: async (): Promise<WIPDashboard> => {
    return apiClient.get<WIPDashboard>('/wip/dashboard');
  },

  // Stage Metrics
  getStageMetrics: async (): Promise<WIPStageMetrics[]> => {
    return apiClient.get<WIPStageMetrics[]>('/wip/stages');
  },

  // Summary Stats
  getSummaryStats: async (): Promise<WIPSummaryStats> => {
    return apiClient.get<WIPSummaryStats>('/wip/summary');
  },

  // Bottleneck Alerts
  getBottleneckAlerts: async (): Promise<BottleneckAlert[]> => {
    return apiClient.get<BottleneckAlert[]>('/wip/bottlenecks');
  },

  // Stage History
  getStageHistory: async (stageName: string, days: number = 7): Promise<StagePerformanceHistory[]> => {
    return apiClient.get<StagePerformanceHistory[]>(`/wip/stages/${encodeURIComponent(stageName)}/history?days=${days}`);
  },

  // Working Orders
  listWorkingOrders: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    operation?: string;
    production_order_id?: string;
  }): Promise<WorkingOrder[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.operation) queryParams.append('operation', params.operation);
    if (params?.production_order_id) queryParams.append('production_order_id', params.production_order_id);

    const url = `/wip/working-orders?${queryParams.toString()}`;
    return apiClient.get<WorkingOrder[]>(url);
  },

  getWorkingOrder: async (orderId: string): Promise<WorkingOrder> => {
    return apiClient.get<WorkingOrder>(`/wip/working-orders/${orderId}`);
  },

  createWorkingOrder: async (orderData: WorkingOrderCreate): Promise<WorkingOrder> => {
    return apiClient.post<WorkingOrder>('/wip/working-orders', orderData);
  },

  updateWorkingOrder: async (orderId: string, orderData: WorkingOrderUpdate): Promise<WorkingOrder> => {
    return apiClient.put<WorkingOrder>(`/wip/working-orders/${orderId}`, orderData);
  },

  cancelWorkingOrder: async (orderId: string): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/wip/working-orders/${orderId}`);
  },
};
