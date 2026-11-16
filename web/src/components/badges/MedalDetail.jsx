// Modal with a medal's artwork, description, earned date and share action.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { TrophyIcon } from '../icons/NavIcons.jsx'
import { HEX_CLIP, localized } from '../../lib/badgeDisplay.js'
import { badgeArtUrl } from '../../lib/badgeArt.js'
import { shareBadge } from '../../lib/shareBadge.js'

export default function MedalDetail({ badge, lang, onClose }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const [opener] = useState(() => document.activeElement)
  const [shareState, setShareState] = useState('idle')

  const name = localized(badge.name, lang)
  const why = localized(badge.description, lang)
  const { unlocked, progress } = badge
  const artUrl = badgeArtUrl(badge)
  const earnedDate =
    unlocked && badge.unlockedAt
      ? format(new Date(badge.unlockedAt), 'PPP', {
          locale: lang === 'en' ? enUS : es,
        })
      : null

  useEffect(() => {
    closeRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [opener])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll('button:not([disabled])')
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
  }, [onClose])

  async function handleShare() {
    setShareState('busy')
    try {
      await shareBadge({
        slug: badge.slug,
        tier: badge.tier,
        name,
        why,
        earnedLabel: t('medals.detail.earnedOn', { date: earnedDate }),
      })
      setShareState('idle')
    } catch {
      setShareState('error')
    }
  }

  const motionProps = reduceMotion
    ? { initial: false }
    : {
        initial: { opacity: 0, y: 32 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] },
      }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="medal-detail-title"
    >
      <motion.div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        ref={panelRef}
        {...motionProps}
        className="card-liquid relative flex max-h-[90dvh] w-full flex-col items-center gap-5 overflow-y-auto rounded-t-container p-6 pb-8 md:max-w-sm md:rounded-container"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t('medals.detail.close')}
          className="press absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-control text-text-muted transition-[filter,transform,background-color] hover:bg-surface-2 hover:text-text"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {artUrl ? (
          <img src={artUrl} alt="" draggable={false} className="h-36 w-36" />
        ) : (
          <div
            className={`flex h-36 w-36 items-center justify-center ${
              unlocked ? 'bg-accent/20' : 'bg-surface-3'
            }`}
            style={{ clipPath: HEX_CLIP }}
          >
            <TrophyIcon
              className={`h-14 w-14 ${unlocked ? 'text-accent' : 'text-text-muted'}`}
            />
          </div>
        )}

        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            id="medal-detail-title"
            className="font-display text-2xl font-semibold tracking-tight text-text"
          >
            {name}
          </h2>
          {unlocked && earnedDate && (
            <p className="text-sm font-medium text-accent tabular-nums">
              {t('medals.detail.earnedOn', { date: earnedDate })}
            </p>
          )}
        </div>

        <section className="flex w-full flex-col gap-2 rounded-control bg-surface-2 p-4">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            {t('medals.detail.why')}
          </h3>
          <p className="text-sm leading-relaxed text-text">{why}</p>
        </section>

        {!unlocked && (
          <div className="flex w-full flex-col gap-2">
            <p className="text-sm text-text-muted">{t('medals.detail.locked')}</p>
            {progress?.current != null && (
              <div className="flex w-full flex-col items-center gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-text-muted"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted tabular-nums">
                  {t('medals.progress', {
                    current: progress.current,
                    target: progress.target,
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {unlocked && (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={shareState === 'busy'}
              className="press flex w-full items-center justify-center rounded-control bg-surface-3 px-4 py-3 text-sm font-semibold text-text transition-[filter,transform] hover:brightness-110 disabled:opacity-60"
            >
              {t('medals.detail.share')}
            </button>
            {shareState === 'error' && (
              <p role="alert" className="text-center text-sm text-error">
                {t('medals.detail.shareError')}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
