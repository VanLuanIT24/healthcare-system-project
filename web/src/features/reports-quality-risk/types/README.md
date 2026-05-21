# Reports Quality Risk

UI cho workspace `Báo cáo & Phân tích > Chất lượng / Rủi ro`.

Routes:

- `/reports/quality-risk/dashboard`
- `/reports/quality-risk/critical-alerts`
- `/reports/quality-risk/break-glass`
- `/reports/quality-risk/sensitive-access`
- `/reports/quality-risk/security-audit`
- `/reports/quality-risk/support-tickets`
- `/reports/quality-risk/complaints-ratings`
- `/reports/quality-risk/sla`
- `/reports/quality-risk/job-failure`
- `/reports/quality-risk/notification-delivery`

Backend TODO chuyên sâu:

- `GET /api/reports/quality-risk/dashboard`
- `GET /api/reports/quality-risk/critical-alerts`
- `GET /api/reports/quality-risk/break-glass`
- `GET /api/reports/quality-risk/sensitive-access`
- `GET /api/reports/quality-risk/security-audit`
- `GET /api/reports/quality-risk/support-tickets`
- `GET /api/reports/quality-risk/complaints-ratings`
- `GET /api/reports/quality-risk/sla`
- `GET /api/reports/quality-risk/job-failure`
- `GET /api/reports/quality-risk/notification-delivery`

Các endpoint trên đã được dựng để gom dữ liệu hiện có. Phần cần nâng cấp tiếp là policy phân loại sensitive access, unified SLA đầy đủ hơn từ pharmacy/queue/clinical-order, và notification delivery timeline chi tiết theo provider.
