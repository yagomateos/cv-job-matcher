import { COUNTRY_BY_CODE } from '../services/geoService'
import { ExternalIcon } from './Icons'

/**
 * Enlaces de búsqueda a portales sin API pública (LinkedIn, Indeed, Glassdoor...).
 * Estas webs no permiten leer sus ofertas desde otra aplicación (ni API pública ni CORS,
 * y sus condiciones prohíben el scraping), así que abrimos su buscador con una
 * consulta construida a partir del perfil del CV.
 */

/**
 * Por perfil: término de búsqueda, tecnologías prioritarias (la primera que tenga el CV
 * se añade a la búsqueda) y página de puesto en Wellfound (null = no aplica).
 */
const ROLE_QUERY = {
  frontend: { term: 'frontend developer', tech: ['react', 'vue', 'angular', 'next.js', 'typescript'], wellfound: 'frontend-engineer' },
  backend: { term: 'backend developer', tech: ['python', 'java', 'node.js', 'golang', 'c#', 'php'], wellfound: 'backend-engineer' },
  fullstack: { term: 'full stack developer', tech: ['react', 'node.js', 'python', 'typescript'], wellfound: 'full-stack-engineer' },
  mobile: { term: 'mobile developer', tech: ['flutter', 'react native', 'swift', 'kotlin', 'android', 'ios'], wellfound: 'mobile-engineer' },
  ai: { term: 'machine learning engineer', tech: ['llm', 'pytorch', 'python', 'nlp'], wellfound: 'machine-learning-engineer' },
  data: { term: 'data engineer', tech: ['spark', 'python', 'sql', 'airflow'], wellfound: 'data-engineer' },
  devops: { term: 'devops engineer', tech: ['kubernetes', 'aws', 'azure', 'terraform'], wellfound: 'devops-engineer' },
  qa: { term: 'qa engineer', tech: ['playwright', 'selenium', 'cypress'], wellfound: 'qa-engineer' },
  security: { term: 'cybersecurity engineer', tech: ['pentesting', 'siem'], wellfound: 'security-engineer' },
  it: { term: 'it support', tech: ['windows server', 'linux', 'networking'], wellfound: null },
}

const enc = encodeURIComponent
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Subdominio de Indeed por país (el resto usa indeed.com)
const INDEED_DOMAIN = {
  ES: 'es', GB: 'uk', DE: 'de', FR: 'fr', IT: 'it', NL: 'nl', PT: 'pt', IE: 'ie', PL: 'pl', MX: 'mx',
  AR: 'ar', CO: 'co', CL: 'cl', BR: 'br', IN: 'in', CA: 'ca', AU: 'au',
}

/**
 * Portales: nombre, ámbito y cómo construir la URL. Devuelve null si no aplica al perfil.
 * Recibe: q (búsqueda completa), term (solo el puesto), cfg (configuración del perfil)
 * y loc ({ city, country, countryEn, label }: ubicación del candidato si se conoce).
 */
const PORTALS = [
  {
    name: 'LinkedIn',
    scope: (loc) => loc.label || 'Mundial',
    url: (q, _t, _c, loc) =>
      `https://www.linkedin.com/jobs/search/?keywords=${enc(q)}${loc.countryEn ? `&location=${enc([loc.city, loc.countryEn].filter(Boolean).join(', '))}` : ''}`,
  },
  {
    name: 'Indeed',
    scope: (loc) => loc.label || 'Mundial',
    url: (q, _t, _c, loc) => {
      const sub = INDEED_DOMAIN[loc.country] || 'www'
      return `https://${sub}.indeed.com/jobs?q=${enc(q)}${loc.city ? `&l=${enc(loc.city)}` : ''}`
    },
  },
  { name: 'Glassdoor', scope: 'Mundial', url: (q) => `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${enc(q)}` },
  { name: 'Wellfound', scope: 'Startups', url: (_q, _t, cfg) => (cfg.wellfound ? `https://wellfound.com/role/${cfg.wellfound}` : null) },
  { name: 'Built In', scope: 'EE. UU.', url: (q) => `https://www.builtin.com/jobs?search=${enc(q)}` },
  { name: 'Dice', scope: 'EE. UU.', url: (q) => `https://www.dice.com/jobs?q=${enc(q)}` },
  { name: 'Computrabajo', scope: 'Latinoamérica', url: (_q, term) => `https://mx.computrabajo.com/trabajo-de-${slug(term)}` },
  { name: 'InfoJobs', scope: 'España', url: (q) => `https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=${enc(q)}` },
  { name: 'StepStone', scope: 'Alemania', url: (_q, term) => `https://www.stepstone.de/jobs/${slug(term)}` },
  { name: 'Technojobs', scope: 'Reino Unido', url: (q) => `https://www.technojobs.co.uk/jobs?q=${enc(q)}` },
  { name: 'Welcome to the Jungle', scope: 'Europa', url: (q) => `https://www.welcometothejungle.com/es/jobs?query=${enc(q)}` },
  { name: 'Naukri', scope: 'India', url: (_q, term) => `https://www.naukri.com/${slug(term)}-jobs` },
  { name: 'Seek', scope: 'Australia', url: (_q, term) => `https://www.seek.com.au/${slug(term)}-jobs` },
]

export default function ExternalSearch({ role, cvSkills, homeCountry = null, homeCity = null }) {
  const cfg = ROLE_QUERY[role] || ROLE_QUERY.frontend
  const tech = cfg.tech.find((s) => cvSkills.includes(s)) || ''
  const query = `${cfg.term} ${tech}`.trim()

  // Ubicación del candidato (del CV): LinkedIn e Indeed buscan directamente en ella
  const country = homeCountry ? COUNTRY_BY_CODE.get(homeCountry) : null
  const loc = {
    city: homeCity,
    country: homeCountry,
    // LinkedIn entiende los nombres en inglés ("Barcelona, Spain"): primer alias del diccionario
    countryEn: country?.aliases?.[0] || null,
    label: homeCity || country?.name || null,
  }

  return (
    <section className="portals">
      <div>
        <h2 className="portals__title">Busca también en portales sin API</h2>
        <p className="small muted">
          Se abren con la búsqueda «{query}» ya escrita{loc.label ? ` (LinkedIn e Indeed, en ${loc.label})` : ''}.
        </p>
      </div>
      <div className="portals__links">
        {PORTALS.map((p) => {
          const href = p.url(query, cfg.term, cfg, loc)
          if (!href) return null
          const scope = typeof p.scope === 'function' ? p.scope(loc) : p.scope
          return (
            <a key={p.name} className="portal-link" href={href} target="_blank" rel="noopener noreferrer">
              {p.name} <span className="small muted">{scope}</span>
              <ExternalIcon size={12} />
            </a>
          )
        })}
      </div>
    </section>
  )
}
