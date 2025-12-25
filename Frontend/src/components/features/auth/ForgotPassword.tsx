import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import type { Language } from '@/types';

interface ForgotPasswordProps {
  onBack: () => void;
  language: Language;
}

export function ForgotPassword({ onBack, language }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const translations = {
    en: {
      title: 'Forgot Password',
      subtitle: 'Enter your email to receive a password reset link',
      email: 'Email Address',
      enterEmail: 'Enter your email',
      sendLink: 'Send Reset Link',
      sending: 'Sending...',
      backToLogin: 'Back to Login',
      successMessage: 'If an account exists with this email, you will receive a password reset link shortly.',
      checkEmail: 'Please check your email inbox and spam folder.',
      emailRequired: 'Email is required',
      invalidEmail: 'Please enter a valid email address',
    },
    hi: {
      title: 'पासवर्ड भूल गए',
      subtitle: 'पासवर्ड रीसेट लिंक प्राप्त करने के लिए अपना ईमेल दर्ज करें',
      email: 'ईमेल पता',
      enterEmail: 'अपना ईमेल दर्ज करें',
      sendLink: 'रीसेट लिंक भेजें',
      sending: 'भेजा जा रहा है...',
      backToLogin: 'लॉगिन पर वापस जाएं',
      successMessage: 'यदि इस ईमेल के साथ कोई खाता मौजूद है, तो आपको शीघ्र ही पासवर्ड रीसेट लिंक प्राप्त होगा।',
      checkEmail: 'कृपया अपना ईमेल इनबॉक्स और स्पैम फ़ोल्डर जांचें।',
      emailRequired: 'ईमेल आवश्यक है',
      invalidEmail: 'कृपया एक वैध ईमेल पता दर्ज करें',
    },
    kn: {
      title: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ',
      subtitle: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸುವ ಲಿಂಕ್ ಪಡೆಯಲು ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ',
      email: 'ಇಮೇಲ್ ವಿಳಾಸ',
      enterEmail: 'ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ',
      sendLink: 'ಮರುಹೊಂದಿಸುವ ಲಿಂಕ್ ಕಳುಹಿಸಿ',
      sending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...',
      backToLogin: 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ',
      successMessage: 'ಈ ಇಮೇಲ್‌ನೊಂದಿಗೆ ಖಾತೆ ಇದ್ದರೆ, ನೀವು ಶೀಘ್ರದಲ್ಲೇ ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸುವ ಲಿಂಕ್ ಪಡೆಯುತ್ತೀರಿ.',
      checkEmail: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ಇನ್‌ಬಾಕ್ಸ್ ಮತ್ತು ಸ್ಪ್ಯಾಮ್ ಫೋಲ್ಡರ್ ಪರಿಶೀಲಿಸಿ.',
      emailRequired: 'ಇಮೇಲ್ ಅಗತ್ಯವಿದೆ',
      invalidEmail: 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ',
    },
    ta: {
      title: 'கடவுச்சொல் மறந்துவிட்டதா',
      subtitle: 'கடவுச்சொல் மீட்டமைப்பு இணைப்பைப் பெற உங்கள் மின்னஞ்சலை உள்ளிடவும்',
      email: 'மின்னஞ்சல் முகவரி',
      enterEmail: 'உங்கள் மின்னஞ்சலை உள்ளிடவும்',
      sendLink: 'மீட்டமைப்பு இணைப்பை அனுப்பவும்',
      sending: 'அனுப்பப்படுகிறது...',
      backToLogin: 'உள்நுழைவுக்குத் திரும்பு',
      successMessage: 'இந்த மின்னஞ்சலுடன் கணக்கு இருந்தால், விரைவில் கடவுச்சொல் மீட்டமைப்பு இணைப்பைப் பெறுவீர்கள்.',
      checkEmail: 'உங்கள் மின்னஞ்சல் இன்பாக்ஸ் மற்றும் ஸ்பேம் கோப்புறையைச் சரிபார்க்கவும்.',
      emailRequired: 'மின்னஞ்சல் தேவை',
      invalidEmail: 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்',
    },
    te: {
      title: 'పాస్‌వర్డ్ మర్చిపోయారా',
      subtitle: 'పాస్‌వర్డ్ రీసెట్ లింక్ పొందడానికి మీ ఇమెయిల్ నమోదు చేయండి',
      email: 'ఇమెయిల్ చిరునామా',
      enterEmail: 'మీ ఇమెయిల్ నమోదు చేయండి',
      sendLink: 'రీసెట్ లింక్ పంపండి',
      sending: 'పంపుతోంది...',
      backToLogin: 'లాగిన్‌కు తిరిగి వెళ్ళండి',
      successMessage: 'ఈ ఇమెయిల్‌తో ఖాతా ఉంటే, మీరు త్వరలో పాస్‌వర్డ్ రీసెట్ లింక్ పొందుతారు.',
      checkEmail: 'దయచేసి మీ ఇమెయిల్ ఇన్‌బాక్స్ మరియు స్పామ్ ఫోల్డర్ తనిఖీ చేయండి.',
      emailRequired: 'ఇమెయిల్ అవసరం',
      invalidEmail: 'దయచేసి చెల్లుబాటు అయ్యే ఇమెయిల్ చిరునామాను నమోదు చేయండి',
    },
    mr: {
      title: 'पासवर्ड विसरलात',
      subtitle: 'पासवर्ड रीसेट लिंक प्राप्त करण्यासाठी तुमचा ईमेल प्रविष्ट करा',
      email: 'ईमेल पत्ता',
      enterEmail: 'तुमचा ईमेल प्रविष्ट करा',
      sendLink: 'रीसेट लिंक पाठवा',
      sending: 'पाठवत आहे...',
      backToLogin: 'लॉगिनवर परत जा',
      successMessage: 'या ईमेलसह खाते अस्तित्वात असल्यास, तुम्हाला लवकरच पासवर्ड रीसेट लिंक प्राप्त होईल.',
      checkEmail: 'कृपया तुमचा ईमेल इनबॉक्स आणि स्पॅम फोल्डर तपासा.',
      emailRequired: 'ईमेल आवश्यक आहे',
      invalidEmail: 'कृपया वैध ईमेल पत्ता प्रविष्ट करा',
    },
    gu: {
      title: 'પાસવર્ડ ભૂલી ગયા',
      subtitle: 'પાસવર્ડ રીસેટ લિંક મેળવવા માટે તમારું ઇમેઇલ દાખલ કરો',
      email: 'ઇમેઇલ સરનામું',
      enterEmail: 'તમારું ઇમેઇલ દાખલ કરો',
      sendLink: 'રીસેટ લિંક મોકલો',
      sending: 'મોકલી રહ્યું છે...',
      backToLogin: 'લોગિનમાં પાછા જાઓ',
      successMessage: 'જો આ ઇમેઇલ સાથે ખાતું અસ્તિત્વમાં હોય, તો તમને ટૂંક સમયમાં પાસવર્ડ રીસેટ લિંક પ્રાપ્ત થશે.',
      checkEmail: 'કૃપા કરીને તમારું ઇમેઇલ ઇનબોક્સ અને સ્પામ ફોલ્ડર તપાસો.',
      emailRequired: 'ઇમેઇલ જરૂરી છે',
      invalidEmail: 'કૃપા કરીને માન્ય ઇમેઇલ સરનામું દાખલ કરો',
    },
    pa: {
      title: 'ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ',
      subtitle: 'ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਲਿੰਕ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਆਪਣਾ ਈਮੇਲ ਦਾਖਲ ਕਰੋ',
      email: 'ਈਮੇਲ ਪਤਾ',
      enterEmail: 'ਆਪਣਾ ਈਮੇਲ ਦਾਖਲ ਕਰੋ',
      sendLink: 'ਰੀਸੈੱਟ ਲਿੰਕ ਭੇਜੋ',
      sending: 'ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ...',
      backToLogin: 'ਲਾਗਇਨ ਤੇ ਵਾਪਸ ਜਾਓ',
      successMessage: 'ਜੇ ਇਸ ਈਮੇਲ ਨਾਲ ਖਾਤਾ ਮੌਜੂਦ ਹੈ, ਤਾਂ ਤੁਹਾਨੂੰ ਜਲਦੀ ਹੀ ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਲਿੰਕ ਪ੍ਰਾਪਤ ਹੋਵੇਗਾ.',
      checkEmail: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਈਮੇਲ ਇਨਬਾਕਸ ਅਤੇ ਸਪੈਮ ਫੋਲਡਰ ਜਾਂਚੋ.',
      emailRequired: 'ਈਮੇਲ ਲੋੜੀਂਦਾ ਹੈ',
      invalidEmail: 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੈਧ ਈਮੇਲ ਪਤਾ ਦਾਖਲ ਕਰੋ',
    },
  };

  const t = translations[language] || translations.en;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t.emailRequired);
      return;
    }

    if (!validateEmail(email)) {
      setError(t.invalidEmail);
      return;
    }

    setIsLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (error: any) {
      setError(error?.detail || error?.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <Card className="w-full max-w-md p-8 shadow-xl border-0">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-2">
              {t.checkEmail}
            </h2>
            <p className="text-zinc-600 mb-6">{t.successMessage}</p>
            <Button
              onClick={onBack}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.backToLogin}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
      <Card className="w-full max-w-md p-8 shadow-xl border-0">
        <button
          onClick={onBack}
          className="flex items-center text-zinc-600 hover:text-zinc-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.backToLogin}
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-zinc-900">{t.title}</h2>
          <p className="text-zinc-500 mt-2">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.email}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.enterEmail}
                className="pl-10 h-12 border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {isLoading ? t.sending : t.sendLink}
          </Button>
        </form>
      </Card>
    </div>
  );
}
