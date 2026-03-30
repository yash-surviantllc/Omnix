import { Button } from '@/components/ui/button';
import { UserProfile } from '@/components/features';
import { useAppStore } from '@/stores/appStore';
import type { Language, View } from '@/types';

interface MobileMenuProps {
  language: Language;
  user: any; // TODO: Import proper type
  onLogout: () => void;
  setCurrentView: (view: View | string) => void;
}

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
    dashboard: 'Dashboard',
    orders: 'Purchase Orders',
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

export function MobileMenu({ language, user, onLogout, setCurrentView }: MobileMenuProps) {
  const { showLanguageMenu, setShowLanguageMenu, setLanguage, setMobileMenuOpen } = useAppStore();
  const t = translations[language] || translations.en;

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
    setMobileMenuOpen(false);
  };

  const canAccessModule = (moduleKey: string) => {
    if (!user || !user.roles) return false;
    // Dashboard is always accessible
    if (moduleKey === 'dashboard') return true;

    const roles = user.roles.map((r: string) => r.toLowerCase());
    
    // Admin always has access
    if (roles.includes('admin')) return true;
    
    // Non-worker roles (manager, supervisor, etc.) have full access
    if (!roles.includes('worker')) return true;
    
    // Workers only have access if explicitly granted
    return user.workerModules?.includes(moduleKey);
  };

  const navItems = [
    { key: 'dashboard', label: t.dashboard },
    { key: 'bom', label: t.bom },
    { key: 'orders', label: t.orders },
    { key: 'working-order', label: t['working-order'] },
    { key: 'wip', label: t.wip },
    { key: 'transfer', label: t.transfer },
    { key: 'material-request', label: t['material-request'] },
    { key: 'qc', label: t.qc },
    { key: 'inventory', label: t.inventory },
    { key: 'gate-entry', label: t['gate-entry'] },
    { key: 'gate-exit', label: t['gate-exit'] },
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-30 bg-zinc-900 text-white pt-16 overflow-y-auto">
      <nav className="flex flex-col p-4 space-y-2">
        {navItems.filter(item => canAccessModule(item.key)).map(item => (
          <MobileNavButton 
            key={item.key}
            active={false} 
            onClick={() => { setCurrentView(item.key); setMobileMenuOpen(false); }}
          >
            {item.label}
          </MobileNavButton>
        ))}
        <div className="pt-4">
          <div className="relative">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            >
              {languageOptions.find(l => l.code === language)?.name}
            </Button>
            {showLanguageMenu && (
              <div className="bg-white border border-zinc-200 rounded-lg shadow-lg max-h-64 overflow-y-auto mt-2">
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

        {/* Mobile User Profile */}
        {user && (
          <div className="pt-4 border-t border-zinc-700 mt-4">
            <UserProfile
              user={user}
              language={language}
              onLogout={() => { onLogout(); setMobileMenuOpen(false); }}
              isCompact={true}
            />
          </div>
        )}
      </nav>
    </div>
  );
}

function MobileNavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 rounded-lg transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  );
}
