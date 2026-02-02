import i18n, { type Resource } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import es from "@/locales/es.json";

export const SUPPORTED_LANGUAGES = ["en", "pt", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources: Resource = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
};

export function isSupportedLanguage(v: string | null | undefined): v is SupportedLanguage {
  return !!v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

// Note: we keep detection enabled, but we also allow overriding language from the user profile.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    detection: {
      // Priority: stored choice -> browser -> htmlTag
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "app_language",
    },
    react: { useSuspense: false },
  });

export default i18n;
