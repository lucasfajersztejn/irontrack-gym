import { api } from './api.js'

/*
  Arranca (o resume) una sesión y devuelve el documento.

  Extraído de Training.jsx para que el FAB del navbar y la card "Continuar"
  en Home disparen exactamente el mismo flujo — si vive en dos sitios acaba
  divergiendo. El contrato con 409:

    POST /api/sessions puede fallar con 409 si el usuario ya tiene una
    sesión activa. En ese caso NO reintentamos el POST (duplicaría). En su
    lugar hacemos GET /api/sessions/active para recuperar la que ya hay y
    la devolvemos como resultado: desde fuera "arrancar" y "continuar" se
    ven igual, y es exactamente lo que queremos para un botón único.

  Parámetros:
    - routineId: string | null. null => sesión libre sin plantilla.
*/
export async function startSession(routineId) {
  try {
    // Zona horaria del dispositivo AHORA, al arrancar. El backend la congela en
    // la sesión para derivar el día/semana local del entreno (medallas de
    // calendario), independiente de desde dónde se consulte luego.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    const created = await api('/api/sessions', {
      method: 'POST',
      body: routineId ? { routine: routineId, timeZone } : { timeZone },
    })
    return created
  } catch (err) {
    if (err?.status === 409) {
      // La sesión activa ya existe. Rehidratamos antes que inventar.
      return await api('/api/sessions/active')
    }
    throw err
  }
}
