import { useCallback, useState } from 'react'
import {
  checkTechProfile,
  detectHomeCity,
  detectHomeCountry,
  detectLanguage,
  detectRole,
  extractSkills,
  extractTextFromPDF,
  ROLE_LABELS,
} from '../services/cvService'

const STORAGE_KEY = 'cv-job-matcher:cv'
const EMPTY = { cvSkills: [], fileName: '', role: 'frontend', language: 'es', homeCountry: null, homeCity: null }

// Lee el CV guardado (skills, nombre de archivo, rol e idioma; nunca el texto completo).
// localStorage puede fallar (modo privado, etc.)
function loadStoredCV() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (stored && Array.isArray(stored.cvSkills)) {
      return {
        ...EMPTY,
        ...stored,
        // CVs guardados con una versión anterior no tenían rol (o uno que ya no existe):
        // lo deducimos por las skills
        role: ROLE_LABELS[stored.role] ? stored.role : detectRole('', stored.cvSkills),
        // CVs guardados antes de detectar el país: si el CV está en castellano suponemos
        // España (volver a subirlo lo detecta de verdad desde la cabecera del CV)
        homeCountry: stored.homeCountry !== undefined ? stored.homeCountry : stored.language === 'es' ? 'ES' : null,
      }
    }
  } catch {
    /* ignoramos datos corruptos o storage no disponible */
  }
  return EMPTY
}

function saveStoredCV(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin persistencia: la app sigue funcionando */
  }
}

export function useCV() {
  const [stored] = useState(loadStoredCV)
  const [cvText, setCvText] = useState('')
  const [cvSkills, setCvSkills] = useState(stored.cvSkills)
  const [fileName, setFileName] = useState(stored.fileName)
  const [role, setRoleState] = useState(stored.role)
  const [language, setLanguage] = useState(stored.language)
  // País del candidato (ES, US...): se usan más ofertas de ese país en la búsqueda
  const [homeCountry, setHomeCountry] = useState(stored.homeCountry)
  // Ciudad del candidato: los enlaces a LinkedIn / Indeed buscan directamente en ella
  const [homeCity, setHomeCity] = useState(stored.homeCity)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const uploadCV = useCallback(async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('El archivo debe ser un PDF')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const text = await extractTextFromPDF(file)
      const skills = extractSkills(text)
      if (skills.length === 0) {
        // No sobrescribimos el CV anterior si el nuevo no aporta skills
        setError('No se detectaron skills en el CV')
        return
      }
      // Solo CVs del sector tecnológico: la app busca únicamente ofertas tech
      const { isTech, techSkills } = checkTechProfile(text, skills)
      if (!isTech) {
        const found = techSkills.length ? ` (solo detectamos: ${techSkills.join(', ')})` : ''
        setError(
          `Este CV no parece de un perfil tecnológico${found}. CV Job Matcher solo busca ofertas de ` +
            'tecnología: desarrollo, IA, datos, cloud, QA, ciberseguridad o sistemas.',
        )
        return
      }
      // Perfil del CV: rol (frontend/fullstack/backend) e idioma, para adaptar la búsqueda
      const detectedRole = detectRole(text, skills)
      const detectedLanguage = detectLanguage(text)
      const detectedCountry = detectHomeCountry(text)
      const detectedCity = detectHomeCity(text)

      setCvText(text)
      setCvSkills(skills)
      setFileName(file.name)
      setRoleState(detectedRole)
      setLanguage(detectedLanguage)
      setHomeCountry(detectedCountry)
      setHomeCity(detectedCity)
      // Guardamos solo lo imprescindible, no el texto completo del CV
      saveStoredCV({
        cvSkills: skills,
        fileName: file.name,
        role: detectedRole,
        language: detectedLanguage,
        homeCountry: detectedCountry,
        homeCity: detectedCity,
      })
    } catch (err) {
      console.error(err)
      // Mostramos también el detalle técnico para poder diagnosticar el fallo
      setError(`No se pudo leer el PDF (${err?.message || err}). ¿Es un PDF con texto (no escaneado)?`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Permite corregir a mano el rol detectado
  const setRole = useCallback(
    (newRole) => {
      setRoleState(newRole)
      saveStoredCV({ cvSkills, fileName, role: newRole, language, homeCountry, homeCity })
    },
    [cvSkills, fileName, language, homeCountry, homeCity],
  )

  const reset = useCallback(() => {
    setCvText('')
    setCvSkills([])
    setFileName('')
    setRoleState(EMPTY.role)
    setLanguage(EMPTY.language)
    setHomeCountry(EMPTY.homeCountry)
    setHomeCity(EMPTY.homeCity)
    setError(null)
    saveStoredCV(null)
  }, [])

  return { cvText, cvSkills, fileName, role, language, homeCountry, homeCity, loading, error, uploadCV, setRole, reset }
}
