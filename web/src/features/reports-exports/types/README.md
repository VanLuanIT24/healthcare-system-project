# Reports Exports Types

Runtime data for the export center is JavaScript-only in this workspace. The feature expects these backend shapes:

- `ExportHistoryResponse`: `{ summary, items, pagination, backend_todo }`
- `ExportJob`: `{ export_id, report_group, report_type, format, status, exported_by, exported_at, filters, metadata }`
- `UnsupportedFormatCenter`: `{ enabled: false, status_card, design_options, suggested_endpoint, backend_todo }`

Backend TODO tracked in UI:

- `report_export_jobs`
- `report_export_schedules`
- `saved_reports`
- `saved_report_activity_logs`
