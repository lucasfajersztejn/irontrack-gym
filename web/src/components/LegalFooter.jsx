/*
  Footer legal del flujo de login. Los href van a "#" por ahora: todavía no
  hay documentos de Términos ni Privacidad. Cuando los haya, apuntar aquí.
*/
// Los anchors llevan `inline-block py-1 -my-1`: añade 4 px de padding
// vertical para que el target sea ≥24 px efectivos (WCAG 2.5.8), y
// cancela ese espacio con margin negativo para que la línea de texto
// no crezca. El resultado se lee igual pero el pulgar tiene aire.
export default function LegalFooter() {
  return (
    <p className="text-center text-xs text-text-muted">
      Al continuar aceptas los{' '}
      <a href="#" className="-my-1 inline-block py-1 text-link hover:underline">
        Términos
      </a>{' '}
      y la{' '}
      <a href="#" className="-my-1 inline-block py-1 text-link hover:underline">
        Privacidad
      </a>
      .
    </p>
  )
}
