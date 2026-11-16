import { useRef, useState } from 'react'
import { COUNTRY_PATHS, MAP_HEIGHT, MAP_WIDTH } from '../data/worldMap'
import { ROLE_LABELS, SKILLS } from '../services/cvService'
import { CONTINENT_LABELS, project } from '../services/geoService'
import {
  AlertIcon,
  CheckIcon,
  ExternalIcon,
  FileIcon,
  GlobeIcon,
  LockIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SlidersIcon,
  UploadIcon,
} from './Icons'

// Ciudades de la ilustración del mapa (decorativas: no son datos de ofertas)
const PREVIEW_CITIES = [
  [40.4, -3.7, 9], // Madrid
  [41.4, 2.2, 8], // Barcelona
  [51.5, -0.1, 10], // Londres
  [52.5, 13.4, 9], // Berlín
  [37.8, -122.4, 12], // San Francisco
  [40.7, -74, 11], // Nueva York
  [43.7, -79.4, 7], // Toronto
  [-23.5, -46.6, 8], // São Paulo
  [19.4, -99.1, 6], // Ciudad de México
  [12.97, 77.6, 9], // Bangalore
  [1.35, 103.8, 6], // Singapur
  [-33.9, 151.2, 7], // Sídney
  [52.2, 21, 7], // Varsovia
  [38.7, -9.1, 6], // Lisboa
]

const STEPS = [
  { icon: UploadIcon, title: 'Sube tu CV', text: 'En PDF con texto, en castellano o en inglés. Se lee en tu navegador.' },
  { icon: SearchIcon, title: 'Detectamos tu perfil', text: 'Tu puesto, tus skills técnicas y tu país, en segundos.' },
  { icon: GlobeIcon, title: 'Ranking mundial', text: 'Ofertas de todos los portales ordenadas por match, con mapa y filtros.' },
]

const FEATURES = [
  { icon: CheckIcon, title: 'Match explicado', text: 'Cada oferta muestra qué skills tienes y cuáles te faltan, no solo un número.' },
  { icon: GlobeIcon, title: 'Mapa mundial', text: 'Mira dónde están las ofertas de tu perfil y pasa el ratón por cada país.' },
  { icon: PinIcon, title: 'Tu país primero', text: 'Detecta tu ubicación en el CV y trae más ofertas de tu país y tu ciudad.' },
  { icon: SlidersIcon, title: 'Filtros útiles', text: 'Continente, país, remoto sin restricción, fuente y match mínimo.' },
  { icon: LockIcon, title: 'Privado por diseño', text: 'Tu CV no se sube a ningún servidor: el PDF se procesa en tu navegador.' },
  { icon: ExternalIcon, title: 'Portales sin API', text: 'LinkedIn, Indeed, InfoJobs… se abren con tu búsqueda ya escrita.' },
]

const FAQ = [
  {
    q: '¿Se guarda o se envía mi CV?',
    a: 'No. El PDF se lee en tu navegador. Solo se recuerdan, en este dispositivo, las skills detectadas, tu perfil y el nombre del archivo, para no tener que volver a subirlo.',
  },
  {
    q: '¿De dónde salen las ofertas?',
    a: 'De portales con datos públicos (Adzuna, Himalayas, Hacker News, RemoteOK, We Work Remotely, Tecnoempleo, Manfred…), consultados en el momento. Para LinkedIn, Indeed o InfoJobs, que no los ofrecen, te damos enlaces con la búsqueda hecha.',
  },
  {
    q: '¿Cómo se calcula el % de match?',
    a: 'Es la media entre cuántas de tus skills pide la oferta y cuántas de las que pide tienes tú. Así no penaliza tener un CV con muchas skills ni infla ofertas que apenas piden nada.',
  },
]

/**
 * Portada (sin CV): presentación de la app y zona para subir el CV.
 * @param {string[]} sourceNames fuentes de ofertas (para mostrarlas y contarlas)
 */
export default function Home({ loading, error, sourceNames, onUpload }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const openPicker = () => inputRef.current?.click()
  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = '' // permite volver a elegir el mismo archivo
  }
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onUpload(file)
  }

  // Cifras reales de la app (no son estadísticas inventadas)
  const stats = [
    { value: sourceNames.length, label: 'portales de empleo' },
    { value: Object.keys(ROLE_LABELS).length, label: 'perfiles tech' },
    { value: `+${Math.floor(SKILLS.length / 10) * 10}`, label: 'skills reconocidas' },
    { value: Object.keys(CONTINENT_LABELS).length, label: 'continentes' },
  ]

  return (
    <div className="home">
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="hero__copy">
          <ul className="hero__badges" aria-label="Características">
            <li>Gratis</li>
            <li>Sin registro</li>
            <li>
              <LockIcon size={12} /> Tu CV no sale de tu navegador
            </li>
          </ul>
          <h1 className="hero__title">
            Las ofertas tech que <span className="hero__accent">encajan con tu CV</span>, en todo el mundo
          </h1>
          <p className="hero__lead">
            Sube tu CV y en segundos verás un ranking de ofertas de desarrollo, IA, datos, cloud o
            ciberseguridad, con el % de match y lo que te falta para cada una.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleChange}
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div
            className={`dropzone hero__dropzone ${dragging ? 'dropzone--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="dropzone__icon">
              <FileIcon size={24} />
            </div>
            <div className="dropzone__text">
              <p className="dropzone__title">{loading ? 'Leyendo tu CV…' : 'Arrastra tu CV aquí'}</p>
              <p className="small muted">PDF con texto · castellano o inglés</p>
            </div>
            <button className="btn btn--primary btn--large" onClick={openPicker} disabled={loading}>
              <UploadIcon size={18} />
              {loading ? 'Procesando…' : 'Seleccionar CV'}
            </button>
          </div>

          {error && (
            <p className="alert alert--error" role="alert">
              <AlertIcon size={16} /> {error}
            </p>
          )}
        </div>

        {/* Vista previa del producto: mapa ilustrativo + tarjeta de ejemplo */}
        <div className="hero__preview" aria-hidden="true">
          <div className="preview-map">
            <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="preview-map__svg">
              {COUNTRY_PATHS.map((p) => (
                <path key={p.code} d={p.d} className="preview-map__land" />
              ))}
              {PREVIEW_CITIES.map(([lat, lng, r]) => {
                const [x, y] = project(lat, lng)
                return (
                  <g key={`${lat},${lng}`}>
                    <circle cx={x} cy={y} r={r * 1.9} className="preview-map__halo" />
                    <circle cx={x} cy={y} r={r} className="preview-map__bubble" />
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="preview-card">
            <span className="preview-card__tag">Ejemplo</span>
            <div className="preview-card__header">
              <div className="preview-card__logo">A</div>
              <div className="preview-card__heading">
                <strong>Senior Frontend Engineer</strong>
                <span>Empresa de ejemplo · Barcelona</span>
              </div>
              <div className="match-ring" style={{ '--ring-color': 'var(--green)', '--ring-value': '82%' }}>
                <div className="match-ring__inner">
                  <span className="match-ring__value">82%</span>
                  <span className="match-ring__label">match</span>
                </div>
              </div>
            </div>
            <div className="chips">
              {['react', 'typescript', 'next.js', 'jest'].map((s) => (
                <span key={s} className="chip chip--match">
                  <CheckIcon size={11} /> {s}
                </span>
              ))}
              <span className="chip chip--missing">
                <PlusIcon size={11} /> graphql
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Cifras ===== */}
      <section className="stats" aria-label="La app en cifras">
        {stats.map((s) => (
          <div key={s.label} className="stats__item">
            <span className="stats__value">{s.value}</span>
            <span className="stats__label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ===== Cómo funciona ===== */}
      <section className="home-section">
        <h2 className="home-section__title">Cómo funciona</h2>
        <ol className="steps">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="steps__item">
              <div className="steps__top">
                <span className="steps__icon">
                  <Icon size={18} />
                </span>
                <span className="steps__number">0{i + 1}</span>
              </div>
              <span className="steps__title">{title}</span>
              <span className="muted small">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== Qué te da ===== */}
      <section className="home-section">
        <h2 className="home-section__title">Qué te da</h2>
        <div className="features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="feature">
              <span className="feature__icon">
                <Icon size={18} />
              </span>
              <h3 className="feature__title">{title}</h3>
              <p className="small muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Perfiles y fuentes ===== */}
      <section className="home-section home-columns">
        <div>
          <h2 className="home-section__title">Perfiles que reconoce</h2>
          <div className="chips chips--large">
            {Object.values(ROLE_LABELS).map((label) => (
              <span key={label} className="chip chip--accent">
                {label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h2 className="home-section__title">De dónde salen las ofertas</h2>
          <div className="chips chips--large">
            {sourceNames.map((name) => (
              <span key={name} className="chip">
                {name}
              </span>
            ))}
            <span className="chip chip--missing">+ LinkedIn, Indeed, InfoJobs… (enlaces)</span>
          </div>
        </div>
      </section>

      {/* ===== Preguntas frecuentes ===== */}
      <section className="home-section">
        <h2 className="home-section__title">Preguntas frecuentes</h2>
        <div className="faq">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="faq__item">
              <summary>{q}</summary>
              <p className="small muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="home-footer small muted">
        CV Job Matcher · Hecho con React. Las ofertas pertenecen a sus portales de origen.
      </footer>
    </div>
  )
}
