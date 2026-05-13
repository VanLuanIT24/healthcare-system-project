function toDate(value = new Date()) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function startOfDay(date = new Date()) {
  const d = toDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = toDate(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addMinutes(date, minutes) {
  return new Date(toDate(date).getTime() + Number(minutes) * 60 * 1000);
}

function diffMinutes(start, end) {
  return Math.floor((toDate(end).getTime() - toDate(start).getTime()) / 60000);
}

function isBefore(a, b) {
  return toDate(a).getTime() < toDate(b).getTime();
}

function isAfter(a, b) {
  return toDate(a).getTime() > toDate(b).getTime();
}

function isSameOrBefore(a, b) {
  return toDate(a).getTime() <= toDate(b).getTime();
}

function isSameOrAfter(a, b) {
  return toDate(a).getTime() >= toDate(b).getTime();
}

function isTimeRangeValid(start, end) {
  return isBefore(start, end);
}

function rangesOverlap(startA, endA, startB, endB) {
  return toDate(startA) < toDate(endB) && toDate(startB) < toDate(endA);
}

function formatYYYYMMDD(date = new Date()) {
  const d = toDate(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

module.exports = {
  toDate,
  startOfDay,
  endOfDay,
  addMinutes,
  diffMinutes,
  isBefore,
  isAfter,
  isSameOrBefore,
  isSameOrAfter,
  isTimeRangeValid,
  rangesOverlap,
  formatYYYYMMDD,
};
