/**
 * Datos derivados de cada oferta para los filtros: seniority, salario anual en € y antigüedad.
 */

// ===== Seniority =====

export const SENIORITY_LABELS = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead / Staff',
  unknown: 'Sin especificar',
}

// Se comprueban en este orden: "Senior Tech Lead" cuenta como lead; "Junior/Mid", como junior
const SENIORITY_PATTERNS = [
  ['lead', /\b(lead|staff|principal|head of|architect|arquitect[oa]|cto|director|engineering manager)\b/i],
  // "Semi senior" (habitual en Latinoamérica) es nivel intermedio: va antes que "senior"
  ['mid', /\bsemi[- ]?senior\b|\bssr\b/i],
  ['senior', /\b(senior|sr\.?|sénior|snr)\b/i],
  ['junior', /\b(junior|jr\.?|trainee|intern|internship|pr[áa]cticas|becari[oa]|graduate|entry[- ]level)\b/i],
  ['mid', /\b(mid|middle|mid[- ]level|semi[- ]?senior|ssr|intermedi[oa]|regular)\b/i],
]

/** Nivel de la oferta según su título (y etiquetas, p. ej. "Senior" en Himalayas o NoFluffJobs). */
export function detectSeniority(job) {
  const text = `${job.title} ${(job.tags || []).join(' ')}`
  for (const [level, re] of SENIORITY_PATTERNS) if (re.test(text)) return level
  return 'unknown'
}

// ===== Salario =====

/**
 * Cambio aproximado a euros (orientativo, solo para poder comparar salarios de distintos
 * países en el filtro; no pretende ser exacto).
 */
const EUR_RATE = {
  EUR: 1, USD: 0.92, GBP: 1.17, CAD: 0.67, AUD: 0.6, BRL: 0.17, INR: 0.011, PLN: 0.23,
  CHF: 1.04, MXN: 0.05, NZD: 0.55, SGD: 0.68, ZAR: 0.05,
}

/** Moneda a partir del texto del salario. Los prefijos con "$" se comprueban antes que "$". */
function detectCurrency(s) {
  if (/c\$|cad/.test(s)) return 'CAD'
  if (/a\$|aud/.test(s)) return 'AUD'
  if (/r\$|brl/.test(s)) return 'BRL'
  if (/mx\$|mxn/.test(s)) return 'MXN'
  if (/nz\$|nzd/.test(s)) return 'NZD'
  if (/s\$|sgd/.test(s)) return 'SGD'
  if (/€|eur/.test(s)) return 'EUR'
  if (/£|gbp/.test(s)) return 'GBP'
  if (/₹|inr/.test(s)) return 'INR'
  if (/zł|pln/.test(s)) return 'PLN'
  if (/chf/.test(s)) return 'CHF'
  if (/\$|usd/.test(s)) return 'USD'
  return null
}

/** "33k" -> 33000; "4.086" -> 4086 (miles); "3,5k" -> 3500; "100,000" -> 100000. */
function parseAmount(num, hasK) {
  if (hasK) return parseFloat(num.replace(',', '.')) * 1000
  // Separadores de miles: grupos de exactamente 3 cifras tras el punto o la coma
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) return Number(num.replace(/[.,]/g, ''))
  return parseFloat(num.replace(',', '.'))
}

const salaryCache = new Map()

/**
 * Salario anual mínimo aproximado en euros, o null si no se indica o no se puede interpretar.
 * Entiende rangos ("$80k - $120k", "4.086 - 5.221 EUR/mes"), "Desde", "Hasta", periodos
 * (mensual, por hora) y varias monedas. Si solo hay máximo ("Hasta X"), se usa ese valor.
 */
export function salaryToAnnualEUR(salary) {
  if (!salary) return null
  if (salaryCache.has(salary)) return salaryCache.get(salary)
  const s = salary.toLowerCase()
  let result = null

  const currency = detectCurrency(s)
  // Pagos por tarea o proyecto: no son comparables con un salario
  if (currency && !/per task|por tarea|per project|por proyecto/.test(s)) {
    const amounts = [...s.matchAll(/(\d+(?:[.,]\d+)*)\s?(k)?(?![\d.,])/g)]
      .map((m) => parseAmount(m[1], Boolean(m[2])))
      .filter((n) => n >= 10) // descarta números sueltos ("+ 2 bonus")
    if (amounts.length) {
      let value = /^hasta/.test(s) ? Math.max(...amounts) : amounts[0]
      if (/\/\s?mes|month|monthly|mensual|\/mo\b|per month/.test(s)) value *= 12
      else if (/hour|hora|\/h\b|\/hr|hourly/.test(s)) value *= 1800
      const eur = value * (EUR_RATE[currency] ?? 1)
      // Valores fuera de rango = interpretación dudosa: mejor no filtrar con ellos
      result = eur >= 3000 && eur <= 1_000_000 ? Math.round(eur) : null
    }
  }

  salaryCache.set(salary, result)
  return result
}

// ===== Antigüedad =====

/** Días desde la publicación (0 = hoy), o null si no hay fecha. */
export function ageInDays(date) {
  if (!date) return null
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}
