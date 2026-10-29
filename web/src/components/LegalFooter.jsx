/*
  Footer legal del flujo de login. Los href van a "#" por ahora: todavía no
  hay documentos de Términos ni Privacidad. Cuando los haya, apuntar aquí.
*/
export default function LegalFooter() {
  return (
    <p className="text-center text-xs text-text-muted">
      Al continuar aceptas los{' '}
      <a href="#" className="text-link hover:underline">
        Términos
      </a>{' '}
      y la{' '}
      <a href="#" className="text-link hover:underline">
        Privacidad
      </a>
      .
    </p>
  )
}
