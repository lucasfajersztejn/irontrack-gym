// Settings route: preferences (rest timer, bar weight, language), sign-out and account deletion.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteAccount, signOut } from '../lib/auth.js'
import { useUser } from '../contexts/UserContext.jsx'
import { useSettings } from '../lib/useSettings.js'
import { REST_DEFAULT_SEC } from '../stores/sessionStore.js'
import Avatar from '../components/Avatar.jsx'
import { TrophyIcon, ChevronRightIcon } from '../components/icons/NavIcons.jsx'
import SettingsSection from '../components/settings/SettingsSection.jsx'
import SegmentedField from '../components/settings/SegmentedField.jsx'
import StepperField from '../components/settings/StepperField.jsx'
import DeleteAccountModal from '../components/settings/DeleteAccountModal.jsx'

const REST_PRESETS = [0, 60, 90, 120, 180]

const BAR_WEIGHT_STEP = 2.5
const PROVIDER_NAMES = {
  google: 'Google',
  github: 'GitHub',
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
  const { user, linkedProviders, clearUser } = useUser()
  const { settings, save, savingKey, savedKey, error } = useSettings()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  function sectionStatus(keys) {
    if (keys.includes(savingKey)) {
      return { tone: 'saving', label: t('settings.saving') }
    }
    if (keys.includes(savedKey)) {
      return { tone: 'saved', label: t('settings.saved') }
    }
    return null
  }

  function fieldError(key) {
    if (error?.key !== key) return null
    return t('settings.saveError')
  }

  const restSec = settings.restTimerSec ?? REST_DEFAULT_SEC
  const restOptions = (
    REST_PRESETS.includes(restSec) ? REST_PRESETS : [...REST_PRESETS, restSec].sort((a, b) => a - b)
  ).map((value) => ({ value, label: formatRest(value, t) }))

  async function handleSignOut() {
    await signOut()
    clearUser()
    navigate('/', { replace: true })
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      clearUser()
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

      <button
        type="button"
        onClick={() => navigate('/medals')}
        className="press card-liquid flex items-center justify-between gap-3 rounded-container p-4 text-left transition-[filter,transform] hover:brightness-110 md:p-5"
      >
        <div className="flex items-center gap-3">
          <TrophyIcon className="h-5 w-5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-text">
              {t('medals.title')}
            </p>
            <p className="truncate text-xs text-text-muted">
              {t('medals.settingsHint')}
            </p>
          </div>
        </div>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-muted" />
      </button>

      <SettingsSection
        title={t('settings.sections.training')}
        status={sectionStatus([
          'restTimerSec',
          'barInputMode',
          'defaultBarWeightKg',
          'weeklyGoal',
          'suggestProgression',
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

        <SegmentedField
          name="suggestProgression"
          label={t('settings.progression.label')}
          helper={t('settings.progression.helper')}
          value={settings.suggestProgression ?? true}
          options={[
            { value: true, label: t('settings.progression.on') },
            { value: false, label: t('settings.progression.off') },
          ]}
          onChange={(value) => save('suggestProgression', value)}
          error={fieldError('suggestProgression')}
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
