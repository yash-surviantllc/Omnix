import { useState } from 'react';
import { TruckIcon, Package, FileText, CheckCircle, Clock, AlertCircle, Search, Plus, X, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type GateExitProps = {
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

type ExitType = 'dispatch' | 'jobwork_out' | 'scrap' | 'courier' | 'return' | 'transfer' | 'sample';

type GateExitRecord = {
  id: string;
  exitType: ExitType;
  destination: string;
  vehicleNo: string;
  driverName: string;
  materials: {
    materialCode: string;
    materialName: string;
    qty: number;
    uom: string;
  }[];
  linkedDocument: string;
  customer: string;
  status: 'ready' | 'verified' | 'dispatched' | 'in_transit';
  timestamp: string;
  remarks: string;
};

export function GateExit({ language }: GateExitProps) {
  const [showExitModal, setShowExitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  const [exitData, setExitData] = useState<Partial<GateExitRecord>>({
    exitType: 'dispatch',
    materials: [{ materialCode: '', materialName: '', qty: 0, uom: 'pcs' }],
    status: 'ready'
  });

  // Mock data for history
  const [exitHistory] = useState<GateExitRecord[]>([
    {
      id: 'GX-001',
      exitType: 'dispatch',
      destination: 'TrendWear Pvt Ltd',
      vehicleNo: 'KA-01-XY-9876',
      driverName: 'Suresh Kumar',
      materials: [
        { materialCode: 'FG-TS-001', materialName: 'Cotton T-Shirts (Black)', qty: 1200, uom: 'pcs' }
      ],
      linkedDocument: 'SO-5001',
      customer: 'TrendWear Pvt Ltd',
      status: 'dispatched',
      timestamp: '2025-12-03 10:30 AM',
      remarks: 'Delivered to customer warehouse'
    },
    {
      id: 'GX-002',
      exitType: 'jobwork_out',
      destination: 'ABC Stitching Co.',
      vehicleNo: 'KA-05-AB-1234',
      driverName: 'Ramesh',
      materials: [
        { materialCode: 'WIP-030', materialName: 'Cut Hoodie Panels', qty: 300, uom: 'pcs' }
      ],
      linkedDocument: 'JW-OUT-045',
      customer: 'N/A',
      status: 'in_transit',
      timestamp: '2025-12-03 09:15 AM',
      remarks: 'For stitching work'
    },
    {
      id: 'GX-003',
      exitType: 'scrap',
      destination: 'XYZ Scrap Dealers',
      vehicleNo: 'KA-10-CD-5678',
      driverName: 'Prakash',
      materials: [
        { materialCode: 'SCRAP-001', materialName: 'Fabric Waste', qty: 45, uom: 'kg' }
      ],
      linkedDocument: 'SCRAP-NOTE-012',
      customer: 'N/A',
      status: 'verified',
      timestamp: '2025-12-03 08:00 AM',
      remarks: 'Scrap disposal approved'
    }
  ]);

  const translations = {
    en: {
      title: 'Gate Exit (Outward)',
      subtitle: 'Manage all outgoing materials, dispatches, and shipments',
      newExit: 'New Exit',
      history: 'Exit History',
      createExit: '+ Create Gate Exit',
      exitType: 'Exit Type',
      destination: 'Destination',
      customer: 'Customer / Party',
      vehicleNo: 'Vehicle Number',
      driverName: 'Driver Name',
      materials: 'Materials / Items',
      materialCode: 'Material Code',
      materialName: 'Material Name',
      quantity: 'Quantity',
      uom: 'UOM',
      linkedDocument: 'Linked Document',
      remarks: 'Remarks',
      status: 'Status',
      timestamp: 'Date & Time',
      actions: 'Actions',
      search: 'Search exits...',
      addMaterial: '+ Add Material',
      cancel: 'Cancel',
      createRecord: 'Create Exit',
      viewDetails: 'View',
      exitTypes: {
        dispatch: 'Finished Goods Dispatch',
        jobwork_out: 'Job-work Out',
        scrap: 'Scrap Removal',
        courier: 'Courier Parcel',
        return: 'Material Return',
        transfer: 'Inter-Plant Transfer',
        sample: 'Sample Dispatch'
      },
      statuses: {
        ready: 'Ready for Dispatch',
        verified: 'Verified',
        dispatched: 'Dispatched',
        in_transit: 'In Transit'
      },
      enterDestination: 'Enter destination',
      enterCustomer: 'Enter customer name',
      enterVehicle: 'Enter vehicle number',
      enterDriver: 'Enter driver name',
      enterMaterialCode: 'Enter code',
      enterMaterialName: 'Enter material name',
      enterDocument: 'SO/DC/Challan number',
      enterRemarks: 'Add notes or remarks',
      selectType: 'Select exit type',
      noExits: 'No gate exits yet',
      createFirst: 'Create your first gate exit above'
    },
    hi: {
      title: 'गेट एग्जिट (आउटवर्ड)',
      subtitle: 'सभी बाहर जाने वाली सामग्री, प्रेषण और शिपमेंट को प्रबंधित करें',
      newExit: 'नई एग्जिट',
      history: 'एग्जिट इतिहास',
      createExit: '+ गेट एग्जिट बनाएं',
      exitType: 'एग्जिट प्रकार',
      destination: 'गंतव्य',
      customer: 'ग्राहक / पार्टी',
      vehicleNo: 'वाहन नंबर',
      driverName: 'ड्राइवर का नाम',
      materials: 'सामग्री / आइटम',
      materialCode: 'सामग्री कोड',
      materialName: 'सामग्री का नाम',
      quantity: 'मात्रा',
      uom: 'UOM',
      linkedDocument: 'लिंक्ड दस्तावेज़',
      remarks: 'टिप्पणी',
      status: 'स्थिति',
      timestamp: 'दिनांक और समय',
      actions: 'कार्रवाई',
      search: 'एग्जिट खोजें...',
      addMaterial: '+ सामग्री जोड़ें',
      cancel: 'रद्द करें',
      createRecord: 'एग्जिट बनाएं',
      viewDetails: 'देखें',
      exitTypes: {
        dispatch: 'तैयार माल प्रेषण',
        jobwork_out: 'जॉब-वर्क आउट',
        scrap: 'स्क्रैप हटाना',
        courier: 'कूरियर पार्सल',
        return: 'सामग्री वापसी',
        transfer: 'इंटर-प्लांट ट्रांसफर',
        sample: 'नमूना प्रेषण'
      },
      statuses: {
        ready: 'प्रेषण के लिए तैयार',
        verified: 'सत्यापित',
        dispatched: 'प्रेषित',
        in_transit: 'ट्रांजिट में'
      },
      enterDestination: 'गंतव्य दर्ज करें',
      enterCustomer: 'ग्राहक का नाम दर्ज करें',
      enterVehicle: 'वाहन नंबर दर्ज करें',
      enterDriver: 'ड्राइवर का नाम दर्ज करें',
      enterMaterialCode: 'कोड दर्ज करें',
      enterMaterialName: 'सामग्री का नाम दर्ज करें',
      enterDocument: 'SO/DC/चालान नंबर',
      enterRemarks: 'नोट्स या टिप्पणी जोड़ें',
      selectType: 'एग्जिट प्रकार चुनें',
      noExits: 'अभी तक कोई गेट एग्जिट नहीं',
      createFirst: 'ऊपर अपनी पहली गेट एग्जिट बनाएं'
    },
    kn: {
      title: 'ಗೇಟ್ ಎಕ್ಸಿಟ್ (ಔಟ್‌ವರ್ಡ್)',
      subtitle: 'ಎಲ್ಲಾ ಹೊರಹೋಗುವ ವಸ್ತುಗಳು, ರವಾನೆಗಳು ಮತ್ತು ಶಿಪ್‌ಮೆಂಟ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
      newExit: 'ಹೊಸ ಎಕ್ಸಿಟ್',
      history: 'ಎಕ್ಸಿಟ್ ಇತಿಹಾಸ',
      createExit: '+ ಗೇಟ್ ಎಕ್ಸಿಟ್ ರಚಿಸಿ',
      exitType: 'ಎಕ್ಸಿಟ್ ಪ್ರಕಾರ',
      destination: 'ಗಮ್ಯಸ್ಥಾನ',
      customer: 'ಗ್ರಾಹಕ / ಪಾರ್ಟಿ',
      vehicleNo: 'ವಾಹನ ಸಂಖ್ಯೆ',
      driverName: 'ಚಾಲಕ ಹೆಸರು',
      materials: 'ವಸ್ತುಗಳು / ಐಟಂಗಳು',
      materialCode: 'ವಸ್ತು ಕೋಡ್',
      materialName: 'ವಸ್ತು ಹೆಸರು',
      quantity: 'ಪ್ರಮಾಣ',
      uom: 'UOM',
      linkedDocument: 'ಲಿಂಕ್ ದಾಖಲೆ',
      remarks: 'ಟಿಪ್ಪಣಿಗಳು',
      status: 'ಸ್ಥಿತಿ',
      timestamp: 'ದಿನಾಂಕ ಮತ್ತು ಸಮಯ',
      actions: 'ಕ್ರಿಯೆಗಳು',
      search: 'ಎಕ್ಸಿಟ್‌ಗಳನ್ನು ಹುಡುಕಿ...',
      addMaterial: '+ ವಸ್ತು ಸೇರಿಸಿ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      createRecord: 'ಎಕ್ಸಿಟ್ ರಚಿಸಿ',
      viewDetails: 'ನೋಡಿ',
      exitTypes: {
        dispatch: 'ತಯಾರಿ ಸರಕು ರವಾನೆ',
        jobwork_out: 'ಜಾಬ್-ವರ್ಕ್ ಔಟ್',
        scrap: 'ಸ್ಕ್ರ್ಯಾಪ್ ತೆಗೆದುಹಾಕುವಿಕೆ',
        courier: 'ಕೊರಿಯರ್ ಪಾರ್ಸೆಲ್',
        return: 'ವಸ್ತು ರಿಟರ್ನ್',
        transfer: 'ಇಂಟರ್-ಪ್ಲಾಂಟ್ ವರ್ಗಾವಣೆ',
        sample: 'ಸಾಂಪಲ್ ರವಾನೆ'
      },
      statuses: {
        ready: 'ರವಾನೆಗೆ ಸಿದ್ಧ',
        verified: 'ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
        dispatched: 'ರವಾನೆಯಾಗಿದೆ',
        in_transit: 'ಸಾಗುತ್ತಿದೆ'
      },
      enterDestination: 'ಗಮ್ಯಸ್ಥಾನ ನಮೂದಿಸಿ',
      enterCustomer: 'ಗ್ರಾಹಕ ಹೆಸರು ನಮೂದಿಸಿ',
      enterVehicle: 'ವಾಹನ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ',
      enterDriver: 'ಚಾಲಕ ಹೆಸರು ನಮೂದಿಸಿ',
      enterMaterialCode: 'ಕೋಡ್ ನಮೂದಿಸಿ',
      enterMaterialName: 'ವಸ್ತು ಹೆಸರು ನಮೂದಿಸಿ',
      enterDocument: 'SO/DC/ಚಲಾನ್ ಸಂಖ್ಯೆ',
      enterRemarks: 'ಟಿಪ್ಪಣಿಗಳನ್ನು ಸೇರಿಸಿ',
      selectType: 'ಎಕ್ಸಿಟ್ ಪ್ರಕಾರ ಆಯ್ಕೆಮಾಡಿ',
      noExits: 'ಇನ್ನೂ ಗೇಟ್ ಎಕ್ಸಿಟ್‌ಗಳಿಲ್ಲ',
      createFirst: 'ಮೇಲೆ ನಿಮ್ಮ ಮೊದಲ ಗೇಟ್ ಎಕ್ಸಿಟ್ ರಚಿಸಿ'
    },
    ta: {
      title: 'கேட் எக்ஸிட் (வெளிச்செல்லும்)',
      subtitle: 'அனைத்து வெளிச்செல்லும் பொருட்கள், அனுப்புதல்கள் மற்றும் ஏற்றுமதிகளை நிர்வகிக்கவும்',
      newExit: 'புதிய எக்ஸிட்',
      history: 'எக்ஸிட் வரலாறு',
      createExit: '+ கேட் எக்ஸிட் உருவாக்கவும்',
      exitType: 'எக்ஸிட் வகை',
      destination: 'இலக்கு',
      customer: 'வாடிக்கையாளர் / பார்ட்டி',
      vehicleNo: 'வாகன எண்',
      driverName: 'ஓட்டுநர் பெயர்',
      materials: 'பொருட்கள் / பொருட்கள்',
      materialCode: 'பொருள் குறியீடு',
      materialName: 'பொருள் பெயர்',
      quantity: 'அளவு',
      uom: 'UOM',
      linkedDocument: 'இணைக்கப்பட்ட ஆவணம்',
      remarks: 'குறிப்புகள்',
      status: 'நிலை',
      timestamp: 'தேதி மற்றும் நேரம்',
      actions: 'செயல்கள்',
      search: 'எக்ஸிட்களை தேடவும்...',
      addMaterial: '+ பொருள் சேர்க்கவும்',
      cancel: 'ரத்து செய்',
      createRecord: 'எக்ஸிட் உருவாக்கவும்',
      viewDetails: 'பார்க்கவும்',
      exitTypes: {
        dispatch: 'முடிக்கப்பட்ட சரக்கு அனுப்புதல்',
        jobwork_out: 'ஜாப்-வர்க் அவுட்',
        scrap: 'ஸ்கிராப் அகற்றுதல்',
        courier: 'கூரியர் பார்சல்',
        return: 'பொருள் திரும்புதல்',
        transfer: 'இன்டர்-பிளான்ட் பரிமாற்றம்',
        sample: 'மாதிரி அனுப்புதல்'
      },
      statuses: {
        ready: 'அனுப்புதலுக்கு தயார்',
        verified: 'சரிபார்க்கப்பட்டது',
        dispatched: 'அனுப்பப்பட்டது',
        in_transit: 'வழியில்'
      },
      enterDestination: 'இலக்கை உள்ளிடவும்',
      enterCustomer: 'வாடிக்கையாளர் பெயரை உள்ளிடவும்',
      enterVehicle: 'வாகன எண்ணை உள்ளிடவும்',
      enterDriver: 'ஓட்டுநர் பெயரை உள்ளிடவும்',
      enterMaterialCode: 'குறியீட்டை உள்ளிடவும்',
      enterMaterialName: 'பொருள் பெயரை உள்ளிடவும்',
      enterDocument: 'SO/DC/சலான் எண்',
      enterRemarks: 'குறிப்புகளை சேர்க்கவும்',
      selectType: 'எக்ஸிட் வகையைத் தேர்ந்தெடுக்கவும்',
      noExits: 'இன்னும் கேட் எக்ஸிட்கள் இல்லை',
      createFirst: 'மேலே உங்கள் முதல் கேட் எக்ஸிட்டை உருவாக்கவும்'
    },
    te: {
      title: 'గేట్ ఎగ్జిట్ (ఔట్‌వార్డ్)',
      subtitle: 'అన్ని అవుట్‌గోయింగ్ మెటీరియల్స్, డిస్పాచ్‌లు మరియు షిప్‌మెంట్‌లను నిర్వహించండి',
      newExit: 'కొత్త ఎగ్జిట్',
      history: 'ఎగ్జిట్ చరిత్ర',
      createExit: '+ గేట్ ఎగ్జిట్ సృష్టించండి',
      exitType: 'ఎగ్జిట్ రకం',
      destination: 'గమ్యం',
      customer: 'కస్టమర్ / పార్టీ',
      vehicleNo: 'వాహన నంబర్',
      driverName: 'డ్రైవర్ పేరు',
      materials: 'మెటీరియల్స్ / ఐటెమ్స్',
      materialCode: 'మెటీరియల్ కోడ్',
      materialName: 'మెటీరియల్ పేరు',
      quantity: 'పరిమాణం',
      uom: 'UOM',
      linkedDocument: 'లింక్ చేసిన పత్రం',
      remarks: 'గమనికలు',
      status: 'స్థితి',
      timestamp: 'తేదీ మరియు సమయం',
      actions: 'చర్యలు',
      search: 'ఎగ్జిట్‌లను శోధించండి...',
      addMaterial: '+ మెటీరియల్ జోడించండి',
      cancel: 'రద్దు చేయండి',
      createRecord: 'ఎగ్జిట్ సృష్టించండి',
      viewDetails: 'చూడండి',
      exitTypes: {
        dispatch: 'పూర్తి సరుకు డిస్పాచ్',
        jobwork_out: 'జాబ్-వర్క్ ఔట్',
        scrap: 'స్క్రాప్ తొలగింపు',
        courier: 'కొరియర్ పార్సెల్',
        return: 'మెటీరియల్ రిటర్న్',
        transfer: 'ఇంటర్-ప్లాంట్ ట్రాన్స్‌ఫర్',
        sample: 'సాంపిల్ డిస్పాచ్'
      },
      statuses: {
        ready: 'డిస్పాచ్ కోసం సిద్ధం',
        verified: 'ధృవీకరించబడింది',
        dispatched: 'డిస్పాచ్ చేయబడింది',
        in_transit: 'రవాణాలో'
      },
      enterDestination: 'గమ్యం నమోదు చేయండి',
      enterCustomer: 'కస్టమర్ పేరు నమోదు చేయండి',
      enterVehicle: 'వాహన నంబర్ నమోదు చేయండి',
      enterDriver: 'డ్రైవర్ పేరు నమోదు చేయండి',
      enterMaterialCode: 'కోడ్ నమోదు చేయండి',
      enterMaterialName: 'మెటీరియల్ పేరు నమోదు చేయండి',
      enterDocument: 'SO/DC/చలాన్ నంబర్',
      enterRemarks: 'గమనికలు జోడించండి',
      selectType: 'ఎగ్జిట్ రకాన్ని ఎంచుకోండి',
      noExits: 'ఇంకా గేట్ ఎగ్జిట్‌లు లేవు',
      createFirst: 'పైన మీ మొదటి గేట్ ఎగ్జిట్‌ను సృష్టించండి'
    },
    mr: {
      title: 'गेट एक्झिट (आउटवर्ड)',
      subtitle: 'सर्व बाहेर जाणारी साहित्य, प्रेषण आणि शिपमेंट व्यवस्थापित करा',
      newExit: 'नवीन एक्झिट',
      history: 'एक्झिट इतिहास',
      createExit: '+ गेट एक्झिट तयार करा',
      exitType: 'एक्झिट प्रकार',
      destination: 'गंतव्य',
      customer: 'ग्राहक / पार्टी',
      vehicleNo: 'वाहन क्रमांक',
      driverName: 'ड्रायव्हरचे नाव',
      materials: 'साहित्य / आयटम',
      materialCode: 'साहित्य कोड',
      materialName: 'साहित्य नाव',
      quantity: 'प्रमाण',
      uom: 'UOM',
      linkedDocument: 'लिंक केलेले दस्तऐवज',
      remarks: 'टिपा',
      status: 'स्थिती',
      timestamp: 'तारीख आणि वेळ',
      actions: 'कृती',
      search: 'एक्झिट शोधा...',
      addMaterial: '+ साहित्य जोडा',
      cancel: 'रद्द करा',
      createRecord: 'एक्झिट तयार करा',
      viewDetails: 'पहा',
      exitTypes: {
        dispatch: 'तयार माल प्रेषण',
        jobwork_out: 'जॉब-वर्क आउट',
        scrap: 'स्क्रॅप काढणे',
        courier: 'कुरियर पार्सल',
        return: 'साहित्य परतावा',
        transfer: 'इंटर-प्लांट ट्रान्सफर',
        sample: 'नमुना प्रेषण'
      },
      statuses: {
        ready: 'प्रेषणासाठी तयार',
        verified: 'पडताळले',
        dispatched: 'प्रेषित',
        in_transit: 'वाहतुकीत'
      },
      enterDestination: 'गंतव्य प्रविष्ट करा',
      enterCustomer: 'ग्राहकाचे नाव प्रविष्ट करा',
      enterVehicle: 'वाहन क्रमांक प्रविष्ट करा',
      enterDriver: 'ड्रायव्हरचे नाव प्रविष्ट करा',
      enterMaterialCode: 'कोड प्रविष्ट करा',
      enterMaterialName: 'साहित्य नाव प्रविष्ट करा',
      enterDocument: 'SO/DC/चलान क्रमांक',
      enterRemarks: 'टिपा जोडा',
      selectType: 'एक्झिट प्रकार निवडा',
      noExits: 'अद्याप गेट एक्झिट नाहीत',
      createFirst: 'वर आपला पहिला गेट एक्झिट तयार करा'
    },
    gu: {
      title: 'ગેટ એક્ઝિટ (આઉટવર્ડ)',
      subtitle: 'તમામ બહાર જતી સામગ્રી, ડિસ્પેચ અને શિપમેન્ટ મેનેજ કરો',
      newExit: 'નવી એક્ઝિટ',
      history: 'એક્ઝિટ ઇતિહાસ',
      createExit: '+ ગેટ એક્ઝિટ બનાવો',
      exitType: 'એક્ઝિટ પ્રકાર',
      destination: 'ગંતવ્ય',
      customer: 'ગ્રાહક / પાર્ટી',
      vehicleNo: 'વાહન નંબર',
      driverName: 'ડ્રાઇવરનું નામ',
      materials: 'સામગ્રી / આઇટમ્સ',
      materialCode: 'સામગ્રી કોડ',
      materialName: 'સામગ્રી નામ',
      quantity: 'જથ્થો',
      uom: 'UOM',
      linkedDocument: 'લિંક કરેલ દસ્તાવેજ',
      remarks: 'ટિપ્પણીઓ',
      status: 'સ્થિતિ',
      timestamp: 'તારીખ અને સમય',
      actions: 'ક્રિયાઓ',
      search: 'એક્ઝિટ શોધો...',
      addMaterial: '+ સામગ્રી ઉમેરો',
      cancel: 'રદ કરો',
      createRecord: 'એક્ઝિટ બનાવો',
      viewDetails: 'જુઓ',
      exitTypes: {
        dispatch: 'તૈયાર માલ ડિસ્પેચ',
        jobwork_out: 'જોબ-વર્ક આઉટ',
        scrap: 'સ્ક્રૅપ નિવારણ',
        courier: 'કુરિયર પાર્સલ',
        return: 'સામગ્રી વળતર',
        transfer: 'ઇન્ટર-પ્લાન્ટ ટ્રાન્સફર',
        sample: 'સેમ્પલ ડિસ્પેચ'
      },
      statuses: {
        ready: 'ડિસ્પેચ માટે તૈયાર',
        verified: 'ચકાસાયેલ',
        dispatched: 'મોકલેલ',
        in_transit: 'રસ્તામાં'
      },
      enterDestination: 'ગંતવ્ય દાખલ કરો',
      enterCustomer: 'ગ્રાહકનું નામ દાખલ કરો',
      enterVehicle: 'વાહન નંબર દાખલ કરો',
      enterDriver: 'ડ્રાઇવરનું નામ દાખલ કરો',
      enterMaterialCode: 'કોડ દાખલ કરો',
      enterMaterialName: 'સામગ્રી નામ દાખલ કરો',
      enterDocument: 'SO/DC/ચલાન નંબર',
      enterRemarks: 'ટિપ્પણીઓ ઉમેરો',
      selectType: 'એક્ઝિટ પ્રકાર પસંદ કરો',
      noExits: 'હજી સુધી કોઈ ગેટ એક્ઝિટ નથી',
      createFirst: 'ઉપર તમારી પ્રથમ ગેટ એક્ઝિટ બનાવો'
    },
    pa: {
      title: 'ਗੇਟ ਐਗਜ਼ਿਟ (ਆਉਟਵਰਡ)',
      subtitle: 'ਸਾਰੀਆਂ ਬਾਹਰ ਜਾਣ ਵਾਲੀਆਂ ਸਮੱਗਰੀਆਂ, ਡਿਸਪੈਚਾਂ ਅਤੇ ਸ਼ਿਪਮੈਂਟਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰੋ',
      newExit: 'ਨਵਾਂ ਐਗਜ਼ਿਟ',
      history: 'ਐਗਜ਼ਿਟ ਇਤਿਹਾਸ',
      createExit: '+ ਗੇਟ ਐਗਜ਼ਿਟ ਬਣਾਓ',
      exitType: 'ਐਗਜ਼ਿਟ ਕਿਸਮ',
      destination: 'ਮੰਜ਼ਿਲ',
      customer: 'ਗਾਹਕ / ਪਾਰਟੀ',
      vehicleNo: 'ਵਾਹਨ ਨੰਬਰ',
      driverName: 'ਡਰਾਈਵਰ ਦਾ ਨਾਮ',
      materials: 'ਸਮੱਗਰੀ / ਆਈਟਮਾਂ',
      materialCode: 'ਸਮੱਗਰੀ ਕੋਡ',
      materialName: 'ਸਮੱਗਰੀ ਨਾਮ',
      quantity: 'ਮਾਤਰਾ',
      uom: 'UOM',
      linkedDocument: 'ਲਿੰਕ ਕੀਤਾ ਦਸਤਾਵੇਜ਼',
      remarks: 'ਟਿੱਪਣੀਆਂ',
      status: 'ਸਥਿਤੀ',
      timestamp: 'ਤਾਰੀਖ਼ ਅਤੇ ਸਮਾਂ',
      actions: 'ਕਾਰਵਾਈਆਂ',
      search: 'ਐਗਜ਼ਿਟਾਂ ਖੋਜੋ...',
      addMaterial: '+ ਸਮੱਗਰੀ ਸ਼ਾਮਲ ਕਰੋ',
      cancel: 'ਰੱਦ ਕਰੋ',
      createRecord: 'ਐਗਜ਼ਿਟ ਬਣਾਓ',
      viewDetails: 'ਦੇਖੋ',
      exitTypes: {
        dispatch: 'ਤਿਆਰ ਸਮਾਨ ਡਿਸਪੈਚ',
        jobwork_out: 'ਜੌਬ-ਵਰਕ ਆਉਟ',
        scrap: 'ਸਕਿਰੈਪ ਹਟਾਉਣਾ',
        courier: 'ਕੋਰੀਅਰ ਪਾਰਸਲ',
        return: 'ਸਮੱਗਰੀ ਰਿਟਰਨ',
        transfer: 'ਇੰਟਰ-ਪਲਾਂਟ ਟ੍ਰਾਂਸਫਰ',
        sample: 'ਸਾਂਪਲ ਡਿਸਪੈਚ'
      },
      statuses: {
        ready: 'ਡਿਸਪੈਚ ਲਈ ਤਿਆਰ',
        verified: 'ਤਸਦੀਕ ਕੀਤਾ',
        dispatched: 'ਡਿਸਪੈਚ ਕੀਤਾ',
        in_transit: 'ਰਸਤੇ ਵਿੱਚ'
      },
      enterDestination: 'ਮੰਜ਼ਿਲ ਦਾਖਲ ਕਰੋ',
      enterCustomer: 'ਗਾਹਕ ਨਾਮ ਦਾਖਲ ਕਰੋ',
      enterVehicle: 'ਵਾਹਨ ਨੰਬਰ ਦਾਖਲ ਕਰੋ',
      enterDriver: 'ਡਰਾਈਵਰ ਨਾਮ ਦਾਖਲ ਕਰੋ',
      enterMaterialCode: 'ਕੋਡ ਦਾਖਲ ਕਰੋ',
      enterMaterialName: 'ਸਮੱਗਰੀ ਨਾਮ ਦਾਖਲ ਕਰੋ',
      enterDocument: 'SO/DC/ਚਲਾਨ ਨੰਬਰ',
      enterRemarks: 'ਟਿੱਪਣੀਆਂ ਸ਼ਾਮਲ ਕਰੋ',
      selectType: 'ਐਗਜ਼ਿਟ ਕਿਸਮ ਚੁਣੋ',
      noExits: 'ਅਜੇ ਤੱਕ ਕੋਈ ਗੇਟ ਐਗਜ਼ਿਟਾਂ ਨਹੀਂ',
      createFirst: 'ਉੱਪਰ ਆਪਣਾ ਪਹਿਲਾ ਗੇਟ ਐਗਜ਼ਿਟ ਬਣਾਓ'
    }
  };

  const t = translations[language];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'dispatched':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'verified':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_transit':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  const getExitTypeIcon = (type: ExitType) => {
    switch (type) {
      case 'dispatch':
        return TruckIcon;
      case 'courier':
      case 'sample':
        return FileText;
      case 'jobwork_out':
      case 'transfer':
        return Package;
      default:
        return Package;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2">
          <Send className="w-8 h-8 text-indigo-600" />
          {t.title}
        </h1>
        <p className="text-zinc-600 mt-1">{t.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-zinc-200">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'new'
              ? 'border-b-4 border-indigo-600 text-indigo-600 -mb-0.5'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {t.newExit}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-4 border-indigo-600 text-indigo-600 -mb-0.5'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {t.history}
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-6">
          {/* Quick Exit Section */}
          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-indigo-900 mb-1">{t.title}</h2>
                <p className="text-sm text-indigo-700">{t.subtitle}</p>
              </div>
              <Button
                onClick={() => setShowExitModal(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t.createExit}
              </Button>
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">{t.statuses.ready}</p>
                  <h3 className="mt-1">8</h3>
                </div>
                <Clock className="w-8 h-8 text-zinc-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">{t.statuses.verified}</p>
                  <h3 className="mt-1">12</h3>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">{t.statuses.in_transit}</p>
                  <h3 className="mt-1">6</h3>
                </div>
                <TruckIcon className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-600">Today</p>
                  <h3 className="mt-1">15</h3>
                </div>
                <Package className="w-8 h-8 text-indigo-500" />
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <Input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-2"
            />
          </div>

          {/* History Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-100 border-b-2 border-zinc-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-zinc-900">ID</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.exitType}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.destination}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.vehicleNo}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.materials}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.linkedDocument}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.status}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.timestamp}</th>
                    <th className="text-left p-4 font-medium text-zinc-900">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {exitHistory
                    .filter(exit =>
                      exit.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      exit.id.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((exit) => {
                      const Icon = getExitTypeIcon(exit.exitType);
                      return (
                        <tr key={exit.id} className="hover:bg-zinc-50">
                          <td className="p-4 font-medium text-indigo-600">{exit.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-zinc-500" />
                              <span className="text-sm">
                                {t.exitTypes[exit.exitType]}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">{exit.destination}</td>
                          <td className="p-4 font-mono text-sm">{exit.vehicleNo}</td>
                          <td className="p-4">
                            <div className="text-sm">
                              {exit.materials[0].materialName}
                              {exit.materials.length > 1 && (
                                <span className="text-zinc-500"> +{exit.materials.length - 1}</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {exit.materials[0].qty} {exit.materials[0].uom}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="border-zinc-300">
                              {exit.linkedDocument}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusColor(exit.status)}>
                              {t.statuses[exit.status]}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-zinc-600">{exit.timestamp}</td>
                          <td className="p-4">
                            <Button size="sm" variant="outline">
                              {t.viewDetails}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Create Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="w-6 h-6" />
                <div>
                  <h2 className="text-2xl">{t.createExit}</h2>
                  <p className="text-sm text-indigo-100">{t.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowExitModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* Exit Type */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.exitType} <span className="text-red-500">*</span>
                </label>
                <select
                  value={exitData.exitType}
                  onChange={(e) => setExitData({ ...exitData, exitType: e.target.value as ExitType })}
                  className="w-full p-3 border-2 border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(t.exitTypes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination and Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.destination} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={exitData.destination || ''}
                    onChange={(e) => setExitData({ ...exitData, destination: e.target.value })}
                    placeholder={t.enterDestination}
                    className="border-2"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.customer}
                  </label>
                  <Input
                    type="text"
                    value={exitData.customer || ''}
                    onChange={(e) => setExitData({ ...exitData, customer: e.target.value })}
                    placeholder={t.enterCustomer}
                    className="border-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.vehicleNo}
                  </label>
                  <Input
                    type="text"
                    value={exitData.vehicleNo || ''}
                    onChange={(e) => setExitData({ ...exitData, vehicleNo: e.target.value })}
                    placeholder={t.enterVehicle}
                    className="border-2"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-zinc-900 font-medium">
                    {t.driverName}
                  </label>
                  <Input
                    type="text"
                    value={exitData.driverName || ''}
                    onChange={(e) => setExitData({ ...exitData, driverName: e.target.value })}
                    placeholder={t.enterDriver}
                    className="border-2"
                  />
                </div>
              </div>

              {/* Linked Document */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.linkedDocument} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={exitData.linkedDocument || ''}
                  onChange={(e) => setExitData({ ...exitData, linkedDocument: e.target.value })}
                  placeholder={t.enterDocument}
                  className="border-2"
                />
              </div>

              {/* Materials */}
              <div>
                <label className="block mb-3 text-zinc-900 font-medium">
                  {t.materials} <span className="text-red-500">*</span>
                </label>
                
                <div className="space-y-3">
                  {exitData.materials?.map((material, index) => (
                    <div key={index} className="flex gap-3 p-4 bg-zinc-50 rounded-lg border-2 border-zinc-200">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={material.materialCode}
                          onChange={(e) => {
                            const newMaterials = [...(exitData.materials || [])];
                            newMaterials[index].materialCode = e.target.value;
                            setExitData({ ...exitData, materials: newMaterials });
                          }}
                          placeholder={t.enterMaterialCode}
                          className="p-2 border border-zinc-300 rounded"
                        />
                        <input
                          type="text"
                          value={material.materialName}
                          onChange={(e) => {
                            const newMaterials = [...(exitData.materials || [])];
                            newMaterials[index].materialName = e.target.value;
                            setExitData({ ...exitData, materials: newMaterials });
                          }}
                          placeholder={t.enterMaterialName}
                          className="p-2 border border-zinc-300 rounded"
                        />
                      </div>
                      
                      <div className="w-28">
                        <input
                          type="number"
                          value={material.qty}
                          onChange={(e) => {
                            const newMaterials = [...(exitData.materials || [])];
                            newMaterials[index].qty = Number(e.target.value);
                            setExitData({ ...exitData, materials: newMaterials });
                          }}
                          placeholder={t.quantity}
                          className="w-full p-2 border border-zinc-300 rounded"
                        />
                      </div>
                      
                      <div className="w-24">
                        <select
                          value={material.uom}
                          onChange={(e) => {
                            const newMaterials = [...(exitData.materials || [])];
                            newMaterials[index].uom = e.target.value;
                            setExitData({ ...exitData, materials: newMaterials });
                          }}
                          className="w-full p-2 border border-zinc-300 rounded"
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="m">m</option>
                          <option value="L">L</option>
                        </select>
                      </div>
                      
                      {(exitData.materials?.length || 0) > 1 && (
                        <button
                          onClick={() => {
                            const newMaterials = exitData.materials?.filter((_, i) => i !== index) || [];
                            setExitData({ ...exitData, materials: newMaterials });
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
                  onClick={() => setExitData({
                    ...exitData,
                    materials: [...(exitData.materials || []), { materialCode: '', materialName: '', qty: 0, uom: 'pcs' }]
                  })}
                  variant="outline"
                  className="w-full mt-3 border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  <Package className="w-4 h-4 mr-2" />
                  {t.addMaterial}
                </Button>
              </div>

              {/* Remarks */}
              <div>
                <label className="block mb-2 text-zinc-900 font-medium">
                  {t.remarks}
                </label>
                <textarea
                  value={exitData.remarks || ''}
                  onChange={(e) => setExitData({ ...exitData, remarks: e.target.value })}
                  placeholder={t.enterRemarks}
                  rows={3}
                  className="w-full p-3 border-2 border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t-2 border-zinc-200 p-6 flex gap-3">
              <Button
                onClick={() => {
                  setShowExitModal(false);
                  setExitData({
                    exitType: 'dispatch',
                    materials: [{ materialCode: '', materialName: '', qty: 0, uom: 'pcs' }],
                    status: 'ready'
                  });
                }}
                variant="outline"
                className="flex-1 border-2"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={() => {
                  const summary = exitData.materials
                    ?.filter(m => m.materialName && m.qty)
                    .map(m => `${m.qty} ${m.uom} ${m.materialName}`)
                    .join(', ');
                    
                  alert(`✅ ${language === 'en' ? 'Gate Exit Created!' : 'गेट एग्जिट बनाई गई!'}

Destination: ${exitData.destination}
Type: ${t.exitTypes[exitData.exitType || 'dispatch']}
Document: ${exitData.linkedDocument}
Materials: ${summary}
Status: ${t.statuses.ready}`);
                  
                  setShowExitModal(false);
                  setExitData({
                    exitType: 'dispatch',
                    materials: [{ materialCode: '', materialName: '', qty: 0, uom: 'pcs' }],
                    status: 'ready'
                  });
                }}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                disabled={!exitData.destination || !exitData.linkedDocument}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t.createRecord}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
