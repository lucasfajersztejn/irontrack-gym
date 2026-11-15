/*
  Genera web/src/lib/muscleShapes.js a partir del arte vectorial
  docs/design/components/muscles/musculos/{vista-frontal,vista-trasera}.svg.

  Por que existe
  --------------
  El arte nuevo ya es vectorial: cada musculo es un <path> con id propio. No
  hay que segmentar mapas raster (eso era el pipeline viejo: segment.py). Aqui
  solo transformamos esos paths al formato que consume el componente.

  Tres cosas no triviales que resuelve este script:

  1. Espejo. El lado 'derecha' no trae coordenadas propias: es el 'izquierda'
     reflejado con transform="translate(T,0) scale(-1,1)". Reaplicamos ese
     reflejo (x -> T - x) para tener coordenadas reales de los dos lados.

  2. Nombres laxos -> enum real. El artista agrupo con nombres anatomicamente
     gruesos: el grupo 'abdominal' incluye abdominales, deltoides, biceps y
     serrato; 'dorsal' incluye dorsales y triceps. MUSCLE_MAP traduce cada id
     concreto al musculo del enum de la app. Lo que no es musculo entrenable
     (manos, pies, espinilla, pelo) va a la silueta gris, no se enciende.

  3. Normalizado. Cada figura esta descentrada en su lienzo 1920x1920 y las dos
     miden distinto. Reescalamos las dos a la misma altura y las centramos en
     un lienzo comun, para que el giro 3D de la card no cambie la escala.

  Uso: node tools/muscle-shapes/vectorize.mjs
  Reejecutar solo si cambia el arte. El modulo generado no se edita a mano.
*/

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
// Fuente versionada en el repo (el arte original en docs/design/ esta gitignored).
const SRC = join(HERE, 'svg')
const OUT = join(ROOT, 'web', 'src', 'lib', 'muscleShapes.js')

// Lienzo de salida (portrait, misma proporcion aprox que el viejo 680x1200).
const TARGET_H = 1200
const PAD = 36

// Eje de simetria de cada vista (translate del grupo 'derecha').
const MIRROR_T = { front: 965, back: 2875 }

// --- Tabla id -> musculo del enum (o 'decor' = silueta gris, no encendible) ---
// Clave sin lado: se quita -izq-/-der-, aplica a los dos lados por el espejo.
// Los nombres base laxos del artista se parten aqui en musculos reales.
const BASE_MAP = {
  // grupos limpios: todos sus paths son el mismo musculo
  'antebrazo-frontal': 'forearms',
  'cuadriceps-frontal': 'quads',
  'oblicuo-frontal': 'abs',
  'antebrazo-trasera': 'forearms',
  'isquiotibial-trasera': 'hamstrings',
  'gemelo-trasera': 'calves',
  // decorativos
  'tibial-frontal': 'decor',
  'pie-frontal': 'decor',
  'pie-trasera': 'decor',
}

// Overrides por id concreto (sin lado). Prioridad sobre BASE_MAP.
const ID_MAP = {
  // --- FRONTAL ---
  // cuello: tiras del cuello -> elevador de la escapula
  'cuello-frontal': 'levator-scapulae',
  'cuello-2-frontal': 'levator-scapulae',
  'cuello-3-frontal': 'levator-scapulae',
  'cuello-4-frontal': 'levator-scapulae',
  // 'pectoral': casquete del hombro (deltoide) + pecho
  'pectoral-frontal': 'delts', // path 1: hombro
  'pectoral-2-frontal': 'pectorals', // path 2: pecho
  // 'abdominal': abs + brazo (biceps) + costado (serrato)
  'abdominal-frontal': 'biceps', // a1, brazo
  'abdominal-2-frontal': 'biceps', // a2, brazo
  'abdominal-3-frontal': 'serratus-anterior',
  'abdominal-4-frontal': 'abs',
  'abdominal-5-frontal': 'serratus-anterior',
  'abdominal-6-frontal': 'abs',
  'abdominal-7-frontal': 'serratus-anterior',
  'abdominal-8-frontal': 'abs',
  'abdominal-9-frontal': 'abs',
  'abdominal-10-frontal': 'abs',
  'abdominal-11-frontal': 'abs',
  'abdominal-12-frontal': 'abs',
  // 'cadera': masa del muslo (cuadriceps) + tiras mediales (aductores) + manos
  'cadera-frontal': 'quads', // cadera alta / recto femoral
  'cadera-2-frontal': 'adductors', // tira medial diagonal (sartorio/aductor)
  'cadera-3-frontal': 'quads', // bulto grande del muslo
  'cadera-4-frontal': 'decor',
  'cadera-5-frontal': 'decor',
  'cadera-6-frontal': 'decor',
  'cadera-7-frontal': 'decor',
  'cadera-8-frontal': 'decor',
  'cadera-9-frontal': 'decor',
  'cadera-10-frontal': 'adductors', // tira junto a la ingle
  // --- TRASERA ---
  'cuello-trasera': 'traps', // nuca / trapecio alto
  // 'espalda_superior': trapecio (medial) + deltoide posterior (lateral) + romboides
  'espalda_superior-trasera': 'traps',
  'espalda_superior-2-trasera': 'delts',
  'espalda_superior-3-trasera': 'upper-back',
  'espalda_superior-4-trasera': 'upper-back',
  'espalda_superior-5-trasera': 'delts',
  // 'dorsal': dorsales (medial) + triceps (brazo)
  'dorsal-trasera': 'lats',
  'dorsal-2-trasera': 'triceps',
  'dorsal-3-trasera': 'triceps',
  'dorsal-4-trasera': 'lats',
  'dorsal-5-trasera': 'triceps',
  // 'dorsal_inferior': antebrazo (codo) + lumbar (spine)
  'dorsal_inferior-trasera': 'forearms',
  'dorsal_inferior-2-trasera': 'spine',
  'dorsal_inferior-3-trasera': 'spine',
  // 'gluteo': gluteo (1) + mano (resto)
  'gluteo-trasera': 'glutes',
  'gluteo-2-trasera': 'decor',
  'gluteo-3-trasera': 'decor',
  'gluteo-4-trasera': 'decor',
  'gluteo-5-trasera': 'decor',
  'gluteo-6-trasera': 'decor',
  'gluteo-7-trasera': 'decor',
}

// --- helpers de parsing ---

function sidelessKey(id) {
  // 'abdominal-izq-4-frontal' -> 'abdominal-4-frontal'
  return id.replace(/-(izq|der)-/, '-')
}
function baseKey(id) {
  // 'abdominal-izq-4-frontal' -> 'abdominal-frontal'
  const m = id.match(/^([a-z_]+)-(?:izq|der)(?:-\d+)?-(frontal|trasera)$/)
  return m ? `${m[1]}-${m[2]}` : null
}
function muscleFor(id) {
  const s = sidelessKey(id)
  if (ID_MAP[s]) return ID_MAP[s]
  const b = baseKey(id)
  if (b && BASE_MAP[b]) return BASE_MAP[b]
  return null // sin mapeo: lo tratamos como decor para no perder dibujo
}

// numeros de un path d, en orden (alternan x,y,x,y...)
function numbersOf(d) {
  return (d.match(/-?\d*\.?\d+/g) || []).map(Number)
}
// reconstruye d sustituyendo numeros en orden por fn(valor, indiceGlobal)
function mapNumbers(d, fn) {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (tok) => {
    const v = fn(Number(tok), i)
    i += 1
    return (Math.round(v * 10) / 10).toString()
  })
}

// extrae <path id d> de un grupo con regex (el svg es plano, sin anidar paths)
function paths(svg) {
  const out = []
  const re = /<ns0:path\s+id="([^"]+)"[^>]*\bd="([^"]+)"/g
  let m
  while ((m = re.exec(svg))) out.push({ id: m[1], d: m[2] })
  return out
}

// --- proceso por vista ---

function processView(file, view) {
  const svg = readFileSync(join(SRC, file), 'utf8')
  const T = MIRROR_T[view]
  const all = paths(svg)

  // coords reales: el lado 'der' se refleja x -> T - x
  const real = all.map((p) => {
    const der = /-der-/.test(p.id) || /-der$/.test(p.id)
    const xf = (v, i) => (i % 2 === 0 && der ? T - v : v)
    return { id: p.id, d: mapNumbers(p.d, xf) }
  })

  // bbox de la figura (todos los paths de musculo+silueta)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of real) {
    const n = numbersOf(p.d)
    for (let i = 0; i < n.length; i++) {
      if (i % 2 === 0) { if (n[i] < minX) minX = n[i]; if (n[i] > maxX) maxX = n[i] }
      else { if (n[i] < minY) minY = n[i]; if (n[i] > maxY) maxY = n[i] }
    }
  }
  const s = (TARGET_H - 2 * PAD) / (maxY - minY)
  const viewW = (maxX - minX) * s
  return { real, minX, minY, s, viewW }
}

const front = processView('vista-frontal.svg', 'front')
const back = processView('vista-trasera.svg', 'back')

// lienzo comun: misma altura, ancho = max de las dos figuras, cada una centrada
const COMMON_W = Math.round(Math.max(front.viewW, back.viewW) + 2 * PAD)

function emit(v) {
  const offX = (COMMON_W - v.viewW) / 2
  const norm = (val, i) =>
    i % 2 === 0 ? (val - v.minX) * v.s + offX : (val - v.minY) * v.s + PAD
  const body = [] // contorno del cuerpo (claro)
  const hair = [] // pelo
  const decor = [] // manos, pies, espinilla, no entrenable (gris muscular)
  const muscles = {} // enum -> [d] (encendible)
  for (const p of v.real) {
    const d = mapNumbers(p.d, norm)
    if (/^silueta/.test(p.id)) { body.push(d); continue }
    if (/^cabello/.test(p.id)) { hair.push(d); continue }
    const enumId = muscleFor(p.id)
    if (!enumId || enumId === 'decor') { decor.push(d); continue }
    ;(muscles[enumId] ||= []).push(d)
  }
  return { body, hair, decor, muscles }
}

const F = emit(front)
const B = emit(back)

// --- serializacion ---

// array de paths con sangria de 4 espacios
const arr4 = (a) => '[\n' + a.map((d) => `    '${d}',`).join('\n') + '\n  ]'
// array con sangria de 6 (dentro de {front:{...}})
const arr6 = (a) => '[\n' + a.map((d) => `      '${d}',`).join('\n') + '\n    ]'
const viewPair = (f, b) => `{\n  front: ${arr4(f)},\n  back: ${arr4(b)},\n}`
function muscleBlock(m) {
  return Object.keys(m).sort().map((k) => `    '${k}': ${arr6(m[k])},`).join('\n')
}

const header = `/*
  Siluetas vectoriales del mapa muscular.

  GENERADO por tools/muscle-shapes/vectorize.mjs a partir del arte vectorial
  docs/design/components/muscles/musculos/. No editar a mano: si cambia el arte,
  reejecuta el script. La tabla de mapeo id -> musculo vive en ese script.

  Coordenadas en el viewBox comun de abajo: las dos vistas se escalan a la misma
  altura y se centran, asi que girar la card no cambia la escala de la figura.

  Capas (de atras a delante):
  - SILHOUETTE: contorno del cuerpo (gris claro).
  - DECOR: manos, pies, espinilla; dibujo no entrenable, gris muscular.
  - MUSCLE_SHAPES[view][musculo]: los musculos; de base van en gris y el mapa
    los enciende con color. 'cardio' no aparece: no es un musculo. Un musculo
    sin silueta en una vista no se pinta en ella (los triceps no existen de
    frente).
  - HAIR: el pelo, encima.
*/

export const BODY_VIEWBOX = { width: ${COMMON_W}, height: ${TARGET_H} }

export const SILHOUETTE = ${viewPair(F.body, B.body)}

export const HAIR = ${viewPair(F.hair, B.hair)}

export const DECOR = ${viewPair(F.decor, B.decor)}

export const MUSCLE_SHAPES = {
  front: {
${muscleBlock(F.muscles)}
  },
  back: {
${muscleBlock(B.muscles)}
  },
}

/** Trazados de un conjunto de musculos en una vista (para encender). */
export function shapesFor(view, muscles) {
  const table = MUSCLE_SHAPES[view] ?? {}
  const out = []
  for (const muscle of muscles) {
    for (const d of table[muscle] ?? []) out.push(d)
  }
  return out
}

/** Todos los trazados de musculo de una vista (capa gris de base). */
export function allMuscleShapes(view) {
  return Object.values(MUSCLE_SHAPES[view] ?? {}).flat()
}
`

writeFileSync(OUT, header)
const count = (m) => Object.entries(m).map(([k, v]) => `${k}:${v.length}`).join(' ')
console.log('viewBox', COMMON_W, 'x', TARGET_H)
console.log('FRONT musculos ->', count(F.muscles))
console.log('  body', F.body.length, 'hair', F.hair.length, 'decor', F.decor.length)
console.log('BACK musculos ->', count(B.muscles))
console.log('  body', B.body.length, 'hair', B.hair.length, 'decor', B.decor.length)
console.log('escrito', OUT)
