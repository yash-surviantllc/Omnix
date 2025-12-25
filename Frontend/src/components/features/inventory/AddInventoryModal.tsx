import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Package, Box, Ruler, MapPin } from 'lucide-react';
import { MaterialData, InventoryData, Language } from '@/types/inventory';

type AddInventoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  onAddMaterial?: (material: MaterialData) => void;
  mode?: 'add' | 'edit';
  initialData?: MaterialData;
  onUpdateMaterial?: (material: MaterialData) => void;
  currentInventory?: InventoryData;
};

type FormData = {
  materialCode: string;
  materialName: string;
  available: string;
  unit: string;
  location: string;
  reorderLevel: string;
  status: string;
  unitCost: string;
};

type FormErrors = {
  [K in keyof FormData]?: string;
};

const UNITS = ['m', 'pcs', 'kg', 'L', 'rolls', 'boxes'];
const LOCATIONS = ['RM Store A', 'RM Store B', 'Store Room', 'Accessories', 'Packaging', 'Warehouse 1', 'Warehouse 2'];

export function AddInventoryModal({ open, onOpenChange, language, onAddMaterial, mode = 'add', initialData, onUpdateMaterial, currentInventory = {} }: AddInventoryModalProps) {
  const [formData, setFormData] = useState<FormData>({
    materialCode: '',
    materialName: '',
    available: '',
    unit: '',
    location: '',
    reorderLevel: '',
    status: 'sufficient',
    unitCost: '',
  });

  // Load initial data when in edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData && open) {
      setFormData({
        materialCode: initialData.materialCode || '',
        materialName: initialData.materialName || '',
        available: String(initialData.available || ''),
        unit: initialData.unit || '',
        location: initialData.location || '',
        reorderLevel: String(initialData.reorderLevel || ''),
        status: initialData.status || 'sufficient',
        unitCost: String(initialData.unitCost || ''),
      });
      setOriginalMaterialName(initialData.materialName || '');
    } else if (mode === 'add' && open) {
      // Reset form for add mode
      setFormData({
        materialCode: '',
        materialName: '',
        available: '',
        unit: '',
        location: '',
        reorderLevel: '',
        status: 'sufficient',
        unitCost: '',
      });
    }
  }, [mode, initialData, open]);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [originalMaterialName, setOriginalMaterialName] = useState<string>('');

  const translations = {
    en: {
      title: mode === 'edit' ? 'Update Material' : 'Add New Material',
      description: mode === 'edit' ? 'Update the material details' : 'Enter the details of the new inventory material',
      materialCode: 'Material Code',
      materialCodePlaceholder: 'e.g., FAB-COT-001',
      materialName: 'Material Name',
      materialNamePlaceholder: 'e.g., Cotton Fabric',
      available: 'Available Quantity',
      availablePlaceholder: 'Enter quantity',
      unit: 'Unit of Measurement',
      unitPlaceholder: 'Select unit',
      location: 'Storage Location',
      locationPlaceholder: 'Select location',
      reorderLevel: 'Reorder Level',
      reorderLevelPlaceholder: 'Minimum stock threshold',
      status: 'Status',
      statusPlaceholder: 'Select status',
      unitCost: 'Unit Cost',
      unitCostPlaceholder: 'Cost per unit',
      cancel: 'Cancel',
      submit: mode === 'edit' ? 'Update Material' : 'Add Material',
      submitting: mode === 'edit' ? 'Updating...' : 'Adding...',
      success: mode === 'edit' ? 'Material updated successfully!' : 'Material added successfully!',
      sufficient: 'Sufficient',
      low: 'Low Stock',
      critical: 'Critical',
    },
    hi: {
      title: 'नई सामग्री जोड़ें',
      description: 'नई इन्वेंटरी सामग्री का विवरण दर्ज करें',
      materialCode: 'सामग्री कोड',
      materialCodePlaceholder: 'उदा., FAB-COT-001',
      materialName: 'सामग्री का नाम',
      materialNamePlaceholder: 'उदा., कॉटन फैब्रिक',
      available: 'उपलब्ध मात्रा',
      availablePlaceholder: 'मात्रा दर्ज करें',
      unit: 'माप की इकाई',
      unitPlaceholder: 'इकाई चुनें',
      location: 'भंडारण स्थान',
      locationPlaceholder: 'स्थान चुनें',
      reorderLevel: 'पुन: ऑर्डर स्तर',
      reorderLevelPlaceholder: 'न्यूनतम स्टॉक सीमा',
      status: 'स्थिति',
      statusPlaceholder: 'स्थिति चुनें',
      unitCost: 'इकाई लागत',
      unitCostPlaceholder: 'प्रति इकाई लागत',
      cancel: 'रद्द करें',
      submit: 'सामग्री जोड़ें',
      submitting: 'जोड़ा जा रहा है...',
      success: 'सामग्री सफलतापूर्वक जोड़ी गई!',
      sufficient: 'पर्याप्त',
      low: 'कम स्टॉक',
      critical: 'गंभीर',
    },
    kn: {
      title: 'ಹೊಸ ಸಾಮಾನು ಸೇರಿಸಿ',
      description: 'ಹೊಸ ಇನ್ವೆಂಟರಿ ಸಾಮಾನಿನ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ',
      materialCode: 'ಸಾಮಾನ ಕೋಡ್',
      materialCodePlaceholder: 'ಉದಾ., FAB-COT-001',
      materialName: 'ಸಾಮಾನ ಹೆಸರು',
      materialNamePlaceholder: 'ಉದಾ., ಕಾಟನ್ ಫ್ಯಾಬ್ರಿಕ್',
      available: 'ಲಭ್ಯವಿರುವ ಪ್ರಮಾಣ',
      availablePlaceholder: 'ಪ್ರಮಾಣ ನಮೂದಿಸಿ',
      unit: 'ಅಳತೆಯ ಘಟಕ',
      unitPlaceholder: 'ಘಟಕ ಆಯ್ಕೆಮಾಡಿ',
      location: 'ಸಂಗ್ರಹಣೆ ಸ್ಥಳ',
      locationPlaceholder: 'ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ',
      reorderLevel: 'ಪುನರಾರ್ಡರ್ ಮಟ್ಟ',
      reorderLevelPlaceholder: 'ಕನಿಷ್ಠ ಸ್ಟಾಕ್ ಮಿತಿ',
      status: 'ಸ್ಥಿತಿ',
      statusPlaceholder: 'ಸ್ಥಿತಿ ಆಯ್ಕೆಮಾಡಿ',
      unitCost: 'ಘಟಕ ವೆಚ್ಚ',
      unitCostPlaceholder: 'ಪ್ರತಿ ಘಟಕದ ವೆಚ್ಚ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      submit: 'ಸಾಮಾನು ಸೇರಿಸಿ',
      submitting: 'ಸೇರಿಸಲಾಗುತ್ತಿದೆ...',
      success: 'ಸಾಮಾನು ಯಶಸ್ವಿಯಾಗಿ ಸೇರಿಸಲಾಗಿದೆ!',
      sufficient: 'ಸಾಕಷ್ಟು',
      low: 'ಕಡಿಮೆ ಸ್ಟಾಕ್',
      critical: 'ಗಂಭೀರ',
    },
    ta: {
      title: 'புதிய பொருள் சேர்',
      description: 'புதிய சரக்கு பொருளின் விவரங்களை உள்ளிடவும்',
      materialCode: 'பொருள் குறியீடு',
      materialCodePlaceholder: 'எ.கா., FAB-COT-001',
      materialName: 'பொருள் பெயர்',
      materialNamePlaceholder: 'எ.கா., காட்டன் துணி',
      available: 'கிடைக்கும் அளவு',
      availablePlaceholder: 'அளவை உள்ளிடவும்',
      unit: 'அளவீட்டு அலகு',
      unitPlaceholder: 'அலகு தேர்ந்தெடுக்கவும்',
      location: 'சேமிப்பு இடம்',
      locationPlaceholder: 'இடம் தேர்ந்தெடுக்கவும்',
      reorderLevel: 'மறு ஆர்டர் நிலை',
      reorderLevelPlaceholder: 'குறைந்தபட்ச இருப்பு வரம்பு',
      status: 'நிலை',
      statusPlaceholder: 'நிலையைத் தேர்ந்தெடுக்கவும்',
      unitCost: 'அலகு விலை',
      unitCostPlaceholder: 'ஒரு அலகுக்கான விலை',
      cancel: 'ரத்துசெய்',
      submit: 'பொருள் சேர்',
      submitting: 'சேர்க்கப்படுகிறது...',
      success: 'பொருள் வெற்றிகரமாக சேர்க்கப்பட்டது!',
      sufficient: 'போதுமானது',
      low: 'குறைந்த இருப்பு',
      critical: 'முக்கியமானது',
    },
    te: {
      title: 'కొత్త పదార్థం జోడించు',
      description: 'కొత్త ఇన్వెంటరీ పదార్థం వివరాలను నమోదు చేయండి',
      materialCode: 'పదార్థ కోడ్',
      materialCodePlaceholder: 'ఉదా., FAB-COT-001',
      materialName: 'పదార్థ పేరు',
      materialNamePlaceholder: 'ఉదా., కాటన్ ఫాబ్రిక్',
      available: 'అందుబాటులో ఉన్న పరిమాణం',
      availablePlaceholder: 'పరిమాణం నమోదు చేయండి',
      unit: 'కొలత యూనిట్',
      unitPlaceholder: 'యూనిట్ ఎంచుకోండి',
      location: 'నిల్వ స్థానం',
      locationPlaceholder: 'స్థానం ఎంచుకోండి',
      reorderLevel: 'పునఃఆర్డర్ స్థాయి',
      reorderLevelPlaceholder: 'కనిష్ట స్టాక్ పరిమితి',
      status: 'స్థితి',
      statusPlaceholder: 'స్థితిని ఎంచుకోండి',
      unitCost: 'యూనిట్ ఖర్చు',
      unitCostPlaceholder: 'ప్రతి యూనిట్ ఖర్చు',
      cancel: 'రద్దు చేయి',
      submit: 'పదార్థం జోడించు',
      submitting: 'జోడిస్తోంది...',
      success: 'పదార్థం విజయవంతంగా జోడించబడింది!',
      sufficient: 'సరిపోతుంది',
      low: 'తక్కువ స్టాక్',
      critical: 'క్రిటికల్',
    },
    mr: {
      title: 'नवीन साहित्य जोडा',
      description: 'नवीन इन्व्हेंटरी साहित्याचे तपशील प्रविष्ट करा',
      materialCode: 'साहित्य कोड',
      materialCodePlaceholder: 'उदा., FAB-COT-001',
      materialName: 'साहित्याचे नाव',
      materialNamePlaceholder: 'उदा., कापूस फॅब्रिक',
      available: 'उपलब्ध प्रमाण',
      availablePlaceholder: 'प्रमाण प्रविष्ट करा',
      unit: 'मापन एकक',
      unitPlaceholder: 'एकक निवडा',
      location: 'साठवण स्थान',
      locationPlaceholder: 'स्थान निवडा',
      reorderLevel: 'पुनर्ऑर्डर स्तर',
      reorderLevelPlaceholder: 'किमान स्टॉक मर्यादा',
      status: 'स्थिती',
      statusPlaceholder: 'स्थिती निवडा',
      unitCost: 'एकक खर्च',
      unitCostPlaceholder: 'प्रति एकक खर्च',
      cancel: 'रद्द करा',
      submit: 'साहित्य जोडा',
      submitting: 'जोडत आहे...',
      success: 'साहित्य यशस्वीरित्या जोडले!',
      sufficient: 'पुरेसे',
      low: 'कमी स्टॉक',
      critical: 'गंभीर',
    },
    gu: {
      title: 'નવી સામગ્રી ઉમેરો',
      description: 'નવી ઇન્વેન્ટરી સામગ્રીની વિગતો દાખલ કરો',
      materialCode: 'સામગ્રી કોડ',
      materialCodePlaceholder: 'દા.ત., FAB-COT-001',
      materialName: 'સામગ્રીનું નામ',
      materialNamePlaceholder: 'દા.ત., કોટન ફેબ્રિક',
      available: 'ઉપલબ્ધ જથ્થો',
      availablePlaceholder: 'જથ્થો દાખલ કરો',
      unit: 'માપન એકમ',
      unitPlaceholder: 'એકમ પસંદ કરો',
      location: 'સંગ્રહ સ્થાન',
      locationPlaceholder: 'સ્થાન પસંદ કરો',
      reorderLevel: 'પુનઃઓર્ડર સ્તર',
      reorderLevelPlaceholder: 'ન્યૂનતમ સ્ટોક મર્યાદા',
      status: 'સ્થિતિ',
      statusPlaceholder: 'સ્થિતિ પસંદ કરો',
      unitCost: 'એકમ ખર્ચ',
      unitCostPlaceholder: 'પ્રતિ એકમ ખર્ચ',
      cancel: 'રદ કરો',
      submit: 'સામગ્રી ઉમેરો',
      submitting: 'ઉમેરી રહ્યા છીએ...',
      success: 'સામગ્રી સફળતાપૂર્વક ઉમેરાઈ!',
      sufficient: 'પર્યાપ્ત',
      low: 'ઓછો સ્ટોક',
      critical: 'ક્રિટિકલ',
    },
    pa: {
      title: 'ਨਵੀਂ ਸਮੱਗਰੀ ਜੋੜੋ',
      description: 'ਨਵੀਂ ਇਨਵੈਂਟਰੀ ਸਮੱਗਰੀ ਦੇ ਵੇਰਵੇ ਦਰਜ ਕਰੋ',
      materialCode: 'ਸਮੱਗਰੀ ਕੋਡ',
      materialCodePlaceholder: 'ਜਿਵੇਂ, FAB-COT-001',
      materialName: 'ਸਮੱਗਰੀ ਦਾ ਨਾਮ',
      materialNamePlaceholder: 'ਜਿਵੇਂ, ਕਾਟਨ ਫੈਬਰਿਕ',
      available: 'ਉਪਲਬਧ ਮਾਤਰਾ',
      availablePlaceholder: 'ਮਾਤਰਾ ਦਰਜ ਕਰੋ',
      unit: 'ਮਾਪ ਦੀ ਇਕਾਈ',
      unitPlaceholder: 'ਇਕਾਈ ਚੁਣੋ',
      location: 'ਸਟੋਰੇਜ ਸਥਾਨ',
      locationPlaceholder: 'ਸਥਾਨ ਚੁਣੋ',
      reorderLevel: 'ਪੁਨਃਆਰਡਰ ਪੱਧਰ',
      reorderLevelPlaceholder: 'ਘੱਟੋ-ਘੱਟ ਸਟਾਕ ਸੀਮਾ',
      status: 'ਸਥਿਤੀ',
      statusPlaceholder: 'ਸਥਿਤੀ ਚੁਣੋ',
      unitCost: 'ਇਕਾਈ ਲਾਗਤ',
      unitCostPlaceholder: 'ਪ੍ਰਤੀ ਇਕਾਈ ਲਾਗਤ',
      cancel: 'ਰੱਦ ਕਰੋ',
      submit: 'ਸਮੱਗਰੀ ਜੋੜੋ',
      submitting: 'ਜੋੜਿਆ ਜਾ ਰਿਹਾ ਹੈ...',
      success: 'ਸਮੱਗਰੀ ਸਫਲਤਾਪੂਰਵਕ ਜੋੜੀ ਗਈ!',
      sufficient: 'ਕਾਫ਼ੀ',
      low: 'ਘੱਟ ਸਟਾਕ',
      critical: 'ਗੰਭੀਰ',
    },
  };

  const t = translations[language];

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.materialCode.trim()) {
      newErrors.materialCode = language === 'en' ? 'Material code is required' : 'सामग्री कोड आवश्यक है';
    }
    // Note: Material code uniqueness is validated by the backend API

    if (!formData.materialName.trim()) {
      newErrors.materialName = language === 'en' ? 'Material name is required' : 'सामग्री का नाम आवश्यक है';
    }
    // Note: Material name uniqueness is validated by the backend API

    if (!formData.available.trim()) {
      newErrors.available = language === 'en' ? 'Quantity is required' : 'मात्रा आवश्यक है';
    } else if (isNaN(Number(formData.available)) || Number(formData.available) <= 0) {
      newErrors.available = language === 'en' ? 'Quantity must be a positive number' : 'मात्रा एक सकारात्मक संख्या होनी चाहिए';
    }

    if (!formData.unit) {
      newErrors.unit = language === 'en' ? 'Unit is required' : 'इकाई आवश्यक है';
    }

    if (!formData.location) {
      newErrors.location = language === 'en' ? 'Location is required' : 'स्थान आवश्यक है';
    }

    if (!formData.reorderLevel.trim()) {
      newErrors.reorderLevel = language === 'en' ? 'Reorder level is required' : 'पुन: ऑर्डर स्तर आवश्यक है';
    } else if (isNaN(Number(formData.reorderLevel)) || Number(formData.reorderLevel) < 0) {
      newErrors.reorderLevel = language === 'en' ? 'Reorder level must be a positive number' : 'पुन: ऑर्डर स्तर एक सकारात्मक संख्या होनी चाहिए';
    } else if (formData.available.trim() && Number(formData.reorderLevel) > Number(formData.available)) {
      // Reorder level cannot exceed available quantity
      newErrors.reorderLevel = language === 'en' 
        ? 'Reorder level cannot exceed available quantity' 
        : 'पुन: ऑर्डर स्तर उपलब्ध मात्रा से अधिक नहीं हो सकता';
    }

    if (!formData.unitCost.trim()) {
      newErrors.unitCost = language === 'en' ? 'Unit cost is required' : 'इकाई लागत आवश्यक है';
    } else if (isNaN(Number(formData.unitCost)) || Number(formData.unitCost) < 0) {
      newErrors.unitCost = language === 'en' ? 'Unit cost must be a positive number' : 'इकाई लागत एक सकारात्मक संख्या होनी चाहिए';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const materialData = {
        id: mode === 'edit' && initialData ? initialData.id : undefined,
        materialCode: formData.materialCode,
        materialName: formData.materialName,
        available: Number(formData.available),
        unit: formData.unit,
        location: formData.location,
        reorderLevel: Number(formData.reorderLevel),
        status: formData.status,
        unitCost: Number(formData.unitCost),
      };

      console.log(mode === 'edit' ? 'Updated Material Data:' : 'New Material Data:', materialData);

      // Call the appropriate callback
      if (mode === 'edit' && onUpdateMaterial) {
        onUpdateMaterial(materialData);
      } else if (mode === 'add' && onAddMaterial) {
        onAddMaterial(materialData);
      }

      setSubmitSuccess(true);

      setTimeout(() => {
        setSubmitSuccess(false);
        onOpenChange(false);
        setFormData({
          materialCode: '',
          materialName: '',
          available: '',
          unit: '',
          location: '',
          reorderLevel: '',
          status: 'sufficient',
          unitCost: '',
        });
        setErrors({});
      }, 2000);
    } catch (error) {
      console.error('Error adding material:', error);
      setSubmitError(
        language === 'en' 
          ? 'Failed to save material. Please try again.' 
          : 'सामग्री सहेजने में विफल। कृपया पुनः प्रयास करें।'
      );
      setTimeout(() => setSubmitError(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  console.log('AddInventoryModal render - open:', open);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent 
        className="max-w-2xl h-auto overflow-hidden p-0" 
        style={{ display: 'grid', visibility: 'visible', opacity: 1, maxHeight: '90vh' }}
        onOpenAutoFocus={() => {
          console.log('Dialog opened and focused');
        }}
      >
        {/* Enhanced Header with Gradient */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white p-4 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div>{t.title}</div>
                <DialogDescription className="text-emerald-100 text-xs font-normal">{t.description}</DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto p-4 bg-gradient-to-b from-zinc-50 to-white" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {submitSuccess && (
            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-300 rounded-lg text-emerald-800 mb-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-sm">{t.success}</span>
            </div>
          )}

          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 rounded-lg text-red-800 mb-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="font-semibold text-sm">{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Material Information Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Box className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-blue-900">
                  {language === 'en' ? 'Material Information' : 'सामग्री जानकारी'}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="materialCode" className="text-xs font-semibold text-zinc-700">
                    {t.materialCode} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="materialCode"
                    placeholder={t.materialCodePlaceholder}
                    value={formData.materialCode}
                    onChange={(e) => handleInputChange('materialCode', e.target.value)}
                    disabled={mode === 'edit'}
                    className={errors.materialCode ? 'border-red-500 focus:ring-red-500 bg-red-50' : mode === 'edit' ? 'bg-zinc-100 cursor-not-allowed' : 'focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm'}
                  />
                  {errors.materialCode && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.materialCode}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="materialName" className="text-xs font-semibold text-zinc-700">
                    {t.materialName} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="materialName"
                    placeholder={t.materialNamePlaceholder}
                    value={formData.materialName}
                    onChange={(e) => handleInputChange('materialName', e.target.value)}
                    disabled={mode === 'edit'}
                    className={errors.materialName ? 'border-red-500 focus:ring-red-500 bg-red-50' : mode === 'edit' ? 'bg-zinc-100 cursor-not-allowed' : 'focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm'}
                  />
                  {errors.materialName && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.materialName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity & Unit Section */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-3 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">
                  {language === 'en' ? 'Quantity & Measurement' : 'मात्रा और माप'}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">

                <div className="space-y-1">
                  <Label htmlFor="available" className="text-xs font-semibold text-zinc-700">{t.available} *</Label>
                  <Input
                    id="available"
                    type="number"
                    placeholder={t.availablePlaceholder}
                    value={formData.available}
                    onChange={(e) => handleInputChange('available', e.target.value)}
                    className={errors.available ? 'border-red-500 focus:ring-red-500' : 'focus:ring-amber-500 focus:border-amber-500'}
                  />
                  {errors.available && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.available}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unit" className="text-xs font-semibold text-zinc-700">{t.unit} *</Label>
                  <Select value={formData.unit} onValueChange={(value) => handleInputChange('unit', value)}>
                    <SelectTrigger className={errors.unit ? 'border-red-500' : 'focus:ring-amber-500 focus:border-amber-500'}>
                      <SelectValue placeholder={t.unitPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.unit && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.unit}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Location & Stock Section */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-purple-900">
                  {language === 'en' ? 'Location & Stock Levels' : 'स्थान और स्टॉक स्तर'}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">

                <div className="space-y-1">
                  <Label htmlFor="reorderLevel" className="text-xs font-semibold text-zinc-700">{t.reorderLevel} *</Label>
                  <Input
                    id="reorderLevel"
                    type="number"
                    placeholder={t.reorderLevelPlaceholder}
                    value={formData.reorderLevel}
                    onChange={(e) => handleInputChange('reorderLevel', e.target.value)}
                    className={errors.reorderLevel ? 'border-red-500 focus:ring-red-500' : 'focus:ring-purple-500 focus:border-purple-500'}
                  />
                  {errors.reorderLevel && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.reorderLevel}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unitCost" className="text-xs font-semibold text-zinc-700">{t.unitCost} *</Label>
                  <Input
                    id="unitCost"
                    type="number"
                    step="0.01"
                    placeholder={t.unitCostPlaceholder}
                    value={formData.unitCost}
                    onChange={(e) => handleInputChange('unitCost', e.target.value)}
                    className={errors.unitCost ? 'border-red-500 focus:ring-red-500' : 'focus:ring-purple-500 focus:border-purple-500'}
                  />
                  {errors.unitCost && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.unitCost}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="location" className="text-xs font-semibold text-zinc-700">{t.location} *</Label>
                  <Select value={formData.location} onValueChange={(value) => handleInputChange('location', value)}>
                    <SelectTrigger className={errors.location ? 'border-red-500' : 'focus:ring-purple-500 focus:border-purple-500'}>
                      <SelectValue placeholder={t.locationPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.location && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.location}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="status" className="text-xs font-semibold text-zinc-700">{t.status} *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger className="focus:ring-purple-500 focus:border-purple-500">
                      <SelectValue placeholder={t.statusPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sufficient">{t.sufficient}</SelectItem>
                      <SelectItem value="low">{t.low}</SelectItem>
                      <SelectItem value="critical">{t.critical}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-medium hover:bg-zinc-100 transition-all min-w-[100px]"
              >
                {t.cancel}
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.submitting}
                  </span>
                ) : t.submit}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
