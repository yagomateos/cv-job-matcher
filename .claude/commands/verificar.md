---
description: Verifica que la app está lista (build, lint, pruebas e2e y revisión visual de capturas)
---

Verifica el estado actual de la app antes de dar un cambio por terminado. Responde en castellano.

1. Ejecuta `npm run build` y `npm run lint`. Si algo falla, para y muestra el error.
2. Comprueba si el servidor de desarrollo responde en http://localhost:5173. Si no, arráncalo en
   segundo plano con `npm run dev`.
3. Ejecuta `npm run test:e2e`. Muestra el resumen y detalla cualquier FALLO.
4. Si en esta sesión se han tocado estilos o componentes visuales, ejecuta
   `ALLOW_ADZUNA=1 npm run screenshots` y **abre y revisa** las capturas de `docs/screenshots/`,
   empezando por las de móvil (`movil-*.png`). Busca: textos cortados, desbordes horizontales,
   elementos que se tapan, contrastes pobres y diferencias entre modo claro y oscuro.
5. Resume: qué se ha comprobado, qué pasa, qué falla y qué no se ha podido verificar.

$ARGUMENTS
