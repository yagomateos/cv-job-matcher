import { useState } from 'react'
import { SENIORITY_LABELS } from '../services/jobMeta'
import { BookmarkIcon, CheckIcon, ClockIcon, ExternalIcon, MoneyIcon, PinIcon, PlusIcon } from './Icons'

/** Devuelve "Hoy" o "Hace Xd" a partir de una fecha ISO. */
function relativeDate(date) {
  if (!date) return null
  const time = new Date(date).getTime()
  if (Number.isNaN(time)) return null
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000))
  return days === 0 ? 'Hoy' : `Hace ${days}d`
}

/** Color según el % de match: verde ≥70, naranja ≥50, gris <50. */
function scoreColor(score) {
  if (score >= 70) return 'var(--green)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--gray)'
}

/**
 * @param {boolean} saved si la oferta está en "Mis ofertas"
 * @param {(job) => void} onToggleSave guardar / quitar de "Mis ofertas"
 */
export default function JobCard({ job, saved = false, onToggleSave }) {
  const [logoError, setLogoError] = useState(false)
  const date = relativeDate(job.date)
  const showLogo = job.logo && !logoError
  const color = scoreColor(job.score)
  const coverage = job.jobSkillsCount ? Math.round((job.matchedSkills.length / job.jobSkillsCount) * 100) : 0

  return (
    <article className="job-card">
      <header className="job-card__header">
        {showLogo ? (
          <img className="job-card__logo" src={job.logo} alt="" loading="lazy" onError={() => setLogoError(true)} />
        ) : (
          // Sin logo (o si no carga): inicial de la empresa
          <div className="job-card__logo job-card__logo--fallback" aria-hidden="true">
            {job.company.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="job-card__heading">
          <h3 className="job-card__title">{job.title}</h3>
          <p className="job-card__company">
            {job.company}
            {/* En móvil la ubicación va junto a la empresa */}
            <span className="only-mobile"> · {job.location}</span>
          </p>
        </div>
        {/* Anillo con el % de match: conic-gradient con el color y el % como variables CSS */}
        <div
          className="match-ring"
          style={{ '--ring-color': color, '--ring-value': `${job.score}%` }}
          role="img"
          aria-label={`${job.score}% de match`}
        >
          <div className="match-ring__inner">
            <span className="match-ring__value">{job.score}%</span>
            <span className="match-ring__label">match</span>
          </div>
        </div>
      </header>

      <ul className={`job-card__meta ${job.salary ? '' : 'hide-mobile'}`}>
        <li className="hide-mobile">
          <PinIcon size={14} /> {job.location}
        </li>
        {date && (
          <li className="hide-mobile">
            <ClockIcon size={14} /> {date}
          </li>
        )}
        {job.seniority && job.seniority !== 'unknown' && (
          <li className="job-card__level">{SENIORITY_LABELS[job.seniority]}</li>
        )}
        {job.salary && (
          <li className="job-card__salary">
            <MoneyIcon size={14} /> {job.salary}
          </li>
        )}
      </ul>

      {job.jobSkillsCount > 0 && (
        <div className="job-card__skills">
          <p className="small muted hide-mobile">
            Tienes {job.matchedSkills.length} de {job.jobSkillsCount} skills que pide
          </p>
          <div className="progress hide-mobile" aria-hidden="true">
            <div className="progress__bar" style={{ width: `${coverage}%`, background: color }} />
          </div>
          <div className="chips">
            {job.matchedSkills.map((skill) => (
              <span key={skill} className="chip chip--match">
                <CheckIcon size={11} className="hide-mobile" /> {skill}
              </span>
            ))}
            {job.missingSkills.map((skill) => (
              <span key={skill} className="chip chip--missing" title="Te falta esta skill">
                <PlusIcon size={11} /> {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <footer className="job-card__footer">
        <span className="small muted">
          {/* En móvil la fecha va en el pie */}
          {date && <span className="only-mobile">{date} · </span>}
          vía <strong>{job.source}</strong>
        </span>
        <div className="job-card__actions">
          {onToggleSave && (
            <button
              type="button"
              className={`btn btn--icon btn--small save-btn ${saved ? 'is-saved' : ''}`}
              onClick={() => onToggleSave(job)}
              aria-pressed={saved}
              aria-label={saved ? 'Quitar de mis ofertas' : 'Guardar en mis ofertas'}
              title={saved ? 'Quitar de mis ofertas' : 'Guardar en mis ofertas'}
            >
              <BookmarkIcon size={18} filled={saved} />
            </button>
          )}
          <a className="btn btn--primary btn--small" href={job.url} target="_blank" rel="noopener noreferrer">
            Ver oferta <ExternalIcon size={14} className="hide-mobile" />
          </a>
        </div>
      </footer>
    </article>
  )
}
