import { Search, Filter, Plus, Play, Pause, CheckCircle2, Clock, AlertCircle, Calendar, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

type WorkingOrderProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

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

const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-0001',
    productionOrderId: 'PO-0001',
    product: 'Basic Cotton T-Shirt',
    quantity: 500,
    completedQty: 340,
    status: 'in-progress',
    priority: 'high',
    startTime: '2024-12-16 08:00',
    estimatedEnd: '2024-12-16 14:00',
    assignedTo: 'Team A',
    operations: [
      {
        name: 'Cutting',
        completedUnits: 120,
        status: 'completed',
        assignedTo: 'Team A',
        workstation: 'Cutting Table A',
        targetUnits: 500
      },
      {
        name: 'Sewing',
        completedUnits: 85,
        status: 'in-progress',
        assignedTo: 'Team B',
        workstation: 'Sewing Line 1',
        targetUnits: 500
      },
      {
        name: 'Finishing',
        completedUnits: 60,
        status: 'in-progress',
        assignedTo: 'Team C',
        workstation: 'Finishing Station 1',
        targetUnits: 500
      },
      {
        name: 'Quality Check',
        completedUnits: 45,
        status: 'pending',
        assignedTo: 'QC Team',
        workstation: 'QC Station 1',
        targetUnits: 500
      },
      {
        name: 'Packing',
        completedUnits: 30,
        status: 'pending',
        assignedTo: 'Packing Team',
        workstation: 'Packing Station 1',
        targetUnits: 500
      }
    ]
  },
  {
    id: 'WO-0002',
    productionOrderId: 'PO-0001',
    product: 'Basic Cotton T-Shirt',
    quantity: 500,
    completedQty: 0,
    status: 'pending',
    priority: 'high',
    startTime: '2024-12-16 14:30',
    estimatedEnd: '2024-12-17 18:00',
    assignedTo: 'Team B',
    operations: [
      {
        name: 'Cutting',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Team A',
        workstation: 'Cutting Table A',
        targetUnits: 500
      },
      {
        name: 'Sewing',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Team B',
        workstation: 'Sewing Line 1',
        targetUnits: 500
      },
      {
        name: 'Finishing',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Team C',
        workstation: 'Finishing Station 1',
        targetUnits: 500
      },
      {
        name: 'Quality Check',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'QC Team',
        workstation: 'QC Station 1',
        targetUnits: 500
      },
      {
        name: 'Packing',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Packing Team',
        workstation: 'Packing Station 1',
        targetUnits: 500
      }
    ]
  },
  {
    id: 'WO-0003',
    productionOrderId: 'PO-0002',
    product: 'Fleece Hoodie',
    quantity: 200,
    completedQty: 200,
    status: 'completed',
    priority: 'normal',
    startTime: '2024-12-15 08:00',
    estimatedEnd: '2024-12-15 12:00',
    actualEnd: '2024-12-15 11:45',
    assignedTo: 'Team C',
    operations: [
      {
        name: 'Cutting',
        completedUnits: 200,
        status: 'completed',
        assignedTo: 'Team A',
        workstation: 'Cutting Table B',
        targetUnits: 200
      },
      {
        name: 'Sewing',
        completedUnits: 200,
        status: 'completed',
        assignedTo: 'Team B',
        workstation: 'Sewing Line 2',
        targetUnits: 200
      },
      {
        name: 'Finishing',
        completedUnits: 200,
        status: 'completed',
        assignedTo: 'Team C',
        workstation: 'Finishing Station 2',
        targetUnits: 200
      },
      {
        name: 'Quality Check',
        completedUnits: 200,
        status: 'completed',
        assignedTo: 'QC Team',
        workstation: 'QC Station 2',
        targetUnits: 200
      },
      {
        name: 'Packing',
        completedUnits: 200,
        status: 'completed',
        assignedTo: 'Packing Team',
        workstation: 'Packing Station 2',
        targetUnits: 200
      }
    ]
  },
  {
    id: 'WO-0004',
    productionOrderId: 'PO-0002',
    product: 'Fleece Hoodie',
    quantity: 200,
    completedQty: 85,
    status: 'in-progress',
    priority: 'normal',
    startTime: '2024-12-15 13:00',
    estimatedEnd: '2024-12-16 17:00',
    assignedTo: 'Team D',
    operations: [
      {
        name: 'Cutting',
        completedUnits: 200,
        status: 'completed',
        assignedTo: 'Team A',
        workstation: 'Cutting Table B',
        targetUnits: 200
      },
      {
        name: 'Sewing',
        completedUnits: 85,
        status: 'in-progress',
        assignedTo: 'Team D',
        workstation: 'Sewing Line 2',
        targetUnits: 200
      },
      {
        name: 'Finishing',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Team C',
        workstation: 'Finishing Station 2',
        targetUnits: 200
      },
      {
        name: 'Quality Check',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'QC Team',
        workstation: 'QC Station 2',
        targetUnits: 200
      },
      {
        name: 'Packing',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Packing Team',
        workstation: 'Packing Station 2',
        targetUnits: 200
      }
    ]
  },
  {
    id: 'WO-0005',
    productionOrderId: 'PO-0003',
    product: 'Polyester Track Pants',
    quantity: 150,
    completedQty: 50,
    status: 'on-hold',
    priority: 'urgent',
    startTime: '2024-12-16 09:00',
    estimatedEnd: '2024-12-16 15:00',
    assignedTo: 'QC Team',
    operations: [
      {
        name: 'Cutting',
        completedUnits: 150,
        status: 'completed',
        assignedTo: 'Team A',
        workstation: 'Cutting Table C',
        targetUnits: 150
      },
      {
        name: 'Sewing',
        completedUnits: 150,
        status: 'completed',
        assignedTo: 'Team B',
        workstation: 'Sewing Line 3',
        targetUnits: 150
      },
      {
        name: 'Finishing',
        completedUnits: 150,
        status: 'completed',
        assignedTo: 'Team C',
        workstation: 'Finishing Station 3',
        targetUnits: 150
      },
      {
        name: 'Quality Check',
        completedUnits: 50,
        status: 'on-hold',
        assignedTo: 'QC Team',
        workstation: 'QC Station 1',
        targetUnits: 150
      },
      {
        name: 'Packing',
        completedUnits: 0,
        status: 'pending',
        assignedTo: 'Packing Team',
        workstation: 'Packing Station 3',
        targetUnits: 150
      }
    ]
  },
];

export function WorkingOrder({ language }: WorkingOrderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [poFilter, setPoFilter] = useState<string>('all');

  // Get unique production order IDs for filter dropdown
  const uniquePOs = [...new Set(MOCK_WORK_ORDERS.map(wo => wo.productionOrderId))];

  const translations = {
    en: {
      title: 'Working Orders',
      search: 'Search work orders...',
      filter: 'Filter',
      newWorkOrder: 'New Work Order',
      workOrder: 'Work Order',
      productionOrder: 'Production Order',
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

  const getPriorityBadge = (priority: WorkOrder['priority']) => {
    const priorityConfig = {
      'low': { color: 'bg-zinc-400', label: t.low },
      'normal': { color: 'bg-blue-400', label: t.normal },
      'high': { color: 'bg-orange-500', label: t.high },
      'urgent': { color: 'bg-red-500', label: t.urgent },
    };
    const config = priorityConfig[priority];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredOrders = MOCK_WORK_ORDERS.filter(order => {
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

  const handleAction = (action: string, orderId: string) => {
    const order = MOCK_WORK_ORDERS.find(o => o.id === orderId);
    if (!order) return;

    switch (action) {
      case 'start':
        alert(`✅ ${language === 'en' ? 'Started work order' : 'कार्य आदेश शुरू किया'}: ${orderId}`);
        break;
      case 'pause':
        alert(`⏸️ ${language === 'en' ? 'Paused work order' : 'कार्य आदेश रोका'}: ${orderId}`);
        break;
      case 'complete':
        alert(`✅ ${language === 'en' ? 'Completed work order' : 'कार्य आदेश पूर्ण'}: ${orderId}`);
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
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

      {/* Work Orders Grid */}
      <div className="grid gap-4">
        {filteredOrders.map((order) => {
          const progressPercent = Math.round((order.completedQty / order.quantity) * 100);
          
          return (
            <Card key={order.id} className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Order Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{order.id}</span>
                        {getStatusBadge(order.status)}
                        {getPriorityBadge(order.priority)}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        {t.productionOrder}: {order.productionOrderId}
                      </p>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-4">
                    {/* Product Info */}
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm font-medium">{order.product}</span>
                    </div>

                    {/* Operation Progress */}
                    <div>
                      <h4 className="text-sm font-medium text-zinc-500 mb-2">
                        {language === 'en' ? 'Operation Progress' : 'ऑपरेशन प्रगति'}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {order.operations.map((op, idx) => (
                          <div
                            key={idx}
                            className={`
                              p-3 rounded-lg text-center border
                              ${op.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                                op.status === 'in-progress' ? 'bg-blue-50 border-blue-200' :
                                op.status === 'on-hold' ? 'bg-amber-50 border-amber-200' :
                                'bg-zinc-50 border-zinc-200'}
                            `}
                          >
                            <div className="text-sm font-medium">{op.name}</div>
                            <div className="text-lg font-semibold my-1">{op.completedUnits} {t.units}</div>
                            <div className="text-xs text-zinc-500">
                              {Math.round((op.completedUnits / op.targetUnits) * 100)}% {t.of} {op.targetUnits}
                            </div>
                            <div className="mt-1 text-xs">
                              <span className="text-zinc-500">{t.workstation}:</span> {op.workstation}
                            </div>
                            <div className="text-xs">
                              <span className="text-zinc-500">{t.assignedTo}:</span> {op.assignedTo}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Overall Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">{t.overallProgress}</span>
                        <span className="font-medium">
                          {order.completedQty} {t.of} {order.quantity} {t.units} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            order.status === 'completed' ? 'bg-emerald-500' :
                            order.status === 'in-progress' ? 'bg-blue-500' :
                            order.status === 'on-hold' ? 'bg-amber-500' :
                            'bg-zinc-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{t.startTime}: {order.startTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{t.estimatedEnd}: {order.estimatedEnd}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex lg:flex-col gap-2">
                  {order.status === 'pending' && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleAction('start', order.id)}
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
                        onClick={() => handleAction('pause', order.id)}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        {t.pause}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleAction('complete', order.id)}
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
                      onClick={() => handleAction('start', order.id)}
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
    </div>
  );
}
