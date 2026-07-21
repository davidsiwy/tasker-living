// Jazyk je volba jednotlivého člověka, ne domu — výbor může číst česky a
// mezinárodní vlastník anglicky, současně, nad stejnými daty. Přepnutí je
// okamžité (i18next), uložení na účet jde na pozadí a nikoho neblokuje.
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, LANG_LABEL } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import { api } from '../lib/api'

export function LanguageSwitcher({ variant = 'pills', className = '' }: { variant?: 'pills' | 'select'; className?: string }) {
  const { i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'cs').slice(0, 2) as Lang

  function pick(lang: Lang) {
    if (lang === current) return
    i18n.changeLanguage(lang)
    api.setMyLanguage(lang).catch(() => { /* uloží se příště, přepnutí v UI proběhlo hned */ })
  }

  if (variant === 'select') {
    return (
      <select aria-label="Language" value={current} onChange={(e) => pick(e.target.value as Lang)} className={('lang-select ' + className).trim()}>
        {SUPPORTED_LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
      </select>
    )
  }
  return (
    <div className={('lang-pills ' + className).trim()} role="group" aria-label="Language">
      {SUPPORTED_LANGS.map((l) => (
        <button key={l} className={'lang-pill' + (l === current ? ' on' : '')} onClick={() => pick(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
