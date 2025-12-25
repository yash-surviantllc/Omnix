import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import type { Language } from '@/types';

const translations = {
  en: { title: 'OMNIX', tagline: 'Precision at every step.' },
  hi: { title: 'OMNIX', tagline: 'हर कदम पर सटीकता।' },
  kn: { title: 'OMNIX', tagline: 'ಪ್ರತಿ ಹಂತದಲ್ಲಿ ನಿಖರತೆ.' },
  ta: { title: 'OMNIX', tagline: 'ஒவ்வொரு அடியிலும் துல்லியம்.' },
  te: { title: 'OMNIX', tagline: 'ప్రతి అడుగులో ఖచ్చితత్వం.' },
  mr: { title: 'OMNIX', tagline: 'प्रत्येक पावलावर अचूकता.' },
  gu: { title: 'OMNIX', tagline: 'દરેક પગલે ચોકસાઈ.' },
  pa: { title: 'OMNIX', tagline: 'ਹਰ ਪੌਣ ਵਿੱਚ ਸ਼ੁੱਧਤਾ.' },
};

export function MobileHeader() {
  const { language, isMobileMenuOpen, setMobileMenuOpen } = useAppStore();
  const t = translations[language];

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-zinc-900 text-white flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center shrink-0">
          <span>O</span>
        </div>
        <div className="flex flex-col">
          <span className="tracking-wider">{t.title}</span>
          <span className="text-[9px] text-zinc-400 leading-none">{t.tagline}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
    </header>
  );
}
