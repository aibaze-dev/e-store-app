# Base de proyectos Ateneo · React + Convex

Guía para agentes de IA: [AGENTS.md](AGENTS.md), con el mapa de configuración, reglas que conservar, variables de entorno y verificaciones.

Una base sin módulos de negocio, con frontend Vite, Better Auth y hosting estático en Convex. No tiene módulos comerciales ni integraciones heredadas. El generador crea las tablas, queries y mutations necesarias para cada brief. No necesita Vercel.

El formulario Empresa y marca del generador permite adjuntar un logo PNG, JPG o WebP de hasta 5 MB. Se optimiza conservando proporciones y transparencia y se incluye como `public/company-logo.svg` (imagen PNG embebida, sin servicios externos). `src/config/brandData.json` usa `logoUrl: "/company-logo.svg"`. Para cambiarlo después, reemplazar el recurso o editar esa ruta. Nunca poner credenciales en este JSON.

## Desarrollo

### Artefactos públicos

El catálogo global `/panel/artefactos` permite abrir herramientas y copiar sus enlaces públicos `/a/:slug`. Se mantienen manualmente en código, con metadatos separados de los componentes lazy y estilos limitados a cada herramienta. El primer recurso es **Prompt Builder**, en `/a/prompt-builder`: un wizard en inglés que construye prompts con plantillas y reglas locales, sin IA. El segundo recurso es **Meeting Prep**, en `/a/meeting-prep`: preparación de reuniones con tarjeta editable, impresión y ensayo de 60 segundos, sin IA ni persistencia. Las herramientas se desarrollan a mano; su ficha comercial (nombre, descripción, portada, estado y presentación de compra) se edita desde el catálogo. Guardar la ficha la habilita como recurso compartido para productos principales, bonos o upsells, con su enlace público como entregable fijo. Ver [cómo agregar un artefacto](src/artifacts/README.md).

La interfaz incluye un login responsive con shadcn/ui, Tailwind CSS 4 y Montserrat local. Los componentes reutilizables están en `src/components/ui`; `components.json` permite agregar más con el CLI de shadcn. Las reglas de marca, espaciado, formularios, estados y accesibilidad están en [STYLE_GUIDE.md](STYLE_GUIDE.md).

```sh
pnpm install
pnpm backend
```

Si el generador ya preparó el proyecto, podés copiar `.env.example` a `.env.local` y ejecutar `pnpm dev` para usar el Convex configurado.

Para un backend de desarrollo separado, Convex configura el deployment de desarrollo y `.env.local`. En otra terminal, ejecutar `pnpm dev`.

El frontend usa `VITE_CONVEX_URL` para queries/mutations y `VITE_CONVEX_SITE_URL` para auth (si falta, se deriva de la URL `.convex.cloud`). La pantalla inicial incluye login y logout (el registro está cerrado, ver «Autenticación y permisos»); `convex/schema.ts` sigue vacío. Better Auth guarda usuarios y sesiones en su componente. El generador implementa datos persistentes, validación, permisos e integraciones según el brief. Cada proyecto tiene su propia configuración de proveedores; las operaciones que requieran credenciales pendientes permanecen bloqueadas y documentadas. El sitio se publica en Internet y el acceso a sus datos se controla en el backend.

## Publicación

Para guardar los cambios, subirlos a `origin main` y publicar en Convex, con las variables de despliegue en `.env`:

```sh
npm run deploy -- "mensaje del commit"
```

Ejecuta `git add .`, `git commit -am "mensaje del commit"`, `git push origin main` y `node --env-file=.env --run=deploy:convex`, en ese orden. El script carga explícitamente `.env` antes del último paso para que sus variables lleguen al proceso de despliegue. Se detiene si cualquier paso falla. Se ejecuta desde `main`; si no hay cambios nuevos, omite el commit y vuelve a publicar el commit actual. El mensaje es obligatorio.

Para publicar sin crear un commit ni hacer push, con las variables ya cargadas en el entorno: `pnpm run deploy:convex`.

Al terminar la subida, `scripts/verify-deploy.mjs` compara por SHA-256 el HTML público y todos los archivos JS/CSS de `dist`, incluidos los chunks diferidos. Consulta el HTML de nuevo al terminar para detectar un deploy simultáneo. Usa `VITE_CONVEX_SITE_URL` (o `SITE_URL`) como destino; un archivo distinto, faltante, timeout o error HTTP devuelve error y no informa éxito. Al completar la comprobación, la consola muestra solo `Deploy OK` con fecha y hora UTC en formato ISO.

Para comprobar el sitio sin publicar, crear commits ni hacer push: `pnpm run deploy:verify`. Carga `.env` y compara el sitio con el `dist` local existente; no reconstruye ni modifica producción. Una pestaña abierta conserva el JavaScript que ya cargó: después del deploy hay que recargarla por completo si todavía muestra lo anterior (Cmd+Shift+R en Mac / Ctrl+Shift+R en Windows).

Verificación del 18/11/2026: el sitio `https://capable-gnu-944.convex.site/` devolvió el mismo HTML y los 11 archivos JS/CSS del build local (`bed3eb328912`), incluida la clase `purchase-toast` sin borde. Pasaron 188 pruebas, con casos de HTML/CSS antiguos, chunk faltante y despliegue concurrente. El workflow de GitHub es independiente del comando local: su último run observado falló en el backend y omitió el sitio; eso no impidió la publicación local verificada. No se ejecutó otro deploy durante este diagnóstico.


El componente oficial `@convex-dev/static-hosting` construye Vite, despliega Convex y sube `dist`. La app queda en `https://<deployment>.convex.site`. El router registra `/api/auth/*` antes del catch-all del sitio. No agregar `httpPrefix` al componente: duplicaría el prefijo de auth. Las nuevas HTTP actions deben declarar explícitamente su ruta `/api/...`. Las queries/mutations del cliente usan la URL `.convex.cloud`.

GitHub Actions está pausado en el código: el workflow se conserva en `.github/workflows-disabled/deploy.yml`, fuera de la carpeta que ejecuta GitHub. No hay workflows activos. Al subir este cambio, el repositorio deja de ofrecer también el lanzamiento manual de ese workflow. Los despliegues se realizan desde la máquina local con los comandos anteriores; ver [pausa y reactivación de Actions](.github/README.md). Mantener `CONVEX_DEPLOY_KEY` fuera del frontend y del repositorio.

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

El registro email/contraseña está cerrado (`disableSignUp` en `convex/auth.ts`): hay un único usuario interno y los compradores no tienen cuenta. Solo se abre con `AUTH_SIGNUP_ENABLED=true` en Convex, sin verificación de email y sin otorgar roles; el acceso al panel sigue dependiendo de `ADMIN_EMAILS`. La contraseña se cambia desde el ícono de llave al pie del sidebar del panel (`src/panel/ChangePasswordDialog.jsx`): pide la actual, exige 12 caracteres o más en la nueva y cierra las sesiones de los otros dispositivos. Cada query/mutation privada debe llamar `requireUser(ctx)` desde `convex/auth.ts` y comprobar propiedad/roles en el servidor. El ID autenticado viene de `user._id`, nunca de un argumento enviado por el navegador. `auth:getCurrentUser` demuestra una query privada. No hay administradores ni datos de ejemplo precargados.

En React, usar `useConvexAuth()` para esperar la autenticación de Convex antes de ejecutar queries privadas (`useQuery(ref, isAuthenticated ? {} : 'skip')`). La sesión de Better Auth por sí sola no confirma que Convex esté conectado.

Se admiten el sitio propio, `http://localhost:5173`, `http://127.0.0.1:5173` y orígenes exactos de `BETTER_AUTH_TRUSTED_ORIGINS` (separados por coma). El portal registra únicamente la URL del preview actual y su vencimiento mediante `ATENEO_AUTH_PREVIEW_ORIGIN` y `ATENEO_AUTH_PREVIEW_EXPIRES_AT`. No se confía globalmente en dominios de Vercel, E2B ni Convex. Para otros puertos locales o dominios propios, configurar el origen exacto en Convex.

La identidad está centralizada en `src/config/brandData.json` como Ateneo. El prefijo de almacenamiento del cliente de autenticación es `ateneo-<siteUrl>`; al actualizar desde la versión anterior puede ser necesario iniciar sesión nuevamente. Las integraciones de previews deben configurar los nombres `ATENEO_AUTH_PREVIEW_ORIGIN` y `ATENEO_AUTH_PREVIEW_EXPIRES_AT` en Convex antes de usar previews temporales. Este cambio no modifica variables del backend desplegado ni credenciales de usuarios.

Para un deployment de desarrollo creado manualmente, configurar allí `BETTER_AUTH_SECRET` (generado aleatoriamente) y `SITE_URL=http://localhost:5173` antes de usar auth. `CONVEX_SITE_URL` lo proporciona Convex. El generador realiza este paso automáticamente para el deployment del proyecto.

No se incluyen envío de correo, recuperación de contraseña, OAuth ni MFA. Implementar sus flujos y proveedores cuando el producto los requiera; no mostrar acciones de recuperación sin un servicio de correo conectado.

## Verificación

`pnpm test` ejecuta las rutas HTTP reales de Better Auth con `convex-test`: registro, login, sesión, token Convex, logout, rechazo de consultas sin sesión y controles de origen/CORS con vencimiento del preview. El archivo `test/api.js` es un proxy exclusivo de pruebas; el deployment genera sus bindings reales. `pnpm build` comprueba el frontend. Estas pruebas locales no certifican el despliegue real ni sus variables de entorno.

[Integración oficial Convex + Better Auth para React](https://labs.convex.dev/better-auth/framework-guides/react).

## Campañas de ebooks (v1)

Módulos de negocio sobre esta base; el contexto y las decisiones están en [context.md](context.md).

Los documentos del catálogo (`products`) se guardan con `type: "e-book"`, asignado por el servidor al crear o editar. El campo es opcional en el esquema para aceptar registros anteriores; estos reciben el valor cuando se editan.

- **Panel** (`/panel`): inicio por tienda con selector en el sidebar, links públicos de landing, quiz y checkout con acciones para copiar y abrir, y oferta asociada. El link del quiz se habilita con su propia publicación y la tienda activa. Cada tienda reúne producto principal, bonus y upsells en «Productos y oferta», con desplegables y un guardado común; conserva secciones de post-compra, landing, checkout y cobros; el catálogo se comparte. Solo entran los emails de `ADMIN_EMAILS`.
- **Landing pública**: `<subdominio>.<dominio base>` y también `/l/<subdominio>` en el dominio base. El subdominio requiere configurar DNS y dominio en el hosting; no asumir soporte wildcard. Eso no está configurado ni verificado. La ruta funciona sin configuración extra.
- **Checkout**: formulario propio con Stripe Payment Element y Checkout Sessions (`ui_mode: elements`) en el checkout principal, el downsell y la post-compra; ya no se usa Embedded Checkout. El downsell pide los mismos datos personales; la post-compra reutiliza el email del comprador (`customer_email`) y el nombre de la primera compra, y solo pide email si faltara. El servidor calcula los importes desde la tienda y confirma los pagos solo por webhook firmado.
- **Links**: se muestran en `/gracias?session_id=...` cuando el pago está confirmado y, con Resend configurado, también se envían por email al comprador. La página de gracias y la oferta post-compra usan el mismo diseño de la landing (`PurchaseLanding` en `src/templates/PostPurchaseContent.jsx`): color, encabezado, botones y footer de la presentación publicada, que `storefront.getDelivery` devuelve en `presentation`.
- **Estados del cobro**: `pending` → `paid` (webhook firmado con monto y moneda iguales a la orden), `expired` (sesión abandonada), `failed` (un medio diferido como ACH/SEPA fue rechazado: `async_payment_failed`), `needs_review` (Stripe cobró un monto o moneda distinto a la orden: no se entregan links, el panel muestra lo cobrado y se avisa por email a `ADMIN_EMAILS`) y `refunded` (reembolso total, también desde `needs_review`).
- **Emails** (`convex/emails.ts`, `convex/lib/resend.ts`): se encolan dentro de la misma mutación del webhook, así que solo salen si el pago quedó registrado. Usan `Idempotency-Key` por transacción, reintentan errores temporales (429/5xx/red) hasta 5 veces con espera creciente y no se envían si la compra se reembolsó antes. El estado del envío se ve en «Cobros y entregas».

Configuración pendiente (variables de Convex, salvo la indicada):

| Variable | Uso |
| --- | --- |
| `ADMIN_EMAILS` | Emails con acceso al panel, separados por coma. Cada email necesita una cuenta existente (ver `AUTH_SIGNUP_ENABLED`). |
| `ADMIN_ALLOWED_IPS` | IPs o rangos CIDR (IPv4 o IPv6) separados por coma que ven el login en la raíz del dominio. Desde cualquier otra IP la raíz queda en blanco y `/api/auth/sign-in/*` y `/api/auth/sign-up/*` responden 404, aunque la contraseña sea correcta. Las sesiones ya abiertas siguen funcionando desde cualquier IP. Sin definir, no hay restricción. Si tu conexión usa IPv6 con direcciones temporales, agregá el prefijo `/64` y no una dirección suelta. Las IPs rechazadas quedan en los logs de Convex («Login hidden for IP …»), y ahí podés ver cuál agregar si cambia la tuya. |
| `AUTH_SIGNUP_ENABLED` | Sin definir, el registro está cerrado en el servidor y la pantalla solo ofrece login. Para crear una cuenta nueva, ponerla en `true`, llamar a `POST /api/auth/sign-up/email` y volver a borrarla. Mientras está en `true` el registro queda abierto a cualquiera y no verifica el correo. |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe. Sin ella no se puede iniciar un pago. |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook `https://<deployment>.convex.site/api/stripe/webhook`, con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` y `charge.refunded`. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clave publicable, en el entorno del build del frontend. |
| `RESEND_API_KEY` | Clave de Resend para el email de entrega al comprador y el aviso de cobros a revisar. Sin ella (o sin `EMAIL_FROM`) no se envía nada y la orden lo indica en el panel. |
| `EMAIL_FROM` | Remitente, por ejemplo `Mi Tienda <ventas@midominio.com>`. El dominio tiene que estar verificado en Resend. |
| `EMAIL_REPLY_TO` | Opcional. Dirección para las respuestas del comprador. |
| `DISCORD_SALE_BOT_URL` | Opcional. URL de un webhook de Discord: cada venta confirmada por Stripe publica ahí solo `🔥 NUEVA VENTA 🔥 - <total>`, sin productos ni datos del comprador. Es una credencial: solo en Convex. |
| `OPENAI_API_KEY` | Clave de la API de OpenAI para el asistente de textos de la landing. Sin ella el asistente avisa que no está habilitado; el resto del panel funciona igual. |
| `OPENAI_MODEL` | Opcional. Modelo a usar; por defecto `gpt-6.2-sol`. Debe aceptar Structured Outputs (`response_format` con `json_schema`). |

`pnpm test` cubre permisos del panel, landing pública, cálculo de importes, idempotencia, webhook (incluidos `failed` y `needs_review`), emails y post-compra con Stripe y Resend simulados. No se ejecutó ningún pago contra Stripe real, no se envió ningún email real por Resend ni se probó la app desplegada.

La landing usa una plantilla fija de venta con un formulario de 16 secciones y vista previa en vivo (celular/escritorio). Incluye presentación, bonos, beneficios, problemas, testimonios de texto o captura, resumen de compra, pasos, garantía, FAQ, cierre, botón fijo, promoción e identidad. Las secciones opcionales se pueden ocultar; las listas vacías no se muestran. Las imágenes se suben como archivos a Convex Storage. Antes de subirlas, el panel reduce las fotos JPG y PNG a un máximo de 1600 px por lado y las convierte a WebP (`src/panel/compress-image.js`); en navegadores que no escriben WebP, como Safari, quedan en JPEG, salvo los PNG con transparencia. GIF, WebP y AVIF se suben sin cambios. Convex Storage entrega cada archivo tal como se subió, así que las fotos cargadas antes de este cambio conservan su peso hasta que se vuelvan a subir.

El asistente de textos (`landing_wizard:generate`) hace cinco preguntas (público, problema, resultado, diferencial, tono y garantía) y completa presentación, beneficios, problemas, pasos, preguntas frecuentes, garantía, cierre, textos de promoción y actividad y encabezados de testimonios usando además el nombre, la descripción y los bonos de la tienda. Al terminar, el panel carga el resultado en el formulario, lo guarda como borrador y abre la vista previa; publicar sigue siendo un paso aparte. Genera además 4 testimonios ficticios en formato conversación, adaptados al ebook y al público, que se muestran en el carrusel con cinco estrellas en todos los formatos, sin etiquetas de ejemplo o IA. El marcador interno `isExample` se conserva para reemplazar los textos generados al regenerar; no se muestra en la landing. Se pueden editar; al regenerar se reemplazan los ejemplos anteriores y se conservan los testimonios agregados a mano, hasta el límite de 12 elementos. No inventa ni reemplaza métricas, cupos, fechas, opciones activadas, imágenes, precios ni enlaces, y solo redacta garantía si se indican los días. Las respuestas se envían a OpenAI. Está cubierto con OpenAI simulado; no se probó contra la API real.

La landing pública y su checkout muestran el popup «Pará un segundo» (`src/storefront/ExitIntentModal.jsx`) cuando el mouse sale del documento por cualquier borde, con un mínimo de 10 segundos entre apariciones. Los eventos anteriores a ese intervalo se ignoran, sin programar una apertura ni reiniciar la espera. El intervalo se cuenta desde la última apertura y se comparte en memoria por tienda entre landing y checkout durante la navegación. No hay límite de apariciones por sesión ni por pestaña; mientras está abierto no se vuelve a disparar. No se activa con gestos táctiles ni en la vista previa del panel. El copy está centralizado en `src/storefront/exitIntent.js` y se arma con la oferta real (bonos, ahorro y garantía solo si están configurados).

**Downsell.** Con el downsell activado (sección Downsell del panel), el primer «atrás» del visitante en la landing o el checkout abre un cartel (`src/storefront/DownsellModal.jsx`), una vez por pestaña. Si acepta, va a `/oferta`: producto principal con sus bonos, sin extras, con el descuento porcentual de la tienda. `/oferta` puede mostrar un video VSL opcional (campo «Video VSL de la oferta» en la sección Downsell; YouTube, Vimeo o video subido, validado en `convex/stores.ts`).

**Post-compra en modal.** En `/gracias` la oferta post-compra se abre en un modal apenas carga la página (`src/storefront/PostPurchaseModal.jsx`; reglas en `postPurchaseFunnel.js`). «No» pasa, dentro del mismo modal, al descuento post-compra si la tienda lo configuró; otro «No» cierra el modal y quedan los links. Si el comprador vuelve a la pestaña (una vez) o el mouse sale de la página (hasta dos veces), el modal se reabre en el siguiente paso no rechazado y, después del descuento, ofrece un último descuento fijo: 10 puntos más que el downsell post-compra (10% si no hay downsell), con tope de 90%. Al aceptar, el pago se carga dentro del modal. El avance se guarda por compra en `sessionStorage`. El importe lo calcula siempre el servidor (`convex/lib/pricing.ts`) y la orden queda marcada con `downsell` (y `finalDownsell` en el último descuento). Los navegadores solo permiten interceptar «atrás» después de que el visitante interactuó con la página (un toque, clic o tecla); quien solo hizo scroll sale sin ver el cartel. El contador de `/oferta` es el mismo simulado del checkout y no cambia precios.

El checkout público tiene dos columnas: datos personales y pago a la izquierda, extras y resumen a la derecha. Solo se piden email y nombre (sin apellido ni teléfono); el resto es el Payment Element de Stripe, sin el recuadro opcional de Link (`wallets.link: 'never'`) y con dirección de facturación solo si la tarjeta la requiere (`address: 'if_required'`). Los medios de pago se cargan automáticamente. En móvil se apilan y el contador aparece arriba. Los extras siguen editables hasta confirmar; cambiar la selección conserva los datos personales y prepara una sesión para el importe nuevo. Se bloquea la confirmación mientras cambia la sesión, durante el pago y si el importe o moneda de Stripe difiere del resumen. Los reintentos de una misma selección reutilizan la orden/sesión. Los datos de tarjeta nunca pasan por la app: los recoge Payment Element. Los datos personales se envían directamente a Stripe al confirmar, no se persisten en el almacenamiento del navegador. Los links se entregan en pantalla y, si Resend está configurado, por email.

La integración principal usa `CheckoutElementsProvider`, `useCheckoutElements` y `checkout.confirm` con `ui_mode: elements`, como indica la [guía oficial de Stripe](https://docs.stripe.com/payments/quickstart). La sesión usa inglés por defecto y respeta el idioma publicado en el editor de checkout. Los reintentos conservan el idioma de la transacción. Downsell y post-compra usan el mismo formulario (`SessionPayment` en `CheckoutPayment.jsx`) después de que el comprador acepta la oferta. Se crea una orden pendiente al cargar la selección; no representa una venta hasta que llega el webhook válido. `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` y webhook siguen siendo necesarios. Deben desplegarse frontend y backend juntos.

El checkout usa una paleta pública independiente (botón de pago azul, extras oscuros/verdes y ahorro verde), formato monetario de Estados Unidos (`$19.99` para USD y `ARS 16,990.50` para pesos argentinos) y enlaces legales configurados en la landing. La sección Checkout del panel configura avisos demo de compras, título de extras y precios de referencia; el viejo campo `liveVisitors` se conserva por compatibilidad pero no controla la simulación. En Analíticas, «Sesiones activas ahora» muestra la presencia real por tienda. La landing, el quiz y el checkout públicos envían una señal cada 15 segundos mientras la pestaña está visible. El panel cuenta una vez cada sesión con actividad en los últimos 45 segundos y la asigna a su página más reciente.

Por pedido explícito, la barra «N personas están comprando en este momento» usa datos simulados entre 2 y 15 y cambia cada 15 segundos. La landing también puede mostrar espectadores simulados. El contador comienza en un valor al azar entre 14:00 y 15:59 (cerca de 15 minutos) y comparte el vencimiento entre landing y checkout por tienda/pestaña: no reinicia al navegar o recargar. Al llegar a 00:00 arranca un nuevo ciclo al azar, sin modificar precios ni bloquear pagos. Nunca depende de una fecha. Las fuentes están aisladas en `checkoutSignals.js` y `CheckoutSignals.jsx`; el preview del panel usa una muestra fija sin alterar el contador del visitante.

El contenido tiene borrador/publicación. La oferta y sus precios se leen de la tienda: `offer.compareAtPrice` permite mostrar un precio tachado y `offer.bonuses[].referenceValue` el valor informativo de un bono gratuito. Ambos son opcionales, están en unidades monetarias menores y nunca cambian lo cobrado por Stripe. El ahorro se calcula a partir del precio de referencia del principal (o su precio actual) más los valores de los bonos, menos el precio de venta. Cambiar la oferta sigue afectando nuevas visitas sin republicar textos.

El panel ya no ofrece contador por fecha: los datos guardados con `promotion.timerMode: date`/`endsAt` se conservan, pero landing y checkout usan siempre el contador al azar. El formulario también admite cupos informativos, frase de cierre de problemas, calificación, cantidad de clientes y satisfacción. Los números opcionales se validan en servidor y se ocultan si están vacíos; no se precargan reseñas ni métricas de la captura. Los testimonios tienen carrusel manual con flechas, puntos y teclado. La plantilla usa Nunito Sans en títulos, botones degradados, íconos de beneficios en emoji, pasos conectados y precio de referencia/ahorro en la barra inferior.

Los avisos de compra de landing y checkout usan temporalmente `DemoPurchaseToasts`: nombres y ciudades ficticios con la etiqueta visible  Se habilitan con los controles de avisos existentes, incluso sin ventas, y se ven también en la vista previa de la landing. El primero aparece tras 5–12 segundos; cada aviso dura 6 segundos y luego espera otros 12–30 segundos aleatorios. No se repiten consecutivamente el nombre ni la ciudad. Al ocultar la pestaña se detienen y al volver se programa una nueva espera, sin acumular avisos; al salir de la página se limpian los temporizadores. No se escriben compras ni eventos en la base. Por pedido explícito, el contador de ventas de la landing muestra un entero aleatorio entre 540 y 6490, ambos inclusive, estable mientras la landing permanece montada. También se muestra sin pedidos pagados y respeta el interruptor de ventas. Es solo presentación: no modifica órdenes, pagos ni analíticas. El editor identifica esta cifra como simulada; el backend conserva su conteo real.

Para actualizar el entorno desplegado hay que publicar frontend y Convex juntos: se ampliaron los campos opcionales de contenido y oferta. Las listas de beneficios/problemas anteriores (strings) siguen siendo válidas y se convierten a tarjetas en el formulario. No hace falta migrar los documentos existentes. La preferencia claro/oscuro del panel no modifica la plantilla pública.

Cuando una tienda todavía no tiene ajustes propios de checkout, sus avisos heredan la activación de la landing publicada. Guardar el checkout establece una elección independiente: un `false` explícito se respeta aunque la landing tenga avisos activos. El panel muestra el mismo valor heredado. Esta corrección requiere desplegar backend y frontend; no cambia documentos existentes.

## Analíticas por tienda

`/panel/tiendas/:storeId/analiticas` muestra personas estimadas: total de la tienda, quienes vieron la landing y quienes llegaron al checkout. Usa los conteos deduplicados del período; no muestra cargas de página ni una lista de IPs. Incluye gráficos y detalle diario de personas. Ofrece hoy, 7 días, 30 días y fechas personalizadas (hasta 366 días por consulta). Se actualiza al cambiar el período o pulsar Actualizar. El gráfico se carga bajo demanda, fuera del bundle inicial de la landing.

El historial `pageViews` conserva un documento pequeño por vista: `storeId`, `page` (`landing`/`checkout`), `day`, `ipHash` opcional, `eventId` y, cuando la visita llegó desde un enlace de anuncio, `attribution` (ver «Atribución de campañas»); `_creationTime` ya aporta la fecha/hora del servidor. No guarda IP original, user agent, email, referrer ni otros parámetros de URL (tampoco `fbclid`). Los índices permiten filtrar por tienda/fecha, deduplicar reintentos y limitar ráfagas. Los informes recorren páginas de 1000 filas en el servidor para no truncar silenciosamente las métricas. El costo de lectura crece con las vistas del período; para mucho tráfico se podrán incorporar agregados sin cambiar el registro del frontend.

`analytics:recordView` obtiene la IP de `ctx.meta.getRequestMetadata()` (Convex >= 1.38, disponible en la versión instalada), normaliza IPv4/IPv6 y calcula HMAC-SHA256 con un contexto por tienda. La clave es `ANALYTICS_IP_SECRET` o, si no está configurada, `BETTER_AUTH_SECRET`, siempre del servidor. Para independizarla de futuras rotaciones de autenticación, configurar una clave dedicada **antes de comenzar a medir**. Cambiar la clave durante el historial cambia los códigos y puede contar dos veces una misma IP en rangos que crucen esa fecha. No se necesita otra variable del frontend ni un endpoint HTTP adicional.

El hook público mide una vez por navegador, tienda, página y día de negocio. Las recargas, volver a la página y abrir otra pestaña del mismo origen no agregan otro evento confirmado ese día mientras se conserve el almacenamiento. El ID estable de la tienda, expuesto en la vista pública, identifica la marca aunque cambie el subdominio. Re-renders, Strict Mode y reintentos comparten la misma operación y el mismo ID de evento. Checkout se mide al abrirlo, antes de pulsar Pagar. El editor y sus vistas previas no montan el hook. Solo se admiten landings publicadas de tiendas activas. No se genera información retroactiva.

Los únicos se calculan con el hash completo, sin sumar los únicos diarios ni los de landing y checkout. La interfaz no expone los códigos. Cuando no hay IP, la vista se conserva pero no se inventa una identidad para calcular personas. La pantalla avisa si la estimación está incompleta; si hay actividad sin ningún identificador disponible, muestra «—» y un estado de estimación no disponible en lugar de cero personas. Una IP no equivale a una persona. Se descartan ráfagas por encima de 120 vistas por tienda/IP/minuto (las vistas sin IP comparten ese límite); esto no pretende identificar todos los bots. El historial se conserva sin purga automática.

Los días usan `src/config/businessData.json.timeZone` (actualmente `America/Adak`), como el resto de fechas de negocio. Cambiar esa configuración después de acumular datos requiere migrar `day` desde `_creationTime` para mantener una única zona horaria en los reportes.

El informe exige `requireAdmin` y la lectura paginada es interna. Pruebas locales cubren permisos, aislamiento por tienda, IPs faltantes, HMAC, fechas/DST, reintentos y más de 1000 vistas sin truncamiento. `convex-test` no implementa todavía el syscall nativo de metadatos: solo esa fuente de IP se sustituye en las pruebas. La medición real de IP en cloud debe verificarse tras desplegar frontend y backend juntos; no se ejecutó un despliegue durante esta implementación.

Verificación de esta implementación: 72 pruebas pasan; build y chequeo TypeScript del backend correctos. Revisión visual local con fixture temporal en escritorio/móvil, filtros predefinidos, estado vacío, error/reintento, detalle diario y deduplicación con React Strict Mode. El fixture se retiró después de verificarlo. Persiste la advertencia previa del bundle principal mayor a 500 kB; las analíticas se descargan en un chunk aparte. No se publicaron cambios ni se probó una IP real en cloud.

## Atribución de campañas (UTM)

Los anuncios de Meta deben usar esta plantilla de parámetros de URL:

```
?utm_source={{site_source_name}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{placement}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

`shared/attribution.js` define los ocho campos admitidos (`source`, `medium`, `campaign`, `content`, `term`, `campaignId`, `adsetId`, `adId`), su limpieza y el agrupado del informe. Con esta plantilla `utm_medium` es el nombre del conjunto de anuncios y `utm_term` la ubicación. Cada valor se recorta a 150 caracteres; los IDs solo admiten letras, números, `_`, `.` y `-`; se descartan los marcadores sin reemplazar (`{{campaign.name}}`) y cualquier otro parámetro. La limpieza corre en el navegador y otra vez en el servidor antes de guardar.

- **Navegador** (`src/storefront/attribution.js`): `Storefront` lee los parámetros al renderizar cualquier ruta pública y los recuerda por tienda en `localStorage` (`ebook_attribution_<subdominio>`) durante 7 días, con respaldo en memoria si el almacenamiento está bloqueado. Gana el último enlace con parámetros; una visita posterior sin parámetros no lo borra. El almacenamiento solo transporta el dato entre páginas: el historial vive en Convex.
- **Visitas**: `analytics:recordView` guarda `pageViews.attribution`. La deduplicación no cambió (una vista por navegador, tienda, página y día): si alguien entra por dos anuncios el mismo día, cuenta la primera.
- **Quiz**: `quizzes:start` guarda `quizSessions.attribution` al crear la sesión; recuperarla desde otro enlace no la reescribe.
- **Pedidos**: `checkout:start` copia la campaña a `orders.attribution` al crear el pedido. Si el navegador no la envía, un pedido del quiz usa la de su sesión. El pedido post-compra repite la del pedido principal. Un reintento del mismo intento conserva la campaña ya guardada.
- **Stripe**: la campaña del pedido viaja como metadata de la sesión de Checkout y del pago (`payment_intent_data[metadata]`), con los nombres de la URL (`utm_source`, `utm_campaign`, `ad_id`…). Siempre se arma desde el pedido guardado, para que un reintento envíe a Stripe los mismos parámetros que su clave de idempotencia.
- **Panel**: Analíticas muestra «Campañas y anuncios» para el período elegido, agrupable por campaña, conjunto, anuncio, ubicación o fuente: visitas a la landing, visitas al checkout, compras (pedidos principales pagados), conversión y facturación (incluye post-compra). «Sin campaña» reúne accesos directos y enlaces sin parámetros. «Cobros y entregas» muestra campaña y anuncio de cada pedido. Los informes `analytics:report` y `analytics:rollingActivity` devuelven `sources`, una fila por enlace distinto; el panel las suma con `groupSources`. Como `recordView` es público, un informe admite hasta 5000 enlaces distintos; los siguientes se suman en una fila «Otros enlaces».

No hay datos retroactivos: visitas y pedidos anteriores quedan en «Sin campaña». Los campos son opcionales y no requieren migración. Frontend y backend deben publicarse juntos: un frontend nuevo contra un backend anterior enviaría un argumento que este rechaza. Pendiente y no implementado: guardar `fbclid` y enviar compras por Conversions API, e importar el gasto de Meta para calcular ROAS.

Verificación de esta implementación: `pnpm test` (294 pruebas, 12 nuevas en `test/attribution.test.js`) y `pnpm build` correctos. Las pruebas cubren lectura y limpieza de parámetros, memoria del navegador (último enlace, 7 días, almacenamiento bloqueado), guardado en vistas, sesiones de quiz, pedidos y post-compra, metadata enviada a Stripe (con la API simulada) y los informes del panel. Revisión visual local de la tabla y de la captura con un fixture temporal en escritorio y móvil, ya retirado. No se desplegó ni se probó contra Stripe real ni con un clic real de un anuncio de Meta.

### Gráficos de analíticas

La sección usa Recharts con tres visualizaciones: un timeline de líneas y área para el total diario, barras agrupadas por día y barras horizontales para comparar landing/checkout en todo el período. Los tres gráficos muestran únicamente personas estimadas, sin selector de vistas/IPs: `uniques` para la tienda y `landingUniques`/`checkoutUniques` por página. La comparación del período usa el total deduplicado de cada página. Los rangos de más de 31 días incluyen un selector de zoom temporal con soporte de teclado. Tooltips con fecha completa y valores exactos, escalas desde cero, días sin visitas incluidos, y tabla diaria como alternativa accesible. Los únicos de página se muestran por separado; los totales siguen viniendo del informe deduplicado. El componente AnalyticsCharts se carga junto con la sección, sin añadir consultas ni almacenamiento.

Verificación de la mejora visual: 83 pruebas existentes pasan; build correcto. Revisado con datos temporales de prueba en escritorio y móvil, ambos temas, cambio de métrica, tooltip por teclado, zoom temporal, un solo día y estado vacío. Sin despliegue.

### Protección persistente contra duplicados

`src/storefront/visitTracking.js` mantiene `ebook_analytics_browser_id` (UUID aleatorio por navegador/origen) y una clave `ebook_analytics_visit_<storeId>_<landing|checkout>` cuyo valor es `{ day, eventId, confirmed: true }`. La marca se reemplaza cada día: no agrega claves por cada fecha. Las visitas quedan en Convex; localStorage contiene únicamente la protección de envío. Las analíticas estiman personas a partir de los identificadores de los eventos recibidos; los datos históricos anteriores a este cambio conservan su granularidad original y no se borran.

El evento es un SHA-256 determinista de navegador, tienda, página y fecha. El UUID del navegador no se envía al backend. La mutation responde `recorded` o `duplicate` con la fecha del servidor; solo esas respuestas permiten guardar una marca confirmada. Ante pérdida de respuesta o recarga antes de confirmación, el frontend reenvía el mismo evento y el índice `by_store_event` evita la segunda escritura. Una tienda inexistente/inactiva o una ráfaga limitada no genera una marca de éxito. Hay dos reintentos automáticos acotados; volver a estar online o visible permite otro intento.

Web Locks coordina pestañas del mismo origen, tanto al crear el UUID como al registrar cada página. Si no hay Web Locks se mantiene la clave determinista y la idempotencia del servidor; la primera inicialización simultánea entre pestañas sin esta API puede producir IDs de navegador distintos. Si el almacenamiento está bloqueado o lleno, se conserva una protección en memoria durante la vida de la página. Borrar almacenamiento, cambiar de navegador o abrir otro origen reinicia esa identidad: no es una protección contra manipulación. Las IPs únicas siguen deduplicándose en el servidor entre los eventos recibidos. El cambio de IP de un navegador ya contado ese día no crea otro evento. LocalStorage no se comparte entre el dominio base y sus subdominios.

Verificación de esta actualización: 100 pruebas pasan, build y chequeo TypeScript del backend correctos. Incluye recarga, Strict Mode/simultaneidad de envíos, varias páginas/tiendas, cambio de día en la zona de negocio, fecha confirmada por servidor, cuota y bloqueo del almacenamiento, rechazo de locks y respuesta perdida con una única fila en Convex. No se desplegó. Publicar frontend y backend juntos para habilitar las confirmaciones del nuevo protocolo.

### Textos de testimonios, promoción y actividad

En Landing → Testimonios se puede editar el texto superior, título y subtítulo, y elegir por testimonio texto/captura o conversación estilo WhatsApp. La conversación usa nombre, mensaje inicial opcional, mensaje del lector y respuesta opcional; no genera testimonios ni estados de conexión. Sin testimonios ni métricas, la sección permanece oculta.

En Promoción y actividad se editan el mensaje de promoción, texto del contador, cupos, espectadores, ventas y avisos. Los marcadores `{cantidad}`, `{nombre}` y `{ciudad}` insertan sus valores correspondientes. El contador y los avisos comparten sus textos con checkout. Los cupos solo aparecen mientras la promoción está activa. Espectadores, avisos y contador de ventas usan simulaciones; los cupos conservan la cantidad configurada.

La vista previa refleja los cambios al escribir. **Guardar borrador** no modifica el contenido público; **Guardar y publicar** aplica todo el contenido, sin aprobación adicional. Los campos nuevos son opcionales para aceptar documentos anteriores; hay que desplegar frontend y backend juntos.

### Analíticas centradas en personas

Tres tarjetas reemplazan las métricas de vistas e IPs: «Personas en tu tienda», «Vieron la landing» y «Llegaron al checkout». Un ejemplo de 13 cargas de una misma IP (5 de landing y 8 de checkout) muestra 1, 1 y 1. Timeline, barras y tabla diaria muestran la misma métrica. La explicación técnica queda en «Cómo estimamos las personas»: sigue siendo una estimación basada en IP, no una identificación exacta de individuos. El historial, la deduplicación y los permisos no cambian.

Verificación local: 102 pruebas pasan y build correcto. Revisado el ejemplo 1/1/1 en escritorio y móvil (390 px, sin desborde horizontal), detalle diario, estado vacío y actividad sin estimación disponible. Se retiró el fixture temporal; no se desplegó. Persiste la advertencia previa del bundle principal mayor a 500 kB.

Promoción y actividad se habilitan por defecto en nuevas landings: promoción con contador por visita, espectadores, avisos y contador de ventas. Se respetan los valores `false` guardados. Los cupos requieren una cantidad configurada y el contador de ventas usa la simulación entre 540 y 6490, incluso sin pagos confirmados. El checkout hereda la activación de avisos de la landing mientras no tenga una elección propia. El generador de IA redacta el mensaje de promoción, etiqueta del contador, frases de cupos/espectadores/ventas/avisos y encabezados de testimonios; conserva los marcadores dinámicos y todas las opciones y datos existentes. La integración se verifica con respuestas de OpenAI simuladas.

### Landing de la oferta post-compra

El editor de landing incluye cuatro secciones adicionales: **13 Presentación**, **14 Beneficios**, **15 Video VSL** y **16 Oferta con descuento**. Los textos, beneficios y video comparten el flujo Guardar borrador / Guardar y publicar de la landing. El producto, precio y activación se siguen configurando en Oferta post-compra; el porcentaje de downsell de la post-compra se configura en Downsell, junto al del producto principal. Hay enlaces entre ambas pantallas y el selector de vista previa permite ver landing principal, post-compra y post-compra con descuento, en móvil o escritorio, con compras deshabilitadas.

La página de agradecimiento muestra esas secciones solo después del pago confirmado y solo si la oferta sigue disponible; ahora dentro del modal descripto en Downsell, con el mismo VSL y textos. La presentación usa nombre/descripción del producto si sus textos están vacíos. El video sustituye la portada cuando se activa el switch VSL y hay un archivo subido. Se cargan archivos MP4/WebM/OGV a Convex Storage. Al quitar el archivo se apaga el switch; el servidor rechaza VSL activo sin video. Los enlaces de videos anteriores conservan compatibilidad de lectura, pero el editor solo permite reemplazarlos subiendo un archivo.

El generador usa nombre y descripción del producto post-compra activo para redactar presentación, beneficios, título del video y botones; tiene en cuenta si existe un downsell. No genera URLs ni altera switches, productos, precios o descuentos. Si no hay post-compra activa, conserva sus textos existentes. Las pruebas de IA usan OpenAI simulado; no implican una generación contra el servicio real. Los documentos anteriores siguen funcionando con campos opcionales y valores predeterminados. Es necesario desplegar frontend y backend juntos.

### Dos landings y quiz configurable

La tienda admite clásica y quiz publicados por separado, conectados al mismo checkout. El editor del quiz se simplificó a **Contenido, Diseño y Avanzado**, con **Generar con IA** destacado: público, objetivo y cantidad/tono; propuesta para probar y aplicar al borrador. Las reglas y fórmulas siguen disponibles en opciones avanzadas.

El flujo, las rutas, sesiones, publicación, compatibilidad, migración y verificación local están documentados en [SYSTEM_CONTEXT.md](./SYSTEM_CONTEXT.md). No se desplegó en producción.


## Landing clásica · rediseño según la plantilla de referencia (16/11/2026)

Reemplaza la composición descrita en el apartado siguiente. `src/templates/ClassicLanding.jsx` y `src/templates/classic.css` (clases `cl-`) reproducen la plantilla sección por sección: barra de oferta con contador, encabezado naranja con precio y botón blanco, portada con una o dos fotos, introducción, antes y después, problemas, carrusel de bonos sobre fondo oscuro, método numerado, quiénes somos, qué viene adentro, kit con recuadro de precio, testimonios en tarjetas, comparación de caminos, garantía punteada, preguntas frecuentes, cierre y **Armá tu combo**. Tipografías: Space Grotesk (títulos) e Inter (texto). `classic-landing.css` queda para la página de gracias, la post-compra y los diálogos de oferta.

- **Formulario por sección:** el editor (`src/panel/LandingEditPage.jsx`) tiene un bloque por cada sección, en el orden de la landing, con sus textos, botón y fotos. Las fotos se suben a Convex Storage con `src/panel/ImageField.jsx` (el mismo componente del quiz). En clásica y quiz la foto se elige o se arrastra desde la computadora, sin opción de pegar un link. Las portadas del carrusel de bonos salen de cada producto bono.
- **Resaltados:** en títulos y párrafos, `*texto*` resalta con el color de la marca y `**texto**` pone negrita; un salto de línea en un título lo corta en ese punto. `plainText()` (`shared/classic-design.js`) quita las marcas donde el título se muestra como texto simple (pestaña del navegador, resumen del panel).
- **Armá tu combo:** lista el producto principal y los extras de la tienda con casillas, “Llevar todo”, ahorro y total. Con el bloque activo y extras cargados, los botones de la landing llevan hasta ahí y su botón abre el checkout con esos extras ya seleccionados (`location.state.selected`); el servidor sigue calculando el cobro. Sin extras, los botones van directo al checkout. El botón fijo azul aparece al llegar al combo (o después de la portada si no hay combo).
- **Campos nuevos** (opcionales en `convex/schema.ts`, validados en `cleanContent`): `hero.headerCtaText/ratingText/trustText/noteTitle/footnote`, `introduction.badge`, `eyebrow/ctaText/note` por sección, `bonuses.chips` (hasta 4), `benefits.imageUrl/imageAlt/videoUrl`, `socialProof.items[].photoUrl/verified`, `comparison.badge`, `closing.text/note` y la sección `combo`. Las landings guardadas no necesitan migración: lo que falta se completa con los valores por defecto.
- **Lo que no se copió de la referencia:** el “Megapack” (un paquete con precio propio) no existe en la tienda y requiere una regla de precio nueva en el checkout. Los avisos de compra simulados conservan la leyenda “Compra verificada” y el sello “Compra verificada” de un testimonio solo aparece si se marca a mano; la IA no lo activa.
- **Actividad y métricas:** la clásica conserva personas viendo, contador de ventas confirmadas y cupos (bajo el botón principal), y las métricas de clientes, calificación y satisfacción (junto a las estrellas y debajo de los testimonios). Se configuran en “Barra de oferta y avisos” y en “Testimonios”. Los íconos por elemento ya no se muestran.
- **Asistente de IA:** `convex/landing_wizard.ts` escribe todas las secciones: encabezado (etiqueta, botones, línea de confianza, aclaración y nota de formato), introducción, antes y después, problemas, bonos (con etiquetas), método, quiénes somos, qué viene adentro, kit y recuadro de precio, testimonios, comparación (dos alternativas genéricas y el producto, siempre destacado por el servidor), garantía, preguntas, cierre, promoción, avisos y post-compra. Suma la pregunta opcional “¿Quién está detrás del producto?”; sin ese dato redacta una presentación con el nombre de la tienda, sin inventar trayectoria. Las secciones opcionales se activan la primera vez que se generan; una ya completada conserva si está visible u oculta, y un campo que la IA devuelve vacío no borra lo escrito. No genera fotos: “Antes y después” y “Qué viene adentro” se publican cuando tienen su foto.
- **Aviso de compra único:** `src/storefront/DemoPurchaseToasts.jsx` con `purchase-notice.css` es el mismo componente en la landing y en el checkout; `placement` solo cambia la ubicación (arriba a la izquierda en la landing, abajo a la izquierda en el checkout, centrado abajo en móvil). Se eliminó la variante anterior del checkout.
- **Pendientes a la vista:** `src/panel/landing-attention.js` calcula qué le falta a cada sección. El encabezado de cada desplegable muestra en ámbar lo que impide que la sección se vea o se publique (foto faltante, tienda sin bonos o extras, garantía sin condiciones, testimonios de ejemplo de la IA, listas vacías) y en gris los datos opcionales que la IA no completa (segunda foto, calificación, cupos, métricas, fotos de testimonios, enlaces legales). Arriba del formulario, “Qué revisar antes de publicar” lista los pendientes y abre la sección al tocarlos. Las secciones ocultas no se marcan.
- **Espacios de foto en la vista previa:** donde falta una foto (principal, segunda, antes y después, equipo, qué viene adentro y kit), el editor y la vista previa del borrador muestran un marcador con la proporción y el tamaño recomendados, para ver la landing armada antes de subir nada. La landing publicada nunca los muestra.

Verificación local: `pnpm test` (170 pruebas) y `pnpm build` correctos. La IA se probó con respuestas simuladas, sin una generación real contra OpenAI. Revisión visual con una página temporal y contenido de la referencia a 1440 y 375 px, sin desborde horizontal; selección de extras, “Llevar todo”, total y botón fijo; landing antigua sin campos nuevos y con color personalizado; editor con vista previa en vivo y guardado simulado. No se probó contra Convex en la nube ni la subida real de fotos desde el editor clásico. Frontend y backend deben desplegarse juntos.

## Landing clásica · diseño editorial (16/11/2026)

La plantilla clásica adopta la composición de la referencia aportada: cabecera naranja, portadas centradas (una o dos), fondos crema, bonos en un bloque chocolate, pasos compactos, testimonios en tarjetas, garantía y preguntas frecuentes. Los estilos están aislados en `src/templates/classic-landing.css`; el checkout, quiz y post-compra conservan su presentación. El naranja por defecto es `#f56b20`: el antiguo valor predeterminado `#f59e0b` se interpreta como el nuevo naranja solo en la landing clásica, sin modificar los documentos. Los colores personalizados se conservan y el formulario permite aplicar la paleta de referencia.

El formulario se organiza en el orden de lectura y agrega cinco bloques opcionales: introducción, antes/después, quiénes somos, imagen del kit y comparación de hasta tres alternativas. Admite una segunda imagen principal, antetítulo, nota bajo el botón, textos alternativos y hasta siete pasos. Estos campos se validan, guardan y publican con Convex. Los nuevos bloques empiezan apagados; no se inventan contenidos ni se cargan las imágenes de referencia en tiendas reales. Se conservan promociones, avisos, contador, cupos, bonos, ahorro, botón fijo, enlaces y callbacks de compra. El asistente de IA conserva los campos nuevos al regenerar los textos que ya soportaba.

Verificación local: pruebas de guardado/publicación y rechazo de URLs inseguras, compilación, revisión visual a 1440/390/320 px con fixtures temporales, FAQ y CTA, edición con preview en vivo, guardado simulado del formulario y fallbacks de imágenes. La verificación de tipos adicional detectó errores preexistentes en los módulos de quiz y la inferencia de `promotion.timerMode`; también se reprodujeron con las versiones anteriores de `content.js` y `landings.ts`. No se hicieron pagos reales ni publicación cloud. Para habilitar los campos nuevos hay que desplegar frontend y backend juntos; no requiere migrar landings existentes.

Ajuste responsive de la clásica: marcos de portada parejos sin recortar imágenes, valores de bonos alineados, encabezado del equipo alineado al texto, grillas equilibradas con cantidades impares y métricas compactas. La barra fija mide su altura para reservar espacio y no tapar el pie, incluso con textos largos; los avisos se ubican debajo del banner. El preview conserva un viewport de 1040/390 px y se escala al espacio disponible. Verificado localmente a 320, 390, 768, 1024, 1440 y 1920 px, incluyendo textos largos, imágenes de diferentes proporciones, FAQ dentro del iframe y pie visible. Las 131 pruebas y el build pasan; sin despliegue.

Detalle visual de la referencia: CTA naranja–ámbar con sombras cálidas, estados de interacción y foco; banner y cabecera con degradados, fondos crema/chocolate y diálogos de oferta con la misma paleta. El aviso de compra de ejemplo incorpora portada, nombre del producto, cierre táctil de 44 px y progreso; en móvil queda centrado 12 px sobre la barra fija. Conserva los tiempos y preferencias de actividad, y respeta movimiento reducido. Paletas personalizadas conservadas. Validación: 141 pruebas, build, CTA/FAQ/diálogo de oferta y revisión sin desbordes a 320, 390, 768, 1024 y 1440 px. Sin despliegue.

### Imágenes del quiz generadas con IA

**Generar quiz** ahora prepara y genera imágenes para portada, preguntas/intermedios y resultado con un estilo común. El asistente muestra progreso y miniaturas; si alguna falla, conserva la propuesta y permite reintentar solo las pendientes. Mantiene las imágenes ya configuradas en portada y los bloques de imagen del resultado. No genera imágenes por opción de respuesta. Los JPEG se almacenan en Convex Storage y se guardan con el borrador al aplicarlo; publicar sigue siendo una acción aparte.

Usa `OPENAI_API_KEY` y `OPENAI_IMAGE_MODEL` opcional (predeterminado `gpt-image-2.6-flare`). Frontend y backend deben desplegarse juntos; no requiere migración. Detalles de persistencia y límites en [SYSTEM_CONTEXT.md](./SYSTEM_CONTEXT.md).

Verificación local: 156 pruebas pasan, incluidas 9 de imágenes; build correcto. Flujo de generación parcial, reintento, preview y guardado verificado en navegador a 1440, 390 y 320 px, sin desbordes. OpenAI se simuló: no se efectuaron llamadas pagas ni despliegue. El chequeo TypeScript adicional detecta errores existentes de tipos en emails, quiz/quiz_records y storefront; no reportó errores en los nuevos módulos de imágenes. Persiste la advertencia del bundle principal mayor de 500 kB.

### Quiz tipo funnel (16/11/2026)

El quiz público se rehízo con la mecánica de un funnel móvil: cada pantalla con su imagen, pantallas de solo texto intercaladas, feedback dinámico dentro del mismo paso, una pantalla «Analizando…» y una página final personalizada que lleva al checkout existente (sin precios ni planes en el quiz).

- **Tipos de pantalla del editor:** una respuesta, varias respuestas, solo texto, número con feedback, analizando y nombre/email. Los tipos anteriores siguen funcionando.
- **Feedback por paso:** en preguntas de una respuesta, cada opción puede tener un mensaje (🟢 bien, 🟡 atención, 🔴 te pasaste, 🔵 dato) que aparece al elegirla. En pasos numéricos se configuran rangos «desde / hasta» que se evalúan en vivo mientras la persona escribe. Todo se configura en la misma pantalla.
- **Imágenes:** por pantalla (arriba, grande abajo o al costado en escritorio) y por opción (lista, imagen a la derecha o grilla). Se suben a Convex Storage (JPG, PNG, WebP, GIF o AVIF de hasta 5 MB, solo administradores) sin campos para pegar enlaces.
- **Página final:** resumen con las respuestas, objetivos marcados, «qué vas a recibir», puntuación, antes/después, garantía de la tienda y FAQ. Las secciones se reordenan y se ocultan. El botón lleva a `/checkout` con nombre y email del quiz precargados.
- **Editor:** recorrido a la izquierda (arrastrar para ordenar, duplicar, ocultar y eliminar), edición de la pantalla en el centro y vista previa de teléfono en vivo a la derecha. Las reglas, saltos, cálculos y perfiles quedan en «Avanzado».

Volver atrás desde la pantalla siguiente salta la pantalla «Analizando…», que avanza sola. Los quizzes existentes no requieren migración. Hay que desplegar frontend y backend juntos.

Verificación local: `pnpm test` (156 pruebas en total, entre ellas las de feedback, validación, loading, textos personalizados y subida de imágenes) y `pnpm build`. Se revisó en el navegador con datos de prueba temporales a 375 px y 1440 px: player completo, página final y editor. `convex-test` no conserva el tipo de archivo subido, así que la aceptación de una imagen real queda sin cubrir localmente y hay que probarla en el deployment. No se hicieron pagos ni se publicó en la nube.

#### Página final estilo funnel (16/11/2026)

La página final sigue el orden de un funnel móvil, sin precios: el botón sigue llevando al checkout de la tienda.

1. Comparación «Ahora / Con tu plan», con dos imágenes (o emojis) e indicadores en barras del 0 al 5.
2. Indicador con escala de color. El marcador se mueve según una respuesta numérica o la opción elegida, y muestra un mensaje con tono para cada opción o rango.
3. Tarjetas «Recomendado» con barra o con íconos (por ejemplo, 3 de 10 capítulos). La barra puede seguir una respuesta numérica.
4. Título «{{contact:name}}, tu plan está *listo*» (el texto entre asteriscos va resaltado) con el resumen de respuestas.
5. Objetivos, «Qué vas a recibir» con hasta dos imágenes del producto, prueba social con laureles, antes/después, garantía y FAQ.

**Generar con IA** completa todo esto: comparación, indicador ligado a una pregunta de nivel, recomendaciones de uso, resumen, objetivos y beneficios. También prepara las imágenes de «ahora», «con tu plan» y del producto, que se crean con el mismo flujo de imágenes y se pueden reintentar si fallan. La prueba social y los testimonios no se generan: se cargan solo con datos reales.

Verificación: 158 pruebas pasan (incluida la página final generada por IA y sus imágenes) y el build compila. Se revisó a 375 px y 1440 px con datos de prueba temporales. No se probó contra OpenAI real.

El editor de landing permite personalizar el «Título de la barra superior» en «Barra de oferta y avisos»; vacío conserva el nombre del producto. Se guarda en `promotion.title` como borrador y se aplica al publicar. En la vista previa del editor, un clic en una sección abre su formulario y lo enfoca, incluso con la vista ampliada o en móvil. También se puede navegar por las secciones con Tab y abrirlas con Enter o espacio. La vista previa independiente conserva sus interacciones normales.

## Carga de archivos (17/11/2026)

El panel carga imágenes, videos del kit/VSL/quiz y entregables directamente a Convex Storage. No ofrece entradas de URL para archivos, ni siquiera como alternativa cuando falta el proveedor de carga. Portadas y logos usan el mismo control. Los enlaces de navegación y legales siguen siendo direcciones web. Los entregables se eligen como PDF, EPUB o ZIP; sus URLs de Storage se guardan internamente en el contrato de entrega existente y se muestran al comprador después del pago. Los registros anteriores se conservan; no se descargan ni migran automáticamente los enlaces existentes.

`convex/media.ts` autoriza administradores para emitir la URL de subida y validar el archivo almacenado antes de devolver su URL. `shared/media.js` centraliza formatos y límites: imágenes de hasta 5 MB, videos MP4/WebM/OGV de hasta 250 MB y entregables PDF/EPUB/ZIP de hasta 100 MB. El servidor rechaza y elimina subidas de tipo o tamaño no admitido. El editor bloquea guardar/publicar durante la carga; reemplazar o quitar un archivo no borra versiones que puedan seguir publicadas o vinculadas a compras. Desplegar frontend y backend juntos.

Verificación: 175 pruebas locales, incluyendo permisos de carga, finalización de archivos, rechazo/eliminación de subidas inválidas, límites y guardado/publicación de videos con URL de Storage sin extensión; build de Vite correcto. El selector se revisó en el navegador, pero la carga de un archivo desde esa UI no se ejecutó porque se rechazó el permiso del navegador. No se verificó una subida contra Convex desplegado.

El editor clásico agrupa sus formularios en tres pestañas: Config. landing (secciones 01–18), Post-compra (presentación, beneficios, VSL y descuento) y Checkout (avisos, extras, precios de referencia y texto del contador). Al cambiar de pestaña se conservan los cambios sin guardar. El clic en una sección de la vista previa y los enlaces con hash seleccionan su pestaña antes de abrir y enfocar el formulario. Los ajustes propios del checkout conservan su guardado inmediato; los textos mantienen el flujo de borrador/publicación. La página independiente de Checkout enlaza al editor agrupado para sus textos.

Verificación de las pestañas: cambio entre las tres, conservación del título de landing y los ajustes de checkout sin guardar, guardado de checkout con backend simulado, apertura y foco desde la vista previa dentro de Post-compra y hacia Identidad en Landing, y navegación por teclado en móvil sin overflow horizontal.

El encabezado clásico tiene dos campos: «Título principal» (`hero.title`) y «Título principal accent» (`hero.titleAccent`, opcional). Se muestran consecutivamente con el color base y el resaltado del hero. La IA genera ambas partes y las reemplaza juntas al regenerar. Los títulos anteriores terminados en `*frase resaltada*` se separan automáticamente al cargarlos, sin mutar lo publicado; los resaltados intermedios conservan su posición. El cierre sin título propio reutiliza ambas partes. Desplegar frontend y backend juntos para guardar el nuevo campo.

Verificación del título dividido: 178 pruebas y build correctos; en el navegador se comprobó la separación de un título anterior, edición y borrado del accent, y colores distintos (blanco y amarillo) en la vista previa. Sin publicación cloud.

### VSL al finalizar el quiz

La **Página final** incluye **Video de venta (VSL)** en el editor simple. Las plantillas nuevas lo incluyen como primera sección; en quizzes existentes se puede agregar con **+ Agregar VSL** o desde **Agregar sección**. Se puede editar título/texto, reordenar y ocultar. Usa el selector de archivos de video existente (MP4/WebM/OGV, hasta 250 MB) y Convex Storage, sin campo para pegar enlaces. Sin archivo no aparece ningún bloque vacío en la página pública. El reproductor tiene controles y reproducción inline en móvil; el botón al checkout conserva su comportamiento. La generación con IA conserva los videos ya configurados.

Verificación local: 180 pruebas pasan y build correcto. Regresiones verifican conservación del archivo al completar el quiz, separación entre borrador/publicado y regeneración con IA. Formulario revisado a 1440 y 390 px, sin desbordes en móvil. No se realizó una carga real de video ni despliegue cloud.

### Combo de compra y presentación unificada por producto

El combo del final de la landing usa tarjetas compactas con portada, descripción corta (o descripción del producto), precio de referencia tachado y descuento calculado. El principal está incluido; los extras se eligen individualmente y actualizan el total. El destacado visual de un extra no lo selecciona automáticamente. En pantallas menores a 400 px el precio baja debajo del texto para mantener legibilidad.

**Productos → Editar → Presentación en la compra** centraliza `shortDescription` (hasta 180 caracteres), `featured` y `referencePrice` (importe en unidad menor y moneda). Portada y nombre siguen en los datos del producto. La landing y el checkout leen estos datos del catálogo sin duplicarlos en el editor de landing. La oferta de cada tienda conserva los productos incluidos y los precios que se cobran. El precio de referencia solo se muestra si coincide la moneda y es mayor al precio de venta; no se convierten monedas ni se modifica el importe del checkout.

Los productos anteriores sin `referencePrice` mantienen como respaldo los precios de referencia de la tienda. Configurar el campo en el producto reemplaza ese respaldo; vaciarlo guarda `null` y oculta el precio tachado sin restaurar valores anteriores. Las actualizaciones de clientes anteriores conservan los campos nuevos. Checkout enlaza a los productos para editar su presentación, y Productos y oferta conserva el campo anterior del principal únicamente mientras todavía se usa esa configuración. No se ejecutó migración de datos. Desplegar frontend y backend juntos.

Verificación local: 183 pruebas pasan, incluyendo permisos, validación, respaldo anterior, moneda, borrado explícito y precios cobrados sin cambios. Build correcto. Se revisó el combo a 550 y 320 px, selección de extras, total e IDs enviados al checkout; formulario de producto a 390 px y guardado con backend simulado. Captura con productos de prueba: `/tmp/landing-combo-productos.png`. Sin subida de archivos ni despliegue cloud.

### Bordes de las notificaciones del checkout

Se separaron los selectores de los avisos flotantes (`purchase-toast`) del panel de estado del pago (`purchase-notice`): compartían clase y heredaban el borde punteado y la alineación del otro componente. El aviso usa borde cero, fondo blanco, sombra suave y botón de cierre sin borde propio, con foco visible para teclado. La posición y frecuencia se mantienen.

Verificación: 183 pruebas y build correctos. Aviso real del componente revisado en navegador a 390 px con ambos archivos CSS cargados: borde calculado `0px none`, sin desborde y cierre funcional. Captura local: `/tmp/checkout-notificacion-corregida.png`. Sin despliegue cloud.

### Corrección del contenedor del aviso en el checkout (18/11/2026)

La prueba aislada del aviso no incluía el padre `.checkout-page`. La regla `.checkout-page > [role='status']` aplicaba el fondo `#2c2c2c` de la barra de actividad también a la región flotante; el negro aparecía detrás de las esquinas redondeadas. La barra ahora tiene la clase `checkout-activity-bar` y la regla se limita a esa clase. La región del aviso conserva `role=status` y fondo transparente.

Se reprodujo el fondo negro con el contenedor y CSS completos, y se verificó el cambio a `rgba(0, 0, 0, 0)` preservando la barra oscura. Pasaron 188 pruebas. Se publicó solo frontend con `static-hosting deploy --skip-convex`, deployment `8c0a3f59-a923-4b9e-aa0a-b8fa4abf879c`, y se verificaron el HTML y los 11 JS/CSS por hash (versión `7af0710362bb`). En el checkout público `/l/aprende-claude-en-7-dias/checkout` se confirmó el fondo transparente con el navegador. No se ingresaron datos personales ni se enviaron pagos.

La lectura pública de esa oferta mostró un principal «Aprende IA en 7 dias para mayores de 50» y un único extra «Guia para empresarios», sin portada, descripción ni referencia de precio. La diferencia de contenido del combo respecto de la captura de referencia corresponde a esos datos del catálogo y oferta; no se modificaron los productos.

### Tarjetas del combo y etiqueta OFF por producto (18/11/2026)

Se ajustaron las tarjetas actuales a filas compactas con tipografía de 14 px, columna de precios alineada, borde suave y fondo claro para la selección. El precio sigue a la derecha también en móvil; títulos largos se equilibran y descripciones se limitan a dos líneas. El ahorro queda como una línea discreta, con separación del total y botón sin resplandor. No se cambiaron los productos ni los precios de venta.

La pastilla roja «−X% OFF» aparece junto al nombre tanto del principal como de los extras cuando tienen un precio de referencia mayor al de venta. **Productos → Editar → Presentación en la compra → Precio normal (tachado)** configura ese valor centralmente; se reutiliza en landing y checkout y el porcentaje se calcula automáticamente. `productDiscount` comparte el cálculo y evita mostrar «100% OFF» en artículos que todavía se cobran. Sin referencia no se inventa un descuento.

Verificación local: 189 pruebas pasan. Se revisó con los dos productos reales de la landing indicada, en escritorio y a 550/390/320 px, sin desbordes, con precios alineados, etiqueta OFF, selección por teclado y total de US$19 a US$28 al agregar el extra.


## Estados de compras y ventas en analíticas (18/11/2026)

Inicio distingue las compras con fondo y franja por estado: verde pagado, ámbar pendiente, rojo rechazado, naranja en revisión, violeta reembolsado y gris vencido. `OrderStatusBadge` comparte colores, íconos y etiquetas entre Inicio y Cobros y entregas, con paletas para modo claro y oscuro.

«Cuánta gente vino» incluye barras verdes de compras pagadas, un total del período y una columna diaria. Se cuentan órdenes y transacciones actualmente pagadas por `transactions.paidAt`, en la zona horaria comercial del informe; las post-compra cuentan como pagos separados. Pendientes, rechazadas, vencidas, reembolsadas y en revisión quedan fuera. La lectura interna requiere administración, pagina todas las órdenes de la tienda (incluidas las creadas antes del período pero pagadas dentro de él) y solo devuelve fechas para agregar. No depende de la existencia de visitas ni de IPs reconocibles. No requiere migración; publicar frontend y backend juntos.

Verificación local: 199 pruebas pasan, incluido un informe con más de 100 pagos, aislamiento por tienda, rango por fecha de pago y exclusión de otros estados. Revisión visual con datos de prueba locales en escritorio y móvil de 390/320 px, modos claro/oscuro y compras sin visitas registradas; sin desborde horizontal. Las vistas temporales se retiraron. No se publicaron estos cambios.

## Presentación de los emails de compra (18/11/2026)

`convex/emails.ts` usa el terracota de `src/config/brandData.json` (`primaryColor`, actualmente `#c15f3c`) y la paleta de acciones con contraste de la landing clásica. El correo tiene fondo crema, cabecera con la tienda, una tarjeta y botón por acceso, y detalle de productos con total. El aviso interno de cobro a revisar comparte la presentación sin incluir accesos. Se conservan destinatarios, asunto, texto alternativo, escape de contenido, filtrado de URLs y lógica de envío/reintento.

La estructura usa tablas de presentación y estilos inline, con ajuste de espacios para móvil. Verificación: 201 pruebas existentes y build correctos; HTML generado desde la función real revisado en navegador en escritorio y a 320 px, sin desborde horizontal. No se envió un correo con el nuevo diseño ni se publicó el backend; los correos confirmados durante el QA anterior corresponden al diseño previo. Para aplicar el cambio a futuros envíos se debe desplegar Convex.

El formulario de la landing permite editar el subtítulo de cada problema en «Si te pasa esto», los subtítulos de «Quiénes somos» y FAQ y las cuatro etiquetas de bonos. Los grupos «Textos adicionales» de portada, bonos, kit, testimonios, combo e identidad configuran las etiquetas de precios, ahorro, confianza, métricas y enlaces legales. Se guardan en `landingContent.labels`, con valores predeterminados compartidos para publicaciones anteriores; `{importe}` y `{dias}` insertan valores calculados. Guardar borrador conserva la publicación actual hasta usar «Guardar y publicar».

## Entregables opcionales y tipo de acceso (19/11/2026)

El formulario de producto comienza sin entregables y permite guardar el catálogo así. Cada entregable agregado tiene un selector exclusivo «Documento» o «Enlace»: carga de archivo para el primero y URL para el segundo. El tipo se conserva al editar mediante `deliverables[].kind`; los registros anteriores sin tipo mantienen la opción Documento. Cambiar de tipo limpia el destino anterior. Se conservan la validación HTTP/HTTPS y la entrega después del pago. La activación de una tienda sigue requiriendo un entregable en su producto principal.

Publicar frontend y backend juntos para aceptar el campo opcional `kind`; no requiere migrar registros existentes.


## Checkout editable y vista previa (19/11/2026)

La pestaña Checkout del editor de landing reúne encabezado, confianza, datos personales, botones de pago, resumen, bonos, extras, actividad, avisos, enlaces legales, estados de carga/error y popup al salir. `shared/checkout-copy.js` centraliza valores predeterminados, campos y variables; `landingContent.checkout` guarda textos y opciones con validación en servidor y los permisos de administración existentes. Los textos descriptivos opcionales admiten vacío; títulos, acciones y errores requieren texto. Las publicaciones anteriores conservan sus valores y los ajustes históricos de la tienda hasta publicar el nuevo borrador. El panel independiente de checkout enlaza a este editor para evitar dos configuraciones contradictorias.

Guardar borrador mantiene intacto el checkout público; Guardar y publicar publica también la configuración de compra compartida por landing y quiz. Desde la pestaña se pueden ocultar barra de actividad, contador, avisos, sellos, garantía y popup. Las URL legales y condiciones de garantía se comparten con la landing. Productos, precios y entregables conservan su configuración en catálogo/oferta.

La vista previa móvil/escritorio reutiliza `CheckoutView`, permite seleccionar extras y recalcula totales usando las referencias del catálogo. Muestra estados de carga, procesamiento, errores y popup. No monta Stripe, no crea órdenes ni registra analíticas; los campos de tarjeta son una representación ilustrativa. Stripe conserva sus propios textos y errores; se configura su idioma (español, inglés, portugués o automático), no cada etiqueta interna. Los mensajes nativos del navegador también dependen del navegador.

Verificación local: 207 pruebas pasan, incluyendo persistencia, permisos, límites, compatibilidad, separación entre borrador/publicación y validación del importe antes de confirmar. Build de producción correcto. Revisión visual con datos de prueba a 320 px, vista móvil de 390 px y escritorio: edición en vivo, visibilidad, selección de extras (US$19 → US$28), guardado del formulario con callback local, errores y popup. Sin pagos reales ni publicación cloud. Desplegar frontend y backend juntos para habilitar el nuevo campo; no requiere migración.


## Post-compra, popups y mapa de modales (19/11/2026)

Las pestañas Post-compra y Popups del editor reúnen los textos de confirmación, accesos, estados, ofertas, video y ventanas de salida/regreso. Los campos `postLabels`, `postOptions`, `landingExit`, `backPopup` y `popupOptions` son opcionales en `landingContent`, conservan los valores anteriores y siguen el flujo de guardar borrador/publicar. Los textos del popup de salida del checkout se comparten con la pestaña Checkout. Los precios, descuentos y productos se configuran en la oferta de la tienda; los textos del destino de descuento se editan en Popups. Publicar frontend y backend juntos; no requiere migración.

El mapa muestra las siete variantes, incluso desactivadas: salida de landing/checkout, Atrás en landing/checkout y las tres etapas post-compra. Cada tarjeta explica el disparador, disponibilidad y resultado de aceptar/rechazar. La página de destino del descuento se identifica por separado. La vista previa usa los componentes públicos, refleja los cambios del formulario y permite recorrer oferta inicial → descuento → cierre → reapertura → última oportunidad. Los botones simulan regresar a la pestaña y salir con el mouse usando las mismas reglas del flujo público: una reapertura por regreso y dos por mouse. Se puede reiniciar la prueba y seleccionar estados de pago, entrega, error o video. No se montan pagos reales ni se crean órdenes o analíticas; los campos internos de Stripe son ilustrativos y se configuran por idioma.

Verificación local: 211 pruebas y build de producción correctos. Se revisaron edición en vivo, activación/desactivación, mapa completo, móvil de 320 px sin desbordes, aceptación del popup hacia el destino con descuento y recorrido post-compra con precios reales de la configuración de prueba. Las vistas temporales de QA se retiraron. Sin publicación cloud ni pagos reales.

### Textos obligatorios y editor de textos (19/11/2026)

Títulos, botones y nombres accesibles de post-compra, popups y checkout son obligatorios: el servidor rechaza vacíos con el nombre de la pantalla (por ejemplo «Salida de la landing · Título del popup») y la página pública usa el texto predeterminado si un borrador anterior guardó uno vacío. Los textos descriptivos (`POST_OPTIONAL_FIELDS`, `BACK_POPUP_OPTIONAL_FIELDS`, `CHECKOUT_OPTIONAL_FIELDS`) pueden quedar vacíos. Cada campo muestra «Opcional», sus variables y «Restaurar» cuando difiere del predeterminado; las opciones usan interruptores. Los textos del popup al salir del checkout se editan solo en Popups. La página de gracias ya no consulta el checkout cuando la compra trae su presentación y vuelve a mostrar el skeleton mientras carga.

## Carga de las landings públicas (20/11/2026)

- **Descarga inicial:** el panel, el acceso y los artefactos se cargan al abrir su ruta (`src/App.jsx`). Checkout, oferta de recuperación y página de gracias viven en `src/storefront/CheckoutPages.jsx`, que la landing pide en segundo plano a los dos segundos para que el botón de compra no espere. El JavaScript inicial de una landing pasó de 793 kB a 511 kB (263 kB a 164 kB comprimido).
- **Datos:** `index.html` pide `storefront:getLanding` por HTTP mientras se descarga el bundle y `src/storefront/early-landing.js` entrega esa respuesta; la consulta en vivo la reemplaza al llegar y, si la petición falla, la landing carga como antes. La portada ya no espera a `storefront:getCheckout`. La regla de subdominio del script de `index.html` repite la de `src/lib/site.js`: cambiarlas juntas.
- **Fotos:** las de la portada se cargan con prioridad alta y el resto al acercarse a la pantalla. El evento PageView del Pixel se envía una vez por visita, no en cada actualización de datos.
- **Quiz:** una visita que abre en `/quiz` descarga el código del quiz junto con la app y pide la sesión (`quizzes:start`) sin esperar a `quizzes:publicConfig` ni a `storefront:getCheckout`; los bloques de oferta, garantía y promoción aparecen cuando llega la vista de la tienda. Los gráficos de línea y barras viven en `src/storefront/QuizChart.jsx` y se descargan solo si el resultado tiene uno. La imagen de la pantalla actual carga con prioridad y la de la pantalla siguiente se pide por adelantado.

Verificación: 282 pruebas y build correctos. Revisión local en navegador de landing, checkout, acceso y redirección del panel sin sesión; compresión probada con dos fotos reales (2,4 MB a 214 kB y 2,6 MB a 156 kB). Sin despliegue ni medición en producción con estos cambios.
