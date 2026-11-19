# GitHub Actions pausado

Los despliegues de Ateneo se realizan manualmente. No hay archivos `.yml` ni `.yaml` en `.github/workflows/`: el workflow se conserva en `workflows-disabled/deploy.yml`, donde GitHub Actions no lo ejecuta ni permite lanzarlo con `workflow_dispatch`.

Este cambio en el repositorio se aplica en GitHub cuando se sube el commit correspondiente. No publica la aplicación ni cambia por sí solo los ajustes remotos de Actions.

## Despliegue manual

- `npm run deploy -- "mensaje del commit"`: guarda los cambios, los sube a `origin/main` y ejecuta el despliegue local con `.env`.
- `pnpm run deploy:convex`: publica sin crear commit ni hacer push, con las variables de entorno ya cargadas.
- `pnpm run deploy:verify`: verifica que los archivos publicados coincidan con el build local.

## Reactivación futura

Solo cuando se decida volver a usar Actions: mover `workflows-disabled/deploy.yml` a `workflows/deploy.yml`, revisar secretos y variables de build, descomentar el evento `push` y quitar `if: false` del job `deploy`. El archivo archivado conserva esos bloqueos como medida adicional. No reactivarlo como parte de cambios de interfaz o marca.
