import { apiClient } from './client';

// Types
export interface ProductionOrder {
  id: string;
  order_number: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit: string;
  due_date: string;
  priority: string;
  status: string;
  notes?: string;
  qr_code?: string;
  materials_status?: string;
  days_until_due?: number;
  is_overdue?: boolean;
  materials?: OrderMaterial[];
  total_material_cost?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface OrderMaterial {
  id: string;
  order_id: string;
  material_id: string;
  material_code?: string;
  material_name?: string;
  required_qty: number;
  allocated_qty: number;
  issued_qty: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductionOrderData {
  product_id: string;
  quantity: number;
  due_date: string;
  priority: string;
  notes?: string;
  customer_name?: string;
  assigned_team?: string;
  shift_number?: string;
  production_stage?: string;
  start_time?: string;
  end_time?: string;
}

export interface UpdateProductionOrderData {
  quantity?: number;
  due_date?: string;
  priority?: string;
  status?: string;
  notes?: string;
  customer_name?: string;
  assigned_team?: string;
  shift_number?: string;
  production_stage?: string;
}

export interface OrderStatusUpdate {
  status: string;
  notes?: string;
}

export interface MaterialRequirement {
  material_id: string;
  material_code: string;
  material_name: string;
  required_qty: number;
  available_qty: number;
  shortage_qty: number;
  unit: string;
  availability_status: string;
}

export interface OrderProgress {
  order_id: string;
  order_number: string;
  current_stage: string;
  overall_progress: number;
  stages: StageProgress[];
}

export interface StageProgress {
  stage_name: string;
  status: string;
  progress: number;
  started_at?: string;
  completed_at?: string;
  assigned_team?: string;
}

export interface TeamAssignment {
  user_id: string;
  user_name: string;
  role: string;
  assigned_at: string;
}

export interface ProductionValidation {
  can_produce: boolean;
  product_id: string;
  product_name: string;
  requested_quantity: number;
  shortages: MaterialRequirement[];
  total_shortage_value: number;
  message: string;
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  due_date_from?: string;
  due_date_to?: string;
}

// API Client
export const productionOrdersApi = {
  // List production orders
  async listOrders(params?: ListOrdersParams): Promise<ProductionOrder[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.due_date_from) queryParams.append('due_date_from', params.due_date_from);
    if (params?.due_date_to) queryParams.append('due_date_to', params.due_date_to);

    const url = `/production-orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await apiClient.get<ProductionOrder[]>(url);
  },

  // Get single production order
  async getOrder(orderId: string): Promise<ProductionOrder> {
    return await apiClient.get<ProductionOrder>(`/production-orders/${orderId}`);
  },

  // Create production order
  async createOrder(data: CreateProductionOrderData): Promise<ProductionOrder> {
    return await apiClient.post<ProductionOrder>('/production-orders', data);
  },

  // Duplicate production order
  async duplicateOrder(orderId: string): Promise<ProductionOrder> {
    return await apiClient.post<ProductionOrder>(`/production-orders/${orderId}/duplicate`);
  },

  // Update production order
  async updateOrder(orderId: string, data: UpdateProductionOrderData): Promise<ProductionOrder> {
    return await apiClient.put<ProductionOrder>(`/production-orders/${orderId}`, data);
  },

  // Update order status
  async updateStatus(orderId: string, data: OrderStatusUpdate): Promise<ProductionOrder> {
    return await apiClient.put<ProductionOrder>(`/production-orders/${orderId}/status`, data);
  },

  // Archive order
  async archiveOrder(orderId: string): Promise<ProductionOrder> {
    return await apiClient.post<ProductionOrder>(`/production-orders/${orderId}/archive`);
  },

  // Cancel/Delete order
  async cancelOrder(orderId: string): Promise<{ message: string }> {
    return await apiClient.delete<{ message: string }>(`/production-orders/${orderId}`);
  },

  // Get order materials
  async getOrderMaterials(orderId: string): Promise<MaterialRequirement[]> {
    return await apiClient.get<MaterialRequirement[]>(`/production-orders/${orderId}/materials`);
  },

  // Get order progress
  async getOrderProgress(orderId: string): Promise<OrderProgress> {
    return await apiClient.get<OrderProgress>(`/production-orders/${orderId}/progress`);
  },

  // Assign team to order
  async assignTeam(orderId: string, userIds: string[]): Promise<{ message: string }> {
    return await apiClient.post<{ message: string }>(`/production-orders/${orderId}/assign`, { user_ids: userIds });
  },

  // Get order team
  async getOrderTeam(orderId: string): Promise<TeamAssignment[]> {
    return await apiClient.get<TeamAssignment[]>(`/production-orders/${orderId}/team`);
  },

  // Validate production feasibility
  async validateProduction(productId: string, quantity: number, locationId?: string): Promise<ProductionValidation> {
    const queryParams = new URLSearchParams({
      product_id: productId,
      quantity: quantity.toString(),
    });
    
    if (locationId) {
      queryParams.append('target_location_id', locationId);
    }

    return await apiClient.post<ProductionValidation>(`/production-orders/validate-production?${queryParams.toString()}`);
  },
};
