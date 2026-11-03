import { useTranslation } from 'react-i18next'

/*
  Fallback de Suspense mientras llega el chunk de una ruta (code-splitting en
  App.jsx). Un spinner sobrio con el acento; el texto va en sr-only + role
  status para que un lector de pantalla anuncie la carga sin ruido visual.

  animate-spin es una animación, no una transición, así que prefers-reduced-
  motion del index.css no la toca: la neutralizamos aquí con motion-reduce.

  La altura es configurable: min-h-screen para una ruta a pantalla completa
  (Onboarding), y el valor por defecto rellena el área de contenido dentro del
  AppShell sin empujar la bottom-nav.
*/
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
