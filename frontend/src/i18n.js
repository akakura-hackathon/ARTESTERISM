import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './locales/ja.json';
import en from './locales/en.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ru from './locales/ru.json';

// ブラウザの言語設定を取得、またはlocalStorageから取得
const savedLanguage = localStorage.getItem('language');
const browserLanguage = navigator.language.split('-')[0]; // "ja-JP" -> "ja"
const defaultLanguage = savedLanguage || (["ja", "en", "zh", "ko", "es", "fr", "ru"].includes(browserLanguage) ? browserLanguage : "ja");

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
      zh: { translation: zh },
      ko: { translation: ko },
      es: { translation: es },
      fr: { translation: fr },
      ru: { translation: ru }
    },
    lng: defaultLanguage,
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false
    }
  });

// 言語変更時にlocalStorageに保存
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
