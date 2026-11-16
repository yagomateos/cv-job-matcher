/**
 * Graba un vídeo de demostración (docs/demo.mp4) recorriendo la app como lo haría una persona:
 * portada → subir CV (PDF de ejemplo generado al vuelo) → resultados → mapa → búsqueda →
 * Mis ofertas → modo claro.
 *
 *   ALLOW_ADZUNA=1 npm run video                 (contra http://localhost:5173, con `npm run dev`)
 *   BASE_URL=https://... ALLOW_ADZUNA=1 npm run video
 *
 * No necesita ffmpeg: se capturan los fotogramas con el screencast de Chrome (CDP) y se codifican
 * a MP4 (H.264) dentro del propio Chrome (WebCodecs + mp4-muxer).
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BASE_URL, DESKTOP, launch, seed, sleep } from './helpers.mjs'

const OUT = 'docs/demo.mp4'
const W = DESKTOP.viewport.width
const H = DESKTOP.viewport.height
/** Pausas más largas que esto (sin cambios en pantalla) se acortan en el vídeo. */
const MAX_GAP = 2.2

const { browser, page, errors } = await launch()

// ---------- 1. CV de ejemplo en PDF (persona ficticia) ----------
const tmp = mkdtempSync(join(tmpdir(), 'cvjm-video-'))
const pdfPath = join(tmp, 'CV-Laura-Ejemplo.pdf')
{
  const p = await browser.newPage()
  await p.setContent(`<html><body style="font-family:Arial;padding:40px;line-height:1.5">
    <h1>Laura Ejemplo</h1>
    <p>Frontend Developer · Barcelona, España · laura@example.com</p>
    <h2>Experiencia</h2>
    <p><b>Senior Frontend Developer</b> — Empresa Demo (2021–actualidad)<br>
    Desarrollo de aplicaciones con React, TypeScript, Next.js y Redux. Tests con Jest y Cypress.
    Maquetación con HTML, CSS, Sass y Tailwind. Integración con APIs REST y GraphQL.</p>
    <p><b>Frontend Developer</b> — Otra Empresa (2018–2021)<br>
    JavaScript, Vue, Node.js, Express, Docker y Git. Metodologías Agile / Scrum.</p>
    <h2>Skills</h2>
    <p>React, TypeScript, JavaScript, Next.js, Redux, Vite, Jest, Cypress, HTML, CSS, Tailwind,
    Node.js, GraphQL, Docker, Git, Figma, Accesibilidad (WCAG)</p>
  </body></html>`)
  await p.pdf({ path: pdfPath, format: 'A4' })
  await p.close()
}

// ---------- 2. Cursor y subtítulos superpuestos (Chrome sin interfaz no dibuja el ratón) ----------
await page.evaluateOnNewDocument(() => {
  const install = () => {
    if (document.getElementById('__demo-cursor')) return
    const style = document.createElement('style')
    style.textContent = `
      #__demo-cursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;
        pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
      #__demo-ripple{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
        border:3px solid #818cf8;z-index:2147483646;pointer-events:none;opacity:0}
      #__demo-ripple.on{animation:__rip .45s ease-out}
      @keyframes __rip{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(1.4)}}
      #__demo-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483645;
        pointer-events:none;max-width:86vw;padding:12px 22px;border-radius:14px;
        background:rgba(15,15,20,.88);color:#fff;font:600 19px/1.35 Inter,system-ui,sans-serif;
        box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid rgba(129,140,248,.55);
        text-align:center;transition:opacity .25s;opacity:0}
      #__demo-caption small{display:block;font-weight:500;font-size:15px;opacity:.8;margin-top:2px}
      .alert--warning{display:none!important}`
    document.head.appendChild(style)
    const cursor = document.createElement('div')
    cursor.id = '__demo-cursor'
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    const ripple = document.createElement('div')
    ripple.id = '__demo-ripple'
    const caption = document.createElement('div')
    caption.id = '__demo-caption'
    document.body.append(cursor, ripple, caption)
    const pos = window.__demoPos || { x: -100, y: -100 }
    cursor.style.transform = `translate(${pos.x - 3}px,${pos.y - 2}px)`
    window.addEventListener('mousemove', (e) => {
      window.__demoPos = { x: e.clientX, y: e.clientY }
      cursor.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`
    }, true)
    window.addEventListener('mousedown', (e) => {
      ripple.style.left = e.clientX + 'px'
      ripple.style.top = e.clientY + 'px'
      ripple.classList.remove('on')
      void ripple.offsetWidth
      ripple.classList.add('on')
    }, true)
    window.__caption = (html) => {
      caption.innerHTML = html || ''
      caption.style.opacity = html ? '1' : '0'
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})

let mouse = { x: W / 2, y: H / 2 }
/** Mueve el ratón suavemente hasta (x, y). */
async function glide(x, y, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16))
  const from = { ...mouse }
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
    await sleep(16)
  }
  mouse = { x, y }
}
async function glideTo(handleOrSelector, ms) {
  const h = typeof handleOrSelector === 'string' ? await page.$(handleOrSelector) : handleOrSelector
  if (!h) return null
  const b = await h.boundingBox()
  if (!b) return null
  await glide(b.x + b.width / 2, b.y + b.height / 2, ms)
  return h
}
async function clickOn(handleOrSelector, ms) {
  const h = await glideTo(handleOrSelector, ms)
  if (!h) return false
  await sleep(150)
  await page.mouse.down()
  await sleep(80)
  await page.mouse.up()
  return true
}
const caption = (title, sub = '') =>
  page.evaluate((html) => window.__caption?.(html), title ? `${title}${sub ? `<small>${sub}</small>` : ''}` : '')
/** Desplaza la página suavemente hasta dejar el elemento a `offset` px del borde superior. */
async function scrollToEl(selector, offset = 80, ms = 900) {
  await page.evaluate(
    async (sel, off, dur) => {
      const el = document.querySelector(sel)
      if (!el) return
      const start = window.scrollY
      const end = Math.max(0, start + el.getBoundingClientRect().top - off)
      const t0 = performance.now()
      await new Promise((resolve) => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / dur)
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
          window.scrollTo(0, start + (end - start) * e)
          if (t < 1) setTimeout(step, 16)
          else resolve()
        }
        step()
      })
    },
    selector,
    offset,
    ms,
  )
}

// ---------- 3. Grabación ----------
await seed(page, { cv: null })
await page.reload({ waitUntil: 'networkidle2' })
await page.mouse.move(mouse.x, mouse.y)

const cdp = await page.createCDPSession()
const frames = []
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, t: metadata.timestamp })
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await sleep(300)

// Portada
await caption('CV Job Matcher', 'Ofertas tech de todo el mundo ordenadas por lo bien que encajan con tu CV')
await sleep(2600)
await scrollToEl('.home-section', 60, 1400)
await sleep(1600)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
await sleep(900)

// Subir el CV
await caption('1 · Arrastra o elige tu CV en PDF', 'Se lee en tu navegador: el archivo no sale de tu ordenador')
await glideTo('.dropzone', 900)
await sleep(1200)
const input = await page.$('input[type="file"]')
await page.mouse.down()
await page.mouse.up()
await input.uploadFile(pdfPath)
const fastFrom = Date.now() / 1000

// Carga de ofertas
await caption('2 · Detecta tu perfil, tus skills y tu ciudad', 'y busca en 14 fuentes de empleo a la vez')
await page.waitForSelector('.job-card', { timeout: 60000 })
await glide(W - 200, 200, 600)
await page.waitForFunction(() => !document.querySelector('.progress-line'), { timeout: 60000 }).catch(() => {})
const fastTo = Date.now() / 1000
await sleep(1500)

// Tarjetas
await caption('3 · Cada oferta con su % de match', 'Verde: skills que tienes · gris: las que te faltan')
await scrollToEl('.jobs-grid', 90, 1200)
const firstCard = await page.$('.job-card')
await glideTo(firstCard, 800)
await sleep(2400)

// Mapa
await caption('4 · Mapa mundial de ofertas', 'Pasa el ratón por un país para ver sus ofertas')
await scrollToEl('.map-card', 70, 1200)
await sleep(500)
const spain = await page.$('g.map__bubble[aria-label^="España"] circle')
if (spain) {
  await glideTo(spain, 1000)
  await sleep(2600)
  await caption('Pulsa un país para filtrar', 'Los números del mapa y de la lista coinciden siempre')
  await clickOn(spain, 200)
  await sleep(1800)
  await glide(W - 120, H - 140, 600)
  await scrollToEl('.jobs-grid', 90, 1100)
  await sleep(2000)
  await scrollToEl('.map-card', 70, 900)
  await clickOn('.map-selection .btn', 700)
  await sleep(1000)
}

// Búsqueda y orden
await caption('5 · Busca y ordena', 'Por puesto, empresa, tecnología o ciudad')
await scrollToEl('.searchbar', 90, 900)
await clickOn('.searchbar input', 700)
await page.keyboard.type('react', { delay: 140 })
await sleep(1600)
await clickOn('.searchbar__sort select', 700)
await page.select('.searchbar__sort select', 'recent')
await sleep(1600)
await page.focus('.searchbar input')
await page.keyboard.down('Control')
await page.keyboard.press('KeyA')
await page.keyboard.up('Control')
await page.keyboard.press('Backspace')
await page.select('.searchbar__sort select', 'match')
await sleep(600)

// Mis ofertas
await caption('6 · Guarda ofertas y sigue tus candidaturas')
await scrollToEl('.jobs-grid', 90, 900)
const saveBtns = await page.$$('.job-card .save-btn')
for (const btn of saveBtns.slice(0, 2)) {
  await clickOn(btn, 600)
  await sleep(500)
}
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
await sleep(900)
await clickOn('.view-tab:nth-child(2)', 800)
await sleep(1000)
const status = await page.$('.saved-item__status')
if (status) {
  await clickOn(status, 700)
  await page.select('.saved-item__status', 'interview')
  await sleep(1800)
}
await clickOn('.view-tab:nth-child(1)', 800)
await sleep(800)

// Tema
await caption('7 · Modo claro y oscuro')
await clickOn('.topbar__actions .btn--icon', 900)
await sleep(2200)
await clickOn('.topbar__actions .btn--icon', 500)
await sleep(1200)
await caption('CV Job Matcher', 'frontend-jobs-app-psi.vercel.app')
await glide(W / 2, H / 2 - 120, 700)
await sleep(2600)

await cdp.send('Page.stopScreencast')
console.log(`Fotogramas capturados: ${frames.length}`)
if (errors.length) console.log('Errores de JavaScript:', errors)

// ---------- 4. Codificación a MP4 (H.264) dentro de Chrome ----------
// Tiempos del vídeo: los reales, acortando las pausas largas sin cambios y acelerando (x4) la
// espera mientras llegan las ofertas.
const times = []
let acc = 0
frames.forEach((f, i) => {
  if (i > 0) {
    const inFast = f.t > fastFrom && f.t < fastTo
    acc += Math.min(MAX_GAP, (f.t - frames[i - 1].t) / (inFast ? 4 : 1))
  }
  times.push(acc)
})
const total = acc + 1
const FPS = 30

// WebCodecs (VideoEncoder) + mp4-muxer: MP4 "normal" (no fragmentado) con moov al principio,
// que es lo que aceptan WhatsApp, Telegram, Slack, etc. Se codifica a 30 fps constantes.
const enc = await browser.newPage()
// WebCodecs solo existe en contextos seguros (localhost / https), no en about:blank
await enc.goto(new URL('favicon.svg', BASE_URL).href).catch(() => enc.goto(BASE_URL))
// El SVG no tiene <head>: se evalúa la librería (UMD, define window.Mp4Muxer) directamente
await enc.evaluate(readFileSync('node_modules/mp4-muxer/build/mp4-muxer.js', 'utf8'))
await enc.exposeFunction('__frame', (i) => frames[i].data)
const b64 = await enc.evaluate(
  async (times, total, W, H, FPS) => {
    const { Muxer, ArrayBufferTarget } = window.Mp4Muxer
    const config = { codec: 'avc1.640028', width: W, height: H, bitrate: 1_500_000, framerate: FPS }
    if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('H.264 no soportado')
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: FPS },
      fastStart: 'in-memory',
    })
    let failure = null
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => (failure = e),
    })
    encoder.configure(config)
    const canvas = new OffscreenCanvas(W, H)
    const ctx = canvas.getContext('2d')
    const load = async (i) => {
      const img = new Image()
      img.src = 'data:image/jpeg;base64,' + (await window.__frame(i))
      await img.decode()
      return img
    }
    let idx = -1
    const n = Math.ceil(total * FPS)
    for (let k = 0; k < n; k++) {
      const t = k / FPS
      let j = idx
      while (j + 1 < times.length && times[j + 1] <= t) j++
      if (j !== idx) {
        ctx.drawImage(await load(j), 0, 0, W, H)
        idx = j
      }
      const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / FPS) })
      encoder.encode(frame, { keyFrame: k % (FPS * 2) === 0 })
      frame.close()
      if (encoder.encodeQueueSize > 10) await new Promise((r) => setTimeout(r, 5))
      if (failure) throw failure
    }
    await encoder.flush()
    muxer.finalize()
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' })
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result.split(',')[1])
      fr.readAsDataURL(blob)
    })
  },
  times,
  total,
  W,
  H,
  FPS,
)
mkdirSync('docs', { recursive: true })
writeFileSync(OUT, Buffer.from(b64, 'base64'))
console.log(`Vídeo: ${OUT} (${(readFileSync(OUT).length / 1e6).toFixed(1)} MB, ~${Math.round(total)} s)`)
await browser.close()
