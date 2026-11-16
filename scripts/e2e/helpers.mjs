/**
 * Utilidades comunes de los scripts de navegador (pruebas e2e y capturas).
 * Usan puppeteer-core con el Chrome instalado (no descargan navegador).
 *
 * Variables de entorno:
 *   BASE_URL      URL de la app (por defecto http://localhost:5173/; arranca antes `npm run dev`)
 *   CHROME_PATH   ruta a Chrome/Edge si no está en la ubicación habitual
 *   ALLOW_ADZUNA  "1" para no bloquear Adzuna (por defecto se bloquea para no gastar cuota)
 */
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

export const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

/** CV de ejemplo (perfil Frontend en Barcelona), como si ya se hubiera subido. */
export const SAMPLE_CV = {
  cvSkills: ['react', 'javascript', 'typescript', 'next.js', 'redux', 'html', 'css', 'tailwind', 'vite', 'jest', 'node.js', 'express', 'docker', 'git', 'rest', 'api', 'agile', 'mongodb', 'postgresql', 'mysql'],
  fileName: 'CV-ejemplo.pdf',
  role: 'frontend',
  language: 'es',
  homeCountry: 'ES',
  homeCity: 'Barcelona',
}

export const MOBILE = {
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

export const DESKTOP = {
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Abre Chrome sin interfaz con un perfil temporal vacío (nunca el del usuario). */
export async function launch() {
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) throw new Error('No se encontró Chrome/Edge. Indica la ruta con CHROME_PATH.')
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    userDataDir: mkdtempSync(join(tmpdir(), 'cvjm-e2e-')),
    args: ['--no-first-run', '--no-default-browser-check'],
  })
  const page = await browser.newPage()
  await page.emulate(DESKTOP)
  if (process.env.ALLOW_ADZUNA !== '1') {
    await page.setRequestInterception(true)
    page.on('request', (r) => (r.url().includes('/proxy/adzuna') ? r.abort() : r.continue()))
  }
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { browser, page, errors }
}

/** Deja el navegador con el CV de ejemplo cargado (o sin CV) y el tema indicado. */
export async function seed(page, { cv = SAMPLE_CV, theme = 'dark' } = {}) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' })
  await page.evaluate(
    (cvData, t) => {
      localStorage.clear()
      localStorage.setItem('cv-job-matcher:theme', t)
      if (cvData) localStorage.setItem('cv-job-matcher:cv', JSON.stringify(cvData))
    },
    cv,
    theme,
  )
}

/** Recarga y espera a que haya resultados y a que terminen de responder las fuentes. */
export async function loadResults(page) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.job-card', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.progress-line'), { timeout: 60000 }).catch(() => {})
  await sleep(500)
}

/** Imprime una comprobación y acumula el resultado. */
export function makeChecker() {
  const results = []
  const check = (label, ok, detail = '') => {
    results.push(ok)
    console.log(`${ok ? 'OK   ' : 'FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  }
  const summary = () => {
    const failed = results.filter((r) => !r).length
    console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`)
    return failed
  }
  return { check, summary }
}

/** Asegura el tema (oscuro / claro) pulsando el botón sol/luna de la app si hace falta. */
export async function ensureTheme(page, theme) {
  const current = await page.evaluate(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  if (current !== theme) {
    await page.click('.topbar__actions .btn--icon')
    // Quita el foco del botón para que no salga resaltado en la captura
    await page.evaluate(() => document.activeElement?.blur())
    await sleep(300)
  }
}

/** Pasa el ratón por el centro de un elemento (en dos pasos, para que se disparen los eventos). */
export async function hoverCenter(page, handle) {
  const b = await handle.boundingBox()
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.mouse.move(x - 6, y - 6)
  await page.mouse.move(x, y, { steps: 4 })
}
