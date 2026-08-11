import { useTranslation } from 'react-i18next'
import { SIcon } from './AppShell'

// Zámek pro moduly, které ještě nejsou spuštěné. Texty jsou v common:comingSoon,
// takže sedí ve všech třech jazycích. variant="page" = celá obrazovka,
// variant="card" = dlaždice do mřížky dashboardu.
export function ComingSoon({
  title,
  body,
  variant = 'page',
}: {
  title?: string
  body?: string
  variant?: 'page' | 'card'
}) {
  const { t } = useTranslation('common')
  const h = title || t('comingSoon.title')
  const p = body || t('comingSoon.body')

  if (variant === 'card') {
    return (
      <div className="cs-card an">
        <span className="ic"><SIcon n="lock" s={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{h}</b>
          <p>{p}</p>
        </div>
        <span className="s-badge purple">{t('comingSoon.badge')}</span>
      </div>
    )
  }

  return (
    <div className="cs-page an">
      <span className="ic"><SIcon n="lock" s={22} /></span>
      <h2>{h}</h2>
      <p>{p}</p>
      <span className="s-badge purple">{t('comingSoon.badge')}</span>
    </div>
  )
}

export default ComingSoon
