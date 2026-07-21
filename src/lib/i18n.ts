// i18n setup. Three languages: cs (source of truth, default), en, de.
//
// Pluralization: i18next resolves plural keys (_one/_few/_other) via
// Intl.PluralRules per language automatically — Czech gets its real
// one/few/other split (1 / 2–4 / 0,5+), English and German get one/other.
// This is what replaces the hand-rolled czPlural() ternaries: define
// "key_one", "key_few", "key_other" in a namespace and pass {count} —
// i18next picks the right form. No per-string reimplementation needed.
//
// Language choice is per-resident, not per-building (a house can have a
// Czech committee and an English- or German-speaking owner side by side).
// Persistence: real accounts save it to profiles.language (see
// api.setMyLanguage); everyone else falls back to i18next-browser-
// languagedetector, which caches the choice in localStorage so it sticks
// across visits even before login. Detector order below tries that cache
// first, then the browser's own language, and only then the 'cs' default —
// so a returning visitor's explicit choice always wins over a fresh guess.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import csCommon from '../locales/cs/common.json'
import enCommon from '../locales/en/common.json'
import deCommon from '../locales/de/common.json'
import csShell from '../locales/cs/shell.json'
import enShell from '../locales/en/shell.json'
import deShell from '../locales/de/shell.json'
import csAuth from '../locales/cs/auth.json'
import enAuth from '../locales/en/auth.json'
import deAuth from '../locales/de/auth.json'
import csMarketing from '../locales/cs/marketing.json'
import enMarketing from '../locales/en/marketing.json'
import deMarketing from '../locales/de/marketing.json'
import csLegal from '../locales/cs/legal.json'
import enLegal from '../locales/en/legal.json'
import deLegal from '../locales/de/legal.json'
import csDashboard from '../locales/cs/dashboard.json'
import enDashboard from '../locales/en/dashboard.json'
import deDashboard from '../locales/de/dashboard.json'
import csAdmin from '../locales/cs/admin.json'
import enAdmin from '../locales/en/admin.json'
import deAdmin from '../locales/de/admin.json'
import csBank from '../locales/cs/bank.json'
import enBank from '../locales/en/bank.json'
import deBank from '../locales/de/bank.json'

export const SUPPORTED_LANGS = ['cs', 'en', 'de'] as const
export type Lang = typeof SUPPORTED_LANGS[number]
export const LANG_LABEL: Record<Lang, string> = { cs: 'Čeština', en: 'English', de: 'Deutsch' }

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { common: csCommon, shell: csShell, auth: csAuth, marketing: csMarketing, legal: csLegal, dashboard: csDashboard, admin: csAdmin, bank: csBank },
      en: { common: enCommon, shell: enShell, auth: enAuth, marketing: enMarketing, legal: enLegal, dashboard: enDashboard, admin: enAdmin, bank: enBank },
      de: { common: deCommon, shell: deShell, auth: deAuth, marketing: deMarketing, legal: deLegal, dashboard: deDashboard, admin: deAdmin, bank: deBank },
    },
    fallbackLng: 'cs',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'shell', 'auth', 'marketing', 'legal', 'dashboard', 'admin', 'bank'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tl-lang',
    },
    returnEmptyString: false,
  })

export default i18n
