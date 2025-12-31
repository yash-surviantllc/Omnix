import { useState } from 'react';
import { User, Mail, Phone, Briefcase, LogOut, Settings, ChevronDown, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Language } from '@/types';

interface UserData {
  name: string;
  email: string;
  mobile: string;
  role: string;
  department: string;
  employeeId: string;
  avatar?: string;
}

interface UserProfileProps {
  user: UserData;
  language: Language;
  onLogout: () => void;
  onNavigateToSettings?: () => void;
  isCompact?: boolean;
}

export function UserProfile({ user, language, onLogout, onNavigateToSettings, isCompact = false }: UserProfileProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const translations = {
    en: {
      profile: 'Profile',
      viewProfile: 'View Profile',
      settings: 'Settings',
      logout: 'Logout',
      email: 'Email',
      mobile: 'Mobile',
      role: 'Role',
      department: 'Department',
      employeeId: 'Employee ID',
      editProfile: 'Edit Profile',
      close: 'Close',
    },
    hi: {
      profile: 'प्रोफ़ाइल',
      viewProfile: 'प्रोफ़ाइल देखें',
      settings: 'सेटिंग्स',
      logout: 'लॉगआउट',
      email: 'ईमेल',
      mobile: 'मोबाइल',
      role: 'भूमिका',
      department: 'विभाग',
      employeeId: 'कर्मचारी आईडी',
      editProfile: 'प्रोफ़ाइल संपादित करें',
      close: 'बंद करें',
    },
    kn: {
      profile: 'ಪ್ರೊಫೈಲ್',
      viewProfile: 'ಪ್ರೊಫೈಲ್ ನೋಡಿ',
      settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
      logout: 'ಲಾಗ್‌ಔಟ್',
      email: 'ಇಮೇಲ್',
      mobile: 'ಮೊಬೈಲ್',
      role: 'ಪಾತ್ರ',
      department: 'ವಿಭಾಗ',
      employeeId: 'ಉದ್ಯೋಗಿ ಐಡಿ',
      editProfile: 'ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ',
      close: 'ಮುಚ್ಚಿ',
    },
    ta: {
      profile: 'சுயவிவரம்',
      viewProfile: 'சுயவிவரத்தைக் காண்க',
      settings: 'அமைப்புகள்',
      logout: 'வெளியேறு',
      email: 'மின்னஞ்சல்',
      mobile: 'மொபைல்',
      role: 'பங்கு',
      department: 'துறை',
      employeeId: 'பணியாளர் ஐடி',
      editProfile: 'சுயவிவரத்தைத் திருத்து',
      close: 'மூடு',
    },
    te: {
      profile: 'ప్రొఫైల్',
      viewProfile: 'ప్రొఫైల్ చూడండి',
      settings: 'సెట్టింగ్‌లు',
      logout: 'లాగ్‌అవుట్',
      email: 'ఇమెయిల్',
      mobile: 'మొబైల్',
      role: 'పాత్ర',
      department: 'విభాగం',
      employeeId: 'ఉద్యోగి ఐడి',
      editProfile: 'ప్రొఫైల్ సవరించు',
      close: 'మూసివేయి',
    },
    mr: {
      profile: 'प्रोफाइल',
      viewProfile: 'प्रोफाइल पहा',
      settings: 'सेटिंग्ज',
      logout: 'लॉगआउट',
      email: 'ईमेल',
      mobile: 'मोबाइल',
      role: 'भूमिका',
      department: 'विभाग',
      employeeId: 'कर्मचारी आयडी',
      editProfile: 'प्रोफाइल संपादित करा',
      close: 'बंद करा',
    },
    gu: {
      profile: 'પ્રોફાઇલ',
      viewProfile: 'પ્રોફાઇલ જુઓ',
      settings: 'સેટિંગ્સ',
      logout: 'લોગઆઉટ',
      email: 'ઇમેઇલ',
      mobile: 'મોબાઇલ',
      role: 'ભૂમિકા',
      department: 'વિભાગ',
      employeeId: 'કર્મચારી આઈડી',
      editProfile: 'પ્રોફાઇલ સંપાદિત કરો',
      close: 'બંધ કરો',
    },
    pa: {
      profile: 'ਪ੍ਰੋਫਾਈਲ',
      viewProfile: 'ਪ੍ਰੋਫਾਈਲ ਦੇਖੋ',
      settings: 'ਸੈਟਿੰਗਾਂ',
      logout: 'ਲੌਗਆਊਟ',
      email: 'ਈਮੇਲ',
      mobile: 'ਮੋਬਾਈਲ',
      role: 'ਭੂਮਿਕਾ',
      department: 'ਵਿਭਾਗ',
      employeeId: 'ਕਰਮਚਾਰੀ ਆਈਡੀ',
      editProfile: 'ਪ੍ਰੋਫਾਈਲ ਸੰਪਾਦਿਤ ਕਰੋ',
      close: 'ਬੰਦ ਕਰੋ',
    },
  };

  const t = translations[language] || translations.en;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'supervisor':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'operator':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  // Compact version for sidebar
  if (isCompact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-medium">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              getInitials(user.name)
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-white truncate">{user.name}</div>
            <div className="text-xs text-zinc-400 truncate">{user.role}</div>
          </div>
          <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {showProfileMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-zinc-200 overflow-hidden z-20">
              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <User className="h-4 w-4 text-zinc-500" />
                {t.viewProfile}
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigateToSettings?.();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                {t.settings}
              </button>
              <div className="border-t border-zinc-200" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t.logout}
              </button>
            </div>
          </>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <ProfileModal
            user={user}
            t={t}
            onClose={() => setShowProfileModal(false)}
            getInitials={getInitials}
          />
        )}
      </div>
    );
  }

  // Full profile card version
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xl font-medium">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-medium text-zinc-900">{user.name}</h3>
            <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
          </div>
          <p className="text-sm text-zinc-500">{user.department}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout} className="text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="h-4 w-4 mr-2" />
          {t.logout}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <Mail className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs text-zinc-500">{t.email}</div>
            <div className="text-sm text-zinc-900">{user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <Phone className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs text-zinc-500">{t.mobile}</div>
            <div className="text-sm text-zinc-900">{user.mobile}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <Briefcase className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs text-zinc-500">{t.department}</div>
            <div className="text-sm text-zinc-900">{user.department}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <User className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs text-zinc-500">{t.employeeId}</div>
            <div className="text-sm text-zinc-900">{user.employeeId}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Profile Modal Component
function ProfileModal({
  user,
  t,
  onClose,
  getInitials,
}: {
  user: UserData;
  t: Record<string, string>;
  onClose: () => void;
  getInitials: (name: string) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-medium">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  getInitials(user.name)
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <Badge className="mt-1 bg-white/20 text-white border-white/30">{user.role}</Badge>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
            <Mail className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs text-zinc-500">{t.email}</div>
              <div className="text-sm text-zinc-900">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
            <Phone className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs text-zinc-500">{t.mobile}</div>
              <div className="text-sm text-zinc-900">{user.mobile}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs text-zinc-500">{t.department}</div>
              <div className="text-sm text-zinc-900">{user.department}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
            <User className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs text-zinc-500">{t.employeeId}</div>
              <div className="text-sm text-zinc-900">{user.employeeId}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 p-4 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t.close}
          </Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            {t.editProfile}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Type export for use in App.tsx
export type { UserData };
