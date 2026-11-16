// Usamos la build "legacy" de pdf.js: la build moderna de pdfjs-dist v6 usa APIs muy
// recientes (Map.getOrInsertComputed, Math.sumPrecise...) que muchos navegadores aún no
// soportan y hacen fallar la lectura del PDF. La legacy incluye los polyfills necesarios.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { findCity, parseLocation } from './geoService'

// pdf.js procesa el PDF en un Web Worker; Vite nos da la URL del worker empaquetado
GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Diccionario de skills por área. Se buscan en el CV y en las ofertas.
 * Para añadir una skill: ponla (en minúsculas) en el área que corresponda.
 * Si tiene otras formas de escribirse, añádelas en SKILL_ALIASES.
 */
export const SKILL_GROUPS = {
  web: [
    'react', 'javascript', 'typescript', 'next.js', 'redux', 'vue', 'angular', 'html', 'css',
    'sass', 'tailwind', 'webpack', 'vite', 'jest', 'cypress',
  ],
  backend: [
    'node.js', 'express', 'nestjs', 'graphql', 'python', 'java', 'c#', 'c++', 'golang', 'rust',
    'php', 'ruby', 'scala', 'django', 'flask', 'fastapi', 'spring boot', '.net', 'laravel',
    'ruby on rails', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'prisma',
    'microservices',
  ],
  mobile: ['react native', 'flutter', 'android', 'ios', 'swift', 'kotlin', 'swiftui'],
  ai: [
    'ai', 'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'keras', 'scikit-learn',
    'pandas', 'numpy', 'nlp', 'computer vision', 'llm', 'langchain', 'openai', 'hugging face',
    'rag', 'generative ai', 'mlops', 'prompt engineering',
  ],
  data: [
    'sql', 'spark', 'airflow', 'dbt', 'snowflake', 'databricks', 'bigquery', 'power bi',
    'tableau', 'looker', 'etl', 'kafka', 'hadoop', 'data warehouse',
  ],
  cloud: [
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'ci/cd', 'jenkins',
    'github actions', 'linux', 'bash', 'prometheus', 'grafana', 'serverless', 'firebase',
  ],
  qa: ['qa', 'test automation', 'selenium', 'playwright', 'appium'],
  security: ['cybersecurity', 'pentesting', 'siem', 'owasp', 'iso 27001', 'firewall'],
  it: [
    'helpdesk', 'active directory', 'windows server', 'networking', 'cisco', 'itil', 'vmware',
    'powershell',
  ],
  // Genéricas: cuentan para el % de match, pero NO para decidir si un CV es tecnológico
  // (aparecen también en CVs de otros sectores: "gestión con Jira y metodología agile")
  general: ['git', 'rest', 'api', 'agile', 'jira', 'figma'],
}

// Lista plana de todas las skills
export const SKILLS = Object.values(SKILL_GROUPS).flat()

const GENERIC_SKILLS = new Set(SKILL_GROUPS.general)

/**
 * Variantes de escritura: si aparece cualquiera de ellas, cuenta como la skill (la clave).
 * Incluye equivalentes en castellano.
 */
export const SKILL_ALIASES = {
  javascript: ['js', 'es6'],
  'next.js': ['nextjs', 'next js'],
  'node.js': ['nodejs', 'node'],
  tailwind: ['tailwindcss'],
  golang: ['go lang'],
  '.net': ['dotnet', 'asp.net', '.net core'],
  'ruby on rails': ['rails'],
  'spring boot': ['spring framework'],
  microservices: ['microservicios', 'microservice'],
  postgresql: ['postgres'],
  mongodb: ['mongo'],
  ai: ['artificial intelligence', 'inteligencia artificial', 'ia'],
  'machine learning': ['aprendizaje automático', 'aprendizaje automatico', 'ml'],
  'deep learning': ['aprendizaje profundo', 'redes neuronales', 'neural networks'],
  'scikit-learn': ['sklearn', 'scikit learn'],
  nlp: ['natural language processing', 'procesamiento del lenguaje natural', 'pln'],
  'computer vision': ['visión artificial', 'vision artificial', 'visión por computador'],
  llm: ['llms', 'large language model', 'large language models', 'gpt'],
  'hugging face': ['huggingface', 'transformers'],
  rag: ['retrieval augmented generation', 'retrieval-augmented generation'],
  'generative ai': ['genai', 'gen ai', 'ia generativa'],
  spark: ['pyspark', 'apache spark'],
  airflow: ['apache airflow'],
  'power bi': ['powerbi'],
  etl: ['elt'],
  kafka: ['apache kafka'],
  'data warehouse': ['data warehousing', 'almacén de datos'],
  kubernetes: ['k8s'],
  gcp: ['google cloud'],
  'ci/cd': ['cicd', 'ci cd', 'continuous integration', 'integración continua'],
  bash: ['shell scripting'],
  qa: ['quality assurance', 'control de calidad'],
  'test automation': ['automated testing', 'automatización de pruebas', 'pruebas automatizadas', 'testing automatizado'],
  cybersecurity: ['ciberseguridad', 'cyber security', 'seguridad informática', 'infosec', 'information security'],
  pentesting: ['penetration testing', 'pentest', 'pentester', 'ethical hacking', 'hacking ético'],
  helpdesk: ['help desk', 'service desk', 'soporte técnico', 'soporte it', 'it support', 'soporte informático', 'mesa de ayuda'],
  // Ojo: no usar "redes" a secas, que coincide con "redes sociales" en CVs de marketing
  networking: ['redes informáticas', 'redes de datos', 'administración de redes', 'tcp/ip', 'ccna', 'lan/wan'],
  rest: ['restful'],
  api: ['apis'],
  agile: ['scrum', 'kanban'],
}

// ===== Perfiles (roles) =====

/** Perfiles que se pueden detectar en el CV (clave -> etiqueta visible). */
export const ROLE_LABELS = {
  frontend: 'Frontend',
  backend: 'Backend',
  fullstack: 'Full Stack',
  mobile: 'Móvil',
  ai: 'IA / Machine Learning',
  data: 'Datos',
  devops: 'DevOps / Cloud',
  qa: 'QA / Testing',
  security: 'Ciberseguridad',
  it: 'Sistemas / Soporte IT',
}

/**
 * Cómo se reconoce cada perfil:
 * - title: puestos que suelen aparecer en el CV (en inglés y castellano). Pesan más.
 * - skills: áreas del diccionario cuyas skills suman puntos para ese perfil.
 */
const ROLE_SIGNALS = {
  frontend: { title: /front[\s-]?end/gi, skills: ['web'] },
  backend: { title: /back[\s-]?end/gi, skills: ['backend'] },
  fullstack: { title: /full[\s-]?stack/gi, skills: [] }, // se decide aparte (front + back)
  mobile: { title: /mobile developer|desarrollador[a]? m[óo]vil|android developer|ios developer|flutter developer/gi, skills: ['mobile'] },
  ai: {
    title: /machine learning|\b(ai|ia|ml|llm)\s+(engineer|developer|specialist|ingenier|desarrollador)|inteligencia artificial|artificial intelligence|data scientist|cient[íi]fic[oa] de datos|deep learning|mlops/gi,
    skills: ['ai'],
  },
  data: {
    title: /data engineer|ingenier[oa] de datos|data analyst|analista de datos|business intelligence|big data|analytics engineer/gi,
    skills: ['data'],
  },
  devops: {
    title: /devops|\bsre\b|site reliability|cloud engineer|platform engineer|ingenier[oa] cloud|arquitect[oa] cloud/gi,
    skills: ['cloud'],
  },
  qa: { title: /\bqa\b|tester|quality assurance|test engineer|sdet|ingenier[oa] de pruebas/gi, skills: ['qa'] },
  security: {
    title: /ciberseguridad|cybersecurity|security engineer|security analyst|analista de seguridad|pentester|\bsoc\b analyst/gi,
    skills: ['security'],
  },
  it: {
    title: /sysadmin|system administrator|administrador de sistemas|t[ée]cnico (inform[áa]tico|de sistemas|de soporte|it)|help ?desk|service desk|it support|soporte (t[ée]cnico|it|inform[áa]tico)|network (engineer|administrator)|t[ée]cnico de redes/gi,
    skills: ['it'],
  },
}

// Palabras que indican un CV del sector tecnológico aunque tenga pocas skills
const TECH_CV_WORDS = /developer|desarrollador|programador|programmer|software|engineer|ingenier[oa] (inform[áa]tic|de software|de sistemas|de datos)|inform[áa]tic[oa]|computer science|ingenier[íi]a inform[áa]tica|sistemas inform[áa]ticos|\bdam\b|\bdaw\b|\basir\b/i

// Escapa caracteres especiales (p. ej. el "." de "next.js" o el "#" de "c#") para un RegExp
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Construye una regex por skill con "word boundaries" propios.
 * No usamos \b porque falla con skills que contienen símbolos (next.js, c#, ci/cd, .net).
 * - Antes: no puede haber letra, número ni "." (evita "interest" -> "rest" y "vue.js" -> "js").
 * - Después: no puede haber letra (evita "vuex" -> "vue", "javascript" -> "java"),
 *   pero sí número ("html5", "css3").
 */
const SKILL_PATTERNS = SKILLS.map((skill) => {
  const variants = [skill, ...(SKILL_ALIASES[skill] || [])].map(escapeRegex)
  return {
    skill,
    regex: new RegExp(`(?<![a-z0-9.áéíóúñ])(?:${variants.join('|')})(?![a-záéíóúñ])`, 'i'),
  }
})

/**
 * Extrae el texto de todas las páginas de un PDF.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = getDocument({ data })

  try {
    const pdf = await loadingTask.promise
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // Unimos los fragmentos de texto respetando los saltos de línea del PDF
      const text = content.items
        .map((item) => (item.str || '') + (item.hasEOL ? '\n' : ' '))
        .join('')
      pages.push(text)
    }
    return pages.join('\n')
  } finally {
    // Liberamos memoria y el worker. En pdfjs-dist v6 destroy() está en la
    // tarea de carga (loadingTask), no en el documento.
    await loadingTask.destroy()
  }
}

/**
 * Detecta las skills del diccionario presentes en un texto.
 * @param {string} text
 * @returns {string[]} skills en minúsculas, sin duplicados
 */
export function extractSkills(text) {
  if (!text) return []
  return SKILL_PATTERNS.filter(({ regex }) => regex.test(text)).map(({ skill }) => skill)
}

/**
 * Skills que pide una oferta (busca en título + tags + descripción).
 * Es la parte costosa del matching: conviene calcularla una vez por oferta y guardarla
 * en job.skills (lo hace useJobs), porque calculateMatch la reutiliza si existe.
 */
export function extractJobSkills(job) {
  return extractSkills([job.title, (job.tags || []).join(' '), job.description].join(' '))
}

/** Cuántas skills del CV pertenecen a cada área del diccionario. */
function countByGroup(cvSkills) {
  const set = new Set(cvSkills)
  return Object.fromEntries(
    Object.entries(SKILL_GROUPS).map(([group, list]) => [group, list.filter((s) => set.has(s)).length]),
  )
}

/**
 * Comprueba si el CV es de un perfil tecnológico.
 * Cuenta solo las skills técnicas "de verdad" (no las genéricas como agile, jira o api).
 * - ≥3 skills técnicas → tecnológico.
 * - 2 skills técnicas + un puesto técnico en el texto (developer, ingeniero informático…) → tecnológico.
 * @returns {{ isTech: boolean, techSkills: string[] }}
 */
export function checkTechProfile(cvText = '', cvSkills = []) {
  const techSkills = cvSkills.filter((s) => !GENERIC_SKILLS.has(s))
  const hasTechTitle =
    TECH_CV_WORDS.test(cvText) || Object.values(ROLE_SIGNALS).some(({ title }) => cvText.match(title))
  const isTech = techSkills.length >= 3 || (techSkills.length >= 2 && hasTechTitle)
  return { isTech, techSkills }
}

/**
 * Deduce el perfil del candidato (una clave de ROLE_LABELS).
 * Puntuación por perfil = 3 × menciones del puesto en el CV + nº de skills de sus áreas.
 * Full Stack: si el CV dice "full stack", o si tiene mucho de frontend Y de backend.
 */
export function detectRole(cvText = '', cvSkills = []) {
  const groups = countByGroup(cvSkills)
  const titleHits = Object.fromEntries(
    Object.entries(ROLE_SIGNALS).map(([role, { title }]) => [role, (cvText.match(title) || []).length]),
  )

  const scores = Object.fromEntries(
    Object.entries(ROLE_SIGNALS).map(([role, { skills }]) => [
      role,
      titleHits[role] * 3 + skills.reduce((sum, g) => sum + (groups[g] || 0), 0),
    ]),
  )

  // Full Stack: el CV lo dice expresamente, o combina bastante frontend y backend
  const frontBack = Math.min(groups.web, groups.backend)
  scores.fullstack = titleHits.fullstack * 3 + (groups.web >= 3 && groups.backend >= 3 ? frontBack + 2 : 0)

  const [best, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  if (bestScore > 0) return best
  return 'frontend'
}

/**
 * País del candidato (código ISO, p. ej. 'ES'), o null si no se encuentra.
 * La ubicación suele estar en la cabecera del CV, junto al nombre y el contacto
 * ("Barcelona, España · email · teléfono"), así que se busca en las primeras líneas.
 * Sirve para traer más ofertas de su país.
 */
export function detectHomeCountry(cvText = '') {
  for (const line of cvText.slice(0, 800).split('\n')) {
    const { countries } = parseLocation(line)
    if (countries.length) return countries[0]
  }
  return null
}

/** Ciudad del candidato (p. ej. "Barcelona") buscada en la cabecera del CV, o null. */
export function detectHomeCity(cvText = '') {
  for (const line of cvText.slice(0, 800).split('\n')) {
    const found = findCity(line)
    if (found) return found.city
  }
  return null
}

/** Idioma del CV ('es' | 'en') contando palabras muy frecuentes de cada idioma. */
export function detectLanguage(cvText = '') {
  const es = (cvText.match(/\b(de|la|el|y|con|para|experiencia|desarrollador|años|empresa)\b/gi) || []).length
  const en = (cvText.match(/\b(the|and|with|for|of|experience|developer|years|company)\b/gi) || []).length
  return es >= en ? 'es' : 'en'
}

/**
 * Calcula el % de match entre las skills del CV y una oferta.
 * Fórmula mixta (media de dos coberturas):
 *  - cvCoverage:  skills del CV que aparecen en la oferta / total skills del CV
 *  - jobCoverage: skills que pide la oferta y tienes / skills que pide la oferta
 *    (mínimo 3 en el denominador, para que una oferta que solo menciona 1-2
 *    skills no salga al 100 %)
 * Así un CV con muchas skills no queda penalizado, y una oferta con pocas
 * skills detectadas no queda inflada.
 * @param {string[]} cvSkills
 * @param {{ title: string, tags: string[], description: string }} job
 */
export function calculateMatch(cvSkills, job) {
  const totalSkills = cvSkills.length
  const jobSkills = job.skills || extractJobSkills(job)

  if (totalSkills === 0) {
    return { score: 0, matchedSkills: [], missingSkills: jobSkills, totalSkills: 0, jobSkillsCount: jobSkills.length }
  }

  const cvSet = new Set(cvSkills)
  const matchedSkills = jobSkills.filter((skill) => cvSet.has(skill))
  const missingSkills = jobSkills.filter((skill) => !cvSet.has(skill))

  const cvCoverage = matchedSkills.length / totalSkills
  const jobCoverage = matchedSkills.length / Math.max(jobSkills.length, 3)

  return {
    score: Math.round(((cvCoverage + jobCoverage) / 2) * 100),
    matchedSkills,
    missingSkills,
    totalSkills,
    jobSkillsCount: jobSkills.length,
  }
}
