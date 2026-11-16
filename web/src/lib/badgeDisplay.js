// Shared badge display helpers.

// Flat-top hexagon clip-path.
export const HEX_CLIP =
  'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

// Pick a localized { es, en } field, falling back to es.
export function localized(field, lang) {
  if (!field) return ''
  return field[lang] ?? field.es ?? field.en ?? ''
}
