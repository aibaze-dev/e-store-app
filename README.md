# Base de proyectos Aibaze · React + Convex

Guía para agentes de IA: [AGENTS.md](AGENTS.md), con el mapa de configuración, reglas que conservar, variables de entorno y verificaciones.

Una base sin módulos de negocio, con frontend Vite, Better Auth y hosting estático en Convex. No tiene módulos comerciales ni integraciones heredadas. El generador crea las tablas, queries y mutations necesarias para cada brief. No necesita Vercel.

El formulario Empresa y marca del generador permite adjuntar un logo PNG, JPG o WebP de hasta 5 MB. Se optimiza conservando proporciones y transparencia y se incluye como `public/company-logo.svg` (imagen PNG embebida, sin servicios externos). `src/config/brandData.json` usa `logoUrl: "/company-logo.svg"`. Para cambiarlo después, reemplazar el recurso o editar esa ruta. Nunca poner credenciales en este JSON.

## Desarrollo

La interfaz incluye un login responsive con shadcn/ui, Tailwind CSS 4 y Montserrat local. Los componentes reutilizables están en `src/components/ui`; `components.json` permite agregar más con el CLI de shadcn. Las reglas de marca, espaciado, formularios, estados y accesibilidad están en [STYLE_GUIDE.md](STYLE_GUIDE.md).

```sh
pnpm install
pnpm backend
```

Si el generador ya preparó el proyecto, podés copiar `.env.example` a `.env.local` y ejecutar `pnpm dev` para usar el Convex configurado.

Para un backend de desarrollo separado, Convex configura el deployment de desarrollo y `.env.local`. En otra terminal, ejecutar `pnpm dev`.

El frontend usa `VITE_CONVEX_URL` para queries/mutations y `VITE_CONVEX_SITE_URL` para auth (si falta, se deriva de la URL `.convex.cloud`). La pantalla inicial incluye registro, login y logout reemplazables; `convex/schema.ts` sigue vacío. Better Auth guarda usuarios y sesiones en su componente. El generador implementa datos persistentes, validación, permisos e integraciones según el brief. Cada proyecto tiene su propia configuración de proveedores; las operaciones que requieran credenciales pendientes permanecen bloqueadas y documentadas. El sitio se publica en Internet y el acceso a sus datos se controla en el backend.

## Publicación

Con `CONVEX_DEPLOY_KEY` de producción configurada:

```sh
pnpm run deploy
```

El componente oficial `@convex-dev/static-hosting` construye Vite, despliega Convex y sube `dist`. La app queda en `https://<deployment>.convex.site`. El router registra `/api/auth/*` antes del catch-all del sitio. No agregar `httpPrefix` al componente: duplicaría el prefijo de auth. Las nuevas HTTP actions deben declarar explícitamente su ruta `/api/...`. Las queries/mutations del cliente usan la URL `.convex.cloud`.

El workflow `.github/workflows/deploy.yml` publica automáticamente backend y sitio de Convex con cada push a la rama registrada. El job del sitio espera el backend y ejecuta `static-hosting deploy --skip-convex` en segundo plano; el editor no espera esa publicación ni requiere un botón. Ambos jobs usan `CONVEX_DEPLOY_KEY` de GitHub Secrets. Mantener esta clave fuera del frontend y del repositorio.

El generador puede usar esta carpeta directamente: no hace falta publicarla antes en GitHub. Si querés usarla como template remoto, subí el contenido a un repo, marcá **Template repository** (manteniendo esta base vacía) y configurá su URL en `GITHUB_TEMPLATE_URL` de la API.

## Contrato de generación

`src/config/brandData.json` permite editar `name`, `shortName` y `logoUrl` del acceso. La base todavía no tiene módulos de negocio. Al crear desde el generador, la ubicación confirmada agrega `src/config/businessData.json` con `countryCode`, `countryName`, `stateCode`, `stateName`, `currency`, `locale`, `timeZone`, `mapCenter` y `mapZoom`. Usá esta configuración para importes, fechas y mapas que se implementen. El horario se revisa antes de crear; cambiar el JSON después no convierte saldos ni migra fechas.

- `src/App.jsx` exporta por defecto la app; `src/theme.css` conserva los imports de Tailwind/fuente y los tokens semánticos; `src/styles.css` contiene la composición de la app. Ajustar la marca en los tokens, manteniendo contraste.
- Reutilizar `Button`, `Input`, `Label`, `Card`, `Alert`, `Badge`, `Separator` y `Skeleton`. El alias `@/` apunta a `src/`. Seguir `STYLE_GUIDE.md`; la API entrega esta guía y el kit también cuando usa un template remoto antiguo.
- `src/main.jsx` monta `ConvexBetterAuthProvider`. `src/lib/auth-client.js` exporta `authClient`; `src/components/AuthPanel.jsx` ofrece el formulario reutilizable.
- `convex/schema.ts` y los módulos Convex contienen el modelo y las funciones.
- El generador puede usar `mutationGeneric` / `queryGeneric` y `makeFunctionReference`, o los archivos `_generated` que crea Convex durante deploy. No hay funciones de negocio predefinidas.
- No modificar el workflow, scripts de deploy, entrypoint, `convex/convex.config.ts`, `convex/auth.config.ts`, `convex/lib/auth_origins.js` ni `src/lib/auth-client.js` durante la inferencia. Conservar las rutas de auth/hosting al ampliar `convex/http.ts`.

[Documentación oficial de Static Hosting](https://github.com/get-convex/static-hosting).

## Autenticación y permisos

La plataforma genera un `BETTER_AUTH_SECRET` de 32 bytes por proyecto, lo conserva cifrado y lo sincroniza con Convex junto con `SITE_URL` antes del primer deploy. Los reintentos reutilizan el mismo secreto. El secreto y la deploy key no se entregan al frontend ni al sandbox.

El registro email/contraseña está abierto por defecto, sin verificación de email y sin otorgar roles. Adaptar el registro al producto (`disableSignUp`, invitaciones o aprobación). Cada query/mutation privada debe llamar `requireUser(ctx)` desde `convex/auth.ts` y comprobar propiedad/roles en el servidor. El ID autenticado viene de `user._id`, nunca de un argumento enviado por el navegador. `auth:getCurrentUser` demuestra una query privada. No hay administradores ni datos de ejemplo precargados.

En React, usar `useConvexAuth()` para esperar la autenticación de Convex antes de ejecutar queries privadas (`useQuery(ref, isAuthenticated ? {} : 'skip')`). La sesión de Better Auth por sí sola no confirma que Convex esté conectado.

Se admiten el sitio propio, `http://localhost:5173`, `http://127.0.0.1:5173` y orígenes exactos de `BETTER_AUTH_TRUSTED_ORIGINS` (separados por coma). El portal registra únicamente la URL del preview actual y su vencimiento mediante `AIBAZE_AUTH_PREVIEW_ORIGIN` y `AIBAZE_AUTH_PREVIEW_EXPIRES_AT`. No se confía globalmente en dominios de Vercel, E2B ni Convex. Para otros puertos locales o dominios propios, configurar el origen exacto en Convex.

Para un deployment de desarrollo creado manualmente, configurar allí `BETTER_AUTH_SECRET` (generado aleatoriamente) y `SITE_URL=http://localhost:5173` antes de usar auth. `CONVEX_SITE_URL` lo proporciona Convex. El generador realiza este paso automáticamente para el deployment del proyecto.

No se incluyen envío de correo, recuperación de contraseña, OAuth ni MFA. Implementar sus flujos y proveedores cuando el producto los requiera; no mostrar acciones de recuperación sin un servicio de correo conectado.

## Verificación

`pnpm test` ejecuta las rutas HTTP reales de Better Auth con `convex-test`: registro, login, sesión, token Convex, logout, rechazo de consultas sin sesión y controles de origen/CORS con vencimiento del preview. El archivo `test/api.js` es un proxy exclusivo de pruebas; el deployment genera sus bindings reales. `pnpm build` comprueba el frontend. Estas pruebas locales no certifican el despliegue real ni sus variables de entorno.

[Integración oficial Convex + Better Auth para React](https://labs.convex.dev/better-auth/framework-guides/react).
