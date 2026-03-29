import en from "./en";
import bn from "./bn";
import type { Translations } from "./en";

export type Language = "en" | "bn";

export const translations: Record<Language, Translations> = { en, bn };

export const languageNames: Record<Language, string> = {
  en: "English",
  bn: "বাংলা",
};

export type { Translations };
