import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBadges } from '../lib/useBadges.js'
import { HEX_CLIP, localized } from '../lib/badgeDisplay.js'
import { TrophyIcon } from '../components/icons/NavIcons.jsx'
import MedalDetail from '../components/badges/MedalDetail.jsx'

/*
  Muro de insignias (Fase 3).

  Grid de hexágonos agrupados por categoría. Las desbloqueadas se encienden en
  verde; las bloqueadas quedan en grafito con la silueta visible y una barra de
  progreso — ver lo que falta es lo que motiva (spec §6.4).

  El verde respeta la regla ≤10% de DESIGN.md: solo las ganadas lo llevan, y en
  un muro recién estrenado serán pocas. No hay glow por medalla (Glow-Is-Earned):
  la jerarquía la da el color de relleno, no un halo repetido N veces.

  Cada medalla es un botón que abre el detalle (MedalDetail). Ahí es donde se
  comparte una ganada: el muro no tiene acciones por tarjeta, para que tocar
  una medalla siempre signifique lo mismo.

  El hexágono es clip-path, no una imagen: hasta que haya arte SVG por insignia
  (iconUrl), el propio hexágono + un icono genérico es el medallón.
*/

const CATEGORY_ORDER = ['constancia', 'volumen', 'hitos', 'variedad', 'rareza']

export default function Medals() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const { loading, error, badges, counts } = useBadges()
  // Guardamos la insignia abierta (no un índice): sobrevive a que la lista
  // se reordene y el detalle sigue apuntando a la misma medalla.
  const [selected, setSelected] = useState(null)

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
                  <BadgeTile
                    key={badge.slug}
                    badge={badge}
                    lang={lang}
                    t={t}
                    onSelect={setSelected}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <MedalDetail
          badge={selected}
          lang={lang}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function BadgeTile({ badge, lang, t, onSelect }) {
  const { unlocked, progress } = badge
  const name = localized(badge.name, lang)

  // El botón lleva el estado en el aria-label. Sin esto, un lector de pantalla
  // leería el nombre y luego sueltos "Conseguida" o "3/5", sin contexto.
  const stateLabel = unlocked
    ? t('medals.earned')
    : progress.current != null
      ? t('medals.progress', { current: progress.current, target: progress.target })
      : null
  const ariaLabel = stateLabel ? `${name}. ${stateLabel}` : name

  // Dentro de un <button> solo vale contenido de frase, así que todo son <span>
  // con display de bloque. Un <div> o <p> aquí es HTML inválido.
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(badge)}
        aria-label={ariaLabel}
        className="press flex w-full flex-col items-center gap-2 rounded-card text-center transition-transform"
      >
        <span
          // El hexágono. Desbloqueada: relleno de acento tenue + icono verde.
          // Bloqueada: superficie elevada (surface-3, un escalón por encima del
          // fondo para que el medallón se lea) + icono a plena opacidad muted, que
          // es la silueta. Antes era surface-2 + icono al 35%: casi invisible
          // sobre el fondo, así que el muro parecía mostrar solo las ganadas.
          className={`flex aspect-square w-full items-center justify-center ${
            unlocked ? 'bg-accent/20' : 'bg-surface-3'
          }`}
          style={{ clipPath: HEX_CLIP }}
        >
          <TrophyIcon
            className={`h-6 w-6 ${unlocked ? 'text-accent' : 'text-text-muted'}`}
          />
        </span>

        <span
          className={`block line-clamp-2 text-xs font-medium ${
            unlocked ? 'text-text' : 'text-text-muted'
          }`}
        >
          {name}
        </span>

        {unlocked ? (
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">
            {t('medals.earned')}
          </span>
        ) : (
          progress.current != null && (
            <span className="flex w-full flex-col items-center gap-1">
              {/* Pista sobre surface-2 (no bg) para que el carril se vea aunque
                  el progreso sea 0%. Relleno neutro, no verde: el verde señala
                  "ganada"; aquí es "lo que llevas", no un logro. */}
              <span className="block h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-text-muted"
                  style={{ width: `${progress.pct}%` }}
                />
              </span>
              <span className="block text-[10px] text-text-muted tabular-nums">
                {t('medals.progress', {
                  current: progress.current,
                  target: progress.target,
                })}
              </span>
            </span>
          )
        )}
      </button>
    </li>
  )
}
