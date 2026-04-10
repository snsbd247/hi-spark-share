import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { db } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { translations, type Language, type Translations } from "@/i18n";
import { sessionStore } from "@/lib/sessionStore";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const PUBLIC_LANGUAGE_KEY = "app_language_public";

function isValidLanguage(value: unknown): value is Language {
  return value === "en" || value === "bn";
}

function getLangKey(userId?: string | null) {
  return userId ? `app_language_${userId}` : PUBLIC_LANGUAGE_KEY;
}

function getCachedAdminUserId() {
  const rawUser = sessionStore.getItem("admin_user");
  if (!rawUser) return null;

  try {
    const parsedUser = JSON.parse(rawUser);
    return parsedUser?.id ? String(parsedUser.id) : null;
  } catch {
    return null;
  }
}

function readStoredLanguage(userId?: string | null): Language | null {
  if (typeof window === "undefined") return null;

  const scopedLanguage = localStorage.getItem(getLangKey(userId));
  if (isValidLanguage(scopedLanguage)) return scopedLanguage;

  if (userId) {
    const publicLanguage = localStorage.getItem(PUBLIC_LANGUAGE_KEY);
    if (isValidLanguage(publicLanguage)) return publicLanguage;
  }

  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [language, setLang] = useState<Language>(() => readStoredLanguage(getCachedAdminUserId()) || "en");

  // Load language from user-specific localStorage or DB when user is available
  useEffect(() => {
    const resolvedUserId = user?.id || getCachedAdminUserId();
    const cachedLanguage = readStoredLanguage(resolvedUserId);

    if (cachedLanguage) {
      setLang(cachedLanguage);
      return;
    }

    if (!resolvedUserId) {
      setLang("en");
      return;
    }

    // Fallback: load from DB
    db
      .from("profiles")
      .select("language")
      .eq("id", resolvedUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.language && isValidLanguage(data.language)) {
          setLang(data.language as Language);
          localStorage.setItem(getLangKey(resolvedUserId), data.language);
          localStorage.setItem(PUBLIC_LANGUAGE_KEY, data.language);
        } else {
          // Default to English
          setLang("en");
        }
      });
  }, [user?.id]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLang(lang);
    const resolvedUserId = user?.id || getCachedAdminUserId();

    localStorage.setItem(getLangKey(resolvedUserId), lang);
    localStorage.setItem(PUBLIC_LANGUAGE_KEY, lang);

    if (user?.id) {
      await db
        .from("profiles")
        .update({ language: lang } as any)
        .eq("id", user.id);
    }
  }, [user?.id]);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

const fallback: LanguageContextType = {
  language: "en",
  setLanguage: async () => {},
  t: translations.en,
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  return context ?? fallback;
};
