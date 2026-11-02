/*
  Regiones del mapa corporal: dónde pintar cada músculo sobre los renders
  anatómicos de `assets/muscles/`.

  Por qué elipses y no trazados anatómicos: los renders son PNG rasterizados,
  no SVG, así que no hay regiones que colorear por selector. Recalcar cada
  músculo a mano con paths daría bordes duros que delatan cualquier
  desalineación de dos píxeles sobre un dibujo con ese nivel de detalle. Una
  elipse con degradado radial tiene el borde difuso, perdona la imprecisión y
  además lee como "carga de trabajo", que es lo que estamos representando:
  una zona activada, no un contorno quirúrgico.

  Coordenadas en el espacio del viewBox (680×1200), que es el lienzo al que se
  normalizaron las dos imágenes: los dos cuerpos miden lo mismo de alto y van
  centrados, así que girar la tarjeta no cambia la escala de la figura.

  Cada entrada es [cx, cy, rx, ry]. Los músculos pares llevan dos elipses
  (izquierda y derecha); los impares (abs, spine, traps de espalda) una sola
  centrada.

  'cardio' no aparece a propósito: no es un músculo y no tiene sitio en el
  cuerpo. Los músculos sin región en una vista simplemente no se pintan en
  ella (los isquios no existen de frente).
*/

export const BODY_VIEWBOX = { width: 680, height: 1200 }

export const MUSCLE_REGIONS = {
  front: {
    'levator-scapulae': [[318, 178, 20, 16]],
    traps: [[290, 212, 38, 20], [390, 212, 38, 20]],
    delts: [[218, 258, 45, 42], [462, 258, 45, 42]],
    pectorals: [[292, 288, 55, 46], [388, 288, 55, 46]],
    'serratus-anterior': [[268, 388, 28, 38], [412, 388, 28, 38]],
    abs: [[340, 428, 58, 88]],
    biceps: [[210, 378, 34, 58], [470, 378, 34, 58]],
    forearms: [[150, 505, 40, 58], [530, 505, 40, 58]],
    abductors: [[252, 700, 28, 40], [428, 700, 28, 40]],
    adductors: [[318, 748, 26, 72], [362, 748, 26, 72]],
    quads: [[287, 790, 55, 115], [393, 790, 55, 115]],
    calves: [[288, 1000, 30, 72], [392, 1000, 30, 72]],
  },
  back: {
    'levator-scapulae': [[340, 152, 26, 22]],
    traps: [[340, 228, 82, 56]],
    delts: [[205, 262, 44, 42], [475, 262, 44, 42]],
    'upper-back': [[295, 342, 42, 40], [385, 342, 42, 40]],
    lats: [[258, 404, 46, 62], [422, 404, 46, 62]],
    spine: [[340, 410, 18, 112]],
    triceps: [[196, 342, 36, 60], [484, 342, 36, 60]],
    forearms: [[142, 505, 40, 58], [538, 505, 40, 58]],
    glutes: [[297, 592, 58, 57], [383, 592, 58, 57]],
    hamstrings: [[290, 760, 48, 96], [390, 760, 48, 96]],
    calves: [[290, 985, 34, 76], [390, 985, 34, 76]],
    abductors: [[243, 545, 26, 34], [437, 545, 26, 34]],
    adductors: [[320, 742, 24, 62], [360, 742, 24, 62]],
  },
}

/** Elipses a pintar para un conjunto de músculos en una vista. */
export function ellipsesFor(view, muscles) {
  const table = MUSCLE_REGIONS[view] ?? {}
  const out = []
  for (const muscle of muscles) {
    for (const e of table[muscle] ?? []) out.push(e)
  }
  return out
}
