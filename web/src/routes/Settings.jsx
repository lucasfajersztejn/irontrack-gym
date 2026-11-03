import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteAccount, signOut } from '../lib/auth.js'
import { useUser } from '../contexts/UserContext.jsx'
import { useSettings } from '../lib/useSettings.js'
import { REST_DEFAULT_SEC } from '../stores/sessionStore.js'
import Avatar from '../components/Avatar.jsx'
import SettingsSection from '../components/settings/SettingsSection.jsx'
import SegmentedField from '../components/settings/SegmentedField.jsx'
import StepperField from '../components/settings/StepperField.jsx'
import DeleteAccountModal from '../components/settings/DeleteAccountModal.jsx'

/*
  Ajustes.

  Dos decisiones de forma que marcan toda la pantalla:

  - **Nada de sub-pantallas.** Cinco ajustes caben en una columna, así que
    cada control se manipula donde se lee. Una lista de filas con chevron
    que llevan a una pantalla con una sola opción es el patrón por defecto de
    los ajustes de móvil, y aquí solo añadiría dos toques por cambio.

  - **Agrupados por momento de uso, no por tipo de dato**: lo que cambia cómo
    entrenas, lo que cambia la app, y la cuenta. Un ajuste se busca por para
    qué sirve, no por si es un número o una lista.

  Esta pantalla no tiene acción primaria (no hay "Guardar"), así que tampoco
  lleva glow verde: DESIGN.md reserva el halo al elemento que lleva la acción
  principal de la vista, y aquí no hay ninguno. El verde solo aparece en la
  opción seleccionada de cada control y en el "Guardado".

  IronTrack es solo métrica: kg y km, sin toggle de unidades (ver spec §1).
  Por eso no hay fila "Unidades" aquí ni capa de conversión en la UI.
*/

// Presets del descanso. 0 = sin cronómetro: la barra no se monta durante la
// sesión (ver SessionLiveView) y el usuario usa el reloj de su móvil.
const REST_PRESETS = [0, 60, 90, 120, 180]

const BAR_WEIGHT_STEP = 2.5
const PROVIDER_NAMES = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
  discord: 'Discord',
}

function formatRest(seconds, t) {
  if (!seconds) return t('settings.rest.off')
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Settings() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, linkedProviders, refetch } = useUser()
  const { settings, save, savingKey, savedKey, error } = useSettings()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Un estado por grupo: cuál es la clave que se está guardando o se acaba
  // de guardar. Las claves de cada grupo se listan aquí para no tener que
  // pasar el estado campo por campo.
  function sectionStatus(keys) {
    if (keys.includes(savingKey)) {
      return { tone: 'saving', label: t('settings.saving') }
    }
    if (keys.includes(savedKey)) {
      return { tone: 'saved', label: t('settings.saved') }
    }
    return null
  }

  /*
    El mensaje que se muestra es el nuestro traducido, no el del servidor.
    La API responde siempre en español y con texto de validación ("Payload
    inválido"), que ni se traduce ni le dice al usuario qué hacer. Aquí los
    únicos errores posibles son "no hay red" o "la sesión caducó", y para
    los dos la acción es la misma: volver a intentarlo.
  */
  function fieldError(key) {
    if (error?.key !== key) return null
    return t('settings.saveError')
  }

  // Mismo fallback que usa la barra de descanso mientras carga el usuario,
  // importado en vez de reescrito: tres copias del número 120 (modelo,
  // store, pantalla) son tres sitios donde se puede desincronizar.
  const restSec = settings.restTimerSec ?? REST_DEFAULT_SEC
  const restOptions = (
    REST_PRESETS.includes(restSec) ? REST_PRESETS : [...REST_PRESETS, restSec].sort((a, b) => a - b)
  ).map((value) => ({ value, label: formatRest(value, t) }))

  async function handleSignOut() {
    await signOut()
    await refetch()
    navigate('/', { replace: true })
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      // La cookie ya está borrada por el servidor: el refetch devuelve 401 y
      // deja `user` en null, que es lo que ProtectedRoute necesita ver para
      // no intentar repintar una pantalla de usuario sin usuario.
      await refetch()
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(err.message ?? t('settings.delete.error'))
      setDeleting(false)
    }
  }

  const providerLabel = linkedProviders
    .map((id) => PROVIDER_NAMES[id] ?? id)
    .join(', ')

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 md:gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{t('settings.intro')}</p>
      </header>

      <section className="card-liquid flex items-center gap-4 rounded-container p-4 md:p-5">
        <Avatar user={user} className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-text">
            @{user?.username ?? '—'}
          </p>
          <p className="truncate text-sm text-text-muted">{user?.email}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {providerLabel
              ? t('settings.account.provider', { provider: providerLabel })
              : t('settings.account.providerFallback')}
          </p>
        </div>
      </section>

      <SettingsSection
        title={t('settings.sections.training')}
        status={sectionStatus([
          'restTimerSec',
          'barInputMode',
          'defaultBarWeightKg',
          'weeklyGoal',
        ])}
      >
        <SegmentedField
          name="restTimerSec"
          label={t('settings.rest.label')}
          helper={t('settings.rest.helper')}
          value={restSec}
          options={restOptions}
          onChange={(value) => save('restTimerSec', value)}
          error={fieldError('restTimerSec')}
        />

        <SegmentedField
          name="barInputMode"
          label={t('settings.barInput.label')}
          helper={t('settings.barInput.helper')}
          value={settings.barInputMode ?? 'plates'}
          options={[
            { value: 'plates', label: t('settings.barInput.plates') },
            { value: 'total', label: t('settings.barInput.total') },
          ]}
          onChange={(value) => save('barInputMode', value)}
          error={fieldError('barInputMode')}
        />

        <StepperField
          label={t('settings.barWeight.label')}
          helper={t('settings.barWeight.helper')}
          value={settings.defaultBarWeightKg ?? 20}
          min={0}
          max={50}
          step={BAR_WEIGHT_STEP}
          suffix="kg"
          decLabel={t('settings.barWeight.dec', { n: BAR_WEIGHT_STEP })}
          incLabel={t('settings.barWeight.inc', { n: BAR_WEIGHT_STEP })}
          onChange={(value) => save('defaultBarWeightKg', value)}
          error={fieldError('defaultBarWeightKg')}
        />

        <StepperField
          label={t('settings.weeklyGoal.label')}
          helper={t('settings.weeklyGoal.helper')}
          value={settings.weeklyGoal ?? 4}
          min={1}
          max={14}
          step={1}
          decLabel={t('settings.weeklyGoal.dec')}
          incLabel={t('settings.weeklyGoal.inc')}
          onChange={(value) => save('weeklyGoal', value)}
          error={fieldError('weeklyGoal')}
        />
      </SettingsSection>

      <SettingsSection
        title={t('settings.sections.app')}
        status={sectionStatus(['locale'])}
      >
        <SegmentedField
          name="locale"
          label={t('settings.locale.label')}
          helper={t('settings.locale.helper')}
          value={settings.locale ?? 'es'}
          options={[
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(value) => save('locale', value)}
          error={fieldError('locale')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sections.account')}>
        <div className="flex items-center justify-between gap-4 p-4 md:p-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">
              {t('settings.account.signOut')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {t('settings.account.signOutHelper')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="press shrink-0 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
          >
            {t('settings.account.signOut')}
          </button>
        </div>

        {/*
          Borrar cuenta comparte card con cerrar sesión: las dos son "salir",
          y separar la segunda en una zona propia la convierte en el elemento
          más llamativo de la pantalla. La jerarquía la marca el color del
          texto del botón, no una caja aparte con borde rojo — DESIGN.md deja
          el rojo como texto, nunca como borde ni fondo en reposo.
        */}
        <div className="flex items-center justify-between gap-4 p-4 md:p-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">
              {t('settings.delete.title')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {t('settings.delete.body')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null)
              setDeleteOpen(true)
            }}
            className="press shrink-0 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-error transition-[filter,transform,background-color,border-color] hover:border-error hover:bg-surface-2"
          >
            {t('settings.delete.cta')}
          </button>
        </div>
      </SettingsSection>

      {deleteOpen && (
        <DeleteAccountModal
          username={user?.username}
          busy={deleting}
          error={deleteError}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
