import { useState } from 'react';
import { Eye, EyeOff, Lock, User, Factory } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ForgotPassword } from './ForgotPassword';
import type { Language } from '@/types';

interface LoginProps {
  onLogin: (username: string, password: string, rememberMe?: boolean) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const languageOptions: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'mr', name: 'मराठी' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },
];

export function Login({ onLogin, language, onLanguageChange }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const translations = {
    en: {
      title: 'OMNIX',
      tagline: 'Precision at every step.',
      welcomeBack: 'Welcome Back',
      signInContinue: 'Sign in to continue to your dashboard',
      username: 'Email or Username',
      password: 'Password',
      enterUsername: 'Enter your email or username',
      enterPassword: 'Enter your password',
      signIn: 'Sign In',
      signingIn: 'Signing In...',
      forgotPassword: 'Forgot Password?',
      rememberMe: 'Remember me',
      invalidCredentials: 'Invalid username or password',
      allFieldsRequired: 'Please fill in all fields',
      manufacturingOS: 'Manufacturing Operating System',
      poweredBy: 'Powered by',
    },
    hi: {
      title: 'OMNIX',
      tagline: 'प्रत्येक चरण में सटीकता।',
      welcomeBack: 'वापसी पर स्वागत है',
      signInContinue: 'अपने डैशबोर्ड पर जारी रखने के लिए साइन इन करें',
      username: 'ईमेल या उपयोगकर्ता नाम',
      password: 'पासवर्ड',
      enterUsername: 'अपना ईमेल या उपयोगकर्ता नाम दर्ज करें',
      enterPassword: 'अपना पासवर्ड दर्ज करें',
      signIn: 'साइन इन करें',
      signingIn: 'साइन इन हो रहा है...',
      forgotPassword: 'पासवर्ड भूल गए?',
      rememberMe: 'मुझे याद रखें',
      invalidCredentials: 'अमान्य उपयोगकर्ता नाम या पासवर्ड',
      allFieldsRequired: 'कृपया सभी फ़ील्ड भरें',
      manufacturingOS: 'मैन्युफैक्चरिंग ऑपरेटिंग सिस्टम',
      poweredBy: 'द्वारा संचालित',
    },
    kn: {
      title: 'OMNIX',
      tagline: 'ಪ್ರತಿ ಹಂತದಲ್ಲೂ ನಿಖರತೆ.',
      welcomeBack: 'ಮರಳಿ ಸ್ವಾಗತ',
      signInContinue: 'ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಮುಂದುವರಿಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ',
      username: 'ಇಮೇಲ್ ಅಥವಾ ಬಳಕೆದಾರ ಹೆಸರು',
      password: 'ಪಾಸ್‌ವರ್ಡ್',
      enterUsername: 'ನಿಮ್ಮ ಇಮೇಲ್ ಅಥವಾ ಬಳಕೆದಾರ ಹೆಸರನ್ನು ನಮೂದಿಸಿ',
      enterPassword: 'ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ',
      signIn: 'ಸೈನ್ ಇನ್',
      signingIn: 'ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ...',
      forgotPassword: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?',
      rememberMe: 'ನನ್ನನ್ನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳಿ',
      invalidCredentials: 'ಅಮಾನ್ಯ ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್',
      allFieldsRequired: 'ದಯವಿಟ್ಟು ಎಲ್ಲಾ ಕ್ಷೇತ್ರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ',
      manufacturingOS: 'ಮ್ಯಾನುಫ್ಯಾಕ್ಚರಿಂಗ್ ಆಪರೇಟಿಂಗ್ ಸಿಸ್ಟಮ್',
      poweredBy: 'ಇದರಿಂದ ನಡೆಸಲ್ಪಡುತ್ತದೆ',
    },
    ta: {
      title: 'OMNIX',
      tagline: 'ஒவ்வொரு படியிலும் துல்லியம்.',
      welcomeBack: 'மீண்டும் வரவேற்கிறோம்',
      signInContinue: 'உங்கள் டாஷ்போர்டுக்கு தொடர உள்நுழையவும்',
      username: 'மின்னஞ்சல் அல்லது பயனர்பெயர்',
      password: 'கடவுச்சொல்',
      enterUsername: 'உங்கள் மின்னஞ்சல் அல்லது பயனர்பெயரை உள்ளிடவும்',
      enterPassword: 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்',
      signIn: 'உள்நுழை',
      signingIn: 'உள்நுழைகிறது...',
      forgotPassword: 'கடவுச்சொல் மறந்துவிட்டதா?',
      rememberMe: 'என்னை நினைவில் கொள்',
      invalidCredentials: 'தவறான பயனர்பெயர் அல்லது கடவுச்சொல்',
      allFieldsRequired: 'அனைத்து புலங்களையும் நிரப்பவும்',
      manufacturingOS: 'உற்பத்தி இயக்க அமைப்பு',
      poweredBy: 'இயக்குபவர்',
    },
    te: {
      title: 'OMNIX',
      tagline: 'ప్రతి దశలో ఖచ్చితత్వం.',
      welcomeBack: 'తిరిగి స్వాగతం',
      signInContinue: 'మీ డాష్‌బోర్డ్‌కు కొనసాగించడానికి సైన్ ఇన్ చేయండి',
      username: 'ఇమెయిల్ లేదా వినియోగదారు పేరు',
      password: 'పాస్‌వర్డ్',
      enterUsername: 'మీ వినియోగదారు పేరును నమోదు చేయండి',
      enterPassword: 'మీ పాస్‌వర్డ్ నమోదు చేయండి',
      signIn: 'సైన్ ఇన్',
      signingIn: 'సైన్ ఇన్ అవుతోంది...',
      forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
      rememberMe: 'నన్ను గుర్తుంచుకో',
      invalidCredentials: 'చెల్లని వినియోగదారు పేరు లేదా పాస్‌వర్డ్',
      allFieldsRequired: 'దయచేసి అన్ని ఫీల్డ్‌లను పూరించండి',
      manufacturingOS: 'మాన్యుఫాక్చరింగ్ ఆపరేటింగ్ సిస్టమ్',
      poweredBy: 'ద్వారా నడుస్తుంది',
    },
    mr: {
      title: 'OMNIX',
      tagline: 'प्रत्येक टप्प्यावर अचूकता.',
      welcomeBack: 'पुन्हा स्वागत आहे',
      signInContinue: 'तुमच्या डॅशबोर्डवर सुरू ठेवण्यासाठी साइन इन करा',
      username: 'ईमेल किंवा वापरकर्ता नाव',
      password: 'पासवर्ड',
      enterUsername: 'तुमचा ईमेल किंवा वापरकर्ता नाव प्रविष्ट करा',
      enterPassword: 'तुमचा पासवर्ड प्रविष्ट करा',
      signIn: 'साइन इन',
      signingIn: 'साइन इन होत आहे...',
      forgotPassword: 'पासवर्ड विसरलात?',
      rememberMe: 'मला लक्षात ठेवा',
      invalidCredentials: 'अवैध वापरकर्ता नाव किंवा पासवर्ड',
      allFieldsRequired: 'कृपया सर्व फील्ड भरा',
      manufacturingOS: 'मॅन्युफॅक्चरिंग ऑपरेटिंग सिस्टम',
      poweredBy: 'द्वारे संचालित',
    },
    gu: {
      title: 'OMNIX',
      tagline: 'દરેક પગલે ચોકસાઈ.',
      welcomeBack: 'પાછા સ્વાગત છે',
      signInContinue: 'તમારા ડેશબોર્ડ પર ચાલુ રાખવા માટે સાઇન ઇન કરો',
      username: 'ઇમેઇલ અથવા વપરાશકર્તા નામ',
      password: 'પાસવર્ડ',
      enterUsername: 'તમારું ઇમેઇલ અથવા વપરાશકર્તા નામ દાખલ કરો',
      enterPassword: 'તમારો પાસવર્ડ દાખલ કરો',
      signIn: 'સાઇન ઇન',
      signingIn: 'સાઇન ઇન થઈ રહ્યું છે...',
      forgotPassword: 'પાસવર્ડ ભૂલી ગયા?',
      rememberMe: 'મને યાદ રાખો',
      invalidCredentials: 'અમાન્ય વપરાશકર્તા નામ અથવા પાસવર્ડ',
      allFieldsRequired: 'કૃપા કરીને બધા ફીલ્ડ ભરો',
      manufacturingOS: 'મેન્યુફેક્ચરિંગ ઓપરેટિંગ સિસ્ટમ',
      poweredBy: 'દ્વારા સંચાલિત',
    },
    pa: {
      title: 'OMNIX',
      tagline: 'ਹਰ ਕਦਮ ਤੇ ਸ਼ੁੱਧਤਾ.',
      welcomeBack: 'ਵਾਪਸ ਸੁਆਗਤ ਹੈ',
      signInContinue: 'ਆਪਣੇ ਡੈਸ਼ਬੋਰਡ ਤੇ ਜਾਰੀ ਰੱਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ',
      username: 'ਈਮੇਲ ਜਾਂ ਯੂਜ਼ਰਨੇਮ',
      password: 'ਪਾਸਵਰਡ',
      enterUsername: 'ਆਪਣਾ ਈਮੇਲ ਜਾਂ ਯੂਜ਼ਰਨੇਮ ਦਾਖਲ ਕਰੋ',
      enterPassword: 'ਆਪਣਾ ਪਾਸਵਰਡ ਦਾਖਲ ਕਰੋ',
      signIn: 'ਸਾਈਨ ਇਨ',
      signingIn: 'ਸਾਈਨ ਇਨ ਹੋ ਰਿਹਾ ਹੈ...',
      forgotPassword: 'ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?',
      rememberMe: 'ਮੈਨੂੰ ਯਾਦ ਰੱਖੋ',
      invalidCredentials: 'ਅਵੈਧ ਯੂਜ਼ਰਨੇਮ ਜਾਂ ਪਾਸਵਰਡ',
      allFieldsRequired: 'ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੇ ਖੇਤਰ ਭਰੋ',
      manufacturingOS: 'ਮੈਨੂਫੈਕਚਰਿੰਗ ਓਪਰੇਟਿੰਗ ਸਿਸਟਮ',
      poweredBy: 'ਦੁਆਰਾ ਸੰਚਾਲਿਤ',
    },
  };

  const t = translations[language] || translations.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t.allFieldsRequired);
      return;
    }

    setIsLoading(true);
    
    try {
      await onLogin(username, password, rememberMe);
      // Success - authStore handles authentication and redirect
    } catch (error: any) {
      setError(error?.detail || error?.message || t.invalidCredentials);
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPassword
        onBack={() => setShowForgotPassword(false)}
        language={language}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-600 rounded-full blur-3xl" />
        </div>
        
        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white text-xl font-bold">O</span>
            </div>
            <div>
              <h1 className="text-white text-2xl tracking-wider font-semibold">{t.title}</h1>
              <p className="text-zinc-400 text-sm">{t.tagline}</p>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <Factory className="h-16 w-16 text-emerald-500" />
          </div>
          <h2 className="text-4xl text-white font-light leading-tight">
            {t.manufacturingOS}
          </h2>
          <p className="text-zinc-400 text-lg max-w-md">
            Streamline your production workflow with intelligent automation and real-time insights.
          </p>
          
          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-4 pt-8">
            {[
              { label: 'Production Orders', value: '1000+' },
              { label: 'Active Users', value: '50+' },
              { label: 'Efficiency Gain', value: '35%' },
              { label: 'Languages', value: '8' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="text-2xl text-emerald-500 font-semibold">{stat.value}</div>
                <div className="text-zinc-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-zinc-500 text-sm">
          {t.poweredBy} OMNIX Technologies
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-zinc-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white text-xl font-bold">O</span>
            </div>
            <div>
              <h1 className="text-zinc-900 text-2xl tracking-wider font-semibold">{t.title}</h1>
              <p className="text-zinc-500 text-sm">{t.tagline}</p>
            </div>
          </div>

          <Card className="p-8 shadow-xl border-0">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900">{t.welcomeBack}</h2>
              <p className="text-zinc-500 mt-2">{t.signInContinue}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  {t.username}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.enterUsername}
                    className="pl-10 h-12 border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  {t.password}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.enterPassword}
                    className="pl-10 pr-10 h-12 border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-zinc-600">{t.rememberMe}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {t.forgotPassword}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isLoading ? t.signingIn : t.signIn}
              </Button>
            </form>

            {/* Language Selector */}
            <div className="mt-8 pt-6 border-t border-zinc-200">
              <div className="flex flex-wrap justify-center gap-2">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => onLanguageChange(lang.code)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      language === lang.code
                        ? 'bg-emerald-100 text-emerald-700 font-medium'
                        : 'text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Footer for mobile */}
          <p className="lg:hidden text-center text-zinc-400 text-sm mt-6">
            {t.poweredBy} OMNIX Technologies
          </p>
        </div>
      </div>
    </div>
  );
}
