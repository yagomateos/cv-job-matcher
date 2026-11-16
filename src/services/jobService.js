import { COUNTRY_BY_CODE, parseLocation, parseLocations } from './geoService'

/**
 * Servicio de ofertas: consulta las fuentes, filtra por el perfil del CV y normaliza
 * cada oferta a { id, title, company, url, tags, date, location, source, logo, salary,
 * description, geo }, donde geo = { countries, continents, worldwide } (ver geoService).
 */

// ===== Configuración de Adzuna =====
// Las claves NO están en el navegador: las añade el proxy (vite.config.js en local,
// vercel.json en Vercel) a partir de ADZUNA_APP_ID y ADZUNA_APP_KEY (ver .env.example).
// Para desactivar Adzuna: VITE_ADZUNA_ENABLED=false
export const ADZUNA_ENABLED = import.meta.env.VITE_ADZUNA_ENABLED !== 'false'

/**
 * Países donde se busca en Adzuna (código de la API -> moneda).
 * Repartidos por todo el mundo. Cada país es una petición: con más países se gasta
 * antes la cuota gratuita (y la carga tarda más, porque van de una en una).
 */
const ADZUNA_COUNTRIES = ['us', 'gb', 'de', 'es', 'fr', 'nl', 'ca', 'br', 'in', 'au']

// Todos los países que tiene Adzuna (código -> moneda). Si el país del CV está aquí,
// se busca en él aunque no esté en la lista de arriba, y con más páginas.
const ADZUNA_CURRENCY = {
  us: 'US$', gb: '£', de: '€', es: '€', fr: '€', nl: '€', it: '€', at: '€', be: '€',
  ca: 'C$', br: 'R$', in: '₹', au: 'A$', ch: 'CHF ', mx: 'MX$', nz: 'NZ$', pl: 'zł',
  sg: 'S$', za: 'R',
}

// Páginas de 50 ofertas: el país del candidato tiene muchas más ofertas relevantes
const ADZUNA_PAGES_HOME = 4
const ADZUNA_PAGES_OTHER = 1

// Nombres de las fuentes (se usan también en el panel de filtros)
export const SOURCE_NAMES = [
  'Himalayas',
  'Hacker News',
  'RemoteOK',
  'Remotive',
  'We Work Remotely',
  'Working Nomads',
  'Jobicy',
  'NoFluffJobs',
  'GetOnBoard',
  'Landing.jobs',
  'Arbeitnow',
  'Tecnoempleo',
  'Manfred',
  ...(ADZUNA_ENABLED ? ['Adzuna'] : []),
]

/**
 * Fuentes que pasan por proxy (/proxy/...):
 * - Himalayas y Working Nomads no permiten CORS (el navegador no puede leerlas directamente).
 * - Adzuna necesita claves que no deben ir en el JavaScript público.
 * El proxy es vite.config.js en local (`npm run dev` / `npm run preview`) y las
 * reescrituras de vercel.json en Vercel. En otro hosting estático estas fuentes fallarán
 * (se mostrará un aviso y el resto seguirá funcionando).
 */
const PROXY = {
  himalayas: '/proxy/himalayas',
  workingNomads: '/proxy/workingnomads',
  tecnoempleo: '/proxy/tecnoempleo',
  adzuna: '/proxy/adzuna',
}

/**
 * Cómo se busca cada perfil del CV en cada fuente:
 * - match:     regex que debe aparecer en el título / tags / extracto de la oferta.
 * - himalayas, getonboard: término de búsqueda.
 * - adzuna:    palabras clave (what_or = cualquiera de ellas). Sin palabras ambiguas en
 *              otros idiomas ("vue" en francés es "vista").
 * - nfj:       categorías de NoFluffJobs.
 * - wwr:       feeds RSS (categorías) de We Work Remotely.
 */
const ROLE_SEARCH = {
  frontend: {
    match: /react|javascript|typescript|front[\s-]?end|vue|angular|next\.?js|web developer|ui engineer/i,
    himalayas: 'frontend',
    getonboard: 'frontend',
    adzuna: 'frontend react angular typescript',
    nfj: ['frontend'],
    wwr: ['remote-front-end-programming-jobs', 'remote-full-stack-programming-jobs'],
  },
  backend: {
    match: /back[\s-]?end|node|python|java\b|golang|\bgo\b|php|ruby|django|\.net|c#|api|microservic|server/i,
    himalayas: 'backend',
    getonboard: 'backend',
    adzuna: 'backend python java node golang',
    nfj: ['backend'],
    wwr: ['remote-back-end-programming-jobs', 'remote-full-stack-programming-jobs', 'remote-programming-jobs'],
  },
  fullstack: {
    match: /full[\s-]?stack|react|javascript|typescript|front[\s-]?end|back[\s-]?end|node|vue|angular|web developer/i,
    himalayas: 'full stack',
    getonboard: 'fullstack',
    adzuna: 'fullstack react node typescript',
    nfj: ['fullstack'],
    wwr: ['remote-full-stack-programming-jobs', 'remote-front-end-programming-jobs', 'remote-back-end-programming-jobs'],
  },
  mobile: {
    match: /mobile|m[óo]vil|android|\bios\b|flutter|react native|swift|kotlin/i,
    himalayas: 'mobile developer',
    getonboard: 'mobile',
    adzuna: 'android ios flutter kotlin swift',
    nfj: ['mobile'],
    wwr: ['remote-programming-jobs', 'remote-full-stack-programming-jobs'],
  },
  ai: {
    match: /machine learning|\bml\b|\bai\b|\bia\b|llm|nlp|deep learning|data scien|computer vision|genai|generative|mlops|pytorch|tensorflow|artificial intelligence|inteligencia artificial/i,
    himalayas: 'machine learning',
    getonboard: 'machine learning',
    adzuna: 'pytorch tensorflow llm nlp mlops',
    nfj: ['artificial-intelligence', 'data'],
    wwr: ['remote-programming-jobs', 'remote-back-end-programming-jobs', 'remote-full-stack-programming-jobs'],
  },
  data: {
    match: /\bdata\b|datos|analytics|\bbi\b|business intelligence|etl|spark|\bsql\b|warehouse|databricks|snowflake|airflow|dbt/i,
    himalayas: 'data engineer',
    getonboard: 'data',
    adzuna: 'spark airflow snowflake databricks etl',
    nfj: ['data', 'big-data'],
    wwr: ['remote-programming-jobs', 'remote-back-end-programming-jobs'],
  },
  devops: {
    match: /devops|\bsre\b|site reliability|cloud|platform engineer|infra|kubernetes|terraform|\baws\b|azure|\bgcp\b/i,
    himalayas: 'devops',
    getonboard: 'devops',
    adzuna: 'devops kubernetes terraform sre',
    nfj: ['devops'],
    wwr: ['remote-devops-sysadmin-jobs'],
  },
  qa: {
    match: /\bqa\b|test|quality|sdet|automation|calidad/i,
    himalayas: 'qa engineer',
    getonboard: 'qa',
    adzuna: 'qa tester selenium playwright',
    nfj: ['testing'],
    wwr: ['remote-programming-jobs'],
  },
  security: {
    match: /secur|ciberseg|seguridad|pentest|\bsoc\b|siem|threat|vulnerab|offensive|red team/i,
    himalayas: 'security engineer',
    getonboard: 'security',
    adzuna: 'cybersecurity pentester siem',
    nfj: ['security'],
    wwr: ['remote-devops-sysadmin-jobs'],
  },
  it: {
    match: /support|soporte|help ?desk|service desk|sysadmin|system admin|administrador de sistemas|t[ée]cnico|technician|network|redes|infrastructure|infraestructura|\bit\b/i,
    himalayas: 'it support',
    getonboard: 'soporte',
    adzuna: 'sysadmin helpdesk windows linux networking',
    nfj: ['sys-administrator', 'support'],
    wwr: ['remote-devops-sysadmin-jobs'],
  },
}

const searchFor = (role) => ROLE_SEARCH[role] || ROLE_SEARCH.frontend

/** Quita etiquetas y entidades HTML de la descripción para trabajar con texto plano. */
function stripHtml(html = '') {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

/** Formatea un rango salarial numérico como "$80k - $120k". */
function formatSalaryRange(min, max, currency = '$') {
  const k = (n) => `${currency}${Math.round(n / 1000)}k`
  if (min > 0 && max > 0) return `${k(min)} - ${k(max)}`
  if (min > 0) return `Desde ${k(min)}`
  if (max > 0) return `Hasta ${k(max)}`
  return null
}

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', BRL: 'R$', INR: '₹' }

// Tiempo máximo de espera por petición
const REQUEST_TIMEOUT_MS = 15_000

/**
 * fetch + comprobación de status + parseo (JSON o texto), con mensaje de error legible.
 * @param {RequestInit} [init] opciones de fetch (p. ej. POST para NoFluffJobs)
 */
async function request(url, sourceName, init, as = 'json') {
  try {
    // Tiempo máximo por petición: una fuente lenta o caída no bloquea la carga
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined
    const res = await fetch(url, { ...init, signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return as === 'text' ? await res.text() : await res.json()
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'no respondió a tiempo' : err.message
    throw new Error(`No se pudieron cargar ofertas de ${sourceName}: ${reason}`)
  }
}
const getJSON = (url, sourceName, init) => request(url, sourceName, init, 'json')
const getText = (url, sourceName) => request(url, sourceName, undefined, 'text')

/**
 * El título debe parecer un puesto técnico. Algunas APIs (sobre todo Remotive)
 * devuelven ofertas de redacción, ventas o atención al cliente aunque busques "react".
 * Incluye términos en inglés, castellano, alemán, francés, italiano, neerlandés y polaco.
 */
const TECH_TITLE =
  /develop|engineer|programm|software|front[\s-]?end|back[\s-]?end|full[\s-]?stack|\bweb\b|\bui\b|\bux\b|architect|tech lead|\bcto\b|devops|\bsre\b|data|scien|machine learning|\bml\b|\bai\b|\bqa\b|tester|\btest|security|seguridad|cloud|platform|sysadmin|administrator|administrador|support|soporte|technician|t[ée]cnico|network|analyst|analista|entwickler|desarrollador|programador|ingenier|d[ée]veloppeur|sviluppatore|ontwikkelaar|programista|informátic/i

// Puestos de otros sectores que se cuelan por palabras como "support" o "analyst"
const NON_TECH_TITLE =
  /customer|sales|marketing|account (manager|executive)|recruit|talent|\bhr\b|human resources|finance|financial|legal|lawyer|content|writer|copywriter|social media|bookkeep|accountant|nurse|patient|teacher|driver|warehouse (associate|worker)|retail|cashier/i

/**
 * Comprueba si una oferta encaja con el perfil: título técnico (y no de otro sector)
 * + alguna palabra clave del perfil en el título o en el resto de campos.
 */
const matchesRole = (role, title, ...fields) =>
  TECH_TITLE.test(title) && !NON_TECH_TITLE.test(title) && searchFor(role).match.test([title, ...fields].join(' '))

/**
 * Clave para detectar duplicados. Quita del título los segmentos de ubicación
 * ("… | Spain | Remote"), porque algunas fuentes publican la misma oferta una vez por país.
 */
function dedupeKey(job) {
  const title = job.title
    .split('|')
    .map((seg) => seg.trim().toLowerCase())
    .filter((seg) => {
      if (!seg || seg === 'remote') return false
      const geo = parseLocation(seg)
      const isPlace = geo.countries.length > 0 || geo.continents.length > 0
      return !(isPlace && seg.split(/\s+/).length <= 3)
    })
    .join('|')
  return `${title}|${job.company}`.toLowerCase().trim()
}

/** Añade la ubicación interpretada (países / continentes / mundial) a una oferta. */
const withGeo = (job) => ({ ...job, geo: parseLocation(job.location) })

// =====================================================================
// Fuentes
// =====================================================================

/** RemoteOK. El primer elemento de la respuesta es metadata (aviso legal), no una oferta. */
export async function fetchRemoteOK(role = 'frontend') {
  const data = await getJSON('https://remoteok.com/api', 'RemoteOK')
  if (!Array.isArray(data)) throw new Error('Respuesta inesperada de RemoteOK')

  return data
    .slice(1)
    .filter((job) => matchesRole(role, job.position || '', (job.tags || []).join(' ')))
    .map((job) =>
      withGeo({
        id: `remoteok-${job.id}`,
        title: job.position || 'Sin título',
        company: job.company || 'Empresa desconocida',
        url: job.url || job.apply_url,
        tags: job.tags || [],
        date: job.date || (job.epoch ? new Date(job.epoch * 1000).toISOString() : null),
        // En RemoteOK una ubicación vacía significa remoto sin restricción
        location: job.location || 'Remoto (mundial)',
        source: 'RemoteOK',
        logo: job.company_logo || job.logo || '',
        salary: formatSalaryRange(job.salary_min, job.salary_max),
        description: stripHtml(job.description),
      }),
    )
}

/** Remotive. Su API gratuita ignora categoría y búsqueda: se pide una vez y se filtra por perfil. */
export async function fetchRemotive(role = 'frontend') {
  const data = await getJSON('https://remotive.com/api/remote-jobs?category=software-dev', 'Remotive')
  if (!Array.isArray(data?.jobs)) throw new Error('Respuesta inesperada de Remotive')

  return data.jobs
    .filter((job) => matchesRole(role, job.title || '', (job.tags || []).join(' ')))
    .map((job) =>
      withGeo({
        id: `remotive-${job.id}`,
        title: job.title || 'Sin título',
        company: job.company_name || 'Empresa desconocida',
        url: job.url,
        tags: job.tags || [],
        date: job.publication_date || null,
        location: job.candidate_required_location || 'Worldwide',
        source: 'Remotive',
        logo: job.company_logo || job.company_logo_url || '',
        salary: job.salary?.trim() || null,
        description: stripHtml(job.description),
      }),
    )
}

/** Jobicy: empleo remoto de todo el mundo (últimas 100 ofertas). */
export async function fetchJobicy(role = 'frontend') {
  const data = await getJSON('https://jobicy.com/api/v2/remote-jobs?count=100', 'Jobicy')
  if (!Array.isArray(data?.jobs)) throw new Error('Respuesta inesperada de Jobicy')

  return data.jobs
    // En Jobicy las tecnologías suelen venir solo en la descripción, no en el título
    .filter((job) => matchesRole(role, job.jobTitle || '', job.jobExcerpt || '', job.jobDescription || ''))
    .map((job) =>
      withGeo({
        id: `jobicy-${job.id}`,
        title: job.jobTitle || 'Sin título',
        company: job.companyName || 'Empresa desconocida',
        url: job.url,
        tags: [...(job.jobIndustry || []), ...(job.jobType || []), job.jobLevel].filter(Boolean),
        date: job.pubDate || null,
        location: job.jobGeo || 'Anywhere',
        source: 'Jobicy',
        logo: job.companyLogo || '',
        salary: formatSalaryRange(job.salaryMin, job.salaryMax, CURRENCY_SYMBOLS[job.salaryCurrency] || '$'),
        description: stripHtml(job.jobDescription),
      }),
    )
}

/** Arbeitnow: bolsa de empleo europea (sobre todo Alemania). */
export async function fetchArbeitnow(role = 'frontend') {
  const data = await getJSON('https://www.arbeitnow.com/api/job-board-api', 'Arbeitnow')
  if (!Array.isArray(data?.data)) throw new Error('Respuesta inesperada de Arbeitnow')

  return data.data
    .filter((job) => matchesRole(role, job.title || '', (job.tags || []).join(' ')))
    .map((job) => {
      const place = job.location || 'Germany'
      return {
        id: `arbeitnow-${job.slug}`,
        title: job.title || 'Sin título',
        company: job.company_name || 'Empresa desconocida',
        url: job.url,
        tags: job.tags || [],
        date: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
        location: `${place}${job.remote ? ' (remoto)' : ''}`,
        source: 'Arbeitnow',
        logo: '',
        salary: null,
        description: stripHtml(job.description),
        // Las ciudades alemanas pequeñas no están en el diccionario: si no se reconoce, Alemania
        geo: parseLocations([place, parseLocation(place).countries.length ? '' : 'Germany'].filter(Boolean)),
      }
    })
}

// ===== Himalayas (vía proxy) =====
const HIMALAYAS_PAGES = 3 // 20 ofertas por página
const HIMALAYAS_HOME_PAGES = 2 // páginas extra filtradas por el país del CV

/**
 * Himalayas: gran bolsa de empleo remoto; cada oferta indica desde qué países se puede trabajar.
 * Con el país del CV se añade una búsqueda filtrada por ese país (ofertas abiertas a él).
 */
export async function fetchHimalayas(role = 'frontend', homeCountry = null) {
  const q = encodeURIComponent(searchFor(role).himalayas)
  // Himalayas filtra por el nombre del país en inglés (el primer alias del diccionario)
  const homeName = homeCountry ? COUNTRY_BY_CODE.get(homeCountry)?.aliases?.[0] : null
  const urls = [
    ...Array.from({ length: HIMALAYAS_PAGES }, (_, i) => `${PROXY.himalayas}/jobs/api/search?q=${q}&page=${i + 1}`),
    ...(homeName
      ? Array.from(
          { length: HIMALAYAS_HOME_PAGES },
          (_, i) => `${PROXY.himalayas}/jobs/api/search?q=${q}&country=${encodeURIComponent(homeName)}&page=${i + 1}`,
        )
      : []),
  ]
  const pages = await Promise.all(urls.map((url) => getJSON(url, 'Himalayas')))

  return pages
    .flatMap((data) => data?.jobs || [])
    .filter((job) => matchesRole(role, job.title || '', (job.categories || []).join(' '), job.excerpt || ''))
    .map((job) => {
      const countries = job.locationRestrictions || []
      // Muchas ofertas listan decenas de países: lo resumimos para que se lea bien
      const location =
        countries.length === 0
          ? 'Remoto (mundial)'
          : countries.length > 4
            ? `${countries.slice(0, 3).join(', ')} y ${countries.length - 3} países más`
            : countries.join(', ')
      return {
        id: `himalayas-${job.guid}`,
        title: job.title || 'Sin título',
        company: job.companyName || 'Empresa desconocida',
        url: job.applicationLink || job.guid,
        tags: [...(job.seniority || []), job.employmentType, ...(job.categories || []).slice(0, 4)]
          .filter(Boolean)
          .map((t) => t.replace(/-/g, ' ')),
        date: job.pubDate ? new Date(job.pubDate * 1000).toISOString() : null,
        location,
        source: 'Himalayas',
        logo: job.companyLogo || '',
        salary: formatSalaryRange(job.minSalary, job.maxSalary, CURRENCY_SYMBOLS[job.currency] || '$'),
        description: stripHtml(job.description),
        // La ubicación se interpreta con la lista completa de países, no con el resumen
        geo: countries.length ? parseLocations(countries) : parseLocation(''),
      }
    })
}

// ===== Working Nomads (vía proxy) =====

/** Working Nomads: listado de empleo remoto (~30-40 ofertas recientes de todas las categorías). */
export async function fetchWorkingNomads(role = 'frontend') {
  const data = await getJSON(`${PROXY.workingNomads}/api/exposed_jobs/`, 'Working Nomads')
  if (!Array.isArray(data)) throw new Error('Respuesta inesperada de Working Nomads')

  return data
    .filter((job) => job.category_name === 'Development')
    .filter((job) => matchesRole(role, job.title || '', job.tags || '', job.description || ''))
    .map((job) =>
      withGeo({
        id: `workingnomads-${job.url}`,
        title: job.title || 'Sin título',
        company: job.company_name || 'Empresa desconocida',
        url: job.url,
        tags: (job.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        date: job.pub_date || null,
        location: job.location || 'Remoto (mundial)',
        source: 'Working Nomads',
        logo: '',
        salary: null,
        description: stripHtml(job.description),
      }),
    )
}

// ===== We Work Remotely (RSS con CORS) =====

/** Lee el texto de una etiqueta dentro de un <item> del RSS. */
const rssField = (item, tag) => item.getElementsByTagName(tag)[0]?.textContent?.trim() || ''

/** We Work Remotely: feeds RSS por categoría. El título viene como "Empresa: Puesto". */
export async function fetchWeWorkRemotely(role = 'frontend') {
  const xmls = await Promise.all(
    searchFor(role).wwr.map((feed) =>
      getText(`https://weworkremotely.com/categories/${feed}.rss`, 'We Work Remotely'),
    ),
  )

  return xmls
    .flatMap((xml) => [...new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('item')])
    .map((item) => {
      const rawTitle = rssField(item, 'title')
      const sep = rawTitle.indexOf(':')
      return {
        company: sep > 0 ? rawTitle.slice(0, sep).trim() : 'Empresa desconocida',
        title: (sep > 0 ? rawTitle.slice(sep + 1) : rawTitle).trim(),
        item,
      }
    })
    // Solo título + categoría: la descripción de WWR es larga y casi todas mencionan "AI", "cloud"...
    .filter(({ title, item }) => matchesRole(role, title, rssField(item, 'category')))
    .map(({ company, title, item }) => {
      const link = rssField(item, 'link') || rssField(item, 'guid')
      const skills = rssField(item, 'skills')
      return withGeo({
        id: `wwr-${link}`,
        title: title || 'Sin título',
        company,
        url: link,
        tags: [rssField(item, 'category'), rssField(item, 'type'), ...skills.split(',')]
          .map((t) => t.trim())
          .filter(Boolean),
        date: rssField(item, 'pubDate') ? new Date(rssField(item, 'pubDate')).toISOString() : null,
        location: rssField(item, 'region') || rssField(item, 'country') || 'Remoto (mundial)',
        source: 'We Work Remotely',
        logo: '',
        salary: null,
        description: stripHtml(rssField(item, 'description')),
      })
    })
}

// ===== NoFluffJobs (CORS) =====

/** NoFluffJobs: portal IT de Polonia y Europa del Este. Solo ofertas en remoto. */
export async function fetchNoFluffJobs(role = 'frontend') {
  const pages = await Promise.all(
    searchFor(role).nfj.map((category) =>
      getJSON(
        'https://nofluffjobs.com/api/search/posting?page=1&pageSize=50&salaryCurrency=EUR&salaryPeriod=month&region=pl&language=en-GB',
        'NoFluffJobs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawSearch: `remote category=${category}`,
            criteriaSearch: { category: [category], city: ['remote'] },
          }),
        },
      ),
    ),
  )

  return pages
    .flatMap((data) => data?.postings || [])
    .filter((job) => TECH_TITLE.test(job.title || '') && !NON_TECH_TITLE.test(job.title || ''))
    .map((job) => {
      const places = job.location?.places || []
      const countries = [...new Set(places.map((p) => p.country?.name).filter(Boolean))]
      const s = job.salary
      return {
        id: `nofluffjobs-${job.id}`,
        title: job.title || 'Sin título',
        company: job.name || 'Empresa desconocida',
        url: `https://nofluffjobs.com/job/${job.url}`,
        // Las "tiles" son las tecnologías que pide la oferta
        tags: [...(job.tiles?.values || []).map((t) => t.value), ...(job.seniority || [])],
        date: job.posted ? new Date(job.renewed || job.posted).toISOString() : null,
        location: `Remoto${countries.length ? ` (${countries.join(', ')})` : ''}`,
        source: 'NoFluffJobs',
        logo: '',
        salary: s?.from
          ? `${s.from.toLocaleString('es-ES')} - ${s.to.toLocaleString('es-ES')} ${s.currency}/${s.period === 'Month' ? 'mes' : s.period}`
          : null,
        // La API de búsqueda no trae descripción: usamos título + tecnologías
        description: '',
        geo: parseLocations(countries.length ? countries : ['Poland']),
      }
    })
}

// ===== GetOnBoard (CORS) =====

/** GetOnBoard: portal tech de Latinoamérica (Chile, México, Colombia, Perú...) y remoto. */
export async function fetchGetOnBoard(role = 'frontend') {
  const q = encodeURIComponent(searchFor(role).getonboard)
  const data = await getJSON(
    `https://www.getonbrd.com/api/v0/search/jobs?query=${q}&per_page=50&page=1&expand=%5B%22company%22%5D`,
    'GetOnBoard',
  )
  if (!Array.isArray(data?.data)) throw new Error('Respuesta inesperada de GetOnBoard')

  return data.data
    .map((item) => ({ id: item.id, url: item.links?.public_url, ...item.attributes }))
    .filter((job) => TECH_TITLE.test(job.title || '') && !NON_TECH_TITLE.test(job.title || ''))
    .map((job) => {
      const countries = job.countries || []
      const fullyRemote = job.remote_modality === 'fully_remote'
      const where = countries.join(', ') || 'Latinoamérica'
      return {
        id: `getonboard-${job.id}`,
        title: job.title || 'Sin título',
        company: job.company?.data?.attributes?.name || 'Empresa desconocida',
        url: job.url || `https://www.getonbrd.com/jobs/${job.id}`,
        tags: [job.category_name, fullyRemote ? 'Remoto' : null].filter(Boolean),
        date: job.published_at ? new Date(job.published_at * 1000).toISOString() : null,
        location: fullyRemote ? `Remoto (${where})` : where,
        source: 'GetOnBoard',
        logo: job.company?.data?.attributes?.logo || '',
        salary: formatSalaryRange(job.min_salary, job.max_salary, 'US$'),
        description: stripHtml([job.description, job.functions, job.desirable].join(' ')),
        geo: parseLocations(countries.length ? countries : ['LATAM']),
      }
    })
}

// ===== Hacker News "Who is hiring?" (API de Algolia, CORS) =====

/** Convierte el HTML de un comentario de HN en texto con saltos de línea. */
function hnText(html = '') {
  return stripHtml(html.replace(/<p>/g, '\n<p>')).replace(/ ?\n ?/g, '\n')
}

/**
 * Hacker News: hilo mensual "Ask HN: Who is hiring?". Cada comentario principal es una
 * oferta que empieza por una línea tipo "Empresa | Puesto | Ubicación | REMOTE | Salario".
 */
export async function fetchHackerNews(role = 'frontend') {
  const stories = await getJSON(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=3',
    'Hacker News',
  )
  const story = stories?.hits?.find((h) => /who is hiring/i.test(h.title))
  if (!story) throw new Error('No se encontró el hilo "Who is hiring?" de Hacker News')

  const data = await getJSON(
    `https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&hitsPerPage=1000`,
    'Hacker News',
  )

  return (data?.hits || [])
    .filter((c) => String(c.parent_id) === String(story.objectID) && c.comment_text)
    .map((c) => {
      const text = c.comment_text.replace(/<p>/g, '\n<p>')
      const plain = hnText(text)
      const header = plain.split('\n')[0]
      const parts = header.split('|').map((p) => p.trim()).filter(Boolean)
      return { c, plain, header, parts }
    })
    // Solo los que siguen el formato "Empresa | Puesto | ..."
    .filter(({ parts }) => parts.length >= 3)
    .map(({ c, plain, parts }) => {
      const [company, ...rest] = parts
      const title = rest.find((p) => TECH_TITLE.test(p)) || rest[0]
      const salary = rest.find((p) => /[$€£]\s?\d|\d\s?k\b|\d{2,3},\d{3}/i.test(p)) || null
      // Ubicación: el primer segmento que sea un lugar reconocible o diga remoto/onsite
      const location =
        rest.find((p) => p !== title && p !== salary && (parseLocation(p).countries.length || parseLocation(p).continents.length)) ||
        rest.find((p) => /remote|onsite|on-site|hybrid/i.test(p)) ||
        ''
      return { c, plain, company, title, salary, location }
    })
    .filter(({ title, plain }) => title && matchesRole(role, title, plain.slice(0, 600)))
    .map(({ c, plain, company, title, salary, location }) =>
      withGeo({
        id: `hn-${c.objectID}`,
        title: title.slice(0, 120),
        company: company.slice(0, 60),
        url: `https://news.ycombinator.com/item?id=${c.objectID}`,
        tags: /remote/i.test(location) ? ['Remote'] : [],
        date: c.created_at || null,
        location: location || 'Ver oferta',
        source: 'Hacker News',
        logo: '',
        salary: salary ? salary.slice(0, 60) : null,
        description: plain,
      }),
    )
}

// ===== Landing.jobs (CORS) =====

/** Landing.jobs: portal tech europeo (sobre todo Portugal). Devuelve todas sus ofertas (~50-100). */
export async function fetchLandingJobs(role = 'frontend') {
  const pages = await Promise.all(
    [0, 50].map((offset) => getJSON(`https://landing.jobs/api/v1/jobs?limit=50&offset=${offset}`, 'Landing.jobs')),
  )

  return pages
    .flat()
    .filter((job) => matchesRole(role, job.title || '', (job.tags || []).join(' ')))
    .map((job) => {
      // La API no trae el nombre de la empresa; lo sacamos de la URL (/at/<empresa>/...)
      const slug = job.url?.match(/\/at\/([^/]+)\//)?.[1] || ''
      const company = slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Empresa desconocida'
      // Las ubicaciones vienen con código de país (PT): lo convertimos al nombre
      const places = (job.locations || []).map((l) =>
        [l.city, COUNTRY_BY_CODE.get(l.country_code)?.name || l.country_code].filter(Boolean).join(', '),
      )
      return {
        id: `landingjobs-${job.id}`,
        title: job.title || 'Sin título',
        company,
        url: job.url,
        tags: job.tags || [],
        date: job.published_at || null,
        location: `${places.join(' · ') || 'Europa'}${job.remote ? ' (remoto)' : ''}`,
        source: 'Landing.jobs',
        logo: '',
        salary: formatSalaryRange(job.gross_salary_low, job.gross_salary_high, CURRENCY_SYMBOLS[job.currency_code] || '€'),
        description: stripHtml([job.role_description, job.main_requirements, job.nice_to_have].join(' ')),
        geo: parseLocations(places.length ? places : ['Europe']),
      }
    })
}

// ===== Tecnoempleo (RSS vía proxy) =====

/**
 * Tecnoempleo: portal de empleo IT de España. Su RSS trae las ~80 ofertas más recientes.
 * La descripción viene como "Empresa: X · Provincia: Y · Población: Z · Descripción: ...".
 */
export async function fetchTecnoempleo(role = 'frontend') {
  const xml = await getText(`${PROXY.tecnoempleo}/alertas-empleo-rss.php`, 'Tecnoempleo')
  const items = [...new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('item')]

  return items
    .map((item) => {
      const text = stripHtml(rssField(item, 'description'))
      const field = (name, next) =>
        text.match(new RegExp(`${name}:\\s*(.*?)\\s*(?:${next}:|$)`, 'i'))?.[1]?.trim() || ''
      return {
        item,
        title: rssField(item, 'title'),
        company: field('Empresa', 'Provincia'),
        province: field('Provincia', 'Población'),
        town: field('Población', 'Descripción'),
        description: text.split(/Descripción:/i)[1]?.trim() || text,
      }
    })
    .filter(({ title, description }) => matchesRole(role, title, description.slice(0, 600)))
    .map(({ item, title, company, province, town, description }) => {
      // "Provincia" a veces es la modalidad (remoto / híbrido) en lugar de un lugar
      const modality = /remot|teletrabajo/i.test(province) ? 'Remoto' : /h[íi]brido/i.test(province) ? 'Híbrido' : ''
      const place = [town, modality ? '' : province].filter(Boolean).join(', ')
      const location = `${place || modality || 'España'}${place ? ', España' : ' (España)'}${modality && place ? ` · ${modality}` : ''}`
      const link = rssField(item, 'link')
      return {
        id: `tecnoempleo-${link}`,
        title: title || 'Sin título',
        company: company || 'Empresa desconocida',
        url: link,
        tags: [modality].filter(Boolean),
        date: rssField(item, 'pubDate') ? new Date(rssField(item, 'pubDate')).toISOString() : null,
        location,
        source: 'Tecnoempleo',
        logo: '',
        salary: null,
        description,
        geo: parseLocations([place, 'España'].filter(Boolean)),
      }
    })
}

// ===== Manfred (CORS) =====

/** Manfred: ofertas tech seleccionadas en España (Barcelona, Madrid...) con salario y % de remoto. */
export async function fetchManfred(role = 'frontend') {
  const data = await getJSON('https://www.getmanfred.com/api/v2/public/offers?lang=ES&onlyActive=true', 'Manfred')
  if (!Array.isArray(data)) throw new Error('Respuesta inesperada de Manfred')

  return data
    .filter((job) => job.status === 'ACTIVE')
    .filter((job) => matchesRole(role, job.position || ''))
    .map((job) => {
      const places = job.locations || []
      const remote = job.remotePercentage >= 100 ? 'Remoto' : job.remotePercentage > 0 ? `${job.remotePercentage}% remoto` : ''
      return {
        id: `manfred-${job.id}`,
        title: job.position || 'Sin título',
        company: job.company?.name || 'Empresa desconocida',
        url: `https://www.getmanfred.com/ofertas-empleo/${job.id}/${job.slug}`,
        tags: [remote, ...(job.offerLanguages || []).map((l) => `Idioma ${l}`)].filter(Boolean),
        date: job.updatedAt || null,
        location: [places.join(' · ') || 'España', remote].filter(Boolean).join(' · '),
        source: 'Manfred',
        logo: job.company?.logo?.url || '',
        salary: formatSalaryRange(job.salaryFrom, job.salaryTo, job.currency || '€'),
        description: (job.highlights || []).join(' '),
        geo: parseLocations(places.length ? places : ['España']),
      }
    })
}

// ===== Adzuna (vía proxy, con caché) =====
// La cuota gratuita es limitada y cada carga hace una petición por país. Guardamos el
// resultado 30 min en sessionStorage y compartimos la petición en curso (en desarrollo,
// React StrictMode monta los efectos dos veces y lanzaría las peticiones por duplicado).
const ADZUNA_CACHE_TTL = 30 * 60 * 1000
const ADZUNA_BATCH = 2 // países en paralelo por tanda (con 3 ya aparecen errores 429)
const ADZUNA_DELAY_MS = 300 // pausa entre tandas
const adzunaInFlight = new Map()

function readAdzunaCache(key) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(`adzuna:${key}`))
    if (cached && Date.now() - cached.time < ADZUNA_CACHE_TTL) return cached.jobs
  } catch {
    /* sin caché disponible */
  }
  return null
}

function writeAdzunaCache(key, jobs) {
  try {
    sessionStorage.setItem(`adzuna:${key}`, JSON.stringify({ time: Date.now(), jobs }))
  } catch {
    /* sin caché disponible (p. ej. cuota de storage llena) */
  }
}

/** Busca una página (50 ofertas) de un país de Adzuna y normaliza las ofertas. */
async function fetchAdzunaCountry(country, role, page = 1) {
  // Sin app_id ni app_key: los añade el proxy
  const params = new URLSearchParams({
    what_or: searchFor(role).adzuna,
    category: 'it-jobs',
    results_per_page: '50',
    max_days_old: '30',
    sort_by: 'date',
  })
  const countryName = COUNTRY_BY_CODE.get(country.toUpperCase())?.name || country.toUpperCase()
  const data = await getJSON(`${PROXY.adzuna}/jobs/${country}/search/${page}?${params}`, `Adzuna (${countryName})`)
  if (!Array.isArray(data?.results)) throw new Error(`Respuesta inesperada de Adzuna (${countryName})`)

  return data.results
    .map((job) => ({ ...job, title: stripHtml(job.title) }))
    .filter((job) => matchesRole(role, job.title, stripHtml(job.description)))
    .map((job) => {
      const place = job.location?.display_name || ''
      return {
        id: `adzuna-${job.id}`,
        title: job.title || 'Sin título',
        company: job.company?.display_name || 'Empresa desconocida',
        url: job.redirect_url,
        tags: [job.category?.label, job.contract_time, job.contract_type].filter(Boolean),
        date: job.created || null,
        location: place.toLowerCase().includes(countryName.toLowerCase()) ? place : `${place}, ${countryName}`.replace(/^, /, ''),
        source: 'Adzuna',
        logo: '',
        salary: formatSalaryRange(job.salary_min, job.salary_max, ADZUNA_CURRENCY[country]),
        // Ojo: Adzuna solo devuelve un extracto de la descripción (~500 caracteres)
        description: stripHtml(job.description),
        // El país es seguro (la búsqueda es por país); la ciudad puede no estar en el diccionario
        geo: parseLocations([place, countryName]),
      }
    })
}

/**
 * Adzuna: agregador con ofertas de portales de todo el mundo.
 * Las claves las añade el proxy; si faltan, Adzuna responde 401 y se muestra un aviso.
 * El país del CV (si Adzuna lo cubre) se busca primero y con más páginas.
 * @param {string} role
 * @param {{ force?: boolean, homeCountry?: string|null }} options
 *   force = ignorar la caché (botón "Actualizar"); homeCountry = país del CV (ES, US...)
 */
export async function fetchAdzuna(role = 'frontend', { force = false, homeCountry = null } = {}) {
  if (!ADZUNA_ENABLED) return []

  const home = homeCountry?.toLowerCase()
  const hasHome = Boolean(home && ADZUNA_CURRENCY[home])
  const cacheKey = `${role}:${hasHome ? home : 'none'}`

  if (!force) {
    const cached = readAdzunaCache(cacheKey)
    if (cached) return cached
    if (adzunaInFlight.has(cacheKey)) return adzunaInFlight.get(cacheKey)
  }

  // Peticiones: primero las páginas del país del CV, luego una página de cada otro país
  const requests = [
    ...(hasHome ? Array.from({ length: ADZUNA_PAGES_HOME }, (_, i) => ({ country: home, page: i + 1 })) : []),
    ...ADZUNA_COUNTRIES.filter((c) => c !== home).flatMap((country) =>
      Array.from({ length: ADZUNA_PAGES_OTHER }, (_, i) => ({ country, page: i + 1 })),
    ),
  ]

  const request = (async () => {
    // En tandas pequeñas con una pausa entre tandas: si se lanzan todas a la vez,
    // la cuenta gratuita de Adzuna responde HTTP 429 (demasiadas peticiones)
    const jobs = []
    const failed = []
    for (let i = 0; i < requests.length; i += ADZUNA_BATCH) {
      const batch = await Promise.allSettled(
        requests.slice(i, i + ADZUNA_BATCH).map(({ country, page }) => fetchAdzunaCountry(country, role, page)),
      )
      for (const r of batch) {
        if (r.status === 'fulfilled') jobs.push(...r.value)
        else failed.push(r.reason.message)
      }
      await new Promise((resolve) => setTimeout(resolve, ADZUNA_DELAY_MS))
    }

    if (failed.length === requests.length) throw new Error(failed[0])
    // Solo cacheamos resultados completos, para reintentar lo que falló en la próxima carga
    if (failed.length === 0) writeAdzunaCache(cacheKey, jobs)
    else console.warn('[Adzuna]', failed.join(' · '))
    return jobs
  })()

  adzunaInFlight.set(cacheKey, request)
  try {
    return await request
  } finally {
    adzunaInFlight.delete(cacheKey)
  }
}

/**
 * Combina todas las fuentes y elimina duplicados por título + empresa (ver dedupeKey).
 * Si una fuente falla se siguen mostrando las de las demás (su error se devuelve en
 * `warnings`); solo se lanza error si fallan todas.
 * Carga progresiva: cada vez que responde una fuente se llama a onProgress con lo
 * acumulado hasta ese momento, para ir mostrando resultados sin esperar a las lentas.
 * @param {string} role perfil detectado en el CV (clave de ROLE_LABELS)
 * @param {{ force?: boolean, homeCountry?: string|null, onProgress?: (p: { jobs: object[], done: number, total: number }) => void }} options
 *   force = ignorar cachés (botón "Actualizar"); homeCountry = país del CV, para traer más ofertas de él
 * @returns {Promise<{ jobs: object[], warnings: string[] }>}
 */
export async function fetchAllJobs(role = 'frontend', { force = false, homeCountry = null, onProgress } = {}) {
  const tasks = [
    fetchHimalayas(role, homeCountry),
    fetchHackerNews(role),
    fetchRemoteOK(role),
    fetchRemotive(role),
    fetchWeWorkRemotely(role),
    fetchWorkingNomads(role),
    fetchJobicy(role),
    fetchNoFluffJobs(role),
    fetchGetOnBoard(role),
    fetchLandingJobs(role),
    fetchArbeitnow(role),
    fetchTecnoempleo(role),
    fetchManfred(role),
    fetchAdzuna(role, { force, homeCountry }),
  ]

  // Acumulado sin duplicados, en orden de llegada
  const seen = new Set()
  const collected = []
  const addJobs = (list) => {
    for (const job of list) {
      const key = dedupeKey(job)
      if (seen.has(key)) continue
      seen.add(key)
      collected.push(job)
    }
  }

  let done = 0
  const report = () => onProgress?.({ jobs: [...collected], done, total: tasks.length })
  const results = await Promise.allSettled(
    tasks.map((task) =>
      task.then(
        (list) => {
          done++
          addJobs(list)
          report()
          return list
        },
        (err) => {
          done++
          report()
          throw err
        },
      ),
    ),
  )

  const warnings = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message)
  if (warnings.length === results.length) throw new Error(warnings.join(' · '))
  if (warnings.length) console.warn('[jobService]', warnings.join(' · '))

  return { jobs: collected, warnings }
}
