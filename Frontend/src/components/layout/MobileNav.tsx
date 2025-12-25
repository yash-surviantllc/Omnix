import { Home, Package, Truck, FileText, ClipboardCheck, Warehouse } from 'lucide-react';

type MobileNavProps = {
  currentView: string;
  onNavigate: (view: string) => void;
  language: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr' | 'gu' | 'pa';
};

export function MobileNav({ currentView, onNavigate, language }: MobileNavProps) {
  const translations = {
    en: {
      home: 'Home',
      orders: 'Orders',
      request: 'Request',
      qc: 'QC',
      inventory: 'Stock'
    },
    hi: {
      home: 'होम',
      orders: 'ऑर्डर',
      request: 'अनुरोध',
      qc: 'QC',
      inventory: 'स्टॉक'
    },
    kn: {
      home: 'ಮನ್ನೆ',
      orders: 'ಆರ್ಡರ್ಸ್',
      request: 'ಅನುರೋಧ',
      qc: 'QC',
      inventory: 'ಸ್ಟಾಕ್'
    },
    ta: {
      home: 'முகப்பு',
      orders: 'ஆர்டர்கள்',
      request: 'கோரிக்கை',
      qc: 'QC',
      inventory: 'இலங்கை'
    },
    te: {
      home: 'హోమ్',
      orders: 'ఆర్డర్స్',
      request: 'అభ్యర్ధన',
      qc: 'QC',
      inventory: 'స్టాక్'
    },
    mr: {
      home: 'होम',
      orders: 'ऑर्डर्स',
      request: 'विनंती',
      qc: 'QC',
      inventory: 'स्टॉक'
    },
    gu: {
      home: 'હોમ',
      orders: 'ઑર્ડર્સ',
      request: 'વિનંતી',
      qc: 'QC',
      inventory: 'સ્ટોક'
    },
    pa: {
      home: 'ਹੋਮ',
      orders: 'ਆਰਡਰਜ਼',
      request: 'ਬੇਨਤੀ',
      qc: 'QC',
      inventory: 'ਸਟੋਕ'
    }
  };

  const t = translations[language];

  const navItems = [
    { id: 'dashboard', label: t.home, icon: Home },
    { id: 'orders', label: t.orders, icon: Package },
    { id: 'material-request', label: t.request, icon: FileText },
    { id: 'qc', label: t.qc, icon: ClipboardCheck },
    { id: 'inventory', label: t.inventory, icon: Warehouse }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              currentView === item.id
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}