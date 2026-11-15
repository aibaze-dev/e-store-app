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

Para guardar los cambios, subirlos a `origin main` y publicar en Convex, con las variables de despliegue en `.env`:

```sh
npm run deploy -- "mensaje del commit"
```

Ejecuta `git add .`, `git commit -am "mensaje del commit"`, `git push origin main` y `node --env-file=.env --run=deploy:convex`, en ese orden. El script carga explícitamente `.env` antes del último paso para que sus variables lleguen al proceso de despliegue. Se detiene si cualquier paso falla, incluido un commit sin cambios. El mensaje es obligatorio.

Para publicar sin crear un commit ni hacer push, con las variables ya cargadas en el entorno: `pnpm run deploy:convex`.

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

## Campañas de ebooks (v1)

Módulos de negocio sobre esta base; el contexto y las decisiones están en [context.md](context.md).

Los documentos del catálogo (`products`) se guardan con `type: "e-book"`, asignado por el servidor al crear o editar. El campo es opcional en el esquema para aceptar registros anteriores; estos reciben el valor cuando se editan.

- **Panel** (`/panel`): inicio por tienda con selector en el sidebar, links públicos y oferta asociada. Cada tienda reúne producto principal, bonus y upsells en «Productos y oferta», con desplegables y un guardado común; conserva secciones de post-compra, landing, checkout y cobros; el catálogo se comparte. Solo entran los emails de `ADMIN_EMAILS`.
- **Landing pública**: `<subdominio>.<dominio base>` y también `/l/<subdominio>` en el dominio base. El subdominio requiere configurar DNS y dominio en el hosting; no asumir soporte wildcard. Eso no está configurado ni verificado. La ruta funciona sin configuración extra.
- **Checkout**: formulario propio con Stripe Payment Element y Checkout Sessions; post-compra y downsell conservan Embedded Checkout. El servidor calcula los importes desde la tienda y confirma los pagos solo por webhook firmado.
- **Links**: se muestran en `/gracias?session_id=...` cuando el pago está confirmado.

Configuración pendiente (variables de Convex, salvo la indicada):

| Variable | Uso |
| --- | --- |
| `ADMIN_EMAILS` | Emails con acceso al panel, separados por coma. El registro no verifica el correo: registrá primero tu cuenta y después cargá esta variable. |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe. Sin ella no se puede iniciar un pago. |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook `https://<deployment>.convex.site/api/stripe/webhook`, con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` y `charge.refunded`. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clave publicable, en el entorno del build del frontend. |
| `OPENAI_API_KEY` | Clave de la API de OpenAI para el asistente de textos de la landing. Sin ella el asistente avisa que no está habilitado; el resto del panel funciona igual. |
| `OPENAI_MODEL` | Opcional. Modelo a usar; por defecto `gpt-6.1-sol`. Debe aceptar Structured Outputs (`response_format` con `json_schema`). |

`pnpm test` cubre permisos del panel, landing pública, cálculo de importes, idempotencia, webhook y post-compra con Stripe simulado. No se ejecutó ningún pago contra Stripe real ni se probó la app desplegada.

La landing usa una plantilla fija de venta con un formulario de 16 secciones y vista previa en vivo (celular/escritorio). Incluye presentación, bonos, beneficios, problemas, testimonios de texto o captura, resumen de compra, pasos, garantía, FAQ, cierre, botón fijo, promoción e identidad. Las secciones opcionales se pueden ocultar; las listas vacías no se muestran. Las imágenes se configuran por URL.

El asistente de textos (`landing_wizard:generate`) hace cinco preguntas (público, problema, resultado, diferencial, tono y garantía) y completa presentación, beneficios, problemas, pasos, preguntas frecuentes, garantía, cierre, textos de promoción y actividad y encabezados de testimonios usando además el nombre, la descripción y los bonos de la tienda. Al terminar, el panel carga el resultado en el formulario, lo guarda como borrador y abre la vista previa; publicar sigue siendo un paso aparte. Genera además 4 testimonios ficticios en formato conversación, adaptados al ebook y al público, que se muestran en el carrusel con cinco estrellas en todos los formatos, sin etiquetas de ejemplo o IA. El marcador interno `isExample` se conserva para reemplazar los textos generados al regenerar; no se muestra en la landing. Se pueden editar; al regenerar se reemplazan los ejemplos anteriores y se conservan los testimonios agregados a mano, hasta el límite de 12 elementos. No inventa ni reemplaza métricas, cupos, fechas, opciones activadas, imágenes, precios ni enlaces, y solo redacta garantía si se indican los días. Las respuestas se envían a OpenAI. Está cubierto con OpenAI simulado; no se probó contra la API real.

La landing pública y su checkout muestran el popup «Pará un segundo» (`src/storefront/ExitIntentModal.jsx`) cuando el mouse sale del documento por cualquier borde, con un mínimo de 10 segundos entre apariciones. Los eventos anteriores a ese intervalo se ignoran, sin programar una apertura ni reiniciar la espera. El intervalo se cuenta desde la última apertura y se comparte en memoria por tienda entre landing y checkout durante la navegación. No hay límite de apariciones por sesión ni por pestaña; mientras está abierto no se vuelve a disparar. No se activa con gestos táctiles ni en la vista previa del panel. El copy está centralizado en `src/storefront/exitIntent.js` y se arma con la oferta real (bonos, ahorro y garantía solo si están configurados).

**Downsell.** Con el downsell activado (sección Downsell del panel), el primer «atrás» del visitante en la landing o el checkout abre un cartel (`src/storefront/DownsellModal.jsx`), una vez por pestaña. Si acepta, va a `/oferta`: producto principal con sus bonos, sin extras, con el descuento porcentual de la tienda. La oferta post-compra tiene su propio descuento opcional, que aparece una vez cuando el comprador responde «No, gracias». El importe lo calcula siempre el servidor (`convex/lib/pricing.ts`) y la orden queda marcada con `downsell`. Los navegadores solo permiten interceptar «atrás» después de que el visitante interactuó con la página (un toque, clic o tecla); quien solo hizo scroll sale sin ver el cartel. El contador de `/oferta` es el mismo simulado del checkout y no cambia precios.

El checkout público tiene dos columnas: datos personales y pago a la izquierda, extras y resumen a la derecha. Email, nombre, apellido y teléfono aparecen al entrar; los medios de pago de Stripe se cargan automáticamente. En móvil se apilan y el contador aparece arriba. Los extras siguen editables hasta confirmar; cambiar la selección conserva los datos personales y prepara una sesión para el importe nuevo. Se bloquea la confirmación mientras cambia la sesión, durante el pago y si el importe o moneda de Stripe difiere del resumen. Los reintentos de una misma selección reutilizan la orden/sesión. Los datos de tarjeta nunca pasan por la app: los recoge Payment Element. Los datos personales se envían directamente a Stripe al confirmar, no se persisten en el almacenamiento del navegador. No hay envío automático de email implementado; los links se entregan en pantalla.

La integración principal usa `CheckoutElementsProvider`, `useCheckoutElements` y `checkout.confirm` con `ui_mode: elements`, como indica la [guía oficial de Stripe](https://docs.stripe.com/payments/quickstart). La sesión fija español, habilita nombre y teléfono, y conserva validación de precios y webhook firmado. Downsell y post-compra conservan su flujo embebido. Se crea una orden pendiente al cargar la selección; no representa una venta hasta que llega el webhook válido. `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` y webhook siguen siendo necesarios. Deben desplegarse frontend y backend juntos.

El checkout usa una paleta pública independiente (botón de pago azul, extras oscuros/verdes y ahorro verde), formato monetario español (`AR$ 16.990`, conservando centavos cuando existen) y enlaces legales configurados en la landing. La sección Checkout del panel configura avisos demo de compras, título de extras y precios de referencia; el viejo campo `liveVisitors` se conserva por compatibilidad pero no controla la simulación. Las funciones de presencia real quedan disponibles para una conexión futura.

Por pedido explícito, la barra «N personas están comprando en este momento» usa datos simulados entre 2 y 15 y cambia cada 15 segundos. La landing también puede mostrar espectadores simulados. El contador por visita comienza entre 8:01 y 14:59 y comparte el vencimiento entre landing y checkout por tienda/pestaña: no reinicia al navegar o recargar. Se detiene en 00:00 sin modificar precios ni bloquear pagos. Las fuentes están aisladas en `checkoutSignals.js` y `CheckoutSignals.jsx`; el preview del panel usa una muestra fija sin alterar el contador del visitante.

El contenido tiene borrador/publicación. La oferta y sus precios se leen de la tienda: `offer.compareAtPrice` permite mostrar un precio tachado y `offer.bonuses[].referenceValue` el valor informativo de un bono gratuito. Ambos son opcionales, están en unidades monetarias menores y nunca cambian lo cobrado por Stripe. El ahorro se calcula a partir del precio de referencia del principal (o su precio actual) más los valores de los bonos, menos el precio de venta. Cambiar la oferta sigue afectando nuevas visitas sin republicar textos.

En Promoción se elige contador por visita (predeterminado) o fecha absoluta (`promotion.timerMode: date`, con `endsAt` obligatorio). En el segundo caso landing y checkout usan la misma fecha; la promoción de la landing se oculta al vencer. El formulario también admite cupos informativos, frase de cierre de problemas, calificación, cantidad de clientes y satisfacción. Los números opcionales se validan en servidor y se ocultan si están vacíos; no se precargan reseñas ni métricas de la captura. Los testimonios tienen carrusel manual con flechas, puntos y teclado. La plantilla usa Nunito Sans en títulos, botones degradados, íconos de beneficios en emoji, pasos conectados y precio de referencia/ahorro en la barra inferior.

Los avisos de compra de landing y checkout usan temporalmente `DemoPurchaseToasts`: nombres y ciudades ficticios con la etiqueta visible  Se habilitan con los controles de avisos existentes, incluso sin ventas, y se ven también en la vista previa de la landing. El primero aparece tras 5–12 segundos; cada aviso dura 6 segundos y luego espera otros 12–30 segundos aleatorios. No se repiten consecutivamente el nombre ni la ciudad. Al ocultar la pestaña se detienen y al volver se programa una nueva espera, sin acumular avisos; al salir de la página se limpian los temporizadores. No se escriben compras ni eventos en la base. El contador de ventas sigue usando únicamente órdenes pagadas reales (sin post-compra); la fuente real de avisos y su renderizador se conservan para reconectarlos después.

Para actualizar el entorno desplegado hay que publicar frontend y Convex juntos: se ampliaron los campos opcionales de contenido y oferta. Las listas de beneficios/problemas anteriores (strings) siguen siendo válidas y se convierten a tarjetas en el formulario. No hace falta migrar los documentos existentes. La preferencia claro/oscuro del panel no modifica la plantilla pública.

Cuando una tienda todavía no tiene ajustes propios de checkout, sus avisos heredan la activación de la landing publicada. Guardar el checkout establece una elección independiente: un `false` explícito se respeta aunque la landing tenga avisos activos. El panel muestra el mismo valor heredado. Esta corrección requiere desplegar backend y frontend; no cambia documentos existentes.

## Analíticas por tienda

`/panel/tiendas/:storeId/analiticas` muestra personas estimadas: total de la tienda, quienes vieron la landing y quienes llegaron al checkout. Usa los conteos deduplicados del período; no muestra cargas de página ni una lista de IPs. Incluye gráficos y detalle diario de personas. Ofrece hoy, 7 días, 30 días y fechas personalizadas (hasta 366 días por consulta). Se actualiza al cambiar el período o pulsar Actualizar. El gráfico se carga bajo demanda, fuera del bundle inicial de la landing.

El historial `pageViews` conserva un documento pequeño por vista: `storeId`, `page` (`landing`/`checkout`), `day`, `ipHash` opcional y `eventId`; `_creationTime` ya aporta la fecha/hora del servidor. No guarda IP original, user agent, email, referrer ni parámetros de URL. Los índices permiten filtrar por tienda/fecha, deduplicar reintentos y limitar ráfagas. Los informes recorren páginas de 1000 filas en el servidor para no truncar silenciosamente las métricas. El costo de lectura crece con las vistas del período; para mucho tráfico se podrán incorporar agregados sin cambiar el registro del frontend.

`analytics:recordView` obtiene la IP de `ctx.meta.getRequestMetadata()` (Convex >= 1.38, disponible en la versión instalada), normaliza IPv4/IPv6 y calcula HMAC-SHA256 con un contexto por tienda. La clave es `ANALYTICS_IP_SECRET` o, si no está configurada, `BETTER_AUTH_SECRET`, siempre del servidor. Para independizarla de futuras rotaciones de autenticación, configurar una clave dedicada **antes de comenzar a medir**. Cambiar la clave durante el historial cambia los códigos y puede contar dos veces una misma IP en rangos que crucen esa fecha. No se necesita otra variable del frontend ni un endpoint HTTP adicional.

El hook público mide una vez por navegador, tienda, página y día de negocio. Las recargas, volver a la página y abrir otra pestaña del mismo origen no agregan otro evento confirmado ese día mientras se conserve el almacenamiento. El ID estable de la tienda, expuesto en la vista pública, identifica la marca aunque cambie el subdominio. Re-renders, Strict Mode y reintentos comparten la misma operación y el mismo ID de evento. Checkout se mide al abrirlo, antes de pulsar Pagar. El editor y sus vistas previas no montan el hook. Solo se admiten landings publicadas de tiendas activas. No se genera información retroactiva.

Los únicos se calculan con el hash completo, sin sumar los únicos diarios ni los de landing y checkout. La interfaz no expone los códigos. Cuando no hay IP, la vista se conserva pero no se inventa una identidad para calcular personas. La pantalla avisa si la estimación está incompleta; si hay actividad sin ningún identificador disponible, muestra «—» y un estado de estimación no disponible en lugar de cero personas. Una IP no equivale a una persona. Se descartan ráfagas por encima de 120 vistas por tienda/IP/minuto (las vistas sin IP comparten ese límite); esto no pretende identificar todos los bots. El historial se conserva sin purga automática.

Los días usan `src/config/businessData.json.timeZone` (actualmente `America/Adak`), como el resto de fechas de negocio. Cambiar esa configuración después de acumular datos requiere migrar `day` desde `_creationTime` para mantener una única zona horaria en los reportes.

El informe exige `requireAdmin` y la lectura paginada es interna. Pruebas locales cubren permisos, aislamiento por tienda, IPs faltantes, HMAC, fechas/DST, reintentos y más de 1000 vistas sin truncamiento. `convex-test` no implementa todavía el syscall nativo de metadatos: solo esa fuente de IP se sustituye en las pruebas. La medición real de IP en cloud debe verificarse tras desplegar frontend y backend juntos; no se ejecutó un despliegue durante esta implementación.

Verificación de esta implementación: 72 pruebas pasan; build y chequeo TypeScript del backend correctos. Revisión visual local con fixture temporal en escritorio/móvil, filtros predefinidos, estado vacío, error/reintento, detalle diario y deduplicación con React Strict Mode. El fixture se retiró después de verificarlo. Persiste la advertencia previa del bundle principal mayor a 500 kB; las analíticas se descargan en un chunk aparte. No se publicaron cambios ni se probó una IP real en cloud.

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

En Promoción y actividad se editan el mensaje de promoción, texto del contador, cupos, espectadores, ventas y avisos. Los marcadores `{cantidad}`, `{nombre}` y `{ciudad}` insertan sus valores correspondientes. El contador y los avisos comparten sus textos con checkout. Los cupos solo aparecen mientras la promoción está activa. Se conserva la fuente existente de cada número: simulación para espectadores/avisos y pagos confirmados para ventas.

La vista previa refleja los cambios al escribir. **Guardar borrador** no modifica el contenido público; **Guardar y publicar** aplica todo el contenido, sin aprobación adicional. Los campos nuevos son opcionales para aceptar documentos anteriores; hay que desplegar frontend y backend juntos.

### Analíticas centradas en personas

Tres tarjetas reemplazan las métricas de vistas e IPs: «Personas en tu tienda», «Vieron la landing» y «Llegaron al checkout». Un ejemplo de 13 cargas de una misma IP (5 de landing y 8 de checkout) muestra 1, 1 y 1. Timeline, barras y tabla diaria muestran la misma métrica. La explicación técnica queda en «Cómo estimamos las personas»: sigue siendo una estimación basada en IP, no una identificación exacta de individuos. El historial, la deduplicación y los permisos no cambian.

Verificación local: 102 pruebas pasan y build correcto. Revisado el ejemplo 1/1/1 en escritorio y móvil (390 px, sin desborde horizontal), detalle diario, estado vacío y actividad sin estimación disponible. Se retiró el fixture temporal; no se desplegó. Persiste la advertencia previa del bundle principal mayor a 500 kB.

Promoción y actividad se habilitan por defecto en nuevas landings: promoción con contador por visita, espectadores, avisos y contador de ventas. Se respetan los valores `false` guardados. Los cupos requieren una cantidad configurada y las ventas se muestran solo si existen pagos confirmados. El checkout hereda la activación de avisos de la landing mientras no tenga una elección propia. El generador de IA redacta el mensaje de promoción, etiqueta del contador, frases de cupos/espectadores/ventas/avisos y encabezados de testimonios; conserva los marcadores dinámicos y todas las opciones y datos existentes. La integración se verifica con respuestas de OpenAI simuladas.

### Landing de la oferta post-compra

El editor de landing incluye cuatro secciones adicionales: **13 Presentación**, **14 Beneficios**, **15 Video VSL** y **16 Oferta con descuento**. Los textos, beneficios y video comparten el flujo Guardar borrador / Guardar y publicar de la landing. El producto, precio, activación y porcentaje de downsell se siguen configurando en Oferta post-compra. Hay enlaces entre ambas pantallas y el selector de vista previa permite ver landing principal, post-compra y post-compra con descuento, en móvil o escritorio, con compras deshabilitadas.

La página de agradecimiento muestra esas secciones solo después del pago confirmado y solo si la oferta sigue disponible; conserva el checkout separado, el rechazo y el downsell existentes. La presentación usa nombre/descripción del producto si sus textos están vacíos. El video sustituye la portada cuando se activa el switch VSL y hay una URL válida. Se admiten URLs HTTPS de YouTube, Vimeo (incluidos enlaces privados con hash) y archivos MP4/WebM/OGV. No se acepta HTML ni iframes arbitrarios. Al borrar la URL se apaga el switch; el servidor rechaza VSL activo sin video. La reproducción depende de la disponibilidad y permisos del proveedor y se ofrece un enlace para abrirlo aparte.

El generador usa nombre y descripción del producto post-compra activo para redactar presentación, beneficios, título del video y botones; tiene en cuenta si existe un downsell. No genera URLs ni altera switches, productos, precios o descuentos. Si no hay post-compra activa, conserva sus textos existentes. Las pruebas de IA usan OpenAI simulado; no implican una generación contra el servicio real. Los documentos anteriores siguen funcionando con campos opcionales y valores predeterminados. Es necesario desplegar frontend y backend juntos.
