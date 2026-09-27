"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { LanguageCode, LanguageContextType, SUPPORTED_LANGUAGES, TranslationDictionary } from "./types";
import { translations } from "./translations";

const STORAGE_KEY = "exam_platform_language";
const DEFAULT_LANGUAGE: LanguageCode = "en";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (stored && translations[stored]) {
        setLanguageState(stored);
      }
    } catch {
      // LocalStorage access may fail in private mode or SSR
    }
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (translations[lang]) {
      setLanguageState(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // LocalStorage access failure fallback
      }
      // Update document lang attribute
      if (typeof document !== "undefined") {
        document.documentElement.lang = lang;
      }
    }
  }, []);

  /**
   * Helper to retrieve value from a nested dictionary object using dot notation
   */
  const getNestedValue = (obj: any, path: string): string | undefined => {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== "object") {
        return undefined;
      }
      current = current[part];
    }
    return typeof current === "string" ? current : undefined;
  };

  /**
   * Translate key with optional variable interpolation
   * e.g. t("student.welcome", { name: "Alice" })
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const currentDict = translations[language] || translations[DEFAULT_LANGUAGE];
      let value = getNestedValue(currentDict, key);

      // Fallback to English if translation is missing in the chosen language
      if (value === undefined && language !== DEFAULT_LANGUAGE) {
        value = getNestedValue(translations[DEFAULT_LANGUAGE], key);
      }

      // If still missing, return the key itself
      if (value === undefined) {
        return key;
      }

      // Param interpolation: replace {paramName} with value
      if (params) {
        return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
          return acc.replaceAll(`{${paramKey}}`, String(paramVal));
        }, value);
      }

      return value;
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
