import { useRef, useEffect } from 'react'
import './Input.css'

export default function Input({ onAdd, dayView, inputRef: inputRefProp }) {
  const internalRef = useRef(null)
  const inputRef = inputRefProp ?? internalRef

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const value = inputRef.current?.value?.trim()
    if (value) {
      onAdd(value)
      inputRef.current.value = ''
    }
  }

  const placeholder =
    dayView === 'tomorrow'
      ? 'Добавить дело на завтра...'
      : typeof dayView === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayView)
        ? 'Добавить дело на выбранный день...'
        : 'Добавить дело...'

  return (
    <footer className="input-wrap">
      <form className="input-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="input-field"
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Новая задача"
          inputMode="text"
          onFocus={(e) => {
            setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
          }}
        />
        <button type="submit" className="input-btn" aria-label="Добавить">
          +
        </button>
      </form>
    </footer>
  )
}
