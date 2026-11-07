import { describe, it, expect } from 'vitest'
import User from '../../src/models/user.model.js'

/**
 * Cubre la invariante #4: el filtrado de datos públicos ocurre en el servidor.
 * `toPublicJSON` es el único serializador que se puede devolver a un tercero.
 *
 * Si un día alguien añade un campo privado al schema (ej. `stripeCustomerId`),
 * este test NO lo detecta por sí solo — tendría que ampliarse. Pero sí evita
 * la regresión más obvia: email, settings y favoritos nunca deben salir.
 */
describe('User.toPublicJSON', () => {
  it('expone solo los campos públicos', () => {
    const user = new User({
      email: 'secret@example.com',
      name: 'Lucas',
      image: 'https://cdn/a.png',
      username: 'lucas',
      settings: { locale: 'es', weeklyGoal: 5 },
      favoriteExercises: [],
    })
    const pub = user.toPublicJSON()
    expect(pub).toEqual({
      username: 'lucas',
      name: 'Lucas',
      image: 'https://cdn/a.png',
      createdAt: user.createdAt,
    })
  })

  it('no filtra email', () => {
    const user = new User({ email: 'leak@example.com', username: 'x' })
    expect(user.toPublicJSON().email).toBeUndefined()
  })

  it('no filtra settings', () => {
    const user = new User({
      email: 'a@b.c',
      username: 'x',
      settings: { restTimerSec: 90 },
    })
    expect(user.toPublicJSON().settings).toBeUndefined()
  })
})
