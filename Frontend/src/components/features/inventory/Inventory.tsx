import { useState, useEffect } from 'react';
import { Search, Package, ArrowUpDown, AlertTriangle, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddInventoryModal } from './AddInventoryModal';
import { MaterialData, InventoryDisplayItem, Language } from '@/types/inventory';
import { inventoryItemsApi, convertFromMaterialData } from '@/services/inventoryItemsApi';

type InventoryProps = {
  language: Language;
};

export function Inventory({ language }: InventoryProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialData | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch inventory data from API
  useEffect(() => {
    fetchInventoryData();
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

  const handleDeleteMaterial = async (id: string, materialName: string) => {
    if (window.confirm(language === 'en' 
      ? `Are you sure you want to delete "${materialName}"?`
      : `क्या आप वाकई "${materialName}" को हटाना चाहते हैं?`)) {
      try {
        await inventoryItemsApi.delete(id);
        await fetchInventoryData(); // Refresh list
      } catch (err: any) {
        console.error('Error deleting material:', err);
        alert(err.response?.data?.detail || 'Failed to delete material');
      }
    }
  };

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
      free: 'मुक्त स्टॉक',
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
      free: 'ಸ್ವತಂತ್ರ ಸ್ಟಾಕ್',
      location: 'ಸ್ಥಾನ',
      status: 'ಸ್ಥಿತಿ',
      reorderLevel: 'ಪುನರಾರ್ಡರ್ ಸ್ಥಾನ',
      lowStock: 'ಕಡಿಮೆ ಸ್ಟಾಕ್',
      sufficient: 'पर्याप्त',
      critical: 'गंभीर',
      unit: 'ಯೂನಿಟ್',
      addInventory: 'ಸೂಚಿ ಸೇರಿಸಿ',
      totalMaterials: 'ಒಟ್ಟು ಸಾಮಾನುಗಳು'
    },
    ta: {
      title: 'சரக்கு',
      search: 'சாமன்களை தேடு...',
      filter: 'பிலாட்டர்',
      materialCode: 'பொருள் குறியீடு',
      material: 'சாமனம்',
      available: 'उपलब्ध',
      allocated: 'விதிநिर्धாரித',
      free: 'தொகுப்பு மூலம்',
      location: 'இடம்',
      status: 'நிலை',
      reorderLevel: 'மீட்டு மேல்',
      lowStock: 'குறைந்த தொகுப்பு',
      sufficient: 'பரம்பரைய',
      critical: 'கритிகல்',
      unit: 'அலகு',
      addInventory: 'பட்டியல் சேர்',
      totalMaterials: 'மொத்த பொருட்கள்'
    },
    te: {
      title: 'సమావేశం',
      search: 'సమానాలను శోధించు...',
      filter: 'ఫిల్టర్',
      materialCode: 'మెటీరియల్ కోడ్',
      material: 'సమానం',
      available: 'ఉపపడిన',
      allocated: 'విభాజితం',
      free: 'ముక్త స్టాక్',
      location: 'స్థానం',
      status: 'స్థితి',
      reorderLevel: 'పునరార్డర్ స్థానం',
      lowStock: 'కానీసం స్టాక్',
      sufficient: 'పరిమాణం',
      critical: 'క్రిటికల్',
      unit: 'అలకా',
      addInventory: 'జాబితా జోడించు',
      totalMaterials: 'మొత్తం పదార్థాలు'
    },
    mr: {
      title: 'संचय',
      search: 'सामग्री शोधा...',
      filter: 'फळ्टर',
      materialCode: 'सामग्री कोड',
      material: 'सामग्री',
      available: 'उपलब्ध',
      allocated: 'विभाजित',
      free: 'मुक्त स्टॉक',
      location: 'स्थान',
      status: 'स्थिति',
      reorderLevel: 'पुनरार्डर स्तर',
      lowStock: 'कम स्टॉक',
      sufficient: 'पर्याप्त',
      critical: 'गंभीर',
      unit: 'यूनिट',
      addInventory: 'यादी जोडा',
      totalMaterials: 'एकूण साहित्य'
    },
    gu: {
      title: 'સ્થોલ',
      search: 'માટેરિયલ્સ શોધો...',
      filter: 'ફિલ્ટર',
      materialCode: 'સામગ્રી કોડ',
      material: 'માટેરિયલ',
      available: 'ઉપલબ્ધ',
      allocated: 'અનુદાન',
      free: 'મુક્ત સ્ટોક',
      location: 'સ્થાન',
      status: 'સ્થિતિ',
      reorderLevel: 'પન્નું આર્ડર સ્તર',
      lowStock: 'નીચું સ્ટોક',
      sufficient: 'પરયાપ્ત',
      critical: 'ક્રિટિકલ',
      unit: 'યૂનિટ',
      addInventory: 'યાદી ઉમેરો',
      totalMaterials: 'કુલ સામગ્રી'
    },
    pa: {
      title: 'ਖੋਜ',
      search: 'ਮਾਟੇਰਿਅਲ ਖੋਜੋ...',
      filter: 'ਫਿਲਟਰ',
      materialCode: 'ਸਮੱਗਰੀ ਕੋਡ',
      material: 'ਮਾਟੇਰਿਅਲ',
      available: 'उपलब्ध',
      allocated: 'ਵਿਭਾਜਿਤ',
      free: 'ਮੁਕਤ ਸਟੋਕ',
      location: 'ਸਥਾਨ',
      status: 'ਸਥਿਤਿ',
      reorderLevel: 'ਪੁਨ: ਆਰਡਰ ਸਤਰ',
      lowStock: 'ਕਮ ਸਟੋਕ',
      sufficient: 'ਪਰਯਾਪਤ',
      critical: 'ਕ੍ਰਿਟਿਕਲ',
      unit: 'ਯੂਨਿਟ',
      addInventory: 'ਸੂਚੀ ਜੋੜੋ',
      totalMaterials: 'ਕੁੱਲ ਸਮੱਗਰੀ'
    }
  };

  const t = translations[language];

  const allInventoryItems: InventoryDisplayItem[] = inventoryItems.map((item) => {
    const available = item.quantity;
    const allocated = item.allocated_quantity || 0;
    const free = item.free_quantity || available;
    const reorderLevel = item.reorder_level;
    
    return {
      id: item.id,
      material: item.material_name,
      materialCode: item.material_code,
      available: `${available} ${item.unit}`,
      allocated: `${allocated} ${item.unit}`,
      free: `${free} ${item.unit}`,
      location: item.location || 'N/A',
      reorderLevel: `${reorderLevel} ${item.unit}`,
      status: item.status as 'sufficient' | 'low' | 'critical',
      unit: item.unit,
      // Numeric values for calculations
      availableNum: available,
      freeNum: free
    } as InventoryDisplayItem;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sufficient':
        return <Badge className="bg-emerald-500">{t.sufficient}</Badge>;
      case 'low':
        return <Badge className="bg-yellow-500">{t.lowStock}</Badge>;
      case 'critical':
        return <Badge className="bg-red-500">{t.critical}</Badge>;
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
  const filteredInventoryItems = allInventoryItems.filter((item) => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      (item.material && item.material.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.materialCode && item.materialCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Status filter
    const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const totalMaterials = inventoryItems.length;
  const criticalCount = allInventoryItems.filter((item) => item.status === 'critical').length;
  const lowStockCount = allInventoryItems.filter((item) => item.status === 'low').length;
  const sufficientCount = allInventoryItems.filter((item) => item.status === 'sufficient').length;

  return (
    <div className="space-y-6">
      <div>
        <h1>{t.title}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">{t.totalMaterials}</p>
              <h2 className="mt-1">{inventoryItems.length}</h2>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-500 text-white flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">{t.lowStock}</p>
              <h2 className="mt-1">{lowStockCount}</h2>
            </div>
            <div className="h-12 w-12 rounded-lg bg-yellow-500 text-white flex items-center justify-center">
              <ArrowUpDown className="h-6 w-6" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">{t.critical}</p>
              <h2 className="mt-1">{criticalCount}</h2>
            </div>
            <div className="h-12 w-12 rounded-lg bg-red-500 text-white flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </Card>
        <Card 
          className="p-4 cursor-pointer hover:shadow-lg transition-shadow" 
          onClick={() => setIsAddModalOpen(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">{t.addInventory}</p>
              <h2 className="mt-1 text-emerald-600">+</h2>
            </div>
            <div className="h-12 w-12 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <PlusCircle className="h-6 w-6" />
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
            <option value="sufficient">{t.sufficient}</option>
            <option value="low">{t.lowStock}</option>
            <option value="critical">{t.critical}</option>
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
                  onClick={() => handleDeleteMaterial(item.id, item.material)}
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
                <span className={item.free <= item.reorderLevel ? 'text-red-600' : 'text-emerald-600'}>
                  {item.free}
                </span>
              </div>
            </div>

            {/* Stock Level Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-600">{language === 'en' ? 'Stock Level' : 'स्टॉक स्तर'}</span>
                <span>
                  {Math.round((item.freeNum / item.availableNum) * 100)}% {language === 'en' ? 'free' : 'मुक्त'}
                </span>
              </div>
              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    item.status === 'critical'
                      ? 'bg-red-500'
                      : item.status === 'low'
                      ? 'bg-yellow-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(item.freeNum / item.availableNum) * 100}%` }}
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
                        onClick={() => handleDeleteMaterial(item.id, item.material)}
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
    </div>
  );
}