import { Search, Filter, Plus, Play, Pause, CheckCircle2, Clock, AlertCircle, Calendar, Package, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { wipApi, type WorkingOrderCreate } from '@/lib/api/wip';
import { purchaseOrdersApi, type PurchaseOrder } from '@/lib/api/production-orders';
import { bomApi } from '@/lib/api/bom';

type WorkingOrderProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

// Standard operations that should appear in every work order

interface WorkOrderOperation {
  name: string;
  id: string; // Added ID for action handling
  completedUnits: number;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  assignedTo: string;
  workstation: string;
  targetUnits: number;
}

const STANDARD_OPERATIONS = [
  'Cutting',
  'Sewing',
  'Assembly',
  'Quality Check',
  'Packing',
  'Finishing'
];

interface WorkOrder {
  id: string;
  workOrderNumber: string; // Added work order number
  purchaseOrderId: string;
  purchaseOrderNumber: string; // Added PO number
  product: string;
  operations: WorkOrderOperation[];
  assignedTo: string;
  quantity: number;
  completedQty: number;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  startTime: string;
  estimatedEnd: string;
  actualEnd?: string;
}

export function WorkingOrder({ language }: WorkingOrderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [poFilter, setPoFilter] = useState<string>('all');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({}); // State for order notes

  // Expanded state for collapsible cards - tracks which work orders are expanded
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  /* New Work Order Modal state */
  const [showNewWorkOrderModal, setShowNewWorkOrderModal] = useState(false);
  const [productionOrders, setProductionOrders] = useState<PurchaseOrder[]>([]);

  // BOM Calculation State
  interface BOMRequirement {
    material_name: string;
    quantity_per_unit: number;
    required_quantity: number;
    unit: string;
    available_stock: number;
    status: 'Sufficient' | 'Low Stock';
  }
  const [bomRequirements, setBomRequirements] = useState<BOMRequirement[]>([]);
  const [isLoadingBOM, setIsLoadingBOM] = useState(false);

  const [newWorkOrderData, setNewWorkOrderData] = useState<{
    purchase_order_id: string;
    product_id?: string; // Added product_id
    operation: string;
    shift: string; // Added shift
    scheduled_start: string; // Added scheduled_start
    target_qty: string;
    unit: string;
    priority: 'Low' | 'Normal' | 'High' | 'Urgent';
    notes: string;
  }>({
    purchase_order_id: '',
    operation: '',
    shift: 'Morning', // Default
    scheduled_start: '',
    target_qty: '',
    unit: 'pcs',
    priority: 'Normal',
    notes: ''
  });
  const [poItems, setPoItems] = useState<any[]>([]); // To store items of selected PO
  const [isCreating, setIsCreating] = useState(false);

  // Toggle expanded state for a work order
  const toggleExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Fetch BOM when Product or Qty changes
  useEffect(() => {
    const fetchBOM = async () => {
      if (!newWorkOrderData.product_id || !newWorkOrderData.target_qty) {
        setBomRequirements([]);
        return;
      }

      const qty = parseFloat(newWorkOrderData.target_qty);
      if (isNaN(qty) || qty <= 0) return;

      setIsLoadingBOM(true);
      try {
        // 1. Get Active BOM for Product
        const bom = await bomApi.getActiveBOMByProduct(newWorkOrderData.product_id);

        // 2. Calculate Requirements
        const materials = await bomApi.getMaterialsWithShortages(bom.id, qty);

        // Map to local state
        const reqs: BOMRequirement[] = materials.map((m) => ({
          material_name: m.material_name,
          quantity_per_unit: m.quantity_per_unit,
          required_quantity: m.required_qty,
          unit: m.unit,
          available_stock: m.available_qty,
          status: m.shortage_status === 'Sufficient' ? 'Sufficient' : 'Low Stock'
        }));

        setBomRequirements(reqs);
      } catch (err) {
        console.error('Failed to fetch BOM requirements:', err);
        setBomRequirements([]);
      } finally {
        setIsLoadingBOM(false);
      }
    };

    const timer = setTimeout(fetchBOM, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [newWorkOrderData.product_id, newWorkOrderData.target_qty]);

  // Fetch work orders from backend API
  const fetchWorkOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch working orders directly without complex transformation
      const workingOrdersData = await wipApi.listWorkingOrders({ limit: 100 });
      const purchaseOrdersData = await purchaseOrdersApi.listOrders({ limit: 100 });

      // Create a simple mapping for purchase orders
      const poMap = new Map<string, any>();
      purchaseOrdersData.forEach(po => {
        if (po && po.id) {
          poMap.set(po.id, {
            productName: po.product_name || 'Unknown Product',
            quantity: po.quantity || 0,
            orderNumber: po.order_number || 'PO-????'
          });
        }
      });

      // Group working orders by work_order_number
      const groupedOrders = new Map<string, typeof workingOrdersData>();

      workingOrdersData.forEach(wo => {
        const woNumber = wo.work_order_number || `WO-${wo.id.substring(0, 4)}`;
        if (!groupedOrders.has(woNumber)) {
          groupedOrders.set(woNumber, []);
        }
        groupedOrders.get(woNumber)?.push(wo);
      });

      // Transform grouped orders
      const transformedOrders: WorkOrder[] = Array.from(groupedOrders.values()).map((group) => {
        const firstOp = group[0]; // Use first operation for common details
        const poInfo = poMap.get(firstOp.purchase_order_id);

        // Create map of existing operations
        const existingOpsMap = new Map();
        group.forEach(wo => {
          if (wo.operation) existingOpsMap.set(wo.operation, wo);
        });

        // Merge with standard operations to ensure all stages are visible
        const operations: WorkOrderOperation[] = STANDARD_OPERATIONS.map(opName => {
          const wo = existingOpsMap.get(opName);

          if (wo) {
            // Existing operation
            const rawStatus = wo.status || 'pending';
            const normalizedStatus = rawStatus.toLowerCase().replace(' ', '-');
            const validStatus = (['pending', 'in-progress', 'completed', 'on-hold'].includes(normalizedStatus)
              ? normalizedStatus
              : 'pending') as 'pending' | 'in-progress' | 'completed' | 'on-hold';

            return {
              name: wo.operation,
              id: wo.id,
              completedUnits: Number(wo.completed_qty) || 0,
              status: validStatus,
              assignedTo: wo.assigned_team || 'Unassigned',
              workstation: wo.workstation_name || `${wo.operation} Station`,
              targetUnits: Number(wo.target_qty) || 0
            };
          } else {
            // Placeholder operation (Not Started)
            return {
              name: opName,
              id: `placeholder-${opName}-${firstOp.id}`, // Temporary ID
              completedUnits: 0,
              status: 'pending',
              assignedTo: 'Unassigned',
              workstation: 'TBD',
              targetUnits: Number(firstOp.target_qty) || 0 // Assume same target as others
            };
          }
        });

        // Add any non-standard operations that might exist (custom operations)
        group.forEach(wo => {
          if (wo.operation && !STANDARD_OPERATIONS.includes(wo.operation)) {
            const rawStatus = wo.status || 'pending';
            const normalizedStatus = rawStatus.toLowerCase().replace(' ', '-');
            const validStatus = (['pending', 'in-progress', 'completed', 'on-hold'].includes(normalizedStatus)
              ? normalizedStatus
              : 'pending') as 'pending' | 'in-progress' | 'completed' | 'on-hold';

            operations.push({
              name: wo.operation,
              id: wo.id,
              completedUnits: Number(wo.completed_qty) || 0,
              status: validStatus,
              assignedTo: wo.assigned_team || 'Unassigned',
              workstation: wo.workstation_name || `${wo.operation} Station`,
              targetUnits: Number(wo.target_qty) || 0
            });
          }
        });

        // Determine aggregate status
        let aggregateStatus: WorkOrder['status'] = 'pending';
        const statuses = operations.map(op => op.status);
        if (statuses.every(s => s === 'completed')) aggregateStatus = 'completed';
        else if (statuses.some(s => s === 'in-progress')) aggregateStatus = 'in-progress';
        else if (statuses.some(s => s === 'completed')) aggregateStatus = 'in-progress'; // Some completed, rest pending/in-progress
        else if (statuses.some(s => s === 'on-hold')) aggregateStatus = 'on-hold';

        // Calculate total stats
        // Assuming quantity is the target quantity of the specific order (usually same across operations or defined by PO)
        // For progress bar: Sum of all completed / Sum of all targets? 
        // Or if it is sequential, target is just ONE target amount?
        // Reference screenshot: "340 of 500 units". 500 seems to be the total target of the order.
        // If we sum targets of 5 ops (each 100), we get 500. So we sum them.

        const totalTarget = operations.reduce((sum, op) => sum + op.targetUnits, 0);
        const totalCompleted = operations.reduce((sum, op) => sum + op.completedUnits, 0);

        return {
          id: firstOp.id, // Use ID of first op as key?? Ideally we need a unique WO ID.
          workOrderNumber: firstOp.work_order_number || `WO-${firstOp.id}`,
          purchaseOrderId: firstOp.purchase_order_id || '',
          purchaseOrderNumber: poInfo?.orderNumber || 'Unknown PO',
          product: poInfo?.productName || 'Unknown Product',
          operations: operations,
          assignedTo: firstOp.assigned_team || 'Unassigned',
          quantity: totalTarget,
          completedQty: totalCompleted,
          status: aggregateStatus,
          priority: (firstOp.priority?.toLowerCase() as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
          startTime: firstOp.scheduled_start || firstOp.created_at || '',
          estimatedEnd: firstOp.scheduled_end || '',
          actualEnd: firstOp.actual_end || undefined
        };
      });

      setWorkOrders(transformedOrders);
    } catch (err: any) {
      console.error('Error fetching work orders:', err);
      setError(err?.detail || err?.message || 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase orders for the dropdown
  const fetchProductionOrders = async () => {
    try {
      const data = await purchaseOrdersApi.listOrders({ limit: 100 });
      setProductionOrders(data);
    } catch (err: any) {
      console.error('Failed to load purchase orders:', err);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchProductionOrders();
  }, []);

  // Get unique purchase order IDs for filter dropdown
  const uniquePOs = [...new Set(workOrders.map(wo => wo.purchaseOrderId))];

  const translations = {
    en: {
      title: 'Working Orders',
      search: 'Search work orders...',
      filter: 'Filter',
      newWorkOrder: 'New Work Order',
      workOrder: 'Work Order',
      productionOrder: 'Purchase Order',
      product: 'Product',
      operation: 'Operation',
      workstation: 'Workstation',
      assignedTo: 'Assigned To',
      quantity: 'Quantity',
      progress: 'Progress',
      status: 'Status',
      priority: 'Priority',
      timeline: 'Timeline',
      actions: 'Actions',
      pending: 'Pending',
      inProgress: 'In Progress',
      completed: 'Completed',
      onHold: 'On Hold',
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      start: 'Start',
      pause: 'Pause',
      complete: 'Complete',
      all: 'All',
      startTime: 'Start',
      estimatedEnd: 'Est. End',
      of: 'of',
      units: 'units',
      overallProgress: 'Overall Progress',
    },
    hi: {
      title: 'कार्य आदेश',
      search: 'कार्य आदेश खोजें...',
      filter: 'फ़िल्टर',
      newWorkOrder: 'नया कार्य आदेश',
      workOrder: 'कार्य आदेश',
      productionOrder: 'उत्पादन आदेश',
      product: 'उत्पाद',
      operation: 'ऑपरेशन',
      workstation: 'वर्कस्टेशन',
      assignedTo: 'को सौंपा गया',
      quantity: 'मात्रा',
      progress: 'प्रगति',
      status: 'स्थिति',
      priority: 'प्राथमिकता',
      timeline: 'समयरेखा',
      actions: 'क्रियाएं',
      pending: 'लंबित',
      inProgress: 'प्रगति में',
      completed: 'पूर्ण',
      onHold: 'रुका हुआ',
      low: 'कम',
      normal: 'सामान्य',
      high: 'उच्च',
      urgent: 'तत्काल',
      start: 'शुरू',
      pause: 'रोकें',
      complete: 'पूर्ण करें',
      all: 'सभी',
      startTime: 'शुरू',
      estimatedEnd: 'अनु. समाप्ति',
      of: 'का',
      units: 'यूनिट',
      overallProgress: 'कुल प्रगति',
    },
    kn: {
      title: 'ಕೆಲಸದ ಆದೇಶಗಳು',
      search: 'ಕೆಲಸದ ಆದೇಶಗಳನ್ನು ಹುಡುಕಿ...',
      filter: 'ಫಿಲ್ಟರ್',
      newWorkOrder: 'ಹೊಸ ಕೆಲಸದ ಆದೇಶ',
      workOrder: 'ಕೆಲಸದ ಆದೇಶ',
      productionOrder: 'ಉತ್ಪಾದನಾ ಆದೇಶ',
      product: 'ಉತ್ಪನ್ನ',
      operation: 'ಕಾರ್ಯಾಚರಣೆ',
      workstation: 'ವರ್ಕ್‌ಸ್ಟೇಷನ್',
      assignedTo: 'ನಿಯೋಜಿಸಲಾಗಿದೆ',
      quantity: 'ಪ್ರಮಾಣ',
      progress: 'ಪ್ರಗತಿ',
      status: 'ಸ್ಥಿತಿ',
      priority: 'ಆದ್ಯತೆ',
      timeline: 'ಸಮಯರೇಖೆ',
      actions: 'ಕ್ರಿಯೆಗಳು',
      pending: 'ಬಾಕಿ',
      inProgress: 'ಪ್ರಗತಿಯಲ್ಲಿದೆ',
      completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
      onHold: 'ಹೋಲ್ಡ್‌ನಲ್ಲಿ',
      low: 'ಕಡಿಮೆ',
      normal: 'ಸಾಮಾನ್ಯ',
      high: 'ಹೆಚ್ಚು',
      urgent: 'ತುರ್ತು',
      start: 'ಪ್ರಾರಂಭಿಸಿ',
      pause: 'ವಿರಾಮ',
      complete: 'ಪೂರ್ಣಗೊಳಿಸಿ',
      all: 'ಎಲ್ಲಾ',
      startTime: 'ಪ್ರಾರಂಭ',
      estimatedEnd: 'ಅಂದಾಜು ಅಂತ್ಯ',
      of: 'ರಲ್ಲಿ',
      units: 'ಯೂನಿಟ್‌ಗಳು',
      overallProgress: 'ಸಮಗ್ರ ಪ್ರಗತಿ',
    },
    ta: {
      title: 'வேலை ஆணைகள்',
      search: 'வேலை ஆணைகளைத் தேடு...',
      filter: 'வடிகட்டி',
      newWorkOrder: 'புதிய வேலை ஆணை',
      workOrder: 'வேலை ஆணை',
      productionOrder: 'உற்பத்தி ஆணை',
      product: 'பொருள்',
      operation: 'செயல்பாடு',
      workstation: 'பணிநிலையம்',
      assignedTo: 'ஒதுக்கப்பட்டது',
      quantity: 'அளவு',
      progress: 'முன்னேற்றம்',
      status: 'நிலை',
      priority: 'முன்னுரிமை',
      timeline: 'காலவரிசை',
      actions: 'செயல்கள்',
      pending: 'நிலுவையில்',
      inProgress: 'நடைபெறுகிறது',
      completed: 'முடிந்தது',
      onHold: 'நிறுத்தப்பட்டது',
      low: 'குறைவு',
      normal: 'சாதாரண',
      high: 'அதிக',
      urgent: 'அவசர',
      start: 'தொடங்கு',
      pause: 'இடைநிறுத்து',
      complete: 'முடி',
      all: 'அனைத்தும்',
      startTime: 'தொடக்கம்',
      estimatedEnd: 'மதிப்பிடப்பட்ட முடிவு',
      of: 'இல்',
      units: 'அலகுகள்',
      overallProgress: 'மொத்த முன்னேற்றம்',
    },
    te: {
      title: 'పని ఆదేశాలు',
      search: 'పని ఆదేశాలను శోధించండి...',
      filter: 'ఫిల్టర్',
      newWorkOrder: 'కొత్త పని ఆదేశం',
      workOrder: 'పని ఆదేశం',
      productionOrder: 'ఉత్పత్తి ఆదేశం',
      product: 'ఉత్పత్తి',
      operation: 'ఆపరేషన్',
      workstation: 'వర్క్‌స్టేషన్',
      assignedTo: 'కేటాయించబడింది',
      quantity: 'పరిమాణం',
      progress: 'పురోగతి',
      status: 'స్థితి',
      priority: 'ప్రాధాన్యత',
      timeline: 'టైమ్‌లైన్',
      actions: 'చర్యలు',
      pending: 'పెండింగ్',
      inProgress: 'ప్రోగ్రెస్‌లో',
      completed: 'పూర్తయింది',
      onHold: 'హోల్డ్‌లో',
      low: 'తక్కువ',
      normal: 'సాధారణ',
      high: 'అధిక',
      urgent: 'అత్యవసర',
      start: 'ప్రారంభించు',
      pause: 'పాజ్',
      complete: 'పూర్తి చేయి',
      all: 'అన్నీ',
      startTime: 'ప్రారంభం',
      estimatedEnd: 'అంచనా ముగింపు',
      of: 'లో',
      units: 'యూనిట్లు',
      overallProgress: 'సమస్త పురోగతి',
    },
    mr: {
      title: 'कार्य आदेश',
      search: 'कार्य आदेश शोधा...',
      filter: 'फिल्टर',
      newWorkOrder: 'नवीन कार्य आदेश',
      workOrder: 'कार्य आदेश',
      productionOrder: 'उत्पादन आदेश',
      product: 'उत्पाद',
      operation: 'ऑपरेशन',
      workstation: 'वर्कस्टेशन',
      assignedTo: 'नियुक्त',
      quantity: 'प्रमाण',
      progress: 'प्रगती',
      status: 'स्थिती',
      priority: 'प्राधान्य',
      timeline: 'टाइमलाइन',
      actions: 'क्रिया',
      pending: 'प्रलंबित',
      inProgress: 'प्रगतीत',
      completed: 'पूर्ण',
      onHold: 'थांबलेले',
      low: 'कमी',
      normal: 'सामान्य',
      high: 'उच्च',
      urgent: 'तातडीचे',
      start: 'सुरू करा',
      pause: 'थांबवा',
      complete: 'पूर्ण करा',
      all: 'सर्व',
      startTime: 'सुरुवात',
      estimatedEnd: 'अंदाजे शेवट',
      of: 'पैकी',
      units: 'युनिट्स',
      overallProgress: 'एकूण प्रगती',
    },
    gu: {
      title: 'કામના ઓર્ડર',
      search: 'કામના ઓર્ડર શોધો...',
      filter: 'ફિલ્ટર',
      newWorkOrder: 'નવો કામનો ઓર્ડર',
      workOrder: 'કામનો ઓર્ડર',
      productionOrder: 'ઉત્પાદન ઓર્ડર',
      product: 'ઉત્પાદન',
      operation: 'ઓપરેશન',
      workstation: 'વર્કસ્ટેશન',
      assignedTo: 'સોંપાયેલ',
      quantity: 'જથ્થો',
      progress: 'પ્રગતિ',
      status: 'સ્થિતિ',
      priority: 'પ્રાથમિકતા',
      timeline: 'ટાઇમલાઇન',
      actions: 'ક્રિયાઓ',
      pending: 'બાકી',
      inProgress: 'પ્રગતિમાં',
      completed: 'પૂર્ણ',
      onHold: 'હોલ્ડ પર',
      low: 'ઓછી',
      normal: 'સામાન્ય',
      high: 'ઉચ્ચ',
      urgent: 'તાત્કાલિક',
      start: 'શરૂ કરો',
      pause: 'રોકો',
      complete: 'પૂર્ણ કરો',
      all: 'બધા',
      startTime: 'શરૂઆત',
      estimatedEnd: 'અંદાજિત અંત',
      of: 'માંથી',
      units: 'યુનિટ્સ',
      overallProgress: 'કુલ પ્રગતિ',
    },
    pa: {
      title: 'ਕੰਮ ਦੇ ਆਦੇਸ਼',
      search: 'ਕੰਮ ਦੇ ਆਦੇਸ਼ ਖੋਜੋ...',
      filter: 'ਫਿਲਟਰ',
      newWorkOrder: 'ਨਵਾਂ ਕੰਮ ਦਾ ਆਦੇਸ਼',
      workOrder: 'ਕੰਮ ਦਾ ਆਦੇਸ਼',
      productionOrder: 'ਉਤਪਾਦਨ ਆਦੇਸ਼',
      product: 'ਉਤਪਾਦ',
      operation: 'ਓਪਰੇਸ਼ਨ',
      workstation: 'ਵਰਕਸਟੇਸ਼ਨ',
      assignedTo: 'ਸੌਂਪਿਆ ਗਿਆ',
      quantity: 'ਮਾਤਰਾ',
      progress: 'ਤਰੱਕੀ',
      status: 'ਸਥਿਤੀ',
      priority: 'ਤਰਜੀਹ',
      timeline: 'ਟਾਈਮਲਾਈਨ',
      actions: 'ਕਾਰਵਾਈਆਂ',
      pending: 'ਬਕਾਇਆ',
      inProgress: 'ਜਾਰੀ',
      completed: 'ਪੂਰਾ',
      onHold: 'ਹੋਲਡ ਤੇ',
      low: 'ਘੱਟ',
      normal: 'ਸਾਧਾਰਨ',
      high: 'ਉੱਚ',
      urgent: 'ਜ਼ਰੂਰੀ',
      start: 'ਸ਼ੁਰੂ ਕਰੋ',
      pause: 'ਰੋਕੋ',
      complete: 'ਪੂਰਾ ਕਰੋ',
      all: 'ਸਾਰੇ',
      startTime: 'ਸ਼ੁਰੂਆਤ',
      estimatedEnd: 'ਅਨੁਮਾਨਿਤ ਅੰਤ',
      of: 'ਵਿੱਚੋਂ',
      units: 'ਯੂਨਿਟ',
      overallProgress: 'ਕੁਲ ਤਰੱਕੀ',
    },
  };

  const t = translations[language];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      'pending': { color: 'bg-zinc-500', label: t.pending },
      'in-progress': { color: 'bg-blue-500', label: t.inProgress },
      'completed': { color: 'bg-emerald-500', label: t.completed },
      'on-hold': { color: 'bg-amber-500', label: t.onHold },
      // Add fallbacks for other common statuses
      'planned': { color: 'bg-zinc-500', label: t.pending },
      'cancelled': { color: 'bg-rose-500', label: 'Cancelled' },
      'draft': { color: 'bg-zinc-400', label: 'Draft' },
    };

    // Normalize status key
    const normalizedStatus = status?.toLowerCase().replace(' ', '-') || 'pending';
    const config = statusConfig[normalizedStatus] || statusConfig['pending'];

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredOrders = workOrders.filter(order => {
    const matchesSearch =
      order.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.operations.some(op => op.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.purchaseOrderNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPO = poFilter === 'all' || order.purchaseOrderId === poFilter;

    return matchesSearch && matchesStatus && matchesPO;
  });

  const handleAction = async (action: string, groupedOrderId: string) => {
    const order = workOrders.find(o => o.id === groupedOrderId);
    if (!order) return;

    try {
      let targetOpId: string | null = null;
      let status: 'Pending' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
      let updateData: any = {};

      // Identify target operation based on action and current state
      if (action === 'start') {
        // Find first pending or on-hold operation
        const op = order.operations.find(op => op.status === 'pending' || op.status === 'on-hold');
        if (op) {
          targetOpId = op.id;
          status = 'In Progress';
          updateData = { status, actual_start: new Date().toISOString() };
        }
      } else if (action === 'pause') {
        // Find first in-progress operation
        const op = order.operations.find(op => op.status === 'in-progress');
        if (op) {
          targetOpId = op.id;
          status = 'On Hold';
          updateData = { status, notes: orderNotes[order.id] };
        }
      } else if (action === 'complete') {
        // Find first in-progress operation
        const op = order.operations.find(op => op.status === 'in-progress');
        if (op) {
          targetOpId = op.id;
          status = 'Completed';
          updateData = {
            status,
            actual_end: new Date().toISOString(),
            completed_qty: op.targetUnits // Auto-fill quantity? Or let backend handle?
          };
        }
      }

      if (!targetOpId) {
        // If no specific operation targeted, maybe user clicked main button but state changed?
        // Fallback: Use the grouped ID (first op ID) if safe? No, risky.
        console.warn("No suitable operation found for action:", action);
        return;
      }

      // Update the specific operation
      await wipApi.updateWorkingOrder(targetOpId, updateData);

      // Refresh the work orders list
      await fetchWorkOrders();
    } catch (err: any) {
      alert(`❌ ${language === 'en' ? 'Error' : 'त्रुटि'}: ${err?.detail || err?.message || 'Failed to update work order'}`);
    }
  };

  // Create new work order
  // Fetch BOM when Product or Qty changes
  useEffect(() => {
    const fetchBOM = async () => {
      if (!newWorkOrderData.product_id || !newWorkOrderData.target_qty) {
        setBomRequirements([]);
        return;
      }

      const qty = parseFloat(newWorkOrderData.target_qty);
      if (isNaN(qty) || qty <= 0) return;

      setIsLoadingBOM(true);
      try {
        // 1. Get Active BOM for Product
        console.log("Fetching BOM for product:", newWorkOrderData.product_id);
        const bom = await bomApi.getActiveBOMByProduct(newWorkOrderData.product_id);
        console.log("BOM fetched:", bom);

        if (!bom || !bom.id) {
          console.warn('No active BOM found for product');
          setBomRequirements([]);
          return;
        }

        // 2. Calculate Requirements (using API or local if API fails/is overkill)
        // We use getMaterialsWithShortages to get stock info too
        const materials = await bomApi.getMaterialsWithShortages(bom.id, qty);
        console.log("BOM Materials Response:", materials);

        // Map to local state - PARANOID CHECK: Ensure materials is an array
        const safeMaterials = Array.isArray(materials) ? materials : [];

        const reqs: BOMRequirement[] = safeMaterials.map(m => ({
          material_name: m.material_name,
          quantity_per_unit: m.quantity_per_unit,
          required_quantity: m.required_qty,
          unit: m.unit,
          available_stock: m.available_qty,
          status: m.shortage_status === 'Sufficient' ? 'Sufficient' : 'Low Stock'
        }));

        setBomRequirements(reqs);
      } catch (err) {
        console.error('Failed to fetch BOM requirements:', err);
        setBomRequirements([]);
      } finally {
        setIsLoadingBOM(false);
      }
    };

    const timer = setTimeout(fetchBOM, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [newWorkOrderData.product_id, newWorkOrderData.target_qty]);

  const handleCreateWorkOrder = async () => {
    if (!newWorkOrderData.purchase_order_id || !newWorkOrderData.operation || !newWorkOrderData.target_qty) {
      alert(language === 'en'
        ? '⚠️ Please fill in required fields (Purchase Order, Operation, Target Quantity)'
        : '⚠️ कृपया आवश्यक फ़ील्ड भरें (खरीद आदेश, ऑपरेशन, लक्ष्य मात्रा)');
      return;
    }

    setIsCreating(true);
    try {
      const payload: WorkingOrderCreate = {
        purchase_order_id: newWorkOrderData.purchase_order_id,
        product_id: newWorkOrderData.product_id, // Pass product_id
        operation: newWorkOrderData.operation,
        shift: newWorkOrderData.shift, // Pass shift
        scheduled_start: newWorkOrderData.scheduled_start ? newWorkOrderData.scheduled_start : undefined, // Check if empty
        workstation_name: 'Pending Assignment', // Default
        assigned_team: 'Pending Assignment', // Default
        target_qty: parseFloat(newWorkOrderData.target_qty),
        unit: newWorkOrderData.unit,
        priority: newWorkOrderData.priority,
        notes: newWorkOrderData.notes || undefined
      };

      const createdOrder = await wipApi.createWorkingOrder(payload);

      alert(`✅ ${language === 'en' ? 'Work Order Created!' : 'कार्य आदेश बनाया गया!'}\n\n${language === 'en' ? 'Work Order Number' : 'कार्य आदेश नंबर'}: ${createdOrder.work_order_number}`);

      setShowNewWorkOrderModal(false);
      setNewWorkOrderData({
        purchase_order_id: '',
        operation: '',
        shift: 'Morning',
        scheduled_start: '',
        target_qty: '',
        unit: 'pcs',
        priority: 'Normal',
        notes: ''
      });
      // Clear selected PO items
      setPoItems([]);
      fetchWorkOrders(); // Refresh the list
    } catch (err: any) {
      alert(`❌ ${language === 'en' ? 'Error creating work order' : 'कार्य आदेश बनाने में त्रुटि'}: ${err?.detail || err?.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setShowNewWorkOrderModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.newWorkOrder}
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder={t.search}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="px-4 py-2 border border-zinc-200 rounded-lg bg-white text-sm"
            value={poFilter}
            onChange={(e) => setPoFilter(e.target.value)}
          >
            <option value="all">{t.productionOrder}: {t.all}</option>
            {uniquePOs.map(po => (
              <option key={po} value={po}>{po}</option>
            ))}
          </select>
          <select
            className="px-4 py-2 border border-zinc-200 rounded-lg bg-white text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t.status}: {t.all}</option>
            <option value="pending">{t.pending}</option>
            <option value="in-progress">{t.inProgress}</option>
            <option value="completed">{t.completed}</option>
            <option value="on-hold">{t.onHold}</option>
          </select>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            {t.filter}
          </Button>
        </div>
      </div>

      {/* Work Orders Grid - Collapsible Cards */}
      <div className="grid gap-4">
        {filteredOrders.map((order) => {
          const isExpanded = expandedOrders.has(order.id);

          // Calculate overall progress for single operation
          const totalCompletedUnits = order.operations.reduce((sum, op) => sum + op.completedUnits, 0);
          const overallProgressPercent = order.quantity > 0
            ? Math.round((totalCompletedUnits / order.quantity) * 100)
            : 0;

          return (
            <Card key={order.id} className="overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
              {/* Collapsed Header - Always Visible */}
              <div
                className="p-6 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                onClick={() => toggleExpanded(order.id)}
              >
                <div className="flex flex-col gap-6">

                  {/* Top Row: WO Number, Status, PO Number */}
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100">
                          {order.workOrderNumber}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-sm text-zinc-500">
                        {t.productionOrder}: {order.purchaseOrderNumber}
                      </div>
                    </div>

                    {/* Expand/Collapse Button */}
                    <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-zinc-500" />
                      )}
                    </button>
                  </div>

                  {/* Product Info Row */}
                  <div className="flex items-center gap-2.5 text-[15px] font-medium text-zinc-700 dark:text-zinc-300">
                    <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-500">
                      <Package className="h-4 w-4" />
                    </div>
                    {order.product}
                  </div>

                  {/* Expanded Content or Mini Progress */}
                  {isExpanded ? (
                    <div className="mt-4 space-y-6 animate-in slide-in-from-top-2 duration-200">

                      {/* Operation Progress Cards */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                          {language === 'en' ? 'Operation Progress' : 'ऑपरेशन प्रगति'}
                        </h4>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                          {order.operations.map((op, idx) => {
                            const opPercent = op.targetUnits > 0 ? Math.round((op.completedUnits / op.targetUnits) * 100) : 0;
                            return (
                              <div
                                key={idx}
                                className={`
                                    relative p-3 rounded-xl border transition-all shadow-sm min-w-[240px] flex-1
                                    ${op.status === 'completed' ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' :
                                    op.status === 'in-progress' ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' :
                                      'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}
                                  `}
                              >
                                <div className="flex flex-col items-center text-center gap-2">
                                  <span className="font-semibold text-xs text-zinc-900 line-clamp-1">{op.name}</span>

                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold tracking-tight">{op.completedUnits}</span>
                                    <span className="text-[10px] text-zinc-500 font-medium">{t.units}</span>
                                  </div>

                                  <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden mt-1">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${op.status === 'completed' ? 'bg-emerald-500' :
                                        op.status === 'in-progress' ? 'bg-blue-500' : 'bg-zinc-300'
                                        }`}
                                      style={{ width: `${opPercent}%` }}
                                    />
                                  </div>

                                  <div className="text-[10px] text-zinc-500 mt-0.5">
                                    {opPercent}% {t.of} {op.targetUnits}
                                  </div>

                                  <div className="flex flex-col gap-0.5 text-[10px] text-zinc-500 mt-1.5 w-full text-left bg-white/50 dark:bg-black/20 p-1.5 rounded-md">
                                    <span className="flex justify-between"><span>{t.workstation}:</span> <strong className="text-zinc-700 dark:text-zinc-300 truncate ml-1">{op.workstation}</strong></span>
                                    <span className="flex justify-between"><span>{t.assignedTo}:</span> <strong className="text-zinc-700 dark:text-zinc-300 truncate ml-1">{op.assignedTo}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Overall Progress & Timeline */}
                      <div className="space-y-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500 font-medium">{t.overallProgress}</span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {totalCompletedUnits.toFixed(1)} {t.of} {order.quantity.toFixed(1)} {t.units} ({overallProgressPercent}%)
                            </span>
                          </div>
                          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${overallProgressPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-zinc-500 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-zinc-400" />
                            <span>{t.startTime}: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{order.startTime ? new Date(order.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Not set'}</span></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            <span>{t.estimatedEnd}: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{order.estimatedEnd ? new Date(order.estimatedEnd).toLocaleDateString() : 'Not set'}</span></span>
                          </div>
                        </div>

                        {/* Action Buttons - Bottom Layout */}
                        <div className="flex flex-col gap-3 pt-2">
                          <Input
                            placeholder={language === 'en' ? 'Add notes or pause reason...' : 'नोट्स या विराम का कारण जोड़ें...'}
                            value={orderNotes[order.id] || ''}
                            onChange={(e) => setOrderNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                            className="bg-white"
                          />

                          {order.status === 'pending' && (
                            <Button
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-12 text-base font-medium rounded-xl"
                              onClick={(e) => { e.stopPropagation(); handleAction('start', order.id); }}
                            >
                              <Play className="h-5 w-5 mr-2" />
                              {t.start}
                            </Button>
                          )}

                          {order.status === 'in-progress' && (
                            <div className="flex gap-3">
                              <Button
                                variant="outline"
                                className="flex-1 text-zinc-600 border-zinc-200 hover:bg-zinc-50 h-12 text-base font-medium rounded-xl"
                                onClick={(e) => { e.stopPropagation(); handleAction('pause', order.id); }}
                              >
                                <Pause className="h-5 w-5 mr-2" />
                                {t.pause}
                              </Button>
                              <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-12 text-base font-medium rounded-xl"
                                onClick={(e) => { e.stopPropagation(); handleAction('complete', order.id); }}
                              >
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                {t.complete}
                              </Button>
                            </div>
                          )}

                          {order.status === 'on-hold' && (
                            <Button
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-12 text-base font-medium rounded-xl"
                              onClick={(e) => { e.stopPropagation(); handleAction('start', order.id); }}
                            >
                              <Play className="h-5 w-5 mr-2" />
                              {t.start}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Collapsed View - Progress Summary
                    <div className="mt-4">
                      {/* Collapsed view progress hidden as requested */}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-500">
            {language === 'en' ? 'No work orders found' : 'कोई कार्य आदेश नहीं मिला'}
          </p>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-500">
            {language === 'en' ? 'Loading work orders...' : 'कार्य आदेश लोड हो रहे हैं...'}
          </p>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-8 text-center border-red-200 bg-red-50">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchWorkOrders} className="mt-4" variant="outline">
            {language === 'en' ? 'Retry' : 'पुनः प्रयास करें'}
          </Button>
        </Card>
      )}

      {/* New Work Order Modal */}
      {showNewWorkOrderModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowNewWorkOrderModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-white p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {language === 'en' ? 'Create New Work Order' : 'नया कार्य आदेश बनाएं'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowNewWorkOrderModal(false)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>

              {/* Purchase Order Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.productionOrder} <span className="text-red-500">*</span>
                </label>
                <select
                  value={newWorkOrderData.purchase_order_id}
                  onChange={async (e) => {
                    const poId = e.target.value;
                    setNewWorkOrderData(prev => ({ ...prev, purchase_order_id: poId }));
                    if (poId) {
                      try {
                        const poDetails = await purchaseOrdersApi.getOrder(poId);
                        // Handle both Multi-SKU (items) and Single-SKU (main product)
                        if (poDetails.items && Array.isArray(poDetails.items) && poDetails.items.length > 0) {
                          setPoItems(poDetails.items);
                        } else if (poDetails.product_id) {
                          // Fallback for single-SKU orders
                          setPoItems([{
                            product_id: poDetails.product_id,
                            product_code: poDetails.product_code || 'SKU',
                            product_name: poDetails.product_name,
                            quantity: poDetails.quantity,
                            unit: poDetails.unit
                          }]);
                        } else {
                          setPoItems([]);
                        }
                      } catch (err) {
                        console.error("Failed to fetch PO items", err);
                        setPoItems([]);
                      }
                    } else {
                      setPoItems([]);
                    }
                  }}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="">{language === 'en' ? 'Select Purchase Order...' : 'खरीद आदेश चुनें...'}</option>
                  {productionOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.order_number} - {po.product_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product/SKU Selection */}
              {Array.isArray(poItems) && poItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {language === 'en' ? 'Product / SKU' : 'उत्पाद / SKU'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full p-2 border border-zinc-300 rounded-md"
                    onChange={(e) => {
                      const selectedCode = e.target.value;
                      // Safe check for poItems
                      if (!Array.isArray(poItems)) return;

                      const selectedItem = poItems.find(item => item && item.product_code === selectedCode);
                      if (selectedItem) {
                        console.log("Selected PO Item:", selectedItem);
                        // Set product_id explicitly so backend links WO to this SKU
                        setNewWorkOrderData(prev => ({
                          ...prev,
                          product_id: selectedItem.product_id, // Ensure this exists on item
                          unit: selectedItem.unit || 'pcs',
                          target_qty: selectedItem.quantity ? String(selectedItem.quantity) : prev.target_qty,
                          notes: prev.notes // Keep notes logic as backup/visual
                            ? `${prev.notes}\nSelected SKU: ${selectedCode} - ${selectedItem.product_name || ''}`
                            : `Selected SKU: ${selectedCode} - ${selectedItem.product_name || ''}`
                        }));
                      } else {
                        console.warn("Item not found in poItems for code:", selectedCode);
                      }
                    }}
                  >
                    <option value="">{language === 'en' ? 'Select Product from PO...' : 'PO उत्पाद चुनें...'}</option>
                    {poItems.map((item, idx) => (
                      <option key={idx} value={item?.product_code || ''}>
                        {item?.product_code || 'Unique SKU'} - {item?.product_name || 'Item'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Operation */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.operation} <span className="text-red-500">*</span>
                </label>
                <select
                  value={newWorkOrderData.operation}
                  onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, operation: e.target.value }))}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="">{language === 'en' ? 'Select Operation...' : 'ऑपरेशन चुनें...'}</option>
                  <option value="Cutting">{language === 'en' ? 'Cutting' : 'कटाई'}</option>
                  <option value="Sewing">{language === 'en' ? 'Sewing' : 'सिलाई'}</option>
                  <option value="Assembly">{language === 'en' ? 'Assembly' : 'असेंबली'}</option>
                  <option value="Quality Check">{language === 'en' ? 'Quality Check' : 'गुणवत्ता जांच'}</option>
                  <option value="Packaging">{language === 'en' ? 'Packaging' : 'पैकेजिंग'}</option>
                  <option value="Finishing">{language === 'en' ? 'Finishing' : 'फिनिशिंग'}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Shift */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {language === 'en' ? 'Shift' : 'शिफ्ट'}
                  </label>
                  <select
                    value={newWorkOrderData.shift}
                    onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, shift: e.target.value }))}
                    className="w-full p-2 border border-zinc-300 rounded-md"
                  >
                    <option value="Morning">{language === 'en' ? 'Morning' : 'सुबह'}</option>
                    <option value="Evening">{language === 'en' ? 'Evening' : 'शाम'}</option>
                    <option value="Night">{language === 'en' ? 'Night' : 'रात'}</option>
                  </select>
                </div>

                {/* Start Date & Time */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {language === 'en' ? 'Start Date & Time' : 'प्रारंभ तिथि और समय'}
                  </label>
                  <Input
                    type="datetime-local"
                    value={newWorkOrderData.scheduled_start}
                    onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, scheduled_start: e.target.value }))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Target Quantity */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.quantity} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={newWorkOrderData.target_qty}
                    onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, target_qty: e.target.value }))}
                    placeholder={language === 'en' ? 'Enter quantity' : 'मात्रा दर्ज करें'}
                    className="flex-1"
                  />
                  <select
                    value={newWorkOrderData.unit}
                    onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-24 p-2 border border-zinc-300 rounded-md"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="m">m</option>
                    <option value="units">units</option>
                  </select>
                </div>
              </div>

              {/* BOM Requirements Table */}
              {newWorkOrderData.product_id && (
                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                  <h4 className="text-sm font-medium text-zinc-700 mb-2 flex items-center justify-between">
                    <span>{language === 'en' ? 'Raw Material Requirements' : 'कच्चे माल की आवश्यकताएं'}</span>
                    {isLoadingBOM && <span className="text-xs text-zinc-500 animate-pulse">Calculating...</span>}
                  </h4>

                  {bomRequirements.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 text-left text-zinc-500">
                            <th className="pb-2 font-medium">Material</th>
                            <th className="pb-2 font-medium text-right">Required</th>
                            <th className="pb-2 font-medium text-right">Available</th>
                            <th className="pb-2 font-medium text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {bomRequirements.map((req, idx) => (
                            <tr key={idx}>
                              <td className="py-2 text-zinc-700">{req.material_name}</td>
                              <td className="py-2 text-right font-medium">
                                {req.required_quantity.toFixed(2)} {req.unit}
                              </td>
                              <td className="py-2 text-right text-zinc-500">
                                {req.available_stock.toFixed(2)} {req.unit}
                              </td>
                              <td className="py-2 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${req.status === 'Sufficient'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                                  }`}>
                                  {req.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    !isLoadingBOM && <p className="text-xs text-zinc-400 italic text-center py-2">
                      {language === 'en' ? 'No BOM found for this product.' : 'इस उत्पाद के लिए कोई BOM नहीं मिला।'}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {language === 'en' ? 'Notes' : 'नोट्स'}
                </label>
                <textarea
                  value={newWorkOrderData.notes}
                  onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                  rows={3}
                  placeholder={language === 'en' ? 'Add notes...' : 'नोट्स जोड़ें...'}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowNewWorkOrderModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button
                  onClick={handleCreateWorkOrder}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={isCreating}
                >
                  {isCreating
                    ? (language === 'en' ? 'Creating...' : 'बना रहे हैं...')
                    : (language === 'en' ? 'Create Work Order' : 'कार्य आदेश बनाएं')}
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
