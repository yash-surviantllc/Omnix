import { Search, Plus, Play, Pause, CheckCircle2, Clock, Calendar, Package, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useCallback, useRef } from 'react';
import { wipApi, type WorkingOrderCreate } from '@/lib/api/wip';
import { purchaseOrdersApi, type PurchaseOrder } from '@/lib/api/purchase-orders';
import { bomApi } from '@/lib/api/bom';
import { stagesApi, type Stage, type ProductStageDetail } from '@/lib/api/stages';

type WorkingOrderProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

interface WorkOrderOperation {
  name: string;
  id: string; // Added ID for action handling
  completedUnits: number;
  transferredUnits: number; // Physical transfers via Stage Transfer
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  assignedTo: string;
  workstation: string;
  targetUnits: number;
}

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

  // Dynamic Stages State
  const [availableStages, setAvailableStages] = useState<Stage[]>([]);
  const [productStages, setProductStages] = useState<ProductStageDetail[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  // Track previous stages to detect changes
  const previousStagesRef = useRef<Stage[]>([]);

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

  // Helper to fetch PO items
  const fetchPOItems = async (poId: string) => {
    if (!poId) {
      setPoItems([]);
      return;
    }
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
          quantity_per_unit: Number(m.quantity_per_unit) || 0,
          required_quantity: Number(m.required_qty) || 0,
          unit: m.unit,
          available_stock: Number(m.available_qty) || 0,
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
  const fetchWorkOrders = useCallback(async (silent: boolean = false, explicitStages?: Stage[]) => {
    if (!silent) setLoading(true);
    try {
      // Fetch working orders directly without complex transformation
      const workingOrdersData = await wipApi.listWorkingOrders({ limit: 100 });
      // Optimized: No longer need to fetch all Purchase Orders separately

      // Use explicit stages if provided (for initial load), otherwise state
      const currentStages = explicitStages || availableStages;

      // Safety check: Ensure responses are arrays
      if (!Array.isArray(workingOrdersData)) {
        console.error('Invalid working orders response format:', workingOrdersData);
        throw new Error('Received invalid data for working orders');
      }

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

        // Use enhanced fields directly from ID
        const poOrderNumber = firstOp.purchase_order_number || 'Unknown PO';
        const productName = firstOp.product_name || 'Unknown Product';

        // Create map of existing operations
        const existingOpsMap = new Map();
        group.forEach(wo => {
          if (wo.operation) existingOpsMap.set(wo.operation, wo);
        });

        // Get stage names from available stages (fallback to empty if not loaded yet)
        const stageNames = currentStages.length > 0
          ? currentStages.map(s => s.name)
          : [];

        // Merge with configured stages to ensure all stages are visible
        const operations: WorkOrderOperation[] = stageNames.map((opName: string) => {
          const wo = existingOpsMap.get(opName);

          if (wo) {
            // Existing operation
            const rawStatus = wo.status || 'pending';
            // Map database status to frontend status
            const statusMap: Record<string, 'pending' | 'in-progress' | 'completed' | 'on-hold'> = {
              'planned': 'pending',
              'released': 'pending',
              'pending': 'pending',
              'in progress': 'in-progress',
              'in-progress': 'in-progress',
              'completed': 'completed',
              'on hold': 'on-hold',
              'on-hold': 'on-hold',
              'cancelled': 'on-hold'
            };
            const normalizedStatus = rawStatus.toLowerCase();
            const validStatus = statusMap[normalizedStatus] || 'pending';

            return {
              name: wo.operation,
              id: wo.id,
              completedUnits: Number(wo.completed_qty) || 0,
              transferredUnits: 0,
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
              transferredUnits: 0,
              status: 'pending',
              assignedTo: 'Unassigned',
              workstation: 'TBD',
              targetUnits: Number(firstOp.target_qty) || 0 // Assume same target as others
            };
          }
        });

        // Add any non-standard operations that might exist (custom operations)
        group.forEach(wo => {
          if (wo.operation && !stageNames.includes(wo.operation)) {
            const rawStatus = wo.status || 'pending';
            // Map database status to frontend status
            const statusMap: Record<string, 'pending' | 'in-progress' | 'completed' | 'on-hold'> = {
              'planned': 'pending',
              'released': 'pending',
              'pending': 'pending',
              'in progress': 'in-progress',
              'in-progress': 'in-progress',
              'completed': 'completed',
              'on hold': 'on-hold',
              'on-hold': 'on-hold',
              'cancelled': 'on-hold'
            };
            const normalizedStatus = rawStatus.toLowerCase();
            const validStatus = statusMap[normalizedStatus] || 'pending';

            operations.push({
              name: wo.operation,
              id: wo.id,
              completedUnits: Number(wo.completed_qty) || 0,
              transferredUnits: 0,
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
        const totalTarget = operations.reduce((sum, op) => sum + op.targetUnits, 0);
        const totalCompleted = operations.reduce((sum, op) => sum + op.completedUnits, 0);

        return {
          id: firstOp.id,
          workOrderNumber: firstOp.work_order_number || `WO-${firstOp.id}`,
          purchaseOrderId: firstOp.purchase_order_id || '',
          purchaseOrderNumber: poOrderNumber,
          product: productName,
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
    } finally {
      if (!silent) setLoading(false);
    }
  }, [availableStages, wipApi]);

  // Fetch purchase orders for the dropdown
  const fetchProductionOrders = async () => {
    try {
      const data = await purchaseOrdersApi.listOrders({ limit: 100 });
      setProductionOrders(data);
    } catch (err: any) {
      console.error('Failed to load purchase orders:', err);
    }
  };

  // Fetch available stages
  const fetchAvailableStages = async (silent: boolean = false): Promise<Stage[]> => {
    if (!silent) setLoadingStages(true);
    try {
      const stages = await stagesApi.listStages(true); // Get only active stages
      if (Array.isArray(stages)) {
        console.log('🔍 RAW stages from API:', stages.map(s => ({ name: s.name, seq: s.sequence_number })));
        const sortedStages = [...stages].sort((a, b) => a.sequence_number - b.sequence_number);
        console.log('✅ SORTED stages:', sortedStages.map(s => ({ name: s.name, seq: s.sequence_number })));
        setAvailableStages(sortedStages);
        return sortedStages;
      } else {
        console.warn('Invalid stages data received:', stages);
        // Don't clear stages on invalid data if we already have them
        if (availableStages.length === 0) {
          setAvailableStages([]);
        }
        return [];
      }
    } catch (err: any) {
      console.error('Failed to load stages:', err);
      // Don't clear stages on error, keep stale data
      return [];
    } finally {
      if (!silent) setLoadingStages(false);
    }
  };

  // Initial data fetch - SEQUENTIAL to avoid race condition
  // Stages must be loaded and sorted BEFORE work orders are fetched
  useEffect(() => {
    const initializeData = async () => {
      // Step 1: Fetch production orders (independent)
      fetchProductionOrders();

      // Step 2: Fetch and sort stages FIRST
      const sortedStages = await fetchAvailableStages();

      // Step 3: THEN fetch work orders with the sorted stages
      // Passing sortedStages explicitly avoids using stale state closure
      if (sortedStages && sortedStages.length > 0) {
        fetchWorkOrders(false, sortedStages);
      } else {
        fetchWorkOrders();
      }
    };

    initializeData();
  }, []);

  // Periodic refresh of stages to catch configuration changes (every 30 seconds)
  // Use silent refresh to avoid loading glitch
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAvailableStages(true); // Silent refresh
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Initial fetch of transferred quantities when work orders load
  useEffect(() => {
    const fetchInitialQuantities = async () => {
      if (workOrders.length === 0 || availableStages.length === 0) return;

      console.log('🔄 INITIAL FETCH: Fetching transferred quantities for', workOrders.length, 'work orders');

      try {
        const updates = await Promise.all(
          workOrders.map(async (wo) => {
            try {
              const quantities = await wipApi.getTransferredQuantities(wo.id);
              return { workOrderId: wo.id, quantities };
            } catch (err) {
              return { workOrderId: wo.id, quantities: {} };
            }
          })
        );

        setWorkOrders(prevOrders =>
          prevOrders.map(order => {
            const update = updates.find(u => u.workOrderId === order.id);
            if (!update) return order;

            return {
              ...order,
              operations: order.operations.map(op => {
                const matchingStage = availableStages.find(s => s.name === op.name);
                const stageId = matchingStage?.id || '';
                const transferredQty = stageId && update.quantities[stageId] ? update.quantities[stageId] : 0;

                return {
                  ...op,
                  transferredUnits: transferredQty
                };
              })
            };
          })
        );
      } catch (err) {
        console.error('Error fetching initial transferred quantities:', err);
      }
    };

    fetchInitialQuantities();
  }, [workOrders.length, availableStages.length]);

  // Periodic refresh of transferred quantities (every 10 seconds)
  useEffect(() => {
    console.log('⏰ Setting up periodic refresh interval for transferred quantities');
    const intervalId = setInterval(async () => {
      if (workOrders.length === 0 || availableStages.length === 0) return;

      try {
        const updates = await Promise.all(
          workOrders.map(async (wo) => {
            try {
              const quantities = await wipApi.getTransferredQuantities(wo.id);
              return { workOrderId: wo.id, quantities };
            } catch (err) {
              return { workOrderId: wo.id, quantities: {} };
            }
          })
        );

        setWorkOrders(prevOrders =>
          prevOrders.map(order => {
            const update = updates.find(u => u.workOrderId === order.id);
            if (!update) return order;

            return {
              ...order,
              operations: order.operations.map(op => {
                const matchingStage = availableStages.find(s => s.name === op.name);
                const stageId = matchingStage?.id || '';
                const transferredQty = stageId && update.quantities[stageId] ? update.quantities[stageId] : 0;

                return {
                  ...op,
                  transferredUnits: transferredQty
                };
              })
            };
          })
        );
      } catch (err) {
        // Silent error - don't spam console
      }
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, []); // Empty dependency - interval runs independently

  // Refresh stages when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAvailableStages(true); // Silent refresh
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Detect stage changes and refetch work orders when stages actually change
  useEffect(() => {
    // Skip on initial render (when previousStagesRef is empty)
    if (previousStagesRef.current.length === 0 && availableStages.length > 0) {
      previousStagesRef.current = availableStages;
      return;
    }

    // Check if stages have actually changed
    // Use ID-based comparison instead of index-based to handle resequencing
    const prevStageIds = new Set(previousStagesRef.current.map(s => s.id));
    const currentStageIds = new Set(availableStages.map(s => s.id));

    // Check for added or removed stages
    const stageCountChanged = previousStagesRef.current.length !== availableStages.length;
    const stagesAddedOrRemoved =
      previousStagesRef.current.some(s => !currentStageIds.has(s.id)) ||
      availableStages.some(s => !prevStageIds.has(s.id));

    // Check for sequence or name changes (create maps by ID for comparison)
    const prevStageMap = new Map(previousStagesRef.current.map(s => [s.id, s]));
    const sequenceOrNameChanged = availableStages.some(currentStage => {
      const prevStage = prevStageMap.get(currentStage.id);
      return prevStage && (
        prevStage.sequence_number !== currentStage.sequence_number ||
        prevStage.name !== currentStage.name
      );
    });

    const stagesChanged = stageCountChanged || stagesAddedOrRemoved || sequenceOrNameChanged;

    if (stagesChanged && availableStages.length > 0) {
      console.log('Stages changed, refetching work orders silently...', {
        stageCountChanged,
        stagesAddedOrRemoved,
        sequenceOrNameChanged,
        previousCount: previousStagesRef.current.length,
        currentCount: availableStages.length
      });
      fetchWorkOrders(true, availableStages); // Silent refetch to avoid loading glitch
      previousStagesRef.current = availableStages;
    }
  }, [availableStages]);

  // Check for pre-selected PO from Purchase Orders screen (via sessionStorage)
  useEffect(() => {
    const storedPO = sessionStorage.getItem('createWorkingOrderForPO');
    if (storedPO) {
      try {
        const poData = JSON.parse(storedPO);
        // Pre-fill the form and open the modal
        setNewWorkOrderData(prev => ({
          ...prev,
          purchase_order_id: poData.id,
          target_qty: poData.quantity?.toString() || '',
          unit: poData.unit || 'pcs'
        }));

        // Fetch items for this PO so the second dropdown works
        fetchPOItems(poData.id);

        setShowNewWorkOrderModal(true);
        // Clear the sessionStorage after using it
        sessionStorage.removeItem('createWorkingOrderForPO');
      } catch (err) {
        console.error('Failed to parse stored PO data:', err);
        sessionStorage.removeItem('createWorkingOrderForPO');
      }
    }
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
      if (action === 'start') {
        // Find operation to start (Planned, Released, or On Hold, or Pending)
        const op = order.operations.find(op => {
          const statusLower = op.status?.toLowerCase();
          return statusLower === 'planned' || statusLower === 'released' || statusLower === 'on hold' || statusLower === 'pending';
        });

        if (!op) {
          console.warn("No suitable operation found to start");
          return;
        }

        // Use startOperation endpoint instead of generic update
        // This handles "ghost" stages (placeholders) correctly by creating them
        await wipApi.startOperation(order.workOrderNumber, op.name);

      } else {
        // Handle Pause / Complete using Update endpoint (requires valid ID)
        let targetOpId: string | null = null;
        let status: 'Pending' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
        let updateData: any = {};

        if (action === 'pause') {
          const op = order.operations.find(op => op.status?.toLowerCase() === 'in progress');
          if (op) {
            targetOpId = op.id;
            status = 'On Hold';
            updateData = { status };
          }
        } else if (action === 'complete') {
          const op = order.operations.find(op => op.status?.toLowerCase() === 'in progress');
          if (op) {
            targetOpId = op.id;
            status = 'Completed';
            updateData = {
              status,
              actual_end: new Date().toISOString(),
              completed_qty: op.targetUnits // Auto-fill quantity
            };
          }
        }

        if (!targetOpId || targetOpId.startsWith('placeholder-')) {
          console.warn("Invalid operation ID for pause/complete:", targetOpId);
          return;
        }

        await wipApi.updateWorkingOrder(targetOpId, updateData);
      }

      // Refresh the work orders list
      await fetchWorkOrders();
    } catch (err: any) {
      console.error('Action failed:', err);
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
          required_quantity: Number(m.required_qty) || 0, // Cast to number, default to 0
          unit: m.unit,
          available_stock: Number(m.available_qty) || 0, // Cast to number, default to 0
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
    <div className="space-y-6 p-4 md:p-6 bg-zinc-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage production workflow and track progress</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNewWorkOrderModal(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            {t.newWorkOrder}
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="p-4 border-zinc-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <select
              className="h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {['Pending', 'In-Progress', 'Completed', 'On-Hold'].map(s => (
                <option key={s} value={s.toLowerCase()}>{s}</option>
              ))}
            </select>

            <select
              className="h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[200px]"
              value={poFilter}
              onChange={(e) => setPoFilter(e.target.value)}
            >
              <option value="all">All POs</option>
              {uniquePOs.filter(Boolean).map(poId => {
                const poNumber = workOrders.find(w => w.purchaseOrderId === poId)?.purchaseOrderNumber || 'Unknown PO';
                return <option key={poId} value={poId}>{poNumber}</option>;
              })}
            </select>
          </div>
        </div>
      </Card>

      {/* Work Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-48 animate-pulse bg-zinc-100 border-zinc-200" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-zinc-300">
            <Package className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">No work orders found matching your filters</p>
            <Button variant="link" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPoFilter('all'); }} className="text-emerald-600">
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden border-zinc-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="p-4 md:p-6">
                  {/* Card Header: Main Info */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-zinc-900">{order.product}</h3>
                        {getStatusBadge(order.status)}
                        <Badge variant="outline" className={`
                          ${order.priority === 'high' ? 'text-orange-600 border-orange-200 bg-orange-50' :
                            order.priority === 'urgent' ? 'text-red-600 border-red-200 bg-red-50' :
                              'text-zinc-500 border-zinc-200 bg-zinc-50'}
                        `}>
                          {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)} Priority
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-zinc-400" />
                          WO: <span className="font-medium text-zinc-700">{order.workOrderNumber}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-zinc-400" />
                          PO: <span className="font-medium text-zinc-700">{order.purchaseOrderNumber}</span>
                        </span>
                        {order.assignedTo !== 'Unassigned' && (
                          <span className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                              {order.assignedTo.charAt(0)}
                            </span>
                            Team: <span className="font-medium text-zinc-700">{order.assignedTo}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Stats / Actions */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="flex flex-col items-end min-w-[100px]">
                        <div className="text-2xl font-bold text-zinc-900">
                          {Math.round((order.completedQty / order.quantity) * 100)}%
                        </div>
                        <div className="text-xs text-zinc-500">
                          {order.completedQty} / {order.quantity} {t.units}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleExpanded(order.id)}
                        className="ml-auto md:ml-0"
                      >
                        {expandedOrders.has(order.id) ? (
                          <ChevronUp className="h-5 w-5 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-zinc-500" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-100 rounded-full h-2 mb-6 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((order.completedQty / order.quantity) * 100, 100)}%` }}
                    />
                  </div>

                  {/* Expanded Content: Operations */}
                  {expandedOrders.has(order.id) && (
                    <div className="mt-6 space-y-6 border-t border-zinc-100 pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Production Order Info */}
                      <div className="text-sm text-zinc-600">
                        Production Order: <span className="font-medium text-zinc-900">{order.purchaseOrderNumber}</span>
                      </div>

                      {/* Operation Progress - Horizontal Cards */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-700 mb-3">Operation Progress</h4>
                        <div className="flex gap-3">
                          {order.operations.filter(op => !op.id.toString().startsWith('placeholder-')).map((op) => {
                            const opProgress = op.targetUnits > 0 ? Math.round((op.completedUnits / op.targetUnits) * 100) : 0;

                            return (
                              <div
                                key={op.id}
                                className={`
                                  flex-1 p-3 rounded-lg border text-center space-y-1.5 transition-all
                                  ${op.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                                    op.status === 'in-progress' ? 'bg-blue-50 border-blue-200' :
                                      'bg-zinc-50 border-zinc-200'}
                                `}
                              >
                                <div className="font-semibold text-sm text-zinc-900">{op.name}</div>

                                <div className="mt-2 space-y-1">
                                  <div className="text-xs text-zinc-500 font-medium">Status Completion:</div>
                                  <div className="text-lg font-bold text-zinc-900">{op.completedUnits} units</div>
                                  <div className="text-xs text-zinc-500">{opProgress}% of {op.targetUnits}</div>
                                </div>

                                <div className="mt-2 pt-2 border-t border-zinc-200 space-y-1">
                                  <div className="text-xs text-emerald-600 font-medium">Physically Transferred:</div>
                                  <div className="text-lg font-bold text-emerald-700">{op.transferredUnits || 0} units</div>
                                  <div className="text-[10px] text-zinc-400 italic">
                                    {op.transferredUnits > 0 ? 'Via Stage Transfer' : 'No transfers yet'}
                                  </div>
                                </div>

                                <div className="text-xs text-zinc-600 mt-2">
                                  <div>Assigned to: {op.assignedTo}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Overall Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-700">Overall Progress:</span>
                          <span className="font-bold text-zinc-900">{order.completedQty} of {order.quantity} units ({Math.round((order.completedQty / order.quantity) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((order.completedQty / order.quantity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="flex items-center gap-6 text-sm text-zinc-600">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Start: {order.startTime ? new Date(order.startTime).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Not set'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Est. End: {order.estimatedEnd ? new Date(order.estimatedEnd).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Not set'}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        {order.operations.some(op => op.status === 'in-progress') && (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 border-zinc-300 hover:bg-zinc-50"
                              onClick={(e) => { e.stopPropagation(); handleAction('pause', order.id); }}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              {t.pause}
                            </Button>
                            <Button
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={(e) => { e.stopPropagation(); handleAction('complete', order.id); }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {t.complete}
                            </Button>
                          </>
                        )}
                        {order.operations.some(op => op.status === 'pending' || op.status === 'on-hold') &&
                          !order.operations.some(op => op.status === 'in-progress') && (
                            <Button
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={(e) => { e.stopPropagation(); handleAction('start', order.id); }}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              {t.start}
                            </Button>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

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
                    await fetchPOItems(poId);
                  }}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="">{language === 'en' ? 'Select Purchase Order...' : 'खरीद आदेश चुनें...'}</option>
                  {Array.isArray(productionOrders) && productionOrders.map((po: PurchaseOrder) => (
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
                    onChange={async (e) => {
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
                          notes: (prev.notes || '') // Safer access
                            ? `${prev.notes}\nSelected SKU: ${selectedCode} - ${selectedItem.product_name || ''}`
                            : `Selected SKU: ${selectedCode} - ${selectedItem.product_name || ''}`
                        }));

                        // Load stages for this product
                        if (selectedItem.product_id) {
                          setLoadingStages(true);
                          try {
                            const productStagesResponse = await stagesApi.getProductStages(selectedItem.product_id);
                            if (productStagesResponse && Array.isArray(productStagesResponse.stages)) {
                              setProductStages(productStagesResponse.stages);
                            } else {
                              // Fallback if stages are missing/invalid in response
                              setProductStages([]);
                            }
                          } catch (err) {
                            console.error('Failed to load product stages:', err);
                            // Fallback to default available stages (cast to ProductStageDetail format)
                            setProductStages(availableStages.map(s => ({
                              ...s,
                              is_required: true,
                              is_active: s.is_active
                            })));
                          } finally {
                            setLoadingStages(false);
                          }
                        }
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
                  disabled={loadingStages}
                >
                  <option value="">{language === 'en' ? 'Select Operation...' : 'ऑपरेशन चुनें...'}</option>
                  {(productStages.length > 0 ? productStages : availableStages).map((stage) => (
                    <option key={stage.id} value={stage.name}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                {loadingStages && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {language === 'en' ? 'Loading stages...' : 'स्टेज लोड हो रहे हैं...'}
                  </p>
                )}
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
