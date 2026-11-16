import { useEffect, useMemo, useRef, useState } from 'react'
import CVUploader from './components/CVUploader'
import ExternalSearch from './components/ExternalSearch'
import Filters from './components/Filters'
import Home from './components/Home'
import { AlertIcon, BriefcaseIcon, MoonIcon, RefreshIcon, SlidersIcon, SunIcon } from './components/Icons'
import JobCard from './components/JobCard'
import JobMap from './components/JobMap'
import Pagination from './components/Pagination'
import SearchBar from './components/SearchBar'
import ThresholdSlider from './components/ThresholdSlider'
import { useCV } from './hooks/useCV'
import { useJobs } from './hooks/useJobs'
import { useTheme } from './hooks/useTheme'
import { ROLE_LABELS } from './services/cvService'
import { CONTINENT_LABELS, COUNTRY_BY_CODE, isLocalJob } from './services/geoService'
import { SOURCE_NAMES } from './services/jobService'
import './App.css'

// Ofertas por página (múltiplo de 2 y 3 para que las filas del grid queden completas)
const PAGE_SIZE = 12

/** "hace un momento" / "hace 5 min" / "hace 2 h" */
function timeAgo(timestamp, now) {
  const minutes = Math.floor((now - timestamp) / 60000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  return `hace ${Math.floor(minutes / 60)} h`
}

/**
 * ¿La oferta cumple el filtro de ubicación?
 * - country: código de país, 'worldwide' (solo remoto sin país) o 'all'
 * - continent: clave de CONTINENT_LABELS o 'all'
 * - includeWorldwide: incluir las ofertas en remoto sin restricción de país
 *   (solo en las vistas de mundo y continente)
 *
 * Con un país elegido salen SOLO sus ofertas concretas (isLocalJob): ni las abiertas a
 * toda una región ("52 países de Europa") ni el remoto sin país. Así el número de la
 * burbuja del mapa, la franja, el selector de países y la lista son siempre el mismo.
 */
function matchesGeo(job, { continent, country, includeWorldwide }) {
  const { geo } = job
  if (country === 'worldwide') return geo.worldwide
  if (country !== 'all') return isLocalJob(job) && geo.countries.includes(country)
  if (geo.worldwide) return includeWorldwide
  if (continent !== 'all') return geo.continents.includes(continent)
  return true
}

export default function App() {
  const cv = useCV()
  const { theme, toggleTheme } = useTheme()
  const {
    jobs,
    totalJobs,
    loading,
    loadingMore,
    progress,
    error,
    warnings,
    updatedAt,
    minScore,
    setMinScore,
    reload,
  } = useJobs(cv.cvSkills, cv.role, cv.homeCountry)
  const busy = loading || loadingMore
  const [search, setSearch] = useState('')
  // Ubicación: por defecto todo el mundo
  const [continent, setContinent] = useState('all')
  const [country, setCountry] = useState('all')
  const [includeWorldwide, setIncludeWorldwide] = useState(true)
  const [disabledSources, setDisabledSources] = useState(() => new Set())
  const [sortBy, setSortBy] = useState('match')
  // En móvil el panel de filtros está plegado
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Reloj para refrescar el texto "Actualizado hace X min"
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const hasCV = cv.cvSkills.length > 0

  // 1) Búsqueda por texto (título, empresa, etiquetas y ubicación: "Barcelona" funciona)
  const textJobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) =>
      [job.title, job.company, job.location, ...job.tags].some((f) => f?.toLowerCase().includes(q)),
    )
  }, [jobs, search])

  // 2) Lo que ve el mapa: texto + fuentes activas, SIN filtro de ubicación (para ver todos los países)
  const mapJobs = useMemo(
    () => textJobs.filter((job) => !disabledSources.has(job.source)),
    [textJobs, disabledSources],
  )

  // 3) Texto + ubicación. Los contadores por fuente se calculan aquí (antes de filtrar fuentes)
  const geoJobs = useMemo(
    () => textJobs.filter((job) => matchesGeo(job, { continent, country, includeWorldwide })),
    [textJobs, continent, country, includeWorldwide],
  )

  const sources = useMemo(() => {
    const counts = {}
    for (const job of geoJobs) counts[job.source] = (counts[job.source] || 0) + 1
    return SOURCE_NAMES.map((name) => ({ name, count: counts[name] || 0, enabled: !disabledSources.has(name) })).sort(
      (a, b) => b.count - a.count,
    )
  }, [geoJobs, disabledSources])

  // 4) Resultado final: + fuentes activas + orden
  const visibleJobs = useMemo(() => {
    const list = geoJobs.filter((job) => !disabledSources.has(job.source))
    if (sortBy === 'recent') return [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    return list // ya viene ordenada por match desde useJobs
  }, [geoJobs, disabledSources, sortBy])

  // ===== Paginación =====
  // La página se guarda junto a la "firma" de los filtros: si cambia cualquier filtro,
  // la búsqueda, el orden o el perfil, se vuelve automáticamente a la página 1.
  const filterKey = JSON.stringify([
    search,
    continent,
    country,
    includeWorldwide,
    [...disabledSources],
    sortBy,
    minScore,
    cv.role,
  ])
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / PAGE_SIZE))
  const page = pageState.key === filterKey ? Math.min(pageState.page, totalPages) : 1
  const pageJobs = visibleJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const resultsTopRef = useRef(null)

  const goToPage = (p) => {
    setPageState({ key: filterKey, page: p })
    // Subimos al principio de los resultados para empezar a leer la página nueva
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Países disponibles en el selector (con nº de ofertas), limitados al continente elegido
  const { countryOptions, worldwideCount } = useMemo(() => {
    const counts = new Map()
    let worldwide = 0
    for (const job of mapJobs) {
      if (job.geo.worldwide) worldwide++
      // Mismo criterio que el filtro y el mapa: solo ofertas concretas del país
      if (isLocalJob(job)) for (const code of job.geo.countries) counts.set(code, (counts.get(code) || 0) + 1)
    }
    const options = [...counts.entries()]
      .map(([code, count]) => ({ code, count, ...COUNTRY_BY_CODE.get(code) }))
      .filter((c) => c.name && (continent === 'all' || c.continent === continent))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    return { countryOptions: options, worldwideCount: worldwide }
  }, [mapJobs, continent])

  // Resumen: nº de países distintos y de ofertas en remoto sin país
  // (como en el mapa: no cuentan las ofertas abiertas a muchísimos países, p. ej. "toda Europa")
  const countriesInResults = new Set(
    visibleJobs.filter(isLocalJob).flatMap((j) => j.geo.countries),
  ).size
  const worldwideInResults = visibleJobs.filter((j) => j.geo.worldwide).length

  // Al cambiar de continente, se quita el país si no pertenece a él
  const changeContinent = (value) => {
    setContinent(value)
    if (country !== 'all' && country !== 'worldwide' && value !== 'all' && COUNTRY_BY_CODE.get(country)?.continent !== value) {
      setCountry('all')
    }
  }

  // Al elegir un país (selector o mapa), el continente se ajusta para que sean coherentes
  const selectCountry = (code) => {
    setCountry(code)
    if (code !== 'all' && code !== 'worldwide' && continent !== 'all' && COUNTRY_BY_CODE.get(code)?.continent !== continent) {
      setContinent('all')
    }
  }

  const geoLabel =
    country === 'worldwide'
      ? 'Remoto sin país'
      : country !== 'all'
        ? COUNTRY_BY_CODE.get(country)?.name
        : continent !== 'all'
          ? CONTINENT_LABELS[continent]
          : 'Todo el mundo'

  // Nº de filtros activos (se muestra en el botón "Filtros · N" de móvil)
  const activeFilters =
    (minScore > 0 ? 1 : 0) +
    (continent !== 'all' || country !== 'all' ? 1 : 0) +
    (!includeWorldwide ? 1 : 0) +
    (disabledSources.size > 0 ? 1 : 0)
  const toggleFilters = () => setFiltersOpen((open) => !open)

  const toggleSource = (name) =>
    setDisabledSources((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar__inner">
          <div className="brand">
            <div className="brand__logo">
              <BriefcaseIcon size={20} />
            </div>
            <div>
              <div className="brand__name">CV Job Matcher</div>
              <div className="brand__tagline">Ofertas tech que encajan con tu CV</div>
            </div>
          </div>
          <div className="topbar__actions">
            {hasCV && updatedAt && !busy && (
              <span className="small muted topbar__updated">Actualizado {timeAgo(updatedAt, now)}</span>
            )}
            {/* Cambiar entre modo oscuro y claro: el icono muestra el modo al que se cambia */}
            <button
              className="btn btn--icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            {hasCV && (
              // En móvil solo se ve el icono (44×44)
              <button className="btn topbar__refresh" onClick={reload} disabled={busy} aria-label="Actualizar ofertas">
                <RefreshIcon size={16} className={busy ? 'spin' : ''} />
                <span className="hide-mobile">Actualizar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {!hasCV ? (
        <main className="container">
          <Home loading={cv.loading} error={cv.error} sourceNames={SOURCE_NAMES} onUpload={cv.uploadCV} />
        </main>
      ) : (
        <div className="container layout">
          <aside className="sidebar">
            <CVUploader
              fileName={cv.fileName}
              cvSkills={cv.cvSkills}
              role={cv.role}
              language={cv.language}
              loading={cv.loading}
              error={cv.error}
              onUpload={cv.uploadCV}
              onRoleChange={cv.setRole}
              onReset={cv.reset}
            />

            {/* Fila de botones solo visible en móvil: despliegan el panel de filtros */}
            <div className="filter-pills">
              <button
                className="filter-pill filter-pill--primary"
                aria-expanded={filtersOpen}
                aria-controls="filters-panel"
                onClick={toggleFilters}
              >
                <SlidersIcon size={14} />
                Filtros{activeFilters > 0 && ` · ${activeFilters}`}
              </button>
              <button className="filter-pill" onClick={toggleFilters} aria-controls="filters-panel">
                Match ≥ {minScore}%
              </button>
              <button className="filter-pill" onClick={toggleFilters} aria-controls="filters-panel">
                {geoLabel}
              </button>
            </div>

            <section id="filters-panel" className={`panel filters-panel ${filtersOpen ? 'is-open' : ''}`}>
              <h2 className="eyebrow">Filtros</h2>
              {/* Perfil: en escritorio está en la tarjeta del CV; en móvil, aquí */}
              <div className="field only-mobile-block">
                <label htmlFor="role-mobile" className="field__label">
                  Perfil
                </label>
                <select
                  id="role-mobile"
                  className="input select"
                  value={cv.role}
                  onChange={(e) => cv.setRole(e.target.value)}
                  disabled={cv.loading}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {/* Orden: en escritorio está junto a la búsqueda; en móvil, aquí */}
              <div className="field only-mobile-block">
                <label htmlFor="sort-mobile" className="field__label">
                  Ordenar por
                </label>
                <select
                  id="sort-mobile"
                  className="input select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="match">Mejor match</option>
                  <option value="recent">Más recientes</option>
                </select>
              </div>
              <ThresholdSlider value={minScore} onChange={setMinScore} />
              <Filters
                continent={continent}
                onContinentChange={changeContinent}
                country={country}
                onCountryChange={selectCountry}
                countryOptions={countryOptions}
                includeWorldwide={includeWorldwide}
                onIncludeWorldwideChange={setIncludeWorldwide}
                worldwideCount={worldwideCount}
                sources={sources}
                onToggleSource={toggleSource}
              />
            </section>
          </aside>

          <main className="results">
            <SearchBar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} />

            {error && (
              <p className="alert alert--error" role="alert">
                <AlertIcon size={16} /> {error}
              </p>
            )}
            {!busy && warnings.length > 0 && (
              <p className="alert alert--warning">
                <AlertIcon size={16} /> Algunas fuentes no respondieron: {warnings.join(' · ')}
              </p>
            )}

            {loading ? (
              <div className="status">
                <span className="spinner" aria-hidden="true" />
                <p>
                  Buscando ofertas de {ROLE_LABELS[cv.role]} en {SOURCE_NAMES.length} portales…
                </p>
              </div>
            ) : (
              !error && (
                <>
                  <JobMap
                    jobs={mapJobs}
                    selectedCountry={country}
                    onSelectCountry={selectCountry}
                    continent={continent}
                    homeCountry={cv.homeCountry}
                    onSelectContinent={(value) => {
                      // Desde el mapa, elegir continente quita el país (el zoom va al continente)
                      setContinent(value)
                      setCountry('all')
                    }}
                  />

                  <div className="results__summary" ref={resultsTopRef}>
                    <h1 className="results__title">
                      {visibleJobs.length} {visibleJobs.length === 1 ? 'oferta encaja' : 'ofertas encajan'} contigo
                    </h1>
                    <span className="small muted">
                      {/* Con un país elegido: desglose "en el país + remoto sin país" (ambos suman el total) */}
                      {country !== 'all' && country !== 'worldwide' ? (
                        <>
                          {geoLabel} · {visibleJobs.length - worldwideInResults} en el país
                          {worldwideInResults > 0 && ` · ${worldwideInResults} en remoto sin país`}
                        </>
                      ) : (
                        <>
                          {geoLabel} · {countriesInResults} {countriesInResults === 1 ? 'país' : 'países'}
                          <span className="hide-mobile"> · {worldwideInResults} en remoto sin país</span>
                        </>
                      )}
                      <span className="hide-mobile"> · de {totalJobs} analizadas</span>
                      <span className="only-mobile"> · por {sortBy === 'recent' ? 'fecha' : 'match'}</span>
                    </span>
                  </div>

                  {/* Carga progresiva: ya hay resultados pero faltan fuentes por responder */}
                  {loadingMore && progress?.total > 0 && (
                    <div className="progress-line" role="status">
                      <div className="progress progress--thin" aria-hidden="true">
                        <div
                          className="progress__bar"
                          style={{ width: `${(progress.done / progress.total) * 100}%`, background: 'var(--accent)' }}
                        />
                      </div>
                      <span className="small muted">
                        Cargando más fuentes: {progress.done} de {progress.total}
                      </span>
                    </div>
                  )}

                  {visibleJobs.length > 0 ? (
                    <>
                      <div className="jobs-grid">
                        {pageJobs.map((job) => (
                          <JobCard key={job.id} job={job} />
                        ))}
                      </div>
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        totalItems={visibleJobs.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={goToPage}
                      />
                    </>
                  ) : (
                    <div className="status">
                      <p>Ninguna oferta cumple los filtros.</p>
                      <p className="muted small">Prueba a bajar el match mínimo, cambiar la ubicación o la búsqueda.</p>
                    </div>
                  )}
                </>
              )
            )}

            <ExternalSearch
              role={cv.role}
              cvSkills={cv.cvSkills}
              homeCountry={cv.homeCountry}
              homeCity={cv.homeCity}
            />
          </main>
        </div>
      )}
    </div>
  )
}
