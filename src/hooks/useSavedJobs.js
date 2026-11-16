import { useCallback, useState } from 'react'

const STORAGE_KEY = 'cv-job-matcher:saved'

/** Estados de una candidatura, en orden (clave -> etiqueta). */
export const SAVED_STATUS = {
  saved: 'Guardada',
  applied: 'Aplicada',
  interview: 'Entrevista',
  offer: 'Oferta',
  discarded: 'Descartada',
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function persist(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* sin persistencia: se mantiene mientras la pestaña esté abierta */
  }
}

/**
 * Ofertas guardadas y su estado (seguimiento de candidaturas).
 * Se guarda una COPIA de los datos de la oferta: sigue disponible aunque la oferta
 * desaparezca de las fuentes. Todo vive en este navegador (localStorage), sin servidor.
 */
export function useSavedJobs() {
  const [saved, setSaved] = useState(load)

  const update = useCallback((fn) => {
    setSaved((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [])

  const savedIds = new Set(saved.map((s) => s.id))
  const isSaved = (id) => savedIds.has(id)

  /** Guarda la oferta, o la quita si ya estaba guardada. */
  const toggleSave = useCallback(
    (job) =>
      update((prev) =>
        prev.some((s) => s.id === job.id)
          ? prev.filter((s) => s.id !== job.id)
          : [
              {
                id: job.id,
                title: job.title,
                company: job.company,
                url: job.url,
                location: job.location,
                source: job.source,
                salary: job.salary || null,
                score: job.score ?? null,
                date: job.date || null,
                logo: job.logo || '',
                status: 'saved',
                savedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              ...prev,
            ],
      ),
    [update],
  )

  const setStatus = useCallback(
    (id, status) =>
      update((prev) => prev.map((s) => (s.id === id ? { ...s, status, updatedAt: new Date().toISOString() } : s))),
    [update],
  )

  const remove = useCallback((id) => update((prev) => prev.filter((s) => s.id !== id)), [update])

  return { saved, isSaved, toggleSave, setStatus, remove }
}
