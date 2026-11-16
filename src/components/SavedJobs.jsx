import { useState } from 'react'
import { SAVED_STATUS } from '../hooks/useSavedJobs'
import { BookmarkIcon, ExternalIcon, TrashIcon } from './Icons'

/** id HTML válido a partir del id de la oferta (algunos son URLs). */
const domId = (id) => `status-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`

/** "hace 3 días" a partir de una fecha ISO. */
function since(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

/**
 * "Mis ofertas": ofertas guardadas con su estado de candidatura.
 * Filtro por estado con contadores, cambio de estado y borrado.
 */
export default function SavedJobs({ saved, onStatusChange, onRemove }) {
  const [filter, setFilter] = useState('all')
  const counts = Object.fromEntries(Object.keys(SAVED_STATUS).map((k) => [k, saved.filter((s) => s.status === k).length]))
  const list = filter === 'all' ? saved : saved.filter((s) => s.status === filter)

  if (saved.length === 0) {
    return (
      <div className="saved-empty">
        <span className="saved-empty__icon" aria-hidden="true">
          <BookmarkIcon size={22} />
        </span>
        <h2 className="saved-empty__title">Aún no has guardado ofertas</h2>
        <p className="small muted">
          Pulsa el marcador de una oferta para guardarla. Aquí podrás seguir en qué punto está cada
          candidatura: aplicada, entrevista, oferta…
        </p>
      </div>
    )
  }

  return (
    <section className="saved" aria-label="Mis ofertas guardadas">
      {/* Filtro por estado */}
      <div className="saved__filters" role="group" aria-label="Filtrar por estado">
        {[['all', 'Todas', saved.length], ...Object.entries(SAVED_STATUS).map(([k, label]) => [k, label, counts[k]])].map(
          ([key, label, n]) => (
            <button
              key={key}
              type="button"
              className={`map-continent ${filter === key ? 'is-active' : ''}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label} <span className="saved__count">{n}</span>
            </button>
          ),
        )}
      </div>

      {list.length === 0 ? (
        <p className="small muted saved__none">No hay ofertas en este estado.</p>
      ) : (
        <ul className="saved__list">
          {list.map((job) => (
            <li key={job.id} className={`saved-item saved-item--${job.status}`}>
              <div className="saved-item__main">
                <h3 className="saved-item__title">{job.title}</h3>
                <p className="small muted">
                  {job.company} · {job.location}
                </p>
                <p className="small muted">
                  {job.score != null && <span className="saved-item__score">{job.score}% match</span>}
                  {job.salary && <> · {job.salary}</>} · vía {job.source} · guardada {since(job.savedAt)}
                </p>
              </div>
              <div className="saved-item__actions">
                <label className="visually-hidden" htmlFor={domId(job.id)}>
                  Estado de la candidatura
                </label>
                <select
                  id={domId(job.id)}
                  className="input select saved-item__status"
                  value={job.status}
                  onChange={(e) => onStatusChange(job.id, e.target.value)}
                >
                  {Object.entries(SAVED_STATUS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <a className="btn btn--primary btn--small" href={job.url} target="_blank" rel="noopener noreferrer">
                  Ver oferta <ExternalIcon size={14} />
                </a>
                <button
                  type="button"
                  className="btn btn--icon btn--small"
                  onClick={() => onRemove(job.id)}
                  aria-label={`Quitar "${job.title}" de mis ofertas`}
                  title="Quitar de mis ofertas"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
