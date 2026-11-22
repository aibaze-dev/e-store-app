# Contexto del producto y diseño inicial de datos

## Analíticas livianas (15/11/2026)

Implementadas localmente por tienda: historial mínimo de vistas de landing/checkout con fecha del servidor e identificador HMAC de IP, únicos por rango y timeline diario. Se conserva cada visita registrada para mantener trazabilidad; desde la protección persistente se registra una por navegador/tienda/página/día, con marcas locales confirmadas e idempotencia en Convex; no se guarda la IP original. La sección Analíticas incluye filtros y últimas 20 visitas. Se usa la zona horaria de negocio existente y no se suman únicos diarios para obtener los del período. Los datos empiezan al desplegar la medición; no hay reconstrucción retroactiva ni purga automática. Detalles y configuración en README, sección Analíticas por tienda.

Actualizado: 2026-11-15.

Este documento reúne el contexto, las decisiones y la propuesta de modelo discutidos con el dueño del producto. Es la base para seguir definiendo el plan y luego implementar. No representa funcionalidades ya construidas ni un schema definitivo.

## Objetivo

Construir un sistema propio para administrar campañas de venta de ebooks mediante landings configurables, checkouts y ofertas adicionales. La referencia conceptual es Impultienda (`impultienda.ar`), según la descripción aportada por el usuario; no se busca replicar su SaaS para terceros.

El sistema es inicialmente para uso personal. Todos los cobros van a una única cuenta de Stripe del dueño. No hay onboarding de vendedores, cuentas de cobro independientes, comisiones de plataforma ni necesidad de Stripe Connect en este alcance.

El panel interno permite configurar las campañas y sus landings. El frontend público obtiene la configuración publicada desde Convex y renderiza la plantilla correspondiente.

## Base técnica existente

- Frontend React/Vite.
- Base de datos y funciones en Convex.
- Frontend desplegado en Convex Static Hosting.
- Autenticación existente mediante Better Auth.
- `convex/schema.ts` está vacío al momento de esta definición: todavía no hay módulos de negocio implementados.
- Conservar las integraciones de autenticación y hosting de la base; seguir `AGENTS.md`, `README.md` y `STYLE_GUIDE.md` al implementar.

## Decisiones acordadas

### Tienda = campaña = una oferta principal

En este producto, una tienda es el lugar donde se vende un ebook principal, con sus bonos y upsells. No es una tienda general con muchos productos principales independientes.

Una tienda contiene la configuración de su campaña: producto principal, precio, moneda, bonos, extras, checkout, post-compra, tracking y dirección pública.

La separación conceptual clave es:

- **Producto:** qué se entrega.
- **Oferta:** condiciones comerciales con las que se vende, dentro de la tienda.
- **Landing:** cómo se presenta esa oferta al visitante.

Por ahora no se propone una tabla `offers` independiente: la oferta vive dentro de `stores`. Solo tendría sentido extraerla si más adelante una tienda necesitara gestionar varias ofertas independientes.

### Catálogo común; funciones comerciales separadas

Productos principales, bonos y upsells se muestran como secciones distintas en la configuración, pero usan un catálogo común `products`. No crear tres catálogos ni tres tablas separadas.

Un mismo recurso puede reutilizarse como principal, bonus o upsell. Su función depende de la campaña, no de un tipo fijo e irreversible en el producto. No profundizar todavía en reglas avanzadas de reutilización.

- **Principal:** el ebook que se vende en la campaña.
- **Bonus:** recurso incluido de regalo; no tiene precio cobrable.
- **Order bump / upsell previo al pago:** extra opcional con precio propio. En este sistema se tratan como el mismo concepto comercial y se suman al cobro inicial.
- **Oferta post-compra:** extra ofrecido después del primer pago, con un segundo checkout normal.

Los precios comerciales pertenecen a la configuración de la tienda. Cambiar un precio o una landing no debe duplicar el ebook.

### Entregables mediante links

Los ebooks y demás entregables se configuran únicamente como links externos, por ejemplo una lista de `{ title, url }` por producto.

No se requiere subir archivos, construir un sistema de almacenamiento de ebooks ni gestionar descargas propias en esta etapa.

Después del pago confirmado, al comprador se le muestran los links correspondientes en pantalla. No se requiere una biblioteca de comprador ni entrega por email en el alcance inicial.

Los links no deben incluirse en las respuestas públicas de la landing. Se muestran mediante un acceso autorizado a la compra. El mecanismo concreto de acceso a esa pantalla queda por definir.

Limitación conocida: una vez entregado un link externo, su posibilidad de compartirse depende de los permisos del servicio de destino.

### Usuarios internos

- Los roles previstos son `admin` y `user`.
- Ambos conceptos corresponden a personas que acceden al panel para gestionar campañas; `user` no significa comprador.
- El sistema es para el dueño por ahora. No construir una matriz compleja de permisos, equipos, organizaciones o aislamiento multiempresa.
- Mantener autenticación y control básico de acceso al panel y a las funciones privadas. Simplificar permisos no significa exponer funciones administrativas públicamente.
- La política de acceso inicial y la diferencia concreta entre los dos roles quedan pendientes. No otorgar administración automáticamente por registrarse.
- Los compradores se representan con sus datos de compra; no se exige que creen una cuenta interna.

### Landings y publicación

- Usar plantillas con campos y secciones configurables.
- No construir un editor visual libre en esta primera etapa.
- Persistir en Convex los parámetros necesarios para renderizar cada landing: plantilla, textos, imágenes, secciones y opciones de estilo.
- Configurar dirección pública mediante dominio/subdominio y ruta, según se termine de definir.
- Incluir configuración de Meta Pixel; el alcance exacto de los eventos sigue pendiente.
- La propuesta es separar borrador y contenido publicado para que una edición no altere inmediatamente una campaña activa.
- Guardar un hostname no configura por sí solo DNS, certificados o routing: esa parte de la infraestructura debe validarse antes de prometer publicación automática.

### Stripe y precios dinámicos

- Todos los pagos van al Stripe del dueño.
- No depender de `priceId` preconfigurados para fijar el precio de cada oferta.
- El backend obtiene los precios desde la configuración comercial de Convex y calcula el total según el principal y los extras seleccionados.
- La propuesta de integración usa importes dinámicos mediante `price_data` al crear el checkout de Stripe.
- El navegador comunica qué quiere comprar; no decide el importe final ni confirma que un pago fue exitoso.
- Guardar una copia de los importes y la moneda al crear la compra. Una edición posterior de la tienda no cambia una compra ya iniciada ni histórica.
- Confirmar pagos mediante eventos verificados de Stripe y controlar duplicados. La redirección a la pantalla de éxito no basta para habilitar entregables.
- La implementación deberá contemplar reintentos sin generar cobros u órdenes duplicados por la misma operación.

### Post-compra simplificado

No se necesita post-compra de un clic ni guardar/reutilizar tarjetas como requisito inicial. La oferta adicional se paga mediante otro checkout normal.

Flujo propuesto:

1. El visitante abre una landing.
2. Compra el principal con sus bonos y los extras seleccionados.
3. El backend confirma el primer pago y habilita sus links.
4. Se presenta una oferta adicional, si está configurada.
5. Si la acepta, inicia un segundo checkout y realiza otro pago.
6. Al confirmarse ese pago, se habilitan los entregables adicionales.

El diagrama original incluía una alternativa al rechazar la oferta post-compra. Se conserva como posibilidad pendiente de definir: todavía no está decidido si será otra oferta, un descuento o solo la continuación a la pantalla final.

## Modelo de datos propuesto

Los nombres y campos siguientes son una propuesta para implementar las decisiones anteriores, no un contrato definitivo de schema.

| Tabla | Responsabilidad | Contenido orientativo |
| --- | --- | --- |
| `users` | Perfil interno y rol | Referencia al usuario de Better Auth, rol `admin` o `user`. No duplicar contraseñas ni sesiones. |
| `products` | Catálogo de recursos reutilizables | Nombre, descripción, portada, estado y entregables `{ title, url }`. |
| `stores` | Campaña y configuración comercial | Nombre, estado, moneda, producto principal y precio, bonos, upsells, post-compra, checkout, dirección pública y tracking. |
| `landings` | Presentación de la campaña | `storeId`, ruta, plantilla, campos/secciones y contenido borrador/publicado. |
| `orders` | Compra con sus productos incluidos | Tienda, landing de origen, datos del comprador, estado, moneda, totales y array `items` con copia de lo comprado. |
| `transactions` | Cobros y entregas | Orden, estado del cobro, importe, moneda, referencias de Stripe y array `deliveries` con los links asociados. |
| `webhookEvents` | Procesamiento idempotente de eventos | Identificador del evento Stripe, tipo y estado de procesamiento. |

### Configuración orientativa de `stores`

```text
store
  name
  status
  domain / subdomain
  currency

  offer
    mainProductId
    price
    bonuses[]
      productId
    upsells[]
      productId
      price
      displayOrder

  postPurchase
    enabled
    productId
    price
    fallback opcional, por definir

  checkout
    campos y textos configurables

  tracking
    metaPixelIds (lista; las tiendas anteriores conservan metaPixelId)
```

### Órdenes con items embebidos

Por decisión del usuario, unificar `orders` y `orderItems`: los productos comprados se guardan dentro de `orders.items`, sin tabla `orderItems` independiente.

Cada item debe conservar una copia de los datos relevantes de la venta: referencia al producto, nombre, función comercial y precio aplicado. Los bonos también deben quedar registrados como parte de lo adquirido, aunque no tengan importe cobrable.

No reconstruir una compra histórica desde los precios o bonos actuales de la tienda.

Para el segundo checkout post-compra se propone crear una segunda orden con `parentOrderId` apuntando a la compra inicial. Así, el rechazo, abandono o fallo del segundo pago no invalida lo ya comprado.

### Cobros y entregas unificados

Por decisión del usuario, no crear `payments` y `entitlements` por separado. La propuesta es una tabla `transactions`, presentada en el panel como **Cobros y entregas**.

```text
transaction
  orderId
  status
  amount
  currency
  stripeCheckoutSessionId
  stripePaymentIntentId
  deliveries[]
    title
    url
```

Los entregables de esa transacción solo se muestran cuando el servidor confirma el pago correspondiente. Registrar referencias de Stripe y estados no implica almacenar datos de tarjeta.

Queda por precisar el tratamiento de reintentos, reembolsos y cambios posteriores en los links entregados. No asumir que todas las transacciones están pagadas ni que cada evento recibido representa un nuevo cobro.

## Alcance inicial y límites

Incluido en el diseño inicial:

- Panel personal para gestionar campañas.
- Catálogo común de recursos con entregables por link.
- Una oferta principal por tienda/campaña.
- Bonos y extras configurables por campaña.
- Landings basadas en plantillas.
- Checkout con precios calculados en backend y cobro en Stripe propio.
- Entrega de links en pantalla después de confirmar el pago.
- Post-compra mediante un segundo checkout normal.
- Configuración de Meta Pixel.

Fuera del alcance inicial:

- SaaS para terceros, suscripciones de vendedores o comisiones de plataforma.
- Stripe Connect o distintas cuentas Stripe por tienda.
- Roles y permisos avanzados, equipos u organizaciones.
- Editor visual libre de páginas.
- Almacenamiento propio de ebooks o sistema de descargas de archivos.
- Biblioteca de comprador y entrega automática por email.
- Post-compra obligatorio de un clic.
- Tablas independientes `offers`, `orderItems`, `payments` o `entitlements` con el modelo actual.

## Decisiones cerradas para la v1 (2026-11-15)

- Acceso al panel: lista de emails en `ADMIN_EMAILS`. No se creó la tabla `users`; el rol `user` no tiene uso todavía.
- Checkout: Stripe Embedded Checkout dentro del sitio.
- Dirección pública: cada landing tiene un subdominio (`<subdominio>.<dominio base>`), con la ruta `/l/<subdominio>` operativa sin DNS adicional. La dirección por subdominio requiere configurar DNS y dominio en el hosting; no asumir soporte wildcard.
- Acceso a links: solo con el `session_id` de Stripe de la URL de retorno.
- Asumido sin confirmar: moneda por tienda, una landing y una plantilla por tienda, varios extras con checkbox, rechazo del post-compra sin alternativa, pixel con `PageView`/`InitiateCheckout`/`Purchase`, reembolso total oculta los links.
- El editor de landing permite configurar hero, beneficios, puntos de dolor y prueba social (testimonios); preguntas frecuentes, garantía y color ya existen en el modelo y la plantilla, sin controles.

## Preguntas pendientes para continuar el plan

No reabrir las decisiones confirmadas salvo que aparezca un requisito incompatible. Los siguientes puntos todavía no están definidos:

1. Forma de habilitar el acceso del dueño al panel y diferencia mínima entre `admin` y `user`.
2. Moneda inicial y si se necesitan distintas monedas por campaña.
3. Formato de dominios, subdominios y rutas; configuración real de DNS/hosting.
4. Cantidad de landings por campaña y primeras plantillas/campos disponibles.
5. Modalidad visual de checkout: redirección a Stripe o integración dentro del sitio.
6. Cantidad de extras y reglas simples de selección.
7. Comportamiento del fallback al rechazar la oferta post-compra.
8. Eventos de Meta Pixel necesarios y atribución que se desea conservar.
9. Datos mínimos del comprador y acceso seguro a la pantalla de links, incluyendo la posibilidad de volver a abrirla.
10. Tratamiento de reembolsos, reintentos y actualización de links para compradores anteriores.

## Secuencia sugerida de trabajo

1. Cerrar las decisiones pendientes que afectan al primer flujo de venta.
2. Definir el schema de Convex, validadores, índices y estados del flujo.
3. Implementar catálogo y configuración de campañas en el panel.
4. Implementar plantillas, borrador/publicación y resolución de URLs.
5. Integrar cálculo de precios, órdenes, Stripe y procesamiento de webhooks.
6. Implementar pantalla de entrega y checkout adicional post-compra.
7. Incorporar tracking y verificar el flujo completo, incluidos fallos y eventos duplicados.

## Referencias

- Contexto funcional: conversación con el dueño y diagrama compartido el 2026-11-15.
- [Relaciones mediante IDs en Convex](https://docs.convex.dev/database/document-ids).
- [Creación de Checkout Sessions en Stripe](https://docs.stripe.com/api/checkout/sessions/create).
- [Webhooks de Stripe](https://docs.stripe.com/webhooks).

Este documento no implica que se hayan implementado, probado o desplegado los flujos descritos.


## Panel centrado en la tienda (15/11/2026)

- La URL identifica la tienda activa: `/panel/tiendas/:storeId`. Un selector en el sidebar cambia de tienda conservando la sección; el catálogo de recursos sigue siendo compartido.
- Inicio reúne links de landing y checkout con copiar/abrir, actividad de esa tienda, resumen de la oferta y resumen del contenido del borrador.
- Secciones propias: producto principal, bonos gratis, upsells y precios, oferta post-compra, diseño de landing, checkout, cobros y configuración.
- **Landing:** hero, beneficios, puntos de dolor y prueba social se guardan en `landings.draft` y pasan a `published` al publicar. `painPoints` y `socialProof` son opcionales en el esquema para aceptar documentos anteriores. Sin contenido, esas secciones no se muestran.
- **Tienda:** producto principal y precio, bonos sin precio, upsells con precio y oferta post-compra continúan en `stores`. El editor de landing y el checkout muestran la misma oferta asociada y enlazan a su configuración, sin copiar importes al contenido de la landing.
- La oferta se resuelve desde la tienda al renderizar: actualizar precios/bonos afecta las nuevas visitas y compras sin republicar textos. Los pedidos anteriores conservan su copia histórica.
- Cobros se filtran en servidor por `storeId`, usando el índice `orders.by_store` antes del límite de 100 registros. Los permisos del panel siguen vigentes.
- Tema interno oscuro por defecto con selector persistente; sidebar adaptable a móvil. La plantilla pública y el contenido de vista previa quedan fuera del contenedor del tema interno.
- Verificación local: 37 tests pasan; build de Vite y chequeo TypeScript de los módulos Convex modificados pasan. Revisión visual a 1280px y 390px con fixtures temporales aisladas, sin escribir datos de negocio. Sin prueba de sesión autenticada cloud ni despliegue. El build advierte un bundle mayor a 500 kB.
- Para llevarlo al entorno desplegado hay que publicar frontend y backend juntos: se agregaron campos opcionales de contenido e índice de cobros. No se requieren migraciones de documentos existentes para estos campos.


## Template de venta y formulario por secciones (15/11/2026)

Implementación local a partir de la captura de referencia: plantilla fija con bloques claros/oscuros, hero centrado, portada y oferta, bonos, tarjetas de beneficios, problemas, testimonios, resumen, pasos, garantía, FAQ y cierre con CTA fijo. El panel configura el contenido mediante secciones desplegables; no incorpora edición visual libre. El preview en iframe reutiliza el componente público, actualiza sin guardar y deshabilita la compra.

- Nuevos campos opcionales de `landings`: promoción con fecha absoluta, controles de visibilidad, subtítulos, tarjetas estructuradas, capturas de testimonios, pasos, resumen, días de garantía, cierre, barra fija, marca y enlaces legales.
- La oferta conserva la fuente única de precios. Precio de referencia y valores informativos de bonos se configuran en la tienda, se validan en servidor y no se cobran. El formulario abre los enlaces de oferta en otra pestaña para preservar el contenido en edición.
- Compatibilidad: se aceptan strings anteriores en beneficios/problemas y documentos sin los nuevos campos. La publicación de contenido continúa separada del borrador. Cambiar el template compartido cambia la presentación de las landings al desplegar el frontend.
- El contador desaparece al vencer; no cambia automáticamente precios. No se implementaron estadísticas de visitantes/ventas, cupos artificiales ni reseñas inventadas.
- Verificación local: 43 pruebas, compilación de producción y TypeScript de módulos Convex modificados. Navegador con fixtures temporales sin datos persistidos: desktop/móvil, preview en vivo, agregar/quitar tarjetas, borrador/publicación simulados, error de guardado conservando texto, FAQ, CTA y contenido vacío. Las pruebas de backend sí ejecutan las mutations con Convex Test. No se verificó pago real ni sesión autenticada cloud; no se desplegó esta actualización.
- Publicación pendiente: desplegar frontend y backend juntos para habilitar los nuevos campos en el entorno cloud.


## Sidebar por secciones (15/11/2026)

La navegación se agrupa en Tienda, Oferta, Experiencia de compra, Gestión y Recursos compartidos, con encabezados y separadores. Conserva las rutas y la selección activa; Todas las tiendas también indica su estado activo. Sin tiendas, Crear mi primera tienda lleva directamente al formulario de alta. Verificado en escritorio y móvil (390 px), cierre del menú al navegar y estado sin tiendas con fixtures locales temporales. Compilación y 55 pruebas pasan; sin despliegue de esta actualización.

## Actividad y contador simulados en checkout (15/11/2026)

Por corrección explícita del usuario, el checkout usa temporalmente números aleatorios, sin contar sesiones reales: 2–15 personas, cambiando cada 15 segundos. El contador empieza entre 8:01 y 14:59, baja según el reloj y conserva el vencimiento por tienda/pestaña al recargar. Al llegar a cero se queda en 00:00; no cambia importes ni bloquea Stripe. Se muestra también sin extras. La fuente está aislada en checkoutSignals.js y CheckoutSignals.jsx para conectarla después. El panel informa la simulación; el antiguo ajuste liveVisitors y los endpoints reales se conservan, pero no se usan en esta interfaz.

Verificado localmente: 62 pruebas pasan, build correcto (advertencia existente de bundle mayor a 500 kB), revisión en escritorio y celular con fixture temporal, contador persistente al recargar y caso sin extras. Sin pago real ni despliegue.


## Downsell del producto principal y de la post-compra (15/11/2026)

Pedido por el dueño con Impultienda como referencia. Cierra la pregunta pendiente 7 (alternativa al rechazar la post-compra).

- **Producto principal:** `stores.downsell` (opcional) guarda activación, descuento porcentual entero (1–90) y los textos del cartel y de la página. El primer «atrás» en la landing o el checkout abre el cartel una vez por pestaña; al aceptar se abre `/oferta` con el principal y sus bonos, sin extras. El popup de salida por mouse sigue existiendo aparte.
- **Post-compra:** `stores.postPurchase.downsellPercent` (opcional). Al responder «No, gracias» se muestra una vez el mismo producto con descuento; un segundo rechazo lo oculta.
- El navegador solo envía `downsell: true`; el servidor calcula el importe (`discounted` en `convex/lib/pricing.ts`, redondeo a la unidad mínima de la moneda) y marca la orden con `downsell`, visible en Cobros y entregas. Quien conozca la dirección `/oferta` puede comprar con descuento sin pasar por el cartel: el descuento es público mientras esté activado.
- Verificado localmente: 83 pruebas (incluye `test/downsell.test.js`), build y TypeScript de los módulos Convex modificados. No se probó en navegador ni con pago real, y no se desplegó. Falta revisar en navegador real el cartel al volver atrás (escritorio y celular).
- Publicación: desplegar frontend y backend juntos. Los campos nuevos son opcionales; no requiere migraciones.



## Ajuste a referencias y checkout en español (15/11/2026)

Solicitud: resolver las diferencias visuales/funcionales detectadas frente a las capturas, conservando español. La landing incorpora Nunito Sans para títulos, degradados, emojis, carrusel manual de testimonios, métricas configurables, estrellas, cupos informativos, espectadores simulados, frase de cierre, pasos conectados y ahorro/precio tachado en el CTA fijo. Sin métricas/cupos cargados, esos indicadores se ocultan. El panel configura los nuevos campos, con validación y borrador/publicación; no se copiaron los testimonios ni las cifras de la referencia a datos reales.

Landing y checkout comparten el contador por visita de 8:01–14:59; también se puede seleccionar fecha absoluta. La vista previa no consume el contador real. Checkout en español con datos personales visibles desde el inicio, medios de pago cargados automáticamente con Stripe Elements/Checkout Sessions, botón azul, precios en español y enlaces legales compartidos. Los extras conservan los datos ingresados, preparan la sesión correspondiente y quedan bloqueados durante confirmación. La confirmación compara importe/moneda con Stripe. Tarjetas y contacto se transmiten directamente a Stripe; no se guardan en sessionStorage. La integración embebida de post-compra/downsells se conserva. Crear la sesión anticipadamente genera una orden pendiente, nunca una venta confirmada.

Validación local: 89 pruebas, compilación y chequeo TypeScript del backend. Fixture temporal aislada con revisión en 1280px/390px: carrusel, contador compartido, selección de extras, actualización de importes, persistencia de datos y checkout sin extras. Pagos sin claves permanecen deshabilitados; no se hizo un pago real. Frontend y backend deben desplegarse juntos; no se desplegó esta actualización.


## Oferta unificada (15/11/2026)

Producto principal, bonus y upsells comparten la vista «Productos y oferta» en `/panel/tiendas/:storeId/productos`, con tres desplegables independientes y un único guardado. El principal se abre inicialmente; los enlaces con `#bonos` y `#upsells` abren y enfocan visualmente su sección. Las rutas antiguas de bonos/upsells redirigen a esta vista. Los accesos desde inicio, resumen de oferta y checkout apuntan a las nuevas secciones. No cambia el modelo de datos ni los cobros.

Verificación local: 89 pruebas y build correctos, con la advertencia existente de bundle mayor a 500 kB. Revisión en navegador con fixture temporal aislada, escritorio y móvil de 390 px: estados sin extras/bonus, agregar y editar ambos, guardado conjunto de importes y validación de un precio vacío con reapertura de desplegables. La fixture no escribe datos reales y fue eliminada. Sin despliegue ni prueba de guardado autenticado cloud.
