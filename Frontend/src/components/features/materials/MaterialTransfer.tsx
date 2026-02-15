import { useMemo, useState, useEffect } from 'react';
import { ArrowLeftRight, X, Check, AlertCircle, History, Search, ArrowRight, MapPin } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MaterialCard } from './components/MaterialCard';
import { NotificationBell } from './components/NotificationBell';
import { apiClient } from '@/lib/api/client';
import { Language } from '@/types/inventory';
import { InventoryItemResponse } from '@/lib/api/inventory';

const translations = {
  en: {
    title: 'Material Transfer',
    subtitle: 'Transfer materials between warehouses and production floors',
    newTransfer: 'New Transfer',
    history: 'Transfer History',
    selectMaterial: 'Select Material to Transfer',
    transferMaterial: 'Transfer Material',
    availableStock: 'Available Stock',
    currentLocation: 'Current Location',
    transferQuantity: 'Transfer Quantity',
    enterQuantity: 'Enter quantity',
    fromLocation: 'From Location',
    toLocation: 'To Location',
    selectDestination: 'Select destination',
    transferReason: 'Transfer Reason',
    selectReason: 'Select reason',
    cancel: 'Cancel',
    confirmTransfer: 'Confirm Transfer',
    searchMaterial: 'Search materials...',
    wipStageTransfer: 'WIP Stage Transfer',
    stageTransferSubtitle: 'Move materials between production stages',
    newStageTransfer: 'New Stage Transfer',
    fromStage: 'From Stage',
    toStage: 'To Stage',
    selectFromStage: 'Select source stage',
    selectToStage: 'Select destination stage',
    orderReference: 'Work Order',
    enterOrderRef: 'Enter Work Order number',
    workOrderOptional: 'Work Order (Optional)',
    productCode: 'Product Code',
    enterProductCode: 'Enter product code (e.g., TS-001)',
    addMaterial: 'Add Material',
    materialName: 'Material Name',
    enterMaterialName: 'Enter material name',
    initiateTransfer: 'Initiate Transfer',
    stageTransferHistory: 'Stage Transfer History',
    pending: 'Pending',
    inProgress: 'In Progress',
    completed: 'Completed',
    reasons: {
      production: 'Production Requirement',
      restocking: 'Restocking',
      quality: 'Quality Issue',
      maintenance: 'Maintenance',
      emergency: 'Emergency',
      other: 'Other'
    },
    transferId: 'Transfer ID',
    material: 'Material',
    quantity: 'Quantity',
    completedQty: 'Completed Qty',
    pendingQty: 'Pending Qty',
    unit: 'Unit',
    location: 'Location',
    status: 'Status',
    date: 'Date',
    viewDetails: 'View Details',
    noTransfers: 'No transfers yet',
    createFirst: 'Create your first material transfer above',
    validationErrors: {
      noQuantity: 'Please enter quantity',
      invalidQuantity: 'Quantity must be greater than 0',
      exceedsStock: 'Quantity exceeds available stock',
      noDestination: 'Please select destination',
      noReason: 'Please select transfer reason',
      sameLocation: 'Source and destination cannot be the same'
    },
    workOrder: 'Work Order',
    priority: 'Priority',
    locations: {
      warehouse_a: 'Warehouse A',
      warehouse_b: 'Warehouse B',
      production_floor_1: 'Production Floor 1',
      production_floor_2: 'Production Floor 2',
      quality_control: 'Quality Control',
      shipping: 'Shipping'
    }
  },
  hi: {
    title: 'सामग्री स्थानांतरण',
    subtitle: 'गोदामों और उत्पादन मंजिलों के बीच सामग्री स्थानांतरित करें',
    newTransfer: 'नया स्थानांतरण',
    history: 'स्थानांतरण इतिहास',
    selectMaterial: 'स्थानांतरण के लिए सामग्री चुनें',
    transferMaterial: 'सामग्री स्थानांतरण',
    availableStock: 'उपलब्ध स्टॉक',
    currentLocation: 'वर्तमान स्थान',
    transferQuantity: 'स्थानांतरण मात्रा',
    enterQuantity: 'मात्रा दर्ज करें',
    fromLocation: 'स्थान से',
    toLocation: 'स्थान तक',
    selectDestination: 'गंतव्य चुनें',
    transferReason: 'स्थानांतरण कारण',
    selectReason: 'कारण चुनें',
    cancel: 'रद्द करें',
    confirmTransfer: 'स्थानांतरण की पुष्टि करें',
    searchMaterial: 'सामग्री खोजें...',
    wipStageTransfer: 'WIP स्टेज ट्रांसफर',
    stageTransferSubtitle: 'उत्पादन चरणों के बीच सामग्री स्थानांतरित करें',
    newStageTransfer: 'नया स्टेज ट्रांसफर',
    fromStage: 'स्टेज से',
    toStage: 'स्टेज तक',
    selectFromStage: 'स्रोत स्टेज चुनें',
    selectToStage: 'गंतव्य स्टेज चुनें',
    orderReference: 'वर्क ऑर्डर',
    enterOrderRef: 'वर्क ऑर्डर नंबर दर्ज करें',
    workOrderOptional: 'वर्क ऑर्डर (वैकल्पिक)',
    productCode: 'उत्पाद कोड',
    enterProductCode: 'उत्पाद कोड दर्ज करें (जैसे, TS-001)',
    addMaterial: 'सामग्री जोड़ें',
    materialName: 'सामग्री का नाम',
    enterMaterialName: 'सामग्री का नाम दर्ज करें',
    initiateTransfer: 'ट्रांसफर शुरू करें',
    stageTransferHistory: 'स्टेज ट्रांसफर इतिहास',
    pending: 'लंबित',
    inProgress: 'प्रगति में',
    completed: 'पूर्ण',
    reasons: {
      production: 'उत्पादन आवश्यकता',
      restocking: 'पुनः भंडारण',
      quality: 'गुणवत्ता समस्या',
      maintenance: 'रखरखाव',
      emergency: 'आपातकाल',
      other: 'अन्य'
    },
    transferId: 'स्थानांतरण ID',
    material: 'सामग्री',
    quantity: 'मात्रा',
    completedQty: 'पूर्ण मात्रा',
    pendingQty: 'लंबित मात्रा',
    unit: 'यूनिट',
    location: 'स्थान',
    status: 'स्थिति',
    date: 'तारीख',
    viewDetails: 'विवरण देखें',
    noTransfers: 'अभी तक कोई स्थानांतरण नहीं',
    createFirst: 'ऊपर अपना पहला सामग्री स्थानांतरण बनाएं',
    validationErrors: {
      noQuantity: 'कृपया मात्रा दर्ज करें',
      invalidQuantity: 'मात्रा 0 से अधिक होनी चाहिए',
      exceedsStock: 'मात्रा उपलब्ध स्टॉक से अधिक है',
      noDestination: 'कृपया गंतव्य चुनें',
      noReason: 'कृपया स्थानांतरण कारण चुनें',
      sameLocation: 'स्रोत और गंतव्य समान नहीं हो सकते'
    },
    workOrder: 'वर्क ऑर्डर',
    priority: 'प्राथमिकता',
    locations: {
      warehouse_a: 'गोदाम A',
      warehouse_b: 'गोदाम B',
      production_floor_1: 'उत्पादन मंजिल 1',
      production_floor_2: 'उत्पादन मंजिल 2',
      quality_control: 'गुणवत्ता नियंत्रण',
      shipping: 'शिपिंग'
    }
  }
};

type MaterialTransferProps = {
  language: Language;
  refreshMaterialTransferData?: (showSuccess?: boolean) => void;
};

export function MaterialTransfer({ language, refreshMaterialTransferData }: MaterialTransferProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [inventoryItems, setInventoryItems] = useState<InventoryItemResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferData, setTransferData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [, setSubmitError] = useState<string | null>(null);
  const [, setSuccessMessage] = useState<string | null>(null);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [wipStages, setWipStages] = useState<any[]>([]);
  const [workingOrders, setWorkingOrders] = useState<any[]>([]);
  const [showStageTransferModal, setShowStageTransferModal] = useState(false);
  const [stageTransferData, setStageTransferData] = useState({
    fromStageId: '',
    toStageId: '',
    orderId: '',
    orderNumber: '',
    quantity: '',
    notes: ''
  });
  const [availableStages, setAvailableStages] = useState<any[]>([]);

  // Fetch inventory data on component mount
  useEffect(() => {
    fetchInventoryData();
    fetchTransferHistory();
    fetchWipStages();
    fetchWorkingOrders();
  }, [])

  async function fetchInventoryData() {
    try {
      const response = await apiClient.get<InventoryItemResponse[]>('/inventory-items/');
      setInventoryItems(response);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    }
  }

  const fetchTransferHistory = async () => {
    try {
      const response = await apiClient.get<any[]>('/material-transfers/');
      setTransferHistory(response);
    } catch (error) {
      console.error('Failed to fetch transfer history:', error);
    }
  };

  const fetchWipStages = async () => {
    try {
      const response = await apiClient.get<any[]>('/wip-board/stages');
      setWipStages(response);
    } catch (error) {
      console.error('Failed to fetch WIP stages:', error);
    }
  };

  const fetchWorkingOrders = async () => {
    try {
      // Fetch ALL working orders (no status filter) for debugging
      const url = `/wip/working-orders/unique`;
      console.log('Fetching working orders from:', url);

      const response = await apiClient.get<any[]>(url);
      console.log('Working orders response:', response);
      setWorkingOrders(response);
    } catch (error) {
      console.error('Failed to fetch working orders:', error);
    }
  };

  const [isLoadingStages, setIsLoadingStages] = useState(false);

  const fetchWorkOrderStages = async (workOrderNumber: string) => {
    setIsLoadingStages(true);
    try {
      const url = `/wip/working-orders/${workOrderNumber}/stages`;
      console.log('Fetching stages from:', url);

      const response = await apiClient.get<any[]>(url);
      console.log('Stages response:', response);
      setAvailableStages(response);
    } catch (error) {
      console.error('Failed to fetch work order stages:', error);
      setAvailableStages([]);
    } finally {
      setIsLoadingStages(false);
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const materialOptions = useMemo(
    () =>
      inventoryItems.map((item) => ({
        name: item.material_name,
        code: item.material_code,
        stock: item.quantity,
        location: item.location || '',
        uom: item.unit,
        productId: item.id,
      })),
    [inventoryItems]
  );

  const filteredMaterials = useMemo(() =>
    materialOptions.filter((material) =>
      material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.code.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [materialOptions, searchQuery]
  );

  const handleMaterialSelect = (material: typeof materialOptions[number]) => {
    setTransferData({
      material: material.name,
      materialCode: material.code,
      productId: material.productId,
      availableStock: material.stock,
      currentLocation: material.location,
      fromLocation: material.location,
      uom: material.uom,
      quantity: 0,
      toLocation: '',
      transferReason: '',
      workOrderId: '', // Add work order ID
      workOrderNumber: '', // Add work order number
      priority: 'Normal' // Add priority
    });
    setShowTransferModal(true);
    setErrors({});
  };

  const validateTransfer = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!transferData.quantity || transferData.quantity <= 0) {
      newErrors.quantity = t.validationErrors.invalidQuantity;
    } else if (transferData.quantity > (transferData.availableStock || 0)) {
      newErrors.quantity = t.validationErrors.exceedsStock;
    }

    if (!transferData.toLocation || !transferData.toLocation.trim()) {
      newErrors.toLocation = t.validationErrors.noDestination;
    } else if (transferData.toLocation === transferData.fromLocation) {
      newErrors.toLocation = t.validationErrors.sameLocation;
    }

    if (!transferData.transferReason) {
      newErrors.transferReason = t.validationErrors.noReason;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetTransferState = () => {
    setShowTransferModal(false);
    setTransferData({});
    setErrors({});
  };

  const handleConfirmTransfer = async () => {
    if (!validateTransfer() || !transferData.productId || !transferData.fromLocation || !transferData.toLocation) {
      return;
    }

    setIsSubmittingTransfer(true);
    setSubmitError(null);

    try {
      await apiClient.post('/material-transfers', {
        product_id: transferData.productId,
        from_location: transferData.fromLocation,
        to_location: transferData.toLocation,
        quantity: transferData.quantity,
        unit: transferData.uom,
        reason: transferData.transferReason,
        priority: transferData.priority || 'Normal',
        work_order_id: transferData.workOrderId || null,
        work_order_number: transferData.workOrderNumber || null,
      });

      setSuccessMessage('Transfer created successfully.');
      resetTransferState();
      refreshMaterialTransferData?.(false);
    } catch (error: any) {
      setSubmitError(error?.detail || 'Failed to create transfer. Please try again.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-zinc-900 mb-2">{t.title}</h1>
          <p className="text-zinc-600">{t.subtitle}</p>
        </div>
        {/* Notification Bell */}
        <NotificationBell language={language === 'kn' ? 'en' : language as 'en' | 'hi'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'new'
            ? 'border-emerald-600 text-emerald-900'
            : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
        >
          {t.newTransfer}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 border-b-2 transition-colors ${activeTab === 'history'
            ? 'border-emerald-600 text-emerald-900'
            : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            {t.history}
          </div>
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-6">
          {/* WIP Stage Transfer Section */}
          <Card className="p-6 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-blue-900 mb-1 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5" />
                  {t.wipStageTransfer}
                </h2>
                <p className="text-sm text-blue-700">{t.stageTransferSubtitle}</p>
              </div>
              <Button
                onClick={() => setShowStageTransferModal(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {t.newStageTransfer}
              </Button>
            </div>

            {/* Stage Flow Visualization */}
            <div className="flex items-center justify-between gap-2 p-4 bg-white rounded-lg overflow-x-auto">
              {wipStages.map((stage, index) => (
                <div key={stage.id} className="flex items-center">
                  <div className="text-center">
                    <div className={`px-4 py-2 rounded-lg border-2 ${stage.health === 'healthy' ? 'bg-green-50 border-green-300 text-green-900' : stage.health === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
                      <div className="text-sm">{stage.name}</div>
                      <div className="text-xs mt-1 opacity-75">{stage.items} units</div>
                    </div>
                  </div>
                  {index < wipStages.length - 1 && (
                    <ArrowRight className="w-5 h-5 mx-2 text-blue-400" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Material Selection */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-zinc-900">{t.selectMaterial}</h2>
              <div className="text-sm text-zinc-600">
                {filteredMaterials.length} {filteredMaterials.length === 1 ? 'material' : 'materials'}
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchMaterial}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-600" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaterials.map((material) => (
                <MaterialCard
                  key={material.code}
                  name={material.name}
                  code={material.code}
                  stock={material.stock}
                  location={material.location}
                  uom={material.uom}
                  onSelect={() => handleMaterialSelect(material)}
                />
              ))}
            </div>
          </Card>
        </div>
      ) : (
        /* Transfer History */
        <div className="space-y-4">
          {transferHistory.length > 0 ? (
            transferHistory.map((transfer) => (
              <Card key={transfer.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-zinc-900">{transfer.id}</h3>
                      <Badge className={getStatusColor(transfer.status)}>
                        {transfer.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <div className="text-zinc-600">{t.material}</div>
                        <div className="text-zinc-900">{transfer.material}</div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600">{t.quantity}:</span>
                        <span className="font-medium">{transfer.quantity} {transfer.unit}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600">{t.completedQty}:</span>
                        <span className="font-medium text-emerald-600">{transfer.completed_qty || 0} {transfer.unit}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-600">{t.pendingQty}:</span>
                        <span className="font-medium text-orange-600">{(transfer.quantity - (transfer.completed_qty || 0))} {transfer.unit}</span>
                      </div>
                      <div>
                        <div className="text-zinc-600">From</div>
                        <div className="text-zinc-900">{transfer.from}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">To</div>
                        <div className="text-zinc-900">{transfer.to}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">{t.date}</div>
                        <div className="text-zinc-900">{transfer.date}</div>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="ml-4">
                    {t.viewDetails}
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <ArrowLeftRight className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-zinc-900 mb-2">{t.noTransfers}</h3>
              <p className="text-zinc-600">{t.createFirst}</p>
            </Card>
          )}
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferData.material && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-zinc-200 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-zinc-900">{t.transferMaterial}</h2>
                  <p className="text-sm text-zinc-600">{transferData.material}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferData({});
                  setErrors({});
                }}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">

              {/* Work Order (Top Level Context) */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.workOrder} <span className="text-zinc-400 font-normal">({t.workOrderOptional})</span>
                </label>
                <select
                  value={transferData.workOrderId || ''}
                  onChange={(e) => {
                    const selected = workingOrders.find(wo => wo.id === e.target.value);
                    setTransferData({
                      ...transferData,
                      workOrderId: e.target.value,
                      workOrderNumber: selected?.work_order_number || ''
                    });

                    // Fetch stages for the selected work order
                    if (selected?.work_order_number) {
                      fetchWorkOrderStages(selected.work_order_number);
                    } else {
                      setAvailableStages([]);
                    }
                  }}
                  className="w-full p-2.5 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Work Order</option>
                  {workingOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_number} - {wo.product_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Available Stock Card */}
              <Card className="p-4 bg-zinc-50 border-zinc-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-600 mb-1">{t.availableStock}</div>
                    <div className="text-2xl text-zinc-900 font-semibold">
                      {transferData.availableStock?.toLocaleString()} {transferData.uom}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-zinc-600 mt-1">
                      <MapPin className="w-4 h-4" />
                      {t.currentLocation}: <span className="font-medium text-zinc-900">{transferData.currentLocation}</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                    {transferData.materialCode}
                  </Badge>
                </div>
              </Card>

              {/* Location / Stage Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Location/Stage */}
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">{t.fromLocation} / {t.fromStage}</label>
                  <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-700">
                    {transferData.fromLocation}
                  </div>
                </div>

                {/* To Location/Stage */}
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.toLocation} / {t.toStage} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transferData.toLocation || ''}
                    onChange={(e) => {
                      setTransferData({ ...transferData, toLocation: e.target.value });
                      setErrors({ ...errors, toLocation: '' });
                    }}
                    className={`w-full p-3 border rounded-lg ${errors.toLocation ? 'border-red-500' : 'border-zinc-200'
                      } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  >
                    <option value="">{t.selectDestination}</option>
                    <optgroup label="Warehouses & Floors">
                      {Object.entries(t.locations).map(([key, value]) => (
                        <option key={key} value={value} disabled={value === transferData.fromLocation}>
                          {value}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="WIP Stages">
                      {(transferData.workOrderId && availableStages.length > 0 ? availableStages : wipStages).map((stage) => (
                        <option key={stage.id} value={stage.name} disabled={stage.name === transferData.fromLocation}>
                          {stage.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {errors.toLocation && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.toLocation}
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.transferQuantity} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={transferData.quantity || ''}
                      onChange={(e) => {
                        setTransferData({ ...transferData, quantity: parseFloat(e.target.value) || 0 });
                        setErrors({ ...errors, quantity: '' });
                      }}
                      placeholder={t.enterQuantity}
                      className={`pr-20 ${errors.quantity ? 'border-red-500' : ''}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">
                      {transferData.uom}
                    </span>
                  </div>
                  {errors.quantity && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {errors.quantity}
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.priority || 'Priority'}
                  </label>
                  <select
                    value={transferData.priority || 'Normal'}
                    onChange={(e) => setTransferData({ ...transferData, priority: e.target.value })}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.transferReason} <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferData.transferReason || ''}
                  onChange={(e) => {
                    setTransferData({ ...transferData, transferReason: e.target.value });
                    setErrors({ ...errors, transferReason: '' });
                  }}
                  className={`w-full p-3 border rounded-lg ${errors.transferReason ? 'border-red-500' : 'border-zinc-200'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                >
                  <option value="">{t.selectReason}</option>
                  {Object.entries(t.reasons).map(([key, value]) => (
                    <option key={key} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                {errors.transferReason && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {errors.transferReason}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-zinc-200 p-6 flex gap-3 z-10">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferData({});
                  setErrors({});
                }}
                className="flex-1"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleConfirmTransfer}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmittingTransfer}
              >
                {isSubmittingTransfer ? (
                  'Processing...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t.confirmTransfer}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Transfer Modal */}
      {showStageTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowRight className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-semibold">{t.wipStageTransfer}</h2>
                  <p className="text-sm text-blue-100">{t.stageTransferSubtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowStageTransferModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Work Order - MOVED TO TOP */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.orderReference} <span className="text-red-500">*</span>
                </label>
                <select
                  value={stageTransferData.orderId}
                  onChange={(e) => {
                    const selectedOrder = workingOrders.find(wo => wo.id === e.target.value);
                    setStageTransferData({
                      ...stageTransferData,
                      orderId: e.target.value,
                      orderNumber: selectedOrder?.work_order_number || '',
                      fromStageId: '',
                      toStageId: ''
                    });
                    if (selectedOrder) {
                      fetchWorkOrderStages(selectedOrder.work_order_number);
                    } else {
                      setAvailableStages([]);
                    }
                  }}
                  className="w-full p-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t.enterOrderRef}</option>
                  {workingOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.work_order_number} - {order.product_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage Selection - ONLY SHOW AFTER WORK ORDER SELECTED */}
              {stageTransferData.orderId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-zinc-900 font-medium">
                      {t.fromStage} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={stageTransferData.fromStageId}
                      onChange={(e) => setStageTransferData({ ...stageTransferData, fromStageId: e.target.value })}
                      className="w-full p-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoadingStages || availableStages.length === 0}
                    >
                      <option value="">
                        {isLoadingStages
                          ? 'Loading stages...'
                          : availableStages.length === 0
                            ? 'No stages found'
                            : t.selectFromStage}
                      </option>
                      {availableStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-zinc-900 font-medium">
                      {t.toStage} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={stageTransferData.toStageId}
                      onChange={(e) => setStageTransferData({ ...stageTransferData, toStageId: e.target.value })}
                      className="w-full p-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoadingStages || availableStages.length === 0}
                    >
                      <option value="">
                        {isLoadingStages
                          ? 'Loading stages...'
                          : availableStages.length === 0
                            ? 'No stages found'
                            : t.selectToStage}
                      </option>
                      {availableStages.map((stage) => (
                        <option
                          key={stage.id}
                          value={stage.id}
                          disabled={stage.id === stageTransferData.fromStageId}
                        >
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.quantity} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={stageTransferData.quantity}
                  onChange={(e) => setStageTransferData({ ...stageTransferData, quantity: e.target.value })}
                  placeholder="Enter quantity to transfer"
                  className="border-zinc-300"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  Notes
                </label>
                <textarea
                  value={stageTransferData.notes}
                  onChange={(e) => setStageTransferData({ ...stageTransferData, notes: e.target.value })}
                  placeholder="Add optional notes..."
                  className="w-full p-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-zinc-200 p-6 flex gap-3">
              <Button
                onClick={() => {
                  setShowStageTransferModal(false);
                  setStageTransferData({
                    fromStageId: '',
                    toStageId: '',
                    orderId: '',
                    orderNumber: '',
                    quantity: '',
                    notes: ''
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={async () => {
                  if (!stageTransferData.toStageId || !stageTransferData.orderId || !stageTransferData.quantity) return;
                  if (isSubmittingTransfer) return; // Prevent double-click

                  setIsSubmittingTransfer(true);
                  try {
                    await apiClient.post('/material-transfers/wip-stage-transfer', {
                      order_id: stageTransferData.orderId,
                      from_stage_id: stageTransferData.fromStageId || null,
                      to_stage_id: stageTransferData.toStageId,
                      quantity: parseFloat(stageTransferData.quantity),
                      notes: stageTransferData.notes || undefined
                    });

                    alert(language === 'en' ? 'Stage Transfer Successful!' : 'स्टेज स्थानांतरण सफल!');

                    setShowStageTransferModal(false);
                    setStageTransferData({
                      fromStageId: '',
                      toStageId: '',
                      orderId: '',
                      orderNumber: '',
                      quantity: '',
                      notes: ''
                    });
                    // Refresh data to show updated state
                    fetchWipStages();
                    fetchWorkingOrders();
                    fetchTransferHistory();
                  } catch (err: any) {
                    console.error('Stage transfer failed', err);
                    alert(`Error: ${err?.detail || 'Failed to transfer'}`);
                  } finally {
                    setIsSubmittingTransfer(false);
                  }
                }}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!stageTransferData.toStageId || !stageTransferData.orderId || !stageTransferData.quantity || isSubmittingTransfer}
              >
                {isSubmittingTransfer ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'en' ? 'Processing...' : 'प्रसंस्करण...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t.initiateTransfer}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}