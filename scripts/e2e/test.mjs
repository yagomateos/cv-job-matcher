/**
 * Pruebas e2e en un Chrome real (sin interfaz). Termina con código 1 si algo falla.
 *   npm run test:e2e                          (contra http://localhost:5173, con `npm run dev`)
 *   BASE_URL=https://... npm run test:e2e     (contra otra URL, p. ej. producción)
 *
 * Cubre: coherencia de números del mapa por país, "Skills que más te piden", "Mis ofertas"
 * (guardar, estado, persistencia, quitar), filtros de nivel / salario / fecha y móvil
 * sin scroll horizontal.
 */
import { MOBILE, launch, loadResults, makeChecker, seed, sleep } from './helpers.mjs'

const { check, summary } = makeChecker()
const { browser, page, errors } = await launch()
await seed(page)
await loadResults(page)
const total = () => page.$eval('.results__title', (e) => Number(e.innerText.match(/^\d+/)[0]))

// ===== 1) Mapa: burbuja = franja = selector de países = resultados = paginación =====
const bubbles = await page.$$eval('g.map__bubble', (els) =>
  els.map((g) => {
    const m = g.getAttribute('aria-label').match(/^(.*): (\d+) ofertas?/)
    return { name: m[1], count: Number(m[2]) }
  }),
)
const mismatches = []
for (const b of bubbles) {
  await page.evaluate((name) => {
    const g = [...document.querySelectorAll('g.map__bubble')].find((el) => el.getAttribute('aria-label').startsWith(name + ':'))
    g.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, b.name)
  await sleep(200)
  const r = await page.evaluate(() => {
    const sel = document.querySelector('#country')
    const info = document.querySelector('.pagination__info')?.innerText
    return {
      franja: Number(document.querySelector('.map-selection__text span')?.innerText.match(/(\d+) ofertas?/)?.[1]),
      resultados: Number(document.querySelector('.results__title')?.innerText.match(/^(\d+)/)?.[1]),
      selector: Number(sel?.options[sel.selectedIndex]?.text.match(/\((\d+)\)$/)?.[1]),
      paginacion: info ? Number(info.match(/de (\d+)/)?.[1]) : null,
    }
  })
  const values = [r.franja, r.resultados, r.selector, ...(r.paginacion ? [r.paginacion] : [])]
  if (!values.every((v) => v === b.count)) mismatches.push(`${b.name}: burbuja ${b.count} ${JSON.stringify(r)}`)
  await page.evaluate(() => document.querySelector('.map-selection .btn')?.click())
  await sleep(120)
}
check(`Mapa coherente en ${bubbles.length} países`, bubbles.length > 0 && mismatches.length === 0, mismatches.slice(0, 3).join(' | '))

// ===== 2) Skills que más te piden =====
const gapSkills = await page.$$eval('.skill-gaps__skill', (els) => els.map((e) => e.innerText))
check('Bloque de skills con datos', gapSkills.length > 0, gapSkills.slice(0, 4).join(', '))
check('Sin skills genéricas ni "ai"', !gapSkills.some((s) => ['git', 'rest', 'api', 'agile', 'jira', 'figma', 'ai'].includes(s)))
check('No sugiere skills que ya tienes', !gapSkills.some((s) => ['react', 'javascript', 'typescript'].includes(s)))

// ===== 3) Mis ofertas =====
const titles = await page.$$eval('.job-card .job-card__title', (els) => els.slice(0, 2).map((e) => e.innerText))
const saveBtns = await page.$$('.job-card .save-btn')
await saveBtns[0].click()
await saveBtns[1].click()
await sleep(150)
check('Contador "Mis ofertas" = 2', (await page.$eval('.view-tab:nth-child(2) .view-tab__count', (e) => e.innerText)) === '2')
await page.click('.view-tab:nth-child(2)')
await sleep(150)
const savedTitles = await page.$$eval('.saved-item__title', (els) => els.map((e) => e.innerText))
check('Lista las ofertas guardadas', titles.every((t) => savedTitles.includes(t)))
await (await page.$('.saved-item__status')).select('applied')
await loadResults(page)
await page.click('.view-tab:nth-child(2)')
await sleep(150)
const statuses = await page.$$eval('.saved-item__status', (els) => els.map((e) => e.value))
check('Se conservan tras recargar, con su estado', statuses.length === 2 && statuses.includes('applied'), statuses.join(','))
await page.click('.saved-item .btn--icon')
await sleep(150)
check('Quitar una oferta', (await page.$$('.saved-item')).length === 1)
await page.click('.view-tab:nth-child(1)')
await sleep(150)

// ===== 4) Filtros: nivel, salario y fecha =====
const seniorOpt = await page.$eval('#seniority', (s) => [...s.options].find((o) => o.value === 'senior').text)
await page.select('#seniority', 'senior')
await sleep(200)
const seniorTotal = await total()
check('Nivel Senior: resultados = contador del selector', seniorOpt.includes(`(${seniorTotal})`), `${seniorOpt} -> ${seniorTotal}`)
const levels = await page.$$eval('.job-card__level', (els) => [...new Set(els.map((e) => e.innerText))])
check('Todas las tarjetas son Senior', levels.length === 1 && levels[0] === 'Senior', levels.join(','))
await page.select('#seniority', 'all')

await page.select('#salary', '40000')
await page.click('.toggle--compact input')
await sleep(200)
const withSalary = await page.$$eval('.job-card__salary', (els) => els.length)
const cards = await page.$$eval('.job-card', (els) => els.length)
check('Salario mínimo sin "sin salario": todas indican salario', withSalary === cards, `${withSalary}/${cards}`)
await page.click('.toggle--compact input')
await page.select('#salary', '0')

await page.select('#age', '7')
await sleep(200)
const days = await page.$$eval('.job-card__meta li', (els) =>
  els.map((e) => e.innerText).filter((t) => /Hace \d+d|Hoy/.test(t)).map((t) => (t.includes('Hoy') ? 0 : Number(t.match(/Hace (\d+)d/)[1]))),
)
check('Última semana: nada de más de 7 días', Math.max(0, ...days) <= 7, `máximo ${Math.max(0, ...days)} días`)
await page.select('#age', '0')

// ===== 5) Móvil =====
await page.emulate(MOBILE)
await loadResults(page)
check('Móvil sin scroll horizontal', (await page.evaluate(() => document.documentElement.scrollWidth)) === 390)
const mapBox = await (await page.$('.map')).boundingBox()
check('Mapa en móvil con tamaño útil (≥ 200 px de alto)', mapBox.height >= 200, `${Math.round(mapBox.width)}×${Math.round(mapBox.height)}`)

check('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 2).join(' | '))
await browser.close()
process.exit(summary() ? 1 : 0)
