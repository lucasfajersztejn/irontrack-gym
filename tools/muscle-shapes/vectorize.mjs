// Generates web/src/lib/muscleShapes.js from the vector art in docs/design/components/muscles/musculos/. Run only when the art changes; the generated module is not edited by hand.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SRC = join(HERE, 'svg')
const OUT = join(ROOT, 'web', 'src', 'lib', 'muscleShapes.js')

// Output canvas (portrait).
const TARGET_H = 1200
const PAD = 36

// Symmetry axis per view (translate of the 'derecha' group).
const MIRROR_T = { front: 965, back: 2875 }

// id -> enum muscle ('decor' = grey silhouette, not lit). Keyless of side.
const BASE_MAP = {
  'antebrazo-frontal': 'forearms',
  'cuadriceps-frontal': 'quads',
  'oblicuo-frontal': 'abs',
  'antebrazo-trasera': 'forearms',
  'isquiotibial-trasera': 'hamstrings',
  'gemelo-trasera': 'calves',
  'tibial-frontal': 'decor',
  'pie-frontal': 'decor',
  'pie-trasera': 'decor',
}

// Per-id overrides (no side). Take priority over BASE_MAP.
const ID_MAP = {
  // FRONT
  'cuello-frontal': 'levator-scapulae',
  'cuello-2-frontal': 'levator-scapulae',
  'cuello-3-frontal': 'levator-scapulae',
  'cuello-4-frontal': 'levator-scapulae',
  'pectoral-frontal': 'delts',
  'pectoral-2-frontal': 'pectorals',
  'abdominal-frontal': 'biceps',
  'abdominal-2-frontal': 'biceps',
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
  'cadera-frontal': 'quads',
  'cadera-2-frontal': 'adductors',
  'cadera-3-frontal': 'quads',
  'cadera-4-frontal': 'decor',
  'cadera-5-frontal': 'decor',
  'cadera-6-frontal': 'decor',
  'cadera-7-frontal': 'decor',
  'cadera-8-frontal': 'decor',
  'cadera-9-frontal': 'decor',
  'cadera-10-frontal': 'adductors',
  // BACK
  'cuello-trasera': 'traps',
  'espalda_superior-trasera': 'traps',
  'espalda_superior-2-trasera': 'delts',
  'espalda_superior-3-trasera': 'upper-back',
  'espalda_superior-4-trasera': 'upper-back',
  'espalda_superior-5-trasera': 'delts',
  'dorsal-trasera': 'lats',
  'dorsal-2-trasera': 'triceps',
  'dorsal-3-trasera': 'triceps',
  'dorsal-4-trasera': 'lats',
  'dorsal-5-trasera': 'triceps',
  'dorsal_inferior-trasera': 'forearms',
  'dorsal_inferior-2-trasera': 'spine',
  'dorsal_inferior-3-trasera': 'spine',
  'gluteo-trasera': 'glutes',
  'gluteo-2-trasera': 'decor',
  'gluteo-3-trasera': 'decor',
  'gluteo-4-trasera': 'decor',
  'gluteo-5-trasera': 'decor',
  'gluteo-6-trasera': 'decor',
  'gluteo-7-trasera': 'decor',
}

// --- parsing helpers ---

function sidelessKey(id) {
  return id.replace(/-(izq|der)-/, '-')
}
function baseKey(id) {
  const m = id.match(/^([a-z_]+)-(?:izq|der)(?:-\d+)?-(frontal|trasera)$/)
  return m ? `${m[1]}-${m[2]}` : null
}
function muscleFor(id) {
  const s = sidelessKey(id)
  if (ID_MAP[s]) return ID_MAP[s]
  const b = baseKey(id)
  if (b && BASE_MAP[b]) return BASE_MAP[b]
  return null
}

// Numbers of a path d, in order (x,y,x,y...).
function numbersOf(d) {
  return (d.match(/-?\d*\.?\d+/g) || []).map(Number)
}
// Rebuild d, replacing each number in order with fn(value, globalIndex).
function mapNumbers(d, fn) {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (tok) => {
    const v = fn(Number(tok), i)
    i += 1
    return (Math.round(v * 10) / 10).toString()
  })
}

// Extracts <path id d> from a group (flat svg, no nested paths).
function paths(svg) {
  const out = []
  const re = /<ns0:path\s+id="([^"]+)"[^>]*\bd="([^"]+)"/g
  let m
  while ((m = re.exec(svg))) out.push({ id: m[1], d: m[2] })
  return out
}

// --- per-view processing ---

function processView(file, view) {
  const svg = readFileSync(join(SRC, file), 'utf8')
  const T = MIRROR_T[view]
  const all = paths(svg)

  const real = all.map((p) => {
    const der = /-der-/.test(p.id) || /-der$/.test(p.id)
    const xf = (v, i) => (i % 2 === 0 && der ? T - v : v)
    return { id: p.id, d: mapNumbers(p.d, xf) }
  })

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

const COMMON_W = Math.round(Math.max(front.viewW, back.viewW) + 2 * PAD)

function emit(v) {
  const offX = (COMMON_W - v.viewW) / 2
  const norm = (val, i) =>
    i % 2 === 0 ? (val - v.minX) * v.s + offX : (val - v.minY) * v.s + PAD
  const body = []
  const hair = []
  const decor = []
  const muscles = {}
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

// --- serialization ---

const arr4 = (a) => '[\n' + a.map((d) => `    '${d}',`).join('\n') + '\n  ]'
const arr6 = (a) => '[\n' + a.map((d) => `      '${d}',`).join('\n') + '\n    ]'
const viewPair = (f, b) => `{\n  front: ${arr4(f)},\n  back: ${arr4(b)},\n}`
function muscleBlock(m) {
  return Object.keys(m).sort().map((k) => `    '${k}': ${arr6(m[k])},`).join('\n')
}

const header = `// Vector silhouettes of the muscle map. Generated by tools/muscle-shapes/vectorize.mjs; not edited by hand. Layers back-to-front: SILHOUETTE, DECOR, MUSCLE_SHAPES[view][muscle], HAIR.

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

// Paths of a set of muscles in a view (to light up).
export function shapesFor(view, muscles) {
  const table = MUSCLE_SHAPES[view] ?? {}
  const out = []
  for (const muscle of muscles) {
    for (const d of table[muscle] ?? []) out.push(d)
  }
  return out
}

// All muscle paths of a view (grey base layer).
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
