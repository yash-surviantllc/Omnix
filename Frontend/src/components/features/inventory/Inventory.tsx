import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Package, ArrowUpDown, AlertTriangle, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddInventoryModal } from './AddInventoryModal';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { MaterialData, InventoryDisplayItem, Language } from '@/types/inventory';
import { inventoryItemsApi, convertFromMaterialData } from '@/lib/api/inventory';
import { getWsUrl } from '@/lib/api/client';

type InventoryProps = {
  language: Language;
};

export function Inventory({ language }: InventoryProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialData | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch inventory data from API
  useEffect(() => {
    fetchInventoryData();
  }, []);

  // WebSocket for real-time inventory updates
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Connect to WebSocket
    const wsUrl = getWsUrl(`/ws/inventory?token=${token}`);
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Inventory WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'inventory_update') {
          // Refetch inventory on any update
          fetchInventoryData();
        }
      } catch (error) {
        console.error('Inventory WebSocket message parse error:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('Inventory WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('Inventory WebSocket disconnected');
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        // Reconnection will happen on next component mount or manual trigger
      }, 5000);
    };

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inventoryItemsApi.list();
      setInventoryItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory data');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async (newMaterial: MaterialData) => {
    try {
      const apiData = convertFromMaterialData(newMaterial);
      await inventoryItemsApi.create(apiData);
      await fetchInventoryData(); // Refresh list
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Error adding material:', err);
      alert(err.response?.data?.detail || 'Failed to add material');
    }
  };

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const confirmDeleteMaterial = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await inventoryItemsApi.delete(deleteTarget.id);
      await fetchInventoryData();
    } catch (err: any) {
      console.error('Error deleting material:', err);
      alert(err.response?.data?.detail || 'Failed to delete material');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const handleEditMaterial = (id: string) => {
    const item = inventoryItems.find(i => i.id === id);
    if (!item) return;

    setEditingMaterial({
      id: item.id,
      materialCode: item.material_code,
      materialName: item.material_name,
      available: item.quantity,
      unit: item.unit,
      location: item.location || '',
      reorderLevel: item.reorder_level,
      status: item.status,
      unitCost: item.unit_cost,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateMaterial = async (updatedMaterial: MaterialData) => {
    try {
      if (!updatedMaterial.id) return;

      await inventoryItemsApi.update(updatedMaterial.id, {
        material_name: updatedMaterial.materialName,
        quantity: updatedMaterial.available,
        unit: updatedMaterial.unit,
        location: updatedMaterial.location,
        reorder_level: updatedMaterial.reorderLevel,
        unit_cost: updatedMaterial.unitCost,
      });

      await fetchInventoryData(); // Refresh list
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Error updating material:', err);
      alert(err.response?.data?.detail || 'Failed to update material');
    }
  };

  const translations = {
    en: {
      title: 'Inventory',
      search: 'Search materials...',
      filter: 'Filter',
      materialCode: 'Material Code',
      material: 'Material',
      available: 'Available',
      allocated: 'Allocated',
      free: 'Free Stock',
      transit: 'Transit Stock',
      location: 'Location',
      status: 'Status',
      reorderLevel: 'Reorder Level',
      lowStock: 'Low Stock',
      sufficient: 'Sufficient',
      critical: 'Critical',
      unit: 'Unit',
      addInventory: 'Add Inventory',
      totalMaterials: 'Total Materials'
    },
    hi: {
      title: 'सूची',
      search: 'सामग्री खोजें...',
      filter: 'फ़िल्टर',
      materialCode: 'सामग्री कोड',
      material: 'सामग्री',
      available: 'उपलब्ध',
      allocated: 'आवंटित',
      free: 'फ्री स्टॉक',
      transit: 'ट्रांजिट स्टॉक',
      location: 'स्थान',
      status: 'स्थिति',
      reorderLevel: 'पुन: ऑर्डर स्तर',
      lowStock: 'कम स्टॉक',
      sufficient: 'पर्याप्त',
      critical: 'गंभीर',
      unit: 'यूनिट',
      addInventory: 'सूची जोड़ें',
      totalMaterials: 'कुल सामग्री'
    },
    kn: {
      title: 'توجಾರಿ',
      search: 'ಸಾಮಾನಗಳನ್ನು ಹುಡುಕಿ...',
      filter: 'ಶೋಧನೆ',
      materialCode: 'ಸಾಮಾನ ಕೋಡ್',
      material: 'ಸಾಮಾನ',
      available: 'उपलब्ध',
      allocated: 'ವಿಭಾಜಿತ',
      free: 'ಟ್ರಾನ್ಸಿಟ್ ಸ್ಟಾಕ್',
      location: 'ಸ್ಥಾನ',
      status: 'ಸ್ಥಿತಿ',
      reorderLevel: 'ಪುನರಾರ್ಡರ್ ಸ್ಥಾನ',
      lowStock: 'ಕಡಿಮೆ ಸ್ಟಾಕ್',
      sufficient: 'पर्याप्त',
      critical: 'गंभीर',
      unit: 'ಯೂನಿಟ್',
      addInventory: 'ಸೂಚಿ ಸೇರಿಸಿ',
      totalMaterials: 'ಒಟ್ಟು ಸಾಮಾನುಗಳು',
      transit: 'ಟ್ರಾನ್ಸಿಟ್ ಸ್ಟಾಕ್'
    },
    ta: {
      title: 'சரக்கு',
      search: 'சாமன்களை தேடு...',
      filter: 'பிலாட்டர்',
      materialCode: 'பொருள் குறியீடு',
      material: 'சாமனம்',
      available: 'उपलब्ध',
      allocated: 'விதிநिर्धாரித',
      free: 'டிரான்சிட் பங்கு',
      location: 'இடம்',
      status: 'நிலை',
      reorderLevel: 'மீட்டு மேல்',
      lowStock: 'குறைந்த தொகுப்பு',
      sufficient: 'பரம்பரைய',
      critical: 'கритிகல்',
      unit: 'அலகு',
      addInventory: 'பட்டியல் சேர்',
      totalMaterials: 'மொத்த பொருட்கள்',
      transit: 'டிரான்சிட் பங்கு'
    },
    te: {
      title: 'సమావేశం',
      search: 'సమానాలను శోధించు...',
      filter: 'ఫిల్టర్',
      materialCode: 'మెటీరియల్ కోడ్',
      material: 'సమానం',
      available: 'ఉపపడిన',
      allocated: 'విభాజితం',
      free: 'ట్రాన్సిట్ స్టాక్',
      location: 'స్థానం',
      status: 'స్థితి',
      reorderLevel: 'పునరార్డర్ స్థానం',
      lowStock: 'కానీసం స్టాక్',
      sufficient: 'పరిమాణం',
      critical: 'క్రిటికల్',
      unit: 'అలకా',
      addInventory: 'జాబితా జోడించు',
      totalMaterials: 'మొత్తం పదార్థాలు',
      transit: 'ట్రాన్సిట్ స్టాక్'
    },
    mr: {
      title: 'संचय',
      search: 'सामग्री शोधा...',
      filter: 'फळ्टर',
      materialCode: 'सामग्री कोड',
      material: 'सामग्री',
      available: 'उपलब्ध',
      allocated: 'विभाजित',
      free: 'ट्रान्झिट स्टॉक',
      location: 'स्थान',
      status: 'स्थिति',
      reorderLevel: 'पुनरार्डर स्तर',
      lowStock: 'कम स्टॉक',
      sufficient: 'पर्याप्त',
      critical: 'गंभीर',
      unit: 'यूनिट',
      addInventory: 'यादी जोडा',
      totalMaterials: 'एकूण साहित्य',
      transit: 'ट्रान्झिट स्टॉक'
    },
    gu: {
      title: 'સ્થોલ',
      search: 'માટેરિયલ્સ શોધો...',
      filter: 'ફિલ્ટર',
      materialCode: 'સામગ્રી કોડ',
      material: 'માટેરિયલ',
      available: 'ઉપલબ્ધ',
      allocated: 'અનુદાન',
      free: 'ટ્રાન્ઝિટ સ્ટોક',
      location: 'સ્થાન',
      status: 'સ્થિતિ',
      reorderLevel: 'પન્નું આર્ડર સ્તર',
      lowStock: 'નીચું સ્ટોક',
      sufficient: 'પરયાપ્ત',
      critical: 'ક્રિટિકલ',
      unit: 'યૂનિટ',
      addInventory: 'યાદી ઉમેરો',
      totalMaterials: 'કુલ સામગ્રી',
      transit: 'ટ્રાન્ઝિટ સ્ટોક'
    },
    pa: {
      title: 'ਖੋਜ',
      search: 'ਮਾਟੇਰਿਅਲ ਖੋਜੋ...',
      filter: 'ਫਿਲਟਰ',
      materialCode: 'ਸਮੱਗਰੀ ਕੋਡ',
      material: 'ਮਾਟੇਰਿਅਲ',
      available: 'उपलब्ध',
      allocated: 'ਵਿਭਾਜਿਤ',
      free: 'ਫ੍ਰੀ ਸਟਾਕ',
      location: 'ਸਥਾਨ',
      status: 'ਸਥਿਤਿ',
      reorderLevel: 'ਪੁਨ: ਆਰਡਰ ਸਤਰ',
      lowStock: 'ਕਮ ਸਟੋਕ',
      sufficient: 'ਪਰਯਾਪਤ',
      critical: 'ਕ੍ਰਿਟਿਕਲ',
      unit: 'ਯੂਨਿਟ',
      addInventory: 'ਸੂਚੀ ਜੋੜੋ',
      totalMaterials: 'ਕੁੱਲ ਸਮੱਗਰੀ',
      transit: 'ਟ੍ਰਾਂਜਿਟ ਸਟਾਕ'
    }
  };

  const t = translations[language];

  // Normalize status to Title Case so filters, badges, and stats all work
  // regardless of what case legacy DB rows stored (e.g. 'sufficient' → 'Sufficient')
  const normalizeStatus = (raw: string): 'Sufficient' | 'Low Stock' | 'Critical' | 'Out of Stock' => {
    const lower = (raw || '').toLowerCase().trim();
    if (lower === 'out of stock') return 'Out of Stock';
    if (lower === 'critical') return 'Critical';
    if (lower === 'low stock') return 'Low Stock';
    return 'Sufficient';
  };

  const allInventoryItems: InventoryDisplayItem[] = useMemo(() => {
    return inventoryItems.map((item) => {
      const available = item.quantity;
      const allocated = item.allocated_quantity || 0;
      const transit = item.transit_quantity || 0;
      const free = item.free_quantity ?? (available - allocated);
      const reorderLevel = item.reorder_level;
      const status = normalizeStatus(item.status);

      return {
        id: item.id,
        material: item.material_name,
        materialCode: item.material_code,
        available: `${available} ${item.unit}`,
        allocated: `${allocated} ${item.unit}`,
        free: `${free} ${item.unit}`,
        transit: `${transit} ${item.unit}`,
        location: item.location || 'N/A',
        reorderLevel: `${reorderLevel} ${item.unit}`,
        status,
        unit: item.unit,
        // Numeric values for calculations
        availableNum: available,
        freeNum: free,
        transitNum: transit,
        reorderLevelNum: reorderLevel
      } as InventoryDisplayItem;
    });
  }, [inventoryItems]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sufficient':
        return <Badge className="bg-emerald-500">{t.sufficient}</Badge>;
      case 'Low Stock':
        return <Badge className="bg-yellow-500">{t.lowStock}</Badge>;
      case 'Critical':
        return <Badge className="bg-red-500">{t.critical}</Badge>;
      case 'Out of Stock':
        return <Badge className="bg-zinc-500">Out of Stock</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFreeStockBadge = (freeNum: number, reorderLevel: string, freeText: string) => {
    const reorderLevelNum = parseFloat(reorderLevel.split(' ')[0]);

    if (freeNum <= 0) {
      return <Badge className="bg-red-600">{freeText}</Badge>;
    } else if (freeNum <= reorderLevelNum * 0.5) {
      return <Badge className="bg-red-500">{freeText}</Badge>;
    } else if (freeNum <= reorderLevelNum) {
      return <Badge className="bg-yellow-500">{freeText}</Badge>;
    } else if (freeNum <= reorderLevelNum * 1.5) {
      return <Badge className="bg-blue-500">{freeText}</Badge>;
    } else {
      return <Badge className="bg-emerald-500">{freeText}</Badge>;
    }
  };

  // Filter inventory items based on search and filter
  const filteredInventoryItems = useMemo(() => {
    return allInventoryItems.filter((item) => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        (item.material && item.material.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.materialCode && item.materialCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));

      // Status filter
      const matchesFilter = filterStatus === 'all' || item.status === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [allInventoryItems, searchQuery, filterStatus]);

  const criticalCount = allInventoryItems.filter((item) => item.status === 'Critical').length;
  const lowStockCount = allInventoryItems.filter((item) => item.status === 'Low Stock').length;


  return (
    <div className="space-y-6">
      <div>
        <h1>{t.title}</h1>
      </div>

      {/* Stats */}
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Materials Card */}
        <Card className="p-4 border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">{t.totalMaterials}</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">{inventoryItems.length}</h2>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Low Stock Card */}
        <Card className="p-4 border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">{t.lowStock}</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">{lowStockCount}</h2>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <ArrowUpDown className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </Card>

        {/* Critical Card */}
        <Card className="p-4 border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">{t.critical}</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900">{criticalCount}</h2>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </Card>

        {/* Add Inventory Button/Card */}
        <Card
          className="p-4 border border-dashed border-emerald-200 bg-emerald-50/50 cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 group"
          onClick={() => setIsAddModalOpen(true)}
        >
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-sm font-medium text-emerald-700 group-hover:text-emerald-800">{t.addInventory}</p>
              <div className="mt-2 flex items-center gap-1">
                <PlusCircle className="h-5 w-5 text-emerald-600 group-hover:text-emerald-700" />
                <span className="text-xs font-medium text-emerald-600 group-hover:text-emerald-700">New Item</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <PlusCircle className="h-6 w-6 text-emerald-600 group-hover:text-emerald-700" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder={t.search}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-zinc-200 rounded-md text-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{language === 'en' ? 'All Status' : 'सभी स्थिति'}</option>
            <option value="Sufficient">{t.sufficient}</option>
            <option value="Low Stock">{t.lowStock}</option>
            <option value="Critical">{t.critical}</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
        {(searchQuery || filterStatus !== 'all') && (
          <div className="mt-3 text-sm text-zinc-600">
            {language === 'en'
              ? `Showing ${inventoryItems.length} of ${allInventoryItems.length} materials`
              : `${allInventoryItems.length} में से ${inventoryItems.length} सामग्री दिखा रहे हैं`}
            {(searchQuery || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="ml-3 text-blue-600 hover:text-blue-700 font-medium"
              >
                {language === 'en' ? 'Clear filters' : 'फ़िल्टर साफ़ करें'}
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Inventory List - Mobile View */}
      <div className="lg:hidden space-y-3">
        {filteredInventoryItems.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.material}</span>
                  {getStatusBadge(item.status)}
                </div>
                <p className="text-xs text-zinc-500 mb-1">
                  <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded">{item.materialCode}</span>
                </p>
                <p className="text-sm text-zinc-600">{item.location}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditMaterial(item.id)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title={language === 'en' ? 'Update' : 'अपडेट करें'}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: item.id, name: item.material })}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title={language === 'en' ? 'Delete' : 'हटाएं'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">{t.available}:</span>
                <span>{item.available}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">{t.allocated}:</span>
                <span>{item.allocated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">{t.free}:</span>
                <span className={item.freeNum <= item.reorderLevelNum ? 'text-red-600' : 'text-emerald-600'}>
                  {item.free}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 font-medium text-blue-600">{t.transit}:</span>
                <span className="font-medium text-blue-700">{item.transit}</span>
              </div>
            </div>

            {/* Stock Level Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-600">{language === 'en' ? 'Stock Level' : 'स्टॉक स्तर'}</span>
                <span>
                  {item.availableNum > 0 ? Math.round((item.freeNum / item.availableNum) * 100) : 0}% {language === 'en' ? 'free' : 'मुक्त'}
                </span>
              </div>
              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${item.status === 'Critical'
                    ? 'bg-red-500'
                    : item.status === 'Low Stock'
                      ? 'bg-yellow-500'
                      : item.status === 'Out of Stock'
                        ? 'bg-zinc-500'
                        : 'bg-emerald-500'
                    }`}
                  style={{ width: `${item.availableNum > 0 ? (item.freeNum / item.availableNum) * 100 : 0}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Inventory Table - Desktop View */}
      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="text-left p-4">{t.materialCode}</th>
                <th className="text-left p-4">{t.material}</th>
                <th className="text-left p-4">{t.available}</th>
                <th className="text-left p-4">{t.allocated}</th>
                <th className="text-left p-4">{t.free}</th>
                <th className="text-left p-4 font-semibold text-blue-600">{t.transit}</th>
                <th className="text-left p-4">{t.location}</th>
                <th className="text-left p-4">{t.reorderLevel}</th>
                <th className="text-left p-4">{t.status}</th>
                <th className="text-left p-4">{language === 'en' ? 'Actions' : 'क्रियाएँ'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventoryItems.map((item) => (
                <tr key={item.id} className="border-b hover:bg-zinc-50">
                  <td className="p-4">
                    <span className="font-mono text-sm bg-zinc-100 px-2 py-1 rounded">{item.materialCode}</span>
                  </td>
                  <td className="p-4">{item.material}</td>
                  <td className="p-4">
                    {item.available}
                  </td>
                  <td className="p-4">
                    {item.allocated}
                  </td>
                  <td className="p-4">
                    {getFreeStockBadge(item.freeNum, item.reorderLevel, item.free)}
                  </td>
                  <td className="p-4 font-medium text-blue-700">
                    {item.transit}
                  </td>
                  <td className="p-4">{item.location}</td>
                  <td className="p-4">
                    {item.reorderLevel}
                  </td>
                  <td className="p-4">{getStatusBadge(item.status)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditMaterial(item.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title={language === 'en' ? 'Update' : 'अपडेट करें'}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: item.id, name: item.material })}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title={language === 'en' ? 'Delete' : 'हटाएं'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Low Stock Alert */}
      {criticalCount > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-900 mb-1">
                {language === 'en' ? 'Critical Stock Levels' : 'गंभीर स्टॉक स्तर'}
              </h3>
              <p className="text-red-700 text-sm">
                {language === 'en'
                  ? `${criticalCount} material(s) below reorder level. Consider ordering stock.`
                  : `${criticalCount} सामग्री पुन: ऑर्डर स्तर से नीचे। स्टॉक ऑर्डर करने पर विचार करें।`}
              </p>
            </div>
          </div>
        </Card>
      )}

      <AddInventoryModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        language={language}
        onAddMaterial={handleAddMaterial}
        mode="add"
        currentInventory={{}}
      />

      <AddInventoryModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        language={language}
        onUpdateMaterial={handleUpdateMaterial}
        mode="edit"
        initialData={editingMaterial || undefined}
        currentInventory={{}}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDeleteMaterial}
        title={language === 'en'
          ? `Are you sure you want to delete "${deleteTarget?.name}"?`
          : `क्या आप वाकई "${deleteTarget?.name}" को हटाना चाहते हैं?`}
        description={language === 'en'
          ? 'This action cannot be undone. This will permanently remove the material from inventory.'
          : 'यह क्रिया पूर्ववत नहीं की जा सकती। यह सामग्री को इन्वेंटरी से स्थायी रूप से हटा देगा।'}
        confirmLabel={language === 'en' ? 'Delete' : 'हटाएं'}
        cancelLabel={language === 'en' ? 'Cancel' : 'रद्द करें'}
      />
    </div>
  );
}