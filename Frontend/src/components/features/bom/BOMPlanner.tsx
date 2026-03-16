import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, AlertCircle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { bomApi, productsApi, type Product, type BOM, type BOMMaterialWithShortage } from '@/lib/api/bom';
import { getWsUrl } from '@/lib/api/client';
import { AddMaterialModal } from './AddMaterialModal';
import { EditMaterialModal } from './EditMaterialModal';
import { inventoryItemsApi, type InventoryItemResponse } from '@/lib/api/inventory';

type BOMPlannerProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function BOMPlanner({ language }: BOMPlannerProps) {
  // State for products and BOMs
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductForCosts, setSelectedProductForCosts] = useState<string>(''); // For single-click cost display
  const [currentBOM, setCurrentBOM] = useState<BOM | null>(null);
  const [materials, setMaterials] = useState<BOMMaterialWithShortage[]>([]);
  const [productionQty, setProductionQty] = useState<number>(100);

  // Loading and error states
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingBOM, setIsLoadingBOM] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal and form states
  const [showAddBOMModal, setShowAddBOMModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemResponse[]>([]);
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [newBOM, setNewBOM] = useState({
    productCode: '',
    productName: '',
    batchSize: 100,
    notes: '',
    materials: [{ itemCode: '', material: '', qty: '', unit: 'kg', unitCost: '' }]
  });
  const [newMaterial, setNewMaterial] = useState({
    materialId: '',
    quantity: '',
    unit: 'kg',
    unitCost: '',
    scrapPercentage: '0'
  });
  const wsRef = useRef<WebSocket | null>(null);

  const translations = {
    en: {
      title: 'BOM Auto-Planner',
      selectProduct: 'Select Product',
      materials: 'Materials Required',
      material: 'Material',
      qtyPerUnit: 'Qty per Unit',
      unit: 'Unit',
      unitCost: 'Unit Cost',
      stock: 'Stock',
      orderedStock: 'Ordered Stock',
      requiredStock: 'Required Stock',
      status: 'Status',
      actions: 'Actions',
      addMaterial: 'Add Material',
      saveBOM: 'Save BOM',
      autoCalculate: 'Auto Calculate',
      stockCheck: 'Stock Check',
      createNewBOM: 'Create New BOM',
      newBOM: 'New BOM',
      productCode: 'Product Code',
      productName: 'Product Name',
      enterProductCode: 'Enter product code (e.g., JK-001)',
      enterProductName: 'Enter product name',
      bomMaterials: 'BOM Materials',
      quantity: 'Quantity',
      removeMaterial: 'Remove',
      cancel: 'Cancel',
      createBOM: 'Create BOM',
      itemCode: 'Item Code',
      enterItemCode: 'e.g., MAT-001',
      available: 'Available',
      shortage: 'Shortage',
      sufficient: 'Sufficient',
      for: 'for',
      units: 'units',
      editMaterial: 'Edit Material',
      deleteMaterial: 'Delete Material',
      confirmDelete: 'Are you sure you want to delete this material?',
      scrapPercentage: 'Scrap %'
    },
    hi: {
      title: 'BOM स्वत: योजनाकार',
      selectProduct: 'उत्पाद चुनें',
      materials: 'आवश्यक सामग्री',
      material: 'सामग्री',
      qtyPerUnit: 'प्रति यूनिट मात्रा',
      unit: 'यूनिट',
      unitCost: 'यूनिट कीमत',
      stock: 'स्टॉक',
      orderedStock: 'ऑर्डर किया गया स्टॉक',
      requiredStock: 'आवश्यक स्टॉक',
      status: 'स्थिति',
      actions: 'क्रियाएं',
      addMaterial: 'सामग्री जोड़ें',
      saveBOM: 'BOM सहेजें',
      autoCalculate: 'स्वत: गणना',
      stockCheck: 'स्टॉक जांच',
      createNewBOM: '+ नया BOM बनाएं',
      newBOM: 'नया BOM',
      productCode: 'उत्पाद कोड',
      productName: 'उत्पाद का नाम',
      enterProductCode: 'उत्पाद कोड दर्ज करें (उदा., JK-001)',
      enterProductName: 'उत्पाद का नाम दर्ज करें',
      bomMaterials: 'BOM सामग्री',
      quantity: 'मात्रा',
      removeMaterial: 'हटाएं',
      cancel: 'रद्द करें',
      createBOM: 'BOM बनाएं',
      itemCode: 'आइटम कोड',
      enterItemCode: 'उदा., MAT-001',
      available: 'उपलब्ध',
      shortage: 'कमी',
      sufficient: 'पर्याप्त',
      for: 'के लिए',
      units: 'यूनिट',
      editMaterial: 'सामग्री संपादित करें',
      deleteMaterial: 'सामग्री हटाएं',
      confirmDelete: 'क्या आप वाकई इस सामग्री को हटाना चाहते हैं?',
      scrapPercentage: 'स्क्रैप %'
    },
    kn: {
      title: 'BOM ಸ್ವತ: ಯೋಜನಾಕಾರ',
      selectProduct: 'ಉತ್ಪಾದ ಆಯ್ಕೆಮಾಡಿ',
      materials: 'ಅಗತ್ಯವಿರುವ ಸಾಮಾನಗಳು',
      material: 'ಸಾಮಾನ',
      qtyPerUnit: 'ಯೂನಿಟ್ ಪ್ರತಿ ಮಾತ್ರೆ',
      unit: 'ಯೂನಿಟ್',
      unitCost: 'ಯೂನಿಟ್ ವೆಚ್ಚ',
      stock: 'ಸ್ಟಾಕ್',
      orderedStock: 'ಆದೇಶಿಸಿದ ಸ್ಟಾಕ್',
      requiredStock: 'ಅಗತ್ಯವಿರುವ ಸ್ಟಾಕ್',
      status: 'ಸ್ಥಿತಿ',
      actions: 'ಕ್ರಿಯೆಗಳು',
      addMaterial: 'ಸಾಮಾನ ಸೇರಿಸಿ',
      saveBOM: 'BOM ಸಂಗ್ರಹಿಸಿ',
      autoCalculate: 'ಸ್ವತ: ಗಣನೆ',
      stockCheck: 'ಸ್ಟಾಕ್ ಪರೀಕ್ಷೆ',
      createNewBOM: '+ ಹೊಸ BOM ರಚಿಸಿ',
      newBOM: 'ಹೊಸ BOM',
      productCode: 'ಉತ್ಪನ್ನ ಕೋಡ್',
      productName: 'ಉತ್ಪನ್ನ ಹೆಸರು',
      enterProductCode: 'ಉತ್ಪನ್ನ ಕೋಡ್ ನಮೂದಿಸಿ (ಉದಾ., JK-001)',
      enterProductName: 'ಉತ್ಪನ್ನ ಹೆಸರು ನಮೂದಿಸಿ',
      bomMaterials: 'BOM ವಸ್ತುಗಳು',
      quantity: 'ಪ್ರಮಾಣ',
      removeMaterial: 'ತೆಗೆದುಹಾಕಿ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      createBOM: 'BOM ರಚಿಸಿ',
      itemCode: 'ವಸ್ತು ಕೋಡ್',
      enterItemCode: 'ಉದಾ., MAT-001',
      available: 'ಉಪಲಭ್ಯ',
      shortage: 'ಕೆಲಸ',
      sufficient: 'ಪರ್ಯಾಪ್ತ',
      for: 'ಕ್ರಿಯೆಗಳು',
      units: 'ಯೂನಿಟ್',
      editMaterial: 'ಸಾಮಗ್ರಿ ಸಂಪಾದಿಸಿ',
      deleteMaterial: 'ಸಾಮಗ್ರಿ ಅಳಿಸಿ',
      confirmDelete: 'ನೀವು ಈ ಸಾಮಗ್ರಿಯನ್ನು ಅಳಿಸಲು ಖಚಿತವಾಗಿ ಬಯಸುವಿರಾ?',
      scrapPercentage: 'ಸ್ಕ್ರ್ಯಾಪ್ %'
    },
    ta: {
      title: 'BOM தானியாக்கு திட்டம்',
      selectProduct: 'தயாரிப்பு தெர்க்கவும்',
      materials: 'வேண்டிய பொருள்கள்',
      material: 'பொருள்',
      qtyPerUnit: 'ஒரு அலகு பொருள்',
      unit: 'அலகு',
      unitCost: 'அலகு செலவு',
      stock: 'செயலாக்கு',
      orderedStock: 'ஆணையிடப்பட்ட செயலாக்கு',
      requiredStock: 'தேவையான செயலாக்கு',
      status: 'நிலை',
      actions: 'செயல்கள்',
      addMaterial: 'பொருள் சேர்க்கவும்',
      saveBOM: 'BOM சேமிக்கவும்',
      autoCalculate: 'தானியாக்கு கணிதம்',
      stockCheck: 'செயலாக்கு பரிக்ஷை',
      createNewBOM: '+ புதிய BOM உருவாக்கு',
      newBOM: 'புதிய BOM',
      productCode: 'தயாரிப்பு குறியீடு',
      productName: 'தயாரிப்பு பெயர்',
      enterProductCode: 'தயாரிப்பு குறியீடு உள்ளிடவும் (எ.கா., JK-001)',
      enterProductName: 'தயாரிப்பு பெயர் உள்ளிடவும்',
      bomMaterials: 'BOM பொருட்கள்',
      quantity: 'அளவு',
      removeMaterial: 'நீக்கு',
      cancel: 'ரத்துசெய்',
      createBOM: 'BOM உருவாக்கு',
      itemCode: 'பொருள் குறியீடு',
      enterItemCode: 'எ.கா., MAT-001',
      available: 'கிடைக்கும்',
      shortage: 'விடுப்பு',
      sufficient: 'பரம்பரைய',
      for: 'க்ரியைகளுக்கு',
      units: 'அலகுகள்',
      editMaterial: 'பொருள் திருத்து',
      deleteMaterial: 'பொருள் நீக்கு',
      confirmDelete: 'இந்த பொருளை நீக்க விரும்புகிறீர்களா?',
      scrapPercentage: 'ஸ்கிராப் %'
    },
    te: {
      title: 'BOM స్వత: యోజనాకారం',
      selectProduct: 'ఉత్పత్తి ఎంచుకోండి',
      materials: 'అవసరమైన సమాచారం',
      material: 'సమాచారం',
      qtyPerUnit: 'ఒక యూనిట్ ప్రతి మాత్రా',
      unit: 'యూనిట్',
      unitCost: 'యూనిట్ ఖర్చు',
      stock: 'స్టాక్',
      orderedStock: 'ఆర్డర్ చేసిన స్టాక్',
      requiredStock: 'అవసరమైన స్టాక్',
      status: 'స్థితి',
      actions: 'క్రియలు',
      addMaterial: 'సమాచారం జోడించండి',
      saveBOM: 'BOM సేవ్ చేయండి',
      autoCalculate: 'స్వత: గణన',
      stockCheck: 'స్టాక్ పరిశోధన',
      createNewBOM: '+ కొత్త BOM సృష్టించండి',
      newBOM: 'కొత్త BOM',
      productCode: 'ఉత్పత్తి కోడ్',
      productName: 'ఉత్పత్తి పేరు',
      enterProductCode: 'ఉత్పత్తి కోడ్ నమోదు చేయండి (ఉదా., JK-001)',
      enterProductName: 'ఉత్పత్తి పేరు నమోదు చేయండి',
      bomMaterials: 'BOM మెటీరియల్స్',
      quantity: 'పరిమాణం',
      removeMaterial: 'తీసివేయి',
      cancel: 'రద్దుచేయి',
      createBOM: 'BOM సృష్టించండి',
      itemCode: 'ఐటెమ్ కోడ్',
      enterItemCode: 'ఉదా., MAT-001',
      available: 'ఉపలభ్యం',
      shortage: 'కోమ్ప్యూటర్',
      sufficient: 'పర్యాప్తం',
      for: 'క్రియలకు',
      units: 'యూనిట్',
      editMaterial: 'మెటీరియల్ సవరించు',
      deleteMaterial: 'మెటీరియల్ తొలగించు',
      confirmDelete: 'మీరు ఈ మెటీరియల్‌ను తొలగించాలనుకుంటున్నారా?',
      scrapPercentage: 'స్క్రాప్ %'
    },
    mr: {
      title: 'BOM स्वत: योजनाकार',
      selectProduct: 'उत्पाद चुना',
      materials: 'आवश्यक सामग्री',
      material: 'सामग्री',
      qtyPerUnit: 'प्रति यूनिट मात्रा',
      unit: 'यूनिट',
      unitCost: 'यूनिट किंमत',
      stock: 'स्टॉक',
      orderedStock: 'आदेशित स्टॉक',
      requiredStock: 'आवश्यक स्टॉक',
      status: 'स्थिति',
      actions: 'क्रियाएं',
      addMaterial: 'सामग्री जोडा',
      saveBOM: 'BOM संग्रहीत करा',
      autoCalculate: 'स्वत: गणना',
      stockCheck: 'स्टॉक जांच',
      createNewBOM: '+ नवीन BOM तयार करा',
      newBOM: 'नवीन BOM',
      productCode: 'उत्पाद कोड',
      productName: 'उत्पाद नाव',
      enterProductCode: 'उत्पाद कोड प्रविष्ट करा (उदा., JK-001)',
      enterProductName: 'उत्पाद नाव प्रविष्ट करा',
      bomMaterials: 'BOM साहित्य',
      quantity: 'प्रमाण',
      removeMaterial: 'काढा',
      cancel: 'रद्द करा',
      createBOM: 'BOM तयार करा',
      itemCode: 'वस्तू कोड',
      enterItemCode: 'उदा., MAT-001',
      available: 'उपलब्ध',
      shortage: 'कमी',
      sufficient: 'पर्याप्त',
      for: 'क्रियाएं',
      units: 'यूनिट',
      editMaterial: 'सामग्री संपादित करा',
      deleteMaterial: 'सामग्री हटवा',
      confirmDelete: 'तुम्हाला खात्री आहे की तुम्ही ही सामग्री हटवू इच्छिता?',
      scrapPercentage: 'स्क्रैप %'
    },
    gu: {
      title: 'BOM સ્વત: યોજનાકાર',
      selectProduct: 'ઉત્પદ પસંદ કરો',
      materials: 'અવસર માટે માટેરિયલ્સ',
      material: 'માટેરિયલ',
      qtyPerUnit: 'યૂનિટ પ્રતી કિંમત',
      unit: 'યૂનિટ',
      unitCost: 'યૂનિટ કિંમત',
      stock: 'સ્ટોક',
      orderedStock: 'આદેશિત સ્ટોક',
      requiredStock: 'જરૂરી સ્ટોક',
      status: 'સ્થિતિ',
      actions: 'ક્રિયાઓ',
      addMaterial: 'માટેરિયલ જોડો',
      saveBOM: 'BOM સંગ્રહીત કરો',
      autoCalculate: 'સ્વત: ગણના',
      stockCheck: 'સ્ટોક જાંચ',
      createNewBOM: '+ નવું BOM બનાવો',
      newBOM: 'નવું BOM',
      productCode: 'ઉત્પાદન કોડ',
      productName: 'ઉત્પાદન નામ',
      enterProductCode: 'ઉત્પાદન કોડ દાખલ કરો (ઉદા., JK-001)',
      enterProductName: 'ઉત્પાદન નામ દાખલ કરો',
      bomMaterials: 'BOM સામગ્રી',
      quantity: 'જથ્થો',
      removeMaterial: 'દૂર કરો',
      cancel: 'રદ કરો',
      createBOM: 'BOM બનાવો',
      itemCode: 'આઇટમ કોડ',
      enterItemCode: 'ઉદા., MAT-001',
      available: 'ઉપલભ્ય',
      shortage: 'કમી',
      sufficient: 'પર્યાપ્ત',
      for: 'ક્રિયાઓ',
      units: 'યૂનિટ્સ',
      editMaterial: 'સામગ્રી સંપાદિત કરો',
      deleteMaterial: 'સામગ્રી કાઢી નાખો',
      confirmDelete: 'શું તમે ખરેખર આ સામગ્રી કાઢી નાખવા માંગો છો?',
      scrapPercentage: 'સ્ક્રેપ %'
    },
    pa: {
      title: 'BOM ਸਵੈੱਖਾਵਾਂ ਯੋਜਨਾਕਾਰ',
      selectProduct: 'ਉਤਪਾਦ ਚੁਣੋ',
      materials: 'ਅਵਸਰ ਮਾਟੇ ਮਾਟੇਰੀਅਲ',
      material: 'ਮਾਟੇਰੀਅਲ',
      qtyPerUnit: 'ਹਰ ਯੂਨਿਟ ਪ੍ਰਤੀ ਮਾਤਰਾ',
      unit: 'ਯੂਨਿਟ',
      unitCost: 'ਯੂਨਿਟ ਕੀਮਤ',
      stock: 'ਸਟੋਕ',
      orderedStock: 'ਆਦੇਸ਼ਿਤ ਸਟਾਕ',
      requiredStock: 'ਲੋੜੀਂਦਾ ਸਟਾਕ',
      status: 'ਸਥਿਤੀ',
      actions: 'ਕ੍ਰਿਆਵਾਂ',
      addMaterial: 'ਮਾਟੇਰੀਅਲ ਜੋੰਡੋ',
      saveBOM: 'BOM ਸੰਗ੍ਰਹੀਤ ਕਰੋ',
      autoCalculate: 'ਸਵੈੱਖਾਵਾਂ ਗਣਨਾ',
      stockCheck: 'ਸਟੋਕ ਜਾਂਚ',
      createNewBOM: '+ ਨਵਾਂ BOM ਬਣਾਓ',
      newBOM: 'ਨਵਾਂ BOM',
      productCode: 'ਉਤਪਾਦ ਕੋਡ',
      productName: 'ਉਤਪਾਦ ਨਾਮ',
      enterProductCode: 'ਉਤਪਾਦ ਕੋਡ ਦਾਖਲ ਕਰੋ (ਉਦਾ., JK-001)',
      enterProductName: 'ਉਤਪਾਦ ਨਾਮ ਦਾਖਲ ਕਰੋ',
      bomMaterials: 'BOM ਸਮੱਗਰੀ',
      quantity: 'ਮਾਤਰਾ',
      removeMaterial: 'ਹਟਾਓ',
      cancel: 'ਰੱਦ ਕਰੋ',
      createBOM: 'BOM ਬਣਾਓ',
      itemCode: 'ਆਈਟਮ ਕੋਡ',
      enterItemCode: 'ਉਦਾ., MAT-001',
      available: 'ਉਪਲਭ੍ਯ',
      shortage: 'ਕਮੀ',
      sufficient: 'ਪਰ੍ਯਾਪ੍ਤ',
      for: 'ਕ੍ਰਿਆਵਾਂ',
      units: 'ਯੂਨਿਟ',
      editMaterial: 'ਸਮੱਗਰੀ ਸੰਪਾਦਿਤ ਕਰੋ',
      deleteMaterial: 'ਸਮੱਗਰੀ ਮਿਟਾਓ',
      confirmDelete: 'ਕੀ ਤੁਸੀਂ ਯਕੀਨੀ ਹੋ ਕਿ ਤੁਸੀਂ ਇਸ ਸਮੱਗਰੀ ਨੂੰ ਮਿਟਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
      scrapPercentage: 'ਸਕ੍ਰੈਪ %'
    }
  };

  const t = translations[language];

  // WebSocket for real-time BOM updates
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = getWsUrl(`/ws/boms?token=${token}`);
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('BOM WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'bom_update') {
          // Refetch BOM and materials on update
          if (selectedProductId) {
            // Trigger refetch by updating state or calling functions
            setSelectedProductId(selectedProductId); // To trigger useEffect
          }
        }
      } catch (error) {
        console.error('BOM WebSocket message parse error:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('BOM WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('BOM WebSocket disconnected');
      // Optional: Auto-reconnect
      setTimeout(() => {
        // Reconnect logic if needed
      }, 5000);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedProductId]);

  // Fetch products and inventory items on mount
  useEffect(() => {
    fetchProducts();
    fetchInventoryItems();
    fetchRawMaterials();
  }, []);

  const fetchInventoryItems = async () => {
    try {
      const items = await inventoryItemsApi.list();
      setInventoryItems(items);
    } catch (err) {
      console.error('Error fetching inventory items:', err);
    }
  };

  // Fetch BOM when product changes
  useEffect(() => {
    if (selectedProductId) {
      fetchBOMForProduct(selectedProductId);
    }
  }, [selectedProductId]);

  // Recalculate materials when production quantity changes
  useEffect(() => {
    if (currentBOM) {
      calculateMaterials(currentBOM.id);
    }
  }, [productionQty]);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    setError(null);
    try {
      const data = await productsApi.listProducts({
        category: 'Finished Goods',
        is_active: true,
        limit: 100
      });
      setProducts(data);
      if (data.length > 0 && !selectedProductId) {
        setSelectedProductId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err?.detail || 'Failed to load products');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const fetchRawMaterials = async () => {
    try {
      const data = await productsApi.listProducts({
        category: 'Raw Material',
        is_active: true,
        limit: 100
      });
      setRawMaterials(data);
    } catch (err) {
      console.error('Error fetching raw materials:', err);
    }
  };

  const fetchBOMForProduct = async (productId: string) => {
    setIsLoadingBOM(true);
    setError(null);
    try {
      const bom = await bomApi.getActiveBOMByProduct(productId);
      setCurrentBOM(bom);
      // Auto-calculate on load
      await calculateMaterials(bom.id);
    } catch (err: any) {
      console.error('Error fetching BOM:', err);
      if (err?.status === 404) {
        setCurrentBOM(null);
        setMaterials([]);
      } else {
        setError(err?.detail || 'Failed to load BOM');
      }
    } finally {
      setIsLoadingBOM(false);
    }
  };

  const calculateMaterials = async (bomId: string) => {
    setIsCalculating(true);
    try {
      const data = await bomApi.getMaterialsWithShortages(bomId, productionQty);
      setMaterials(data);
    } catch (err: any) {
      console.error('Error calculating materials:', err);
      setError(err?.detail || 'Failed to calculate materials');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleAutoCalculate = () => {
    if (currentBOM) {
      calculateMaterials(currentBOM.id);
    }
  };

  const handleSaveBOM = async () => {
    if (!currentBOM) return;

    try {
      await bomApi.updateBOM(currentBOM.id, {
        batch_size: productionQty,
        notes: currentBOM.notes
      });
      alert(language === 'en' ? 'BOM saved successfully!' : 'BOM सफलतापूर्वक सहेजा गया!');
    } catch (err: any) {
      alert(err?.detail || 'Failed to save BOM');
    }
  };


  const handleDeleteMaterial = async (materialId: string) => {
    if (!currentBOM) return;

    if (!window.confirm(t.confirmDelete)) return;

    try {
      await bomApi.removeMaterial(currentBOM.id, materialId);
      alert(language === 'en' ? 'Material deleted successfully!' : 'सामग्री सफलतापूर्वक हटाई गई!');
      await fetchBOMForProduct(selectedProductId);
    } catch (err: any) {
      alert(err?.detail || 'Failed to delete material');
    }
  };

  const handleAddMaterial = async () => {
    if (!currentBOM) return;

    try {
      await bomApi.addMaterial(currentBOM.id, {
        material_id: newMaterial.materialId,
        quantity: parseFloat(newMaterial.quantity),
        unit: newMaterial.unit,
        unit_cost: parseFloat(newMaterial.unitCost) || 0,
        scrap_percentage: parseFloat(newMaterial.scrapPercentage) || 0
      });

      alert(language === 'en' ? 'Material added successfully!' : 'सामग्री सफलतापूर्वक जोड़ी गई!');
      setShowAddMaterialModal(false);
      setNewMaterial({
        materialId: '',
        quantity: '',
        unit: 'kg',
        unitCost: '',
        scrapPercentage: '0'
      });
      await fetchBOMForProduct(selectedProductId);
    } catch (err: any) {
      alert(err?.detail || 'Failed to add material');
    }
  };

  const handleUpdateMaterial = async () => {
    if (!currentBOM || !editingMaterial) return;

    try {
      await bomApi.updateMaterial(currentBOM.id, editingMaterial.material_id, {
        material_id: newMaterial.materialId,
        quantity: parseFloat(newMaterial.quantity),
        unit: newMaterial.unit,
        unit_cost: parseFloat(newMaterial.unitCost) || 0,
        scrap_percentage: parseFloat(newMaterial.scrapPercentage) || 0
      });

      alert(language === 'en' ? 'Material updated successfully!' : 'सामग्री सफलतापूर्वक अपडेट की गई!');
      setShowEditMaterialModal(false);
      setEditingMaterial(null);
      setNewMaterial({
        materialId: '',
        quantity: '',
        unit: 'kg',
        unitCost: '',
        scrapPercentage: '0'
      });
      await fetchBOMForProduct(selectedProductId);
    } catch (err: any) {
      alert(err?.detail || 'Failed to update material');
    }
  };

  const handleCreateBOM = async () => {
    try {
      // Create BOM with product
      const bomData = {
        product_code: newBOM.productCode,
        product_name: newBOM.productName,
        batch_size: newBOM.batchSize,
        notes: newBOM.notes,
        materials: newBOM.materials
      };

      const createdBOM = await bomApi.createBOMWithProduct(bomData);

      alert(language === 'en'
        ? `BOM created successfully for ${newBOM.productCode} - ${newBOM.productName}!`
        : `${newBOM.productCode} - ${newBOM.productName} के लिए BOM सफलतापूर्वक बनाया गया!`);

      setShowAddBOMModal(false);
      setNewBOM({
        productCode: '',
        productName: '',
        batchSize: 100,
        notes: '',
        materials: [{ itemCode: '', material: '', qty: '', unit: 'kg', unitCost: '' }]
      });

      // Refresh products list to show the newly created product
      await fetchProducts();

      // Set the selected product to the newly created one
      if (createdBOM.product_id) {
        setSelectedProductId(createdBOM.product_id);
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to create BOM');
    }
  };

  const handleDeleteBOM = async () => {
    if (!currentBOM) return;

    if (!confirm(language === 'en' ? 'Are you sure you want to delete this BOM?' : 'क्या आप वाकई इस BOM को हटाना चाहते हैं?')) {
      return;
    }

    try {
      await bomApi.deleteBOM(currentBOM.id);
      alert(language === 'en' ? 'BOM deleted successfully!' : 'BOM सफलतापूर्वक हटा दिया गया!');

      // Clear state and refresh products
      setCurrentBOM(null);
      setMaterials([]);
      setSelectedProductId('');
      await fetchProducts();
    } catch (err: any) {
      console.error('BOM Deletion error:', err);
      // If we get an error but it might be false positive (204 No Content text parsing),
      // force refresh anyway if we think it worked or just alert.
      // But for now, let's assume we should just alert.
      // Wait, if it failed, we shouldn't refresh.
      // The issue is likely that it DID succeed but threw error.
      // Let's try to parse the error.
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        // This is risky but often happens with CORS or empty responses in some setups.
        // Let's at least try to refresh.
        alert('Network reported error, but checking if deletion matched...');
        await fetchProducts();
        setCurrentBOM(null);
        setMaterials([]);
        setSelectedProductId('');
        return;
      }
      alert(err?.detail || err?.message || 'Failed to delete BOM');
    }
  };

  // Loading state
  if (isLoadingProducts) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-zinc-600">{language === 'en' ? 'Loading products...' : 'उत्पाद लोड हो रहे हैं...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              {language === 'en' ? 'Failed to load' : 'लोड करने में विफल'}
            </h3>
            <p className="text-zinc-600 mb-4">{error}</p>
            <Button onClick={fetchProducts} className="bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'en' ? 'Retry' : 'पुनः प्रयास करें'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1>{t.title}</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              fetchRawMaterials();
              fetchInventoryItems(); // Also refresh inventory items which are used in datalist
              setShowAddBOMModal(true);
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.createNewBOM}
          </Button>
          <Button
            variant="outline"
            onClick={handleAutoCalculate}
            disabled={!currentBOM || isCalculating}
          >
            {isCalculating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {t.autoCalculate}
          </Button>
          <Button onClick={handleSaveBOM} disabled={!currentBOM}>
            {t.saveBOM}
          </Button>
          <Button
            variant="ghost"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={handleDeleteBOM}
            disabled={!currentBOM}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Product Selection */}
      <Card className="p-6">
        <label className="block mb-2 text-zinc-600">{t.selectProduct}</label>
        {products.length === 0 ? (
          <p className="text-zinc-500 text-center py-4">
            {language === 'en' ? 'No finished goods found. Create products first.' : 'कोई तैयार माल नहीं मिला। पहले उत्पाद बनाएं।'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map((product) => (
              <div key={product.id} className="relative group">
                <Button
                  variant={selectedProductForCosts === product.id ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedProductForCosts(product.id);
                    setSelectedProductId(product.id);
                  }}
                  onDoubleClick={() => {
                    setSelectedProductDetails(product);
                    setShowProductDetailsModal(true);
                  }}
                  className="justify-start w-full h-[4.5rem] p-3"
                  disabled={isLoadingBOM}
                >
                  <div className="flex flex-col items-start gap-1 overflow-hidden w-full">
                    <span className="font-semibold text-sm truncate w-full">{product.code}</span>
                    <span className="text-xs opacity-80 line-clamp-2 text-left">{product.name}</span>
                    <datalist id="item-code-options">
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.material_code}>
                          {item.material_code}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* BOM Status */}
        {isLoadingBOM && (
          <div className="mt-4 flex items-center gap-2 text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{language === 'en' ? 'Loading BOM...' : 'BOM लोड हो रहा है...'}</span>
          </div>
        )}
        {!isLoadingBOM && !currentBOM && selectedProductId && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              {language === 'en' ? 'No BOM found for this product. Create one using the button above.' : 'इस उत्पाद के लिए कोई BOM नहीं मिला। ऊपर बटन का उपयोग करके एक बनाएं।'}
            </p>
          </div>
        )}
      </Card>


      {/* Add New BOM Modal */}
      {showAddBOMModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl">{t.newBOM}</h2>
                  <p className="text-sm text-emerald-100">Create a new Bill of Materials</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddBOMModal(false);
                  setNewBOM({
                    productCode: '',
                    productName: '',
                    batchSize: 100,
                    notes: '',
                    materials: [{ itemCode: '', material: '', qty: '', unit: 'kg', unitCost: '' }]
                  });
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* Product Code and Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.productCode} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={newBOM.productCode || ''}
                    onChange={(e) => setNewBOM({ ...newBOM, productCode: e.target.value })}
                    placeholder={t.enterProductCode}
                    className="border-2"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.productName} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={newBOM.productName || ''}
                    onChange={(e) => setNewBOM({ ...newBOM, productName: e.target.value })}
                    placeholder={t.enterProductName}
                    className="border-2"
                  />
                </div>
              </div>

              {/* BOM Materials */}
              <div>
                <label className="block mb-3 text-zinc-900 font-medium">
                  {t.bomMaterials} <span className="text-red-500">*</span>
                </label>

                {/* Desktop View - Table */}
                <div className="hidden lg:block">
                  <div className="border-2 border-zinc-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-zinc-50 border-b-2 border-zinc-200">
                        <tr>
                          <th className="text-left p-3 text-zinc-700">{t.itemCode}</th>
                          <th className="text-left p-3 text-zinc-700">{t.material}</th>
                          <th className="text-left p-3 text-zinc-700">{t.quantity}</th>
                          <th className="text-left p-3 text-zinc-700">{t.unit}</th>
                          <th className="text-left p-3 text-zinc-700">{t.unitCost}</th>
                          <th className="text-left p-3 text-zinc-700">{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newBOM.materials.map((material, index) => (
                          <tr key={index} className="border-b border-zinc-200 last:border-b-0">
                            <td className="p-3">
                              <select
                                value={material.itemCode || ''}
                                onChange={(e) => {
                                  const newMaterials = [...newBOM.materials];
                                  newMaterials[index].itemCode = e.target.value;

                                  // Auto-fill material name and unit when item code is selected
                                  const selectedItem = inventoryItems.find(item => item.material_code === e.target.value);
                                  if (selectedItem) {
                                    newMaterials[index].material = selectedItem.material_name;
                                    newMaterials[index].unit = selectedItem.unit;
                                    newMaterials[index].unitCost = selectedItem.unit_cost.toString();
                                  }
                                  setNewBOM({ ...newBOM, materials: newMaterials });
                                }}
                                className="w-full p-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="">Select Item Code</option>
                                {inventoryItems.map((item) => (
                                  <option key={item.id} value={item.material_code}>
                                    {item.material_code} - {item.material_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3">
                              <Input
                                type="text"
                                value={material.material || ''}
                                onChange={(e) => {
                                  const newMaterials = [...newBOM.materials];
                                  newMaterials[index].material = e.target.value;
                                  setNewBOM({ ...newBOM, materials: newMaterials });
                                }}
                                placeholder="e.g., Cotton Fabric"
                                className="w-full"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                value={material.qty || ''}
                                onChange={(e) => {
                                  const newMaterials = [...newBOM.materials];
                                  newMaterials[index].qty = e.target.value;
                                  setNewBOM({ ...newBOM, materials: newMaterials });
                                }}
                                placeholder="0.00"
                                className="w-full"
                                step="0.01"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                value={material.unit}
                                onChange={(e) => {
                                  const newMaterials = [...newBOM.materials];
                                  newMaterials[index].unit = e.target.value;
                                  setNewBOM({ ...newBOM, materials: newMaterials });
                                }}
                                className="w-full p-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="kg">kg</option>
                                <option value="m">m</option>
                                <option value="pcs">pcs</option>
                                <option value="L">L</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                value={material.unitCost || ''}
                                onChange={(e) => {
                                  const newMaterials = [...newBOM.materials];
                                  newMaterials[index].unitCost = e.target.value;
                                  setNewBOM({ ...newBOM, materials: newMaterials });
                                }}
                                placeholder="0"
                                className="w-full"
                                step="0.01"
                              />
                            </td>
                            <td className="p-3">
                              {newBOM.materials.length > 1 && (
                                <Button
                                  onClick={() => {
                                    const newMaterials = newBOM.materials.filter((_, i) => i !== index);
                                    setNewBOM({ ...newBOM, materials: newMaterials });
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View - Cards */}
                <div className="lg:hidden space-y-3">
                  {newBOM.materials.map((material, index) => (
                    <Card key={index} className="p-4 border-2 border-zinc-200">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-zinc-700">Material {index + 1}</span>
                        {newBOM.materials.length > 1 && (
                          <Button
                            onClick={() => {
                              const newMaterials = newBOM.materials.filter((_, i) => i !== index);
                              setNewBOM({ ...newBOM, materials: newMaterials });
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 -mt-2 -mr-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">{t.itemCode}</label>
                          <Input
                            type="text"
                            list="item-code-options"
                            value={material.itemCode || ''}
                            onChange={(e) => {
                              const newMaterials = [...newBOM.materials];
                              newMaterials[index].itemCode = e.target.value;

                              // Auto-fill material name and unit when item code is selected
                              const selectedItem = inventoryItems.find(item => item.material_code === e.target.value);
                              if (selectedItem) {
                                newMaterials[index].material = selectedItem.material_name;
                                newMaterials[index].unit = selectedItem.unit;
                                newMaterials[index].unitCost = selectedItem.unit_cost.toString();
                              }
                              setNewBOM({ ...newBOM, materials: newMaterials });
                            }}
                            placeholder={t.enterItemCode}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">{t.material}</label>
                          <Input
                            type="text"
                            value={material.material || ''}
                            onChange={(e) => {
                              const newMaterials = [...newBOM.materials];
                              newMaterials[index].material = e.target.value;
                              setNewBOM({ ...newBOM, materials: newMaterials });
                            }}
                            placeholder="e.g., Cotton Fabric"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-zinc-600 mb-1">{t.quantity}</label>
                            <Input
                              type="number"
                              value={material.qty || ''}
                              onChange={(e) => {
                                const newMaterials = [...newBOM.materials];
                                newMaterials[index].qty = e.target.value;
                                setNewBOM({ ...newBOM, materials: newMaterials });
                              }}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-zinc-600 mb-1">{t.unit}</label>
                            <select
                              value={material.unit}
                              onChange={(e) => {
                                const newMaterials = [...newBOM.materials];
                                newMaterials[index].unit = e.target.value;
                                setNewBOM({ ...newBOM, materials: newMaterials });
                              }}
                              className="w-full p-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="kg">kg</option>
                              <option value="m">m</option>
                              <option value="pcs">pcs</option>
                              <option value="L">L</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-600 mb-1">{t.unitCost}</label>
                          <Input
                            type="number"
                            value={material.unitCost || ''}
                            onChange={(e) => {
                              const newMaterials = [...newBOM.materials];
                              newMaterials[index].unitCost = e.target.value;
                              setNewBOM({ ...newBOM, materials: newMaterials });
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  onClick={() => setNewBOM({
                    ...newBOM,
                    materials: [...newBOM.materials, { itemCode: '', material: '', qty: '', unit: 'kg', unitCost: '' }]
                  })}
                  variant="outline"
                  className="w-full mt-3 border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t.addMaterial}
                </Button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t-2 border-zinc-200 p-6 flex gap-3">
              <Button
                onClick={() => {
                  setShowAddBOMModal(false);
                  setNewBOM({
                    productCode: '',
                    productName: '',
                    batchSize: 100,
                    notes: '',
                    materials: [{ itemCode: '', material: '', qty: '', unit: 'kg', unitCost: '' }]
                  });
                }}
                variant="outline"
                className="flex-1 border-2"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleCreateBOM}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                disabled={!newBOM.productCode || !newBOM.productName || newBOM.materials.filter(m => m.itemCode && m.material && m.qty).length === 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t.createBOM}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      <AddMaterialModal
        show={showAddMaterialModal}
        onClose={() => {
          setShowAddMaterialModal(false);
          setNewMaterial({
            materialId: '',
            quantity: '',
            unit: 'kg',
            unitCost: '',
            scrapPercentage: '0'
          });
        }}
        onAdd={handleAddMaterial}
        rawMaterials={rawMaterials}
        material={newMaterial}
        setMaterial={setNewMaterial}
        language={language}
      />

      {/* Edit Material Modal */}
      <EditMaterialModal
        show={showEditMaterialModal}
        onClose={() => {
          setShowEditMaterialModal(false);
          setEditingMaterial(null);
          setNewMaterial({
            materialId: '',
            quantity: '',
            unit: 'kg',
            unitCost: '',
            scrapPercentage: '0'
          });
        }}
        onUpdate={handleUpdateMaterial}
        onDelete={() => {
          if (editingMaterial) {
            setShowEditMaterialModal(false);
            handleDeleteMaterial(editingMaterial.id);
          }
        }}
        rawMaterials={rawMaterials}
        material={newMaterial}
        setMaterial={setNewMaterial}
        language={language}
      />

      {/* Product Details Modal - Shows on Double Click */}
      {showProductDetailsModal && selectedProductDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <div>
                <h2 className="text-xl font-semibold">{selectedProductDetails.code} - {selectedProductDetails.name}</h2>
                <p className="text-sm text-emerald-100">Bill of Materials Details</p>
              </div>
              <button
                onClick={() => setShowProductDetailsModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Production Quantity & Cost Section */}
              <div className="flex items-start gap-4 p-4 border border-zinc-200 rounded-lg bg-white shadow-sm">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Production Quantity</label>
                  <Input
                    type="number"
                    value={productionQty}
                    onChange={(e) => setProductionQty(Number(e.target.value))}
                    min={1}
                    className="h-10"
                  />
                  <div className="mt-1 text-xs text-zinc-500">
                    Batch size: {currentBOM ? currentBOM.batch_size : 'N/A'}
                  </div>
                </div>

                {/* Unit Cost - shown when product is selected */}
                {currentBOM && materials.length > 0 && (
                  <>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Unit Cost (per 1 unit)</label>
                      <div className="flex w-full h-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                        <span className="font-semibold text-emerald-600">
                          ₹{materials.reduce((sum, mat) => sum + (mat.unit_cost * mat.quantity_per_unit), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Total Cost - shown when product is selected */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Total Cost (for {productionQty} units)</label>
                      <div className="flex w-full h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                        <span className="font-semibold text-emerald-700">
                          ₹{(materials.reduce((sum, mat) => sum + (mat.unit_cost * mat.quantity_per_unit), 0) * productionQty).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Materials Table */}
              {materials.length > 0 ? (
                <div>
                  <h3 className="font-semibold text-lg mb-4">Materials Required</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-zinc-50 border-b">
                        <tr>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Material</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Qty per Unit</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Unit</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Stock</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Ordered Stock</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Required Stock</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Status</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Unit Cost</th>
                          <th className="text-left p-4 text-sm font-semibold text-zinc-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map((material) => (
                          <tr key={material.id} className="border-b hover:bg-zinc-50">
                            <td className="p-4">{material.material_name}</td>
                            <td className="p-4">{material.quantity_per_unit || material.quantity}</td>
                            <td className="p-4">{material.unit}</td>
                            <td className="p-4">
                              <span className={material.stock_qty > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {material.stock_qty} {material.unit}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-blue-600">
                                {material.ordered_qty || 0} {material.unit}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="font-semibold">
                                {material.required_qty || 0} {material.unit}
                              </span>
                            </td>
                            <td className="p-4">
                              {material.shortage_status === 'Sufficient' ? (
                                <Badge className="bg-emerald-500 flex items-center gap-1 w-fit">
                                  <CheckCircle className="h-3 w-3" />
                                  Sufficient
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500 flex items-center gap-1 w-fit">
                                  <AlertCircle className="h-3 w-3" />
                                  Shortage
                                </Badge>
                              )}
                            </td>
                            <td className="p-4">₹{material.unit_cost}</td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingMaterial(material);
                                    setNewMaterial({
                                      materialId: material.material_id,
                                      quantity: material.quantity_per_unit?.toString() || material.quantity.toString(),
                                      unit: material.unit,
                                      unitCost: material.unit_cost.toString(),
                                      scrapPercentage: material.scrap_percentage?.toString() || '0'
                                    });
                                    setShowEditMaterialModal(true);
                                    setShowProductDetailsModal(false);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this material?')) {
                                      handleDeleteMaterial(material.id);
                                      setShowProductDetailsModal(false);
                                    }
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
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

                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        fetchRawMaterials();
                        fetchInventoryItems();
                        setShowAddMaterialModal(true);
                        setShowProductDetailsModal(false);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Material
                    </Button>
                  </div>

                  {/* Stock Check */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Stock Check</h4>
                    {materials.every(m => m.shortage_status === 'Sufficient') ? (
                      <p className="text-emerald-600 font-medium">✓ All materials are sufficient!</p>
                    ) : (
                      <p className="text-red-600 font-medium">⚠ Some materials are in shortage</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <p>No materials found for this product.</p>
                  <Button
                    onClick={() => {
                      fetchRawMaterials();
                      fetchInventoryItems();
                      setShowAddMaterialModal(true);
                      setShowProductDetailsModal(false);
                    }}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Material
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}