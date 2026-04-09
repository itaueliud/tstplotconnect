import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/translation.json";
import sw from "./locales/sw/translation.json";

const LANGUAGE_KEY = "plotconnect:lang";

const languageDetector = {
  type: "languageDetector",
  async: true,
  detect: async (callback) => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      callback(stored || "en");
    } catch (_err) {
      callback("en");
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch (_err) {
      // no-op: app still functions with in-memory language state
    }
  }
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v4",
    resources: {
      en: { translation: en },
      sw: { translation: sw }
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
