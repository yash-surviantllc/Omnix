import { useState } from 'react';
import { ArrowLeftRight, X, Check, AlertCircle, History, Search, ArrowRight, MapPin, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { INVENTORY_STOCK, WIP_STAGES } from '@/lib/apparel-data';
import { MaterialCard } from './components/MaterialCard';

type MaterialTransferProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

type TransferData = {
  material: string;
  materialCode: string;
  availableStock: number;
  currentLocation: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  transferReason: string;
  uom: string;
};

export function MaterialTransfer({ language }: MaterialTransferProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState<Partial<TransferData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // Stage transfer state
  const [showStageTransferModal, setShowStageTransferModal] = useState(false);
  const [stageTransferData, setStageTransferData] = useState({
    fromStage: '',
    toStage: '',
    orderRef: '',
    productCode: '',
    materials: [{ name: '', quantity: '', uom: 'pcs' }]
  });

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
      newStageTransfer: '+ New Stage Transfer',
      fromStage: 'From Stage',
      toStage: 'To Stage',
      selectFromStage: 'Select source stage',
      selectToStage: 'Select destination stage',
      orderReference: 'Order Reference',
      enterOrderRef: 'Enter PO number',
      productCode: 'Product Code',
      enterProductCode: 'Enter product code (e.g., TS-001)',
      addMaterial: '+ Add Material',
      removeMaterial: 'Remove',
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
      locations: {
        rmStoreA: 'RM Store A',
        rmStoreB: 'RM Store B',
        cutting: 'Cutting Floor',
        sewing: 'Sewing Floor',
        finishing: 'Finishing Floor',
        qc: 'QC Floor',
        packing: 'Packing Floor',
        fgWarehouse: 'FG Warehouse'
      },
      transferId: 'Transfer ID',
      material: 'Material',
      quantity: 'Quantity',
      from: 'From',
      to: 'To',
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
      newStageTransfer: '+ नया स्टेज ट्रांसफर',
      fromStage: 'स्टेज से',
      toStage: 'स्टेज तक',
      selectFromStage: 'स्रोत स्टेज चुनें',
      selectToStage: 'गंतव्य स्टेज चुनें',
      orderReference: 'ऑर्डर संदर्भ',
      enterOrderRef: 'PO नंबर दर्ज करें',
      productCode: 'उत्पाद कोड',
      enterProductCode: 'उत्पाद कोड दर्ज करें (जैसे, TS-001)',
      addMaterial: '+ सामग्री जोड़ें',
      removeMaterial: 'हटाएं',
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
      locations: {
        rmStoreA: 'RM स्टोर A',
        rmStoreB: 'RM स्टोर B',
        cutting: 'कटिंग फ्लोर',
        sewing: 'सिलाई फ्लोर',
        finishing: 'फिनिशिंग फ्लोर',
        qc: 'QC फ्लोर',
        packing: 'पैकिंग फ्लोर',
        fgWarehouse: 'FG वेयरहाउस'
      },
      transferId: 'स्थानांतरण ID',
      material: 'सामग्री',
      quantity: 'मात्रा',
      from: 'से',
      to: 'तक',
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
      }
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  // Sample transfer history
  const transferHistory = [
    {
      id: 'TRF-1001',
      material: 'Cotton Fabric',
      quantity: '50 kg',
      from: 'RM Store A',
      to: 'Cutting Floor',
      status: 'completed',
      date: '2025-11-30',
      reason: 'Production Requirement'
    },
    {
      id: 'TRF-1002',
      material: 'Thread (White)',
      quantity: '5000 m',
      from: 'RM Store A',
      to: 'Sewing Floor',
      status: 'completed',
      date: '2025-11-30',
      reason: 'Production Requirement'
    },
    {
      id: 'TRF-1003',
      material: 'Fleece Fabric',
      quantity: '30 kg',
      from: 'RM Store B',
      to: 'Cutting Floor',
      status: 'in_progress',
      date: '2025-12-01',
      reason: 'Production Requirement'
    }
  ];

  // Get materials from inventory
  const materials = Object.entries(INVENTORY_STOCK).map(([name, data], index) => {
    // Generate RM/BOP codes based on material type
    let rmCode = '';
    if (name.toLowerCase().includes('fabric')) {
      rmCode = 'RM-FAB-' + (1001 + index).toString();
    } else if (name.toLowerCase().includes('thread') || name.toLowerCase().includes('sewing')) {
      rmCode = 'RM-THD-' + (2001 + index).toString();
    } else if (name.toLowerCase().includes('zipper')) {
      rmCode = 'RM-ZIP-' + (3001 + index).toString();
    } else if (name.toLowerCase().includes('elastic') || name.toLowerCase().includes('drawcord')) {
      rmCode = 'RM-TRM-' + (4001 + index).toString();
    } else if (name.toLowerCase().includes('label') || name.toLowerCase().includes('polybag') || name.toLowerCase().includes('box')) {
      rmCode = 'BOP-PKG-' + (5001 + index).toString();
    } else {
      rmCode = 'RM-ACC-' + (6001 + index).toString();
    }

    return {
      name,
      code: rmCode,
      stock: data.qty || 0,
      location: data.location || 'RM Store A',
      uom: data.unit || 'kg'
    };
  });

  // Filter materials based on search query
  const filteredMaterials = materials.filter((material) =>
    material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMaterialSelect = (material: typeof materials[0]) => {
    setTransferData({
      material: material.name,
      materialCode: material.code,
      availableStock: material.stock,
      currentLocation: material.location,
      fromLocation: material.location,
      uom: material.uom,
      quantity: 0,
      toLocation: '',
      transferReason: ''
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

    if (!transferData.toLocation) {
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

  const handleConfirmTransfer = () => {
    if (validateTransfer()) {
      // Process transfer
      console.log('Transfer confirmed:', transferData);
      setShowTransferModal(false);
      setTransferData({});
      // Show success message
      alert(`✅ Transfer initiated: ${transferData.quantity} ${transferData.uom} ${transferData.material} from ${transferData.fromLocation} to ${transferData.toLocation}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-zinc-900 mb-2">{t.title}</h1>
        <p className="text-zinc-600">{t.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'new'
              ? 'border-emerald-600 text-emerald-900'
              : 'border-transparent text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {t.newTransfer}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'history'
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
              {WIP_STAGES.map((stage, index) => (
                <div key={stage.id} className="flex items-center">
                  <div className="text-center">
                    <div className={`px-4 py-2 rounded-lg border-2 ${ stage.health === 'healthy' ? 'bg-green-50 border-green-300 text-green-900' : stage.health === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
                      <div className="text-sm">{stage.name}</div>
                      <div className="text-xs mt-1 opacity-75">{stage.items} units</div>
                    </div>
                  </div>
                  {index < WIP_STAGES.length - 1 && (
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
                      <div>
                        <div className="text-zinc-600">{t.quantity}</div>
                        <div className="text-zinc-900">{transfer.quantity}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">{t.from}</div>
                        <div className="text-zinc-900">{transfer.from}</div>
                      </div>
                      <div>
                        <div className="text-zinc-600">{t.to}</div>
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
            <div className="sticky top-0 bg-white border-b border-zinc-200 p-6 flex items-center justify-between">
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
              {/* Available Stock Card */}
              <Card className="p-4 bg-zinc-50 border-zinc-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-600 mb-1">{t.availableStock}</div>
                    <div className="text-2xl text-zinc-900">
                      {transferData.availableStock?.toLocaleString()} {transferData.uom}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-zinc-600 mt-1">
                      <MapPin className="w-4 h-4" />
                      {t.currentLocation}: {transferData.currentLocation}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                    {transferData.materialCode}
                  </Badge>
                </div>
              </Card>

              {/* Transfer Quantity */}
              <div>
                <label className="block mb-2 text-zinc-900">
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
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

              {/* From Location */}
              <div>
                <label className="block mb-2 text-zinc-900">{t.fromLocation}</label>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900">
                  {transferData.fromLocation}
                </div>
              </div>

              {/* To Location */}
              <div>
                <label className="block mb-2 text-zinc-900">
                  {t.toLocation} <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferData.toLocation || ''}
                  onChange={(e) => {
                    setTransferData({ ...transferData, toLocation: e.target.value });
                    setErrors({ ...errors, toLocation: '' });
                  }}
                  className={`w-full p-3 border rounded-lg ${
                    errors.toLocation ? 'border-red-500' : 'border-zinc-200'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                >
                  <option value="">{t.selectDestination}</option>
                  {Object.entries(t.locations).map(([key, value]) => (
                    <option key={key} value={value} disabled={value === transferData.fromLocation}>
                      {value}
                    </option>
                  ))}
                </select>
                {errors.toLocation && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {errors.toLocation}
                  </div>
                )}
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block mb-2 text-zinc-900">
                  {t.transferReason} <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferData.transferReason || ''}
                  onChange={(e) => {
                    setTransferData({ ...transferData, transferReason: e.target.value });
                    setErrors({ ...errors, transferReason: '' });
                  }}
                  className={`w-full p-3 border rounded-lg ${
                    errors.transferReason ? 'border-red-500' : 'border-zinc-200'
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
            <div className="sticky bottom-0 bg-white border-t border-zinc-200 p-6 flex gap-3">
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
              >
                <Check className="w-4 h-4 mr-2" />
                {t.confirmTransfer}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Stage Transfer Modal */}
      {showStageTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowRight className="w-6 h-6" />
                <div>
                  <h2 className="text-2xl">{t.wipStageTransfer}</h2>
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
            <div className="p-8 space-y-6">
              {/* Stage Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.fromStage} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={stageTransferData.fromStage}
                    onChange={(e) => setStageTransferData({ ...stageTransferData, fromStage: e.target.value })}
                    className="w-full p-3 border-2 border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t.selectFromStage}</option>
                    {WIP_STAGES.map((stage) => (
                      <option key={stage.id} value={stage.name}>
                        {stage.name} ({stage.items} units)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.toStage} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={stageTransferData.toStage}
                    onChange={(e) => setStageTransferData({ ...stageTransferData, toStage: e.target.value })}
                    className="w-full p-3 border-2 border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t.selectToStage}</option>
                    {WIP_STAGES.map((stage) => (
                      <option 
                        key={stage.id} 
                        value={stage.name}
                        disabled={stage.name === stageTransferData.fromStage}
                      >
                        {stage.name} ({stage.items} units)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stage Flow Preview */}
              {stageTransferData.fromStage && stageTransferData.toStage && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center justify-center gap-4">
                    <div className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md font-medium">
                      {stageTransferData.fromStage}
                    </div>
                    <ArrowRight className="w-8 h-8 text-blue-600 animate-pulse" />
                    <div className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md font-medium">
                      {stageTransferData.toStage}
                    </div>
                  </div>
                </div>
              )}

              {/* Order Reference & Product Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.orderReference} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={stageTransferData.orderRef}
                    onChange={(e) => setStageTransferData({ ...stageTransferData, orderRef: e.target.value })}
                    placeholder={t.enterOrderRef}
                    className="border-2"
                  />
                </div>
                
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.productCode} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={stageTransferData.productCode}
                    onChange={(e) => setStageTransferData({ ...stageTransferData, productCode: e.target.value })}
                    placeholder={t.enterProductCode}
                    className="border-2"
                  />
                </div>
              </div>

              {/* Materials */}
              <div>
                <label className="block mb-3 text-zinc-900 font-medium">
                  Materials <span className="text-red-500">*</span>
                </label>
                
                <div className="space-y-3">
                  {stageTransferData.materials.map((material, index) => (
                    <div key={index} className="flex gap-3 p-4 bg-zinc-50 rounded-lg border-2 border-zinc-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={material.name}
                          onChange={(e) => {
                            const newMaterials = [...stageTransferData.materials];
                            newMaterials[index].name = e.target.value;
                            setStageTransferData({ ...stageTransferData, materials: newMaterials });
                          }}
                          placeholder={t.enterMaterialName}
                          className="w-full p-2 border border-zinc-300 rounded"
                        />
                      </div>
                      
                      <div className="w-32">
                        <input
                          type="number"
                          value={material.quantity}
                          onChange={(e) => {
                            const newMaterials = [...stageTransferData.materials];
                            newMaterials[index].quantity = e.target.value;
                            setStageTransferData({ ...stageTransferData, materials: newMaterials });
                          }}
                          placeholder={t.quantity}
                          className="w-full p-2 border border-zinc-300 rounded"
                        />
                      </div>
                      
                      <div className="w-24">
                        <select
                          value={material.uom}
                          onChange={(e) => {
                            const newMaterials = [...stageTransferData.materials];
                            newMaterials[index].uom = e.target.value;
                            setStageTransferData({ ...stageTransferData, materials: newMaterials });
                          }}
                          className="w-full p-2 border border-zinc-300 rounded"
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="m">m</option>
                          <option value="L">L</option>
                        </select>
                      </div>
                      
                      {stageTransferData.materials.length > 1 && (
                        <button
                          onClick={() => {
                            const newMaterials = stageTransferData.materials.filter((_, i) => i !== index);
                            setStageTransferData({ ...stageTransferData, materials: newMaterials });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <Button
                  onClick={() => setStageTransferData({
                    ...stageTransferData,
                    materials: [...stageTransferData.materials, { name: '', quantity: '', uom: 'pcs' }]
                  })}
                  variant="outline"
                  className="w-full mt-3 border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Package className="w-4 h-4 mr-2" />
                  {t.addMaterial}
                </Button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t-2 border-zinc-200 p-6 flex gap-3">
              <Button
                onClick={() => {
                  setShowStageTransferModal(false);
                  setStageTransferData({
                    fromStage: '',
                    toStage: '',
                    orderRef: '',
                    productCode: '',
                    materials: [{ name: '', quantity: '', uom: 'pcs' }]
                  });
                }}
                variant="outline"
                className="flex-1 border-2"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={() => {
                  const summary = stageTransferData.materials
                    .filter(m => m.name && m.quantity)
                    .map(m => `${m.quantity} ${m.uom} ${m.name}`)
                    .join(', ');
                    
                  alert(`✅ ${language === 'en' ? 'Stage Transfer Initiated!' : 'स्टेज स्थानांतरण शुरू किया गया!'}

From: ${stageTransferData.fromStage}
To: ${stageTransferData.toStage}
Order: ${stageTransferData.orderRef}
Product Code: ${stageTransferData.productCode}
Materials: ${summary}`);
                  
                  setShowStageTransferModal(false);
                  setStageTransferData({
                    fromStage: '',
                    toStage: '',
                    orderRef: '',
                    productCode: '',
                    materials: [{ name: '', quantity: '', uom: 'pcs' }]
                  });
                }}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                disabled={!stageTransferData.fromStage || !stageTransferData.toStage || !stageTransferData.orderRef || !stageTransferData.productCode}
              >
                <Check className="w-4 h-4 mr-2" />
                {t.initiateTransfer}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}