const GENDER_OPTIONS = [
  { value: 'unknown', label: 'Chua xac dinh' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nu' },
  { value: 'other', label: 'Khac' },
];
export function GenderSelect({ value, onChange }) {
  return (
    <select className="field-select" name="gender" value={value} onChange={onChange}>
      {GENDER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
