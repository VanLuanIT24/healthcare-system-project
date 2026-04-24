import { useState } from 'react';
import { COUNTRY_PHONE_OPTIONS } from '../data/countryPhoneOptions';
function getFlagUrl(code) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

function CountryFlag({ code, label }) {
  return <img className="country-select__flag-image" src={getFlagUrl(code)} alt={label} loading="lazy" />;
}

export function CountryCodeSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCountry =
    COUNTRY_PHONE_OPTIONS.find((country) => `${country.code}|${country.dial}` === value) ||
    COUNTRY_PHONE_OPTIONS.find((country) => country.code === 'VN');

  function handleSelect(nextValue) {
    onChange({
      target: {
        name: 'phone_country_code',
        value: nextValue,
      },
    });
    setIsOpen(false);
  }

  return (
    <div className="country-select">
      <button
        type="button"
        className="country-select__trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label="Chọn mã quốc gia"
      >
        <span className="country-select__value">
          <CountryFlag code={selectedCountry.code} label={selectedCountry.name} />
          <span className="country-select__code">{selectedCountry.short}</span>
          <span className="country-select__dial">{selectedCountry.dial}</span>
        </span>
        <span className="country-select__caret">▾</span>
      </button>

      {isOpen ? (
        <div className="country-select__menu">
          {COUNTRY_PHONE_OPTIONS.map((country) => {
            const optionValue = `${country.code}|${country.dial}`;
            return (
              <button
                key={optionValue}
                type="button"
                className={`country-select__option${optionValue === value ? ' is-active' : ''}`}
                onClick={() => handleSelect(optionValue)}
              >
                <CountryFlag code={country.code} label={country.name} />
                <span className="country-select__name">{country.name}</span>
                <span className="country-select__dial">{country.dial}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
