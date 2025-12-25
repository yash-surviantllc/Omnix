import { apiClient } from './client';

// ============================================
// TYPESCRIPT INTERFACES
// ============================================

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  is_active: boolean;
}

export interface BOMMaterial {
  id: string;
  bom_id: string;
  material_id: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  scrap_percentage: number;
  sequence_number: number;
}

export interface BOMMaterialWithShortage extends BOMMaterial {
  stock_qty: number;
  required_qty: number;
  shortage_status: 'Sufficient' | 'Shortage';
  shortage_display: string | null;
}

export interface BOM {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  batch_size: number;
  version: number;
  is_active: boolean;
  is_template: boolean;
  template_name?: string;
  notes?: string;
  materials: BOMMaterial[];
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface BOMListItem {
  id: string;
  product_code: string;
  product_name: string;
  version: number;
  is_active: boolean;
  material_count: number;
  total_cost: number;
  updated_at: string;
}

export interface BOMCreate {
  product_id: string;
  batch_size?: number;
  notes?: string;
  is_template?: boolean;
  template_name?: string;
  materials: BOMMaterialCreate[];
}

export interface BOMMaterialCreate {
  material_id: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  scrap_percentage?: number;
  sequence_number?: number;
}

export interface BOMUpdate {
  batch_size?: number;
  notes?: string;
  is_template?: boolean;
  template_name?: string;
  materials?: BOMMaterialCreate[];
}

export interface BOMCalculation {
  material_id: string;
  material_code: string;
  material_name: string;
  quantity_per_unit: number;
  total_quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  scrap_percentage: number;
}

export interface ShortageCalculationRequest {
  product_id: string;
  quantity: number;
  target_location_id?: string;
  include_allocated?: boolean;
}

export interface MaterialShortageDetail {
  material_id: string;
  material_code: string;
  material_name: string;
  required_qty: number;
  available_qty: number;
  shortage_qty: number;
  unit: string;
  shortage_status: 'Sufficient' | 'Moderate' | 'Critical' | 'Out of Stock';
  locations: {
    location_id: string;
    location_name: string;
    available_qty: number;
  }[];
}

export interface BOMShortageCalculation {
  product_code: string;
  product_name: string;
  production_qty: number;
  materials: MaterialShortageDetail[];
  summary: {
    total_materials: number;
    sufficient_count: number;
    shortage_count: number;
    critical_count: number;
    total_shortage_value: number;
  };
}

// ============================================
// API CLIENT
// ============================================

export const bomApi = {
  // List all BOMs
  listBOMs: async (params?: {
    page?: number;
    limit?: number;
    product_id?: string;
    is_active?: boolean;
    is_template?: boolean;
    search?: string;
  }): Promise<BOMListItem[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.product_id) queryParams.append('product_id', params.product_id);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    if (params?.is_template !== undefined) queryParams.append('is_template', params.is_template.toString());
    if (params?.search) queryParams.append('search', params.search);

    const url = `/boms${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<BOMListItem[]>(url);
  },

  // Get BOM by ID
  getBOM: async (bomId: string): Promise<BOM> => {
    return apiClient.get<BOM>(`/boms/${bomId}`);
  },

  // Get active BOM by product ID
  getActiveBOMByProduct: async (productId: string): Promise<BOM> => {
    return apiClient.get<BOM>(`/boms/product/${productId}/active`);
  },

  // Create new BOM with product creation
  createBOMWithProduct: async (data: {
    product_code: string;
    product_name: string;
    batch_size?: number;
    notes?: string;
    materials: Array<{
      itemCode: string;
      material: string;
      qty: string;
      unit: string;
      unitCost: string;
    }>;
  }): Promise<BOM> => {
    return apiClient.post<BOM>('/boms/with-product', data);
  },

  // Create new BOM
  createBOM: async (data: BOMCreate): Promise<BOM> => {
    return apiClient.post<BOM>('/boms', data);
  },

  // Update BOM
  updateBOM: async (bomId: string, data: BOMUpdate): Promise<BOM> => {
    return apiClient.put<BOM>(`/boms/${bomId}`, data);
  },

  // Delete BOM (soft delete)
  deleteBOM: async (bomId: string): Promise<void> => {
    return apiClient.delete(`/boms/${bomId}`);
  },

  // Add material to BOM
  addMaterial: async (bomId: string, material: BOMMaterialCreate): Promise<BOM> => {
    return apiClient.post<BOM>(`/boms/${bomId}/materials`, material);
  },

  // Update material in BOM
  updateMaterial: async (bomId: string, materialId: string, material: BOMMaterialCreate): Promise<BOM> => {
    return apiClient.put<BOM>(`/boms/${bomId}/materials/${materialId}`, material);
  },

  // Remove material from BOM
  removeMaterial: async (bomId: string, materialId: string): Promise<void> => {
    return apiClient.delete(`/boms/${bomId}/materials/${materialId}`);
  },

  // Calculate material requirements
  calculateRequirements: async (productId: string, quantity: number): Promise<BOMCalculation[]> => {
    return apiClient.post<BOMCalculation[]>(`/boms/calculate-requirements?product_id=${productId}&quantity=${quantity}`);
  },

  // Calculate requirements with shortage analysis
  calculateWithShortages: async (request: ShortageCalculationRequest): Promise<BOMShortageCalculation> => {
    return apiClient.post<BOMShortageCalculation>('/boms/calculate-with-shortages', request);
  },

  // Get BOM materials with shortage info (for BOM Planner table)
  getMaterialsWithShortages: async (bomId: string, productionQty: number): Promise<BOMMaterialWithShortage[]> => {
    return apiClient.get<BOMMaterialWithShortage[]>(`/boms/${bomId}/materials-with-shortages?production_qty=${productionQty}`);
  },

  // Activate BOM
  activateBOM: async (bomId: string): Promise<BOM> => {
    return apiClient.put<BOM>(`/boms/${bomId}/activate`);
  },

  // Get cost breakdown
  getCostBreakdown: async (bomId: string, quantity: number = 1): Promise<any> => {
    return apiClient.get(`/boms/${bomId}/cost-breakdown?quantity=${quantity}`);
  },

  // Duplicate BOM
  duplicateBOM: async (bomId: string, data: { product_id: string; is_template?: boolean; template_name?: string }): Promise<BOM> => {
    return apiClient.post<BOM>(`/boms/${bomId}/duplicate`, data);
  },

  // Validate BOM
  validateBOM: async (bomId: string): Promise<any> => {
    return apiClient.post(`/boms/${bomId}/validate`);
  },

  // Get BOM versions
  getBOMVersions: async (bomId: string): Promise<any[]> => {
    return apiClient.get(`/boms/${bomId}/versions`);
  },
};

// ============================================
// PRODUCTS API (for BOM creation)
// ============================================

export const productsApi = {
  // List all products
  listProducts: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<Product[]> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active ? 'true' : 'false');
    if (params?.search) queryParams.append('search', params.search);

    const url = `/products?${queryParams.toString()}`;
    return apiClient.get<Product[]>(url);
  },

  // Get product by ID
  getProduct: async (productId: string): Promise<Product> => {
    return apiClient.get<Product>(`/products/${productId}`);
  },
};
