/*
  Progresión sugerida para ejercicios `weight_reps`.
  ---------------------------------------------------------------------------

  Dos funciones puras, una por horizonte:

    suggestFirstSetOfDay   -> qué cargar al empezar el ejercicio hoy.
    suggestNextSetInSession -> qué cargar en la serie siguiente de hoy.

  UNIDADES: las dos trabajan sobre EL NÚMERO QUE EL USUARIO ESCRIBE, no
  sobre el peso total. En un ejercicio con barra en modo "discos por lado"
  ese número son los kilos por lado; en mancuerna, polea o máquina es el
  peso tal cual. El caller (SessionExerciseCard) convierte el total que
  guarda la DB a esa unidad antes de llamar, y lo que sale se pinta
  directamente como placeholder.

  Es deliberado: el usuario razona en la unidad en la que carga la barra
  ("le meto un disco de 2.5 más por lado"), no en el total. Aplicar el
  incremento al total daba saltos de 1.25 por lado, que no se pueden
  montar. La invariante de la spec §1 no se toca: la DB sigue guardando
  kilos totales, esto es capa de presentación.

  Por qué en cliente y no en servidor:
    - Los datos (última sesión + plantilla) ya viajan al montar la vista
      live. Un endpoint nuevo duplicaría trabajo.
    - Son funciones puras: se testean sin Mongo y se explican en voz alta,
      que es más de lo que se puede decir de un 5/3/1 embebido en una
      aggregation.
*/

/*
  Rejilla universal del gimnasio: 2.5 kg. Con barra son discos de 1.25 por
  lado; las mancuernas y las selectorizadas suben de 2.5 en 2.5 (por eso no
  existe una mancuerna de 14: se pasa de 12.5 a 15). Todas las cargas que
  proponemos se cuadran a esta rejilla, no solo el incremento: si no, un
  redondeo previo arrastra la sugerencia fuera de la cuadrícula para
  siempre.
*/
const STEP_KG = 2.5

// Salto doble cuando sobró mucho margen. Un solo disco se queda corto y
// tardarías semanas en llegar a tu carga real.
const BIG_STEP_KG = 5

// RIR a partir del cual el salto es doble.
const BIG_STEP_RIR = 3

function snapToStep(kg) {
  if (kg == null) return null
  return Math.max(0, Math.round(kg / STEP_KG) * STEP_KG)
}

/**
 * Primera serie del ejercicio HOY.
 *
 * Ancla: la PRIMERA serie de la última vez que hiciste este ejercicio, no
 * la última. Si la semana pasada abriste con 20 y acabaste en 25 × 4 tras
 * encadenar subidas, hoy se abre en 22.5 — el final de aquella sesión fue
 * fatiga acumulada, no tu punto de partida. Abrir donde acabaste convierte
 * cada semana en un máximo y el ejercicio deja de poder empezarse.
 *
 * Incremento fijo de un escalón, mismas reps: progresión lineal. No mira
 * el RIR porque el ancla es la serie fresca del día, donde por definición
 * aún no hay fatiga que interpretar; la lectura fina del RIR ocurre dentro
 * de la sesión, que es donde hay series que comparar entre sí.
 *
 * @param {object} params
 * @param {object|null} params.firstSetLastTime  primera serie de la última
 *   sesión con este ejercicio, YA en la unidad que escribe el usuario.
 * @param {object|null} params.plannedSet  primera serie de la plantilla de
 *   la rutina, misma unidad. Respaldo si el ejercicio es nuevo.
 * @returns {{ weightKg: number, reps: number|null } | null}
 */
export function suggestFirstSetOfDay({ firstSetLastTime, plannedSet } = {}) {
  if (firstSetLastTime?.weightKg != null) {
    return {
      weightKg: snapToStep(firstSetLastTime.weightKg + STEP_KG),
      reps: firstSetLastTime.reps ?? null,
    }
  }
  // Sin historial, la plantilla manda tal cual: es el peso de arranque que
  // el usuario eligió al crear la rutina, no hay nada que progresar aún.
  if (plannedSet?.weightKg != null) {
    return {
      weightKg: snapToStep(plannedSet.weightKg),
      reps: plannedSet.reps ?? null,
    }
  }
  return null
}

/**
 * Serie siguiente DENTRO de la sesión, a partir de la anterior de hoy.
 *
 * Escala por el RIR que anotaste en esa serie:
 *
 *   RIR >= 3  -> +5 kg y dos reps menos. Te sobraron 3 o más: el salto
 *                grande se paga con reps, que es como funciona la fuerza.
 *   RIR 1-2   -> +2.5 kg y la mitad de las reps. Subes un escalón y
 *                asumes que a esa carga no repites el mismo volumen.
 *   RIR 0     -> mismo peso y mismas reps. Llegaste al fallo: subir ahí
 *                es pedir una serie que no va a salir.
 *   sin RIR   -> mismo peso y mismas reps. Sin el dato no inventamos.
 *
 * Las reps nunca bajan de 1: media de 1 es 0.5, y proponer cero series de
 * nada no es una sugerencia.
 *
 * @param {object} params
 * @param {object|null} params.lastSet  serie anterior de HOY, YA en la
 *   unidad que escribe el usuario.
 * @returns {{ weightKg: number, reps: number|null } | null}
 */
export function suggestNextSetInSession({ lastSet } = {}) {
  if (lastSet?.weightKg == null) return null
  const { weightKg, reps = null, rir } = lastSet

  if (rir == null || rir === 0) {
    return { weightKg, reps }
  }

  const isBigStep = rir >= BIG_STEP_RIR
  const nextReps =
    reps == null
      ? null
      : Math.max(1, isBigStep ? reps - 2 : Math.round(reps / 2))

  return {
    weightKg: snapToStep(weightKg + (isBigStep ? BIG_STEP_KG : STEP_KG)),
    reps: nextReps,
  }
}

// Recorte del deload. 10% es el estándar de libro: suficiente para romper la
// fatiga acumulada sin perder tanto que la vuelta se haga eterna.
const DELOAD_FRACTION = 0.1

/**
 * Peso de arranque sugerido para romper una meseta: baja ~10% desde el pico y
 * cuadra a la rejilla de 2.5 kg. A partir de ahí la rampa es el +2.5 por
 * sesión que ya aplica suggestFirstSetOfDay — el deload solo decide DÓNDE
 * reempezar, no cambia cómo se sube.
 *
 * A diferencia de las otras dos funciones, trabaja sobre el PESO TOTAL que
 * muestra la curva (kg), no sobre el número por lado: vive en el dashboard,
 * junto al gráfico que ya habla en totales, no en el input de la sesión viva.
 * La conversión fina por lado sigue siendo trabajo de la pantalla de entrenar.
 *
 * @param {object} params
 * @param {number|null} params.peakKg  mayor peso real levantado en el ejercicio.
 * @returns {number|null}  peso de arranque, o null si no hay pico que recortar.
 */
export function suggestDeload({ peakKg } = {}) {
  if (peakKg == null || peakKg <= 0) return null
  const target = snapToStep(peakKg * (1 - DELOAD_FRACTION))
  // Si el redondeo devuelve el propio pico (pesos pequeños donde el 10% no
  // llega a un escalón), bajamos un escalón a mano: un "deload" que no baja
  // nada no es un deload.
  if (target >= peakKg) return Math.max(0, snapToStep(peakKg - STEP_KG))
  return target
}
