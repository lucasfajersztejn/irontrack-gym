/*
  Helpers de presentación de insignias compartidos por el muro (Medals) y el
  detalle de medalla (MedalDetail). Viven aquí y no en Medals.jsx para que el
  detalle pueda importarlos sin depender de la ruta (y sin ciclo de imports).
*/

// Flat-top hexagon. aspect-square + este recorte da el medallón.
export const HEX_CLIP =
  'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

// Los campos de texto llegan como { es, en }. Si falta el idioma pedido caemos
// a español, que es el idioma base del catálogo.
export function localized(field, lang) {
  if (!field) return ''
  return field[lang] ?? field.es ?? field.en ?? ''
}
