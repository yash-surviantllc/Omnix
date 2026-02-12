import { apiClient } from './client';

// Types
export interface PurchaseOrder {
  id: string;
  order_number: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit: string;
  due_date: string;
  priority: string;
  start_date?: string;
  end_date?: string;
  status: string;
  notes?: string;
  materials_status?: string;
  days_until_due?: number;
  is_overdue?: boolean;
  materials?: OrderMaterial[];
  items?: POItemResponse[];
  total_material_cost?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  progress_percentage?: number;
  sku_progress?: SkuProgressSummary[];
  stage_progress?: StageProgress[];
  pending_shortages?: SkuShortageSummary[];
  qr_code?: string;
  shift_number?: string;
  bom_id?: string;
}

export interface POItemResponse {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  quantity: number;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
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

export interface CreatePurchaseOrderData {
  product_id: string;
  quantity: number;
  due_date: string;
  priority: string;
  notes?: string;
  customer_name?: string;
  assigned_team?: string;
  production_stage?: string;
  start_date?: string; // Renamed from start_time
  end_date?: string;   // Renamed from end_time
  shift_number?: string;
}

export interface UpdatePurchaseOrderData {
  quantity?: number;
  due_date?: string;
  priority?: string;
  status?: string;
  notes?: string;
  customer_name?: string;
  assigned_team?: string;
  production_stage?: string;
}

export interface OrderStatusUpdate {
  status: string;
  notes?: string;
}

export interface MultiSkuOrderItem {
  product_id: string;
  quantity: number;
  unit?: string;
  notes?: string;
}

export interface CreateMultiSkuOrderData {
  customer_name?: string;
  due_date: string;
  priority?: string;
  notes?: string;
  start_date?: string; // Renamed from start_time
  end_date?: string;   // Renamed from end_time
  items: MultiSkuOrderItem[];
  shift_number?: string;
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

export interface SkuProgressSummary {
  product_id: string;
  product_name?: string;
  product_code?: string;
  required_qty: number;
  completed_qty: number;
  shortage_qty?: number;
  unit?: string;
  status?: string;
  assigned_team?: string;
  last_updated?: string;
}

export interface SkuShortageSummary {
  product_id: string;
  product_name?: string;
  shortage_qty: number;
  unit?: string;
  severity?: 'critical' | 'warning' | string;
  eta_date?: string;
  note?: string;
}

export interface TeamAssignment {
  user_id: string;
  user_name: string;
  role: string;
  assigned_at: string;
}

export interface PurchaseOrderValidation {
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
const PURCHASE_ORDER_BASE = '/orders';

export const purchaseOrdersApi = {
  // List purchase orders
  async listOrders(params?: ListOrdersParams): Promise<PurchaseOrder[]> {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.due_date_from) queryParams.append('due_date_from', params.due_date_from);
    if (params?.due_date_to) queryParams.append('due_date_to', params.due_date_to);

    const url = `${PURCHASE_ORDER_BASE}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await apiClient.get<PurchaseOrder[]>(url, {
      useCache: true,
      ttl: 300 // 5 minutes
    });
  },

  // Get single purchase order
  async getOrder(orderId: string): Promise<PurchaseOrder> {
    return await apiClient.get<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/${orderId}`, {
      useCache: true,
      ttl: 300 // 5 minutes
    });
  },


  // Create purchase order
  async createOrder(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    const response = await apiClient.post<PurchaseOrder>(`${PURCHASE_ORDER_BASE}`, data);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Duplicate purchase order
  async duplicateOrder(orderId: string): Promise<PurchaseOrder> {
    const response = await apiClient.post<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/${orderId}/duplicate`);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Create multi-SKU purchase order
  async createMultiSkuOrder(data: CreateMultiSkuOrderData): Promise<PurchaseOrder> {
    const response = await apiClient.post<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/multi-sku`, data);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Update purchase order
  async updateOrder(orderId: string, data: UpdatePurchaseOrderData): Promise<PurchaseOrder> {
    const response = await apiClient.put<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/${orderId}`, data);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Update order status
  async updateStatus(orderId: string, data: OrderStatusUpdate): Promise<PurchaseOrder> {
    const response = await apiClient.put<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/${orderId}/status`, data);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Archive order
  async archiveOrder(orderId: string): Promise<PurchaseOrder> {
    const response = await apiClient.post<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/${orderId}/archive`);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Cancel order (POST backend)
  async cancelOrder(orderId: string): Promise<PurchaseOrder> {
    const response = await apiClient.post<PurchaseOrder>(`${PURCHASE_ORDER_BASE}/${orderId}/cancel`);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Delete order (DELETE backend)
  async deleteOrder(orderId: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`${PURCHASE_ORDER_BASE}/${orderId}`);
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Get order materials
  async getOrderMaterials(orderId: string): Promise<MaterialRequirement[]> {
    return await apiClient.get<MaterialRequirement[]>(`${PURCHASE_ORDER_BASE}/${orderId}/materials`);
  },

  // Get order progress
  async getOrderProgress(orderId: string): Promise<OrderProgress> {
    return await apiClient.get<OrderProgress>(`${PURCHASE_ORDER_BASE}/${orderId}/progress`);
  },

  // Assign team to order
  async assignTeam(orderId: string, userIds: string[]): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`${PURCHASE_ORDER_BASE}/${orderId}/assign`, { user_ids: userIds });
    apiClient.invalidateCache(PURCHASE_ORDER_BASE);
    return response;
  },

  // Get order team
  async getOrderTeam(orderId: string): Promise<TeamAssignment[]> {
    return await apiClient.get<TeamAssignment[]>(`${PURCHASE_ORDER_BASE}/${orderId}/team`);
  },

  // Validate production feasibility
  async validateProduction(productId: string, quantity: number, locationId?: string): Promise<PurchaseOrderValidation> {
    const queryParams = new URLSearchParams({
      product_id: productId,
      quantity: quantity.toString(),
    });

    if (locationId) {
      queryParams.append('target_location_id', locationId);
    }

    return await apiClient.post<PurchaseOrderValidation>(`${PURCHASE_ORDER_BASE}/validate-production?${queryParams.toString()}`);
  },
};
