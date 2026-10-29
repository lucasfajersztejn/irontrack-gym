import { useState } from 'react'
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
*/

const PROVIDERS = [
  { id: 'google',    label: 'Continuar con Google',    icon: GoogleIcon,    enabled: true },
  { id: 'github',    label: 'Continuar con GitHub',    icon: GitHubIcon,    enabled: false },
  { id: 'microsoft', label: 'Continuar con Microsoft', icon: MicrosoftIcon, enabled: false },
  { id: 'discord',   label: 'Continuar con Discord',   icon: DiscordIcon,   enabled: false },
]

function OAuthStack({ onError }) {
  const [busy, setBusy] = useState(null)

  async function handle(providerId) {
    setBusy(providerId)
    try {
      await signInWithProvider(providerId)
    } catch (err) {
      console.error('signIn.social falló:', err)
      onError?.('No se pudo iniciar sesión. Vuelve a intentarlo.')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <OAuthButton
          key={p.id}
          label={busy === p.id ? 'Redirigiendo…' : p.label}
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
  return (
    <button
      type="button"
      disabled
      className="w-full cursor-not-allowed text-center text-sm font-medium text-link opacity-60"
      title="Disponible en la fase 3"
    >
      Entrar como demo
    </button>
  )
}

export default function Landing() {
  const [error, setError] = useState(null)

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
            Registra tu entreno.
            <br />
            <span className="text-accent">Mide tu progreso.</span>
          </h1>
          <p className="text-[15px] leading-relaxed text-text-muted">
            Series, récords y rachas en una app hecha para el gimnasio, no para
            una hoja de cálculo.
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
            ¿Qué es IronTrack?
          </a>
        </header>

        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[1.3fr_1fr] items-center gap-16 px-10 py-12">
          {/* Hero */}
          <section className="space-y-8">
            <h1 className="font-display text-hero font-bold">
              Registra tu entreno.
              <br />
              <span className="text-accent">Mide tu progreso.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-text-muted">
              Series, récords y rachas en una app hecha para el gimnasio, no para
              una hoja de cálculo. Abre, entrena, guarda.
            </p>

            <div className="flex flex-wrap gap-2">
              {['Registro en segundos', 'Récords automáticos', 'Rachas que motivan'].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>

            <HeatmapPreview size="wide" />
          </section>

          {/* Login card */}
          <section className="rounded-container bg-surface p-8 shadow-glow-landing">
            <h2 className="font-display text-2xl font-semibold">
              Entra en IronTrack
            </h2>
            <p className="mt-2 mb-6 text-sm text-text-muted">
              Usa la cuenta que ya tienes. Sin contraseñas nuevas.
            </p>

            <OAuthStack onError={setError} />

            {error && (
              <p className="mt-4 text-center text-sm text-error">
                {error}
              </p>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-text-muted">o</span>
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
