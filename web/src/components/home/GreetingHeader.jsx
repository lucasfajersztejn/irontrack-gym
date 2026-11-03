import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'

/*
  Encabezado de Home: fecha larga + saludo con el username. Usar
  Intl.DateTimeFormat con el locale del usuario (y no una tabla hardcodeada
  de meses) deja el formato en manos del navegador: "jueves, 29 de octubre"
  en ES, "Thursday, Oct 29" en EN, y lo mismo si mañana se añade otro idioma.
*/
export default function GreetingHeader() {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const name = user?.username ?? user?.name ?? '—'

  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const date = dateFmt.format(new Date())
  const dateCap = date.charAt(0).toUpperCase() + date.slice(1)

  return (
    <header>
      <h1
        className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-text"
        style={{ textWrap: 'balance' }}
      >
        {t('home.greeting', { username: name })}
      </h1>
      <p className="mt-2 text-sm text-text-muted">{dateCap}</p>
    </header>
  )
}
