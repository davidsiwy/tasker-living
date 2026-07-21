// Jazyk je volba jednotlivého člověka, ne domu — výbor může číst česky a
// mezinárodní vlastník anglicky, současně, nad stejnými daty. Přepnutí je
// okamžité (i18next), uložení na účet jde na pozadí a nikoho neblokuje.
//
// variant 'select': nativní <select>. compact=true ukazuje jen kód (CS/EN/DE)
// jako text volby i uzavřeného stavu — vždy se vejde, žádné oříznutí na
// "Č…", ale pořád jasné, co znamená. compact=false (Nastavení, kde je místa
// dost) ukazuje celé jméno jazyka.
// variant 'pills': tři samostatná tlačítka vedle sebe, širší než compact select.
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, LANG_LABEL } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import { api } from '../lib/api'

export function LanguageSwitcher({ variant = 'pills', compact = false, className = '' }: { variant?: 'pills' | 'select'; compact?: boolean; className?: string }) {
  const { i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'cs').slice(0, 2) as Lang

  function pick(lang: Lang) {
    if (lang === current) return
    i18n.changeLanguage(lang)
    api.setMyLanguage(lang).catch(() => { /* uloží se příště, přepnutí v UI proběhlo hned */ })
  }

  if (variant === 'select') {
    return (
      <select aria-label={`Language: ${LANG_LABEL[current]}`} value={current} onChange={(e) => pick(e.target.value as Lang)}
        className={('lang-select' + (compact ? ' compact' : '') + ' ' + className).trim()}>
        {SUPPORTED_LANGS.map((l) => <option key={l} value={l}>{compact ? l.toUpperCase() : LANG_LABEL[l]}</option>)}
      </select>
    )
  }
  return (
    <div className={('lang-pills ' + className).trim()} role="group" aria-label="Language">
      {SUPPORTED_LANGS.map((l) => (
        <button key={l} className={'lang-pill' + (l === current ? ' on' : '')} onClick={() => pick(l)} title={LANG_LABEL[l]}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
