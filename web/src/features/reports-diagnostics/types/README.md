# Reports Diagnostics Types

Backend response for `/api/reports/diagnostics/*` is intentionally unified:

- `summary_cards`: KPI cards for the page.
- `charts`: order type, priority, status, SLA, modality, specimen, and overdue buckets.
- `lists`: normalized lab/imaging/procedure/order-center/alert rows.
- `items`: page-specific primary table rows when relevant.
- `backend_todo`: report analytics endpoints that should move from frontend fallback to backend-owned calculations.

TODO backend endpoints:

- `GET /api/reports/diagnostics/overview`
- `GET /api/reports/diagnostics/lab-orders`
- `GET /api/reports/diagnostics/lab-turnaround-time`
- `GET /api/reports/diagnostics/specimens`
- `GET /api/reports/diagnostics/imaging-orders`
- `GET /api/reports/diagnostics/imaging-turnaround-time`
- `GET /api/reports/diagnostics/report-pending`
- `GET /api/reports/diagnostics/critical-results`
- `GET /api/reports/diagnostics/procedure-orders`
- `GET /api/reports/diagnostics/overdue-orders`
