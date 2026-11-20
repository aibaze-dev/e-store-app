# Artefactos públicos

El catálogo global vive en `/panel/artefactos`, bajo los permisos del panel. Las herramientas se abren sin sesión en el dominio principal, en `/a/:slug`. El código de las herramientas se desarrolla y publica con la aplicación. Sus fichas comerciales se editan desde el catálogo del panel. Los recursos registrados son [Prompt Builder](prompt-builder/README.md), en `/a/prompt-builder`, y [Meeting Prep](meeting-prep/README.md), en `/a/meeting-prep`.

## Agregar una herramienta

También está disponible [Test Your AI Knowledge](ai-knowledge/README.md), en `/a/ai-knowledge`: tests por día y globales basados en el ebook Master Claude in 5 Days, con selección variable, puntaje y referencias de repaso por página.

1. Crear `<slug>/index.jsx` dentro de esta carpeta, con un componente React exportado por defecto. Sus imágenes, componentes y estilos pueden vivir en la misma carpeta.
2. Agregar en `shared/artifact-registry.js` (en la raíz del proyecto; `src/artifacts/registry.js` lo reexporta) un objeto `{ slug, name, description, coverUrl? }`. Es metadato público versionado; no importar componentes ni CSS desde ese archivo.
3. Importar `lazy` desde React en `components.js` y agregar la entrada correspondiente:

```jsx
import { lazy } from 'react';

export const artifactComponents = {
  'planificador-semanal': lazy(() => import('./planificador-semanal/index.jsx')),
};
```

4. Ejecutar `pnpm test` y `pnpm build`, y verificar la herramienta por acceso directo y recarga, sin sesión, en móvil y escritorio. Abrir el catálogo no debe cargar el JS ni el CSS de la herramienta.
5. Publicar mediante el procedimiento habitual de despliegue del proyecto. Agregar archivos localmente no modifica el sitio publicado.

Los slugs son únicos y cumplen `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Conservarlos después de compartirlos: renombrarlos o eliminarlos rompe los enlaces ya entregados. Los tests verifican formato, unicidad y correspondencia con los componentes lazy.

## Apariencia y aislamiento

`ArtifactPage` proporciona la raíz `.artifact-<slug>`, por ejemplo `.artifact-planificador-semanal`. Todo CSS particular debe quedar limitado a ella, incluidas las variables. No usar reglas particulares sobre `html`, `body`, `:root`, `.dark` ni elementos sin prefijo. Dar nombres únicos a `@keyframes` y a cualquier identificador CSS global.

```css
.artifact-planificador-semanal { --planner-accent: #193b2c; background: white; color: #182923; }
.artifact-planificador-semanal .planner-title { color: var(--planner-accent); }
```

El CSS importado desde un chunk lazy permanece global después de visitar una herramienta. Revisar también la navegación de vuelta al panel y entre herramientas. La raíz limita los estilos particulares; no constituye aislamiento mediante iframe o Shadow DOM y los estilos base de la aplicación siguen presentes.

No envolver herramientas en `InternalTheme`, ni leer la preferencia del panel para definir su apariencia. El proveedor global comparte estado pero no aplica el modo oscuro. La clase compartida `.artifact-theme` aplica la paleta y los botones de `theme.css` tanto en la página como en cada `DialogContent` renderizado en un portal. El nombre de marca de estas herramientas se configura con `artifactBrandName` en `src/config/brandData.json`.

## Enlaces, títulos y datos

`artifactUrl(slug)` construye la URL absoluta con el origen de `VITE_SITE_URL`; si no está configurado correctamente usa el origen actual, igual que los enlaces existentes del sitio. Configurar el dominio principal en producción para compartir URLs correctas desde subdominios. Las rutas de tiendas conservan su comportamiento.

El catálogo permite abrir y copiar ese enlace, y configurar una ficha comercial. Al guardar por primera vez se crea un producto de tipo `artifact`, único por `artifactSlug`; las ediciones posteriores conservan su ID. La ficha incluye nombre, descripción, portada, estado, descripción corta, precio de referencia y destacado. Los selectores de oferta permiten usarla como principal, bono gratuito, upsell o postcompra. No se crean asociaciones a tiendas automáticamente. La URL es pública y se puede reenviar: no hay control de acceso por compra.

El nombre comercial no renombra el slug ni cambia los textos internos de la herramienta. El título público sigue usando el nombre del registro de código. La página establece `document.title` como «Nombre · Marca» y restaura el título anterior al desmontarse. Los slugs inexistentes muestran «Artefacto no encontrado». La carga usa Suspense y los errores ofrecen recargar.

Open Graph conserva los metadatos genéricos de `index.html`: esta implementación no agrega renderizado en servidor ni vistas previas específicas al compartir. No incluir secretos ni datos privados en el código o los metadatos públicos. Si una herramienta futura necesita persistencia, definir su modelo y permisos de backend como trabajo propio; este catálogo no agrega tablas de Convex.

La carpeta externa `artifacts/offer-creator` es otro proyecto y no forma parte de este registro.

## Verificación inicial — 19/11/2026

Pasaron 217 tests y `pnpm build`; Vite conserva la advertencia existente sobre chunks mayores a 500 kB. Revisión local con fixture temporal: catálogo vacío y tarjeta, navegación en escritorio y móvil (390 px efectivos), copiar con confirmación y alternativa manual al simular un fallo, apertura en otra pestaña, acceso directo y recarga sin sesión, título y restauración, carga diferida de JS/CSS e aislamiento al volver al panel. El catálogo real sin sesión redirige al acceso; un slug inexistente muestra el estado público correspondiente.

El panel se revisó con una fixture visual, sin iniciar una sesión administrativa cloud ni escribir datos de negocio. La herramienta y todos los archivos temporales fueron retirados antes de ejecutar los tests y el build finales. El registro queda vacío y no hubo despliegue a producción.


## Fichas comerciales

`products.saveArtifact` valida permisos administrativos y slugs contra el registro compartido. Genera un único entregable `link` usando el origen de `SITE_URL` del backend; configurar el mismo dominio principal en `SITE_URL` y `VITE_SITE_URL`. No acepta URLs ni archivos arbitrarios. El editor de ebooks no puede sobrescribir un artefacto; los enlaces antiguos por ID redirigen a su ficha.

El estado archivado conserva las ofertas existentes y la URL pública, siguiendo las reglas de los ebooks. Los pedidos conservan las instantáneas de nombres y enlaces originales. La ficha no controla acceso por compra ni cambia la implementación de la herramienta. Los productos legacy sin tipo siguen siendo ebooks. El esquema agrega un tipo y un índice, sin migración de registros ni nuevas tablas.

Para activar esta funcionalidad en un entorno compartido se deben publicar juntos el backend (esquema y funciones) y el frontend. La validación local usa Convex-test, sin escribir productos ni desplegar a producción.

Verificación de fichas comerciales — 19/11/2026: `pnpm test` pasó 269 tests y `pnpm build` finalizó correctamente (advertencia existente de bundle principal mayor a 500 kB). Los nuevos tests cubren permisos, registro único por slug, validación, enlace del dominio principal, bonos sin cargo, upsells pagos y conservación del entregable en pedidos anteriores. La revisión visual usó componentes reales con un adaptador temporal de datos en memoria: configuración, edición, archivado, copia, error de guardado, separación de ebooks y móvil a 390 px. No se probaron uploads reales ni una sesión administrativa contra el backend cloud; el adaptador y sus datos se retiraron. Sin despliegue.
