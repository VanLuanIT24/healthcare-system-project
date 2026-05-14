import { useEffect, useMemo, useRef } from 'react';

export function RecoveryCodeInput({ value, onChange, length = 6, disabled = false }) {
  const inputsRef = useRef([]);
  const digits = useMemo(() => {
    const normalized = String(value || '').replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, index) => normalized[index] || '');
  }, [length, value]);

  useEffect(() => {
    inputsRef.current = inputsRef.current.slice(0, length);
  }, [length]);

  function updateValue(nextDigits, focusIndex = null) {
    const nextValue = nextDigits.join('').replace(/\D/g, '').slice(0, length);
    onChange(nextValue);

    if (focusIndex !== null && inputsRef.current[focusIndex]) {
      inputsRef.current[focusIndex].focus();
      inputsRef.current[focusIndex].select();
    }
  }

  function handleDigitChange(index, inputValue) {
    const sanitized = String(inputValue || '').replace(/\D/g, '');
    const nextDigits = [...digits];

    if (!sanitized) {
      nextDigits[index] = '';
      updateValue(nextDigits);
      return;
    }

    if (sanitized.length > 1) {
      const filled = Array.from({ length }, (_, itemIndex) => sanitized[itemIndex] || digits[itemIndex] || '');
      updateValue(filled, Math.min(sanitized.length, length) - 1);
      return;
    }

    nextDigits[index] = sanitized;
    updateValue(nextDigits, Math.min(index + 1, length - 1));
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      updateValue([...digits], index - 1);
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      updateValue([...digits], index - 1);
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      updateValue([...digits], index + 1);
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text');
    if (!pasted) return;
    event.preventDefault();
    const sanitized = pasted.replace(/\D/g, '').slice(0, length);
    if (!sanitized) return;

    const nextDigits = Array.from({ length }, (_, index) => sanitized[index] || '');
    updateValue(nextDigits, Math.min(sanitized.length, length) - 1);
  }

  return (
    <div className="auth-recovery-code-input" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleDigitChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
