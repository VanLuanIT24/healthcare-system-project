export function formatDisplayDate(value) {
  if (!value) return 'dd/mm/yyyy';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function formatLongDate(value) {
  if (!value) return 'Chon ngay sinh';
  const [year, month, day] = value.split('-');
  return `${Number(day)} Thang ${Number(month)}, ${year}`;
}

export function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateValue(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function composeAddress({ address_line, address_ward, address_district, address_city }) {
  return [address_line, address_ward, address_district, address_city].filter(Boolean).join(', ');
}
