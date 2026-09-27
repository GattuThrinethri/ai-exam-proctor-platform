import { en } from "./en";
import { te } from "./te";
import { hi } from "./hi";
import { kn } from "./kn";
import { ml } from "./ml";
import { ta } from "./ta";
import { LanguageCode, TranslationDictionary } from "../types";

export const translations: Record<LanguageCode, TranslationDictionary> = {
  en,
  te,
  hi,
  kn,
  ml,
  ta,
};

export { en, te, hi, kn, ml, ta };
