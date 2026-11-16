// Loading placeholder shown while a lazy route loads.

import { useTranslation } from 'react-i18next'

export default function RouteFallback({ className = 'min-h-[50vh]' }) {
  const { t } = useTranslation()
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
