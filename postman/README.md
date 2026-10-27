# IronTrack · Pruebas con Postman

Esta carpeta contiene la **colección de Postman** que uso para probar la API
mientras aún no hay frontend. Sirve también de documentación viva: el
recruiter que mire el repo puede importar la colección y ejecutar cada
endpoint para ver qué devuelve.

## Qué hay dentro

| Archivo | Qué es |
|---|---|
| `IronTrack.postman_collection.json` | La colección completa en formato v2.1.0 — importable directamente en Postman desde "Import → File". |

Variable de colección: `baseUrl` por defecto a `http://localhost:5000`.
Si levantas la API en otro puerto, edítala en la pestaña **Variables** de la
colección (no en cada request).

Carpetas de la colección:

- **Health** · `/health`, `/api/auth/ok`. No requieren sesión.
- **Auth** · Documenta el flujo OAuth. La request principal se abre **en el
  navegador**, no desde Postman (ver abajo).
- **Me** · `/api/me`, `/api/me/username`. Requieren cookie.
- **Exercises** · Catálogo público, varios filtros documentados.

---

## Cómo probar la API paso a paso

### 1. Levanta la API

Desde `api/`:

```bash
# Si tu red local no resuelve los SRV de Atlas, añade FORCE_IPV4_DNS=1:
FORCE_IPV4_DNS=1 npm run dev
```

Debería imprimir `MongoDB conectado: …` y `Servidor corriendo en puerto 5000`.

### 2. Importa la colección en Postman

`File → Import → Upload Files → IronTrack.postman_collection.json`.

### 3. Prueba primero los endpoints públicos

Dispara desde Postman:

- `Health → GET /health` → `200 {status:"ok"}`
- `Health → GET /api/auth/ok` → `200 {ok:true}`
- `Exercises → GET /api/exercises?muscle=biceps` → lista de ejercicios

Si estos funcionan, el servidor y Better Auth están correctamente montados.

### 4. Haz login con Google (desde el navegador)

Postman **no puede** ejecutar el flujo OAuth entero porque la pantalla de
consentimiento de Google necesita un navegador real. Esto es exactamente lo
que va a hacer tu frontend cuando esté hecho, así que no es un atajo: es el
flujo correcto, con Postman sustituyendo solo al cliente autenticado.

Copia esta URL al navegador (es la misma que guarda la request
"Google sign-in" en la carpeta Auth):

```
http://localhost:5000/api/auth/sign-in/social?provider=google&callbackURL=http://localhost:5000/health
```

Pasos:

1. El navegador te lleva a Google. Elige tu cuenta y acepta.
2. Google te redirige de vuelta a la API, Better Auth crea tu usuario +
   sesión y te deja en `/health`.
3. Abre **DevTools → Application → Cookies → http://localhost:5000**.
4. Localiza la cookie `better-auth.session_token`. Copia su **valor**
   completo (es largo).

### 5. Mete la cookie en Postman

Opción A (más cómoda) — **cookie jar global de Postman**:

1. En Postman, botón **Cookies** debajo de la barra de la URL (icono con el nombre `Cookies`).
2. "Add Cookie" para el dominio `localhost`.
3. Pega:
   - Nombre: `better-auth.session_token`
   - Valor: lo que copiaste
   - Path: `/`
   - Caduca cuando quieras (default una semana vale).
4. Guarda. Postman inyectará la cookie automáticamente en toda petición a
   `localhost:5000`.

Opción B — a mano por request: en la pestaña **Headers** de cada request,
añade `Cookie: better-auth.session_token=…`. Más tedioso, pero sirve.

### 6. Prueba los endpoints autenticados

- `Me → GET /api/me`
  - Primera vez: `needsOnboarding: true`, `username: null`.
- `Me → POST /api/me/username` con body `{ "username": "lucas" }`
  - `200 { "username": "lucas" }`.
- `Me → GET /api/me` otra vez
  - Ahora: `needsOnboarding: false`, `username: "lucas"`.

### 7. (Opcional) Cerrar sesión

- `Auth → POST /api/auth/sign-out` → `200 {success:true}` y la cookie queda
  limpia.
- Si vuelves a llamar a `/api/me`, debería devolver 401.

---

## Qué defender en entrevista

- **La API tiene flujo OAuth real**, no un login simulado. Lo pruebo con
  navegador + Postman porque es exactamente el patrón que seguirán el
  frontend y una app móvil (navegador o WebView maneja el consentimiento;
  cualquier cliente autenticado reutiliza la cookie).
- **La separación backend-frontend ya se ve aquí.** `/api/me` devuelve
  `needsOnboarding`; el frontend (o aquí, el humano con Postman) decide a
  dónde va después. Testar esto como un redirect sería mucho más frágil.
- **La colección documenta la API**. Un recruiter puede importarla y
  entender qué endpoints existen, qué query params aceptan y qué errores
  pueden salir, sin leer una línea de código.

---

## Mantenerla al día

Cada vez que añadas un endpoint, actualiza la colección: añade la request
en la carpeta que corresponde, con **description** explicando qué devuelve y
qué errores posibles tiene. La colección cuenta como documentación: si no
está, el endpoint no existe para quien lee el repo.
