import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { db } from "@/integrations/db/client";
import { useAuth } from "@/contexts/AuthContext";
import { translations, type Language, type Translations } from "@/i18n";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLang] = useState<Language>(() => {
    // Initial from localStorage for instant load
    return (localStorage.getItem("app_language") as Language) || "en";
  });

  // Load language from DB when user is available
  useEffect(() => {
    if (!user?.id) return;
    db
      .from("profiles")
      .select("language")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.language && (data.language === "en" || data.language === "bn")) {
          setLang(data.language as Language);
          localStorage.setItem("app_language", data.language);
        }
      });
  }, [user?.id]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLang(lang);
    localStorage.setItem("app_language", lang);

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
