# Records & Documents Reports

Feature UI for `/api/reports/records-documents/*`.

The backend response shape is intentionally report-friendly:

- `summary`: KPI totals.
- `charts`: breakdown arrays for charts.
- `items`: paginated table rows.
- `pagination`: server pagination metadata.
- `backend_todo`: analytics gaps that still need deeper backend support.
