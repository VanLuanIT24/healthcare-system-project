# Reports Pharmacy Data Contracts

This feature consumes the pharmacy reporting endpoints under `/api/reports/pharmacy/*`.

Backend report endpoints already available:
- `GET /api/reports/pharmacy/dashboard`
- `GET /api/reports/pharmacy/inventory-overview`
- `GET /api/reports/pharmacy/inventory-movement`
- `GET /api/reports/pharmacy/dispensing`
- `GET /api/reports/pharmacy/expiring-stock`
- `GET /api/reports/pharmacy/low-stock`
- `GET /api/reports/pharmacy/inventory-valuation`
- `GET /api/reports/pharmacy/high-usage-medications`
- `GET /api/reports/pharmacy/waste-disposal`
- `POST /api/reports/pharmacy/export`
- `GET /api/reports/pharmacy/export-history`

Backend report endpoints added for the enterprise pharmacy workspace:
- `GET /api/reports/pharmacy/expired-recalled-batches`
- `GET /api/reports/pharmacy/prescriptions`
- `GET /api/reports/pharmacy/turnover`
- `GET /api/reports/pharmacy/stockout-risk`

Future backend upgrades worth adding:
- `GET /api/reports/pharmacy/abc-ven-analysis`
- `GET /api/reports/pharmacy/procurement-suggestions`
- `GET /api/reports/pharmacy/dispensing-performance`
- `GET /api/reports/pharmacy/movement-reconciliation`
