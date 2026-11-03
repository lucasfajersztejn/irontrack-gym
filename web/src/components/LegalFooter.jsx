/*
  Footer legal del flujo de login. Los href van a "#" por ahora: todavía no
  hay documentos de Términos ni Privacidad. Cuando los haya, apuntar aquí.
*/
// Los anchors llevan `inline-block py-1 -my-1`: añade 4 px de padding
// vertical para que el target sea ≥24 px efectivos (WCAG 2.5.8), y
// cancela ese espacio con margin negativo para que la línea de texto
// no crezca. El resultado se lee igual pero el pulgar tiene aire.
import { Trans } from 'react-i18next'

export default function LegalFooter() {
  // Trans interpola los dos enlaces DENTRO de la frase traducida: el orden de
  // "Términos" y "Privacidad" puede cambiar entre idiomas, y partir la frase
  // en trozos sueltos rompería la gramática. Los <terms>/<privacy> del bundle
  // se mapean a estos anchors por nombre.
  return (
    <p className="text-center text-xs text-text-muted">
      <Trans
        i18nKey="landing.legal"
        components={{
          terms: (
            <a href="#" className="-my-1 inline-block py-1 text-link hover:underline" />
          ),
          privacy: (
            <a href="#" className="-my-1 inline-block py-1 text-link hover:underline" />
          ),
        }}
      />
    </p>
  )
}
