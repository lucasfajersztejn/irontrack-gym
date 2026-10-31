import { useMemo } from 'react'
import Model from 'react-body-highlighter'
import { useTranslation } from 'react-i18next'
import { toLibraryMuscles } from '../../lib/muscleMap.js'

/*
  Visualización de los músculos trabajados en la sesión actual. Dos vistas
  (frente y espalda) una al lado de la otra; comparten el mismo set de
  músculos y por tanto la misma iluminación.

  Decisiones:
  - La librería (`react-body-highlighter`) usa SVG sin fondo: lo encajamos en
    la paleta oscura sin añadir caja. El `bodyColor` es nuestro `text-muted`
    para que la silueta se lea discreta sobre el `bg`; los músculos activos
    van en el token `error` (rojo) a petición del usuario — es el único
    sitio donde el rojo aparece como "color de estado positivo", así que el
    coste simbólico es bajo (el error en formularios usa el mismo rojo pero
    como texto, no como fill de una figura humana).
  - Un solo elemento `data` con todos los músculos: el highlight no distingue
    entre primario y secundario todavía. Lo diferenciaremos cuando añadamos
    "intensidad por grupo" en la vista de analítica (Fase 2).
  - `svgStyle` fuerza background transparente por si el navegador aplica un
    default (algunos lo hacen a elementos SVG top-level sin fill).
*/
export default function TrainedMusclesMap({ muscles }) {
  const { t } = useTranslation()

  const data = useMemo(() => {
    const libMuscles = toLibraryMuscles(muscles)
    if (libMuscles.length === 0) return []
    return [{ name: 'session', muscles: libMuscles }]
  }, [muscles])

  if (data.length === 0) {
    return (
      <p className="text-center text-xs text-text-muted">
        {t('training.musclesEmpty')}
      </p>
    )
  }

  const sharedProps = {
    data,
    bodyColor: 'var(--color-text-muted)',
    highlightedColors: ['var(--color-error)'],
    style: { width: '100%', maxWidth: '180px' },
    svgStyle: { background: 'transparent' },
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-center font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
        {t('training.musclesTitle')}
      </h3>
      <div className="flex items-start justify-center gap-6">
        <figure className="flex flex-col items-center gap-1">
          <Model {...sharedProps} type="anterior" />
          <figcaption className="text-[10px] uppercase tracking-wider text-text-muted">
            {t('training.musclesFront')}
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-1">
          <Model {...sharedProps} type="posterior" />
          <figcaption className="text-[10px] uppercase tracking-wider text-text-muted">
            {t('training.musclesBack')}
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
