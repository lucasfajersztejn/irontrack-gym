// Shared canvas helpers for share cards.

export const FONT_DISPLAY = '"Space Grotesk Variable", "Space Grotesk", sans-serif'
export const FONT_SANS = '"Inter Variable", "Inter", sans-serif'

// Wait for fonts before drawing.
export async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`600 96px ${FONT_DISPLAY}`),
      document.fonts.load(`400 42px ${FONT_SANS}`),
    ])
    await document.fonts.ready
  } catch {
    // ignore
  }
}

// Wrap text into lines that fit maxWidth.
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

// Truncate text with an ellipsis to fit maxWidth.
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
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Share the PNG via the share sheet, or download it.
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
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}
