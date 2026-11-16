// Renders a badge share card to a PNG.

import { badgeArtUrl } from './badgeArt.js'
import {
  FONT_DISPLAY,
  FONT_SANS,
  ensureFonts,
  wrapText,
  drawCenteredLines,
  canvasToPngBlob,
  deliverPng,
} from './shareCanvas.js'

const WIDTH = 1080
const HEIGHT = 1920

const COLORS = {
  bg: '#0d1117',
  text: '#c9d1d9',
  muted: '#8b949e',
  accent: '#39d353',
}

const TROPHY_PATHS = [
  'M8 4h8v4a4 4 0 0 1-8 0z',
  'M8 6H5a2 2 0 0 0 3 4M16 6h3a2 2 0 0 1-3 4',
  'M10 14h4l1 4H9z',
  'M8 20h8',
]

function drawHexagon(ctx, cx, cy, size) {
  const x0 = cx - size / 2
  const y0 = cy - size / 2
  ctx.beginPath()
  ctx.moveTo(x0 + size * 0.25, y0)
  ctx.lineTo(x0 + size * 0.75, y0)
  ctx.lineTo(x0 + size, y0 + size / 2)
  ctx.lineTo(x0 + size * 0.75, y0 + size)
  ctx.lineTo(x0 + size * 0.25, y0 + size)
  ctx.lineTo(x0, y0 + size / 2)
  ctx.closePath()
}

function drawTrophy(ctx, cx, cy, size) {
  const scale = size / 24
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(scale, scale)
  ctx.strokeStyle = COLORS.accent
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of TROPHY_PATHS) ctx.stroke(new Path2D(d))
  ctx.restore()
}

async function loadArtImage(url) {
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

// Render the full badge card and return a PNG Blob.
export async function renderBadgeCard({ name, why, earnedLabel, slug, tier }) {
  await ensureFonts()

  const artUrl = badgeArtUrl({ slug, tier, unlocked: true })
  let artImg = null
  if (artUrl) {
    try {
      artImg = await loadArtImage(artUrl)
    } catch {
      artImg = null
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const glowX = WIDTH / 2
  const glowY = 720
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 620)
  glow.addColorStop(0, 'rgba(57, 211, 83, 0.28)')
  glow.addColorStop(1, 'rgba(57, 211, 83, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const hexSize = 480
  if (artImg) {
    ctx.drawImage(artImg, glowX - hexSize / 2, glowY - hexSize / 2, hexSize, hexSize)
  } else {
    drawHexagon(ctx, glowX, glowY, hexSize)
    ctx.fillStyle = 'rgba(57, 211, 83, 0.2)'
    ctx.fill()
    drawTrophy(ctx, glowX, glowY, 200)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  ctx.fillStyle = COLORS.text
  ctx.font = `600 96px ${FONT_DISPLAY}`
  const nameLines = wrapText(ctx, name, 920)
  let y = drawCenteredLines(ctx, nameLines, glowX, 1040, 112)

  ctx.fillStyle = COLORS.muted
  ctx.font = `400 42px ${FONT_SANS}`
  const whyLines = wrapText(ctx, why, 840)
  y = drawCenteredLines(ctx, whyLines, glowX, y + 48, 60)

  ctx.fillStyle = COLORS.accent
  ctx.font = `600 40px ${FONT_DISPLAY}`
  drawCenteredLines(ctx, [earnedLabel], glowX, y + 56, 52)

  ctx.fillStyle = COLORS.text
  ctx.font = `600 56px ${FONT_DISPLAY}`
  drawCenteredLines(ctx, ['IronTrack'], glowX, HEIGHT - 200, 64)

  return canvasToPngBlob(canvas)
}

// Render and share a badge card.
export async function shareBadge({ slug, name, why, earnedLabel, tier }) {
  const blob = await renderBadgeCard({ name, why, earnedLabel, slug, tier })
  return deliverPng(blob, `irontrack-${slug}.png`, name)
}
