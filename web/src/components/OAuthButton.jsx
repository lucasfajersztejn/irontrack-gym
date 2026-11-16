// OAuth sign-in button.
import { useTranslation } from 'react-i18next'

export default function OAuthButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  comingSoon = false,
}) {
  const { t } = useTranslation()
  const ariaLabel = comingSoon
    ? t('landing.comingSoonAria', { label })
    : undefined

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'flex w-full items-center gap-3 rounded-[14px] bg-surface-2 px-4 py-3 text-left transition',
        'border border-transparent',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:-translate-y-px hover:border-border hover:bg-surface-3 active:scale-[0.99]',
      ].join(' ')}
    >
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-bg">
        <Icon />
      </span>
      <span className="flex-1 text-[15px] font-medium text-text">{label}</span>
      {comingSoon && (
        <span
          aria-hidden="true"
          className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted"
        >
          {t('landing.comingSoon')}
        </span>
      )}
    </button>
  )
}
