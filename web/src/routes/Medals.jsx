import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useBadges } from '../lib/useBadges.js'
import { TrophyIcon } from '../components/icons/NavIcons.jsx'

/*
  Muro de insignias (Fase 3).

  Grid de hexágonos agrupados por categoría. Las desbloqueadas se encienden en
  verde; las bloqueadas quedan en grafito con la silueta visible y una barra de
  progreso — ver lo que falta es lo que motiva (spec §6.4).

  El verde respeta la regla ≤10% de DESIGN.md: solo las ganadas lo llevan, y en
  un muro recién estrenado serán pocas. No hay glow por medalla (Glow-Is-Earned):
  la jerarquía la da el color de relleno, no un halo repetido N veces.

  El hexágono es clip-path, no una imagen: hasta que haya arte SVG por insignia
  (iconUrl), el propio hexágono + un icono genérico es el medallón.
*/

// Flat-top hexagon. aspect-square + este recorte da el medallón.
const HEX_CLIP =
  'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

const CATEGORY_ORDER = ['constancia', 'volumen', 'hitos', 'variedad', 'rareza']

function localized(field, lang) {
  if (!field) return ''
  return field[lang] ?? field.es ?? field.en ?? ''
}

export default function Medals() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const { loading, error, badges, counts } = useBadges()

  // Agrupa por categoría respetando el orden canónico. El backend ya ordena,
  // pero agrupamos aquí para no acoplar la vista a ese orden.
  const groups = useMemo(() => {
    const byCat = new Map()
    for (const b of badges) {
      if (!byCat.has(b.category)) byCat.set(b.category, [])
      byCat.get(b.category).push(b)
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c),
    }))
  }, [badges])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
          {t('medals.title')}
        </h1>
        {!loading && !error && counts.total > 0 && (
          <p className="mt-1 text-sm text-text-muted tabular-nums">
            {t('medals.counts', { unlocked: counts.unlocked, total: counts.total })}
          </p>
        )}
      </header>

      {loading ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square w-full animate-pulse bg-surface-2"
              style={{ clipPath: HEX_CLIP }}
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-error">{t('medals.error')}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-text-muted">{t('medals.empty')}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ category, items }) => (
            <section key={category} className="flex flex-col gap-4">
              <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                {t(`medals.category.${category}`)}
              </h2>
              <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
                {items.map((badge) => (
                  <BadgeTile key={badge.slug} badge={badge} lang={lang} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function BadgeTile({ badge, lang, t }) {
  const { unlocked, progress } = badge
  const name = localized(badge.name, lang)
  const description = localized(badge.description, lang)

  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <div
        // El hexágono. Desbloqueada: relleno de acento tenue + icono verde.
        // Bloqueada: grafito elevado + icono muy apagado = la silueta visible.
        className={`flex aspect-square w-full items-center justify-center ${
          unlocked ? 'bg-accent/20' : 'bg-surface-2'
        }`}
        style={{ clipPath: HEX_CLIP }}
        title={description}
      >
        <TrophyIcon
          className={`h-6 w-6 ${unlocked ? 'text-accent' : 'text-text-muted/35'}`}
        />
      </div>

      <p
        className={`line-clamp-2 text-xs font-medium ${
          unlocked ? 'text-text' : 'text-text-muted'
        }`}
      >
        {name}
      </p>

      {unlocked ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
          {t('medals.earned')}
        </p>
      ) : (
        progress.current != null && (
          <div className="flex w-full flex-col items-center gap-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-accent/60"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted tabular-nums">
              {t('medals.progress', {
                current: progress.current,
                target: progress.target,
              })}
            </p>
          </div>
        )
      )}
    </li>
  )
}
