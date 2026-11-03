import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signInWithProvider } from '../lib/auth.js'
import Logo from '../components/icons/Logo.jsx'
import {
  GoogleIcon,
  GitHubIcon,
  MicrosoftIcon,
  DiscordIcon,
} from '../components/icons/ProviderIcons.jsx'
import OAuthButton from '../components/OAuthButton.jsx'
import HeatmapPreview from '../components/HeatmapPreview.jsx'
import LegalFooter from '../components/LegalFooter.jsx'

/*
  Landing / Login. Un único componente con las dos variantes:
  - mobile: columna, heatmap arriba, botones debajo
  - desktop (lg): dos columnas, hero a la izquierda, card de login a la
    derecha
  Mantener ambos en el mismo archivo evita duplicar textos y variantes de
  copy; los breakpoints `lg:` cambian el layout sin cambiar los datos.

  Solo Google está wired en el backend. Los otros tres proveedores se
  renderizan deshabilitados con el chip "Pronto" para no engañar al usuario
  (ver spec §5 y config/auth.js:39).

  El label del botón se compone con t('landing.continueWith') + el nombre de
  marca; guardamos solo el nombre (Google, GitHub…) en PROVIDERS porque es un
  nombre propio que no se traduce, y así el bundle lleva una sola plantilla
  en vez de cuatro frases casi idénticas por idioma.
*/

const PROVIDERS = [
  { id: 'google',    name: 'Google',    icon: GoogleIcon,    enabled: true },
  { id: 'github',    name: 'GitHub',    icon: GitHubIcon,    enabled: false },
  { id: 'microsoft', name: 'Microsoft', icon: MicrosoftIcon, enabled: false },
  { id: 'discord',   name: 'Discord',   icon: DiscordIcon,   enabled: false },
]

function OAuthStack({ onError }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(null)

  async function handle(providerId) {
    setBusy(providerId)
    try {
      await signInWithProvider(providerId)
    } catch (err) {
      console.error('signIn.social falló:', err)
      onError?.(t('landing.signInError'))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <OAuthButton
          key={p.id}
          label={
            busy === p.id
              ? t('landing.redirecting')
              : t('landing.continueWith', { provider: p.name })
          }
          icon={p.icon}
          disabled={!p.enabled || busy !== null}
          comingSoon={!p.enabled}
          onClick={p.enabled ? () => handle(p.id) : undefined}
        />
      ))}
    </div>
  )
}

function DemoLink() {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled
      className="w-full cursor-not-allowed text-center text-sm font-medium text-link opacity-60"
      title={t('landing.demoSoon')}
    >
      {t('landing.demo')}
    </button>
  )
}

export default function Landing() {
  const { t } = useTranslation()
  const [error, setError] = useState(null)

  // returnObjects: el bundle guarda los chips como un array, así el número de
  // chips lo decide la traducción y no el componente.
  const chips = t('landing.chips', { returnObjects: true })

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambiente espacial: dos gradientes radiales difusos. Los colores
          se derivan de los tokens --color-accent y --color-link vía
          color-mix, así que si la paleta cambia los gradientes la siguen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px circle at 15% 0%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 55%),' +
            'radial-gradient(700px circle at 100% 20%, color-mix(in srgb, var(--color-link) 7%, transparent), transparent 60%)',
        }}
      />

      {/* ----- MOBILE / default ----- */}
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 pt-8 pb-10 lg:hidden">
        <Logo />

        <div className="space-y-3">
          <h1 className="font-display text-hero font-bold">
            {t('landing.heroLine1')}
            <br />
            <span className="text-accent">{t('landing.heroLine2')}</span>
          </h1>
          <p className="text-[15px] leading-relaxed text-pretty text-text-muted">
            {t('landing.heroSubMobile')}
          </p>
        </div>

        <HeatmapPreview size="compact" />

        <OAuthStack onError={setError} />

        {error && (
          <p className="text-center text-sm text-error">{error}</p>
        )}

        <DemoLink />
        <LegalFooter />
      </div>

      {/* ----- DESKTOP (lg+) ----- */}
      <div className="relative hidden min-h-screen flex-col lg:flex">
        <header className="flex items-center justify-between px-10 pt-8">
          <Logo />
          <a
            href="#"
            className="-mx-2 rounded-card px-2 py-2 text-sm text-text-muted hover:text-text"
          >
            {t('landing.whatIs')}
          </a>
        </header>

        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[1.3fr_1fr] items-center gap-16 px-10 py-12">
          {/* Hero */}
          <section className="space-y-8">
            <h1 className="font-display text-hero font-bold">
              {t('landing.heroLine1')}
              <br />
              <span className="text-accent">{t('landing.heroLine2')}</span>
            </h1>
            {/* text-pretty redistribuye la última línea del párrafo para
                evitar que "guarda." quede sola (straggler). Chrome y Safari
                lo honran nativamente; en navegadores que lo ignoran el
                texto cae al modo "normal" sin romper nada. */}
            <p className="max-w-lg text-lg leading-relaxed text-pretty text-text-muted">
              {t('landing.heroSubDesktop')}
            </p>

            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text"
                >
                  {chip}
                </span>
              ))}
            </div>

            <HeatmapPreview size="wide" />
          </section>

          {/* Login card */}
          <section className="rounded-container bg-surface p-8 shadow-glow-landing">
            <h2 className="font-display text-2xl font-semibold">
              {t('landing.loginTitle')}
            </h2>
            <p className="mt-2 mb-6 text-sm text-text-muted">
              {t('landing.loginSub')}
            </p>

            <OAuthStack onError={setError} />

            {error && (
              <p className="mt-4 text-center text-sm text-error">
                {error}
              </p>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-text-muted">{t('landing.or')}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <DemoLink />

            <div className="mt-6">
              <LegalFooter />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
