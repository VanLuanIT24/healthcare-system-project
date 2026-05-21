# Reports Inpatient Emergency Data Contracts

This feature consumes dedicated report endpoints under `/api/reports/inpatient-emergency/*`.

Implemented backend report endpoints:
- `GET /api/reports/inpatient-emergency/admissions`
- `GET /api/reports/inpatient-emergency/discharges`
- `GET /api/reports/inpatient-emergency/bed-occupancy`
- `GET /api/reports/inpatient-emergency/bed-turnover`
- `GET /api/reports/inpatient-emergency/length-of-stay`
- `GET /api/reports/inpatient-emergency/inpatient-tasks`
- `GET /api/reports/inpatient-emergency/emergency-cases`
- `GET /api/reports/inpatient-emergency/response-time`
- `GET /api/reports/inpatient-emergency/case-resolution`

Future backend upgrades worth adding:
- Historical bed occupancy snapshots by hour/day.
- Cleaning and bed-ready events for audited idle-time and bed turnover.
- Diagnosis-adjusted expected LOS and discharge blocker categories.
- Emergency response p90/p95 by department, priority and source.
- Emergency false-alarm taxonomy and recurrence detection.
