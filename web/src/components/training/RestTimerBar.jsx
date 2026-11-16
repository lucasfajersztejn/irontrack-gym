// Rest timer bar driven by the session store, with manual adjust and stop controls.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  REST_DEFAULT_SEC,
  REST_STEP_SEC,
  useSessionStore,
} from '../../stores/sessionStore.js'

function format(seconds) {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function ClockIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export default function RestTimerBar({ restSec = REST_DEFAULT_SEC }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const restEndsAt = useSessionStore((s) => s.restEndsAt)
  const restTotalSec = useSessionStore((s) => s.restTotalSec)
  const startRest = useSessionStore((s) => s.startRest)
  const adjustRest = useSessionStore((s) => s.adjustRest)
  const stopRest = useSessionStore((s) => s.stopRest)

  const [, tick] = useState(0)
  useEffect(() => {
    if (!restEndsAt) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [restEndsAt])

  const running = Boolean(restEndsAt)
  const remaining = running ? Math.ceil((restEndsAt - Date.now()) / 1000) : 0
  const done = running && remaining <= 0

  const buzzedRef = useRef(false)
  useEffect(() => {
    if (!running) {
      buzzedRef.current = false
      return
    }
    if (!done || buzzedRef.current) return
    buzzedRef.current = true
    if (!reduce) navigator.vibrate?.([120, 60, 120])
    const id = setTimeout(stopRest, 4000)
    return () => clearTimeout(id)
  }, [done, running, reduce, stopRest])

  const ratio = restTotalSec > 0 ? Math.max(0, remaining / restTotalSec) : 0

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-0 md:left-56 md:px-8 md:pb-4"
      role="region"
      aria-label={t('training.rest.region')}
    >
      <div className="mx-auto max-w-md md:max-w-3xl">
        {running ? (
          <div
            className={`flex flex-col gap-2 rounded-container border bg-surface/95 p-3 shadow-lg backdrop-blur-md ${
              done ? 'border-accent/60' : 'border-border/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <ClockIcon
                className={`h-5 w-5 shrink-0 ${done ? 'text-accent' : 'text-text-muted'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  {done ? t('training.rest.done') : t('training.rest.label')}
                </p>
                <p
                  aria-live="off"
                  className={`tabular font-display text-2xl font-semibold leading-none ${
                    done ? 'text-accent' : 'text-text'
                  }`}
                >
                  {format(remaining)}
                </p>
              </div>

              {!done && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustRest(-REST_STEP_SEC)}
                    disabled={remaining <= REST_STEP_SEC}
                    aria-label={t('training.rest.minusAria', { n: REST_STEP_SEC })}
                    className="press rounded-control border border-border bg-bg px-3 py-2 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('training.rest.minusStep', { n: REST_STEP_SEC })}
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustRest(REST_STEP_SEC)}
                    aria-label={t('training.rest.plusAria', { n: REST_STEP_SEC })}
                    className="press rounded-control border border-border bg-bg px-3 py-2 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
                  >
                    {t('training.rest.plusStep', { n: REST_STEP_SEC })}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={stopRest}
                className="press shrink-0 rounded-control bg-accent px-3 py-2 text-xs font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08]"
              >
                {done ? t('training.rest.dismiss') : t('training.rest.stop')}
              </button>
            </div>

            <div className="h-1 overflow-hidden rounded-pill bg-bg" role="presentation">
              <div
                className={`h-full rounded-pill ${done ? 'bg-accent' : 'bg-accent/70'}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => startRest(restSec)}
            className="press flex w-full items-center justify-center gap-2 rounded-container border border-border/70 bg-surface/95 px-4 py-3 text-sm font-semibold text-text shadow-lg backdrop-blur-md transition-[filter,transform,background-color] hover:bg-surface-2"
          >
            <ClockIcon className="h-4 w-4 text-accent" />
            {t('training.rest.start')}
            <span className="tabular text-text-muted">{format(restSec)}</span>
          </button>
        )}
      </div>
    </div>
  )
}
