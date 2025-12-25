import { apiClient } from './client';

export interface KPICard {
  title: string;
  value: number | string;
  unit?: string;
  trend?: string;
  trend_percentage?: number;
  icon?: string;
  color?: string;
}

export interface DashboardKPIs {
  live_orders: KPICard;
  material_shortages: KPICard;
  rework_items: KPICard;
  otd_percentage: KPICard;
  production_efficiency: KPICard;
}

export interface OrderSummary {
  total: number;
  planned: number;
  in_progress: number;
  completed: number;
  on_hold: number;
}

export interface ShortageItem {
  item_id: string;
  item_name: string;
  current_stock: number;
  required_stock: number;
  shortage_qty: number;
  unit: string;
  priority: string;
}

export interface ReworkAlert {
  order_number: string;
  product_name: string;
  qty_in_rework: number;
  defect_category: string;
  stage: string;
  days_in_rework: number;
}

export interface RecentActivity {
  id: string;
  activity_type: string;
  description: string;
  user_name: string;
  timestamp: string;
  icon?: string;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  orders_summary: OrderSummary;
  shortages: ShortageItem[];
  rework_alerts: ReworkAlert[];
  recent_activities: RecentActivity[];
  last_updated: string;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  roles: string[];
}

export const dashboardApi = {
  getDashboard: async (): Promise<DashboardResponse> => {
    return apiClient.get<DashboardResponse>('/dashboard');
  },

  getKPIs: async (): Promise<DashboardResponse> => {
    return apiClient.get<DashboardResponse>('/dashboard/kpis');
  },

  getQuickActions: async (): Promise<QuickAction[]> => {
    return apiClient.get<QuickAction[]>('/dashboard/quick-actions');
  },

  getOrdersSummary: async () => {
    return apiClient.get('/dashboard/orders-summary');
  },

  getShortagesDetail: async () => {
    return apiClient.get('/dashboard/shortages');
  },

  getReworkDetail: async () => {
    return apiClient.get('/dashboard/rework');
  },
};
