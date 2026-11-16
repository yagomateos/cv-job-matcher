# CLAUDE.md — CV Job Matcher

App React (Vite) que lee un CV en PDF **en el navegador**, detecta perfil y skills, y ordena
ofertas tech de 14 fuentes por % de match. Sin backend propio: los únicos "servidores" son los
proxies (Vite en local, `vercel.json` en producción).

- Producción: https://frontend-jobs-app-psi.vercel.app · Repo: github.com/yagomateos/cv-job-matcher (privado)
- Idioma: **todo en castellano** (UI, comentarios de código, mensajes de commit, respuestas).

## Comandos

```bash
npm run dev            # http://localhost:5173 (los proxies solo funcionan con dev/preview)
npm run build          # siempre antes de dar algo por terminado
npm run lint           # oxlint
npm run test:e2e       # Chrome real contra BASE_URL (por defecto localhost:5173, con dev arrancado)
npm run screenshots    # regenera docs/screenshots/ (usa ALLOW_ADZUNA=1)
npm run generate:geo   # regenera src/data/ (no editar esos archivos a mano)
```

## Restricciones del proyecto

- **JavaScript (no TypeScript), CSS puro** en `src/App.css`. Sin librerías de UI, de iconos ni de
  mapas: los iconos son SVG propios (`src/components/Icons.jsx`) y el mapa es SVG propio.
- Colores siempre con **tokens CSS** (`--bg`, `--surface`, `--accent`…). Tema oscuro en `:root`,
  claro en `:root[data-theme='light']`. Cualquier color nuevo necesita valor en ambos temas y
  contraste AA (≥ 4,5:1 en texto).
- Breakpoints: `≤600px` móvil, `≤900px` tablet. Utilidades `.only-mobile`, `.only-mobile-block`,
  `.hide-mobile` (llevan `!important` a propósito: chocan con clases como `.field`).
- En móvil, `.sidebar` y `.results` son `display: contents` y los bloques se ordenan con `order`
  en `.layout`. Un bloque nuevo en esas columnas necesita su `order` en el media query de móvil.

## Arquitectura

```
src/services/cvService.js   PDF (pdf.js), SKILL_GROUPS/SKILL_ALIASES, detectRole, checkTechProfile,
                            detectHomeCountry/City, calculateMatch
src/services/jobService.js  una función fetchX por fuente + fetchAllJobs (carga progresiva, dedupe)
src/services/geoService.js  parseLocation (texto -> países/continentes/mundial), isLocalJob, project
src/services/jobMeta.js     seniority, salario anual aprox. en €, antigüedad
src/hooks/                  useCV, useJobs, useSavedJobs (localStorage), useTheme
src/components/             Home (portada), JobMap, JobCard, Filters, SavedJobs, SkillGaps…
```

Flujo de filtros en `App.jsx`: búsqueda → nivel/salario/fecha → (mapa: + fuentes) →
ubicación → fuentes → orden → paginación (12/página).

## Reglas que no hay que romper (y por qué)

- **Criterio único de "ofertas de un país": `isLocalJob`** (1–5 países, no mundial). Lo usan la
  burbuja del mapa, la franja, el selector de países y el filtro. Si cambia en un sitio, los
  números dejan de cuadrar (ya pasó: "pincho Portugal, pone 7 y salen 67"). `npm run test:e2e`
  comprueba que coinciden en todos los países.
- **Claves de Adzuna nunca con prefijo `VITE_`** (acabarían en el JS público). Viven en
  `.env.local` (local) y en las variables del proyecto en Vercel; las añade el proxy.
- **pdf.js: usar `pdfjs-dist/legacy/...`** (la build moderna de v6 usa APIs que muchos navegadores
  no tienen) y liberar con `loadingTask.destroy()` (en v6 `pdf.destroy()` no existe).
- **`vercel.json` usa `routes` (src/dest/transforms)**, no `rewrites`: el esquema no admite
  transforms en rewrites, y `vercel.ts` falla al compilar con el CLI en Windows.
- **Proxies**: fuente nueva sin CORS -> añadirla en `vite.config.js` **y** en `vercel.json`.
- **Adzuna tiene cuota gratuita limitada**: peticiones en tandas de 2 países con pausa (si no,
  HTTP 429), caché de 30 min en sessionStorage. Las pruebas la bloquean por defecto.
- **Skills**: añadir en `SKILL_GROUPS` (área correcta) y variantes en `SKILL_ALIASES`. Cuidado con
  alias ambiguos ("redes" coincide con "redes sociales"; "go" es una palabra inglesa).
- **Ubicaciones**: ciudades en `CITIES` de `geoService.js`; países con alias generados en
  `src/data/countries.js`. Cambios en los datos geográficos -> `npm run generate:geo`.

## Verificación antes de terminar

1. `npm run build` y `npm run lint` sin errores.
2. Con `npm run dev` arrancado: `npm run test:e2e` (todo OK).
3. Cambios visuales: `ALLOW_ADZUNA=1 npm run screenshots` y **mirar las capturas**, sobre todo
   móvil (390×844). El usuario exige que el móvil quede impecable y probado, no supuesto.
4. Si se toca el mapa o los filtros de ubicación: confirmar que la prueba de coherencia pasa.

## Git y despliegue

- El repo está conectado a Vercel: **push a `main` = despliegue a producción**; otras ramas y PRs
  generan una vista previa. Trabajar siempre en una rama y fusionar a `main` solo con el visto
  bueno del usuario.
- Mensajes de commit en castellano. Nunca subir `.env.local` ni `.vercel/`.
