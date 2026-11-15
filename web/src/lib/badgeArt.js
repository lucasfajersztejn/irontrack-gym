/*
  Resuelve la URL del arte SVG de cada insignia.

  Por qué un mapa aquí: el backend siembra slugs semánticos ('streak-7',
  'pr-50', 'volume-1000'…) mientras que los archivos de arte usan slugs
  descriptivos en español ('semana-en-racha', 'maquina-de-records',
  'primera-tonelada'…). El mapa vive en el frontend porque la relación
  slug↔archivo es presentación, no dato de dominio: el backend deja `iconUrl`
  en null a propósito y no hace falta reseed.

  Por qué <img src> y no SVG inline (en el llamador): los medallones ganados
  prefijan sus <defs> con el slug, pero los bloqueados reusan IDs genéricos
  ('lf', 'ls'). Inyectar varios inline en el mismo documento haría colisionar
  esos IDs. Como <img>, cada SVG es su propio documento y no hay colisión.

  Los SVG se sirven desde web/public/badges/, así que Vite los publica en la
  raíz y la URL es estable sin glob del bundler.
*/

const SVG_SLUG = {
  // Constancia
  'streak-7': 'semana-en-racha',
  'streak-30': 'racha-de-fuego',
  'streak-100': 'imparable',
  'goal-week-1': 'semana-completa',
  'goal-week-4': 'ritmo-perfecto',
  'goal-week-12': 'trimestre-perfecto',
  'months-active-6': 'medio-ano-activo',
  'months-active-12': 'ano-de-hierro',
  'active-days-100': 'contribucion-verde',
  'full-week': 'cuadricula-llena',
  'days-in-week-3': 'triple-semanal',
  'streak-10': 'doble-digito',
  'active-days-365': 'ano-en-verde',
  'iron-month': 'mes-de-hierro',
  'weekend-warrior': 'finde-guerrero',
  // Hitos
  'first-session': 'primer-paso',
  'sessions-10': 'primeros-diez',
  'sessions-50': 'habitual',
  'sessions-100': 'veterano',
  'sets-100': 'centurion',
  'sets-1000': 'mil-series',
  'reps-10000': 'maraton-de-reps',
  'session-sets-30': 'gran-sesion',
  'session-sets-20': 'sesion-bestia',
  'weight-100': 'club-tres-digitos',
  'account-age-365': 'aniversario',
  'first-month': 'primer-mes',
  'pr-1': 'record-personal',
  'pr-10': 'rompe-records',
  'pr-50': 'maquina-de-records',
  // Volumen
  'volume-1000': 'primera-tonelada',
  'volume-10000': 'diez-toneladas',
  'volume-100000': 'cien-toneladas',
  'volume-500000': 'medio-millon',
  'session-volume-500': 'media-tonelada-diaria',
  'session-volume-1500': 'levanta-un-coche',
  'weekly-volume-up': 'volumen-semanal',
  // Variedad
  'body-parts-5': 'explorador',
  'body-parts-all': 'cuerpo-completo',
  'body-parts-week-6': 'full-body-day',
  'exercises-25': 'curioso',
  'exercises-100': 'catalogo-abierto',
  'all-parts-30d': 'sin-favoritismos',
  'first-cardio': 'cardio-cuenta',
  // Rareza
  'weekend-10': 'fiel-al-finde',
  'early-bird': 'madrugador',
  'night-owl': 'buho-nocturno',
  'night-owl-10': 'criatura-nocturna',
  'comeback': 'vuelta-al-ruedo',
  'comeback-14': 'segundo-aire',
}

/*
  Devuelve la URL del SVG, o null si el slug no tiene arte (insignias futuras
  sembradas antes de dibujarlas). Con null, el llamador cae al hexágono
  genérico, así que una insignia nueva nunca sale rota.

  El nombre del archivo ganado lleva el tier ('-bronce'|'-plata'|'-oro'), que
  viene en el propio badge; el bloqueado es único por slug.
*/
export function badgeArtUrl({ slug, tier, unlocked }) {
  const art = SVG_SLUG[slug]
  if (!art) return null
  return unlocked
    ? `/badges/ganadas/${art}-${tier}.svg`
    : `/badges/bloqueadas/${art}-bloqueada.svg`
}
