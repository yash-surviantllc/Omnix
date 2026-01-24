import { INVENTORY_STOCK } from '@/data/mock-data';

// Material name aliases and mappings (expanded for multi-language)
export const MATERIAL_ALIASES: Record<string, string> = {
  // Cotton Fabric
  'cotton': 'Cotton Fabric',
  'cotton fabric': 'Cotton Fabric',
  'कपास': 'Cotton Fabric',
  'कपास कपड़ा': 'Cotton Fabric',
  'பருத்தி': 'Cotton Fabric',
  'ಹತ್ತಿ': 'Cotton Fabric',
  'పత్తి': 'Cotton Fabric',

  // Fleece Fabric
  'fleece': 'Fleece Fabric',
  'fleece fabric': 'Fleece Fabric',
  'फ्लीस': 'Fleece Fabric',

  // Polyester Fabric
  'polyester': 'Polyester Fabric',
  'polyester fabric': 'Polyester Fabric',
  'पॉलिएस्टर': 'Polyester Fabric',
  'పాలిస్టర్': 'Polyester Fabric',

  // Thread
  'thread': 'Thread (White)',
  'thread white': 'Thread (White)',
  'white thread': 'Thread (White)',
  'thread black': 'Thread (Black)',
  'black thread': 'Thread (Black)',
  'धागा': 'Thread (White)',
  'நூல்': 'Thread (White)',
  'ದಾರ': 'Thread (White)',
  'దారం': 'Thread (White)',
  'thread red': 'Thread (White)', // Will be mapped to closest available
  'red color thread': 'Thread (White)',

  // Zipper
  'zipper': 'Zipper (Metal)',
  'metal zipper': 'Zipper (Metal)',
  'जिप': 'Zipper (Metal)',
  'ஜிப்': 'Zipper (Metal)',
  'zip': 'Zipper (Metal)',

  // Elastic
  'elastic': 'Elastic Band',
  'elastic band': 'Elastic Band',
  'इलास्टिक': 'Elastic Band',
  'ఎలాస్టిక్': 'Elastic Band',

  // Labels
  'label': 'Neck Label',
  'neck label': 'Neck Label',
  'woven label': 'Woven Label',
  'printed tag': 'Printed Tag',
  'printed label': 'Printed Label',
  'labels': 'Neck Label',

  // Poly Bag
  'poly bag': 'Poly Bag',
  'polybag': 'Poly Bag',
  'bag': 'Poly Bag',
  'பை': 'Poly Bag',
  'ಚೀಲ': 'Poly Bag',

  // Drawstring
  'drawstring': 'Drawstring',
  'cord': 'Drawstring',

  // Chemicals (for QC/Lab)
  'chemical': 'Chemical',
  'chemicals': 'Chemical',
  'रसायन': 'Chemical'
};

// Department/Location mappings (expanded for all departments)
export const LOCATION_ALIASES: Record<string, string> = {
  // Production Departments
  'cutting': 'Cutting Floor',
  'cutting floor': 'Cutting Floor',
  'cutting dept': 'Cutting Floor',
  'कटिंग': 'Cutting Floor',
  'கட்டிங்': 'Cutting Floor',
  'ಕಟಿಂಗ್': 'Cutting Floor',

  'sewing': 'Sewing Floor',
  'sewing floor': 'Sewing Floor',
  'sewing dept': 'Sewing Floor',
  'stitching': 'Sewing Floor',
  'stitching floor': 'Sewing Floor',
  'सिलाई': 'Sewing Floor',
  'தையல்': 'Sewing Floor',
  'ಹೊಲಿಗೆ': 'Sewing Floor',
  'కుట్టు': 'Sewing Floor',

  'finishing': 'Finishing Floor',
  'finishing floor': 'Finishing Floor',
  'finishing dept': 'Finishing Floor',
  'फिनिशिंग': 'Finishing Floor',

  'qc': 'QC Floor',
  'qa': 'QC Floor',
  'quality': 'QC Floor',
  'quality control': 'QC Floor',
  'inspection': 'QC Floor',
  'गुणवत्ता': 'QC Floor',

  'packing': 'Packing Floor',
  'packing floor': 'Packing Floor',
  'packaging': 'Packing Floor',
  'पैकिंग': 'Packing Floor',
  'பேக்கிங்': 'Packing Floor',

  // Support Departments
  'maintenance': 'Maintenance',
  'मेंटेनेंस': 'Maintenance',
  'रखरखाव': 'Maintenance',

  'store': 'Store',
  'store room': 'Store Room',
  'स्टोर': 'Store',

  'production': 'Production',
  'उत्पादन': 'Production',

  'procurement': 'Procurement',
  'खरीद': 'Procurement',

  'accounts': 'Accounts',
  'लेखा': 'Accounts',

  // Warehouse Locations
  'rm store': 'RM Store A',
  'rm store a': 'RM Store A',
  'rm store b': 'RM Store B',
  'raw material': 'RM Store A',
  'warehouse': 'RM Store A',
  'accessories': 'Accessories',
  'packaging store': 'Packaging'
};

// SKU aliases (expanded)
export const SKU_ALIASES: Record<string, string> = {
  't-shirt': 'TS-001',
  'tshirt': 'TS-001',
  'ts-001': 'TS-001',
  'ts001': 'TS-001',
  'cotton t-shirt': 'TS-001',
  'टी-शर्ट': 'TS-001',
  'டி-ஷர்ட்': 'TS-001',

  'hoodie': 'HD-001',
  'hd-001': 'HD-001',
  'hd001': 'HD-001',
  'fleece hoodie': 'HD-001',
  'हुडी': 'HD-001',

  'track pants': 'TR-001',
  'trackpants': 'TR-001',
  'pants': 'TR-001',
  'tr-001': 'TR-001',
  'tr001': 'TR-001',
  'polyester pants': 'TR-001',
  'ट्रैक पैंट': 'TR-001'
};

// Department classification
export const DEPARTMENT_TYPES = {
  production: ['Cutting Floor', 'Sewing Floor', 'Finishing Floor', 'Packing Floor'],
  quality: ['QC Floor'],
  support: ['Maintenance', 'Store', 'Store Room'],
  planning: ['Production', 'Procurement'],
  finance: ['Accounts']
};

// Purpose classification keywords
export const PURPOSE_KEYWORDS: Record<string, string> = {
  'production': 'Production',
  'rework': 'Rework',
  'qc': 'QC',
  'quality': 'QC',
  'maintenance': 'Maintenance',
  'repair': 'Maintenance',
  'sample': 'Sample',
  'packing': 'Packing',
  'packaging': 'Packing',
  'testing': 'QC'
};

// Urgency keywords
export const URGENCY_KEYWORDS: Record<string, 'Urgent' | 'Normal'> = {
  'urgent': 'Urgent',
  'immediate': 'Urgent',
  'immediately': 'Urgent',
  'asap': 'Urgent',
  'today': 'Urgent',
  'now': 'Urgent',
  'shift end': 'Urgent',
  'before shift': 'Urgent',
  'तुरंत': 'Urgent',
  'जल्दी': 'Urgent'
};

export type MaterialRequest = {
  action: 'material_request';
  request_type: 'issue' | 'transfer' | 'purchase' | 'maintenance' | 'packaging' | 'qc_lab';
  request_id: string;
  requesting_department: string;
  materials: Array<{
    material_code: string;
    name: string;
    requested_qty: number;
    available_qty: number;
    shortage_qty: number;
    uom: string;
  }>;
  source_warehouse?: string;
  destination: string;
  linked_production_order?: string;
  linked_sku?: string;
  purpose?: string;
  urgency: 'Normal' | 'Urgent';
  status: 'Draft' | 'Pending Clarification' | 'Validated' | 'Partial Stock' | 'Insufficient Stock' | 'Error' | 'Completed' | 'Approved';
  validation: {
    stock_available: boolean;
    partial_available?: boolean;
    shortfall?: Array<{
      material: string;
      required: number;
      available: number;
      shortage: number;
      available_in_secondary?: Array<{
        location: string;
        quantity: number;
      }>;
    }>;
    warnings?: string[];
    missing_info?: string[];
  };
  approval_required: boolean;
  approval_level?: 'supervisor' | 'manager' | 'procurement';
  next_steps?: string[];
  notes?: string;
  timestamp: string;
  audit_trail?: Array<{
    action: string;
    user: string;
    timestamp: string;
  }>;
};

export class MaterialRequestProcessor {

  // Parse natural language request
  static parseRequest(text: string): Partial<MaterialRequest> {
    const lowercaseText = text.toLowerCase();

    // Detect request type
    let request_type: 'issue' | 'transfer' | 'purchase' | 'maintenance' | 'packaging' | 'qc_lab' = 'issue';
    if (lowercaseText.includes('transfer') || lowercaseText.includes('move') || lowercaseText.includes('shift')) {
      request_type = 'transfer';
    } else if (lowercaseText.includes('purchase') || lowercaseText.includes('buy') || lowercaseText.includes('order')) {
      request_type = 'purchase';
    } else if (lowercaseText.includes('maintenance') || lowercaseText.includes('repair')) {
      request_type = 'maintenance';
    } else if (lowercaseText.includes('packaging') || lowercaseText.includes('bag')) {
      request_type = 'packaging';
    } else if (lowercaseText.includes('qc') || lowercaseText.includes('quality') || lowercaseText.includes('testing')) {
      request_type = 'qc_lab';
    }

    // Extract material
    const materialMatch = this.extractMaterial(text);

    // Extract quantity
    const quantityMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|m|pcs|units?|metre|meter|किलो|मीटर)/i);
    const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 0;
    const uom = quantityMatch ? this.normalizeUOM(quantityMatch[2]) : 'kg';

    // Extract destination/department
    const destination = this.extractLocation(text, ['to', 'for', 'at']);

    // Extract source (for transfers)
    const source = request_type === 'transfer' ? this.extractLocation(text, ['from']) : undefined;

    // Extract PO number
    const poMatch = text.match(/po[-\s]?(\d+)/i);
    const linked_production_order = poMatch ? `PO-${poMatch[1]}` : undefined;

    // Extract SKU
    const skuMatch = this.extractSKU(text);

    // Extract purpose
    const purposeMatch = this.extractPurpose(text);

    // Extract urgency
    const urgencyMatch = this.extractUrgency(text);

    return {
      request_type,
      materials: materialMatch ? [{
        material_code: this.getMaterialCode(materialMatch),
        name: materialMatch,
        requested_qty: quantity,
        available_qty: 0,
        shortage_qty: 0,
        uom
      }] : [],
      source_warehouse: source,
      destination: destination || 'Unknown',
      linked_production_order,
      linked_sku: skuMatch,
      purpose: purposeMatch,
      urgency: urgencyMatch,
      timestamp: new Date().toISOString()
    };
  }

  // Extract material from text
  private static extractMaterial(text: string): string | null {
    const lowercaseText = text.toLowerCase();

    // Check all aliases
    for (const [alias, material] of Object.entries(MATERIAL_ALIASES)) {
      if (lowercaseText.includes(alias)) {
        return material;
      }
    }

    // Check exact material names from inventory
    for (const material of Object.keys(INVENTORY_STOCK)) {
      if (lowercaseText.includes(material.toLowerCase())) {
        return material;
      }
    }

    return null;
  }

  // Extract location from text
  private static extractLocation(text: string, keywords: string[]): string | undefined {
    const lowercaseText = text.toLowerCase();

    // Try to find location after keywords
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}\\s+([\\w\\s]+?)(?:\\s+for|\\s+by|\\s+on|$)`, 'i');
      const match = text.match(regex);
      if (match) {
        const location = match[1].trim();
        // Check if it matches an alias
        for (const [alias, loc] of Object.entries(LOCATION_ALIASES)) {
          if (location.toLowerCase().includes(alias)) {
            return loc;
          }
        }
        return location;
      }
    }

    // Try to find any location mentioned
    for (const [alias, location] of Object.entries(LOCATION_ALIASES)) {
      if (lowercaseText.includes(alias)) {
        return location;
      }
    }

    return undefined;
  }

  // Extract SKU from text
  private static extractSKU(text: string): string | undefined {
    const lowercaseText = text.toLowerCase();

    // Check all SKU aliases
    for (const [alias, sku] of Object.entries(SKU_ALIASES)) {
      if (lowercaseText.includes(alias)) {
        return sku;
      }
    }

    return undefined;
  }

  // Get material code
  private static getMaterialCode(materialName: string): string {
    const codes: Record<string, string> = {
      'Cotton Fabric': 'COT-001',
      'Fleece Fabric': 'FLE-001',
      'Polyester Fabric': 'POL-001',
      'Thread (White)': 'THR-W01',
      'Thread (Black)': 'THR-B01',
      'Zipper (Metal)': 'ZIP-M01',
      'Elastic Band': 'ELA-001',
      'Drawstring': 'DRW-001',
      'Neck Label': 'LAB-N01',
      'Woven Label': 'LAB-W01',
      'Printed Tag': 'TAG-P01',
      'Printed Label': 'LAB-P01',
      'Poly Bag': 'BAG-P01'
    };
    return codes[materialName] || 'UNKNOWN';
  }

  // Normalize unit of measurement
  private static normalizeUOM(uom: string): string {
    const normalized = uom.toLowerCase();
    if (normalized.includes('kg') || normalized.includes('किलो')) return 'kg';
    if (normalized.includes('m') || normalized.includes('metre') || normalized.includes('meter') || normalized.includes('मीटर')) return 'm';
    if (normalized.includes('pc') || normalized.includes('unit')) return 'pcs';
    return uom;
  }

  // Validate stock availability
  static validateStock(request: Partial<MaterialRequest>): MaterialRequest {
    const validation: MaterialRequest['validation'] = {
      stock_available: true,
      partial_available: false,
      shortfall: [],
      warnings: [],
      missing_info: []
    };

    if (!request.materials || request.materials.length === 0) {
      return {
        ...request,
        action: 'material_request',
        request_id: `MR-${Date.now()}`,
        status: 'Error',
        validation: {
          stock_available: false,
          warnings: ['No materials specified in request']
        }
      } as MaterialRequest;
    }

    // Check stock for each material
    for (const material of request.materials) {
      const stockData = INVENTORY_STOCK[material.name as keyof typeof INVENTORY_STOCK];

      if (!stockData) {
        validation.warnings?.push(`Material "${material.name}" not found in inventory`);
        validation.stock_available = false;
        continue;
      }

      const available = stockData.qty;
      const required = material.requested_qty;

      if (required > available) {
        validation.stock_available = false;
        validation.shortfall?.push({
          material: material.name,
          required,
          available,
          shortage: required - available
        });
      }

      // Warn if close to reorder level
      const reorderLevel = available * 0.2; // 20% as reorder threshold
      if (available - required < reorderLevel) {
        validation.warnings?.push(`${material.name} will be below reorder level after this transaction`);
      }
    }

    // Determine status
    let status: MaterialRequest['status'] = 'Validated';
    if (!validation.stock_available) {
      status = 'Insufficient Stock';
    }

    return {
      ...request,
      action: 'material_request',
      request_id: `MR-${Date.now()}`,
      status,
      validation
    } as MaterialRequest;
  }

  // Process complete request
  static processRequest(text: string, language: string = 'en'): MaterialRequest {
    const parsed = this.parseRequest(text);
    const validated = this.validateStock(parsed);

    // Add automatic notes
    validated.notes = `Request created via AI Assistant in ${language} at ${new Date().toLocaleString()}`;

    return validated;
  }

  // Generate response message
  static generateResponse(request: MaterialRequest, language: 'en' | 'hi'): string {
    if (request.status === 'Error') {
      return language === 'en'
        ? `❌ Error: ${request.validation.warnings?.join(', ')}`
        : `❌ त्रुटि: ${request.validation.warnings?.join(', ')}`;
    }

    const material = request.materials[0];

    if (request.status === 'Insufficient Stock') {
      const shortfall = request.validation.shortfall?.[0];
      return language === 'en'
        ? `⚠️ Insufficient Stock\n\nMaterial: ${material.name}\nRequired: ${material.requested_qty} ${material.uom}\nAvailable: ${shortfall?.available} ${material.uom}\nShortage: ${shortfall?.shortage} ${material.uom}\n\n💡 Options:\n1. Transfer ${shortfall?.available} ${material.uom} (available stock)\n2. Create purchase requisition for ${shortfall?.shortage} ${material.uom}\n3. Adjust production quantity`
        : `⚠️ अपर्याप्त स्टॉक\n\nसामग्री: ${material.name}\nआवश्यक: ${material.requested_qty} ${material.uom}\nउपलब्ध: ${shortfall?.available} ${material.uom}\nकमी: ${shortfall?.shortage} ${material.uom}\n\n💡 विकल्प:\n1. ${shortfall?.available} ${material.uom} स्थानांतरित करें\n2. ${shortfall?.shortage} ${material.uom} के लिए खरीद अनुरोध बनाएं\n3. उत्पादन मात्रा समायोजित करें`;
    }

    // Success response
    const sourceInfo = request.source_warehouse ? `\nFrom: ${request.source_warehouse}` : '';
    const poInfo = request.linked_production_order ? `\nLinked PO: ${request.linked_production_order}` : '';

    return language === 'en'
      ? `✅ Material Request Created\n\nRequest ID: ${request.request_id}\nType: ${request.request_type.toUpperCase()}\nMaterial: ${material.name} (${material.material_code})\nQuantity: ${material.requested_qty} ${material.uom}${sourceInfo}\nTo: ${request.destination}${poInfo}\nStatus: ${request.status}\n\n${request.validation.warnings?.length ? '⚠️ Warnings:\n' + request.validation.warnings.join('\n') : ''}\n\n📱 Next: Scan QR code to confirm`
      : `✅ सामग्री अनुरोध बनाया गया\n\nअनुरोध ID: ${request.request_id}\nप्रकार: ${request.request_type.toUpperCase()}\nसामग्री: ${material.name} (${material.material_code})\nमात्रा: ${material.requested_qty} ${material.uom}${sourceInfo}\nगंतव्य: ${request.destination}${poInfo}\nस्थिति: ${request.status}\n\n${request.validation.warnings?.length ? '⚠️ चेतावनी:\n' + request.validation.warnings.join('\n') : ''}\n\n📱 अगला: पुष्टि के लिए QR कोड स्कैन करें`;
  }

  // Extract purpose from text
  private static extractPurpose(text: string): string | undefined {
    const lowercaseText = text.toLowerCase();

    // Check all purpose keywords
    for (const [keyword, purpose] of Object.entries(PURPOSE_KEYWORDS)) {
      if (lowercaseText.includes(keyword)) {
        return purpose;
      }
    }

    return undefined;
  }

  // Extract urgency from text
  private static extractUrgency(text: string): 'Normal' | 'Urgent' {
    const lowercaseText = text.toLowerCase();

    // Check all urgency keywords
    for (const [keyword, urgency] of Object.entries(URGENCY_KEYWORDS)) {
      if (lowercaseText.includes(keyword)) {
        return urgency;
      }
    }

    return 'Normal';
  }

  // Advanced multi-department validation with fallback logic
  static validateStockAdvanced(request: Partial<MaterialRequest>): MaterialRequest {
    const validation: MaterialRequest['validation'] = {
      stock_available: true,
      partial_available: false,
      shortfall: [],
      warnings: [],
      missing_info: []
    };

    // Check for missing essential information
    if (!request.materials || request.materials.length === 0) {
      validation.missing_info?.push('Material name not specified');
    }
    if (!request.destination || request.destination === 'Unknown') {
      validation.missing_info?.push('Destination department not specified');
    }
    if (request.materials && request.materials[0]?.requested_qty === 0) {
      validation.missing_info?.push('Quantity not specified');
    }

    // If missing critical info, return pending clarification
    if (validation.missing_info && validation.missing_info.length > 0) {
      return {
        ...request,
        action: 'material_request',
        request_id: `MR-${Date.now()}`,
        requesting_department: request.destination || 'Unknown',
        urgency: request.urgency || 'Normal',
        approval_required: false,
        status: 'Pending Clarification',
        validation,
        next_steps: ['Please provide: ' + validation.missing_info.join(', ')]
      } as MaterialRequest;
    }

    // Multi-warehouse stock validation
    for (const material of request.materials!) {
      const stockData = INVENTORY_STOCK[material.name as keyof typeof INVENTORY_STOCK];

      if (!stockData) {
        validation.warnings?.push(`Material "${material.name}" not found in inventory`);
        validation.stock_available = false;
        material.available_qty = 0;
        material.shortage_qty = material.requested_qty;
        continue;
      }

      const primaryAvailable = stockData.qty;
      const required = material.requested_qty;

      // Update material with availability
      material.available_qty = primaryAvailable;

      if (required > primaryAvailable) {
        // Partial stock available
        validation.partial_available = true;
        material.shortage_qty = required - primaryAvailable;

        // Check secondary warehouses (simulated - in real app would check multiple locations)
        const secondaryLocations: Array<{ location: string; quantity: number }> = [];
        if (stockData.location === 'RM Store A') {
          // Simulate checking RM Store B
          secondaryLocations.push({ location: 'RM Store B', quantity: Math.floor(required * 0.3) });
        }

        validation.shortfall?.push({
          material: material.name,
          required,
          available: primaryAvailable,
          shortage: required - primaryAvailable,
          available_in_secondary: secondaryLocations.length > 0 ? secondaryLocations : undefined
        });

        if (validation.shortfall && validation.shortfall[validation.shortfall.length - 1]?.available_in_secondary) {
          validation.warnings?.push(`${material.name}: Partial stock in ${stockData.location}. Check secondary locations.`);
        } else {
          validation.stock_available = false;
          validation.warnings?.push(`${material.name}: Insufficient stock. Purchase requisition required.`);
        }
      } else {
        material.shortage_qty = 0;
      }

      // Warn if close to reorder level
      const reorderLevel = primaryAvailable * 0.2;
      if (primaryAvailable - required < reorderLevel && primaryAvailable >= required) {
        validation.warnings?.push(`⚠️ ${material.name} will be below reorder level after this transaction`);
      }
    }

    // Determine status
    let status: MaterialRequest['status'] = 'Validated';
    if (validation.partial_available && !validation.stock_available) {
      status = 'Partial Stock';
    } else if (!validation.stock_available) {
      status = 'Insufficient Stock';
    }

    // Determine approval requirements
    let approval_required = false;
    let approval_level: 'supervisor' | 'manager' | 'procurement' = 'supervisor';

    if (request.urgency === 'Urgent') {
      approval_required = true;
      approval_level = 'manager';
    }
    if (status === 'Insufficient Stock') {
      approval_required = true;
      approval_level = 'procurement';
    }

    // Determine next steps
    const next_steps: string[] = [];
    if (status === 'Validated') {
      next_steps.push('✅ Ready to issue materials');
      next_steps.push('📱 Scan QR to confirm pickup');
    } else if (status === 'Partial Stock') {
      next_steps.push('Option 1: Issue available stock now');
      next_steps.push('Option 2: Transfer from secondary warehouse');
      next_steps.push('Option 3: Create purchase requisition for shortage');
    } else if (status === 'Insufficient Stock') {
      next_steps.push('❌ Create purchase requisition');
      next_steps.push('Or adjust production quantity');
    }

    return {
      ...request,
      action: 'material_request',
      request_id: `MR-${Date.now()}`,
      requesting_department: request.destination || 'Unknown',
      urgency: request.urgency || 'Normal',
      approval_required,
      approval_level,
      status,
      validation,
      next_steps
    } as MaterialRequest;
  }

  // Enhanced processing with department-aware logic
  static processRequestAdvanced(text: string, language: string = 'en', userDepartment?: string): MaterialRequest {
    const parsed = this.parseRequest(text);

    // Set requesting department if provided
    if (userDepartment) {
      parsed.requesting_department = userDepartment;
    }

    const validated = this.validateStockAdvanced(parsed);

    // Add automatic notes with department info
    validated.notes = `Request created via AI Assistant in ${language} at ${new Date().toLocaleString()}`;
    if (userDepartment) {
      validated.notes += ` by ${userDepartment}`;
    }

    // Initialize audit trail
    validated.audit_trail = [{
      action: 'created',
      user: userDepartment || 'AI Assistant',
      timestamp: new Date().toISOString()
    }];

    return validated;
  }

  // Generate enhanced response with department routing
  static generateResponseEnhanced(request: MaterialRequest, language: 'en' | 'hi'): string {
    const material = request.materials[0];

    // Handle pending clarification
    if (request.status === 'Pending Clarification') {
      return language === 'en'
        ? `❓ Need More Information\\n\\n${request.validation.missing_info?.join('\\n')}\\n\\nPlease provide these details to create the material request.`
        : `❓ अधिक जानकारी चाहिए\\n\\n${request.validation.missing_info?.join('\\n')}\\n\\nकृपया सामग्री अनुरोध बनाने के लिए ये विवरण प्रदान करें।`;
    }

    // Handle error
    if (request.status === 'Error') {
      return language === 'en'
        ? `❌ Error\\n\\n${request.validation.warnings?.join('\\n')}`
        : `❌ त्रुटि\\n\\n${request.validation.warnings?.join('\\n')}`;
    }

    // Handle partial stock
    if (request.status === 'Partial Stock') {
      const shortfall = request.validation.shortfall?.[0];
      const hasSecondary = shortfall?.available_in_secondary && shortfall.available_in_secondary.length > 0;

      let secondaryInfo = '';
      if (hasSecondary) {
        const secLoc = shortfall!.available_in_secondary![0];
        secondaryInfo = language === 'en'
          ? `\\n\\n📦 Additional Stock Found:\\n${secLoc.location}: ${secLoc.quantity} ${material.uom}`
          : `\\n\\n📦 अतिरिक्त स्टॉक मिला:\\n${secLoc.location}: ${secLoc.quantity} ${material.uom}`;
      }

      return language === 'en'
        ? `⚠️ Partial Stock Available\\n\\nRequest ID: ${request.request_id}\\nMaterial: ${material.name} (${material.material_code})\\nRequired: ${material.requested_qty} ${material.uom}\\nAvailable: ${shortfall?.available} ${material.uom}\\nShortage: ${shortfall?.shortage} ${material.uom}${secondaryInfo}\\n\\n💡 Options:\\n1️⃣ Issue ${shortfall?.available} ${material.uom} now\\n2️⃣ Transfer from secondary warehouse${hasSecondary ? '' : ' (if available)'}\\n3️⃣ Create purchase requisition for ${shortfall?.shortage} ${material.uom}\\n\\nWhat would you like to do?`
        : `⚠️ आंशिक स्टॉक उपलब्ध\\n\\nअनुरोध ID: ${request.request_id}\\nसामग्री: ${material.name} (${material.material_code})\\nआवश्यक: ${material.requested_qty} ${material.uom}\\nउपलब्ध: ${shortfall?.available} ${material.uom}\\nकमी: ${shortfall?.shortage} ${material.uom}${secondaryInfo}\\n\\n💡 विकल्प:\\n1️⃣ अभी ${shortfall?.available} ${material.uom} जारी करें\\n2️⃣ द्वितीयक वेयरहाउस से स्थानांतरण करें\\n3️⃣ ${shortfall?.shortage} ${material.uom} के लिए खरीद अनुरोध बनाएं\\n\\nआप क्या करना चाहेंगे?`;
    }

    // Handle insufficient stock
    if (request.status === 'Insufficient Stock') {
      const shortfall = request.validation.shortfall?.[0];
      return language === 'en'
        ? `❌ Insufficient Stock\\n\\nRequest ID: ${request.request_id}\\nMaterial: ${material.name}\\nRequired: ${material.requested_qty} ${material.uom}\\nAvailable: ${shortfall?.available || 0} ${material.uom}\\nShortage: ${shortfall?.shortage || material.requested_qty} ${material.uom}\\n\\n🛒 Action Required:\\nCreate Purchase Requisition for ${shortfall?.shortage || material.requested_qty} ${material.uom}\\n\\n📋 Approval: ${request.approval_level?.toUpperCase()} level\\n\\nProceed with purchase request? (Yes/No)`
        : `❌ अपर्याप्त स्टॉक\\n\\nअनुरोध ID: ${request.request_id}\\nसामग्री: ${material.name}\\nआवश्यक: ${material.requested_qty} ${material.uom}\\nउपलब्ध: ${shortfall?.available || 0} ${material.uom}\\nकमी: ${shortfall?.shortage || material.requested_qty} ${material.uom}\\n\\n🛒 आवश्यक कार्रवाई:\\n${shortfall?.shortage || material.requested_qty} ${material.uom} के लिए खरीद आवश्यकता बनाएं\\n\\n📋 अनुमोदन: ${request.approval_level?.toUpperCase()} स्तर\\n\\nखरीद अनुरोध के साथ आगे बढ़ें? (हां/नहीं)`;
    }

    // Success - validated
    const urgencyIcon = request.urgency === 'Urgent' ? '🔴 ' : '';
    const sourceInfo = request.source_warehouse ? `\\nFrom: ${request.source_warehouse}` : '';
    const poInfo = request.linked_production_order ? `\\nLinked PO: ${request.linked_production_order}` : '';
    const purposeInfo = request.purpose ? `\\nPurpose: ${request.purpose}` : '';
    const approvalInfo = request.approval_required ? `\\nApproval: ${request.approval_level?.toUpperCase()} required` : '';

    return language === 'en'
      ? `✅ Material Request Created\\n\\nRequest ID: ${urgencyIcon}${request.request_id}\\nType: ${request.request_type.toUpperCase()}\\nDepartment: ${request.requesting_department}\\nMaterial: ${material.name} (${material.material_code})\\nQuantity: ${material.requested_qty} ${material.uom}${sourceInfo}\\nTo: ${request.destination}${poInfo}${purposeInfo}${approvalInfo}\\nStatus: Ready to issue\\n\\n${request.validation.warnings?.length ? '⚠️ Warnings:\\n' + request.validation.warnings.join('\\n') + '\\n\\n' : ''}📱 Next Steps:\\n${request.next_steps?.join('\\n')}`
      : `✅ सामग्री अनुरोध बनाया गया\\n\\nअनुरोध ID: ${urgencyIcon}${request.request_id}\\nप्रकार: ${request.request_type.toUpperCase()}\\nविभाग: ${request.requesting_department}\\nसामग्री: ${material.name} (${material.material_code})\\nमात्रा: ${material.requested_qty} ${material.uom}${sourceInfo}\\nगंतव्य: ${request.destination}${poInfo}${purposeInfo}${approvalInfo}\\nस्थिति: जारी करने के लिए तैयार\\n\\n${request.validation.warnings?.length ? '⚠️ चेतावनी:\\n' + request.validation.warnings.join('\\n') + '\\n\\n' : ''}📱 अगले कदम:\\n${request.next_steps?.join('\\n')}`;
  }
}