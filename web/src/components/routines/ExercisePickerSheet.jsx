import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchInput from '../catalog/SearchInput.jsx'
import FilterPills from '../catalog/FilterPills.jsx'
import ExerciseRow from '../catalog/ExerciseRow.jsx'
import CustomExerciseSheet from '../catalog/CustomExerciseSheet.jsx'
import { useCatalog } from '../../lib/useCatalog.js'

/*
  Hoja (bottom sheet en mobile, modal centrada en desktop) para elegir un
  ejercicio del catálogo y añadirlo a una rutina. Reusa el hook de catálogo
  y las piezas de UI del browser: search, pills, y la row densa.

  No filtramos los ejercicios ya añadidos: el usuario a veces repite el
  mismo ejercicio con tempo o orden distinto en la misma rutina — bloquearlo
  sería una decisión de negocio sin respaldo. En su lugar, mostramos un
  pequeño "ya en la rutina" en los que ya están y permitimos añadirlo igual.

  El click sobre una row dispara onPick y cierra la hoja desde fuera; esta
  pieza no decide la navegación.

  "+ Crear" vive en dos sitios: el header (siempre visible) y el empty state
  cuando una búsqueda no devuelve nada. El segundo cubre el flujo "no lo
  encuentro, lo creo con este nombre": pasamos el texto buscado como
  initialName para que llegue prefilled a la hoja.
*/
export default function ExercisePickerSheet({
  open,
  onClose,
  onPick,
  alreadyPickedIds = [],
}) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({
    search: '',
    bodyPart: null,
    equipment: null,
    muscle: null,
    mine: false,
  })
  const { loading, exercises, refetch } = useCatalog(filters)
  const alreadySet = new Set(alreadyPickedIds)
  const [createOpen, setCreateOpen] = useState(false)

  // Resetear filtros al cerrar para que la próxima apertura arranque limpia.
  useEffect(() => {
    if (!open) {
      setFilters({
        search: '',
        bodyPart: null,
        equipment: null,
        muscle: null,
        mine: false,
      })
      setCreateOpen(false)
    }
  }, [open])

  // Bloquear scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  function handleCreated(created) {
    // Refrescar el catálogo en segundo plano por si el usuario cancela la
    // auto-selección y busca el nuevo ejercicio a mano. onPick cierra el
    // picker completo desde fuera, así que no toca cerrar aquí.
    refetch()
    setCreateOpen(false)
    onPick(created)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal
      aria-label={t('routines.pickerTitle')}
    >
      <button
        type="button"
        aria-label={t('routines.closePicker')}
        onClick={onClose}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />
      <div className="card-liquid relative flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 rounded-container border border-border/50 p-4 md:max-h-[80vh] md:p-5">
        <header className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">
            {t('routines.pickerTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-2 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('customExercise.triggerShort')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
              aria-label={t('routines.closePicker')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <SearchInput
          value={filters.search}
          onChange={(search) => setFilters((f) => ({ ...f, search }))}
        />
        <FilterPills
          value={filters.bodyPart}
          onChange={(bodyPart) => setFilters((f) => ({ ...f, bodyPart }))}
        />

        <div className="scrollbar-hidden -mx-2 flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-text-muted">
              {t('catalog.loading')}
            </div>
          ) : exercises.length === 0 ? (
            <EmptyState
              searchTerm={filters.search}
              onCreate={() => setCreateOpen(true)}
            />
          ) : (
            exercises.map((ex) => {
              const picked = alreadySet.has(ex._id)
              return (
                <button
                  key={ex._id}
                  type="button"
                  onClick={() => onPick(ex)}
                  aria-pressed={picked}
                  aria-label={
                    picked
                      ? `${ex.name?.es ?? ex.name?.en} · ${t('routines.alreadyPicked')}`
                      : ex.name?.es ?? ex.name?.en
                  }
                  className={`relative block w-full rounded-container text-left transition-[filter] hover:brightness-[1.08] ${
                    picked ? 'ring-1 ring-accent/40' : ''
                  }`}
                >
                  <ExerciseRow exercise={ex} />
                  {picked && (
                    <span
                      aria-hidden
                      className="absolute left-10 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-bg shadow-[0_0_12px_-2px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      <CustomExerciseSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        initialName={filters.search}
      />
    </div>
  )
}

/*
  Empty state con doble intención: si el usuario estaba buscando algo, el CTA
  principal es "crear 'X'" con su término prellenado; si no, invita a crear
  uno sin asumir nombre. El mensaje secundario cambia también para no decir
  "prueba otros filtros" cuando acabamos de ofrecer crearlo.
*/
function EmptyState({ searchTerm, onCreate }) {
  const { t } = useTranslation()
  const trimmed = searchTerm?.trim() ?? ''
  const hasQuery = trimmed.length > 0
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="font-display text-sm font-semibold text-text">
        {hasQuery
          ? t('routines.pickerEmptyWithQuery', { query: trimmed })
          : t('catalog.emptyTitle')}
      </p>
      <p className="max-w-xs text-xs text-text-muted">
        {hasQuery
          ? t('routines.pickerEmptyWithQuerySub')
          : t('customExercise.emptyPickerHint')}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {hasQuery
          ? t('customExercise.triggerWithQuery', { query: trimmed })
          : t('customExercise.triggerBlank')}
      </button>
    </div>
  )
}
