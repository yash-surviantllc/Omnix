import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Globe, 
  Moon, 
  Sun, 
  MapPin, 
  Calendar,
  Save,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';

interface SettingsProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onClose?: () => void;
}

export function Settings({ language, onLanguageChange, onClose }: SettingsProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    orderUpdates: true,
    inventoryAlerts: true,
    productionAlerts: true,
  });
  const [defaultLocation, setDefaultLocation] = useState('main-warehouse');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');

  const translations = {
    en: {
      title: 'Settings',
      subtitle: 'Manage your preferences and account settings',
      general: 'General Settings',
      language: 'Language',
      languageDesc: 'Select your preferred language',
      theme: 'Theme',
      themeDesc: 'Choose your display theme',
      light: 'Light',
      dark: 'Dark',
      notifications: 'Notifications',
      notificationsDesc: 'Manage notification preferences',
      emailNotifications: 'Email Notifications',
      pushNotifications: 'Push Notifications',
      orderUpdates: 'Order Updates',
      inventoryAlerts: 'Inventory Alerts',
      productionAlerts: 'Production Alerts',
      preferences: 'Preferences',
      defaultLocation: 'Default Location',
      locationDesc: 'Set your default warehouse location',
      dateFormat: 'Date Format',
      dateFormatDesc: 'Choose how dates are displayed',
      timeZone: 'Time Zone',
      timeZoneDesc: 'Set your time zone',
      saveChanges: 'Save Changes',
      cancel: 'Cancel',
      changesSaved: 'Changes saved successfully',
    },
    hi: {
      title: 'सेटिंग्स',
      subtitle: 'अपनी प्राथमिकताएं और खाता सेटिंग्स प्रबंधित करें',
      general: 'सामान्य सेटिंग्स',
      language: 'भाषा',
      languageDesc: 'अपनी पसंदीदा भाषा चुनें',
      theme: 'थीम',
      themeDesc: 'अपनी डिस्प्ले थीम चुनें',
      light: 'लाइट',
      dark: 'डार्क',
      notifications: 'सूचनाएं',
      notificationsDesc: 'सूचना प्राथमिकताएं प्रबंधित करें',
      emailNotifications: 'ईमेल सूचनाएं',
      pushNotifications: 'पुश सूचनाएं',
      orderUpdates: 'ऑर्डर अपडेट',
      inventoryAlerts: 'इन्वेंटरी अलर्ट',
      productionAlerts: 'उत्पादन अलर्ट',
      preferences: 'प्राथमिकताएं',
      defaultLocation: 'डिफ़ॉल्ट स्थान',
      locationDesc: 'अपना डिफ़ॉल्ट वेयरहाउस स्थान सेट करें',
      dateFormat: 'तारीख प्रारूप',
      dateFormatDesc: 'तारीखें कैसे प्रदर्शित की जाती हैं चुनें',
      timeZone: 'समय क्षेत्र',
      timeZoneDesc: 'अपना समय क्षेत्र सेट करें',
      saveChanges: 'परिवर्तन सहेजें',
      cancel: 'रद्द करें',
      changesSaved: 'परिवर्तन सफलतापूर्वक सहेजे गए',
    },
    kn: {
      title: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
      subtitle: 'ನಿಮ್ಮ ಆದ್ಯತೆಗಳು ಮತ್ತು ಖಾತೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
      general: 'ಸಾಮಾನ್ಯ ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
      language: 'ಭಾಷೆ',
      languageDesc: 'ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
      theme: 'ಥೀಮ್',
      themeDesc: 'ನಿಮ್ಮ ಪ್ರದರ್ಶನ ಥೀಮ್ ಆಯ್ಕೆಮಾಡಿ',
      light: 'ಲೈಟ್',
      dark: 'ಡಾರ್ಕ್',
      notifications: 'ಅಧಿಸೂಚನೆಗಳು',
      notificationsDesc: 'ಅಧಿಸೂಚನೆ ಆದ್ಯತೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
      emailNotifications: 'ಇಮೇಲ್ ಅಧಿಸೂಚನೆಗಳು',
      pushNotifications: 'ಪುಶ್ ಅಧಿಸೂಚನೆಗಳು',
      orderUpdates: 'ಆರ್ಡರ್ ಅಪ್‌ಡೇಟ್‌ಗಳು',
      inventoryAlerts: 'ಇನ್ವೆಂಟರಿ ಎಚ್ಚರಿಕೆಗಳು',
      productionAlerts: 'ಉತ್ಪಾದನೆ ಎಚ್ಚರಿಕೆಗಳು',
      preferences: 'ಆದ್ಯತೆಗಳು',
      defaultLocation: 'ಡೀಫಾಲ್ಟ್ ಸ್ಥಳ',
      locationDesc: 'ನಿಮ್ಮ ಡೀಫಾಲ್ಟ್ ಗೋದಾಮು ಸ್ಥಳವನ್ನು ಹೊಂದಿಸಿ',
      dateFormat: 'ದಿನಾಂಕ ಸ್ವರೂಪ',
      dateFormatDesc: 'ದಿನಾಂಕಗಳನ್ನು ಹೇಗೆ ಪ್ರದರ್ಶಿಸಲಾಗುತ್ತದೆ ಆಯ್ಕೆಮಾಡಿ',
      timeZone: 'ಸಮಯ ವಲಯ',
      timeZoneDesc: 'ನಿಮ್ಮ ಸಮಯ ವಲಯವನ್ನು ಹೊಂದಿಸಿ',
      saveChanges: 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      changesSaved: 'ಬದಲಾವಣೆಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಉಳಿಸಲಾಗಿದೆ',
    },
    ta: {
      title: 'அமைப்புகள்',
      subtitle: 'உங்கள் விருப்பத்தேர்வுகள் மற்றும் கணக்கு அமைப்புகளை நிர்வகிக்கவும்',
      general: 'பொது அமைப்புகள்',
      language: 'மொழி',
      languageDesc: 'உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்',
      theme: 'தீம்',
      themeDesc: 'உங்கள் காட்சி தீமைத் தேர்வுசெய்யவும்',
      light: 'லைட்',
      dark: 'டார்க்',
      notifications: 'அறிவிப்புகள்',
      notificationsDesc: 'அறிவிப்பு விருப்பத்தேர்வுகளை நிர்வகிக்கவும்',
      emailNotifications: 'மின்னஞ்சல் அறிவிப்புகள்',
      pushNotifications: 'புஷ் அறிவிப்புகள்',
      orderUpdates: 'ஆர்டர் புதுப்பிப்புகள்',
      inventoryAlerts: 'சரக்கு எச்சரிக்கைகள்',
      productionAlerts: 'உற்பத்தி எச்சரிக்கைகள்',
      preferences: 'விருப்பத்தேர்வுகள்',
      defaultLocation: 'இயல்புநிலை இடம்',
      locationDesc: 'உங்கள் இயல்புநிலை கிடங்கு இடத்தை அமைக்கவும்',
      dateFormat: 'தேதி வடிவம்',
      dateFormatDesc: 'தேதிகள் எவ்வாறு காட்டப்படுகின்றன என்பதைத் தேர்வுசெய்யவும்',
      timeZone: 'நேர மண்டலம்',
      timeZoneDesc: 'உங்கள் நேர மண்டலத்தை அமைக்கவும்',
      saveChanges: 'மாற்றங்களைச் சேமிக்கவும்',
      cancel: 'ரத்துசெய்',
      changesSaved: 'மாற்றங்கள் வெற்றிகரமாகச் சேமிக்கப்பட்டன',
    },
    te: {
      title: 'సెట్టింగ్‌లు',
      subtitle: 'మీ ప్రాధాన్యతలు మరియు ఖాతా సెట్టింగ్‌లను నిర్వహించండి',
      general: 'సాధారణ సెట్టింగ్‌లు',
      language: 'భాష',
      languageDesc: 'మీ ఇష్టమైన భాషను ఎంచుకోండి',
      theme: 'థీమ్',
      themeDesc: 'మీ డిస్‌ప్లే థీమ్‌ను ఎంచుకోండి',
      light: 'లైట్',
      dark: 'డార్క్',
      notifications: 'నోటిఫికేషన్‌లు',
      notificationsDesc: 'నోటిఫికేషన్ ప్రాధాన్యతలను నిర్వహించండి',
      emailNotifications: 'ఇమెయిల్ నోటిఫికేషన్‌లు',
      pushNotifications: 'పుష్ నోటిఫికేషన్‌లు',
      orderUpdates: 'ఆర్డర్ అప్‌డేట్‌లు',
      inventoryAlerts: 'ఇన్వెంటరీ హెచ్చరికలు',
      productionAlerts: 'ఉత్పత్తి హెచ్చరికలు',
      preferences: 'ప్రాధాన్యతలు',
      defaultLocation: 'డిఫాల్ట్ స్థానం',
      locationDesc: 'మీ డిఫాల్ట్ గిడ్డంగి స్థానాన్ని సెట్ చేయండి',
      dateFormat: 'తేదీ ఫార్మాట్',
      dateFormatDesc: 'తేదీలు ఎలా ప్రదర్శించబడతాయో ఎంచుకోండి',
      timeZone: 'టైమ్ జోన్',
      timeZoneDesc: 'మీ టైమ్ జోన్‌ను సెట్ చేయండి',
      saveChanges: 'మార్పులను సేవ్ చేయండి',
      cancel: 'రద్దు చేయండి',
      changesSaved: 'మార్పులు విజయవంతంగా సేవ్ చేయబడ్డాయి',
    },
    mr: {
      title: 'सेटिंग्ज',
      subtitle: 'तुमच्या प्राधान्यक्रम आणि खाते सेटिंग्ज व्यवस्थापित करा',
      general: 'सामान्य सेटिंग्ज',
      language: 'भाषा',
      languageDesc: 'तुमची पसंतीची भाषा निवडा',
      theme: 'थीम',
      themeDesc: 'तुमची डिस्प्ले थीम निवडा',
      light: 'लाइट',
      dark: 'डार्क',
      notifications: 'सूचना',
      notificationsDesc: 'सूचना प्राधान्यक्रम व्यवस्थापित करा',
      emailNotifications: 'ईमेल सूचना',
      pushNotifications: 'पुश सूचना',
      orderUpdates: 'ऑर्डर अपडेट',
      inventoryAlerts: 'इन्व्हेंटरी अलर्ट',
      productionAlerts: 'उत्पादन अलर्ट',
      preferences: 'प्राधान्यक्रम',
      defaultLocation: 'डीफॉल्ट स्थान',
      locationDesc: 'तुमचे डीफॉल्ट वेअरहाउस स्थान सेट करा',
      dateFormat: 'तारीख स्वरूप',
      dateFormatDesc: 'तारखा कशा प्रदर्शित केल्या जातात ते निवडा',
      timeZone: 'वेळ क्षेत्र',
      timeZoneDesc: 'तुमचे वेळ क्षेत्र सेट करा',
      saveChanges: 'बदल जतन करा',
      cancel: 'रद्द करा',
      changesSaved: 'बदल यशस्वीरित्या जतन केले',
    },
    gu: {
      title: 'સેટિંગ્સ',
      subtitle: 'તમારી પસંદગીઓ અને એકાઉન્ટ સેટિંગ્સ મેનેજ કરો',
      general: 'સામાન્ય સેટિંગ્સ',
      language: 'ભાષા',
      languageDesc: 'તમારી પસંદગીની ભાષા પસંદ કરો',
      theme: 'થીમ',
      themeDesc: 'તમારી ડિસ્પ્લે થીમ પસંદ કરો',
      light: 'લાઇટ',
      dark: 'ડાર્ક',
      notifications: 'સૂચનાઓ',
      notificationsDesc: 'સૂચના પસંદગીઓ મેનેજ કરો',
      emailNotifications: 'ઇમેઇલ સૂચનાઓ',
      pushNotifications: 'પુશ સૂચનાઓ',
      orderUpdates: 'ઓર્ડર અપડેટ્સ',
      inventoryAlerts: 'ઇન્વેન્ટરી ચેતવણીઓ',
      productionAlerts: 'ઉત્પાદન ચેતવણીઓ',
      preferences: 'પસંદગીઓ',
      defaultLocation: 'ડિફોલ્ટ સ્થાન',
      locationDesc: 'તમારું ડિફોલ્ટ વેરહાઉસ સ્થાન સેટ કરો',
      dateFormat: 'તારીખ ફોર્મેટ',
      dateFormatDesc: 'તારીખો કેવી રીતે પ્રદર્શિત થાય છે તે પસંદ કરો',
      timeZone: 'સમય ઝોન',
      timeZoneDesc: 'તમારો સમય ઝોન સેટ કરો',
      saveChanges: 'ફેરફારો સાચવો',
      cancel: 'રદ કરો',
      changesSaved: 'ફેરફારો સફળતાપૂર્વક સાચવ્યા',
    },
    pa: {
      title: 'ਸੈਟਿੰਗਾਂ',
      subtitle: 'ਆਪਣੀਆਂ ਤਰਜੀਹਾਂ ਅਤੇ ਖਾਤਾ ਸੈਟਿੰਗਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰੋ',
      general: 'ਆਮ ਸੈਟਿੰਗਾਂ',
      language: 'ਭਾਸ਼ਾ',
      languageDesc: 'ਆਪਣੀ ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ ਚੁਣੋ',
      theme: 'ਥੀਮ',
      themeDesc: 'ਆਪਣੀ ਡਿਸਪਲੇ ਥੀਮ ਚੁਣੋ',
      light: 'ਲਾਈਟ',
      dark: 'ਡਾਰਕ',
      notifications: 'ਸੂਚਨਾਵਾਂ',
      notificationsDesc: 'ਸੂਚਨਾ ਤਰਜੀਹਾਂ ਦਾ ਪ੍ਰਬੰਧਨ ਕਰੋ',
      emailNotifications: 'ਈਮੇਲ ਸੂਚਨਾਵਾਂ',
      pushNotifications: 'ਪੁਸ਼ ਸੂਚਨਾਵਾਂ',
      orderUpdates: 'ਆਰਡਰ ਅੱਪਡੇਟਸ',
      inventoryAlerts: 'ਇਨਵੈਂਟਰੀ ਚੇਤਾਵਨੀਆਂ',
      productionAlerts: 'ਉਤਪਾਦਨ ਚੇਤਾਵਨੀਆਂ',
      preferences: 'ਤਰਜੀਹਾਂ',
      defaultLocation: 'ਡਿਫੌਲਟ ਸਥਾਨ',
      locationDesc: 'ਆਪਣਾ ਡਿਫੌਲਟ ਵੇਅਰਹਾਊਸ ਸਥਾਨ ਸੈੱਟ ਕਰੋ',
      dateFormat: 'ਤਾਰੀਖ ਫਾਰਮੈਟ',
      dateFormatDesc: 'ਤਾਰੀਖਾਂ ਕਿਵੇਂ ਪ੍ਰਦਰਸ਼ਿਤ ਹੁੰਦੀਆਂ ਹਨ ਚੁਣੋ',
      timeZone: 'ਸਮਾਂ ਖੇਤਰ',
      timeZoneDesc: 'ਆਪਣਾ ਸਮਾਂ ਖੇਤਰ ਸੈੱਟ ਕਰੋ',
      saveChanges: 'ਤਬਦੀਲੀਆਂ ਸੁਰੱਖਿਅਤ ਕਰੋ',
      cancel: 'ਰੱਦ ਕਰੋ',
      changesSaved: 'ਤਬਦੀਲੀਆਂ ਸਫਲਤਾਪੂਰਵਕ ਸੁਰੱਖਿਅਤ ਕੀਤੀਆਂ ਗਈਆਂ',
    },
  };

  const t = translations[language];

  const languages = [
    { code: 'en' as Language, name: 'English', nativeName: 'English' },
    { code: 'hi' as Language, name: 'Hindi', nativeName: 'हिंदी' },
    { code: 'kn' as Language, name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'ta' as Language, name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te' as Language, name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'mr' as Language, name: 'Marathi', nativeName: 'मराठी' },
    { code: 'gu' as Language, name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'pa' as Language, name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  ];

  const handleSave = () => {
    onLanguageChange(selectedLanguage);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <SettingsIcon className="h-7 w-7 text-emerald-600" />
            {t.title}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
        </div>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            {t.cancel}
          </Button>
        )}
      </div>

      {/* General Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-600" />
          {t.general}
        </h2>

        <div className="space-y-6">
          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.language}
            </label>
            <p className="text-xs text-zinc-500 mb-3">{t.languageDesc}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedLanguage === lang.code
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-900">{lang.nativeName}</div>
                  <div className="text-xs text-zinc-500">{lang.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.theme}
            </label>
            <p className="text-xs text-zinc-500 mb-3">{t.themeDesc}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  theme === 'light'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <Sun className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-zinc-900">{t.light}</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  theme === 'dark'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <Moon className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-medium text-zinc-900">{t.dark}</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-emerald-600" />
          {t.notifications}
        </h2>
        <p className="text-xs text-zinc-500 mb-4">{t.notificationsDesc}</p>

        <div className="space-y-4">
          {[
            { key: 'email', label: t.emailNotifications },
            { key: 'push', label: t.pushNotifications },
            { key: 'orderUpdates', label: t.orderUpdates },
            { key: 'inventoryAlerts', label: t.inventoryAlerts },
            { key: 'productionAlerts', label: t.productionAlerts },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm text-zinc-700">{item.label}</span>
              <button
                onClick={() =>
                  setNotifications((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key as keyof typeof notifications],
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications[item.key as keyof typeof notifications]
                    ? 'bg-emerald-500'
                    : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications[item.key as keyof typeof notifications]
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-emerald-600" />
          {t.preferences}
        </h2>

        <div className="space-y-6">
          {/* Default Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              <MapPin className="h-4 w-4 inline mr-1" />
              {t.defaultLocation}
            </label>
            <p className="text-xs text-zinc-500 mb-3">{t.locationDesc}</p>
            <select
              value={defaultLocation}
              onChange={(e) => setDefaultLocation(e.target.value)}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="main-warehouse">Main Warehouse</option>
              <option value="warehouse-a">Warehouse A</option>
              <option value="warehouse-b">Warehouse B</option>
              <option value="production-floor">Production Floor</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              {t.dateFormat}
            </label>
            <p className="text-xs text-zinc-500 mb-3">{t.dateFormatDesc}</p>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          {/* Time Zone */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.timeZone}
            </label>
            <p className="text-xs text-zinc-500 mb-3">{t.timeZoneDesc}</p>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
        )}
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="h-4 w-4 mr-2" />
          {t.saveChanges}
        </Button>
      </div>
    </div>
  );
}
