import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { useExerciseProgress } from '../../lib/useExerciseProgress.js'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'
import ExerciseCurve from './ExerciseCurve.jsx'

/*
  Fila de ejercicio dentro de una sesión expandida en /stats/week.

  Para los ejercicios de `weight_reps` con id en catálogo, la fila es
  expandible: al abrirla pedimos GET /api/exercises/:id/progress y
  mostramos dos curvas (peso máx y 1RM estimado) con los puntos de todas
  las sesiones del usuario — la ventana de la semana solo decide desde
  qué fila se entra, no limita el rango de la curva.

  Para el resto de trackings (reps, time, distance_time) o si no hay
  exerciseId por una sesión muy antigua sin populate, mantenemos la
  estética actual: nombre + nº de series + pills de detalle, sin
  chevron ni expansión. La misma decisión que en SessionExerciseCard
  (línea viva solo para weight_reps) — quien no tiene 1RM no gana nada
  con un gráfico vacío.
*/
export default function ExerciseProgressRow({
  ex,
  aliases,
  aliasLang,
  formatDetail,
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const expandable = ex.tracking === 'weight_reps' && !!ex.exerciseId
  const { loading, error, points } = useExerciseProgress(ex.exerciseId, open)

  const name = resolveExerciseName(ex, aliases, aliasLang)

  return (
    <li className="rounded-card bg-surface-2">
      <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {expandable ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={
                open
                  ? t('weekStats.exerciseCurve.collapseAria', { name })
                  : t('weekStats.exerciseCurve.expandAria', { name })
              }
              className="press -mx-1 flex w-full items-center gap-2 rounded-card px-1 py-0.5 text-left transition-[filter,transform,color] hover:text-accent"
            >
              <ChevronRightIcon
                className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${
                  open ? 'rotate-90' : ''
                }`}
              />
              <p className="truncate text-sm font-medium text-text">{name}</p>
            </button>
          ) : (
            <p className="truncate text-sm font-medium text-text">{name}</p>
          )}
        </div>
        <p className="tabular shrink-0 text-xs text-text-muted">
          {t('training.stats.setsCount', { count: ex.sets.length })}
        </p>
      </div>

      {ex.sets.length > 0 && (
        <ul className="tabular flex flex-wrap gap-1.5 px-3 pb-2.5 text-[11px] text-text-muted">
          {ex.sets.map((s, j) => (
            <li
              key={j}
              className="rounded-pill border border-border bg-bg px-2 py-0.5"
            >
              {formatDetail(s, ex.tracking)}
            </li>
          ))}
        </ul>
      )}

      {expandable && open && (
        <div className="border-t border-border/60 px-3 py-3">
          {loading && (
            <p className="text-xs text-text-muted">
              {t('weekStats.exerciseCurve.loading')}
            </p>
          )}
          {error && !loading && (
            <p className="text-xs text-error">
              {t('weekStats.exerciseCurve.loadError')}
            </p>
          )}
          {!loading && !error && points && (
            // La curva pasa a ser componente standalone: aquí la fila
            // histórica siempre muestra todos los puntos (range="all"),
            // porque abrir una fila dentro de una semana es un "¿cómo
            // vengo?" de alcance completo. El filtrado por rango es
            // trabajo de SelectedWorkoutCard en Home.
            <ExerciseCurve points={points} range="all" />
          )}
        </div>
      )}
    </li>
  )
}
