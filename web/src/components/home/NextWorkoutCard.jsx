import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { useRoutine } from '../../lib/useRoutine.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { routineMuscles } from '../../lib/exerciseMuscles.js'
import MuscleChips from '../MuscleChips.jsx'

/*
  "Próximo entreno" en Home.

  Decisión principal: la rotación la decide el SERVIDOR (orden manual de
  rutinas + última sesión). El usuario puede desviarse para esta sesión
  cambiando el <select>, y la elección se guarda en sessionStore como
  `selectedRoutineId` para que el FAB del navbar lo lea. Al refrescar la
  página la selección se reinicia a la sugerencia — es deliberado: la
  rotación real vive en el servidor, no en localStorage.

  Carga en dos tiempos:
    1) `routines` llega del hook de Home (summary, sin ejercicios).
    2) El detalle del routine seleccionado llega en un segundo fetch
       (useRoutine), que trae `exercises` poblado con muscle + secondaryMuscles.
       Con eso pintamos la lista y el mini mapa.

  Estados:
    - Sin rutinas → CTA minimalista "Crea una rutina para empezar".
    - Con rutinas y detalle cargando → skeleton.
    - Con rutinas y detalle cargado → selector + ejercicios + mapa.
    - Sesión activa → aviso discreto arriba ("Tienes una sesión en marcha"),
      el FAB reconoce el 409 y la retoma.

  Sin botón Play en la card: la acción vive en el FAB central y en el
  botón Empezar del sidebar, ambos atados al mismo `selectedRoutineId`.
  Dos entradas al mismo flujo desde la misma vista confundirían.
*/

const MAX_PREVIEW = 5

function Skeleton() {
  return (
    <div className="card-liquid flex flex-col gap-4 rounded-container p-4 md:p-5">
      <div className="h-4 w-32 animate-pulse rounded-full bg-surface-2" />
      <div className="h-8 w-48 animate-pulse rounded-card bg-surface-2" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-surface-2" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-pill bg-surface-2" />
        <div className="h-5 w-20 animate-pulse rounded-pill bg-surface-2" />
        <div className="h-5 w-14 animate-pulse rounded-pill bg-surface-2" />
      </div>
    </div>
  )
}

export default function NextWorkoutCard({
  routines,
  suggestedRoutine,
  activeSession,
}) {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'

  const selectedRoutineId = useSessionStore((s) => s.selectedRoutineId)
  const setSelectedRoutineId = useSessionStore((s) => s.setSelectedRoutineId)

  // Sincroniza la selección con la sugerencia cuando cambia (p.ej. tras
  // terminar una sesión, "next" se mueve a la siguiente). Si el usuario ya
  // había elegido otra rutina a mano para esta vista y sigue existiendo
  // en la lista, respetamos su elección.
  useEffect(() => {
    if (!routines?.length) return
    const stillValid = routines.some(
      (r) => String(r._id) === String(selectedRoutineId),
    )
    if (!stillValid && suggestedRoutine) {
      setSelectedRoutineId(suggestedRoutine._id)
    }
  }, [routines, suggestedRoutine, selectedRoutineId, setSelectedRoutineId])

  const effectiveId = selectedRoutineId ?? suggestedRoutine?._id ?? null
  const { routine, loading } = useRoutine(effectiveId)

  const muscles = useMemo(
    () => (routine ? routineMuscles(routine.exercises ?? []) : { primary: [], secondary: [] }),
    [routine],
  )

  if (!routines?.length) {
    return (
      <div className="card-liquid flex flex-col gap-2 rounded-container p-5">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.nextWorkout')}
        </h2>
        <p className="text-sm text-text-muted">
          {t('home.nextWorkoutEmpty')}
        </p>
      </div>
    )
  }

  if (loading && !routine) return <Skeleton />

  const preview = (routine?.exercises ?? []).slice(0, MAX_PREVIEW)
  const overflow = (routine?.exercises?.length ?? 0) - preview.length

  return (
    <section className="card-liquid flex flex-col gap-4 rounded-container p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.nextWorkout')}
        </h2>

        {/*
          Nativo on purpose: en mobile el OS pinta un picker gigante
          táctil; en desktop se abre un dropdown accesible gratis. Un
          custom select nos obligaría a rehacer esa ergonomía a mano.
        */}
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <span className="sr-only">{t('home.pickRoutine')}</span>
          <select
            value={effectiveId ?? ''}
            onChange={(e) => setSelectedRoutineId(e.target.value || null)}
            className="rounded-control border border-border bg-surface px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-2 focus-visible:outline-none"
          >
            {routines.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {activeSession && (
        <p className="rounded-card bg-surface-2 px-3 py-2 text-xs text-text-muted">
          {t('home.activeSessionHint', {
            routine: activeSession.routineName ?? '',
          })}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="truncate font-display text-xl font-semibold tracking-tight text-text md:text-2xl">
            {routine?.name ?? '—'}
          </h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-text">
            {preview.map((e, idx) => (
              <li key={idx} className="flex items-baseline gap-2">
                <span className="font-display text-xs tabular-nums text-text-muted">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate">
                  {resolveExerciseName(e.exercise, user?.exerciseAliases ?? null, lang)}
                </span>
                <span className="ml-auto shrink-0 text-xs text-text-muted tabular-nums">
                  {e.targetSets ?? 3} ×{' '}
                  {e.targetReps ?? e.targetDurationSec ?? '—'}
                </span>
              </li>
            ))}
            {overflow > 0 && (
              <li className="pt-1 text-xs text-text-muted">
                {t('home.plusMoreExercises', { count: overflow })}
              </li>
            )}
          </ul>
        </div>

        {/*
          Chips en vez de silueta. El usuario quiere lectura tipográfica
          — primarios con acento, secundarios con tag "sec." gris —
          en lugar de la imagen anatómica que gastaba bastante alto.
          MuscleChips es el mismo componente que usan la vista detalle
          de rutina y la sesión expandida en WeekDashboard, así el
          lenguaje visual queda consistente entre pantallas.
        */}
        <MuscleChips
          primary={muscles.primary}
          secondary={muscles.secondary}
        />
      </div>
    </section>
  )
}
