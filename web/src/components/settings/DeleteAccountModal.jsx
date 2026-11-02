import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Confirmación de borrado de cuenta.

  No reutiliza ConfirmModal a propósito. Ese modal sirve para acciones
  destructivas pero recuperables (borrar una sesión, una rutina), donde un
  botón rojo es fricción suficiente. Esto no se puede deshacer y no hay copia
  de seguridad, así que pide tres cosas que un "¿seguro?" no pide:

  1. **Decir qué se borra**, en una lista, no en una frase vaga. El usuario
     tiene que poder calcular lo que pierde antes de escribir nada.
  2. **Escribir el propio username.** Es el freno real: no se puede hacer
     por inercia ni con el móvil en el bolsillo. Hace de verificación humana
     donde no podemos mandar un email de confirmación (solo OAuth, sin
     dominio propio verificado — spec §5).
  3. **Un botón que no se puede pulsar** hasta que el nombre coincide.

  La comparación tolera el "@" y las mayúsculas: el username es siempre
  minúsculas en la base, y escribir "@lucas" es exactamente la intención que
  buscamos. Ser estricto con eso solo castiga a quien ya ha decidido.

  Cerrar (fuera, Escape, Cancelar) no borra nada, así que no se le pone
  fricción: la salida de un modal destructivo tiene que ser la vía fácil.

  No lleva prop `open`: quien lo abre lo monta y quien lo cierra lo
  desmonta. Así el campo de confirmación nace vacío por construcción, sin un
  efecto que lo limpie — y lo tecleado en un intento anterior no puede dejar
  el botón de borrar habilitado al volver a abrir.
*/
export default function DeleteAccountModal({
  username,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const panelRef = useRef(null)

  /*
    Al cerrar, el foco vuelve al botón que abrió el modal. Sin esto cae al
    <body> y quien navega con teclado tiene que recorrer la pantalla entera
    para volver a donde estaba.

    Quién era ese botón se captura en el PRIMER RENDER, no en un efecto:
    React aplica el `autoFocus` del input durante el commit, antes de que
    corra ningún efecto, así que para cuando se ejecuta un `useEffect` el
    elemento activo ya es el campo de confirmación y el modal acabaría
    devolviéndose el foco a sí mismo. Medido en el navegador: el foco se
    quedaba en el <body> al cerrar.

    El argumento de useRef se evalúa en cada render pero solo se usa el
    primero, que ocurre antes de tocar el DOM.
  */
  const openerRef = useRef(document.activeElement)
  const inputRef = useRef(null)

  /*
    Foco inicial en el campo de confirmación, puesto a mano en vez de con
    `autoFocus`. El atributo lo aplica React durante el commit y en pruebas
    en el navegador no siempre llegaba: el diálogo se abría con el foco
    todavía en el botón que lo había lanzado. Para un diálogo modal el foco
    de entrada no puede ser "casi siempre", así que se pide explícitamente.
  */
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(
    () => () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    },
    [],
  )

  /*
    Escape cierra (mientras no esté borrando: no queremos devolver al
    usuario a una pantalla normal con la petición todavía viva) y Tab se
    queda dentro del panel.

    El trap importa especialmente aquí: `aria-modal` le dice al lector de
    pantalla que lo de detrás no existe, y si el tabulador se escapa a la
    página de fondo el usuario acaba pulsando controles que su lector no
    está anunciando. Los focusables se consultan en cada Tab en vez de
    cachearse porque el botón de borrar cambia de disabled a habilitado a
    mitad de la interacción, al escribir el username.
  */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && !busy) {
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll(
        'input:not([disabled]), button:not([disabled])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  const typed = value.trim().replace(/^@/, '').toLowerCase()
  const matches = Boolean(username) && typed === username.toLowerCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      aria-labelledby="delete-account-title"
    >
      {/*
        El velo cierra al pulsar fuera, pero no es un <button> como en
        ConfirmModal: un botón a pantalla completa es una parada de tabulador
        que el lector anuncia antes del contenido del diálogo, y su función ya
        la cubren Escape y Cancelar. Como superficie de clic para ratón es
        correcto; para teclado y lector está deliberadamente fuera.
      */}
      <div
        aria-hidden
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        className="card-liquid relative flex w-full max-w-sm flex-col gap-3 rounded-container p-5"
      >
        <h2
          id="delete-account-title"
          className="font-display text-lg font-semibold tracking-tight text-text"
        >
          {t('settings.delete.modalTitle')}
        </h2>

        <p className="text-sm text-text-muted">{t('settings.delete.modalIntro')}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-text-muted">
          {['sessions', 'routines', 'exercises', 'preferences', 'profile'].map(
            (item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-error">
                  •
                </span>
                {t(`settings.delete.items.${item}`)}
              </li>
            ),
          )}
        </ul>
        <p className="text-sm font-medium text-error">
          {t('settings.delete.irreversible')}
        </p>

        <label className="mt-1 block">
          <span className="mb-2 block text-xs font-medium text-text-muted">
            {t('settings.delete.confirmLabel', { username })}
          </span>
          <input
            type="text"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            placeholder={username}
            className="w-full rounded-control border border-border bg-bg px-3 py-3 text-base text-text outline-none placeholder:text-text-muted focus:border-accent disabled:opacity-60"
          />
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="press rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2 disabled:opacity-60"
          >
            {t('settings.delete.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="press rounded-control bg-error px-4 py-2 text-sm font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('settings.delete.deleting') : t('settings.delete.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
