import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth';
import type { Language } from '@/types';

interface ResetPasswordProps {
  token: string;
  onSuccess: () => void;
  language: Language;
}

export function ResetPassword({ token, onSuccess, language }: ResetPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const translations = {
    en: {
      title: 'Reset Password',
      subtitle: 'Enter your new password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      enterNewPassword: 'Enter new password',
      enterConfirmPassword: 'Confirm your password',
      resetPassword: 'Reset Password',
      resetting: 'Resetting...',
      backToLogin: 'Back to Login',
      successTitle: 'Password Reset Successful!',
      successMessage: 'Your password has been reset successfully. You can now login with your new password.',
      passwordsNotMatch: 'Passwords do not match',
      passwordRequired: 'Password is required',
      passwordTooShort: 'Password must be at least 8 characters',
      passwordRequirements: 'Password must contain uppercase, lowercase, number, and special character',
    },
    hi: {
      title: 'पासवर्ड रीसेट करें',
      subtitle: 'अपना नया पासवर्ड दर्ज करें',
      newPassword: 'नया पासवर्ड',
      confirmPassword: 'पासवर्ड की पुष्टि करें',
      enterNewPassword: 'नया पासवर्ड दर्ज करें',
      enterConfirmPassword: 'अपने पासवर्ड की पुष्टि करें',
      resetPassword: 'पासवर्ड रीसेट करें',
      resetting: 'रीसेट हो रहा है...',
      backToLogin: 'लॉगिन पर वापस जाएं',
      successTitle: 'पासवर्ड रीसेट सफल!',
      successMessage: 'आपका पासवर्ड सफलतापूर्वक रीसेट हो गया है। अब आप अपने नए पासवर्ड से लॉगिन कर सकते हैं।',
      passwordsNotMatch: 'पासवर्ड मेल नहीं खाते',
      passwordRequired: 'पासवर्ड आवश्यक है',
      passwordTooShort: 'पासवर्ड कम से कम 8 अक्षर का होना चाहिए',
      passwordRequirements: 'पासवर्ड में अपरकेस, लोअरकेस, नंबर और विशेष वर्ण होना चाहिए',
    },
    kn: {
      title: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ',
      subtitle: 'ನಿಮ್ಮ ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ',
      newPassword: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್',
      confirmPassword: 'ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
      enterNewPassword: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ',
      enterConfirmPassword: 'ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
      resetPassword: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ',
      resetting: 'ಮರುಹೊಂದಿಸಲಾಗುತ್ತಿದೆ...',
      backToLogin: 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ',
      successTitle: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸುವಿಕೆ ಯಶಸ್ವಿಯಾಗಿದೆ!',
      successMessage: 'ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಯಶಸ್ವಿಯಾಗಿ ಮರುಹೊಂದಿಸಲಾಗಿದೆ. ನೀವು ಈಗ ನಿಮ್ಮ ಹೊಸ ಪಾಸ್‌ವರ್ಡ್‌ನೊಂದಿಗೆ ಲಾಗಿನ್ ಮಾಡಬಹುದು.',
      passwordsNotMatch: 'ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ',
      passwordRequired: 'ಪಾಸ್‌ವರ್ಡ್ ಅಗತ್ಯವಿದೆ',
      passwordTooShort: 'ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳಾಗಿರಬೇಕು',
      passwordRequirements: 'ಪಾಸ್‌ವರ್ಡ್ ದೊಡ್ಡಕ್ಷರ, ಸಣ್ಣಕ್ಷರ, ಸಂಖ್ಯೆ ಮತ್ತು ವಿಶೇಷ ಅಕ್ಷರವನ್ನು ಹೊಂದಿರಬೇಕು',
    },
    ta: {
      title: 'கடவுச்சொல்லை மீட்டமை',
      subtitle: 'உங்கள் புதிய கடவுச்சொல்லை உள்ளிடவும்',
      newPassword: 'புதிய கடவுச்சொல்',
      confirmPassword: 'கடவுச்சொல்லை உறுதிப்படுத்து',
      enterNewPassword: 'புதிய கடவுச்சொல்லை உள்ளிடவும்',
      enterConfirmPassword: 'உங்கள் கடவுச்சொல்லை உறுதிப்படுத்தவும்',
      resetPassword: 'கடவுச்சொல்லை மீட்டமை',
      resetting: 'மீட்டமைக்கப்படுகிறது...',
      backToLogin: 'உள்நுழைவுக்குத் திரும்பு',
      successTitle: 'கடவுச்சொல் மீட்டமைப்பு வெற்றி!',
      successMessage: 'உங்கள் கடவுச்சொல் வெற்றிகரமாக மீட்டமைக்கப்பட்டது. இப்போது உங்கள் புதிய கடவுச்சொல்லுடன் உள்நுழையலாம்.',
      passwordsNotMatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
      passwordRequired: 'கடவுச்சொல் தேவை',
      passwordTooShort: 'கடவுச்சொல் குறைந்தது 8 எழுத்துக்களாக இருக்க வேண்டும்',
      passwordRequirements: 'கடவுச்சொல் பெரிய எழுத்து, சிறிய எழுத்து, எண் மற்றும் சிறப்பு எழுத்தைக் கொண்டிருக்க வேண்டும்',
    },
    te: {
      title: 'పాస్‌వర్డ్ రీసెట్ చేయండి',
      subtitle: 'మీ కొత్త పాస్‌వర్డ్ నమోదు చేయండి',
      newPassword: 'కొత్త పాస్‌వర్డ్',
      confirmPassword: 'పాస్‌వర్డ్ నిర్ధారించండి',
      enterNewPassword: 'కొత్త పాస్‌వర్డ్ నమోదు చేయండి',
      enterConfirmPassword: 'మీ పాస్‌వర్డ్ నిర్ధారించండి',
      resetPassword: 'పాస్‌వర్డ్ రీసెట్ చేయండి',
      resetting: 'రీసెట్ చేస్తోంది...',
      backToLogin: 'లాగిన్‌కు తిరిగి వెళ్ళండి',
      successTitle: 'పాస్‌వర్డ్ రీసెట్ విజయవంతం!',
      successMessage: 'మీ పాస్‌వర్డ్ విజయవంతంగా రీసెట్ చేయబడింది. మీరు ఇప్పుడు మీ కొత్త పాస్‌వర్డ్‌తో లాగిన్ చేయవచ్చు.',
      passwordsNotMatch: 'పాస్‌వర్డ్‌లు సరిపోలడం లేదు',
      passwordRequired: 'పాస్‌వర్డ్ అవసరం',
      passwordTooShort: 'పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి',
      passwordRequirements: 'పాస్‌వర్డ్ పెద్ద అక్షరం, చిన్న అక్షరం, సంఖ్య మరియు ప్రత్యేక అక్షరాన్ని కలిగి ఉండాలి',
    },
    mr: {
      title: 'पासवर्ड रीसेट करा',
      subtitle: 'तुमचा नवीन पासवर्ड प्रविष्ट करा',
      newPassword: 'नवीन पासवर्ड',
      confirmPassword: 'पासवर्डची पुष्टी करा',
      enterNewPassword: 'नवीन पासवर्ड प्रविष्ट करा',
      enterConfirmPassword: 'तुमच्या पासवर्डची पुष्टी करा',
      resetPassword: 'पासवर्ड रीसेट करा',
      resetting: 'रीसेट होत आहे...',
      backToLogin: 'लॉगिनवर परत जा',
      successTitle: 'पासवर्ड रीसेट यशस्वी!',
      successMessage: 'तुमचा पासवर्ड यशस्वीरित्या रीसेट झाला आहे. तुम्ही आता तुमच्या नवीन पासवर्डसह लॉगिन करू शकता.',
      passwordsNotMatch: 'पासवर्ड जुळत नाहीत',
      passwordRequired: 'पासवर्ड आवश्यक आहे',
      passwordTooShort: 'पासवर्ड किमान 8 वर्णांचा असावा',
      passwordRequirements: 'पासवर्डमध्ये मोठे अक्षर, लहान अक्षर, संख्या आणि विशेष वर्ण असणे आवश्यक आहे',
    },
    gu: {
      title: 'પાસવર્ડ રીસેટ કરો',
      subtitle: 'તમારો નવો પાસવર્ડ દાખલ કરો',
      newPassword: 'નવો પાસવર્ડ',
      confirmPassword: 'પાસવર્ડની પુષ્ટિ કરો',
      enterNewPassword: 'નવો પાસવર્ડ દાખલ કરો',
      enterConfirmPassword: 'તમારા પાસવર્ડની પુષ્ટિ કરો',
      resetPassword: 'પાસવર્ડ રીસેટ કરો',
      resetting: 'રીસેટ થઈ રહ્યું છે...',
      backToLogin: 'લોગિનમાં પાછા જાઓ',
      successTitle: 'પાસવર્ડ રીસેટ સફળ!',
      successMessage: 'તમારો પાસવર્ડ સફળતાપૂર્વક રીસેટ થયો છે. તમે હવે તમારા નવા પાસવર્ડ સાથે લોગિન કરી શકો છો.',
      passwordsNotMatch: 'પાસવર્ડ મેળ ખાતા નથી',
      passwordRequired: 'પાસવર્ડ જરૂરી છે',
      passwordTooShort: 'પાસવર્ડ ઓછામાં ઓછો 8 અક્ષરોનો હોવો જોઈએ',
      passwordRequirements: 'પાસવર્ડમાં મોટા અક્ષર, નાના અક્ષર, સંખ્યા અને વિશેષ અક્ષર હોવા જોઈએ',
    },
    pa: {
      title: 'ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰੋ',
      subtitle: 'ਆਪਣਾ ਨਵਾਂ ਪਾਸਵਰਡ ਦਾਖਲ ਕਰੋ',
      newPassword: 'ਨਵਾਂ ਪਾਸਵਰਡ',
      confirmPassword: 'ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
      enterNewPassword: 'ਨਵਾਂ ਪਾਸਵਰਡ ਦਾਖਲ ਕਰੋ',
      enterConfirmPassword: 'ਆਪਣੇ ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
      resetPassword: 'ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰੋ',
      resetting: 'ਰੀਸੈੱਟ ਹੋ ਰਿਹਾ ਹੈ...',
      backToLogin: 'ਲਾਗਇਨ ਤੇ ਵਾਪਸ ਜਾਓ',
      successTitle: 'ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਸਫਲ!',
      successMessage: 'ਤੁਹਾਡਾ ਪਾਸਵਰਡ ਸਫਲਤਾਪੂਰਵਕ ਰੀਸੈੱਟ ਹੋ ਗਿਆ ਹੈ। ਤੁਸੀਂ ਹੁਣ ਆਪਣੇ ਨਵੇਂ ਪਾਸਵਰਡ ਨਾਲ ਲਾਗਇਨ ਕਰ ਸਕਦੇ ਹੋ।',
      passwordsNotMatch: 'ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾਂਦੇ',
      passwordRequired: 'ਪਾਸਵਰਡ ਲੋੜੀਂਦਾ ਹੈ',
      passwordTooShort: 'ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ 8 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ',
      passwordRequirements: 'ਪਾਸਵਰਡ ਵਿੱਚ ਵੱਡੇ ਅੱਖਰ, ਛੋਟੇ ਅੱਖਰ, ਨੰਬਰ ਅਤੇ ਵਿਸ਼ੇਸ਼ ਅੱਖਰ ਹੋਣੇ ਚਾਹੀਦੇ ਹਨ',
    },
  };

  const t = translations[language] || translations.en;

  const validatePassword = (password: string) => {
    if (password.length < 8) return t.passwordTooShort;
    if (!/[A-Z]/.test(password)) return t.passwordRequirements;
    if (!/[a-z]/.test(password)) return t.passwordRequirements;
    if (!/\d/.test(password)) return t.passwordRequirements;
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return t.passwordRequirements;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError(t.passwordRequired);
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t.passwordsNotMatch);
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword({ token, new_password: newPassword });
      setSuccess(true);
    } catch (error: any) {
      setError(error?.detail || error?.message || 'Failed to reset password');
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
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-2">
              {t.successTitle}
            </h2>
            <p className="text-zinc-600 mb-6">{t.successMessage}</p>
            <Button
              onClick={onSuccess}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
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
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-zinc-900">{t.title}</h2>
          <p className="text-zinc-500 mt-2">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.newPassword}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.enterNewPassword}
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

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              {t.confirmPassword}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.enterConfirmPassword}
                className="pl-10 pr-10 h-12 border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
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
            {isLoading ? t.resetting : t.resetPassword}
          </Button>
        </form>
      </Card>
    </div>
  );
}
