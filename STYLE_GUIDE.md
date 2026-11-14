# Guía de estilo de la plantilla

Esta base usa shadcn/ui (estilo New York, Radix, JavaScript), Tailwind CSS 4 y Lucide. Los componentes están en `src/components/ui`; son código local reutilizable. `components.json` configura el CLI y `@/` apunta a `src/`. Montserrat Variable se sirve desde las dependencias locales, sin llamadas a Google Fonts.

## Identidad y tema

- Leé esta guía, `src/theme.css` y los componentes existentes antes de construir pantallas.
- `src/theme.css` contiene imports de Tailwind, fuente, tokens semánticos y accesibilidad global. `src/styles.css` contiene la composición de la aplicación. El entrypoint importa ambos: mantené esa separación.
- Adaptá la marca y los tokens `--primary`, `--primary-foreground`, `--ring` y `--accent` al brief. El fallback es verde oscuro #193B2C, superficies claras y acento verde suave. Conservá contraste en botones y texto; un color de marca claro necesita texto oscuro.
- Usá `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary` y sus pares de foreground. No disperses colores hex por los componentes. Los estados de error no dependen del color de marca.
- Hay tokens para `.dark`; no agregues un selector de tema a menos que el producto lo necesite y lo implemente. Adaptá también los colores oscuros si ofrecés ese modo.

## Tipografía y espacio

- Montserrat para toda la interfaz. Texto de cuerpo de 14–16 px; inputs de al menos 16 px en móvil; interlineado 1.5–1.7. Reservá 12 px para metadatos y ayuda.
- Títulos de página de 28–36 px, títulos de sección de 18–24 px, peso 500–600. Los titulares comerciales pueden ser mayores. Usá un h1 y una jerarquía h2/h3 real, sin simular encabezados solo con CSS.
- Usá una escala de espacios de 4/8/12/16/24/32/48 px: 8–12 px entre label y control, 20–24 px entre campos y 24–32 px dentro de paneles.
- Contenido de aplicación de hasta 1280 px, formularios de acceso de 400–440 px. Padding móvil de 20–24 px. Evitá líneas de texto demasiado largas.
- Bordes finos, radios coherentes de 8–16 px y sombras suaves. Reservá fondos fuertes para marca y acciones principales. No conviertas cada párrafo en una tarjeta ni agregues gradientes, brillos o animaciones decorativas a todo.

## Componentes y acciones

- Reutilizá `Button`, `Input`, `Label`, `Card`, `Alert`, `Badge`, `Separator` y `Skeleton` de `@/components/ui`. Usá `cn` de `@/lib/utils` para combinar clases y variantes.
- Botón primario para la acción principal, `outline` o `secondary` para acciones secundarias y `ghost` para herramientas. Las acciones destructivas usan `destructive` y confirmación cuando hay pérdida de datos.
- Controles principales de 44–48 px; targets táctiles de al menos 44 px. Variantes pequeñas solo en interfaces densas con área táctil suficiente. Evitá botones que solo sean iconos sin nombre accesible.
- Iconos Lucide de 16–20 px y trazo consistente. Si un icono acompaña texto, usá `aria-hidden`; si es el único contenido, el control necesita `aria-label`.
- Para nuevos componentes complejos, reutilizá patrones shadcn/Radix; no implementes diálogos, menús o selects inaccesibles desde cero. El agente puede escribir componentes en `src/components/ui` y añadir dependencias permitidas, conservando las de la base.

## Formularios y autenticación

- Label visible asociado con `htmlFor`/`id`, tipo correcto, autocomplete y ayuda junto al campo. El placeholder nunca reemplaza el label.
- Conservá en `AuthPanel` login, registro, cierre de sesión, mostrar/ocultar contraseña, prevención de doble envío y estados de carga/error. Adaptá registro/invitaciones según el producto sin debilitar permisos.
- Mientras se envía, deshabilitá acciones duplicadas y mostrá texto de progreso. Conservá lo ingresado ante un error; no informes éxito hasta recibirlo del backend.
- Mostrá errores concretos en `Alert` con `role="alert"`, foco y una forma de reintentar. No expongas mensajes crudos del proveedor ni detalles que permitan descubrir cuentas.
- No muestres Google, recuperación de contraseña, términos o privacidad como enlaces si sus flujos o páginas no existen. No agregues credenciales ni usuarios de demostración.
- Autenticación con Better Auth y `useConvexAuth`; queries privadas solo con `isAuthenticated`. Los permisos se validan también en el servidor.

## Responsive y accesibilidad

- Diseñá desde 320 px hasta escritorio sin scroll horizontal. En móvil, una columna y acciones fáciles de alcanzar. En tablas, el scroll horizontal debe quedar dentro de su contenedor.
- Contrastá texto normal al menos 4.5:1 y elementos de interfaz al menos 3:1. Mantené foco visible, navegación por teclado y nombres accesibles. No transmitas estados solo con color.
- Ofrecé estados vacío, carga y error. Skeleton para contenido pendiente; explicá qué puede hacer la persona en un estado vacío. Nunca inventes métricas o datos para completar el diseño.
- Respetá `prefers-reduced-motion`; transiciones cortas (150–200 ms) para feedback. Evitá animaciones permanentes salvo indicadores de carga.
- Verificá móvil, escritorio, textos largos, registro, errores y estados deshabilitados antes de dar por terminada una pantalla.

## Agregar componentes en desarrollo local

```sh
pnpm dlx shadcn@latest add dialog
```

El CLI usa `components.json`. Revisá los archivos y dependencias resultantes; conservá el tema de marca y las dimensiones accesibles de esta base. El generador automático ya recibe el kit y no necesita ejecutar el CLI.

Referencias: [shadcn/ui con Vite](https://ui.shadcn.com/docs/installation/vite), [JavaScript](https://ui.shadcn.com/docs/javascript).
