/*
  Utilidades compartidas por las tarjetas para compartir (insignias y entrenos).

  Por qué un módulo aparte: shareBadge.js y shareSession.js pintan en el mismo
  <canvas>, con las mismas fuentes y el mismo flujo de "compartir o descargar".
  Duplicar eso dos veces significa que un arreglo de fuentes o de descarga
  hay que aplicarlo en dos sitios y acabarían divergiendo.

  Los valores de color no viven aquí: cada tarjeta tiene su propia paleta
  porque no todas usan los mismos tonos.
*/

// Mismas familias que index.css (@theme). El canvas no lee variables CSS, así
// que se copian; si cambian en index.css, cambiar también aquí.
export const FONT_DISPLAY = '"Space Grotesk Variable", "Space Grotesk", sans-serif'
export const FONT_SANS = '"Inter Variable", "Inter", sans-serif'

/*
  Las fuentes de la app son variables de @fontsource y se cargan de forma
  perezosa. Si el canvas pinta antes de que existan, dibuja con la fuente de
  respaldo y la tarjeta sale con otra tipografía. Pedimos explícitamente los
  pesos que usamos y esperamos a document.fonts.ready. Si la carga falla,
  seguimos con las fuentes de sistema: una tarjeta algo distinta es mejor que
  no poder compartir.
*/
export async function ensureFonts() {
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
export function wrapText(ctx, text, maxWidth) {
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

export function drawCenteredLines(ctx, lines, centerX, startY, lineHeight) {
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, startY + i * lineHeight)
  })
  return startY + lines.length * lineHeight
}

// Recorta con "…" hasta que quepa en maxWidth. Un nombre de ejercicio largo
// no debe empujar al resto de la tarjeta fuera del lienzo.
export function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

export function canvasToPngBlob(canvas) {
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
  Entrega el PNG a la hoja de compartir del sistema si el navegador puede
  mandar ficheros; si no, lo descarga. Devuelve 'shared' | 'cancelled' |
  'downloaded'. Lanza solo si la hoja falla de forma inesperada y la descarga
  tampoco llega a ejecutarse (en la práctica, nunca).

  canShare({files}) es el único test fiable: navigator.share existe en
  escritorios donde luego rechaza los ficheros.
*/
export async function deliverPng(blob, filename, title) {
  const file = new File([blob], filename, { type: 'image/png' })
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title })
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
