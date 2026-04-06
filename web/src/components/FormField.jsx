export default function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  children,
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || (
        <input
          className="field-input"
          name={name}
          value={value}
          onChange={onChange}
          type={type}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}
