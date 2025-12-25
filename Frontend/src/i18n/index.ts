import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enNav from './locales/en/nav.json';

import hiCommon from './locales/hi/common.json';
import hiAuth from './locales/hi/auth.json';
import hiNav from './locales/hi/nav.json';

import knCommon from './locales/kn/common.json';
import knAuth from './locales/kn/auth.json';
import knNav from './locales/kn/nav.json';

import taCommon from './locales/ta/common.json';
import taAuth from './locales/ta/auth.json';
import taNav from './locales/ta/nav.json';

import teCommon from './locales/te/common.json';
import teAuth from './locales/te/auth.json';
import teNav from './locales/te/nav.json';

import mrCommon from './locales/mr/common.json';
import mrAuth from './locales/mr/auth.json';
import mrNav from './locales/mr/nav.json';

import guCommon from './locales/gu/common.json';
import guAuth from './locales/gu/auth.json';
import guNav from './locales/gu/nav.json';

import paCommon from './locales/pa/common.json';
import paAuth from './locales/pa/auth.json';
import paNav from './locales/pa/nav.json';

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    nav: enNav,
  },
  hi: {
    common: hiCommon,
    auth: hiAuth,
    nav: hiNav,
  },
  kn: {
    common: knCommon,
    auth: knAuth,
    nav: knNav,
  },
  ta: {
    common: taCommon,
    auth: taAuth,
    nav: taNav,
  },
  te: {
    common: teCommon,
    auth: teAuth,
    nav: teNav,
  },
  mr: {
    common: mrCommon,
    auth: mrAuth,
    nav: mrNav,
  },
  gu: {
    common: guCommon,
    auth: guAuth,
    nav: guNav,
  },
  pa: {
    common: paCommon,
    auth: paAuth,
    nav: paNav,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'nav'],
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Export supported languages for language selector
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
];
