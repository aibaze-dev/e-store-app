# Guía para trabajar sobre la base general

Leé `README.md`, `STYLE_GUIDE.md`, `package.json` y el brief antes de editar. Esta base es una aplicación React/Vite con Convex, Better Auth y Convex Static Hosting; todavía no tiene módulos de negocio. Implementá el producto solicitado sobre este stack. Conservá las personalizaciones existentes al hacer cambios posteriores.

## Marca, presentación y archivos

- `src/App.jsx`: presentación inicial, acceso y composición de la app. Esta base no incluye una landing comercial completa ni `businessData.json` en la carpeta base. El generador crea `src/config/businessData.json` con país, estado/provincia, moneda, locale, zona horaria y centro del mapa cuando se confirma la ubicación en el formulario. Usá esa configuración al implementar importes, fechas y mapas, conservá los valores confirmados durante la generación y documentá cambios posteriores.
- `src/config/brandData.json` contiene `name`, `shortName` y `logoUrl`, usados en el acceso. El generador incorpora el logo subido como `/company-logo.svg`. Para ampliar la marca, centralizá colores, textos y contacto en esta configuración, conectalos a la interfaz y documentá sus campos. No dupliques esos valores en componentes.
- `src/theme.css`: tokens, Tailwind y fuente. `src/styles.css`: composición visual. Reutilizá `src/components/ui` según `STYLE_GUIDE.md`.
- `index.html` y `public/`: metadatos y recursos públicos. Los cambios de marca deben reflejarse también aquí cuando corresponda.
- `convex/schema.ts`: esquema de negocio inicialmente vacío. Agregá queries y mutations con validación en servidor. Los módulos Convex no admiten guiones en sus nombres.

## Datos y acceso

Persistí datos reales en Convex. No uses localStorage como base de negocio, cuentas inventadas ni datos demo en producción. Ofrecé estados vacíos, de carga y de error.

El registro email/contraseña está abierto por defecto y no concede roles. Implementá permisos según el brief; no otorgues administración por el simple hecho de registrarse. Cada función privada debe llamar `requireUser` de `convex/auth.ts` y validar propiedad/permisos en servidor. Esperá `useConvexAuth().isAuthenticated` antes de consultar datos privados. Correo, recuperación, OAuth y MFA requieren implementación y configuración propias.

## Entorno e infraestructura

- `.env.example` documenta nombres; `.env.local` es local e ignorado por Git. Nunca guardes credenciales reales en código, JSON, documentación o archivos versionados.
- `VITE_CONVEX_URL` y `VITE_CONVEX_SITE_URL` son URLs públicas del cliente. Toda variable `VITE_` puede ser visible en el navegador.
- `BETTER_AUTH_SECRET` y `SITE_URL` se configuran en Convex; el generador los prepara por proyecto. `CONVEX_DEPLOY_KEY` permanece privada, en el entorno de despliegue/GitHub Secrets.
- Esta base no incluye Google Maps ni recibe sus variables compartidas automáticamente.
- Conservá scripts y dependencias existentes, `src/main.jsx`, `vite.config.js`, `components.json`, `jsconfig.json`, `convex.json`, `convex/convex.config.ts`, `convex/auth.config.ts`, `convex/lib/auth_origins.js`, `src/lib/auth-client.js` y `.github/`. No edites `convex/_generated/` a mano.
- Al ampliar `convex/http.ts`, conservá las rutas de Better Auth y Static Hosting. Las HTTP actions nuevas van bajo `/api/...`.

## Verificación y mantenimiento

Usá `pnpm test` para verificar autenticación/permisos y las reglas que agregues; `pnpm build` para compilar. Configurá `VITE_CONVEX_URL` para incluir la aplicación completa en el build. Revisá móvil, escritorio y estados vacíos/error. Documentá configuración pendiente y resultados reales en `IMPLEMENTATION.md`/`ASSUMPTIONS.md` cuando trabajes mediante el generador; no afirmes pruebas cloud que no ejecutaste.

En el workspace de AI Generator, editá `project-base/` y ejecutá `pnpm template:sync` desde `generator-api/`: también copia esta guía a `templates/project-base/`. En un repositorio generado independiente, editá directamente sus archivos; no necesita esa sincronización. Los cambios de la base no migran aplicaciones ya creadas.
