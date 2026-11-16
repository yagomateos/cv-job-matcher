import { useRef, useState } from 'react'
import { ROLE_LABELS } from '../services/cvService'
import { AlertIcon, FileIcon } from './Icons'

// En móvil solo se ven estas skills hasta pulsar "+N más"
const COLLAPSED_SKILLS = 6

/**
 * Tarjeta del CV en el panel lateral: archivo, perfil editable y skills detectadas.
 * Permite cambiar o quitar el CV. (La subida inicial está en la portada, Home.jsx.)
 */
export default function CVUploader({
  fileName,
  cvSkills,
  role,
  language,
  loading,
  error,
  onUpload,
  onRoleChange,
  onReset,
}) {
  const inputRef = useRef(null)
  const [showAllSkills, setShowAllSkills] = useState(false)
  const hasCV = cvSkills.length > 0

  const openPicker = () => inputRef.current?.click()

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    // Limpiamos el valor para poder volver a seleccionar el mismo archivo
    e.target.value = ''
  }

  // Input oculto: se abre con "Cambiar CV"
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      onChange={handleChange}
      className="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
    />
  )

  const errorBox = error && (
    <p className="alert alert--error" role="alert">
      <AlertIcon size={16} /> {error}
    </p>
  )

  // Sin CV no hay tarjeta: la portada (Home) se encarga de la subida
  if (!hasCV) return null

  const hiddenCount = cvSkills.length - COLLAPSED_SKILLS

  return (
    <section className="panel cv-card">
      {fileInput}
      {/* Grid con áreas: en escritorio "título | acciones" y debajo el archivo;
          en móvil todo en una fila "archivo | Cambiar" (ver App.css) */}
      <div className="cv-card__summary">
        <h2 className="eyebrow cv-card__eyebrow">Tu CV</h2>
        <div className="cv-card__actions">
          <button className="link-button" onClick={openPicker} disabled={loading}>
            {loading ? 'Leyendo…' : (
              <>
                Cambiar<span className="hide-mobile"> CV</span>
              </>
            )}
          </button>
          <button className="link-button link-button--muted hide-mobile" onClick={onReset} disabled={loading}>
            Quitar
          </button>
        </div>
        <div className="cv-card__file">
          <div className="icon-tile">
            <FileIcon size={20} />
          </div>
          <div className="cv-card__file-text">
            <strong title={fileName}>{fileName}</strong>
            <span className="muted small">
              <span className="only-mobile">{ROLE_LABELS[role]} · </span>
              {cvSkills.length} skills · <span className="hide-mobile">CV en </span>
              {language === 'en' ? 'inglés' : 'castellano'}
            </span>
          </div>
        </div>
      </div>

      {/* El perfil decide qué ofertas se buscan; se puede corregir a mano.
          En móvil este selector se muestra dentro del panel de filtros. */}
      <div className="field hide-mobile">
        <label htmlFor="role" className="field__label">
          Perfil detectado
        </label>
        <select
          id="role"
          className="input select"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          disabled={loading}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className={`chips ${showAllSkills ? '' : 'chips--collapsible'}`}>
        {cvSkills.map((skill) => (
          <span key={skill} className="chip chip--accent">
            {skill}
          </span>
        ))}
        {/* Solo visible en móvil (ver App.css) */}
        {hiddenCount > 0 && !showAllSkills && (
          <button className="chip chip--more" onClick={() => setShowAllSkills(true)}>
            +{hiddenCount} más
          </button>
        )}
      </div>

      {errorBox}
    </section>
  )
}
