/**
 * Genera los datos geográficos estáticos de la app (se ejecuta UNA vez en desarrollo):
 *   node scripts/generate-geo.mjs
 *
 * Salida:
 *   src/data/worldMap.js  -> contornos de países como paths SVG (proyección equirectangular)
 *   src/data/countries.js -> países: código, nombre en castellano, continente, centro y alias
 *
 * Fuentes (dependencias de desarrollo, NO se cargan en el navegador):
 *   world-atlas (Natural Earth 1:110m, dominio público) y world-countries (licencia ODbL).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { feature } from 'topojson-client'

const require = createRequire(import.meta.url)
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'))
const countries = require('world-countries')

// ===== Proyección: equirectangular recortada (de 84°N a 58°S, sin la Antártida) =====
const WIDTH = 1000
const LAT_MAX = 84
const LAT_MIN = -58
const HEIGHT = Math.round(((LAT_MAX - LAT_MIN) / 360) * WIDTH * 10) / 10
const project = ([lng, lat]) => [((lng + 180) / 360) * WIDTH, ((LAT_MAX - lat) / 360) * WIDTH]
const r1 = (n) => Math.round(n * 10) / 10

// ===== Continentes (los que usa la app) =====
const NORTH_AMERICA = new Set(['US', 'CA', 'GL', 'BM', 'PM'])
function continentOf(c) {
  if (c.region === 'Europe') return 'europe'
  if (c.region === 'Asia') return 'asia'
  if (c.region === 'Africa') return 'africa'
  if (c.region === 'Oceania') return 'oceania'
  if (c.region === 'Americas') return NORTH_AMERICA.has(c.cca2) ? 'north-america' : 'latin-america'
  return null // Antártida
}

const byNumeric = new Map(countries.map((c) => [c.ccn3, c]))

// ===== Contornos =====
const geo = feature(topo, topo.objects.countries)
const paths = []
for (const f of geo.features) {
  const c = byNumeric.get(String(f.id).padStart(3, '0'))
  if (!c || c.cca2 === 'AQ') continue
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  let d = ''
  for (const poly of polys) {
    for (const rawRing of poly) {
      // Antimeridiano (180°): si un contorno salta de +180 a -180 (Rusia, Fiji…), al dibujarlo
      // se uniría con una línea que cruza todo el mapa. "Desenvolvemos" las longitudes para
      // que cada punto quede a menos de 180° del anterior; lo que sobresale queda fuera del mapa.
      const ring = []
      for (const [lng, lat] of rawRing) {
        let l = lng
        const prev = ring[ring.length - 1]
        if (prev) {
          while (l - prev[0] > 180) l -= 360
          while (prev[0] - l > 180) l += 360
        }
        ring.push([l, lat])
      }
      // Simplificación: descartamos puntos a menos de 0,7 px del anterior
      const pts = []
      for (const p of ring.map(project)) {
        const last = pts[pts.length - 1]
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.7) pts.push(p)
      }
      if (pts.length < 3) continue
      d += 'M' + pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join('L') + 'Z'
    }
  }
  if (d) paths.push({ code: c.cca2, d })
}

// ===== Países: nombres, alias, continente y centro =====
// Alias de 2-3 letras solo si no son ambiguos (evita "IN", "IT", "ES", "CO"... como palabras)
const SHORT_ALIASES = new Set(['usa', 'u.s.', 'u.s.a.', 'uk', 'u.k.', 'uae', 'ksa', 'drc'])
const list = countries
  .map((c) => {
    const continent = continentOf(c)
    if (!continent) return null
    const names = [
      c.name.common,
      c.name.official,
      c.translations?.spa?.common,
      c.translations?.spa?.official,
      ...Object.values(c.name.native || {}).flatMap((n) => [n.common]),
      ...(c.altSpellings || []),
    ]
    const aliases = [...new Set(names.filter(Boolean).map((n) => n.toLowerCase().trim()))].filter(
      (a) => a.length >= 4 || SHORT_ALIASES.has(a),
    )
    return {
      code: c.cca2,
      name: c.translations?.spa?.common || c.name.common,
      continent,
      lat: c.latlng[0],
      lng: c.latlng[1],
      aliases,
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))

mkdirSync('src/data', { recursive: true })
const header = '// ARCHIVO GENERADO por scripts/generate-geo.mjs — no editar a mano.\n'
writeFileSync(
  'src/data/worldMap.js',
  header +
    '// Contornos: Natural Earth 1:110m (dominio público) vía world-atlas.\n' +
    `export const MAP_WIDTH = ${WIDTH}\nexport const MAP_HEIGHT = ${HEIGHT}\n` +
    `export const MAP_LAT_MAX = ${LAT_MAX}\nexport const MAP_LAT_MIN = ${LAT_MIN}\n` +
    `export const COUNTRY_PATHS = ${JSON.stringify(paths)}\n`,
)
writeFileSync(
  'src/data/countries.js',
  header + '// Datos de países: world-countries (licencia ODbL).\n' + `export const COUNTRIES = ${JSON.stringify(list)}\n`,
)
console.log(`worldMap.js: ${paths.length} países | countries.js: ${list.length} países`)
