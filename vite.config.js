import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Proxy local para las fuentes de empleo que no se pueden pedir directamente desde
 * el navegador. El servidor de Vite hace la petición por nosotros:
 *   /proxy/himalayas/...     -> https://himalayas.app/...          (sin CORS)
 *   /proxy/workingnomads/... -> https://www.workingnomads.com/...  (sin CORS)
 *   /proxy/tecnoempleo/...   -> https://www.tecnoempleo.com/...    (sin CORS)
 *   /proxy/adzuna/...        -> https://api.adzuna.com/v1/api/...  (+ claves)
 * Funciona con `npm run dev` y `npm run preview`. En Vercel lo mismo lo hacen las
 * reescrituras de vercel.json.
 */
function jobProxies(env) {
  // Claves de Adzuna desde .env.local. Sin prefijo VITE_ para que Vite NO las meta
  // en el JavaScript del navegador: solo las usa este proxy, en el servidor.
  const adzunaAuth = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID || '',
    app_key: env.ADZUNA_APP_KEY || '',
  }).toString()

  return {
    '/proxy/himalayas': {
      target: 'https://himalayas.app',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/proxy\/himalayas/, ''),
    },
    '/proxy/workingnomads': {
      target: 'https://www.workingnomads.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/proxy\/workingnomads/, ''),
    },
    '/proxy/tecnoempleo': {
      target: 'https://www.tecnoempleo.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/proxy\/tecnoempleo/, ''),
    },
    '/proxy/adzuna': {
      target: 'https://api.adzuna.com',
      changeOrigin: true,
      rewrite: (path) => {
        const url = path.replace(/^\/proxy\/adzuna/, '/v1/api')
        return `${url}${url.includes('?') ? '&' : '?'}${adzunaAuth}`
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' = cargar todas las variables de .env*, no solo las VITE_
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = jobProxies(env)

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
    build: {
      // pdfjs-dist es grande (~400 kB); subimos el límite para evitar el aviso
      chunkSizeWarningLimit: 1000,
    },
  }
})
