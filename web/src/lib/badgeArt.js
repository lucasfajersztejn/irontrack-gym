// Maps badge slugs to artwork files.

const SVG_SLUG = {
  // Streak
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
  // Milestones
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
  // Volume
  'volume-1000': 'primera-tonelada',
  'volume-10000': 'diez-toneladas',
  'volume-100000': 'cien-toneladas',
  'volume-500000': 'medio-millon',
  'session-volume-500': 'media-tonelada-diaria',
  'session-volume-1500': 'levanta-un-coche',
  'weekly-volume-up': 'volumen-semanal',
  // Variety
  'body-parts-5': 'explorador',
  'body-parts-all': 'cuerpo-completo',
  'body-parts-week-6': 'full-body-day',
  'exercises-25': 'curioso',
  'exercises-100': 'catalogo-abierto',
  'all-parts-30d': 'sin-favoritismos',
  'first-cardio': 'cardio-cuenta',
  // Rarity
  'weekend-10': 'fiel-al-finde',
  'early-bird': 'madrugador',
  'night-owl': 'buho-nocturno',
  'night-owl-10': 'criatura-nocturna',
  'comeback': 'vuelta-al-ruedo',
  'comeback-14': 'segundo-aire',
}

// Build the artwork URL for a badge.
export function badgeArtUrl({ slug, tier, unlocked }) {
  const art = SVG_SLUG[slug]
  if (!art) return null
  return unlocked
    ? `/badges/ganadas/${art}-${tier}.svg`
    : `/badges/bloqueadas/${art}-bloqueada.svg`
}
