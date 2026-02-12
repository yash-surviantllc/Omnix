import { Search, Plus, XCircle, Printer, CheckCircle2, AlertCircle, Minus, RefreshCw, Package, Clock, FileText, Download, Archive, Users, MessageSquare, Send, Calendar, Star, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useRef } from 'react';
import { OrderActionsDropdown } from './components/OrderActionsDropdown';
import { purchaseOrdersApi, type PurchaseOrder } from '@/lib/api/purchase-orders';
import { productsApi } from '@/lib/api/bom';
import { wipApi } from '@/lib/api/wip';
import { useAuthStore } from '@/stores/authStore';
import { NewOrderModal } from './components/NewOrderModal';

type PurchaseOrdersProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
  onNavigate?: (view: string) => void;
};

export function PurchaseOrders({ language, onNavigate }: PurchaseOrdersProps) {
  // Get auth status
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">
            {language === 'en' ? 'Authentication Required' : 'प्रमाणीकरण आवश्यक'}
          </h3>
          <p className="text-zinc-600 mb-4">
            {language === 'en'
              ? 'Please log in to view purchase orders.'
              : 'खरीद आदेश देखने के लिए कृपया लॉग इन करें।'}
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {language === 'en' ? 'Go to Login' : 'लॉग इन पर जाएं'}
          </Button>
        </Card>
      </div>
    );
  }

  // API Data State
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  // UI State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [editOrderData, setEditOrderData] = useState({
    quantity: '',
    due_date: '',
    priority: '',
    notes: ''
  });
  const [newOrderData, setNewOrderData] = useState<any>({
    items: [{ id: '1', product: '', quantity: '' }],
    dueDate: '',
    priority: 'MEDIUM',
    notes: '',
    startDate: '',
    endDate: ''
  });
  const [associatedWorkOrders, setAssociatedWorkOrders] = useState<any[]>([]);

  const translations = {
    en: {
      title: 'Purchase Orders',
      search: 'Search orders...',
      filter: 'Filter',
      newOrder: 'New Order',
      order: 'Order',
      product: 'Product',
      quantity: 'Quantity',
      stage: 'Stage',
      status: 'Status',
      dueDate: 'Due Date',
      actions: 'Actions',
      // Dropdown actions
      viewDetails: 'View Details',
      editOrder: 'Edit Order',
      duplicateOrder: 'Duplicate Order',
      printOrder: 'Print Order Sheet',
      trackProgress: 'Track Progress',
      productionPlan: 'Production Plan Timeline',
      assignTeam: 'Assign to Team',
      addNotes: 'Add Notes',
      downloadBOM: 'Download BOM',
      exportExcel: 'Export to Excel',
      generateQR: 'Generate QR Code',
      sendToProduction: 'Send to Production',
      requestMaterials: 'Request Materials',
      reschedule: 'Reschedule Delivery',
      shareOrder: 'Share Order',
      viewHistory: 'View History',
      archiveOrder: 'Archive Order',
      markPriority: 'Mark as Priority',
      cancelOrder: 'Cancel Order',
      deleteOrder: 'Delete Order',
      createWorkingOrder: 'Create Working Order',
      editTimeline: 'Edit Timeline',
      viewMode: 'View Mode',
      saveChanges: 'Save Changes',
      cancel: 'Cancel',
      // New Order Form
      createNewOrder: 'Create New Purchase Order',
      selectProduct: 'Select Product',
      chooseProduct: 'Choose product...',
      enterQuantity: 'Enter Quantity',
      units: 'units',
      selectDueDate: 'Due Date',
      orderPriority: 'Order Priority',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      customerName: 'Customer Name',
      enterCustomer: 'Enter customer name...',
      productionStage: 'Production Stage',
      assignTeamLabel: 'Assign Team',
      selectTeam: 'Select team...',
      orderNotes: 'Order Notes',
      enterNotes: 'Enter special instructions or notes...',
      requiredFields: 'Required Fields',
      createOrder: 'Create Order',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      selectStartTime: 'Select start time...',
      selectEndTime: 'Select end time...'
    },
    hi: {
      title: 'उत्पादन आदेश',
      search: 'ऑर्डर खोजें...',
      filter: 'फ़िल्टर',
      newOrder: 'नया ऑर्डर',
      order: 'ऑर्डर',
      product: 'उत्पाद',
      quantity: 'मात्रा',
      stage: 'स्टेज',
      status: 'स्थिति',
      dueDate: 'नियत तारीख',
      actions: 'क्रियाएं',
      // Dropdown actions
      viewDetails: 'विवरण देखें',
      editOrder: 'ऑर्डर संपादित करें',
      duplicateOrder: 'ऑर्डर डुप्लिकेट करें',
      printOrder: 'ऑर्डर शीट प्रिंट करें',
      notes: 'नोट्स',
      trackProgress: 'प्रगति ट्रैक करें',
      productionPlan: 'उत्पादन योजना का समयरेखा',
      assignTeam: 'टीम को असाइन करें',
      addNotes: 'नोट्स जोड़ें',
      downloadBOM: 'BOM डाउनलोड करें',
      exportExcel: 'Excel में निर्यात करें',
      generateQR: 'QR कोड जनरेट करें',
      sendToProduction: 'उत्पादन में भेजें',
      requestMaterials: 'सामग्री का अनुरोध करें',
      reschedule: 'डिलीवरी पुनर्निर्धारित करें',
      shareOrder: 'ऑर्डर साझा करें',
      viewHistory: 'इतिहास देखें',
      archiveOrder: 'ऑर्डर संग्रहित करें',
      markPriority: 'प्राथमिकता के रूप में चिह्नित करें',
      cancelOrder: 'ऑर्डर रद्द करें',
      deleteOrder: 'ऑर्डर हटाएं',
      createWorkingOrder: 'वर्किंग ऑर्डर बनाएं',
      editTimeline: 'समयरेखा संपादित करें',
      viewMode: 'देखें मोड',
      saveChanges: 'परिवर्तन सहेजें',
      cancel: 'रद्द करें',
      // New Order Form
      createNewOrder: 'नया उत्पादन ऑर्डर बनाएं',
      selectProduct: 'उत्पाद चुनें',
      chooseProduct: 'उत्पाद चुनें...',
      enterQuantity: 'मात्रा दर्ज करें',
      units: 'यूनिट',
      selectDueDate: 'नियत तारीख',
      orderPriority: 'ऑर्डर प्राथमिकता',
      normal: 'सामान्य',
      high: 'उच्च',
      urgent: 'तत्काल',
      customerName: 'ग्राहक का नाम',
      enterCustomer: 'ग्राहक का नाम दर्ज करें...',
      productionStage: 'उत्पादन चरण',
      assignTeamLabel: 'टीम असाइन करें',
      selectTeam: 'टीम चुनें...',
      orderNotes: 'ऑर्डर नोट्स',
      enterNotes: 'विशेष निर्देश या नोट्स दर्ज करें...',
      requiredFields: 'आवश्यक फ़ील्ड',
      createOrder: 'ऑर्डर बनाएं',
      shiftNumber: 'शिफ्ट नंबर',
      shift1: 'शिफ्ट 1 (सुबह 6 - दोपहर 2)',
      shift2: 'शिफ्ट 2 (दोपहर 2 - रात 10)',
      shift3: 'शिफ्ट 3 (रात 10 - सुबह 6)',
      productionTimeline: 'उत्पादन समयरेखा',
      startTime: 'शुरू समय',
      endTime: 'समाप्ति समय',
      selectStartTime: 'शुरू समय चुनें...',
      selectEndTime: 'समाप्ति समय चुनें...'
    },
    kn: {
      title: 'उत्पादन आदेश',
      search: 'ऑर्डर ಖೋಜಿಸಿ...',
      filter: 'ಫಿಲ್ಟರ್',
      newOrder: 'ಹೊಸ ಆದೇಶ',
      order: 'ಆದೇಶ',
      product: 'ಉತ್ಪಾದ',
      quantity: 'ಪ್ರಮಾಣ',
      stage: 'ಸ್ಟೇಜ್',
      status: 'ಸ್ಥಿತಿ',
      dueDate: 'ನಿಯತ ತಾರೀಖು',
      actions: 'ಕ್ರಿಯೆಗಳು',
      orderPriority: 'ಆದ್ಯತೆ',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      // Dropdown actions
      viewDetails: 'ವಿವರಗಳನ್ನು ನೋಡಿ',
      editOrder: 'ಆದೇಶವನ್ನು ಸಂಪಾದಿಸಿ',
      duplicateOrder: 'ಆದೇಶವನ್ನು ನಕಲಿಸಿ',
      printOrder: 'Print Order',
      trackProgress: 'Track Progress',
      productionPlan: 'Production Plan',
      assignTeam: 'Assign Team',
      addNotes: 'Add Notes',
      downloadBOM: 'BOM ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
      exportExcel: 'Export Excel',
      generateQR: 'QR ಕೋಡ್ ರಚಿಸಿ',
      sendToProduction: 'Send to Production',
      requestMaterials: 'Request Materials',
      reschedule: 'Reschedule',
      shareOrder: 'Share Order',
      viewHistory: 'View History',
      archiveOrder: 'Archive Order',
      markPriority: 'ಪ್ರಾಧಾನ್ಯತಗಾ ಗುರುತಿಸಿ',
      cancelOrder: 'ಆದೇಶವನ್ನು ರದ್ದುಗೊಳಿಸಿ',
      deleteOrder: 'ಆದೇಶವನ್ನು ಅಳಿಸಿ',
      createWorkingOrder: 'ವರ್ಕಿಂಗ್ ಆರ್ಡರ್ ರಚಿಸಿ',
      createNewOrder: 'Create New Purchase Order',
      selectProduct: 'Select Product',
      chooseProduct: 'Choose product...',
      enterQuantity: 'Enter Quantity',
      units: 'units',
      selectDueDate: 'Due Date',
      customerName: 'Customer Name',
      enterCustomer: 'Enter customer name...',
      productionStage: 'Production Stage',
      assignTeamLabel: 'Assign Team',
      selectTeam: 'Select team...',
      orderNotes: 'Order Notes',
      enterNotes: 'Enter special instructions or notes...',
      requiredFields: 'Required Fields',
      createOrder: 'Create Order',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      selectStartTime: 'Select start time...',
      selectEndTime: 'Select end time...',
      editTimeline: 'Edit Timeline',
      viewMode: 'View Mode',
      saveChanges: 'Save Changes',
      cancel: 'Cancel'
    },
    ta: {
      title: 'உற்பத்தி ஆட்டாளங்கள்',
      search: 'ஆட்டாளங்களை தேடுக...',
      filter: 'பில்டர்',
      newOrder: 'புதிய ஆட்டாளம்',
      order: 'ஆட்டாளம்',
      product: 'பொருத்தம்',
      quantity: 'அளவு',
      stage: 'வரிசை',
      status: 'நிலை',
      dueDate: 'காலப்பாடு',
      actions: 'செயல்கள்',
      orderPriority: 'முன்னுரிமை',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      // Dropdown actions
      viewDetails: 'விவரங்களைக் காண்க',
      editOrder: 'ஆட்டாளத்தைத் திருத்து',
      duplicateOrder: 'ஆட்டாளத்தை நகலெடு',
      printOrder: 'ஆட்டாளத்தை அச்சுப்பிடித்தல்',
      trackProgress: 'முன்னேற்றத்தைக் கண்காணிக்கவும்',
      productionPlan: 'உற்பத்தித் திட்டம்',
      assignTeam: 'குழுவை ஒதுக்கவும்',
      addNotes: 'குறிப்புகளைச் சேர்க்கவும்',
      downloadBOM: 'BOM பதிவிறக்கு',
      exportExcel: 'எக்ஸெலுக்கு ஏற்றுமதி செய்யவும்',
      generateQR: 'QR குறியீட்டை உருவாக்கு',
      sendToProduction: 'உற்பத்திக்கு அனுப்பவும்',
      requestMaterials: 'பொருட்களைக் கோரிக்கையிடவும்',
      reschedule: 'மறுஒதுக்கீடு',
      shareOrder: 'ஆட்டாளத்தைப் பகிர்ந்து கொள்ளவும்',
      viewHistory: 'வரலாற்றைக் காண்க',
      archiveOrder: 'ஆட்டாளத்தை ஆவணப்படுத்தவும்',
      markPriority: 'முன்னுரிமை எனக் குறி',
      cancelOrder: 'ஆட்டாளத்தை ரத்துசெய்',
      deleteOrder: 'ஆட்டாளத்தை அழி',
      createWorkingOrder: 'வேலை ஆர்டர் உருவாக்கு',
      createNewOrder: 'புதிய உற்பத்தி ஆட்டாளம் உருவாக்கு',
      selectProduct: 'பொருளைத் தேர்ந்தெடுக்கவும்',
      chooseProduct: 'பொருளைத் தேர்ந்தெடுக்கவும்...',
      enterQuantity: 'அளவை உள்ளீடு செய்யவும்',
      units: 'அலகுகள்',
      selectDueDate: 'காலப்பாடு',
      customerName: 'வாடிக்கையாளர் பெயர்',
      enterCustomer: 'வாடிக்கையாளர் பெயரை உள்ளீடு செய்யவும்...',
      productionStage: 'உற்பத்தி நிலை',
      assignTeamLabel: 'குழுவை ஒதுக்கவும்',
      selectTeam: 'குழுவைத் தேர்ந்தெடுக்கவும்...',
      orderNotes: 'ஆட்டாள குறிப்புகள்',
      enterNotes: 'சிறப்பு அறிவுரைகள் அல்லது குறிப்புகளை உள்ளீடு செய்யவும்...',
      requiredFields: 'தேவையான புலங்கள்',
      createOrder: 'ஆட்டாளம் உருவாக்கு',
      shiftNumber: 'பணி எண்',
      shift1: 'பணி 1 (காலை 6 - மதியம் 2)',
      shift2: 'பணி 2 (மதியம் 2 - இரவு 10)',
      shift3: 'பணி 3 (இரவு 10 - காலை 6)',
      productionTimeline: 'உற்பத்தி நேரக்கோடு',
      startTime: 'தொடக்க நேரம்',
      endTime: 'முடிவு நேரம்',
      selectStartTime: 'தொடக்க நேரத்தைத் தேர்ந்தெடுக்கவும்...',
      selectEndTime: 'முடிவு நேரத்தைத் தேர்ந்தெடுக்கவும்...',
      editTimeline: 'நேரக்கோட்டைத் திருத்து',
      viewMode: 'பார்வை பாங்கு',
      saveChanges: 'மாற்றங்களைச் சேமிக்கவும்',
      cancel: 'ரத்து செய்யவும்'
    },
    te: {
      title: 'ఉత్పత్తి ఆదేశాలు',
      search: 'ఆదేశాలను శోధించు...',
      filter: 'ఫిల్టర్',
      newOrder: 'కొత్త ఆదేశం',
      order: 'ఆదేశం',
      product: 'ఉత్పత్తి',
      quantity: 'పరిమాణం',
      stage: 'స్టేజ్',
      status: 'స్థితి',
      dueDate: 'ముక్తి తేదీ',
      actions: 'క్రియలు',
      orderPriority: 'ప్రాధాన్యత',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      viewDetails: 'వివరాలను చూడండి',
      editOrder: 'ఆదేశాన్ని సవరించండి',
      duplicateOrder: 'ఆదేశాన్ని నకలు చేయండి',
      printOrder: 'Print Order',
      trackProgress: 'Track Progress',
      productionPlan: 'Production Plan',
      assignTeam: 'Assign Team',
      addNotes: 'Add Notes',
      downloadBOM: 'BOM డౌన్‌లోడ్ చేయండి',
      exportExcel: 'Export Excel',
      generateQR: 'QR కోడ్ రూపొందించండి',
      sendToProduction: 'Send to Production',
      requestMaterials: 'Request Materials',
      reschedule: 'Reschedule',
      shareOrder: 'Share Order',
      viewHistory: 'View History',
      archiveOrder: 'Archive Order',
      markPriority: 'ప్రాధాన్యతగా గుర్తించండి',
      cancelOrder: 'ఆదేశాన్ని రద్దు చేయండి',
      deleteOrder: 'ఆదేశాన్ని తొలగించండి',
      createWorkingOrder: 'వర్కింగ్ ఆర్డర్ సృష్టించండి',
      createNewOrder: 'Create New Purchase Order',
      selectProduct: 'Select Product',
      chooseProduct: 'Choose product...',
      enterQuantity: 'Enter Quantity',
      units: 'units',
      selectDueDate: 'Due Date',
      customerName: 'Customer Name',
      enterCustomer: 'Enter customer name...',
      productionStage: 'Production Stage',
      assignTeamLabel: 'Assign Team',
      selectTeam: 'Select team...',
      orderNotes: 'Order Notes',
      enterNotes: 'Enter special instructions or notes...',
      requiredFields: 'Required Fields',
      createOrder: 'Create Order',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      selectStartTime: 'Select start time...',
      selectEndTime: 'Select end time...',
      editTimeline: 'Edit Timeline',
      viewMode: 'View Mode',
      saveChanges: 'Save Changes',
      cancel: 'Cancel'
    },
    mr: {
      title: 'उत्पादन आदेश',
      search: 'आदेश शोधा...',
      filter: 'फ़िल्टर',
      newOrder: 'नवीन आदेश',
      order: 'आदेश',
      product: 'उत्पाद',
      quantity: 'मात्रा',
      stage: 'स्टेज',
      status: 'स्थिति',
      dueDate: 'नियत तारीख',
      actions: 'क्रियाएं',
      orderPriority: 'प्राधान्य',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      viewDetails: 'तपशील पहा',
      editOrder: 'आदेश संपादित करा',
      duplicateOrder: 'आदेश डुप्लिकेट करा',
      printOrder: 'Print Order',
      trackProgress: 'Track Progress',
      productionPlan: 'Production Plan',
      assignTeam: 'Assign Team',
      addNotes: 'Add Notes',
      downloadBOM: 'BOM डाउनलोड करा',
      exportExcel: 'Export Excel',
      generateQR: 'QR कोड तयार करा',
      sendToProduction: 'Send to Production',
      requestMaterials: 'Request Materials',
      reschedule: 'Reschedule',
      shareOrder: 'Share Order',
      viewHistory: 'View History',
      archiveOrder: 'Archive Order',
      markPriority: 'प्राधान्य म्हणून चिन्हांकित करा',
      cancelOrder: 'आदेश रद्द करा',
      deleteOrder: 'आदेश हटवा',
      createWorkingOrder: 'वर्किंग ऑर्डर तयार करा',
      createNewOrder: 'Create New Purchase Order',
      selectProduct: 'Select Product',
      chooseProduct: 'Choose product...',
      enterQuantity: 'Enter Quantity',
      units: 'units',
      selectDueDate: 'Due Date',
      customerName: 'Customer Name',
      enterCustomer: 'Enter customer name...',
      productionStage: 'Production Stage',
      assignTeamLabel: 'Assign Team',
      selectTeam: 'Select team...',
      orderNotes: 'Order Notes',
      enterNotes: 'Enter special instructions or notes...',
      requiredFields: 'Required Fields',
      createOrder: 'Create Order',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      selectStartTime: 'Select start time...',
      selectEndTime: 'Select end time...',
      editTimeline: 'Edit Timeline',
      viewMode: 'View Mode',
      saveChanges: 'Save Changes',
      cancel: 'Cancel'
    },
    gu: {
      title: 'ઉત્પદન આદેશો',
      search: 'આદેશો શોધો...',
      filter: 'ફિલ્ટર',
      newOrder: 'નવો આદેશ',
      order: 'આદેશ',
      product: 'ઉત્પદ',
      quantity: 'માત્રા',
      stage: 'સ્ટેજ',
      status: 'સ્થિતિ',
      dueDate: 'નિયત તારીખ',
      actions: 'ક્રિયાઓ',
      orderPriority: 'પ્રાથમિકતા',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      viewDetails: 'વિગતો જુઓ',
      editOrder: 'આદેશ સંપાદિત કરો',
      duplicateOrder: 'આદેશ ડુપ્લિકેટ કરો',
      printOrder: 'Print Order',
      trackProgress: 'Track Progress',
      productionPlan: 'Production Plan',
      assignTeam: 'Assign Team',
      addNotes: 'Add Notes',
      downloadBOM: 'BOM ડાઉનલોડ કરો',
      exportExcel: 'Export Excel',
      generateQR: 'QR કોડ બનાવો',
      sendToProduction: 'Send to Production',
      requestMaterials: 'Request Materials',
      reschedule: 'Reschedule',
      shareOrder: 'Share Order',
      viewHistory: 'View History',
      archiveOrder: 'Archive Order',
      markPriority: 'પ્રાથમિકતા તરીકે ચિહ્નિત કરો',
      cancelOrder: 'આદેશ રદ કરો',
      deleteOrder: 'આદેશ કાઢી નાખો',
      createWorkingOrder: 'વર્કિંગ ઓર્ડર બનાવો',
      createNewOrder: 'Create New Purchase Order',
      selectProduct: 'Select Product',
      chooseProduct: 'Choose product...',
      enterQuantity: 'Enter Quantity',
      units: 'units',
      selectDueDate: 'Due Date',
      customerName: 'Customer Name',
      enterCustomer: 'Enter customer name...',
      productionStage: 'Production Stage',
      assignTeamLabel: 'Assign Team',
      selectTeam: 'Select team...',
      orderNotes: 'Order Notes',
      enterNotes: 'Enter special instructions or notes...',
      requiredFields: 'Required Fields',
      createOrder: 'Create Order',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      selectStartTime: 'Select start time...',
      selectEndTime: 'Select end time...',
      editTimeline: 'Edit Timeline',
      viewMode: 'View Mode',
      saveChanges: 'Save Changes',
      cancel: 'Cancel'
    },
    pa: {
      title: 'ਉਤਪਾਦਨ ਆਦੇਸ਼',
      search: 'ਆਦੇਸ਼ ਖੋਜੋ...',
      filter: 'ਫਿਲਟਰ',
      newOrder: 'ਨਵਾਂ ਆਦੇਸ਼',
      order: 'ਆਦੇਸ਼',
      product: 'ਉਤਪਾਦ',
      quantity: 'ਮਾਤਰਾ',
      stage: 'ਸਟੇਜ',
      status: 'ਸਥਿਤੀ',
      dueDate: 'ਨਿਯਤ ਤਾਰੀਖ',
      actions: 'ਕ੍ਰਿਆਵਾਂ',
      orderPriority: 'ਤਰਜੀਹ',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      viewDetails: 'ਵੇਰਵੇ ਦੇਖੋ',
      editOrder: 'ਆਦੇਸ਼ ਸੰਪਾਦਿਤ ਕਰੋ',
      duplicateOrder: 'ਆਦੇਸ਼ ਡੁਪਲੀਕੇਟ ਕਰੋ',
      printOrder: 'Print Order',
      trackProgress: 'Track Progress',
      productionPlan: 'Production Plan',
      assignTeam: 'Assign Team',
      addNotes: 'Add Notes',
      downloadBOM: 'BOM ਡਾਊਨਲੋਡ ਕਰੋ',
      exportExcel: 'Export Excel',
      generateQR: 'QR ਕੋਡ ਬਣਾਓ',
      sendToProduction: 'Send to Production',
      requestMaterials: 'Request Materials',
      reschedule: 'Reschedule',
      shareOrder: 'Share Order',
      viewHistory: 'View History',
      archiveOrder: 'Archive Order',
      markPriority: 'ਤਰਜੀਹ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ ਕਰੋ',
      cancelOrder: 'ਆਦੇਸ਼ ਰੱਦ ਕਰੋ',
      deleteOrder: 'ਆਦੇਸ਼ ਮਿਟਾਓ',
      createWorkingOrder: 'ਵਰਕਿੰਗ ਆਰਡਰ ਬਣਾਓ',
      createNewOrder: 'Create New Purchase Order',
      selectProduct: 'Select Product',
      chooseProduct: 'Choose product...',
      enterQuantity: 'Enter Quantity',
      units: 'units',
      selectDueDate: 'Due Date',
      customerName: 'Customer Name',
      enterCustomer: 'Enter customer name...',
      productionStage: 'Production Stage',
      assignTeamLabel: 'Assign Team',
      selectTeam: 'Select team...',
      orderNotes: 'Order Notes',
      enterNotes: 'Enter special instructions or notes...',
      requiredFields: 'Required Fields',
      createOrder: 'Create Order',
      shiftNumber: 'Shift Number',
      shift1: 'Shift 1 (6 AM - 2 PM)',
      shift2: 'Shift 2 (2 PM - 10 PM)',
      shift3: 'Shift 3 (10 PM - 6 AM)',
      productionTimeline: 'Production Timeline',
      startTime: 'Start Time',
      endTime: 'End Time',
      selectStartTime: 'Select start time...',
      selectEndTime: 'Select end time...',
      editTimeline: 'Edit Timeline',
      viewMode: 'View Mode',
      saveChanges: 'Save Changes',
      cancel: 'Cancel'
    }
  };

  const t = translations[language];

  // Fetch purchase orders from API
  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await purchaseOrdersApi.listOrders({
        search: searchQuery,
        limit: 100
      });
      setOrders(data);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch products for dropdown
  const fetchProducts = async () => {
    try {
      const data = await productsApi.listProducts({
        category: 'Finished Goods',
        is_active: true,
        limit: 100
      });
      setProducts(data || []);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load products');
    }
  };

  // Initial load
  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchOrders();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // WebSocket for real-time purchase order updates
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Connect to WebSocket
    const wsUrl = `ws://localhost:8000/ws/purchase-orders?token=${token}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('Purchase Orders WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'purchase_order_update') {
          // Refetch orders on any update
          fetchOrders();
        }
      } catch (error) {
        console.error('Purchase Orders WebSocket message parse error:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('Purchase Orders WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('Purchase Orders WebSocket disconnected');
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

  const handleAction = async (action: string, orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    setSelectedOrder(order || null);

    // Fetch associated work orders for production plan or tracking
    if (action === 'productionPlan' || action === 'trackProgress' || action === 'view') {
      try {
        const wos = await wipApi.listWorkingOrders({ purchase_order_id: orderId });
        setAssociatedWorkOrders(wos || []);
      } catch (err) {
        console.error('Failed to fetch associated work orders:', err);
      }
    }

    if (action === 'createWorkingOrder') {
      // Navigate to Working Order screen - the standard form for creating working orders
      if (onNavigate) {
        // Store the selected PO ID in sessionStorage for the Working Order screen to pick up
        if (order) {
          sessionStorage.setItem('createWorkingOrderForPO', JSON.stringify({
            id: order.id,
            order_number: order.order_number,
            product_name: order.product_name,
            quantity: order.quantity,
            unit: order.unit
          }));
        }
        onNavigate('working-order');
      }
      return;
    } else {
      setActiveModal(action);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedOrder(null);
    setNoteText('');
    setSelectedTeam('');
    setNewDueDate('');
  };

  const closeNewOrderModal = () => {
    setShowNewOrderModal(false);
    setNewOrderData({
      items: [{ id: '1', product: '', quantity: '' }],
      dueDate: '',
      priority: 'MEDIUM',
      notes: '',
      startDate: '',
      endDate: ''
    });
  };

  const createNewOrder = async () => {
    // Validate required fields
    if (!newOrderData.items || newOrderData.items.length === 0 || !newOrderData.dueDate) {
      alert(language === 'en'
        ? 'Please fill in all required fields (Product, Quantity, Due Date)'
        : 'कृपया सभी आवश्यक फ़ील्ड भरें (उत्पाद, मात्रा, नियत तारीख)');
      return;
    }

    try {
      setIsLoading(true);
      const itemsToCreate = newOrderData.items
        .filter((item: any) => item.product && item.quantity)
        .map((item: any) => {
          const product = products.find(p => p.id === item.product);
          return {
            product_id: item.product,
            quantity: parseFloat(item.quantity),
            unit: product?.unit || 'pcs',
            notes: item.notes || undefined
          };
        });

      if (itemsToCreate.length === 0) {
        alert(language === 'en' ? 'Please add at least one product with quantity' : 'कृपया कम कम एक उत्पाद मात्रा के साथ जोड़ें');
        setIsLoading(false);
        return;
      }

      await purchaseOrdersApi.createMultiSkuOrder({
        due_date: newOrderData.dueDate,
        priority: newOrderData.priority.toUpperCase(),
        notes: newOrderData.notes || undefined,
        start_date: newOrderData.startDate ? newOrderData.startDate : undefined,
        end_date: newOrderData.endDate ? newOrderData.endDate : undefined,
        shift_number: newOrderData.shift || undefined,
        items: itemsToCreate
      });

      alert(language === 'en'
        ? `Success! New multi-SKU order created.`
        : `सफलता! नया मल्टी-SKU ऑर्डर बनाया गया।`);

      fetchOrders();
      closeNewOrderModal();
    } catch (err: any) {
      console.error('Error creating order:', err);
      const errorMessage = err?.detail || err?.message || (language === 'en' ? 'Failed to create order(s)' : 'ऑर्डर बनाने में विफल');
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async (action: string) => {
    if (!selectedOrder) return;

    try {
      switch (action) {
        case 'edit':
          const updateData: any = {};
          if (editOrderData.quantity) updateData.quantity = parseFloat(editOrderData.quantity);
          if (editOrderData.due_date) updateData.due_date = editOrderData.due_date;
          if (editOrderData.priority) updateData.priority = editOrderData.priority;
          if (editOrderData.notes !== undefined) updateData.notes = editOrderData.notes;

          await purchaseOrdersApi.updateOrder(selectedOrder.id, updateData);
          alert(language === 'en' ? 'Order updated successfully' : 'ऑर्डर सफलतापूर्वक अपडेट किया गया');
          fetchOrders(); // Refresh list
          break;

        case 'cancel':
          if (confirm(`${language === 'en' ? 'Are you sure you want to cancel this order?' : 'क्या आप वाकई इस ऑर्डर को रद्द करना चाहते हैं?'}\n${selectedOrder.order_number}`)) {
            await purchaseOrdersApi.updateStatus(selectedOrder.id, { status: 'Cancelled' });
            alert(language === 'en' ? 'Order cancelled' : 'ऑर्डर रद्द किया गया');
            fetchOrders();
          }
          break;

        case 'delete':
          if (confirm(`${language === 'en' ? 'Are you sure you want to delete this order? This cannot be undone.' : 'क्या आप वाकई इस ऑर्डर को हटाना चाहते हैं? यह पूर्ववत नहीं किया जा सकता।'}\n${selectedOrder.order_number}`)) {
            const { message } = await purchaseOrdersApi.deleteOrder(selectedOrder.id);
            alert(message);
            fetchOrders();
          }
          break;

        case 'print':
          alert(`${language === 'en' ? 'Order sheet printed for' : 'ऑर्डर शीट प्रिंट की गई'} ${selectedOrder.order_number}`);
          break;
        case 'assignTeam':
          if (selectedTeam) {
            await purchaseOrdersApi.updateOrder(selectedOrder.id, { assigned_team: selectedTeam });
            alert(`${selectedOrder.order_number} ${language === 'en' ? 'assigned to' : 'को असाइन किया गया'} ${selectedTeam}`);
            fetchOrders();
          }
          break;
        case 'addNotes':
          if (noteText.trim()) {
            const currentNotes = selectedOrder.notes || '';
            const updatedNotes = currentNotes
              ? `${currentNotes}\n\n[${new Date().toLocaleString()}]\n${noteText}`
              : `[${new Date().toLocaleString()}]\n${noteText}`;

            await purchaseOrdersApi.updateOrder(selectedOrder.id, { notes: updatedNotes });
            alert(`${language === 'en' ? 'Note added to' : 'नोट जोड़ा गया'} ${selectedOrder.order_number}`);
            fetchOrders();
          }
          break;
        case 'downloadBOM':
          alert(`BOM ${language === 'en' ? 'downloaded for' : 'डाउनलोड किया गया'} ${selectedOrder.order_number}`);
          break;
        case 'exportExcel':
          alert(`${selectedOrder.order_number} ${language === 'en' ? 'exported to Excel' : 'Excel में निर्यात किया गया'}`);
          break;
        case 'sendToProduction':
          await purchaseOrdersApi.updateStatus(selectedOrder.id, { status: 'In Progress' });
          alert(`${selectedOrder.order_number} ${language === 'en' ? 'sent to production floor' : 'उत्पादन में भेजा गया'}`);
          fetchOrders();
          break;
        case 'requestMaterials':
          alert(`${language === 'en' ? 'Material request created for' : 'सामग्री अनुरोध बनाया गया'} ${selectedOrder.order_number}`);
          break;
        case 'reschedule':
          if (newDueDate) {
            await purchaseOrdersApi.updateOrder(selectedOrder.id, { due_date: newDueDate });
            alert(`${selectedOrder.order_number} ${language === 'en' ? 'rescheduled to' : 'पुनर्निर्धारित'} ${newDueDate}`);
            fetchOrders();
          }
          break;
        case 'duplicate':
          const duplicatedOrder = await purchaseOrdersApi.duplicateOrder(selectedOrder.id);
          alert(`${language === 'en' ? 'Order duplicated successfully!' : 'ऑर्डर सफलतापूर्वक डुप्लिकेट किया गया!'}\n\n${language === 'en' ? 'New Order Number' : 'नया ऑर्डर नंबर'}: ${duplicatedOrder.order_number}`);
          fetchOrders();
          break;
        case 'share':
          alert(`${selectedOrder.order_number} ${language === 'en' ? 'shared successfully' : 'सफलतापूर्वक साझा किया गया'}`);
          break;
        case 'archive':
          await purchaseOrdersApi.archiveOrder(selectedOrder.id);
          alert(`${selectedOrder.order_number} ${language === 'en' ? 'archived successfully' : 'सफलतापूर्वक संग्रहीत'}`);
          fetchOrders();
          break;
        case 'priority':
          await purchaseOrdersApi.updateOrder(selectedOrder.id, { priority: 'Urgent' });
          alert(`${selectedOrder.order_number} ${language === 'en' ? 'marked as priority' : 'प्राथमिकता के रूप में चिह्नित'}`);
          fetchOrders();
          break;
      }

      closeModal();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Unknown error');
    }
  };



  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planned':
        return <Badge className="bg-blue-500">{language === 'en' ? 'Planned' : 'योजनित'}</Badge>;
      case 'in progress':
        return <Badge className="bg-emerald-500">{language === 'en' ? 'In Progress' : 'प्रगति में'}</Badge>;
      case 'completed':
        return <Badge className="bg-green-600">{language === 'en' ? 'Completed' : 'पूर्ण'}</Badge>;
      case 'on hold':
        return <Badge className="bg-yellow-500">{language === 'en' ? 'On Hold' : 'होल्ड पर'}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500">{language === 'en' ? 'Cancelled' : 'रद्द'}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Modal Components
  const ModalWrapper = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={closeModal} />
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 shadow-2xl border-none">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{title}</h2>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
            {children}
          </Card>
        </div>
      </div>
    </>
  );

  // Click handler for Order Number
  const handleOrderClick = async (order: any) => {
    try {
      // Fetch full order details to ensure items/materials are populated
      const fullOrder = await purchaseOrdersApi.getOrder(order.id);
      setSelectedOrder(fullOrder);
      setActiveModal('view');
    } catch (err) {
      console.error("Failed to fetch order details:", err);
      // Fallback to the list item if fetch fails (better than nothing)
      setSelectedOrder(order);
      setActiveModal('view');
    }
  };

  const renderModal = () => {
    if (!activeModal || !selectedOrder) return null;

    switch (activeModal) {
      case 'view':
        return (
          <ModalWrapper title={`${language === 'en' ? 'Order Details' : 'ऑर्डर विवरण'}: ${selectedOrder.order_number}`}>
            <div className="space-y-6">
              {/* Product Breakdown (Multi-SKU) */}
              <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {language === 'en' ? 'Order Items' : 'ऑर्डर आइटम'}
                </h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-zinc-100 text-sm">
                        <div>
                          <p className="font-medium text-zinc-900">{item.product_name || item.product_code}</p>
                          <p className="text-xs text-zinc-500 uppercase">{item.product_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{item.quantity} {item.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Fallback for single SKU legacy orders
                  <div className="bg-white p-3 rounded border border-zinc-100 text-sm flex justify-between items-center">
                    <div>
                      <p className="font-medium text-zinc-900">{selectedOrder.product_name}</p>
                      <p className="text-xs text-zinc-500 uppercase">{selectedOrder.product_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-zinc-900">{selectedOrder.quantity} {selectedOrder.unit}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {(t as any).notes || 'Notes'}
                  </h3>
                  <p className="text-sm text-blue-800 whitespace-pre-line">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="pt-2">
                <Button onClick={closeModal} className="w-full">
                  {language === 'en' ? 'Close' : 'बंद करें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'edit':
        return (
          <ModalWrapper title={`${t.editOrder}: ${selectedOrder.order_number}`}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-600 block mb-1">{t.product}</label>
                <Input value={selectedOrder.product_name} disabled className="bg-zinc-100" />
                <p className="text-xs text-zinc-500 mt-1">{language === 'en' ? 'Product cannot be changed' : 'उत्पाद बदला नहीं जा सकता'}</p>
              </div>
              <div>
                <label className="text-sm text-zinc-600 block mb-1">{t.quantity}</label>
                <Input
                  type="number"
                  value={editOrderData.quantity || selectedOrder.quantity}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-zinc-600 block mb-1">{t.dueDate}</label>
                <Input
                  type="date"
                  value={editOrderData.due_date || selectedOrder.due_date}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-zinc-600 block mb-1">{t.orderPriority}</label>
                <select
                  value={editOrderData.priority || selectedOrder.priority}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="Low">{language === 'en' ? 'Low' : 'कम'}</option>
                  <option value="Medium">{t.normal}</option>
                  <option value="High">{t.high}</option>
                  <option value="Urgent">{t.urgent}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-600 block mb-1">{language === 'en' ? 'Notes' : 'नोट्स'}</label>
                <textarea
                  value={editOrderData.notes || selectedOrder.notes || ''}
                  onChange={(e) => setEditOrderData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button onClick={() => handleSubmit('edit')} className="flex-1">
                  {language === 'en' ? 'Save Changes' : 'परिवर्तन सहेजें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'print':
        return (
          <ModalWrapper title={t.printOrder}>
            <div className="space-y-4">
              <div className="bg-zinc-50 p-4 rounded-lg">
                <h3 className="mb-3">{language === 'en' ? 'Order Sheet Preview' : 'ऑर्डर शीट पूर्वावलोकन'}</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>{t.order}:</strong> {selectedOrder.order_number}</p>
                  <p><strong>{t.product}:</strong> {selectedOrder.product_name}</p>
                  <p><strong>{language === 'en' ? 'Product Code' : 'उत्पाद कोड'}:</strong> {selectedOrder.product_code}</p>
                  <p><strong>{t.quantity}:</strong> {selectedOrder.quantity} {selectedOrder.unit}</p>
                  <p><strong>{t.orderPriority}:</strong> {selectedOrder.priority}</p>
                  <p><strong>{t.status}:</strong> {selectedOrder.status}</p>
                  <p><strong>{t.dueDate}:</strong> {new Date(selectedOrder.due_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button onClick={() => handleSubmit('print')} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Print' : 'प्रिंट करें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'trackProgress':
        // Calculate totals
        const totalTarget = associatedWorkOrders.reduce((sum, wo) => sum + wo.target_quantity, 0);
        const totalCompleted = associatedWorkOrders.reduce((sum, wo) => sum + wo.completed_quantity, 0);
        const overallProgress = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;

        return (
          <ModalWrapper title={`${t.trackProgress}: ${selectedOrder.order_number}`}>
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-zinc-50 p-4 rounded-lg grid grid-cols-3 gap-4 text-center border border-zinc-100">
                <div>
                  <div className="text-xs text-zinc-500 uppercase font-semibold">Ordered</div>
                  <div className="text-xl font-bold text-zinc-900">{selectedOrder.quantity} <span className="text-xs font-normal text-zinc-500">{selectedOrder.unit}</span></div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase font-semibold">In Production</div>
                  <div className="text-xl font-bold text-blue-600">{totalTarget} <span className="text-xs font-normal text-zinc-500">active</span></div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase font-semibold">Completed</div>
                  <div className="text-xl font-bold text-emerald-600">{Math.round(totalCompleted)} <span className="text-xs font-normal text-zinc-500">done</span></div>
                </div>
              </div>

              {/* Progress Bar Overall */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>Overall Completion</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(overallProgress, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {associatedWorkOrders.length > 0 ? (
                  associatedWorkOrders.map((wo, idx) => {
                    const progress = wo.target_quantity > 0 ? (wo.completed_quantity / wo.target_quantity) * 100 : 0;
                    const status = wo.status.toLowerCase();
                    const isComplete = status === 'completed';
                    const isActive = status === 'in_progress';

                    return (
                      <div key={wo.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isComplete ? 'bg-emerald-500 text-white' :
                          isActive ? 'bg-blue-500 text-white' :
                            'bg-zinc-200 text-zinc-500'
                          }`}>
                          {isComplete ? '✓' : idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{wo.operation}</p>
                          <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full ${isComplete ? 'bg-emerald-500' : isActive ? 'bg-blue-500' : 'bg-zinc-300'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-zinc-600">{Math.round(progress)}%</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 bg-zinc-50 rounded-lg">
                    <AlertCircle className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">
                      {language === 'en' ? 'No work orders created for this order yet.' : 'इस ऑर्डर के लिए अभी तक कोई वर्किंग ऑर्डर नहीं बनाया गया है।'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => handleAction('createWorkingOrder', selectedOrder.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t.createWorkingOrder}
                    </Button>
                  </div>
                )}
              </div>
              <Button onClick={closeModal} className="w-full">
                {language === 'en' ? 'Close' : 'बंद करें'}
              </Button>
            </div>
          </ModalWrapper>
        );

      case 'productionPlan':
        const completedCount = associatedWorkOrders.filter(wo => wo.status.toLowerCase() === 'completed').length;
        const activeCount = associatedWorkOrders.filter(wo => wo.status.toLowerCase() === 'in_progress').length;
        const pendingCount = associatedWorkOrders.length - completedCount - activeCount;

        return (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={closeModal} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl">{`${t.productionPlan}: ${selectedOrder.order_number}`}</h2>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={closeModal}>
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[calc(90vh-8rem)] space-y-6">
                  <div className="bg-zinc-50 p-4 rounded-lg">
                    <h3 className="font-medium mb-3">{language === 'en' ? 'Order Summary' : 'ऑर्डर सारांश'}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-zinc-600">{t.product}</p>
                        <p className="font-medium">{selectedOrder.product_name}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">{t.quantity}</p>
                        <p className="font-medium">{selectedOrder.quantity} {language === 'en' ? 'units' : 'यूनिट'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">{language === 'en' ? 'Start Date' : 'प्रारंभ तिथि'}</p>
                        <p className="font-medium">{(selectedOrder as any).start_time ? new Date((selectedOrder as any).start_time).toLocaleDateString() : 'TBD'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">{t.dueDate}</p>
                        <p className="font-medium">{new Date(selectedOrder.due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Stages */}
                  <div className="space-y-4">
                    {associatedWorkOrders.length > 0 ? (
                      associatedWorkOrders.map((wo, idx) => {
                        const status = wo.status.toLowerCase();
                        const isComplete = status === 'completed';
                        const isActive = status === 'in_progress';

                        return (
                          <div key={wo.id} className={`relative border-l-4 ${isComplete ? 'border-emerald-500' : isActive ? 'border-blue-500' : 'border-zinc-200'} pl-4 pb-6 last:pb-2`}>
                            <div className={`absolute -left-[13px] top-0 w-6 h-6 rounded-full flex items-center justify-center ${isComplete ? 'bg-emerald-500' : isActive ? 'bg-blue-500' : 'bg-zinc-200'}`}>
                              {isComplete ? <CheckCircle2 className="h-4 w-4 text-white" /> :
                                isActive ? <Minus className="h-4 w-4 text-white" /> :
                                  <AlertCircle className="h-4 w-4 text-zinc-500" />
                              }
                            </div>
                            <div className={`bg-white border ${isActive ? 'border-blue-200 bg-blue-50/30' : 'border-zinc-200'} rounded-lg p-4`}>
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-medium">{idx + 1}. {wo.operation}</h3>
                                  <p className={`text-sm ${isComplete ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-zinc-500'}`}>
                                    {isComplete ? (language === 'en' ? 'Completed' : 'पूर्ण') :
                                      isActive ? (language === 'en' ? 'In Progress' : 'प्रगति में') :
                                        (language === 'en' ? 'Planned' : 'योजनित')}
                                  </p>
                                </div>
                                <Badge className={isComplete ? 'bg-emerald-500' : isActive ? 'bg-blue-500' : 'bg-zinc-400'}>
                                  {wo.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                                <div>
                                  <p className="text-zinc-600 font-normal uppercase text-[10px] tracking-wider">{language === 'en' ? 'Start' : 'शुरू'}</p>
                                  <p>{wo.scheduled_start ? new Date(wo.scheduled_start).toLocaleString() : 'TBD'}</p>
                                </div>
                                <div>
                                  <p className="text-zinc-600 font-normal uppercase text-[10px] tracking-wider">{language === 'en' ? 'End' : 'समाप्ति'}</p>
                                  <p>{wo.scheduled_end ? new Date(wo.scheduled_end).toLocaleString() : 'TBD'}</p>
                                </div>
                                {wo.assigned_team && (
                                  <div className="col-span-2 mt-2">
                                    <p className="text-zinc-600 font-normal uppercase text-[10px] tracking-wider">{language === 'en' ? 'Team' : 'टीम'}</p>
                                    <p className="flex items-center gap-1"><Users className="h-3 w-3" /> {wo.assigned_team}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-300">
                        <Package className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">
                          {language === 'en' ? 'No production stages defined.' : 'कोई उत्पादन चरण परिभाषित नहीं हैं।'}
                        </p>
                        <p className="text-zinc-400 text-xs mt-1">
                          {language === 'en' ? 'Create working orders to see the timeline.' : 'समयरेखा देखने के लिए वर्किंग ऑर्डर बनाएं।'}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => handleAction('createWorkingOrder', selectedOrder.id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t.createWorkingOrder}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Summary Card */}
                  {associatedWorkOrders.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 rounded-lg border border-emerald-100">
                      <h3 className="font-medium mb-3 text-emerald-900">{language === 'en' ? 'Production Summary' : 'उत्पादन सारांश'}</h3>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-white/60 p-2 rounded-md">
                          <p className="text-zinc-600 text-[10px] uppercase font-semibold">{language === 'en' ? 'Completed' : 'पूर्ण'}</p>
                          <p className="text-xl font-bold text-emerald-600">{completedCount}/{associatedWorkOrders.length}</p>
                        </div>
                        <div className="bg-white/60 p-2 rounded-md">
                          <p className="text-zinc-600 text-[10px] uppercase font-semibold">{language === 'en' ? 'Active' : 'सक्रिय'}</p>
                          <p className="text-xl font-bold text-blue-600">{activeCount}/{associatedWorkOrders.length}</p>
                        </div>
                        <div className="bg-white/60 p-2 rounded-md">
                          <p className="text-zinc-600 text-[10px] uppercase font-semibold">{language === 'en' ? 'Pending' : 'लंबित'}</p>
                          <p className="text-xl font-bold text-zinc-500">{pendingCount}/{associatedWorkOrders.length}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={closeModal} className="w-full h-12 text-base font-medium">
                    {language === 'en' ? 'Close Plan' : 'योजना बंद करें'}
                  </Button>
                </div>
              </Card>
            </div>
          </>
        );

      case 'assignTeam':
        return (
          <ModalWrapper title={`${t.assignTeam}: ${selectedOrder.order_number}`}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-600 mb-2 block">
                  {language === 'en' ? 'Select Team' : 'टीम चुनें'}
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="">{language === 'en' ? 'Choose team...' : 'टीम चुनें...'}</option>
                  <option value="Team A - Cutting Department">Team A - Cutting Department</option>
                  <option value="Team B - Sewing Department">Team B - Sewing Department</option>
                  <option value="Team C - Quality Control">Team C - Quality Control</option>
                  <option value="Team D - Packaging">Team D - Packaging</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button
                  onClick={() => handleSubmit('assignTeam')}
                  className="flex-1"
                  disabled={!selectedTeam}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Assign' : 'असाइन करें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'addNotes':
        return (
          <ModalWrapper title={`${t.addNotes}: ${selectedOrder.order_number}`}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-600 mb-2 block">
                  {language === 'en' ? 'Add Note or Comment' : 'नोट या टिप्पणी जोड़ें'}
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full p-3 border border-zinc-300 rounded-md min-h-[120px]"
                  placeholder={language === 'en' ? 'Enter notes or special instructions...' : 'नोट्स या विशेष निर्देश दर्ज करें...'}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button
                  onClick={() => handleSubmit('addNotes')}
                  className="flex-1"
                  disabled={!noteText.trim()}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Save Note' : 'नोट सहेजें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'generateQR':
        return (
          <ModalWrapper title={t.generateQR}>
            <div className="space-y-4">
              <div className="text-center py-4">
                <h3 className="font-medium mb-2">{selectedOrder.order_number}</h3>
                {selectedOrder.qr_code ? (
                  <div className="flex flex-col items-center gap-4">
                    <img
                      src={selectedOrder.qr_code}
                      alt={`QR Code for ${selectedOrder.order_number}`}
                      className="w-64 h-64 border-2 border-zinc-200 rounded-lg"
                    />
                    <p className="text-sm text-zinc-600">
                      {language === 'en' ? 'Scan this QR code to view order details' : 'ऑर्डर विवरण देखने के लिए इस QR कोड को स्कैन करें'}
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-500">{language === 'en' ? 'No QR code available' : 'QR कोड उपलब्ध नहीं है'}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Close' : 'बंद करें'}
                </Button>
                {selectedOrder.qr_code && (
                  <Button onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedOrder.qr_code || '';
                    link.download = `${selectedOrder.order_number}-QR.png`;
                    link.click();
                    alert(`QR ${language === 'en' ? 'code downloaded' : 'कोड डाउनलोड किया गया'}`);
                  }} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'en' ? 'Download' : 'डाउनलोड करें'}
                  </Button>
                )}
              </div>
            </div>
          </ModalWrapper>
        );

      case 'downloadBOM':
      case 'exportExcel':
        return (
          <ModalWrapper title={activeModal === 'downloadBOM' ? (t as any).downloadBOM || 'Download BOM' : (t as any).exportExcel || 'Export Excel'}>
            <div className="space-y-4">
              <div className="text-center py-8">
                {activeModal === 'downloadBOM' && <FileText className="h-16 w-16 mx-auto text-emerald-500 mb-4" />}
                {activeModal === 'exportExcel' && <Download className="h-16 w-16 mx-auto text-blue-500 mb-4" />}
                <p className="text-zinc-600">
                  {language === 'en'
                    ? `Preparing ${activeModal === 'downloadBOM' ? 'BOM document' : 'Excel file'} for ${selectedOrder.order_number}...`
                    : `${selectedOrder.order_number} के लिए ${activeModal === 'downloadBOM' ? 'BOM दस्तावेज़' : 'Excel फ़ाइल'} तैयार किया जा रहा है...`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button onClick={() => handleSubmit(activeModal)} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Download' : 'डाउनलोड करें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'sendToProduction':
        return (
          <ModalWrapper title={t.sendToProduction}>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-blue-900">
                  {language === 'en'
                    ? `Send order ${selectedOrder.id} to production floor?`
                    : `ऑर्डर ${selectedOrder.id} को उत्पादन तल पर भेजें?`}
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  {language === 'en'
                    ? 'This will notify the production team and start the manufacturing process.'
                    : 'यह उत्पादन टीम को सूचित करेगा और निर्माण प्रक्रिया शुरू करेगा।'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button onClick={() => handleSubmit('sendToProduction')} className="flex-1 bg-blue-600">
                  <Send className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Send to Production' : 'उत्पादन में भेजें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'requestMaterials':
        return (
          <ModalWrapper title={t.requestMaterials}>
            <div className="space-y-4">
              <p className="text-zinc-600">
                {language === 'en'
                  ? `Create material request for order ${selectedOrder.id}?`
                  : `ऑर्डर ${selectedOrder.id} के लिए सामग्री अनुरोध बनाएं?`}
              </p>
              <div className="bg-zinc-50 p-4 rounded-lg">
                <p className="text-sm mb-2">{language === 'en' ? 'Required Materials:' : 'आवश्यक सामग्री:'}</p>
                <ul className="text-sm space-y-1 text-zinc-600">
                  <li>• Cotton Fabric: {selectedOrder.quantity * 2}kg</li>
                  <li>• Thread: {selectedOrder.quantity * 0.5}kg</li>
                  <li>• Labels: {selectedOrder.quantity} pcs</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button onClick={() => handleSubmit('requestMaterials')} className="flex-1">
                  <Package className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Create Request' : 'अनुरोध बनाएं'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'reschedule':
        return (
          <ModalWrapper title={t.reschedule}>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-600 mb-2 block">
                  {language === 'en' ? 'Current Due Date' : 'वर्तमान नियत तारीख'}
                </label>
                <Input type="text" value={selectedOrder.due_date} disabled />
              </div>
              <div>
                <label className="text-sm text-zinc-600 mb-2 block">
                  {language === 'en' ? 'New Due Date' : 'नई नियत तारीख'}
                </label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button
                  onClick={() => handleSubmit('reschedule')}
                  className="flex-1"
                  disabled={!newDueDate}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Reschedule' : 'पुनर्निर्धारित करें'}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      case 'share':
        return (
          <ModalWrapper title={t.shareOrder}>
            <div className="space-y-4">
              <p className="text-zinc-600">
                {language === 'en' ? `Share order ${selectedOrder.id} with:` : `इसके साथ ऑर्डर ${selectedOrder.id} साझा करें:`}
              </p>
              <div className="space-y-2">
                {[
                  { icon: '📧', label: language === 'en' ? 'Email' : 'ईमेल' },
                  { icon: '💬', label: language === 'en' ? 'WhatsApp' : 'WhatsApp' },
                  { icon: '🔗', label: language === 'en' ? 'Copy Link' : 'लिंक कॉपी करें' },
                  { icon: '📱', label: language === 'en' ? 'SMS' : 'SMS' }
                ].map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubmit('share')}
                    className="w-full p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50 flex items-center gap-3"
                  >
                    <span className="text-2xl">{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </ModalWrapper>
        );

      case 'viewHistory':
        return (
          <ModalWrapper title={`${t.viewHistory}: ${selectedOrder.id}`}>
            <div className="space-y-3">
              {[
                { date: '2024-12-03 10:30', action: 'Order created', user: 'Admin' },
                { date: '2024-12-03 11:15', action: 'Sent to production', user: 'Manager' },
                { date: '2024-12-03 14:20', action: 'Material requested', user: 'Supervisor' },
                { date: '2024-12-03 16:45', action: 'Progress updated to 45%', user: 'System' }
              ].map((entry, idx) => (
                <div key={idx} className="flex gap-3 pb-3 border-b last:border-0">
                  <Clock className="h-5 w-5 text-zinc-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">{entry.action}</p>
                    <p className="text-xs text-zinc-500">{entry.date} • {entry.user}</p>
                  </div>
                </div>
              ))}
              <Button onClick={closeModal} className="w-full mt-4">
                {language === 'en' ? 'Close' : 'बंद करें'}
              </Button>
            </div>
          </ModalWrapper>
        );

      case 'archive':
      case 'priority':
      case 'cancel':
      case 'delete':
        const config = {
          archive: { color: 'blue', icon: Archive, title: t.archiveOrder },
          priority: { color: 'amber', icon: Star, title: t.markPriority },
          cancel: { color: 'amber', icon: XCircle, title: t.cancelOrder },
          delete: { color: 'red', icon: Trash2, title: t.deleteOrder }
        }[activeModal];

        return (
          <ModalWrapper title={config.title}>
            <div className="space-y-4">
              <div className={`bg-${config.color}-50 border border-${config.color}-200 p-4 rounded-lg`}>
                <div className="flex items-center gap-3 mb-2">
                  <config.icon className={`h-6 w-6 text-${config.color}-600`} />
                  <p className={`text-${config.color}-900`}>
                    {language === 'en'
                      ? `Are you sure you want to ${activeModal} this order?`
                      : `क्या आप वाकई इस ऑर्डर को ${activeModal === 'delete' ? 'हटाना' : activeModal === 'cancel' ? 'रद्द करना' : activeModal === 'archive' ? 'संग्रहित करना' : 'प्राथमिकता के रूप में चिह्नित करना'} चाहते हैं?`}
                  </p>
                </div>
                <p className="text-sm text-zinc-600">
                  {t.order}: <strong>{selectedOrder.id}</strong>
                </p>
                {activeModal === 'delete' && (
                  <p className={`text-sm text-${config.color}-700 mt-2`}>
                    {language === 'en' ? '⚠️ This action cannot be undone!' : '⚠️ यह क्रिया पूर्ववत नहीं की जा सकती!'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModal} variant="outline" className="flex-1">
                  {language === 'en' ? 'Cancel' : 'रद्द करें'}
                </Button>
                <Button
                  onClick={() => handleSubmit(activeModal)}
                  className={`flex-1 bg-${config.color}-600`}
                >
                  {config.title}
                </Button>
              </div>
            </div>
          </ModalWrapper>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Render Modal */}
      {renderModal()}

      <div className="flex items-center justify-between">
        <h1>{t.title}</h1>
        <Button className="hidden sm:flex" onClick={() => setShowNewOrderModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t.newOrder}
        </Button>
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
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === 'en' ? 'Refresh' : 'रीफ्रेश'}
          </Button>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-zinc-600">{language === 'en' ? 'Loading purchase orders...' : 'उत्पादन आदेश लोड हो रहे हैं...'}</p>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="p-8 border-red-200 bg-red-50">
          <div className="flex flex-col items-center justify-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <p className="text-red-900 font-medium">{language === 'en' ? 'Error loading orders' : 'ऑर्डर लोड करने में त्रुटि'}</p>
            <p className="text-red-700 text-sm">{error}</p>
            <Button onClick={fetchOrders} variant="outline" className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'en' ? 'Retry' : 'पुनः प्रयास करें'}
            </Button>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && orders && orders.length === 0 && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <Package className="h-12 w-12 text-zinc-400" />
            <p className="text-zinc-600 font-medium">{language === 'en' ? 'No purchase orders found' : 'कोई उत्पादन आदेश नहीं मिला'}</p>
            <p className="text-zinc-500 text-sm">{language === 'en' ? 'Create your first order to get started' : 'शुरू करने के लिए अपना पहला ऑर्डर बनाएं'}</p>
            <Button onClick={() => setShowNewOrderModal(true)} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              {t.newOrder}
            </Button>
          </div>
        </Card>
      )}

      {/* Orders List - Mobile Card View */}
      {!isLoading && !error && orders && orders.length > 0 && (
        <div className="lg:hidden space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{order.order_number}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-zinc-600">{order.product_name}</p>
                </div>
                <OrderActionsDropdown
                  orderId={order.id}
                  onAction={handleAction}
                  translations={t as any}
                />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">{t.quantity}:</span>
                  <span>{order.quantity} {order.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">{t.status}:</span>
                  <span>{order.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">{t.dueDate}:</span>
                  <span>{new Date(order.due_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Priority Badge and Progress */}
              <div className="mt-3 space-y-2">
                <Badge className={order.priority === 'High' || order.priority === 'Urgent' ? 'bg-red-500' : order.priority === 'Cancelled' ? 'bg-zinc-500' : order.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}>
                  {order.priority}
                </Badge>
                {/* Progress Bar */}
                {order.progress_percentage !== undefined && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 mt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      <span>{language === 'en' ? 'Production Progress' : 'उत्पादन प्रगति'}</span>
                      <span className="text-zinc-900">{Math.round(order.progress_percentage || 0)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                      <div
                        className={`h-full transition-all duration-700 ${order.progress_percentage >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                          order.progress_percentage >= 50 ? 'bg-blue-500' :
                            'bg-zinc-400'
                          }`}
                        style={{ width: `${order.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Orders Table - Desktop View */}
      {!isLoading && !error && orders && orders.length > 0 && (
        <Card className="hidden lg:block overflow-hidden">
          <div className="overflow-x-auto">
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-4 bg-zinc-50">{t.order}</th>
                    <th className="text-left p-4 bg-zinc-50">{t.product}</th>
                    <th className="text-left p-4 bg-zinc-50">{t.quantity}</th>
                    <th className="text-left p-4 bg-zinc-50">{t.orderPriority}</th>
                    <th className="text-left p-4 bg-zinc-50">{t.status}</th>
                    <th className="text-left p-4 bg-zinc-50">{language === 'en' ? 'Progress' : 'प्रगति'}</th>
                    <th className="text-left p-4 bg-zinc-50">{language === 'en' ? 'Days Until Due' : 'नियत तिथि तक'}</th>
                    <th className="text-left p-4 bg-zinc-50">{t.dueDate}</th>
                    <th className="text-left p-4 bg-zinc-50">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-zinc-50">
                      <td
                        className="p-4 font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                        onClick={() => handleOrderClick(order)}
                      >
                        {order.order_number}
                      </td>
                      <td className="p-4">{order.product_name}</td>
                      <td className="p-4">{order.quantity} {order.unit}</td>
                      <td className="p-4">
                        <Badge className={order.priority === 'High' || order.priority === 'Urgent' ? 'bg-red-500' : order.priority === 'Cancelled' ? 'bg-zinc-500' : order.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}>
                          {order.priority}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {getStatusBadge(order.status)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200 shadow-inner">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${(order.progress_percentage ?? 0) >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                (order.progress_percentage ?? 0) >= 50 ? 'bg-blue-500' :
                                  'bg-zinc-400'
                                }`}
                              style={{ width: `${order.progress_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-zinc-600 w-9 tabular-nums">
                            {Math.round(order.progress_percentage || 0)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {order.days_until_due !== undefined && (
                          <span className={order.is_overdue ? 'text-red-600 font-medium' : order.days_until_due <= 3 ? 'text-yellow-600' : 'text-zinc-600'}>
                            {order.is_overdue ? `${Math.abs(order.days_until_due)} days overdue` : `${order.days_until_due} days left`}
                          </span>
                        )}
                      </td>
                      <td className="p-4">{new Date(order.due_date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <OrderActionsDropdown
                          orderId={order.id}
                          onAction={handleAction}
                          translations={t as any}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Mobile New Order Button */}
      <Button
        className="lg:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setShowNewOrderModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          isOpen={showNewOrderModal}
          onClose={closeNewOrderModal}
          orderData={newOrderData}
          onOrderDataChange={setNewOrderData}
          onSubmit={createNewOrder}
          products={products.reduce((acc, p) => ({ ...acc, [p.id]: { name: p.name, code: p.code, unit: p.unit } }), {})}
          translations={t}
          onProductCreated={fetchProducts}
        />
      )}
    </div>
  );
}