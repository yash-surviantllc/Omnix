import { Search, Filter, Plus, Play, Pause, CheckCircle2, Clock, AlertCircle, Calendar, Package, XCircle, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { wipApi, type WorkingOrderCreate } from '@/lib/api/wip';
import { purchaseOrdersApi, type PurchaseOrder } from '@/lib/api/production-orders';

type WorkingOrderProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

// Standard operations that should appear in every work order
const STANDARD_OPERATIONS = ['Cutting', 'Sewing', 'Finishing', 'Quality Check', 'Packing'];

interface WorkOrderOperation {
  name: string;
  completedUnits: number;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  assignedTo: string;
  workstation: string;
  targetUnits: number;
}

interface WorkOrder {
  id: string;
  productionOrderId: string;
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
  
  // Expanded state for collapsible cards - tracks which work orders are expanded
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  // New Work Order Modal state
  const [showNewWorkOrderModal, setShowNewWorkOrderModal] = useState(false);
  const [productionOrders, setProductionOrders] = useState<PurchaseOrder[]>([]);
  const [newWorkOrderData, setNewWorkOrderData] = useState({
    production_order_id: '',
    operation: '',
    workstation: '',
    assigned_team: '',
    target_qty: '',
    unit: 'pcs',
    priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Urgent',
    scheduled_start: '',
    scheduled_end: '',
    notes: ''
  });
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

  // Fetch work orders from backend API
  const fetchWorkOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await wipApi.listWorkingOrders({ limit: 100 });
      const poData = await purchaseOrdersApi.listOrders({ limit: 100 });
      
      // Create a map of production order ID to product name
      const poProductMap = new Map<string, { productName: string; quantity: number }>();
      poData.forEach(po => {
        poProductMap.set(po.id, { 
          productName: po.product_name, 
          quantity: po.quantity 
        });
      });
      
      // Group work orders by production_order_id
      const groupedByPO = new Map<string, typeof data>();
      data.forEach(wo => {
        const existing = groupedByPO.get(wo.production_order_id) || [];
        existing.push(wo);
        groupedByPO.set(wo.production_order_id, existing);
      });
      
      // Transform grouped data into WorkOrder format with all standard operations
      const transformedOrders: WorkOrder[] = [];
      let workOrderCounter = 1;
      
      groupedByPO.forEach((operations, productionOrderId) => {
        // Get product info from PO
        const poInfo = poProductMap.get(productionOrderId);
        const productName = poInfo?.productName || 'Unknown Product';
        const targetQty = poInfo?.quantity || operations[0]?.target_qty || 0;
        
        // Create operation map from actual data
        const operationMap = new Map<string, typeof operations[0]>();
        operations.forEach(op => {
          operationMap.set(op.operation, op);
        });
        
        // Build operations array with all standard operations
        const allOperations: WorkOrderOperation[] = STANDARD_OPERATIONS.map(opName => {
          const existingOp = operationMap.get(opName);
          if (existingOp) {
            return {
              name: opName,
              completedUnits: existingOp.completed_qty,
              status: existingOp.status.toLowerCase().replace(' ', '-') as 'pending' | 'in-progress' | 'completed' | 'on-hold',
              assignedTo: existingOp.assigned_team || 'Unassigned',
              workstation: existingOp.workstation || `${opName} Station`,
              targetUnits: existingOp.target_qty
            };
          } else {
            // Default empty operation
            return {
              name: opName,
              completedUnits: 0,
              status: 'pending' as const,
              assignedTo: 'Unassigned',
              workstation: `${opName} Station`,
              targetUnits: targetQty
            };
          }
        });
        
        // Get last operation for final completion count
        const lastOperation = allOperations[allOperations.length - 1]; // Packing is the final stage
        
        // Determine overall status based on operations
        let overallStatus: 'pending' | 'in-progress' | 'completed' | 'on-hold' = 'pending';
        const hasInProgress = allOperations.some(op => op.status === 'in-progress');
        const hasCompleted = allOperations.some(op => op.completedUnits > 0);
        const allCompleted = lastOperation.completedUnits >= targetQty;
        
        if (allCompleted) {
          overallStatus = 'completed';
        } else if (hasInProgress) {
          overallStatus = 'in-progress';
        } else if (hasCompleted) {
          overallStatus = 'in-progress';
        }
        
        // Get first operation's data for timing info
        const firstOp = operations[0];
        
        transformedOrders.push({
          id: `WO-${String(workOrderCounter).padStart(4, '0')}`,
          productionOrderId: productionOrderId,
          product: productName,
          operations: allOperations,
          assignedTo: firstOp?.assigned_team || 'Multiple Teams',
          quantity: targetQty,
          completedQty: lastOperation.completedUnits, // Use packing completed as final count
          status: overallStatus,
          priority: (firstOp?.priority?.toLowerCase() || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          startTime: firstOp?.scheduled_start || firstOp?.created_at || '',
          estimatedEnd: firstOp?.scheduled_end || '',
          actualEnd: firstOp?.actual_end || undefined
        });
        
        workOrderCounter++;
      });
      
      setWorkOrders(transformedOrders);
    } catch (err: any) {
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
  const uniquePOs = [...new Set(workOrders.map(wo => wo.productionOrderId))];

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

  const getStatusBadge = (status: WorkOrder['status']) => {
    const statusConfig = {
      'pending': { color: 'bg-zinc-500', label: t.pending },
      'in-progress': { color: 'bg-blue-500', label: t.inProgress },
      'completed': { color: 'bg-emerald-500', label: t.completed },
      'on-hold': { color: 'bg-amber-500', label: t.onHold },
    };
    const config = statusConfig[status];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredOrders = workOrders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.operations.some(op => op.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productionOrderId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPO = poFilter === 'all' || order.productionOrderId === poFilter;
    
    return matchesSearch && matchesStatus && matchesPO;
  });

  const handleAction = async (action: string, orderId: string) => {
    const order = workOrders.find(o => o.id === orderId);
    if (!order) return;

    try {
      let status: 'Pending' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
      let updateData: any = {};

      switch (action) {
        case 'start':
          status = 'In Progress';
          updateData = {
            status,
            actual_start: new Date().toISOString()
          };
          break;
        case 'pause':
          status = 'On Hold';
          updateData = { status };
          break;
        case 'complete':
          status = 'Completed';
          updateData = {
            status,
            actual_end: new Date().toISOString(),
            completed_qty: order.quantity
          };
          break;
        default:
          return;
      }

      // Update each operation in the work order
      // Since we grouped operations by production_order_id, we need to update all operations
      const updatePromises = order.operations.map(async (op) => {
        // Find the actual working order ID for this operation
        const allWorkingOrders = await wipApi.listWorkingOrders({ 
          production_order_id: order.productionOrderId,
          operation: op.name
        });
        
        if (allWorkingOrders.length > 0) {
          const workingOrderId = allWorkingOrders[0].id;
          await wipApi.updateWorkingOrder(workingOrderId, updateData);
        }
      });

      await Promise.all(updatePromises);

      alert(`✅ ${language === 'en' ? 
        action === 'start' ? 'Started work order' :
        action === 'pause' ? 'Paused work order' :
        'Completed work order' :
        action === 'start' ? 'कार्य आदेश शुरू किया' :
        action === 'pause' ? 'कार्य आदेश रोका' :
        'कार्य आदेश पूर्ण'}: ${orderId}`);

      // Refresh the work orders list
      await fetchWorkOrders();
    } catch (err: any) {
      alert(`❌ ${language === 'en' ? 'Error' : 'त्रुटि'}: ${err?.detail || err?.message || 'Failed to update work order'}`);
    }
  };

  // Create new work order
  const handleCreateWorkOrder = async () => {
    if (!newWorkOrderData.production_order_id || !newWorkOrderData.operation || !newWorkOrderData.target_qty) {
      alert(language === 'en' 
        ? '⚠️ Please fill in required fields (Purchase Order, Operation, Target Quantity)' 
        : '⚠️ कृपया आवश्यक फ़ील्ड भरें (खरीद आदेश, ऑपरेशन, लक्ष्य मात्रा)');
      return;
    }

    setIsCreating(true);
    try {
      const payload: WorkingOrderCreate = {
        production_order_id: newWorkOrderData.production_order_id,
        operation: newWorkOrderData.operation,
        workstation: newWorkOrderData.workstation || undefined,
        assigned_team: newWorkOrderData.assigned_team || undefined,
        target_qty: parseFloat(newWorkOrderData.target_qty),
        unit: newWorkOrderData.unit,
        priority: newWorkOrderData.priority,
        scheduled_start: newWorkOrderData.scheduled_start || undefined,
        scheduled_end: newWorkOrderData.scheduled_end || undefined,
        notes: newWorkOrderData.notes || undefined
      };

      const createdOrder = await wipApi.createWorkingOrder(payload);
      
      alert(`✅ ${language === 'en' ? 'Work Order Created!' : 'कार्य आदेश बनाया गया!'}\n\n${language === 'en' ? 'Work Order Number' : 'कार्य आदेश नंबर'}: ${createdOrder.work_order_number}`);
      
      setShowNewWorkOrderModal(false);
      setNewWorkOrderData({
        production_order_id: '',
        operation: '',
        workstation: '',
        assigned_team: '',
        target_qty: '',
        unit: 'pcs',
        priority: 'Normal',
        scheduled_start: '',
        scheduled_end: '',
        notes: ''
      });
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
          
          // Calculate total completed across all operations for overall progress
          const totalCompletedUnits = order.operations.reduce((sum, op) => sum + op.completedUnits, 0);
          const overallProgressPercent = order.quantity > 0 
            ? Math.round((totalCompletedUnits / (order.quantity * order.operations.length)) * 100) 
            : 0;
          
          return (
            <Card key={order.id} className="overflow-hidden">
              {/* Collapsed Header - Always Visible */}
              <div 
                className="p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                onClick={() => toggleExpanded(order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Work Order ID and Status */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{order.id}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    {/* Production Order Reference */}
                    <p className="text-sm text-zinc-500 hidden sm:block">
                      {t.productionOrder}: {order.productionOrderId.slice(0, 8)}...
                    </p>
                    
                    {/* Product Name */}
                    <div className="flex items-center gap-2 hidden md:flex">
                      <Settings className="h-4 w-4 text-zinc-400" />
                      <span className="text-sm font-medium">{order.product}</span>
                    </div>
                  </div>
                  
                  {/* Right side - Progress summary and expand button */}
                  <div className="flex items-center gap-4">
                    {/* Mini progress indicator when collapsed */}
                    {!isExpanded && (
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-2 bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              order.status === 'completed' ? 'bg-emerald-500' :
                              order.status === 'in-progress' ? 'bg-blue-500' :
                              'bg-zinc-400'
                            }`}
                            style={{ width: `${overallProgressPercent}%` }}
                          />
                        </div>
                        <span className="text-sm text-zinc-500 w-12">{overallProgressPercent}%</span>
                      </div>
                    )}
                    
                    {/* Expand/Collapse Button */}
                    <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-zinc-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-zinc-200 p-4 space-y-4">
                  {/* Product Info Row */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-zinc-500" />
                      <span className="font-medium">{order.product}</span>
                    </div>
                    <span className="text-zinc-400">|</span>
                    <span className="text-zinc-500">{t.productionOrder}: {order.productionOrderId}</span>
                  </div>

                  {/* Operation Progress - All 5 Operations */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-500 mb-3">
                      {language === 'en' ? 'Operation Progress' : 'ऑपरेशन प्रगति'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {order.operations.map((op, idx) => {
                        const opPercent = op.targetUnits > 0 ? Math.round((op.completedUnits / op.targetUnits) * 100) : 0;
                        return (
                          <div
                            key={idx}
                            className={`
                              p-3 rounded-lg text-center border transition-all
                              ${op.status === 'completed' ? 'bg-emerald-50 border-emerald-300' :
                                op.status === 'in-progress' ? 'bg-blue-50 border-blue-300' :
                                op.status === 'on-hold' ? 'bg-amber-50 border-amber-300' :
                                'bg-zinc-50 border-zinc-200'}
                            `}
                          >
                            <div className={`text-sm font-medium ${
                              op.status === 'completed' ? 'text-emerald-700' :
                              op.status === 'in-progress' ? 'text-blue-700' :
                              op.status === 'on-hold' ? 'text-amber-700' :
                              'text-zinc-600'
                            }`}>{op.name}</div>
                            <div className="text-xl font-bold my-1">{op.completedUnits} {t.units}</div>
                            <div className="text-xs text-zinc-500">
                              {opPercent}% {t.of} {op.targetUnits}
                            </div>
                            <div className="mt-2 text-xs text-zinc-600">
                              <div>{t.workstation}: <span className="text-blue-600">{op.workstation}</span></div>
                              <div>{t.assignedTo}: <span className="text-orange-600">{op.assignedTo}</span></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">{t.overallProgress}</span>
                      <span className="font-medium">
                        {totalCompletedUnits} {t.of} {order.quantity * order.operations.length} {t.units} ({overallProgressPercent}%)
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          order.status === 'completed' ? 'bg-emerald-500' :
                          order.status === 'in-progress' ? 'bg-blue-500' :
                          order.status === 'on-hold' ? 'bg-amber-500' :
                          'bg-zinc-400'
                        }`}
                        style={{ width: `${overallProgressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{t.startTime}: {order.startTime || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{t.estimatedEnd}: {order.estimatedEnd || 'Not set'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
                    {order.status === 'pending' && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={(e) => { e.stopPropagation(); handleAction('start', order.id); }}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {t.start}
                      </Button>
                    )}
                    {order.status === 'in-progress' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleAction('pause', order.id); }}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          {t.pause}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={(e) => { e.stopPropagation(); handleAction('complete', order.id); }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {t.complete}
                        </Button>
                      </>
                    )}
                    {order.status === 'on-hold' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={(e) => { e.stopPropagation(); handleAction('start', order.id); }}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {t.start}
                      </Button>
                    )}
                    {order.status === 'completed' && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">{t.completed}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                  value={newWorkOrderData.production_order_id}
                  onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, production_order_id: e.target.value }))}
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

              {/* Workstation */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.workstation}
                </label>
                <Input
                  value={newWorkOrderData.workstation}
                  onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, workstation: e.target.value }))}
                  placeholder={language === 'en' ? 'Enter workstation' : 'वर्कस्टेशन दर्ज करें'}
                />
              </div>

              {/* Assigned Team */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.assignedTo}
                </label>
                <select
                  value={newWorkOrderData.assigned_team}
                  onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, assigned_team: e.target.value }))}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="">{language === 'en' ? 'Select Team...' : 'टीम चुनें...'}</option>
                  <option value="Team A">Team A</option>
                  <option value="Team B">Team B</option>
                  <option value="Team C">Team C</option>
                  <option value="Team D">Team D</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {t.priority}
                </label>
                <select
                  value={newWorkOrderData.priority}
                  onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, priority: e.target.value as 'Low' | 'Normal' | 'High' | 'Urgent' }))}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="Low">{t.low}</option>
                  <option value="Normal">{t.normal}</option>
                  <option value="High">{t.high}</option>
                  <option value="Urgent">{t.urgent}</option>
                </select>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {t.startTime}
                  </label>
                  <Input
                    type="datetime-local"
                    value={newWorkOrderData.scheduled_start}
                    onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, scheduled_start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    {t.estimatedEnd}
                  </label>
                  <Input
                    type="datetime-local"
                    value={newWorkOrderData.scheduled_end}
                    onChange={(e) => setNewWorkOrderData(prev => ({ ...prev, scheduled_end: e.target.value }))}
                  />
                </div>
              </div>

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
