export function RecoveryActorSelect({ value, onChange }) {
  return (
    <select className="field-select" name="actor_type" value={value} onChange={onChange}>
      <option value="patient">Bệnh nhân</option>
      <option value="staff">Nhân sự</option>
    </select>
  );
}
