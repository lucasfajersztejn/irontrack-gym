/*
  Genera la tarjeta de una insignia para compartir (formato Stories, 9:16) y la
  entrega al usuario.

  Por qué <canvas> y no html2canvas o similar: no hay librería de imagen en el
  proyecto y no queremos añadir una dependencia para pintar 4 formas y 3
  textos. Un canvas nativo da control total de la tipografía y del tamaño, y
  el resultado es un PNG estable en cualquier dispositivo.

  Por qué Web Share con ficheros y no un enlace a Instagram: Instagram no tiene
  API web para publicar en Stories. El flujo real es generar el PNG y abrir la
  hoja de compartir del sistema, donde el usuario elige Stories. En escritorio
  (sin soporte de ficheros en navigator.share) caemos a descargar el PNG.

  Nada sale del navegador: no hay subida al servidor ni dominio propio, así que
  respeta el invariante de "sin email ni servicios de terceros".
*/

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

// Paleta de DESIGN.md / index.css. Los valores van duplicados aquí porque el
// canvas no lee variables CSS; si cambian los tokens, cambiar también esto.
const COLORS = {
  bg: '#0d1117',
  text: '#c9d1d9',
  muted: '#8b949e',
  accent: '#39d353',
}

// Mismo trazo que TrophyIcon (viewBox 24, stroke 1.8). Path2D acepta la
// gramática de path SVG tal cual, así que no duplicamos la geometría a mano.
const TROPHY_PATHS = [
  'M8 4h8v4a4 4 0 0 1-8 0z',
  'M8 6H5a2 2 0 0 0 3 4M16 6h3a2 2 0 0 1-3 4',
  'M10 14h4l1 4H9z',
  'M8 20h8',
]

function drawHexagon(ctx, cx, cy, size) {
  // Mismas proporciones que HEX_CLIP (25% / 75% / 50%).
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

/*
  Carga el SVG de arte de la insignia como <img> y espera a decodificarlo.

  Por qué <img> + drawImage y no fetch + Path2D: un <img> de origen propio
  (/badges/… se sirve desde el mismo dominio) se pinta en el canvas sin
  "ensuciarlo". Un canvas tainted haría que toBlob() lanzara SecurityError y
  la tarjeta no se podría compartir. Mismo origen = toBlob sigue funcionando.
  El decode() espera a que el SVG esté rasterizable; si falla, quien llama cae
  al hexágono genérico en vez de bloquear el compartir.
*/
async function loadArtImage(url) {
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

// Pinta la tarjeta completa y devuelve un Blob PNG. Es asíncrona porque espera
// a las fuentes, al arte y a toBlob.
export async function renderBadgeCard({ name, why, earnedLabel, slug, tier }) {
  await ensureFonts()

  // Una insignia sin arte mapeado (slug nuevo) devuelve null y pinta el
  // hexágono genérico, igual que antes de que existiera el arte.
  const artUrl = badgeArtUrl({ slug, tier, unlocked: true })
  let artImg = null
  if (artUrl) {
    try {
      artImg = await loadArtImage(artUrl)
    } catch {
      // Arte roto o no servido: seguimos con el fallback genérico.
      artImg = null
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Resplandor verde detrás del hexágono. Es la única superficie donde el
  // verde puede ser protagonista: es el trofeo, no un elemento de interfaz.
  const glowX = WIDTH / 2
  const glowY = 720
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 620)
  glow.addColorStop(0, 'rgba(57, 211, 83, 0.28)')
  glow.addColorStop(1, 'rgba(57, 211, 83, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // El glow se queda detrás también con arte: los SVG dorados traen su propio
  // halo, y el resplandor verde de fondo es la marca de "ganada" de la tarjeta.
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

/*
  Devuelve 'shared' si se entregó a la hoja de compartir, 'cancelled' si el
  usuario la cerró (no es un error) y 'downloaded' si se cayó a descarga.
  Lanza solo si no se pudo generar la imagen ni descargarla.
*/
export async function shareBadge({ slug, name, why, earnedLabel, tier }) {
  const blob = await renderBadgeCard({ name, why, earnedLabel, slug, tier })
  return deliverPng(blob, `irontrack-${slug}.png`, name)
}
