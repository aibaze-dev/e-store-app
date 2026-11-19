# Artefactos públicos

El catálogo global vive en `/panel/artefactos`, bajo los permisos del panel. Las herramientas se abren sin sesión en el dominio principal, en `/a/:slug`. No se crean ni editan desde la interfaz; se desarrollan y publican con la aplicación. Los recursos registrados son [Prompt Builder](prompt-builder/README.md), en `/a/prompt-builder`, y [Meeting Prep](meeting-prep/README.md), en `/a/meeting-prep`.

## Agregar una herramienta

1. Crear `<slug>/index.jsx` dentro de esta carpeta, con un componente React exportado por defecto. Sus imágenes, componentes y estilos pueden vivir en la misma carpeta.
2. Agregar en `registry.js` un objeto `{ slug, name, description, coverUrl? }`. Es metadato público versionado; no importar componentes ni CSS desde ese archivo.
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

No envolver herramientas en `InternalTheme`, ni leer la preferencia del panel para definir su apariencia. El proveedor global comparte estado pero no aplica el modo oscuro. Cada herramienta define su presentación bajo su propia raíz.

## Enlaces, títulos y datos

`artifactUrl(slug)` construye la URL absoluta con el origen de `VITE_SITE_URL`; si no está configurado correctamente usa el origen actual, igual que los enlaces existentes del sitio. Configurar el dominio principal en producción para compartir URLs correctas desde subdominios. Las rutas de tiendas conservan su comportamiento.

El catálogo permite abrir y copiar ese enlace. Puede pegarse como entregable en los productos existentes y reutilizarse en distintas tiendas; no se crean asociaciones ni productos automáticamente. La URL es pública y se puede reenviar: no hay control de acceso por compra.

La página establece `document.title` como «Nombre · Marca» y restaura el título anterior al desmontarse. Los slugs inexistentes muestran «Artefacto no encontrado». La carga usa Suspense y los errores ofrecen recargar.

Open Graph conserva los metadatos genéricos de `index.html`: esta implementación no agrega renderizado en servidor ni vistas previas específicas al compartir. No incluir secretos ni datos privados en el código o los metadatos públicos. Si una herramienta futura necesita persistencia, definir su modelo y permisos de backend como trabajo propio; este catálogo no agrega tablas de Convex.

La carpeta externa `artifacts/offer-creator` es otro proyecto y no forma parte de este registro.

## Verificación inicial — 19/11/2026

Pasaron 217 tests y `pnpm build`; Vite conserva la advertencia existente sobre chunks mayores a 500 kB. Revisión local con fixture temporal: catálogo vacío y tarjeta, navegación en escritorio y móvil (390 px efectivos), copiar con confirmación y alternativa manual al simular un fallo, apertura en otra pestaña, acceso directo y recarga sin sesión, título y restauración, carga diferida de JS/CSS e aislamiento al volver al panel. El catálogo real sin sesión redirige al acceso; un slug inexistente muestra el estado público correspondiente.

El panel se revisó con una fixture visual, sin iniciar una sesión administrativa cloud ni escribir datos de negocio. La herramienta y todos los archivos temporales fueron retirados antes de ejecutar los tests y el build finales. El registro queda vacío y no hubo despliegue a producción.
