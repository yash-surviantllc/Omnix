import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/components/features';
import { useAppStore } from '@/stores/appStore';
import type { Language, View } from '@/types';

interface SidebarProps {
  language: Language;
  user: any; // TODO: Import proper type
  onLogout: () => void;
  setCurrentView: (view: View | string) => void;
}

const viewToPath: Record<View, string> = {
  'dashboard': '/',
  'orders': '/orders',
  'working-order': '/working-order',
  'bom': '/bom',
  'wip': '/wip',
  'transfer': '/transfer',
  'material-request': '/material-request',
  'qc': '/qc',
  'inventory': '/inventory',
  'gate-entry': '/gate-entry',
  'gate-exit': '/gate-exit',
  'settings': '/settings',
};

const languageOptions = [
  { code: 'en' as Language, name: 'English' },
  { code: 'hi' as Language, name: 'हिंदी' },
  { code: 'kn' as Language, name: 'ಕನ್ನಡ' },
  { code: 'ta' as Language, name: 'தமிழ்' },
  { code: 'te' as Language, name: 'తెలుగు' },
  { code: 'mr' as Language, name: 'मराठी' },
  { code: 'gu' as Language, name: 'ગુજરાતી' },
  { code: 'pa' as Language, name: 'ਪੰਜਾਬੀ' }
];

const translations = {
  en: {
    title: 'OMNIX',
    tagline: 'Precision at every step.',
    dashboard: 'Dashboard',
    orders: 'Production Orders',
    'working-order': 'Working Order',
    bom: 'BOM Planner',
    wip: 'WIP Board',
    transfer: 'Material Transfer',
    'material-request': 'Material Request',
    qc: 'QC Check',
    inventory: 'Inventory',
    'gate-entry': 'Gate Entry',
    'gate-exit': 'Gate Exit',
  },
  hi: {
    title: 'OMNIX',
    tagline: 'हर कदम पर सटीकता।',
    dashboard: 'डैशबोर्ड',
    orders: 'उत्पादन ऑर्डर',
    'working-order': 'कार्य आदेश',
    bom: 'BOM प्लानर',
    wip: 'WIP बोर्ड',
    transfer: 'सामग्री स्थानांतरण',
    'material-request': 'सामग्री अनुरोध',
    qc: 'QC जांच',
    inventory: 'इन्वेंटरी',
    'gate-entry': 'गेट प्रवेश',
    'gate-exit': 'गेट निकास',
  },
  kn: {
    title: 'OMNIX',
    tagline: 'ಪ್ರತಿ ಹಂತದಲ್ಲಿ ನಿಖರತೆ.',
    dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    orders: 'ಉತ್ಪಾದನೆ ಆದೇಶಗಳು',
    'working-order': 'ಕೆಲಸದ ಆದೇಶ',
    bom: 'BOM ಪ್ಲಾನರ್',
    wip: 'WIP ಬೋರ್ಡ್',
    transfer: 'ಸಾಮಗ್ರಿ ಸ್ಥಳಾಂತರ',
    'material-request': 'ಸಾಮಗ್ರಿ ವಿನಂತಿ',
    qc: 'QC ಪರಿಶೀಲನೆ',
    inventory: 'ಇನ್ವೆಂಟರಿ',
    'gate-entry': 'ಗೇಟ್ ಪ್ರವೇಶ',
    'gate-exit': 'ಗೇಟ್ ನಿರ್ಗಮನ',
  },
  ta: {
    title: 'OMNIX',
    tagline: 'ஒவ்வொரு அடியிலும் துல்லியம்.',
    dashboard: 'டாஷ்போர்ட்',
    orders: 'உற்பத்தி ஆர்டர்கள்',
    'working-order': 'வேலை ஆர்டர்',
    bom: 'BOM திட்டமிடுநர்',
    wip: 'WIP போர்ட்',
    transfer: 'பொருள் மாற்றம்',
    'material-request': 'பொருள் கோரிக்கை',
    qc: 'QC சோதனை',
    inventory: 'சரக்கு',
    'gate-entry': 'வாயில் நுழைவு',
    'gate-exit': 'வாயில் வெளியேறல்',
  },
  te: {
    title: 'OMNIX',
    tagline: 'ప్రతి అడుగులో ఖచ్చితత్వం.',
    dashboard: 'డ్యాష్‌బోర్డ్',
    orders: 'ఉత్పత్తి ఆదేశాలు',
    'working-order': 'పని ఆదేశం',
    bom: 'BOM ప్లానర్',
    wip: 'WIP బోర్డ్',
    transfer: 'మెటీరియల్ ట్రాన్స్‌ఫర్',
    'material-request': 'మెటీరియల్ అభ్యర్థన',
    qc: 'QC చెక్',
    inventory: 'ఇన్వెంటరీ',
    'gate-entry': 'గేట్ ఎంట్రీ',
    'gate-exit': 'గేట్ ఎగ్జిట్',
  },
  mr: {
    title: 'OMNIX',
    tagline: 'प्रत्येक पावलावर अचूकता.',
    dashboard: 'डॅशबोर्ड',
    orders: 'उत्पादन ऑर्डर',
    'working-order': 'कामाचा आदेश',
    bom: 'BOM प्लानर',
    wip: 'WIP बोर्ड',
    transfer: 'साहित्य स्थानांतरण',
    'material-request': 'साहित्य विनंती',
    qc: 'QC तपासणी',
    inventory: 'इन्व्हेंटरी',
    'gate-entry': 'गेट प्रवेश',
    'gate-exit': 'गेट निर्गमन',
  },
  gu: {
    title: 'OMNIX',
    tagline: 'દરેક પગલે ચોકસાઈ.',
    dashboard: 'ડેશબોર્ડ',
    orders: 'ઉત્પાદન ઓર્ડર્સ',
    'working-order': 'કાર્ય આદેશ',
    bom: 'BOM પ્લાનર',
    wip: 'WIP બોર્ડ',
    transfer: 'સામગ્રી ટ્રાન્સફર',
    'material-request': 'સામગ્રી વિનંતી',
    qc: 'QC ચેક',
    inventory: 'ઇન્વેન્ટરી',
    'gate-entry': 'ગેટ એન્ટ્રી',
    'gate-exit': 'ગેટ એક્ઝિટ',
  },
  pa: {
    title: 'OMNIX',
    tagline: 'ਹਰ ਪੌਣ ਵਿੱਚ ਸ਼ੁੱਧਤਾ.',
    dashboard: 'ਡੈਸ਼ਬੋਰਡ',
    orders: 'ਉਤਪਾਦਨ ਆਦੇਸ਼',
    'working-order': 'ਕੰਮ ਦਾ ਆਦੇਸ਼',
    bom: 'BOM ਯੋਜਨਾਕਾਰ',
    wip: 'WIP ਬੋਰਡ',
    transfer: 'ਸਮੱਗਰੀ ਟ੍ਰਾਂਸਫਰ',
    'material-request': 'ਸਮੱਗਰੀ ਅਨੁਰੋਧ',
    qc: 'QC ਜਾਂਚ',
    inventory: 'ਸੂਚੀ',
    'gate-entry': 'ਦਰਵਾਜੇ ਪ੍ਰਵੇਸ਼',
    'gate-exit': 'ਦਰਵਾਜੇ ਨਿਕਾਸ',
  },
};

export function Sidebar({ language, user, onLogout, setCurrentView }: SidebarProps) {
  const { showLanguageMenu, setShowLanguageMenu, setLanguage } = useAppStore();
  const t = translations[language];

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-zinc-900 text-white">
      <div className="flex flex-col h-20 justify-center border-b border-zinc-800 px-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center shrink-0">
            <span>O</span>
          </div>
          <div className="flex flex-col">
            <span className="tracking-wider">{t.title}</span>
            <span className="text-[10px] text-zinc-400 leading-none">{t.tagline}</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        <NavButton active={false} onClick={() => setCurrentView('dashboard')}>
          {t.dashboard}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('bom')}>
          {t.bom}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('orders')}>
          {t.orders}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('working-order')}>
          {t['working-order']}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('wip')}>
          {t.wip}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('transfer')}>
          {t.transfer}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('material-request')}>
          {t['material-request']}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('qc')}>
          {t.qc}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('inventory')}>
          {t.inventory}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('gate-entry')}>
          {t['gate-entry']}
        </NavButton>
        <NavButton active={false} onClick={() => setCurrentView('gate-exit')}>
          {t['gate-exit']}
        </NavButton>
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <div className="relative">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          >
            {languageOptions.find(l => l.code === language)?.name}
          </Button>
          {showLanguageMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {languageOptions.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-100 transition-colors ${
                    language === lang.code ? 'bg-emerald-50 text-emerald-900' : 'text-zinc-900'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Profile Section */}
      {user && (
        <div className="border-t border-zinc-800 p-3">
          <UserProfile
            user={user}
            language={language}
            onLogout={onLogout}
            onNavigateToSettings={() => setCurrentView('settings')}
            isCompact={true}
          />
        </div>
      )}
    </aside>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  );
}
