import { useCallback, useEffect, useMemo, useState } from 'react'
import { calculateMatch, extractJobSkills } from '../services/cvService'
import { fetchAllJobs } from '../services/jobService'

/** Calcula (una sola vez) las skills que pide cada oferta y las guarda en job.skills. */
function withSkills(jobs) {
  for (const job of jobs) if (!job.skills) job.skills = extractJobSkills(job)
  return jobs
}

/**
 * @param {string[]} cvSkills skills detectadas en el CV
 * @param {string} role perfil del CV (clave de ROLE_LABELS): decide qué ofertas se piden
 * @param {string|null} homeCountry país del CV (ES, US...): se traen más ofertas de él
 */
export function useJobs(cvSkills, role = 'frontend', homeCountry = null) {
  const [rawJobs, setRawJobs] = useState([])
  const [error, setError] = useState(null)
  // Fuentes que han fallado sin impedir mostrar las demás
  const [warnings, setWarnings] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  // Progreso de la carga: cuántas fuentes han respondido de cuántas
  const [progress, setProgress] = useState(null)
  const [minScore, setMinScore] = useState(30)
  // Cambiar este contador fuerza una nueva carga (botón "Actualizar")
  const [reloadKey, setReloadKey] = useState(0)

  // Sin CV no se piden ofertas (evita gastar la cuota de Adzuna en la pantalla inicial)
  const enabled = cvSkills.length > 0

  // Se recargan las ofertas al subir un CV, al pulsar "Actualizar" y al cambiar de perfil
  useEffect(() => {
    if (!enabled) return undefined
    // Evita actualizar el estado si el efecto se limpia antes de que acabe la petición
    let cancelled = false

    async function load() {
      setRawJobs([])
      setError(null)
      setWarnings([])
      setProgress({ done: 0, total: 0 })
      try {
        // La carga inicial usa caché (Adzuna); "Actualizar" (reloadKey > 0) la ignora
        const { jobs, warnings } = await fetchAllJobs(role, {
          force: reloadKey > 0,
          homeCountry,
          // Carga progresiva: se muestran resultados en cuanto responde cada fuente
          onProgress: ({ jobs, done, total }) => {
            if (cancelled) return
            setRawJobs(withSkills(jobs))
            setProgress({ done, total })
          },
        })
        if (!cancelled) {
          setRawJobs(withSkills(jobs))
          setWarnings(warnings)
          setUpdatedAt(Date.now())
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar las ofertas')
      } finally {
        if (!cancelled) setProgress(null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey, role, homeCountry, enabled])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Matching: se recalcula solo cuando cambian las ofertas o las skills del CV
  const rankedJobs = useMemo(
    () =>
      rawJobs
        .map((job) => ({ ...job, ...calculateMatch(cvSkills, job) }))
        .sort((a, b) => b.score - a.score),
    [rawJobs, cvSkills],
  )

  // Filtro por umbral mínimo de match
  const jobs = useMemo(() => rankedJobs.filter((job) => job.score >= minScore), [rankedJobs, minScore])

  // Cargando: con CV y todavía sin ninguna oferta (ni error). "loadingMore": ya hay
  // resultados pero quedan fuentes por responder.
  const loadingMore = progress !== null
  const loading = enabled && !error && rawJobs.length === 0 && (loadingMore || updatedAt === null)

  return {
    jobs,
    totalJobs: rawJobs.length,
    loading,
    loadingMore,
    progress,
    error,
    warnings,
    updatedAt,
    minScore,
    setMinScore,
    reload,
  }
}
