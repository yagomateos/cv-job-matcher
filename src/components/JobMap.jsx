import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRY_PATHS, MAP_HEIGHT, MAP_WIDTH } from '../data/worldMap'
import { CONTINENT_LABELS, COUNTRY_BY_CODE, isLocalJob, project } from '../services/geoService'
import { GlobeIcon, MinusIcon, PlusIcon, ResetIcon } from './Icons'

// Ofertas que se listan en la ventana de cada país
const PEEK_JOBS = 4

/**
 * Proporción alto/ancho del recorte visible del mapa.
 * - Escritorio: el mapa mundial completo (≈ 0,39: más ancho que alto).
 * - Móvil: un recorte más alto (4:3) para que el mapa tenga tamaño útil; se ve una parte
 *   del mundo (centrada en el país del CV) y se mueve arrastrando, como en cualquier app de mapas.
 */
const WORLD_ASPECT = MAP_HEIGHT / MAP_WIDTH
const MOBILE_ASPECT = 0.75
const MOBILE_BREAKPOINT = 600
const MIN_VIEW_W = MAP_WIDTH / 12 // zoom máximo ≈ ×12
const ZOOM_STEP = 1.6
const DRAG_THRESHOLD_PX = 4 // por debajo de esto un arrastre cuenta como clic

/** Zona de cada continente: [lng oeste, lat norte, lng este, lat sur]. */
const CONTINENT_BOUNDS = {
  europe: [-25, 71, 45, 34],
  'north-america': [-168, 72, -52, 14],
  'latin-america': [-118, 33, -32, -56],
  asia: [25, 70, 150, -11],
  africa: [-20, 38, 55, -36],
  oceania: [110, 0, 180, -48],
}

/** Tamaño de la burbuja en píxeles de pantalla. En móvil, más grandes para tocarlas con el dedo. */
const bubblePx = (count, mobile) =>
  mobile ? Math.min(20, 7 + Math.sqrt(count) * 2.1) : Math.min(22, 5 + Math.sqrt(count) * 2.4)

/** Ancho máximo de la vista: lo que permite el alto del mapa con esta proporción. */
const maxViewW = (aspect) => Math.min(MAP_WIDTH, MAP_HEIGHT / aspect)

/** Ajusta una vista a los límites del mapa y al zoom permitido. */
function clampView({ x, y, w }, aspect) {
  const width = Math.min(maxViewW(aspect), Math.max(MIN_VIEW_W, w))
  const height = width * aspect
  return {
    x: Math.min(Math.max(0, x), MAP_WIDTH - width),
    y: Math.min(Math.max(0, y), MAP_HEIGHT - height),
    w: width,
  }
}

/** Vista centrada en un punto con un ancho dado. */
const centeredView = (cx, cy, w, aspect) => clampView({ x: cx - w / 2, y: cy - (w * aspect) / 2, w }, aspect)

/** Vista que encuadra un rectángulo (en unidades del mapa) con un margen. */
function fitRect(x0, y0, x1, y1, aspect, padding = 1.15) {
  const w = Math.max(x1 - x0, (y1 - y0) / aspect) * padding
  return centeredView((x0 + x1) / 2, (y0 + y1) / 2, w, aspect)
}

/** Vista inicial: el mundo entero (escritorio) o el recorte máximo centrado en el país del CV (móvil). */
function worldView(aspect, homeCountry) {
  const w = maxViewW(aspect)
  const home = homeCountry ? COUNTRY_BY_CODE.get(homeCountry) : null
  // Sin país conocido, centramos en el Atlántico (se ven América y Europa)
  const [cx, cy] = home ? project(home.lat, home.lng) : project(20, -30)
  return centeredView(cx, cy, w, aspect)
}

function continentView(continent, aspect, homeCountry) {
  const b = CONTINENT_BOUNDS[continent]
  if (!b) return worldView(aspect, homeCountry)
  const [x0, y0] = project(b[1], b[0])
  const [x1, y1] = project(b[3], b[2])
  return fitRect(x0, y0, x1, y1, aspect)
}

/** Vista centrada en un país: zoom moderado alrededor de su centro. */
function countryView(code, aspect) {
  const c = COUNTRY_BY_CODE.get(code)
  if (!c) return null
  const [cx, cy] = project(c.lat, c.lng)
  return centeredView(cx, cy, MAP_WIDTH / 5, aspect)
}

/**
 * Separa las burbujas que se solapan (cartograma de Dorling simplificado).
 * Sin esto, en zonas densas como Europa una burbuja pequeña tapa a otra más grande y al
 * tocar una se selecciona la de al lado. Cada iteración empuja las parejas que chocan (la
 * grande se mueve menos) y atrae un poco cada burbuja hacia su país para que no se aleje.
 * @param {{ cx: number, cy: number, r: number }[]} nodes posiciones y radios en unidades del mapa
 * @param {number} gap separación mínima entre burbujas (unidades del mapa)
 */
function separateBubbles(nodes, gap) {
  const pts = nodes.map((n) => ({ ...n, x: n.cx, y: n.cy }))
  for (let iter = 0; iter < 60; iter++) {
    let moved = false
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]
        const b = pts[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        const min = a.r + b.r + gap
        if (d >= min) continue
        if (d < 1e-6) {
          // Mismo centro: separamos en una dirección fija para que sea determinista
          dx = 1
          dy = 0
          d = 1
        }
        const push = min - d
        const wa = b.r / (a.r + b.r) // la burbuja grande se mueve menos
        a.x -= (dx / d) * push * wa
        a.y -= (dy / d) * push * wa
        b.x += (dx / d) * push * (1 - wa)
        b.y += (dy / d) * push * (1 - wa)
        moved = true
      }
    }
    // Atracción suave hacia el país de origen
    for (const p of pts) {
      p.x += (p.cx - p.x) * 0.04
      p.y += (p.cy - p.y) * 0.04
    }
    if (!moved) break
  }
  return pts
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3
const scoreLevel = (s) => (s >= 70 ? 'high' : s >= 50 ? 'mid' : 'low')

/**
 * Mapa mundial interactivo (SVG propio, sin librerías de mapas).
 * - Burbujas por país (tamaño = nº de ofertas). Ratón encima: ventana con las mejores ofertas.
 * - Clic/toque en un país: lo filtra y el mapa se acerca. Botones de continente: zoom + filtro.
 * - Zoom con los botones +/−, Ctrl + rueda, y arrastrar para moverse.
 * @param {string} selectedCountry código del país filtrado, 'worldwide' o 'all'
 * @param {string} continent continente filtrado o 'all'
 * @param {string|null} homeCountry país del CV: en móvil, el mapa empieza centrado en él
 */
export default function JobMap({ jobs, selectedCountry, onSelectCountry, continent, onSelectContinent, homeCountry }) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)
  const mobile = width > 0 && width < MOBILE_BREAKPOINT
  const aspect = mobile ? MOBILE_ASPECT : WORLD_ASPECT

  const [view, setView] = useState(() => worldView(WORLD_ASPECT, null))
  const viewRef = useRef(view)
  const animRef = useRef(0)
  const dragRef = useRef(null) // { startX, startY, view, moved }
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(null) // { code, side }

  const applyView = useCallback((v) => {
    viewRef.current = v
    setView(v)
  }, [])

  // Transición suave entre vistas (zoom a continente / país)
  const animateTo = useCallback(
    (target) => {
      cancelAnimationFrame(animRef.current)
      const from = viewRef.current
      const start = performance.now()
      const step = (now) => {
        const t = Math.min(1, (now - start) / 350)
        const k = easeOutCubic(t)
        applyView({
          x: from.x + (target.x - from.x) * k,
          y: from.y + (target.y - from.y) * k,
          w: from.w + (target.w - from.w) * k,
        })
        if (t < 1) animRef.current = requestAnimationFrame(step)
      }
      animRef.current = requestAnimationFrame(step)
    },
    [applyView],
  )

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  // Ancho real del mapa: decide escritorio/móvil y el tamaño de burbujas y textos
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Vista objetivo según los filtros: país seleccionado > continente > mundo (o tu zona en móvil)
  const targetView = useCallback(
    () =>
      (selectedCountry !== 'all' && selectedCountry !== 'worldwide' && countryView(selectedCountry, aspect)) ||
      (continent !== 'all' ? continentView(continent, aspect, homeCountry) : worldView(aspect, homeCountry)),
    [selectedCountry, continent, aspect, homeCountry],
  )

  // El encuadre sigue a los filtros y al cambio escritorio ↔ móvil
  const firstFit = useRef(true)
  const ready = width > 0
  useEffect(() => {
    if (!ready) return
    if (firstFit.current) {
      // Primera vez: sin animación (evita ver el mapa "viajar" al cargar)
      firstFit.current = false
      applyView(targetView())
    } else {
      animateTo(targetView())
    }
  }, [targetView, ready, animateTo, applyView])

  // Unidades del mapa por píxel de pantalla con el zoom actual
  const scale = width ? view.w / width : 1

  // Zoom alrededor de un punto (unidades del mapa); por defecto, el centro de la vista
  const zoomBy = useCallback(
    (factor, cx, cy) => {
      const v = viewRef.current
      const px = cx ?? v.x + v.w / 2
      const py = cy ?? v.y + (v.w * aspect) / 2
      const w = v.w / factor
      const rx = (px - v.x) / v.w
      const ry = (py - v.y) / (v.w * aspect)
      cancelAnimationFrame(animRef.current)
      applyView(clampView({ x: px - rx * w, y: py - ry * w * aspect, w }, aspect))
    },
    [applyView, aspect],
  )

  // Ctrl/Cmd + rueda = zoom en el punto del cursor (sin Ctrl la rueda hace scroll de la página).
  // Se registra a mano porque React añade "wheel" como pasivo y no deja hacer preventDefault.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const v = viewRef.current
      const cx = v.x + ((e.clientX - rect.left) / rect.width) * v.w
      const cy = v.y + ((e.clientY - rect.top) / rect.height) * v.w * aspect
      zoomBy(e.deltaY < 0 ? 1.25 : 1 / 1.25, cx, cy)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy, aspect])

  // ===== Arrastrar para moverse =====
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    cancelAnimationFrame(animRef.current)
    dragRef.current = { startX: e.clientX, startY: e.clientY, view: viewRef.current, moved: false }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    if (!drag.moved) {
      drag.moved = true
      setDragging(true)
      setHover(null)
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const unitsPerPx = drag.view.w / width
    applyView(
      clampView({ x: drag.view.x - dx * unitsPerPx, y: drag.view.y - dy * unitsPerPx, w: drag.view.w }, aspect),
    )
  }

  const endDrag = () => {
    // El flag "moved" se mantiene hasta el click que sigue, para no seleccionar un país al soltar
    setTimeout(() => {
      dragRef.current = null
    }, 0)
    setDragging(false)
  }

  // ===== Datos =====
  // byCountry: ofertas CONCRETAS de cada país (isLocalJob): es lo que cuentan la burbuja, la
  //            ventana, la franja y lo que se ve al filtrar el país (los números coinciden).
  // acceptsCountry: países a los que se abre alguna oferta de toda una región: solo se tiñen.
  const { byCountry, acceptsCountry, worldwideCount } = useMemo(() => {
    const local = new Map()
    const accepts = new Set()
    let worldwide = 0
    for (const job of jobs) {
      if (job.geo.worldwide) {
        worldwide++
        continue
      }
      for (const code of job.geo.countries) accepts.add(code)
      if (!isLocalJob(job)) continue
      for (const code of job.geo.countries) {
        if (!local.has(code)) local.set(code, [])
        local.get(code).push(job)
      }
    }
    return { byCountry: local, acceptsCountry: accepts, worldwideCount: worldwide }
  }, [jobs])

  const bubbles = useMemo(
    () =>
      [...byCountry.entries()]
        .map(([code, list]) => {
          const country = COUNTRY_BY_CODE.get(code)
          if (!country) return null
          const [cx, cy] = project(country.lat, country.lng)
          return { code, name: country.name, count: list.length, cx, cy }
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count),
    [byCountry],
  )

  // Posición final de cada burbuja: separadas para que no se tapen entre sí. Depende del
  // zoom (scale): al acercar hay más sitio y las burbujas vuelven sobre su país.
  const placedBubbles = useMemo(() => {
    const nodes = bubbles.map((b) => {
      const rPx = bubblePx(b.count, mobile)
      return { ...b, rPx, r: rPx * scale }
    })
    return separateBubbles(nodes, 1.5 * scale)
  }, [bubbles, scale, mobile])

  // ===== Interacción =====
  const toggleCountry = (code) => {
    if (dragRef.current?.moved) return
    onSelectCountry(selectedCountry === code ? 'all' : code)
  }

  /**
   * Ventana con las ofertas del país bajo el cursor (solo con ratón). No sigue al ratón:
   * se ancla en una esquina superior, en el lado CONTRARIO al cursor, para no tapar lo
   * que se va a pulsar.
   */
  const showAt = (code, event, bubble) => {
    if (mobile || dragRef.current?.moved) return
    if (event && event.pointerType && event.pointerType !== 'mouse') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = event ? event.clientX - rect.left : (bubble.x - view.x) / scale
    setHover({ code, side: x > rect.width / 2 ? 'left' : 'right' })
  }

  const hoverJobs = hover ? byCountry.get(hover.code) || [] : []
  const hoverBest = hoverJobs.reduce((max, j) => Math.max(max, j.score), 0)

  // País seleccionado (franja bajo el mapa: útil sobre todo en móvil, donde no hay "hover")
  const selected = selectedCountry !== 'all' && selectedCountry !== 'worldwide' ? selectedCountry : null
  const selectedJobs = selected ? byCountry.get(selected) || [] : []
  const selectedBest = selectedJobs.reduce((max, j) => Math.max(max, j.score), 0)

  const zoomedIn = view.w < maxViewW(aspect) - 1
  const viewH = view.w * aspect

  return (
    <section className="map-card" aria-label="Mapa de ofertas por país">
      <div className="map-card__header">
        <div>
          <h2 className="map-card__title">Ofertas por país</h2>
          <p className="small muted map-card__subtitle">
            {bubbles.length} {bubbles.length === 1 ? 'país' : 'países'} con ofertas ·{' '}
            {mobile ? 'toca un país para filtrar' : 'haz clic en un país para ver sus ofertas'}
          </p>
        </div>
        <button
          type="button"
          className={`map-chip ${selectedCountry === 'worldwide' ? 'is-active' : ''}`}
          aria-pressed={selectedCountry === 'worldwide'}
          onClick={() => onSelectCountry(selectedCountry === 'worldwide' ? 'all' : 'worldwide')}
        >
          <GlobeIcon size={14} /> Remoto sin país · {worldwideCount}
        </button>
      </div>

      {/* Continentes: zoom + filtro (desplazable en horizontal en móvil) */}
      <div className="map-continents-wrap">
        <div className="map-continents" role="group" aria-label="Ir a un continente">
          {[['all', 'Todo el mundo'], ...Object.entries(CONTINENT_LABELS)].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`map-continent ${continent === value && selectedCountry === 'all' ? 'is-active' : ''}`}
              aria-pressed={continent === value && selectedCountry === 'all'}
              onClick={() => onSelectContinent(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`map ${dragging ? 'is-dragging' : ''}`}
        ref={containerRef}
        style={{ aspectRatio: `${1 / aspect}` }}
        onMouseLeave={() => setHover(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg
          className="map__svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${viewH}`}
          preserveAspectRatio="xMidYMid slice"
          role="group"
          aria-label="Mapa mundial con el número de ofertas por país"
        >
          <g aria-hidden="true">
            {COUNTRY_PATHS.map((p) => {
              // has: tiene ofertas concretas (se puede pulsar). accepts: solo ofertas de toda una región
              const has = byCountry.has(p.code)
              const accepts = !has && acceptsCountry.has(p.code)
              return (
                <path
                  key={p.code}
                  d={p.d}
                  className={`map__country ${has ? 'has-jobs' : ''} ${accepts ? 'accepts' : ''} ${selectedCountry === p.code ? 'is-selected' : ''} ${hover?.code === p.code ? 'is-hovered' : ''}`}
                  onPointerMove={has ? (e) => showAt(p.code, e) : undefined}
                  onMouseLeave={has ? () => setHover(null) : undefined}
                  onClick={has ? () => toggleCountry(p.code) : undefined}
                />
              )
            })}
          </g>

          {placedBubbles.map((b) => {
            const { rPx } = b
            return (
              <g
                key={b.code}
                className={`map__bubble ${selectedCountry === b.code ? 'is-selected' : ''} ${hover?.code === b.code ? 'is-hovered' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${b.name}: ${b.count} ${b.count === 1 ? 'oferta' : 'ofertas'}. Pulsa para filtrar.`}
                aria-pressed={selectedCountry === b.code}
                onPointerMove={(e) => showAt(b.code, e)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => showAt(b.code, null, b)}
                onBlur={() => setHover(null)}
                onClick={() => toggleCountry(b.code)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectCountry(selectedCountry === b.code ? 'all' : b.code)
                  }
                }}
              >
                <circle cx={b.x} cy={b.y} r={b.r} />
                {rPx >= 11 && (
                  <text x={b.x} y={b.y} dy="0.35em" textAnchor="middle" style={{ fontSize: `${(mobile ? 11 : 10) * scale}px` }}>
                    {b.count}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Ventana con las mejores ofertas del país: anclada en la esquina contraria al
            cursor, no captura el ratón y no se mueve (no parpadea al pasar de país en país) */}
        {hover && hoverJobs.length > 0 && (
          <div className={`map-peek map-peek--${hover.side}`} role="tooltip">
            <div className="map-peek__country">
              <strong>{COUNTRY_BY_CODE.get(hover.code)?.name}</strong>
              <span>
                {hoverJobs.length} {hoverJobs.length === 1 ? 'oferta' : 'ofertas'} · mejor match {hoverBest}%
              </span>
            </div>
            <ul className="map-peek__list">
              {hoverJobs.slice(0, PEEK_JOBS).map((job) => (
                <li key={job.id}>
                  <span className={`map-peek__score map-peek__score--${scoreLevel(job.score)}`}>{job.score}%</span>
                  <span className="map-peek__job">
                    <span className="map-peek__title">{job.title}</span>
                    <span className="map-peek__company">
                      {job.company} · {job.source}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="map-peek__footer">
              {hoverJobs.length > PEEK_JOBS ? `+${hoverJobs.length - PEEK_JOBS} más · ` : ''}
              {selectedCountry === hover.code ? 'Clic para quitar el filtro' : 'Clic para ver todas'}
            </p>
          </div>
        )}

        {/* Controles de zoom */}
        <div className="map-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="map-zoom__btn" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Acercar">
            <PlusIcon size={14} />
          </button>
          <button
            type="button"
            className="map-zoom__btn"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={!zoomedIn}
            aria-label="Alejar"
          >
            <MinusIcon size={14} />
          </button>
          <button
            type="button"
            className="map-zoom__btn"
            onClick={() => animateTo(targetView())}
            aria-label="Volver al encuadre inicial"
          >
            <ResetIcon size={14} />
          </button>
        </div>
      </div>

      {/* País seleccionado: resumen + quitar filtro (en móvil sustituye al "hover") */}
      {selected && (
        <div className="map-selection" role="status">
          <div className="map-selection__text">
            <strong>{COUNTRY_BY_CODE.get(selected)?.name}</strong>
            <span>
              {selectedJobs.length} {selectedJobs.length === 1 ? 'oferta' : 'ofertas'}
              {selectedJobs.length > 0 && ` · mejor match ${selectedBest}%`}
            </span>
          </div>
          <button type="button" className="btn btn--small" onClick={() => onSelectCountry('all')}>
            Quitar filtro
          </button>
        </div>
      )}

      {/* Leyenda + ayuda de uso */}
      <div className="map-legend">
        <span className="map-legend__item">
          <span className="map-legend__bubble" aria-hidden="true" /> Ofertas en el país
        </span>
        <span className="map-legend__item">
          <span className="map-legend__land" aria-hidden="true" /> Acepta candidatos del país
        </span>
        <span className="map-legend__hint">
          {mobile ? 'Arrastra para moverte' : 'Arrastra para moverte · Ctrl + rueda para zoom'}
        </span>
      </div>
    </section>
  )
}
