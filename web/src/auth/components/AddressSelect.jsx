import { useEffect, useRef, useState } from 'react';
export function AddressSelect({ name, value, placeholder, options, onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(nextValue) {
    onChange({
      target: {
        name,
        value: nextValue,
      },
    });
    setIsOpen(false);
  }

  return (
    <div className="address-select" ref={selectRef}>
      <button
        type="button"
        className={`address-select__trigger${disabled ? ' is-disabled' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen((current) => !current);
        }}
        aria-expanded={isOpen}
        aria-label={placeholder}
        disabled={disabled}
      >
        <span className={`address-select__value${value ? ' is-filled' : ''}`}>{value || placeholder}</span>
        <span className="address-select__caret">▾</span>
      </button>

      {isOpen ? (
        <div className="address-select__menu">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`address-select__option${option === value ? ' is-active' : ''}`}
              onClick={() => handleSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
