import { useCallback, useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'cv-job-matcher:theme'

// Tema actual: el que ya puso el script de index.html en <html data-theme>, o oscuro
function initialTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/**
 * Modo oscuro / claro.
 * - Se aplica con el atributo data-theme en <html> (los colores están en App.css).
 * - Se recuerda en localStorage (si no está disponible, simplemente no se recuerda).
 */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* sin persistencia: el tema sigue funcionando en esta sesión */
    }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, toggleTheme }
}
