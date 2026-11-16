import { CONTINENT_LABELS } from '../services/geoService'
import { SENIORITY_LABELS } from '../services/jobMeta'

// Salario mínimo anual (en €, aproximado: se convierten otras monedas y periodos)
const SALARY_OPTIONS = [0, 20000, 30000, 40000, 50000, 60000, 80000, 100000]

// Antigüedad máxima de la oferta (días; 0 = cualquier fecha)
const AGE_OPTIONS = [
  [0, 'Cualquier fecha'],
  [1, 'Últimas 24 horas'],
  [3, 'Últimos 3 días'],
  [7, 'Última semana'],
  [30, 'Último mes'],
]

/**
 * Filtros del panel lateral:
 * - Ubicación: continente + país (con nº de ofertas) + incluir remoto sin restricción de país.
 * - Nivel (seniority), salario mínimo anual y fecha de publicación.
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
  seniority,
  onSeniorityChange,
  seniorityCounts,
  minSalary,
  onMinSalaryChange,
  includeNoSalary,
  onIncludeNoSalaryChange,
  maxAge,
  onMaxAgeChange,
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

      <div className="field">
        <label htmlFor="seniority" className="field__label">
          Nivel
        </label>
        <select
          id="seniority"
          className="input select"
          value={seniority}
          onChange={(e) => onSeniorityChange(e.target.value)}
        >
          <option value="all">Todos los niveles</option>
          {Object.entries(SENIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label} ({seniorityCounts[value] || 0})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="salary" className="field__label">
          Salario mínimo (anual)
        </label>
        <select
          id="salary"
          className="input select"
          value={minSalary}
          onChange={(e) => onMinSalaryChange(Number(e.target.value))}
        >
          {SALARY_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v === 0 ? 'Cualquiera' : `Desde ${v / 1000}.000 €`}
            </option>
          ))}
        </select>
        <label className="toggle toggle--compact">
          <input
            type="checkbox"
            checked={includeNoSalary}
            onChange={(e) => onIncludeNoSalaryChange(e.target.checked)}
            disabled={minSalary === 0}
          />
          <span>
            Incluir ofertas sin salario indicado
            <span className="toggle__hint">Otras monedas y salarios mensuales se convierten de forma aproximada</span>
          </span>
        </label>
      </div>

      <div className="field">
        <label htmlFor="age" className="field__label">
          Fecha de publicación
        </label>
        <select id="age" className="input select" value={maxAge} onChange={(e) => onMaxAgeChange(Number(e.target.value))}>
          {AGE_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>

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
