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

const FONT_DISPLAY = '"Space Grotesk Variable", "Space Grotesk", sans-serif'
const FONT_SANS = '"Inter Variable", "Inter", sans-serif'

// Mismo trazo que TrophyIcon (viewBox 24, stroke 1.8). Path2D acepta la
// gramática de path SVG tal cual, así que no duplicamos la geometría a mano.
const TROPHY_PATHS = [
  'M8 4h8v4a4 4 0 0 1-8 0z',
  'M8 6H5a2 2 0 0 0 3 4M16 6h3a2 2 0 0 1-3 4',
  'M10 14h4l1 4H9z',
  'M8 20h8',
]

/*
  Las fuentes de la app son variables de @fontsource y se cargan de forma
  perezosa. Si el canvas pinta antes de que existan, dibuja con la fuente de
  respaldo y la tarjeta sale con otra tipografía. Pedimos explícitamente los
  pesos que usamos y esperamos a document.fonts.ready. Si la carga falla,
  seguimos con las fuentes de sistema: una tarjeta algo distinta es mejor que
  no poder compartir.
*/
async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`600 96px ${FONT_DISPLAY}`),
      document.fonts.load(`400 42px ${FONT_SANS}`),
    ])
    await document.fonts.ready
  } catch {
    // Sin fuentes cargadas: se pinta con el respaldo del sistema.
  }
}

// Parte el texto en líneas que quepan en maxWidth, por palabras. Medir con
// measureText es lo único fiable: contar caracteres falla con fuentes
// proporcionales.
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawCenteredLines(ctx, lines, centerX, startY, lineHeight) {
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, startY + i * lineHeight)
  })
  return startY + lines.length * lineHeight
}

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

// Pinta la tarjeta completa y devuelve un Blob PNG. Es asíncrona porque espera
// a las fuentes y a toBlob.
export async function renderBadgeCard({ name, why, earnedLabel }) {
  await ensureFonts()

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

  const hexSize = 480
  drawHexagon(ctx, glowX, glowY, hexSize)
  ctx.fillStyle = 'rgba(57, 211, 83, 0.2)'
  ctx.fill()
  drawTrophy(ctx, glowX, glowY, 200)

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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas-to-blob-failed'))
    }, 'image/png')
  })
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revocar en el mismo tick puede cancelar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/*
  Devuelve 'shared' si se entregó a la hoja de compartir, 'cancelled' si el
  usuario la cerró (no es un error) y 'downloaded' si se cayó a descarga.
  Lanza solo si no se pudo generar la imagen ni descargarla.
*/
export async function shareBadge({ slug, name, why, earnedLabel }) {
  const blob = await renderBadgeCard({ name, why, earnedLabel })
  const filename = `irontrack-${slug}.png`

  const file = new File([blob], filename, { type: 'image/png' })
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (err) {
      // AbortError = el usuario cerró la hoja. Es una decisión, no un fallo.
      if (err?.name === 'AbortError') return 'cancelled'
      // Cualquier otro fallo de la hoja (p. ej. NotAllowedError) cae a descarga
      // en vez de dejar al usuario sin imagen.
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}
