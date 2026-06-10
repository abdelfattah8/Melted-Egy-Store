import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'

export default function SearchBar({ onSearch, placeholder = 'Search products...' }) {
  const [value, setValue] = useState('')

  function handleChange(e) {
    setValue(e.target.value)
    onSearch(e.target.value)
  }

  function handleClear() {
    setValue('')
    onSearch('')
  }

  return (
    <div className="search-bar">
      <span className="search-icon"><FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 16, color: 'var(--text-light)' }} /></span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="search-input"
      />
      {value && (
        <button className="search-clear" onClick={handleClear}>
          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} />
        </button>
      )}
    </div>
  )
}
