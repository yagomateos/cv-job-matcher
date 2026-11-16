import { useMemo } from 'react'
import { SKILL_GROUPS } from '../services/cvService'
import { TrendIcon } from './Icons'

// Cuántas skills se muestran
const TOP = 8

// Skills genéricas (git, api, agile…) y "ai" (muchas ofertas lo mencionan solo en la
// descripción de la empresa, "AI-powered…"): no aportan como "qué aprender"
const GENERIC = new Set([...SKILL_GROUPS.general, 'ai'])

/**
 * "Skills que más te piden y no tienes": suma las skills que faltan (missingSkills) en las
 * ofertas que se están viendo (respeta los filtros) y muestra las más repetidas.
 * Responde a "¿qué debería aprender para optar a más ofertas?".
 * @param {object[]} jobs ofertas visibles (con missingSkills calculadas)
 */
export default function SkillGaps({ jobs }) {
  const gaps = useMemo(() => {
    const counts = new Map()
    for (const job of jobs) {
      for (const skill of job.missingSkills || []) {
        if (!GENERIC.has(skill)) counts.set(skill, (counts.get(skill) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP)
      .map(([skill, count]) => ({ skill, count, pct: Math.round((count / jobs.length) * 100) }))
  }, [jobs])

  if (jobs.length === 0) return null
  const max = gaps[0]?.count || 1

  return (
    <section className="panel skill-gaps" aria-labelledby="skill-gaps-title">
      <div className="skill-gaps__header">
        <span className="skill-gaps__icon" aria-hidden="true">
          <TrendIcon size={16} />
        </span>
        <div>
          <h2 id="skill-gaps-title" className="skill-gaps__title">
            Skills que más te piden
          </h2>
          <p className="small muted">
            Y que no tienes, en las {jobs.length} ofertas que estás viendo
          </p>
        </div>
      </div>

      {gaps.length === 0 ? (
        <p className="small muted">Tienes todas las skills que piden estas ofertas. ¡Bien!</p>
      ) : (
        <ol className="skill-gaps__list">
          {gaps.map((g) => (
            <li key={g.skill} className="skill-gaps__item">
              <div className="skill-gaps__row">
                <span className="skill-gaps__skill">{g.skill}</span>
                <span className="small muted">
                  {g.count} {g.count === 1 ? 'oferta' : 'ofertas'} · {g.pct}%
                </span>
              </div>
              <div className="progress progress--thin" aria-hidden="true">
                <div className="progress__bar skill-gaps__bar" style={{ width: `${(g.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
