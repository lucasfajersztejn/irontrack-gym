/*
  Mapeo entre los músculos de IronTrack (constants.js MUSCLES) y las claves
  que acepta react-body-highlighter. La librería tiene su propio vocabulario
  (19 músculos con nombres distintos); en vez de duplicar nuestro enum,
  traducimos solo en el borde donde se consume.

  Cuando un músculo nuestro cubre dos regiones de la librería (p. ej. "delts"
  → front-deltoids y back-deltoids), devolvemos ambos para que el highlight
  se dispare en las dos vistas. Músculos sin equivalente directo caen a la
  aproximación más cercana (serratus→obliques, lats→upper-back) hasta que
  encontremos un modelo más preciso o pintemos uno propio.
*/

const MAP = {
  abductors: ['abductors'],
  abs: ['abs'],
  adductors: ['adductor'],
  biceps: ['biceps'],
  calves: ['calves'],
  cardio: [], // nada que pintar: el cardio es sistémico, no un músculo
  delts: ['front-deltoids', 'back-deltoids'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'levator-scapulae': ['neck'],
  pectorals: ['chest'],
  quads: ['quadriceps'],
  'serratus-anterior': ['obliques'],
  spine: ['lower-back'],
  traps: ['trapezius'],
  triceps: ['triceps'],
  'upper-back': ['upper-back'],
}

/*
  Toma una lista de muscles IronTrack (p. ej. ['pectorals', 'triceps']) y
  devuelve el array plano, sin duplicados, de claves que la librería entiende.
*/
export function toLibraryMuscles(muscles) {
  const out = new Set()
  for (const m of muscles ?? []) {
    for (const mapped of MAP[m] ?? []) {
      out.add(mapped)
    }
  }
  return Array.from(out)
}
