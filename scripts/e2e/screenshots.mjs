/**
 * Genera las capturas del README en docs/screenshots/.
 *   npm run screenshots                          (contra http://localhost:5173, con `npm run dev`)
 *   BASE_URL=https://... npm run screenshots     (contra otra URL, p. ej. producción)
 *
 * Recomendado con ALLOW_ADZUNA=1 para que no salga el aviso de "fuente bloqueada".
 * Las peticiones a Adzuna se cachean 30 min en la pestaña: las capturas reutilizan la caché.
 */
import { mkdirSync } from 'node:fs'
import { DESKTOP, MOBILE, ensureTheme, hoverCenter, launch, loadResults, seed, sleep } from './helpers.mjs'

const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

const { browser, page, errors } = await launch()
const shot = async (name, options = {}) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...options })
  console.log(`  ${OUT}/${name}.png`)
}
const hideWarnings = () =>
  page.addStyleTag({ content: '.alert--warning{display:none!important}' }).catch(() => {})

// ===== Escritorio =====
await page.emulate(DESKTOP)

// Portada (sin CV)
await seed(page, { cv: null })
await page.reload({ waitUntil: 'networkidle2' })
await shot('portada-escritorio')

// Resultados (modo oscuro)
await seed(page)
await loadResults(page)
await hideWarnings()
await shot('resultados-escritorio')

// Mapa con la ventana de ofertas de un país (ratón sobre la burbuja de España)
const map = await page.$('.map-card')
await map.scrollIntoView()
await sleep(300)
const spain = await page.$('g.map__bubble[aria-label^="España"] circle')
if (spain) {
  await hoverCenter(page, spain)
  // Espera a que acabe la animación de entrada de la ventana (0,12 s) con margen
  await page.waitForSelector('.map-peek', { timeout: 3000 }).catch(() => {})
  await sleep(800)
}
// Recorte de la página (no element.screenshot, que hace scroll y reinicia el hover)
const mapBox = await map.boundingBox()
// captureBeyondViewport: false -> no redimensiona la ventana (eso dispararía un "mouseleave"
// en el mapa y cerraría la ventana de ofertas justo antes de la captura)
await page.screenshot({ path: `${OUT}/mapa-hover.png`, clip: mapBox, captureBeyondViewport: false })
console.log(`  ${OUT}/mapa-hover.png`)
await page.mouse.move(5, 5)

// Tarjetas de oferta + bloque "Skills que más te piden"
const grid = await page.$('.jobs-grid')
await grid.scrollIntoView()
await page.evaluate(() => window.scrollBy(0, -16))
await sleep(300)
await shot('tarjetas-escritorio')

// Mis ofertas (guardamos 3 y cambiamos estados)
const saveBtns = await page.$$('.job-card .save-btn')
for (const btn of saveBtns.slice(0, 3)) await btn.click()
await page.click('.view-tab:nth-child(2)')
await sleep(300)
const selects = await page.$$('.saved-item__status')
if (selects[0]) await selects[0].select('interview')
if (selects[1]) await selects[1].select('applied')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(300)
await hideWarnings()
await shot('mis-ofertas-escritorio')
await page.click('.view-tab:nth-child(1)')

// Modo claro
await ensureTheme(page, 'light')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(300)
await hideWarnings()
await shot('resultados-claro')

// ===== Móvil =====
await page.emulate(MOBILE)
await loadResults(page)
await ensureTheme(page, 'dark')
await hideWarnings()
await shot('movil-resultados')

const mobileMap = await page.$('.map-card')
await mobileMap.scrollIntoView()
const spainMobile = await page.$('g.map__bubble[aria-label^="España"] circle')
if (spainMobile) {
  const b = await spainMobile.boundingBox()
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  await sleep(700)
}
await mobileMap.screenshot({ path: `${OUT}/movil-mapa.png` })
console.log(`  ${OUT}/movil-mapa.png`)

// Portada en móvil
await seed(page, { cv: null })
await page.reload({ waitUntil: 'networkidle2' })
await shot('movil-portada')

if (errors.length) console.log('Errores de JavaScript:', errors)
await browser.close()
