# CV Job Matcher

Sube tu CV en PDF y obtén un ranking de ofertas tech de todo el mundo ordenadas por % de match,
con las skills que tienes y las que te faltan para cada una.

**En producción:** https://frontend-jobs-app-psi.vercel.app

## Qué hace

- **Lee el CV en el navegador** (pdf.js): el PDF no se envía a ningún servidor.
- **Detecta tu perfil** (10 perfiles tech: Frontend, Backend, Full Stack, Móvil, IA/ML, Datos,
  DevOps/Cloud, QA, Ciberseguridad, Sistemas/Soporte IT), tus skills (+120), tu idioma, país y ciudad.
  Rechaza CVs que no son del sector tecnológico.
- **Busca en 14 fuentes** con datos públicos: Adzuna, Himalayas, Hacker News "Who is hiring?",
  RemoteOK, Remotive, We Work Remotely, Working Nomads, Jobicy, NoFluffJobs, GetOnBoard,
  Landing.jobs, Arbeitnow, Tecnoempleo y Manfred. Más enlaces de búsqueda a portales sin API
  (LinkedIn, Indeed, Glassdoor, InfoJobs…).
- **Mapa mundial interactivo** (SVG propio), filtros por continente, país, fuente y match mínimo,
  paginación, modo claro/oscuro y diseño adaptado a móvil.

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # y rellena las claves de Adzuna (opcional)
npm run dev                  # http://localhost:5173
```

Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | `.env.local` (local) y variables del proyecto en Vercel | Claves de [Adzuna](https://developer.adzuna.com/). Sin prefijo `VITE_`: las añade el proxy y **nunca llegan al navegador**. |
| `VITE_ADZUNA_ENABLED` | opcional | `false` desactiva Adzuna. |

## Proxies

Algunas fuentes no permiten CORS o necesitan claves, así que pasan por `/proxy/...`:

- **Local:** proxy de Vite (`vite.config.js`), funciona con `npm run dev` y `npm run preview`.
- **Vercel:** reglas `routes` de `vercel.json` (las claves de Adzuna se inyectan en el servidor).

## Estructura

```
src/
├── components/   UI: Home (portada), CVUploader, JobCard, JobMap, Filters, SearchBar, Pagination…
├── hooks/        useCV (CV y perfil), useJobs (carga progresiva y match), useTheme
├── services/     cvService (PDF, skills, perfil, match), jobService (fuentes), geoService (ubicaciones)
└── data/         countries.js y worldMap.js (generados por scripts/generate-geo.mjs)
```

Para añadir una skill: `SKILL_GROUPS` y `SKILL_ALIASES` en `src/services/cvService.js`.

## Desplegar

El repositorio está conectado a Vercel:

- **Push a `main`** → despliegue a producción automático.
- **Push a cualquier otra rama** (o pull request) → despliegue de vista previa con su propia URL.

También se puede desplegar a mano con `vercel deploy --prod`.

Datos geográficos: Natural Earth (dominio público) y world-countries (ODbL).
