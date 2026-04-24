import { useEffect, useRef, useState } from 'react';
import { formatLongDate, parseDateValue, toLocalDateString } from '../utils';
const MONTH_LABELS = [
  'Thang 1',
  'Thang 2',
  'Thang 3',
  'Thang 4',
  'Thang 5',
  'Thang 6',
  'Thang 7',
  'Thang 8',
  'Thang 9',
  'Thang 10',
  'Thang 11',
  'Thang 12',
];
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function CustomDatePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('days');
  const pickerRef = useRef(null);
  const initialDate = value ? parseDateValue(value) : new Date();
  const [viewDate, setViewDate] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [draftValue, setDraftValue] = useState(value || '');

  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setDraftValue(value || '');
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekdayIndex = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 120 }, (_, index) => currentYear - 80 + index);

  for (let index = 0; index < firstWeekdayIndex; index += 1) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    calendarDays.push(day);
  }

  function selectDate(day) {
    const nextDate = new Date(year, month, day);
    const isoDate = toLocalDateString(nextDate);
    setDraftValue(isoDate);
  }

  function applyDate(nextValue) {
    onChange({
      target: {
        name: 'date_of_birth',
        value: nextValue,
      },
    });
    setActivePanel('days');
    setIsOpen(false);
  }

  function pickToday() {
    const isoDate = toLocalDateString(new Date());
    setDraftValue(isoDate);
    const nextDate = parseDateValue(isoDate);
    setViewDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setActivePanel('days');
  }

  function openPicker() {
    const baseDate = value ? parseDateValue(value) : new Date();
    setDraftValue(value || '');
    setViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    setActivePanel('days');
    setIsOpen((current) => !current);
  }

  return (
    <div className="picker-field" ref={pickerRef}>
      <button
        type="button"
        className="picker-trigger"
        onClick={openPicker}
        aria-label="Chọn ngày sinh"
      >
        <span className="picker-trigger__icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 2v4M17 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
          </svg>
        </span>
        <span className={value ? 'picker-trigger__value is-filled' : 'picker-trigger__value'}>
          {formatLongDate(value)}
        </span>
      </button>

      {isOpen ? (
        <div className="picker-menu">
          <div className="picker-menu__header">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <div className="picker-menu__title-group">
              <button
                type="button"
                className={`picker-menu__title-button${activePanel === 'months' ? ' is-active' : ''}`}
                onClick={() => setActivePanel((current) => (current === 'months' ? 'days' : 'months'))}
              >
                <span className="picker-menu__title-text picker-menu__title-text--month">{MONTH_LABELS[month]}</span>
              </button>
              <button
                type="button"
                className={`picker-menu__title-button picker-menu__title-button--year${activePanel === 'years' ? ' is-active' : ''}`}
                onClick={() => setActivePanel((current) => (current === 'years' ? 'days' : 'years'))}
              >
                <span className="picker-menu__title-text picker-menu__title-text--year">{year}</span>
              </button>
            </div>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>
          {activePanel === 'months' ? (
            <div className="picker-menu__month-grid">
              {MONTH_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={index === month ? 'is-selected' : ''}
                  onClick={() => {
                    setViewDate(new Date(year, index, 1));
                    setActivePanel('days');
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {activePanel === 'years' ? (
            <div className="picker-menu__year-grid">
              {yearOptions.map((optionYear) => (
                <button
                  key={optionYear}
                  type="button"
                  className={optionYear === year ? 'is-selected' : ''}
                  onClick={() => {
                    setViewDate(new Date(optionYear, month, 1));
                    setActivePanel('days');
                  }}
                >
                  {optionYear}
                </button>
              ))}
            </div>
          ) : null}
          {activePanel === 'days' ? (
            <>
              <div className="picker-menu__weekdays">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="picker-menu__days">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <span key={`empty-${index}`} className="is-muted" />;
                  }

                  const isoValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = draftValue === isoValue;
                  const isToday =
                    year === today.getFullYear() &&
                    month === today.getMonth() &&
                    day === today.getDate();

                  return (
                    <button
                      key={`${month}-${day}`}
                      type="button"
                      className={`${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`.trim()}
                      onClick={() => selectDate(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          <div className="picker-menu__footer">
            <button type="button" className="picker-menu__today" onClick={pickToday}>
              Hôm nay
            </button>
            <button
              type="button"
              className="picker-menu__confirm"
              onClick={() => applyDate(draftValue || toLocalDateString(new Date()))}
            >
              Chọn
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
