import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

/**
 * Números de página a mostrar, con "…" cuando hay muchas:
 * 1 … 4 5 6 … 20  (siempre primera, última y las vecinas de la actual)
 */
function pageItems(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const items = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(`gap-${p}`)
    items.push(p)
  })
  return items
}

/**
 * Paginación numerada.
 * @param {number} page página actual (desde 1)
 * @param {number} totalPages
 * @param {number} totalItems nº total de ofertas (para "Mostrando X–Y de Z")
 * @param {number} pageSize
 */
export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <nav className="pagination" aria-label="Paginación de ofertas">
      <span className="pagination__info small muted">
        Mostrando {from}–{to} de {totalItems}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon size={16} />
        </button>
        {pageItems(page, totalPages).map((item) =>
          typeof item === 'string' ? (
            <span key={item} className="pagination__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`pagination__btn ${item === page ? 'is-active' : ''}`}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Página ${item}`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="pagination__btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </nav>
  )
}
