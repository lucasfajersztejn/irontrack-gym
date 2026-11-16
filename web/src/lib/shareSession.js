// Renders a session share card to a PNG.

import { breakdownForSession } from './useWeeklyStats.js'
import {
  FONT_DISPLAY,
  FONT_SANS,
  ensureFonts,
  wrapText,
  truncateText,
  drawCenteredLines,
  canvasToPngBlob,
  deliverPng,
} from './shareCanvas.js'

const WIDTH = 1080
const HEIGHT = 1920

const COLORS = {
  bg: '#0d1117',
  surface: '#161b22',
  text: '#c9d1d9',
  muted: '#8b949e',
  accent: '#39d353',
}

const TOP_EXERCISES = 3

// Summarize a session for the share card.
export function summarizeSession(detail) {
  const breakdown = breakdownForSession(detail)
  let volumeKg = 0
  let sets = 0
  let reps = 0

  const exercises = breakdown.exercises.map((ex) => {
    let exerciseVolume = 0
    for (const s of ex.sets) {
      sets += 1
      if (s.reps != null) reps += s.reps
      if (ex.tracking === 'weight_reps' && s.weightKg != null && s.reps != null) {
        exerciseVolume += s.weightKg * s.reps
      }
    }
    volumeKg += exerciseVolume
    return { name: ex.name, sets: ex.sets.length, volumeKg: exerciseVolume }
  })

  const topExercises = exercises
    .slice()
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets)
    .slice(0, TOP_EXERCISES)

  let durationSec = null
  if (detail?.startedAt && detail?.endedAt) {
    const ms = new Date(detail.endedAt).getTime() - new Date(detail.startedAt).getTime()
    durationSec = Math.max(0, Math.round(ms / 1000))
  }

  return {
    durationSec,
    volumeKg: Math.round(volumeKg),
    sets,
    reps,
    topExercises,
  }
}

function formatDuration(seconds, t) {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return t('home.shareCard.hoursMinutes', { h, m })
  return t('home.shareCard.minutes', { m })
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Render the session card and return a PNG Blob.
export async function renderSessionCard({ detail, summary, t, locale }) {
  await ensureFonts()

  const stats = summarizeSession(detail)
  const title = summary?.routineName || detail.routineName || t('home.shareCard.untitled')
  const dateLabel = new Date(detail.startedAt).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const volumeText = new Intl.NumberFormat(locale).format(stats.volumeKg)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  const cx = WIDTH / 2

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const glow = ctx.createRadialGradient(cx, 560, 0, cx, 560, 720)
  glow.addColorStop(0, 'rgba(57, 211, 83, 0.22)')
  glow.addColorStop(1, 'rgba(57, 211, 83, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  ctx.fillStyle = COLORS.muted
  ctx.font = `400 44px ${FONT_SANS}`
  let y = drawCenteredLines(ctx, [dateLabel], cx, 300, 56)

  ctx.fillStyle = COLORS.text
  ctx.font = `600 96px ${FONT_DISPLAY}`
  let titleLines = wrapText(ctx, title, 920)
  if (titleLines.length > 2) {
    titleLines = [titleLines[0], truncateText(ctx, titleLines.slice(1).join(' '), 920)]
  }
  y = drawCenteredLines(ctx, titleLines, cx, y + 40, 112)

  ctx.fillStyle = COLORS.accent
  ctx.font = `600 36px ${FONT_DISPLAY}`
  drawCenteredLines(ctx, [t('home.shareCard.volume').toUpperCase()], cx, y + 80, 44)

  const numberFont = `600 240px ${FONT_DISPLAY}`
  const unitFont = `600 96px ${FONT_DISPLAY}`
  ctx.font = numberFont
  const numberWidth = ctx.measureText(volumeText).width
  ctx.font = unitFont
  const unitWidth = ctx.measureText(' kg').width
  const heroX = cx - (numberWidth + unitWidth) / 2
  const heroY = y + 140
  ctx.textAlign = 'left'
  ctx.font = numberFont
  ctx.fillStyle = COLORS.text
  ctx.fillText(volumeText, heroX, heroY)
  ctx.font = unitFont
  ctx.fillStyle = COLORS.muted
  ctx.fillText(' kg', heroX + numberWidth, heroY + 110)

  const panelX = 120
  const panelW = WIDTH - panelX * 2
  const panelY = heroY + 236
  const rowH = 100
  const panelH = rowH * 3 + 24
  roundedRectPath(ctx, panelX, panelY, panelW, panelH, 44)
  ctx.fillStyle = COLORS.surface
  ctx.fill()

  const rows = [
    [t('home.shareCard.duration'), formatDuration(stats.durationSec, t)],
    [t('home.shareCard.sets'), String(stats.sets)],
    [t('home.shareCard.reps'), String(stats.reps)],
  ]
  ctx.textBaseline = 'middle'
  rows.forEach(([label, value], i) => {
    const rowCenter = panelY + 12 + rowH * i + rowH / 2
    ctx.textAlign = 'left'
    ctx.font = `400 42px ${FONT_SANS}`
    ctx.fillStyle = COLORS.muted
    ctx.fillText(label, panelX + 48, rowCenter)
    ctx.textAlign = 'right'
    ctx.font = `600 56px ${FONT_DISPLAY}`
    ctx.fillStyle = COLORS.text
    ctx.fillText(value, panelX + panelW - 48, rowCenter)
  })

  let listY = panelY + panelH + 74
  if (stats.topExercises.length > 0) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = `400 40px ${FONT_SANS}`
    ctx.fillStyle = COLORS.muted
    ctx.fillText(t('home.shareCard.topExercises'), panelX, listY)
    listY += 72

    stats.topExercises.forEach((ex, i) => {
      const rowCenter = listY + i * 76 + 30
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.font = `400 46px ${FONT_SANS}`
      ctx.fillStyle = COLORS.text
      ctx.fillText(truncateText(ctx, ex.name, 640), panelX, rowCenter)
      ctx.textAlign = 'right'
      ctx.font = `400 42px ${FONT_SANS}`
      ctx.fillStyle = COLORS.muted
      const detailText =
        ex.volumeKg > 0
          ? `${new Intl.NumberFormat(locale).format(Math.round(ex.volumeKg))} kg`
          : t('home.shareCard.setsCount', { n: ex.sets })
      ctx.fillText(detailText, panelX + panelW, rowCenter)
    })
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = COLORS.text
  ctx.font = `600 56px ${FONT_DISPLAY}`
  drawCenteredLines(ctx, ['IronTrack'], cx, HEIGHT - 200, 64)

  return canvasToPngBlob(canvas)
}

// Render and share a session card.
export async function shareSession({ detail, summary, t, locale }) {
  const blob = await renderSessionCard({ detail, summary, t, locale })
  const title = summary?.routineName || detail.routineName || t('home.shareCard.untitled')
  return deliverPng(blob, `irontrack-session-${detail._id}.png`, title)
}
