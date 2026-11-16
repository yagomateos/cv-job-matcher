import { COUNTRIES } from '../data/countries'
import { MAP_LAT_MAX, MAP_WIDTH } from '../data/worldMap'

/** Continentes que usa la app (clave -> etiqueta). */
export const CONTINENT_LABELS = {
  europe: 'Europa',
  'north-america': 'Norteamérica',
  'latin-america': 'Latinoamérica',
  asia: 'Asia',
  africa: 'África',
  oceania: 'Oceanía',
}

/**
 * Una oferta abierta a más países que esto ("toda Europa", "toda Latinoamérica"…) no se
 * cuenta como oferta "de" cada país en el mapa ni en el resumen (sí se puede filtrar por ellos).
 */
export const MAX_COUNTRIES_FOR_BUBBLE = 5

/**
 * ¿Es una oferta "concreta" de país (1 a 5 países), y no una abierta a toda una región
 * (p. ej. "52 países de Europa") o sin restricción? Es el criterio único para contar y
 * filtrar ofertas por país: la burbuja del mapa, la franja, el selector y la lista coinciden.
 */
export const isLocalJob = (job) =>
  !job.geo.worldwide && job.geo.countries.length > 0 && job.geo.countries.length <= MAX_COUNTRIES_FOR_BUBBLE

/** Datos de cada país por código ISO (ES, US...): nombre en castellano, continente, centro. */
export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))

/** Coordenadas (lat, lng) -> punto (x, y) del mapa SVG (misma proyección que worldMap.js). */
export function project(lat, lng) {
  return [((lng + 180) / 360) * MAP_WIDTH, ((MAP_LAT_MAX - lat) / 360) * MAP_WIDTH]
}

// ===== Alias de lugar -> país =====

/** Ciudades frecuentes en ofertas tech (en inglés y en el idioma local). */
const CITIES = {
  US: ['san francisco', 'bay area', 'new york', 'nyc', 'seattle', 'austin', 'boston', 'los angeles', 'chicago', 'denver', 'miami', 'atlanta', 'san diego', 'san jose', 'palo alto', 'mountain view', 'menlo park', 'washington dc', 'washington, d.c.', 'portland', 'dallas', 'houston', 'philadelphia', 'pittsburgh', 'salt lake city', 'raleigh', 'boulder', 'brooklyn', 'oakland', 'berkeley', 'sunnyvale', 'redwood city', 'santa monica', 'minneapolis', 'detroit', 'nashville', 'phoenix', 'las vegas', 'sf bay'],
  CA: ['toronto', 'vancouver', 'montreal', 'montréal', 'ottawa', 'calgary', 'waterloo', 'ontario', 'quebec', 'québec', 'british columbia', 'alberta'],
  MX: ['ciudad de méxico', 'mexico city', 'cdmx', 'guadalajara', 'monterrey'],
  BR: ['são paulo', 'sao paulo', 'rio de janeiro', 'belo horizonte', 'florianópolis', 'curitiba', 'porto alegre'],
  AR: ['buenos aires', 'córdoba, argentina', 'rosario'],
  CL: ['santiago de chile', 'santiago, chile'],
  CO: ['bogotá', 'bogota', 'medellín', 'medellin', 'cali, colombia'],
  PE: ['lima, peru', 'lima, perú'],
  UY: ['montevideo'],
  GB: ['london', 'londres', 'manchester', 'edinburgh', 'cambridge, uk', 'oxford', 'bristol', 'glasgow', 'leeds', 'birmingham', 'belfast', 'england', 'scotland', 'wales', 'great britain', 'britain'],
  IE: ['dublin', 'cork'],
  ES: [
    'madrid', 'barcelona', 'valencia', 'sevilla', 'seville', 'málaga', 'malaga', 'bilbao', 'zaragoza', 'alicante', 'palma', 'las palmas', 'girona', 'cataluña', 'catalunya', 'catalonia', 'andalucía', 'comunidad de madrid', 'país vasco', 'euskadi', 'galicia', 'asturias',
    // Área de Barcelona
    'sant cugat', 'sant cugat del vallès', 'badalona', "l'hospitalet", 'hospitalet de llobregat', 'terrassa', 'sabadell', 'castelldefels', 'cornellà', 'el prat de llobregat', 'granollers', 'mataró', 'esplugues', 'sant joan despí',
    // Otras ciudades
    'tarragona', 'lleida', 'reus', 'san sebastián', 'donostia', 'vitoria', 'pamplona', 'santander', 'oviedo', 'gijón', 'a coruña', 'la coruña', 'vigo', 'santiago de compostela', 'salamanca', 'valladolid', 'murcia', 'cartagena', 'granada', 'cádiz', 'almería', 'castellón', 'tenerife', 'gran canaria', 'alcobendas', 'las rozas', 'pozuelo', 'getafe', 'leganés', 'tres cantos',
  ],
  PT: ['lisbon', 'lisboa', 'porto', 'braga', 'coimbra'],
  FR: ['paris', 'lyon', 'marseille', 'toulouse', 'nantes', 'bordeaux', 'lille', 'nice', 'puteaux', 'île-de-france'],
  DE: ['berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf', 'dusseldorf', 'leipzig', 'dresden', 'nuremberg', 'nürnberg', 'hannover', 'bremen', 'karlsruhe', 'bonn', 'mannheim', 'chemnitz'],
  NL: ['amsterdam', 'rotterdam', 'utrecht', 'the hague', 'den haag', 'eindhoven', 'holland', 'nederland'],
  BE: ['brussels', 'bruselas', 'antwerp', 'ghent'],
  CH: ['zurich', 'zürich', 'geneva', 'ginebra', 'basel', 'lausanne', 'bern'],
  AT: ['vienna', 'viena', 'wien', 'graz', 'linz'],
  IT: ['milan', 'milano', 'milán', 'rome', 'roma', 'turin', 'torino', 'bologna', 'florence', 'firenze', 'naples'],
  PL: ['warsaw', 'warszawa', 'varsovia', 'krakow', 'kraków', 'wrocław', 'wroclaw', 'gdańsk', 'gdansk', 'poznań', 'poznan', 'łódź', 'lodz', 'katowice'],
  CZ: ['prague', 'praha', 'praga', 'brno'],
  SE: ['stockholm', 'estocolmo', 'gothenburg', 'malmö'],
  DK: ['copenhagen', 'copenhague', 'københavn', 'aarhus'],
  NO: ['oslo', 'bergen'],
  FI: ['helsinki', 'espoo', 'tampere'],
  EE: ['tallinn', 'tartu'],
  LT: ['vilnius', 'kaunas'],
  LV: ['riga'],
  RO: ['bucharest', 'bucarest', 'cluj', 'iasi', 'timisoara'],
  BG: ['sofia'],
  GR: ['athens', 'atenas', 'thessaloniki'],
  HU: ['budapest'],
  UA: ['kyiv', 'kiev', 'lviv', 'kharkiv'],
  RS: ['belgrade', 'belgrado', 'novi sad'],
  HR: ['zagreb'],
  CY: ['limassol', 'nicosia'],
  MT: ['valletta'],
  TR: ['istanbul', 'estambul', 'ankara'],
  IL: ['tel aviv', 'jerusalem', 'haifa'],
  AE: ['dubai', 'dubái', 'abu dhabi'],
  SA: ['riyadh'],
  IN: ['bangalore', 'bengaluru', 'mumbai', 'pune', 'hyderabad', 'chennai', 'new delhi', 'delhi', 'gurgaon', 'gurugram', 'noida', 'kolkata', 'ahmedabad'],
  SG: ['singapore', 'singapur'],
  JP: ['tokyo', 'tokio', 'osaka', 'kyoto'],
  KR: ['seoul', 'seúl', 'korea'],
  CN: ['beijing', 'pekín', 'shanghai', 'shenzhen', 'hangzhou'],
  HK: ['hong kong'],
  TW: ['taipei'],
  PH: ['manila', 'cebu'],
  VN: ['ho chi minh', 'hanoi', 'vietnam'],
  ID: ['jakarta', 'bali'],
  MY: ['kuala lumpur'],
  TH: ['bangkok'],
  PK: ['karachi', 'lahore', 'islamabad'],
  AU: ['sydney', 'sídney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra'],
  NZ: ['auckland', 'wellington', 'christchurch'],
  ZA: ['cape town', 'johannesburg', 'durban', 'pretoria'],
  NG: ['lagos', 'abuja'],
  KE: ['nairobi'],
  EG: ['cairo', 'el cairo'],
  MA: ['casablanca', 'rabat'],
}

// Estados de EE. UU. (nombre completo). "Georgia" se deja fuera por ambigua (también es un país).
const US_STATES = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington state', 'west virginia', 'wisconsin', 'wyoming']

// "Ciudad, CA" / "Austin, TX": abreviatura de estado tras una coma (sensible a mayúsculas)
const US_STATE_ABBR = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/
// "US", "U.S.", "US-only", "(US)" (sensible a mayúsculas para no confundirlo con "us")
const US_CODE = /(^|[^A-Za-z])U\.?S\.?A?\.?($|[^A-Za-z])/

/** Regiones y husos horarios -> continentes. */
const CONTINENT_PATTERNS = [
  [/\b(europe|europa|eu|eea|emea|cet|cest|eet|wet)\b|european union|unión europea|european economic area/i, ['europe']],
  [/\b(emea|mena)\b|middle east|oriente medio/i, ['asia', 'africa']],
  [/north america|norteamérica|norte américa|\bnoram\b|\b(us|u\.s\.) time ?zones?|\b(est|edt|pst|pdt|cst|mst)\b/i, ['north-america']],
  [/\blatam\b|latin america|latinoamérica|américa latina|south america|sudamérica|suramérica|central america|centroamérica/i, ['latin-america']],
  [/\bamericas\b|\bamérica\b/i, ['north-america', 'latin-america']],
  [/\basia\b|\bapac\b|asia[\s-]pacific|asia-pacífico/i, ['asia']],
  [/\bafrica\b|\báfrica\b/i, ['africa']],
  [/\boceania\b|\boceanía\b|australasia|\banz\b/i, ['oceania']],
]

// Sin restricción de país (válidas desde cualquier sitio)
const WORLDWIDE_EXPLICIT = /worldwide|anywhere|global|mundial|world ?wide|todo el mundo|any location|all countries/i
const REMOTE_ONLY = /^\s*\(?\s*(fully\s+)?(remote|remoto|remota|remote[- ]first|100% remote)\s*\)?\s*$/i

// Índice alias -> código de país, y una única regex con todos los alias (los más largos primero)
const ALIAS_TO_CODE = new Map()
for (const c of COUNTRIES) for (const a of c.aliases) ALIAS_TO_CODE.set(a, c.code)
for (const [code, cities] of Object.entries(CITIES)) for (const city of cities) ALIAS_TO_CODE.set(city, code)
for (const state of US_STATES) ALIAS_TO_CODE.set(state, 'US')

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ALIAS_REGEX = new RegExp(
  `(?<![\\p{L}])(${[...ALIAS_TO_CODE.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})(?![\\p{L}])`,
  'giu',
)

// Índice ciudad -> país (solo ciudades, para detectar la ciudad del candidato)
const CITY_TO_CODE = new Map(Object.entries(CITIES).flatMap(([code, list]) => list.map((c) => [c, code])))
const CITY_REGEX = new RegExp(
  `(?<![\\p{L}])(${[...CITY_TO_CODE.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})(?![\\p{L}])`,
  'iu',
)

/**
 * Primera ciudad conocida que aparece en un texto, con su país.
 * @returns {{ city: string, country: string } | null} city con las mayúsculas del texto original
 */
export function findCity(text = '') {
  const match = text.match(CITY_REGEX)
  if (!match) return null
  return { city: match[1], country: CITY_TO_CODE.get(match[1].toLowerCase()) }
}

const cache = new Map()

/**
 * Interpreta un texto de ubicación de una oferta.
 * @param {string} text p. ej. "Berlin, Germany", "Remote (US)", "LATAM", "Worldwide"
 * @returns {{ countries: string[], continents: string[], worldwide: boolean }}
 *   countries: códigos ISO (ES, US...); continents: claves de CONTINENT_LABELS;
 *   worldwide: true si se puede trabajar desde cualquier país.
 */
export function parseLocation(text = '') {
  const key = text.trim()
  if (cache.has(key)) return cache.get(key)

  const countries = new Set()
  const continents = new Set()

  for (const match of key.matchAll(ALIAS_REGEX)) {
    const code = ALIAS_TO_CODE.get(match[1].toLowerCase())
    if (code) countries.add(code)
  }
  if (US_STATE_ABBR.test(key) || US_CODE.test(key)) countries.add('US')

  for (const [pattern, list] of CONTINENT_PATTERNS) if (pattern.test(key)) list.forEach((c) => continents.add(c))
  for (const code of countries) {
    const continent = COUNTRY_BY_CODE.get(code)?.continent
    if (continent) continents.add(continent)
  }

  // Mundial: lo dice expresamente, o solo dice "remoto" sin ningún país ni región
  const worldwide =
    WORLDWIDE_EXPLICIT.test(key) || !key || (REMOTE_ONLY.test(key) && countries.size === 0 && continents.size === 0)

  const result = { countries: [...countries], continents: [...continents], worldwide }
  cache.set(key, result)
  return result
}

/** Une varias ubicaciones (p. ej. la lista de países de una oferta) en un único resultado. */
export function parseLocations(texts) {
  const parts = texts.map(parseLocation)
  return {
    countries: [...new Set(parts.flatMap((p) => p.countries))],
    continents: [...new Set(parts.flatMap((p) => p.continents))],
    worldwide: parts.some((p) => p.worldwide),
  }
}
