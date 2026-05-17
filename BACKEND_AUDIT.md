# BACKEND AUDIT

Generated: 2026-05-16T01:37:58.671Z

## Tổng quan

- Route files scanned: 31
- Routes scanned: 781
- Controller files scanned: 33
- Service files scanned: 66
- Model files scanned: 84
- Repository files scanned: 20

## Ma Trận Module

| Module | Priority | Models | Repository | Service | Controller | Routes | Permission/Auth Issues | Validation Issues | Trạng thái |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| access-authorization | 3 | 0 | 0 | 1 | 1 | 7 | 0 | 5 | Cần rà bảo mật/validation |
| admin | 1 | 8 | 2 | 1 | 1 | 45 | 0 | 24 | Cần rà bảo mật/validation |
| appointment | 1 | 5 | 1 | 2 | 2 | 47 | 5 | 25 | Cần rà bảo mật/validation |
| audit | 3 | 3 | 1 | 1 | 1 | 6 | 0 | 0 | Ổn kỹ thuật |
| auth | 1 | 15 | 1 | 1 | 1 | 37 | 3 | 29 | Cần rà bảo mật/validation |
| billing | 2 | 9 | 1 | 3 | 3 | 61 | 1 | 31 | Lỗi nối dây/bảo mật |
| clinical | 1 | 8 | 1 | 1 | 1 | 55 | 0 | 39 | Cần rà bảo mật/validation |
| dashboard | 3 | 27 | 4 | 1 | 1 | 5 | 0 | 0 | Ổn kỹ thuật |
| department | 1 | 6 | 2 | 1 | 1 | 19 | 0 | 6 | Cần rà bảo mật/validation |
| directory | 3 | 1 | 0 | 1 | 1 | 8 | 5 | 0 | Lỗi nối dây/bảo mật |
| emergency | 3 | 1 | 0 | 1 | 1 | 8 | 0 | 6 | Cần rà bảo mật/validation |
| encounter | 1 | 8 | 1 | 2 | 2 | 30 | 0 | 14 | Cần rà bảo mật/validation |
| iam | 1 | 6 | 1 | 1 | 1 | 27 | 0 | 14 | Cần rà bảo mật/validation |
| imaging | 2 | 3 | 1 | 1 | 1 | 26 | 0 | 14 | Cần rà bảo mật/validation |
| inpatient | 2 | 5 | 1 | 1 | 1 | 29 | 0 | 15 | Cần rà bảo mật/validation |
| laboratory | 2 | 5 | 1 | 1 | 1 | 31 | 0 | 20 | Cần rà bảo mật/validation |
| message | 3 | 0 | 0 | 1 | 1 | 18 | 0 | 14 | Cần rà bảo mật/validation |
| notification | 3 | 4 | 1 | 1 | 1 | 13 | 0 | 8 | Cần rà bảo mật/validation |
| order | 2 | 1 | 1 | 1 | 1 | 18 | 0 | 9 | Cần rà bảo mật/validation |
| patient | 1 | 6 | 1 | 2 | 2 | 56 | 5 | 28 | Cần rà bảo mật/validation |
| portal | 3 | 0 | 0 | 1 | 1 | 15 | 5 | 8 | Cần rà bảo mật/validation |
| prescription | 2 | 9 | 1 | 1 | 1 | 55 | 0 | 34 | Cần rà bảo mật/validation |
| procedure | 2 | 1 | 1 | 1 | 1 | 18 | 0 | 7 | Cần rà bảo mật/validation |
| qr-token | 3 | 0 | 0 | 1 | 1 | 6 | 1 | 5 | Lỗi nối dây/bảo mật |
| queue | 2 | 5 | 1 | 1 | 1 | 22 | 0 | 14 | Cần rà bảo mật/validation |
| records | 2 | 3 | 1 | 2 | 2 | 33 | 1 | 15 | Lỗi nối dây/bảo mật |
| reports | 3 | 27 | 4 | 1 | 1 | 8 | 0 | 0 | Ổn kỹ thuật |
| schedule | 1 | 5 | 1 | 1 | 1 | 42 | 0 | 17 | Cần rà bảo mật/validation |
| staff | 1 | 8 | 2 | 1 | 1 | 26 | 0 | 12 | Cần rà bảo mật/validation |
| support-ticket | 3 | 0 | 0 | 1 | 1 | 10 | 0 | 8 | Cần rà bảo mật/validation |

## Phát Hiện Quan Trọng

- Missing route -> controller exports: 0
- Controller calls missing service exports: 0
- Routes without auth: 8
- Protected routes without specific permission guard: 0
- Self-service auth-only routes: 13
- Actor-only guarded routes: 18
- Routes missing ObjectId param validation: 0
- Mutating routes without explicit route-level validation middleware: 421
- Controller exports not routed: 1
- Service exports not called by controllers: 442

### Lỗi Nối Dây

- [x] Không phát hiện route gọi controller không tồn tại hoặc controller gọi service export không tồn tại.

### Public / Auth / Permission

Public routes detected:
- GET /admin/settings/public (src/routes/admin.routes.js:14)
- GET /admin/doctors (src/routes/admin.routes.js:15)
- POST /auth/staff/login (src/routes/auth.routes.js:55)
- POST /auth/patients/register (src/routes/auth.routes.js:57)
- POST /auth/patients/login (src/routes/auth.routes.js:58)
- POST /auth/patient/register (src/routes/auth.routes.js:59)
- POST /auth/patient/login (src/routes/auth.routes.js:60)
- POST /auth/password/validate (src/routes/auth.routes.js:61)
- POST /auth/forgot-password (src/routes/auth.routes.js:62)
- POST /auth/verify-reset-token (src/routes/auth.routes.js:63)
- POST /auth/reset-password (src/routes/auth.routes.js:64)
- POST /auth/refresh-token (src/routes/auth.routes.js:65)
- POST /auth/logout (src/routes/auth.routes.js:66)
- GET /departments/active (src/routes/department.routes.js:12)
- GET /directory/doctors (src/routes/directory.routes.js:13)
- GET /directory/doctors/:doctorId (src/routes/directory.routes.js:14)
- GET /directory/available-slots (src/routes/directory.routes.js:19)
- GET /queue/public/board (src/routes/queue.routes.js:15)
- GET /schedules/:scheduleId/available-slots (src/routes/schedule.routes.js:14)
- GET /schedules/public/date-range (src/routes/schedule.routes.js:15)

Routes without auth:
- [ ] POST /billing/payment-webhooks/:provider (src/routes/billing.routes.js:25)
- [ ] GET /directory/departments (src/routes/directory.routes.js:12)
- [ ] GET /directory/services (src/routes/directory.routes.js:15)
- [ ] GET /directory/service-prices (src/routes/directory.routes.js:16)
- [ ] GET /directory/clinics (src/routes/directory.routes.js:17)
- [ ] GET /directory/pharmacies (src/routes/directory.routes.js:18)
- [ ] GET /qr/verify/:token (src/routes/qr-token.routes.js:23)
- [ ] GET /records/attachments/:attachmentId/signed-download (src/routes/records.routes.js:88)

Actor-only routes cần rà owner/scope trong service:
- [ ] GET /appointments/my (src/routes/appointment.routes.js:19)
- [ ] POST /appointments/portal (src/routes/appointment.routes.js:20)
- [ ] GET /appointments/my/:appointmentId (src/routes/appointment.routes.js:23)
- [ ] POST /appointments/my/:appointmentId/cancel (src/routes/appointment.routes.js:24)
- [ ] POST /appointments/my/:appointmentId/reschedule (src/routes/appointment.routes.js:25)
- [ ] PATCH /auth/patient/account/email (src/routes/auth.routes.js:92)
- [ ] PATCH /auth/patient/account/phone (src/routes/auth.routes.js:93)
- [ ] PATCH /auth/patient/account/username (src/routes/auth.routes.js:94)
- [ ] GET /patients/me/profile (src/routes/patient.routes.js:21)
- [ ] PATCH /patients/me/profile (src/routes/patient.routes.js:22)
- [ ] GET /patients/me/appointments (src/routes/patient.routes.js:23)
- [ ] GET /patients/me/encounters (src/routes/patient.routes.js:24)
- [ ] GET /patients/me/prescriptions (src/routes/patient.routes.js:25)
- [ ] GET /portal/me/dashboard (src/routes/portal.routes.js:17)
- [ ] GET /portal/me/access-logs (src/routes/portal.routes.js:18)
- [ ] POST /portal/me/profile-change-requests (src/routes/portal.routes.js:19)
- [ ] GET /portal/me/profile-change-requests (src/routes/portal.routes.js:20)
- [ ] POST /portal/me/profile-change-requests/:profileChangeRequestId/cancel (src/routes/portal.routes.js:21)

Self-service auth-only routes (thường hợp lý, cần bảo đảm chỉ thao tác trên chính tài khoản hiện tại):
- [ ] POST /auth/change-password (src/routes/auth.routes.js:67)
- [ ] GET /auth/me (src/routes/auth.routes.js:68)
- [ ] PATCH /auth/me (src/routes/auth.routes.js:69)
- [ ] GET /auth/me/roles (src/routes/auth.routes.js:70)
- [ ] GET /auth/me/permissions (src/routes/auth.routes.js:71)
- [ ] GET /auth/me/session (src/routes/auth.routes.js:72)
- [ ] GET /auth/me/sessions (src/routes/auth.routes.js:73)
- [ ] DELETE /auth/me/sessions/others (src/routes/auth.routes.js:74)
- [ ] PATCH /auth/me/sessions/:sessionId/device (src/routes/auth.routes.js:75)
- [ ] DELETE /auth/me/sessions/:sessionId (src/routes/auth.routes.js:76)
- [ ] GET /auth/me/login-history (src/routes/auth.routes.js:77)
- [ ] POST /auth/logout-all-devices (src/routes/auth.routes.js:78)
- [ ] POST /auth/sessions/revoke (src/routes/auth.routes.js:79)

### Validation

Routes missing ObjectId param validation:
- [x] Tất cả route params dạng *Id đều có router.param validateObjectIdParam.

Mutating routes without explicit route-level validation middleware:
- [ ] POST /access/consents (src/routes/access-authorization.routes.js:15)
- [ ] POST /access/consents/:consentId/revoke (src/routes/access-authorization.routes.js:23)
- [ ] POST /access/break-glass/start (src/routes/access-authorization.routes.js:28)
- [ ] POST /access/break-glass/:accessId/end (src/routes/access-authorization.routes.js:34)
- [ ] POST /access/break-glass/end (src/routes/access-authorization.routes.js:40)
- [ ] POST /admin/staff (src/routes/admin.routes.js:37)
- [ ] PATCH /admin/staff/:userId (src/routes/admin.routes.js:40)
- [ ] PATCH /admin/staff/:userId/status (src/routes/admin.routes.js:41)
- [ ] POST /admin/staff/:userId/activate (src/routes/admin.routes.js:42)
- [ ] POST /admin/staff/:userId/deactivate (src/routes/admin.routes.js:43)
- [ ] POST /admin/staff/:userId/unlock (src/routes/admin.routes.js:44)
- [ ] POST /admin/staff/:userId/reset-password (src/routes/admin.routes.js:45)
- [ ] DELETE /admin/staff/:userId (src/routes/admin.routes.js:46)
- [ ] POST /admin/staff/:userId/force-logout (src/routes/admin.routes.js:47)
- [ ] POST /admin/staff/:userId/transfer-department (src/routes/admin.routes.js:48)
- [ ] POST /admin/staff/:userId/roles (src/routes/admin.routes.js:51)
- [ ] PUT /admin/staff/:userId/roles (src/routes/admin.routes.js:52)
- [ ] DELETE /admin/staff/:userId/roles (src/routes/admin.routes.js:53)
- [ ] POST /admin/departments (src/routes/admin.routes.js:59)
- [ ] PATCH /admin/departments/:departmentId (src/routes/admin.routes.js:61)
- [ ] PATCH /admin/departments/:departmentId/status (src/routes/admin.routes.js:62)
- [ ] DELETE /admin/departments/:departmentId (src/routes/admin.routes.js:63)
- [ ] POST /admin/departments/:departmentId/assign-head (src/routes/admin.routes.js:64)
- [ ] POST /admin/doctor-profiles (src/routes/admin.routes.js:69)
- [ ] PATCH /admin/doctor-profiles/:profileId (src/routes/admin.routes.js:71)
- [ ] PATCH /admin/doctor-profiles/:profileId/status (src/routes/admin.routes.js:72)
- [ ] DELETE /admin/doctor-profiles/:profileId (src/routes/admin.routes.js:73)
- [ ] POST /admin/settings (src/routes/admin.routes.js:76)
- [ ] PATCH /admin/settings/:settingKey (src/routes/admin.routes.js:79)
- [ ] POST /appointments/portal (src/routes/appointment.routes.js:20)
- [ ] POST /appointments/me/waitlist (src/routes/appointment.routes.js:21)
- [ ] POST /appointments/my/:appointmentId/cancel (src/routes/appointment.routes.js:24)
- [ ] POST /appointments/my/:appointmentId/reschedule (src/routes/appointment.routes.js:25)
- [ ] POST /appointments/check-doctor-availability (src/routes/appointment.routes.js:33)
- [ ] POST /appointments/check-patient-duplicate (src/routes/appointment.routes.js:34)
- [ ] POST /appointments/check-doctor-conflict (src/routes/appointment.routes.js:37)
- [ ] POST /appointments/check-patient-conflict (src/routes/appointment.routes.js:38)
- [ ] POST /appointments (src/routes/appointment.routes.js:39)
- [ ] POST /appointments/staff-create (src/routes/appointment.routes.js:40)
- [ ] POST /appointments/waitlist/:waitlistId/offer-slot (src/routes/appointment.routes.js:42)
- [ ] POST /appointments/waitlist/:waitlistId/book (src/routes/appointment.routes.js:43)
- [ ] POST /appointments/waitlist/:waitlistId/cancel (src/routes/appointment.routes.js:44)
- [ ] POST /appointments/bulk-confirm (src/routes/appointment.routes.js:45)
- [ ] POST /appointments/bulk-cancel (src/routes/appointment.routes.js:46)
- [ ] PATCH /appointments/:appointmentId (src/routes/appointment.routes.js:60)
- [ ] POST /appointments/:appointmentId/confirm (src/routes/appointment.routes.js:61)
- [ ] POST /appointments/:appointmentId/cancel (src/routes/appointment.routes.js:62)
- [ ] POST /appointments/:appointmentId/reschedule (src/routes/appointment.routes.js:63)
- [ ] POST /appointments/:appointmentId/check-in (src/routes/appointment.routes.js:64)
- [ ] POST /appointments/:appointmentId/no-show (src/routes/appointment.routes.js:65)
- [ ] POST /appointments/:appointmentId/complete (src/routes/appointment.routes.js:66)
- [ ] POST /appointments/:appointmentId/queue-ticket (src/routes/appointment.routes.js:67)
- [ ] POST /appointments/:appointmentId/encounter (src/routes/appointment.routes.js:68)
- [ ] POST /appointments/:appointmentId/link-encounter (src/routes/appointment.routes.js:69)
- [ ] POST /auth/staff/login (src/routes/auth.routes.js:55)
- [ ] POST /auth/patients/register (src/routes/auth.routes.js:57)
- [ ] POST /auth/patients/login (src/routes/auth.routes.js:58)
- [ ] POST /auth/patient/register (src/routes/auth.routes.js:59)
- [ ] POST /auth/patient/login (src/routes/auth.routes.js:60)
- [ ] POST /auth/forgot-password (src/routes/auth.routes.js:62)
- ... và 361 mục khác

## Nhận Định Nhanh

- [x] Vòng 1 nối dây ổn: không phát hiện route gọi controller thiếu export, cũng không phát hiện controller gọi service method thiếu export.
- [x] Route-level auth/permission tổng thể ổn: sau khi tách nhóm public và self-service, không còn route protected nào thiếu permission/role guard theo static scan.
- [ ] Public surface cần xác nhận nghiệp vụ: `/admin/doctors`, `/departments/active`, `/schedules/:scheduleId/available-slots`, auth login/register/refresh/logout/reset-password.
- [ ] Actor-only routes cần owner/scope check: static scan thấy nhóm `/appointments/my`, `/patients/me`, patient account self-update. Service hiện có dấu hiệu dùng `auth.patientId`, `assertAppointmentReadable`, `canReadPatient`, `getManagedPatientAccount`; vẫn nên test case bệnh nhân A truy cập dữ liệu bệnh nhân B.
- [ ] IAM ObjectId validation cần quyết định: `roleId`/`permissionId` đang bị flag vì chưa có `router.param`. Nếu API cố ý cho nhập role code/permission code thì không thêm ObjectId validator; nếu chỉ nhận Mongo ObjectId thì nên bổ sung.
- [ ] Body/query validation là khoảng trống lớn nhất: 355 mutating routes chưa có validator middleware ở route boundary. Service có nhiều validation nghiệp vụ, nhưng frontend/API sẽ ổn định hơn nếu thêm validator rõ ràng theo module ưu tiên.

## Ưu Tiên Tiếp Theo

1. Auth/IAM: xác nhận public endpoints, self-service owner check, và quyết định `roleId`/`permissionId` là ObjectId hay id/code.
2. Schedule + Appointment: thêm validator middleware cho create/update/action payload và test workflow status transition.
3. Patient + Clinical: test owner/scope bệnh nhân, bác sĩ chỉ xem dữ liệu được phân công, và validate payload lâm sàng.
4. Billing/Lab/Imaging/Prescription/Records: bổ sung validators theo API mutating có rủi ro cao trước.

## Checklist Theo Module

### access-authorization Module

- [ ] Models (0): chưa phát hiện
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/access-authorization.service.js`
- [x] Controllers (1): `src/controllers/access-authorization.controller.js`
- [x] Routes: 7
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 5
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

### admin Module

- [x] Models (8): `src/models/admin/doctor-profile.model.js`, `src/models/admin/system-setting.model.js`, `src/models/iam/department.model.js`, `src/models/iam/permission.model.js`, `src/models/iam/role-permission.model.js`, `src/models/iam/role.model.js`, `src/models/iam/user-role.model.js`, `src/models/iam/user.model.js`
- [x] Repositories (2): `src/repositories/admin.repository.js`, `src/repositories/iam.repository.js`
- [x] Services (1): `src/services/admin.service.js`
- [x] Controllers (1): `src/controllers/admin.controller.js`
- [x] Routes: 45
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 24
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

### appointment Module

- [x] Models (5): `src/models/scheduling/appointment-waitlist.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (1): `src/repositories/scheduling.repository.js`
- [x] Services (2): `src/services/appointment.service.js`, `src/services/appointment-waitlist.service.js`
- [x] Controllers (2): `src/controllers/appointment.controller.js`, `src/controllers/appointment-waitlist.controller.js`
- [x] Routes: 47
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 5
- [ ] Validation cần rà: 25
- [ ] Service exports chưa được controller gọi trực tiếp: 6
- Trạng thái: Cần rà bảo mật/validation

### audit Module

- [x] Models (3): `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`
- [x] Repositories (1): `src/repositories/auth.repository.js`
- [x] Services (1): `src/services/audit-query.service.js`
- [x] Controllers (1): `src/controllers/audit.controller.js`
- [x] Routes: 6
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [x] Validation cần rà: 0
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Ổn kỹ thuật

### auth Module

- [x] Models (15): `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`, `src/models/iam/department.model.js`, `src/models/iam/permission.model.js`, `src/models/iam/role-permission.model.js`, `src/models/iam/role.model.js`, `src/models/iam/user-role.model.js`, `src/models/iam/user.model.js`, `src/models/patients/patient-account.model.js`, `src/models/patients/patient-authorization.model.js`, `src/models/patients/patient-identifier.model.js`, `src/models/patients/patient-profile-change-request.model.js`, `src/models/patients/patient-relative.model.js`, `src/models/patients/patient.model.js`
- [x] Repositories (1): `src/repositories/auth.repository.js`
- [x] Services (1): `src/services/auth.service.js`
- [x] Controllers (1): `src/controllers/auth.controller.js`
- [x] Routes: 37
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 3
- [ ] Validation cần rà: 29
- [ ] Service exports chưa được controller gọi trực tiếp: 7
- Trạng thái: Cần rà bảo mật/validation

### billing Module

- [x] Models (9): `src/models/billing/charge.model.js`, `src/models/billing/insurance-claim.model.js`, `src/models/billing/insurance-policy.model.js`, `src/models/billing/invoice-item.model.js`, `src/models/billing/invoice.model.js`, `src/models/billing/payment-gateway-event.model.js`, `src/models/billing/payment-intent.model.js`, `src/models/billing/payment.model.js`, `src/models/billing/service-catalog.model.js`
- [x] Repositories (1): `src/repositories/billing.repository.js`
- [x] Services (3): `src/services/billing.service.js`, `src/services/insurance-self-service.service.js`, `src/services/payment-intent.service.js`
- [x] Controllers (3): `src/controllers/billing.controller.js`, `src/controllers/insurance-self-service.controller.js`, `src/controllers/payment-intent.controller.js`
- [x] Routes: 61
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 1
- [ ] Validation cần rà: 31
- [ ] Service exports chưa được controller gọi trực tiếp: 7
- Trạng thái: Lỗi nối dây/bảo mật

### clinical Module

- [x] Models (8): `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`
- [x] Repositories (1): `src/repositories/clinical.repository.js`
- [x] Services (1): `src/services/clinical.service.js`
- [x] Controllers (1): `src/controllers/clinical.controller.js`
- [x] Routes: 55
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 39
- [ ] Service exports chưa được controller gọi trực tiếp: 13
- Trạng thái: Cần rà bảo mật/validation

### dashboard Module

- [x] Models (27): `src/models/admin/doctor-profile.model.js`, `src/models/admin/system-setting.model.js`, `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`, `src/models/billing/charge.model.js`, `src/models/billing/insurance-claim.model.js`, `src/models/billing/insurance-policy.model.js`, `src/models/billing/invoice-item.model.js`, `src/models/billing/invoice.model.js`, `src/models/billing/payment-gateway-event.model.js`, `src/models/billing/payment-intent.model.js`, `src/models/billing/payment.model.js`, `src/models/billing/service-catalog.model.js`, `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`, `src/models/scheduling/appointment-waitlist.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (4): `src/repositories/admin.repository.js`, `src/repositories/billing.repository.js`, `src/repositories/clinical.repository.js`, `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/report.service.js`
- [x] Controllers (1): `src/controllers/dashboard.controller.js`
- [x] Routes: 5
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [x] Validation cần rà: 0
- [ ] Service exports chưa được controller gọi trực tiếp: 1
- Trạng thái: Ổn kỹ thuật

### department Module

- [x] Models (6): `src/models/iam/department.model.js`, `src/models/iam/permission.model.js`, `src/models/iam/role-permission.model.js`, `src/models/iam/role.model.js`, `src/models/iam/user-role.model.js`, `src/models/iam/user.model.js`
- [x] Repositories (2): `src/repositories/iam.repository.js`, `src/repositories/admin.repository.js`
- [x] Services (1): `src/services/department.service.js`
- [x] Controllers (1): `src/controllers/department.controller.js`
- [x] Routes: 19
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 6
- [ ] Service exports chưa được controller gọi trực tiếp: 3
- Trạng thái: Cần rà bảo mật/validation

### directory Module

- [x] Models (1): `src/models/directory/facility-location.model.js`
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/directory.service.js`
- [x] Controllers (1): `src/controllers/directory.controller.js`
- [x] Routes: 8
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 5
- [x] Validation cần rà: 0
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Lỗi nối dây/bảo mật

### emergency Module

- [x] Models (1): `src/models/emergency/emergency-case.model.js`
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/emergency.service.js`
- [x] Controllers (1): `src/controllers/emergency.controller.js`
- [x] Routes: 8
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 6
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

### encounter Module

- [x] Models (8): `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`
- [x] Repositories (1): `src/repositories/clinical.repository.js`
- [x] Services (2): `src/services/encounter.service.js`, `src/services/order.service.js`
- [x] Controllers (2): `src/controllers/encounter.controller.js`, `src/controllers/order.controller.js`
- [x] Routes: 30
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 14
- [ ] Service exports chưa được controller gọi trực tiếp: 14
- Trạng thái: Cần rà bảo mật/validation

### iam Module

- [x] Models (6): `src/models/iam/department.model.js`, `src/models/iam/permission.model.js`, `src/models/iam/role-permission.model.js`, `src/models/iam/role.model.js`, `src/models/iam/user-role.model.js`, `src/models/iam/user.model.js`
- [x] Repositories (1): `src/repositories/iam.repository.js`
- [x] Services (1): `src/services/iam.service.js`
- [x] Controllers (1): `src/controllers/iam.controller.js`
- [x] Routes: 27
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 14
- [ ] Service exports chưa được controller gọi trực tiếp: 6
- Trạng thái: Cần rà bảo mật/validation

### imaging Module

- [x] Models (3): `src/models/imaging/imaging-modality.model.js`, `src/models/imaging/imaging-order.model.js`, `src/models/imaging/imaging-report.model.js`
- [x] Repositories (1): `src/repositories/imaging.repository.js`
- [x] Services (1): `src/services/imaging.service.js`
- [x] Controllers (1): `src/controllers/imaging.controller.js`
- [x] Routes: 26
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 14
- [ ] Service exports chưa được controller gọi trực tiếp: 4
- Trạng thái: Cần rà bảo mật/validation

### inpatient Module

- [x] Models (5): `src/models/inpatient/admission.model.js`, `src/models/inpatient/bed-assignment.model.js`, `src/models/inpatient/bed.model.js`, `src/models/inpatient/inpatient-task.model.js`, `src/models/inpatient/room.model.js`
- [x] Repositories (1): `src/repositories/inpatient.repository.js`
- [x] Services (1): `src/services/inpatient.service.js`
- [x] Controllers (1): `src/controllers/inpatient.controller.js`
- [x] Routes: 29
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 15
- [ ] Service exports chưa được controller gọi trực tiếp: 4
- Trạng thái: Cần rà bảo mật/validation

### laboratory Module

- [x] Models (5): `src/models/laboratory/lab-order.model.js`, `src/models/laboratory/lab-result-item.model.js`, `src/models/laboratory/lab-result.model.js`, `src/models/laboratory/lab-test-catalog.model.js`, `src/models/laboratory/specimen.model.js`
- [x] Repositories (1): `src/repositories/laboratory.repository.js`
- [x] Services (1): `src/services/laboratory.service.js`
- [x] Controllers (1): `src/controllers/laboratory.controller.js`
- [x] Routes: 31
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 20
- [ ] Service exports chưa được controller gọi trực tiếp: 6
- Trạng thái: Cần rà bảo mật/validation

### message Module

- [ ] Models (0): chưa phát hiện
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/message.service.js`
- [x] Controllers (1): `src/controllers/message.controller.js`
- [x] Routes: 18
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 14
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

### notification Module

- [x] Models (4): `src/models/notifications/notification-delivery.model.js`, `src/models/notifications/notification-preference.model.js`, `src/models/notifications/notification-template.model.js`, `src/models/notifications/notification.model.js`
- [x] Repositories (1): `src/repositories/notification.repository.js`
- [x] Services (1): `src/services/notification.service.js`
- [x] Controllers (1): `src/controllers/notification.controller.js`
- [x] Routes: 13
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 8
- [ ] Service exports chưa được controller gọi trực tiếp: 15
- Trạng thái: Cần rà bảo mật/validation

### order Module

- [x] Models (1): `src/models/orders/order.model.js`
- [x] Repositories (1): `src/repositories/order.repository.js`
- [x] Services (1): `src/services/order.service.js`
- [x] Controllers (1): `src/controllers/order.controller.js`
- [x] Routes: 18
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 9
- [ ] Service exports chưa được controller gọi trực tiếp: 10
- Trạng thái: Cần rà bảo mật/validation

### patient Module

- [x] Models (6): `src/models/patients/patient-account.model.js`, `src/models/patients/patient-authorization.model.js`, `src/models/patients/patient-identifier.model.js`, `src/models/patients/patient-profile-change-request.model.js`, `src/models/patients/patient-relative.model.js`, `src/models/patients/patient.model.js`
- [x] Repositories (1): `src/repositories/patient.repository.js`
- [x] Services (2): `src/services/patient.service.js`, `src/services/portal.service.js`
- [x] Controllers (2): `src/controllers/patient.controller.js`, `src/controllers/portal.controller.js`
- [x] Routes: 56
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 5
- [ ] Validation cần rà: 28
- [ ] Service exports chưa được controller gọi trực tiếp: 9
- Trạng thái: Cần rà bảo mật/validation

### portal Module

- [ ] Models (0): chưa phát hiện
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/portal.service.js`
- [x] Controllers (1): `src/controllers/portal.controller.js`
- [x] Routes: 15
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 5
- [ ] Validation cần rà: 8
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

### prescription Module

- [x] Models (9): `src/models/pharmacy/dispense-item.model.js`, `src/models/pharmacy/dispense.model.js`, `src/models/pharmacy/inventory-transaction.model.js`, `src/models/pharmacy/medication-administration.model.js`, `src/models/pharmacy/medication-master.model.js`, `src/models/pharmacy/prescription-item.model.js`, `src/models/pharmacy/prescription-refill-request.model.js`, `src/models/pharmacy/prescription.model.js`, `src/models/pharmacy/stock-batch.model.js`
- [x] Repositories (1): `src/repositories/pharmacy.repository.js`
- [x] Services (1): `src/services/prescription.service.js`
- [x] Controllers (1): `src/controllers/prescription.controller.js`
- [x] Routes: 55
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 34
- [ ] Service exports chưa được controller gọi trực tiếp: 12
- Trạng thái: Cần rà bảo mật/validation

### procedure Module

- [x] Models (1): `src/models/procedures/procedure-order.model.js`
- [x] Repositories (1): `src/repositories/procedure.repository.js`
- [x] Services (1): `src/services/procedure.service.js`
- [x] Controllers (1): `src/controllers/procedure.controller.js`
- [x] Routes: 18
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 7
- [ ] Service exports chưa được controller gọi trực tiếp: 10
- Trạng thái: Cần rà bảo mật/validation

### qr-token Module

- [ ] Models (0): chưa phát hiện
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/qr-token.service.js`
- [x] Controllers (1): `src/controllers/qr-token.controller.js`
- [x] Routes: 6
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 1
- [ ] Validation cần rà: 5
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Lỗi nối dây/bảo mật

### queue Module

- [x] Models (5): `src/models/scheduling/appointment-waitlist.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (1): `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/queue.service.js`
- [x] Controllers (1): `src/controllers/queue.controller.js`
- [x] Routes: 22
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 14
- [ ] Service exports chưa được controller gọi trực tiếp: 6
- Trạng thái: Cần rà bảo mật/validation

### records Module

- [x] Models (3): `src/models/records/attachment.model.js`, `src/models/records/document-export-request.model.js`, `src/models/records/medical-record.model.js`
- [x] Repositories (1): `src/repositories/records.repository.js`
- [x] Services (2): `src/services/records.service.js`, `src/services/portal.service.js`
- [x] Controllers (2): `src/controllers/records.controller.js`, `src/controllers/portal.controller.js`
- [x] Routes: 33
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 1
- [ ] Validation cần rà: 15
- [ ] Service exports chưa được controller gọi trực tiếp: 4
- Trạng thái: Lỗi nối dây/bảo mật

### reports Module

- [x] Models (27): `src/models/admin/doctor-profile.model.js`, `src/models/admin/system-setting.model.js`, `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`, `src/models/billing/charge.model.js`, `src/models/billing/insurance-claim.model.js`, `src/models/billing/insurance-policy.model.js`, `src/models/billing/invoice-item.model.js`, `src/models/billing/invoice.model.js`, `src/models/billing/payment-gateway-event.model.js`, `src/models/billing/payment-intent.model.js`, `src/models/billing/payment.model.js`, `src/models/billing/service-catalog.model.js`, `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`, `src/models/scheduling/appointment-waitlist.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (4): `src/repositories/admin.repository.js`, `src/repositories/billing.repository.js`, `src/repositories/clinical.repository.js`, `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/report.service.js`
- [x] Controllers (1): `src/controllers/reports.controller.js`
- [x] Routes: 8
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [x] Validation cần rà: 0
- [ ] Service exports chưa được controller gọi trực tiếp: 1
- Trạng thái: Ổn kỹ thuật

### schedule Module

- [x] Models (5): `src/models/scheduling/appointment-waitlist.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (1): `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/schedule.service.js`
- [x] Controllers (1): `src/controllers/schedule.controller.js`
- [x] Routes: 42
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 17
- [ ] Service exports chưa được controller gọi trực tiếp: 12
- Trạng thái: Cần rà bảo mật/validation

### staff Module

- [x] Models (8): `src/models/admin/doctor-profile.model.js`, `src/models/admin/system-setting.model.js`, `src/models/iam/department.model.js`, `src/models/iam/permission.model.js`, `src/models/iam/role-permission.model.js`, `src/models/iam/role.model.js`, `src/models/iam/user-role.model.js`, `src/models/iam/user.model.js`
- [x] Repositories (2): `src/repositories/iam.repository.js`, `src/repositories/admin.repository.js`
- [x] Services (1): `src/services/staff.service.js`
- [x] Controllers (1): `src/controllers/staff.controller.js`
- [x] Routes: 26
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 12
- [ ] Service exports chưa được controller gọi trực tiếp: 7
- Trạng thái: Cần rà bảo mật/validation

### support-ticket Module

- [ ] Models (0): chưa phát hiện
- [ ] Repositories (0): chưa phát hiện
- [x] Services (1): `src/services/support-ticket.service.js`
- [x] Controllers (1): `src/controllers/support-ticket.controller.js`
- [x] Routes: 10
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 8
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

## Ghi Chú Diễn Giải

- `Service exports chưa được controller gọi trực tiếp` không luôn là lỗi: nhiều hàm là helper nội bộ, hàm dùng bởi service khác, hoặc API chưa mở ra UI.
- `Mutating routes without explicit route-level validation middleware` là cảnh báo route-level. Một số validation hiện đang nằm trong service, nhưng nếu muốn frontend/API ổn định hơn thì nên thêm validator ở route/controller boundary.
- `Actor-only routes` thường đúng với API `/my`, patient portal hoặc public-staff scope, nhưng cần rà owner check trong service.

