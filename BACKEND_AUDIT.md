# BACKEND AUDIT

Generated: 2026-05-12T14:27:39.619Z

## Tổng quan

- Route files scanned: 24
- Routes scanned: 677
- Controller files scanned: 23
- Service files scanned: 54
- Model files scanned: 61
- Repository files scanned: 20

## Ma Trận Module

| Module | Priority | Models | Repository | Service | Controller | Routes | Permission/Auth Issues | Validation Issues | Trạng thái |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| admin | 1 | 8 | 2 | 1 | 1 | 45 | 0 | 24 | Cần rà bảo mật/validation |
| appointment | 1 | 4 | 1 | 1 | 1 | 41 | 5 | 21 | Cần rà bảo mật/validation |
| audit | 3 | 3 | 1 | 1 | 1 | 6 | 0 | 3 | Cần rà bảo mật/validation |
| auth | 1 | 14 | 1 | 1 | 1 | 37 | 3 | 29 | Cần rà bảo mật/validation |
| billing | 2 | 7 | 1 | 1 | 1 | 45 | 0 | 22 | Lỗi nối dây/bảo mật |
| clinical | 1 | 8 | 1 | 1 | 1 | 55 | 0 | 39 | Cần rà bảo mật/validation |
| dashboard | 3 | 24 | 4 | 1 | 1 | 5 | 0 | 0 | Ổn kỹ thuật |
| department | 1 | 6 | 2 | 1 | 1 | 19 | 0 | 6 | Cần rà bảo mật/validation |
| encounter | 1 | 8 | 1 | 2 | 2 | 30 | 0 | 14 | Lỗi nối dây/bảo mật |
| iam | 1 | 6 | 1 | 1 | 1 | 27 | 0 | 14 | Cần rà bảo mật/validation |
| imaging | 2 | 2 | 1 | 1 | 1 | 26 | 0 | 14 | Cần rà bảo mật/validation |
| inpatient | 2 | 4 | 1 | 1 | 1 | 29 | 0 | 15 | Cần rà bảo mật/validation |
| laboratory | 2 | 4 | 1 | 1 | 1 | 31 | 0 | 20 | Lỗi nối dây/bảo mật |
| notification | 3 | 1 | 1 | 1 | 1 | 13 | 0 | 8 | Cần rà bảo mật/validation |
| order | 2 | 1 | 1 | 1 | 1 | 18 | 0 | 9 | Lỗi nối dây/bảo mật |
| patient | 1 | 5 | 1 | 1 | 1 | 54 | 5 | 26 | Cần rà bảo mật/validation |
| prescription | 2 | 8 | 1 | 1 | 1 | 55 | 0 | 34 | Lỗi nối dây/bảo mật |
| procedure | 2 | 1 | 1 | 1 | 1 | 18 | 0 | 7 | Cần rà bảo mật/validation |
| queue | 2 | 4 | 1 | 1 | 1 | 18 | 0 | 12 | Cần rà bảo mật/validation |
| records | 2 | 2 | 1 | 1 | 1 | 30 | 0 | 13 | Cần rà bảo mật/validation |
| reports | 3 | 24 | 4 | 1 | 1 | 8 | 0 | 0 | Ổn kỹ thuật |
| schedule | 1 | 4 | 1 | 1 | 1 | 41 | 0 | 17 | Cần rà bảo mật/validation |
| staff | 1 | 8 | 2 | 1 | 1 | 26 | 0 | 12 | Cần rà bảo mật/validation |

## Phát Hiện Quan Trọng

- Missing route -> controller exports: 0
- Controller calls missing service exports: 138
- Routes without auth: 0
- Protected routes without specific permission guard: 0
- Self-service auth-only routes: 13
- Actor-only guarded routes: 13
- Routes missing ObjectId param validation: 3
- Mutating routes without explicit route-level validation middleware: 356
- Controller exports not routed: 0
- Service exports not called by controllers: 437

### Lỗi Nối Dây

- [ ] src/controllers/billing.controller.js gọi billingService.createServiceCatalog, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listServiceCatalog, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getServiceCatalogDetail, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.updateServiceCatalog, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.retireServiceCatalog, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.createCharge, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listCharges, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getChargeDetail, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.postCharge, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.voidCharge, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.createInvoiceFromCharges, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listInvoices, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getInvoiceDetail, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.issueInvoice, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.voidInvoice, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getPatientBillingSummary, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getPatientBillingSummary, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listInvoices, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.createPayment, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listPayments, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getPaymentDetail, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.voidPayment, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.refundPayment, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listPayments, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.createInsurancePolicy, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listInsurancePolicies, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getInsurancePolicyDetail, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.updateInsurancePolicy, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.cancelInsurancePolicy, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listInsurancePolicies, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.createInsuranceClaim, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listInsuranceClaims, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.getInsuranceClaimDetail, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.submitClaim, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.markClaimUnderReview, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.approveClaim, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.rejectClaim, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.settleClaim, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.cancelClaim, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/billing.controller.js gọi billingService.listInsuranceClaims, nhưng src/services/billing.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.listLabOrders, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.getLabOrderDetail, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.acknowledgeLabOrder, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.cancelLabOrder, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.createSpecimen, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.collectSpecimen, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.getSpecimenDetail, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.receiveSpecimen, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.rejectSpecimen, nhưng src/services/laboratory.service.js không export hàm này.
- [ ] src/controllers/laboratory.controller.js gọi laboratoryService.processSpecimen, nhưng src/services/laboratory.service.js không export hàm này.
- ... và 88 mục khác

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
- GET /schedules/:scheduleId/available-slots (src/routes/schedule.routes.js:14)

Routes without auth:
- [x] Không phát hiện route thiếu auth ngoài nhóm public.

Actor-only routes cần rà owner/scope trong service:
- [ ] GET /appointments/my (src/routes/appointment.routes.js:17)
- [ ] POST /appointments/portal (src/routes/appointment.routes.js:18)
- [ ] GET /appointments/my/:appointmentId (src/routes/appointment.routes.js:19)
- [ ] POST /appointments/my/:appointmentId/cancel (src/routes/appointment.routes.js:20)
- [ ] POST /appointments/my/:appointmentId/reschedule (src/routes/appointment.routes.js:21)
- [ ] PATCH /auth/patient/account/email (src/routes/auth.routes.js:92)
- [ ] PATCH /auth/patient/account/phone (src/routes/auth.routes.js:93)
- [ ] PATCH /auth/patient/account/username (src/routes/auth.routes.js:94)
- [ ] GET /patients/me/profile (src/routes/patient.routes.js:19)
- [ ] PATCH /patients/me/profile (src/routes/patient.routes.js:20)
- [ ] GET /patients/me/appointments (src/routes/patient.routes.js:21)
- [ ] GET /patients/me/encounters (src/routes/patient.routes.js:22)
- [ ] GET /patients/me/prescriptions (src/routes/patient.routes.js:23)

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
- [ ] GET /audit-logs/actor/:actorType/:actorId (src/routes/audit.routes.js:24) thiếu validateObjectIdParam cho: actorId
- [ ] GET /audit-logs/entity/:targetType/:targetId (src/routes/audit.routes.js:25) thiếu validateObjectIdParam cho: targetId
- [ ] GET /audit-logs/login-history/:actorType/:actorId (src/routes/audit.routes.js:26) thiếu validateObjectIdParam cho: actorId

Mutating routes without explicit route-level validation middleware:
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
- [ ] POST /appointments/portal (src/routes/appointment.routes.js:18)
- [ ] POST /appointments/my/:appointmentId/cancel (src/routes/appointment.routes.js:20)
- [ ] POST /appointments/my/:appointmentId/reschedule (src/routes/appointment.routes.js:21)
- [ ] POST /appointments/check-doctor-availability (src/routes/appointment.routes.js:29)
- [ ] POST /appointments/check-patient-duplicate (src/routes/appointment.routes.js:30)
- [ ] POST /appointments/check-doctor-conflict (src/routes/appointment.routes.js:33)
- [ ] POST /appointments/check-patient-conflict (src/routes/appointment.routes.js:34)
- [ ] POST /appointments (src/routes/appointment.routes.js:35)
- [ ] POST /appointments/staff-create (src/routes/appointment.routes.js:36)
- [ ] POST /appointments/bulk-confirm (src/routes/appointment.routes.js:37)
- [ ] POST /appointments/bulk-cancel (src/routes/appointment.routes.js:38)
- [ ] PATCH /appointments/:appointmentId (src/routes/appointment.routes.js:52)
- [ ] POST /appointments/:appointmentId/confirm (src/routes/appointment.routes.js:53)
- [ ] POST /appointments/:appointmentId/cancel (src/routes/appointment.routes.js:54)
- [ ] POST /appointments/:appointmentId/reschedule (src/routes/appointment.routes.js:55)
- [ ] POST /appointments/:appointmentId/check-in (src/routes/appointment.routes.js:56)
- [ ] POST /appointments/:appointmentId/no-show (src/routes/appointment.routes.js:57)
- [ ] POST /appointments/:appointmentId/complete (src/routes/appointment.routes.js:58)
- [ ] POST /appointments/:appointmentId/queue-ticket (src/routes/appointment.routes.js:59)
- [ ] POST /appointments/:appointmentId/encounter (src/routes/appointment.routes.js:60)
- [ ] POST /appointments/:appointmentId/link-encounter (src/routes/appointment.routes.js:61)
- [ ] POST /auth/staff/login (src/routes/auth.routes.js:55)
- [ ] POST /auth/patients/register (src/routes/auth.routes.js:57)
- [ ] POST /auth/patients/login (src/routes/auth.routes.js:58)
- [ ] POST /auth/patient/register (src/routes/auth.routes.js:59)
- [ ] POST /auth/patient/login (src/routes/auth.routes.js:60)
- [ ] POST /auth/forgot-password (src/routes/auth.routes.js:62)
- [ ] POST /auth/verify-reset-token (src/routes/auth.routes.js:63)
- [ ] POST /auth/reset-password (src/routes/auth.routes.js:64)
- [ ] POST /auth/refresh-token (src/routes/auth.routes.js:65)
- [ ] POST /auth/logout (src/routes/auth.routes.js:66)
- [ ] POST /auth/change-password (src/routes/auth.routes.js:67)
- [ ] PATCH /auth/me (src/routes/auth.routes.js:69)
- [ ] DELETE /auth/me/sessions/others (src/routes/auth.routes.js:74)
- [ ] PATCH /auth/me/sessions/:sessionId/device (src/routes/auth.routes.js:75)
- [ ] DELETE /auth/me/sessions/:sessionId (src/routes/auth.routes.js:76)
- ... và 296 mục khác

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
- [ ] Service exports chưa được controller gọi trực tiếp: 29
- Trạng thái: Cần rà bảo mật/validation

### appointment Module

- [x] Models (4): `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (1): `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/appointment.service.js`
- [x] Controllers (1): `src/controllers/appointment.controller.js`
- [x] Routes: 41
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 5
- [ ] Validation cần rà: 21
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
- [ ] Validation cần rà: 3
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Cần rà bảo mật/validation

### auth Module

- [x] Models (14): `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`, `src/models/iam/department.model.js`, `src/models/iam/permission.model.js`, `src/models/iam/role-permission.model.js`, `src/models/iam/role.model.js`, `src/models/iam/user-role.model.js`, `src/models/iam/user.model.js`, `src/models/patients/patient-account.model.js`, `src/models/patients/patient-authorization.model.js`, `src/models/patients/patient-identifier.model.js`, `src/models/patients/patient-relative.model.js`, `src/models/patients/patient.model.js`
- [x] Repositories (1): `src/repositories/auth.repository.js`
- [x] Services (1): `src/services/auth.service.js`
- [x] Controllers (1): `src/controllers/auth.controller.js`
- [x] Routes: 37
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 3
- [ ] Validation cần rà: 29
- [ ] Service exports chưa được controller gọi trực tiếp: 31
- Trạng thái: Cần rà bảo mật/validation

### billing Module

- [x] Models (7): `src/models/billing/charge.model.js`, `src/models/billing/insurance-claim.model.js`, `src/models/billing/insurance-policy.model.js`, `src/models/billing/invoice-item.model.js`, `src/models/billing/invoice.model.js`, `src/models/billing/payment.model.js`, `src/models/billing/service-catalog.model.js`
- [x] Repositories (1): `src/repositories/billing.repository.js`
- [x] Services (1): `src/services/billing.service.js`
- [x] Controllers (1): `src/controllers/billing.controller.js`
- [x] Routes: 45
- [x] Route gọi controller tồn tại: 0 lỗi
- [ ] Controller gọi service export tồn tại: 40 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 22
- [x] Service exports chưa được controller gọi trực tiếp: 0
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

- [x] Models (24): `src/models/admin/doctor-profile.model.js`, `src/models/admin/system-setting.model.js`, `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`, `src/models/billing/charge.model.js`, `src/models/billing/insurance-claim.model.js`, `src/models/billing/insurance-policy.model.js`, `src/models/billing/invoice-item.model.js`, `src/models/billing/invoice.model.js`, `src/models/billing/payment.model.js`, `src/models/billing/service-catalog.model.js`, `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
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

### encounter Module

- [x] Models (8): `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`
- [x] Repositories (1): `src/repositories/clinical.repository.js`
- [x] Services (2): `src/services/encounter.service.js`, `src/services/order.service.js`
- [x] Controllers (2): `src/controllers/encounter.controller.js`, `src/controllers/order.controller.js`
- [x] Routes: 30
- [x] Route gọi controller tồn tại: 0 lỗi
- [ ] Controller gọi service export tồn tại: 19 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 14
- [ ] Service exports chưa được controller gọi trực tiếp: 4
- Trạng thái: Lỗi nối dây/bảo mật

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

- [x] Models (2): `src/models/imaging/imaging-order.model.js`, `src/models/imaging/imaging-report.model.js`
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

- [x] Models (4): `src/models/inpatient/admission.model.js`, `src/models/inpatient/bed-assignment.model.js`, `src/models/inpatient/bed.model.js`, `src/models/inpatient/room.model.js`
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

- [x] Models (4): `src/models/laboratory/lab-order.model.js`, `src/models/laboratory/lab-result-item.model.js`, `src/models/laboratory/lab-result.model.js`, `src/models/laboratory/specimen.model.js`
- [x] Repositories (1): `src/repositories/laboratory.repository.js`
- [x] Services (1): `src/services/laboratory.service.js`
- [x] Controllers (1): `src/controllers/laboratory.controller.js`
- [x] Routes: 31
- [x] Route gọi controller tồn tại: 0 lỗi
- [ ] Controller gọi service export tồn tại: 27 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 20
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Lỗi nối dây/bảo mật

### notification Module

- [x] Models (1): `src/models/notifications/notification.model.js`
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
- [ ] Controller gọi service export tồn tại: 19 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 9
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Lỗi nối dây/bảo mật

### patient Module

- [x] Models (5): `src/models/patients/patient-account.model.js`, `src/models/patients/patient-authorization.model.js`, `src/models/patients/patient-identifier.model.js`, `src/models/patients/patient-relative.model.js`, `src/models/patients/patient.model.js`
- [x] Repositories (1): `src/repositories/patient.repository.js`
- [x] Services (1): `src/services/patient.service.js`
- [x] Controllers (1): `src/controllers/patient.controller.js`
- [x] Routes: 54
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [ ] Auth/permission cần rà: 5
- [ ] Validation cần rà: 26
- [ ] Service exports chưa được controller gọi trực tiếp: 4
- Trạng thái: Cần rà bảo mật/validation

### prescription Module

- [x] Models (8): `src/models/pharmacy/dispense-item.model.js`, `src/models/pharmacy/dispense.model.js`, `src/models/pharmacy/inventory-transaction.model.js`, `src/models/pharmacy/medication-administration.model.js`, `src/models/pharmacy/medication-master.model.js`, `src/models/pharmacy/prescription-item.model.js`, `src/models/pharmacy/prescription.model.js`, `src/models/pharmacy/stock-batch.model.js`
- [x] Repositories (1): `src/repositories/pharmacy.repository.js`
- [x] Services (1): `src/services/prescription.service.js`
- [x] Controllers (1): `src/controllers/prescription.controller.js`
- [x] Routes: 55
- [x] Route gọi controller tồn tại: 0 lỗi
- [ ] Controller gọi service export tồn tại: 52 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 34
- [x] Service exports chưa được controller gọi trực tiếp: 0
- Trạng thái: Lỗi nối dây/bảo mật

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

### queue Module

- [x] Models (4): `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (1): `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/queue.service.js`
- [x] Controllers (1): `src/controllers/queue.controller.js`
- [x] Routes: 18
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 12
- [ ] Service exports chưa được controller gọi trực tiếp: 6
- Trạng thái: Cần rà bảo mật/validation

### records Module

- [x] Models (2): `src/models/records/attachment.model.js`, `src/models/records/medical-record.model.js`
- [x] Repositories (1): `src/repositories/records.repository.js`
- [x] Services (1): `src/services/records.service.js`
- [x] Controllers (1): `src/controllers/records.controller.js`
- [x] Routes: 30
- [x] Route gọi controller tồn tại: 0 lỗi
- [x] Controller gọi service export tồn tại: 0 lỗi
- [x] Auth/permission cần rà: 0
- [ ] Validation cần rà: 13
- [ ] Service exports chưa được controller gọi trực tiếp: 4
- Trạng thái: Cần rà bảo mật/validation

### reports Module

- [x] Models (24): `src/models/admin/doctor-profile.model.js`, `src/models/admin/system-setting.model.js`, `src/models/auth/audit-log.model.js`, `src/models/auth/auth-session.model.js`, `src/models/auth/password-reset-token.model.js`, `src/models/billing/charge.model.js`, `src/models/billing/insurance-claim.model.js`, `src/models/billing/insurance-policy.model.js`, `src/models/billing/invoice-item.model.js`, `src/models/billing/invoice.model.js`, `src/models/billing/payment.model.js`, `src/models/billing/service-catalog.model.js`, `src/models/clinical/allergy.model.js`, `src/models/clinical/care-plan.model.js`, `src/models/clinical/clinical-note.model.js`, `src/models/clinical/consultation.model.js`, `src/models/clinical/diagnosis.model.js`, `src/models/clinical/encounter.model.js`, `src/models/clinical/problem-list.model.js`, `src/models/clinical/vital-sign.model.js`, `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
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

- [x] Models (4): `src/models/scheduling/appointment.model.js`, `src/models/scheduling/doctor-schedule.model.js`, `src/models/scheduling/queue-ticket.model.js`, `src/models/scheduling/schedule-slot.model.js`
- [x] Repositories (1): `src/repositories/scheduling.repository.js`
- [x] Services (1): `src/services/schedule.service.js`
- [x] Controllers (1): `src/controllers/schedule.controller.js`
- [x] Routes: 41
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

## Ghi Chú Diễn Giải

- `Service exports chưa được controller gọi trực tiếp` không luôn là lỗi: nhiều hàm là helper nội bộ, hàm dùng bởi service khác, hoặc API chưa mở ra UI.
- `Mutating routes without explicit route-level validation middleware` là cảnh báo route-level. Một số validation hiện đang nằm trong service, nhưng nếu muốn frontend/API ổn định hơn thì nên thêm validator ở route/controller boundary.
- `Actor-only routes` thường đúng với API `/my`, patient portal hoặc public-staff scope, nhưng cần rà owner check trong service.

