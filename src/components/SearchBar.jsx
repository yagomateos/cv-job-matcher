import { SearchIcon } from './Icons'

/** Búsqueda por texto (título / empresa / tags) y criterio de orden. */
export default function SearchBar({ search, onSearchChange, sortBy, onSortChange }) {
  return (
    <div className="searchbar">
      <label className="searchbar__search">
        <SearchIcon size={18} />
        <span className="visually-hidden">Buscar ofertas</span>
        <input
          type="search"
          placeholder="Puesto, empresa, tecnología o ciudad"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>
      <label className="searchbar__sort">
        Ordenar
        <select className="select" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
          <option value="match">Mejor match</option>
          <option value="recent">Más recientes</option>
        </select>
      </label>
    </div>
  )
}
