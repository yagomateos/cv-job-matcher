import { CONTINENT_LABELS } from '../services/geoService'

/**
 * Filtros del panel lateral:
 * - Ubicación: continente + país (con nº de ofertas) + incluir remoto sin restricción de país.
 * - Fuentes: casillas con contador.
 * @param {{ code: string, name: string, count: number }[]} countryOptions países disponibles
 * @param {{ name: string, count: number, enabled: boolean }[]} sources
 */
export default function Filters({
  continent,
  onContinentChange,
  country,
  onCountryChange,
  countryOptions,
  includeWorldwide,
  onIncludeWorldwideChange,
  worldwideCount,
  sources,
  onToggleSource,
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="continent" className="field__label">
          Continente
        </label>
        <select
          id="continent"
          className="input select"
          value={continent}
          onChange={(e) => onContinentChange(e.target.value)}
        >
          <option value="all">Todo el mundo</option>
          {Object.entries(CONTINENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="country" className="field__label">
          País
        </label>
        <select id="country" className="input select" value={country} onChange={(e) => onCountryChange(e.target.value)}>
          <option value="all">Todos los países</option>
          <option value="worldwide">Remoto sin restricción de país ({worldwideCount})</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={includeWorldwide}
          onChange={(e) => onIncludeWorldwideChange(e.target.checked)}
          // Con un país elegido solo salen sus ofertas concretas: la casilla no se aplica
          disabled={country !== 'all'}
        />
        <span>
          Incluir ofertas en remoto sin restricción de país
          <span className="toggle__hint">
            {country === 'worldwide'
              ? 'Ahora mismo ves solo las de remoto sin país'
              : country !== 'all'
                ? 'Al elegir un país solo salen sus ofertas. Las de remoto sin país, con su botón del mapa.'
                : 'Se pueden hacer desde cualquier lugar'}
          </span>
        </span>
      </label>

      <fieldset className="sources">
        <legend className="field__label">Fuentes</legend>
        {sources.map((s) => (
          <label key={s.name} className="sources__item">
            <input type="checkbox" checked={s.enabled} onChange={() => onToggleSource(s.name)} />
            <span className="sources__name">{s.name}</span>
            <span className="count-badge">{s.count}</span>
          </label>
        ))}
      </fieldset>
    </>
  )
}
