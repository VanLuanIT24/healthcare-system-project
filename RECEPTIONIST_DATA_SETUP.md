# Healthcare System - Receptionist Dashboard Data & API Reference

## Database Seed Data Summary
Successfully seeded the MongoDB database with the following test data:

### Roles (6 total)
- SUPER_ADMIN - Full system access
- ADMIN - Administrative access  
- DOCTOR - Healthcare provider
- NURSE - Nursing staff
- RECEPTIONIST - Front desk staff
- PHARMACIST - Pharmacy staff

### Departments (7 total)
1. General Medicine (GEN_MED)
2. Cardiology (CARD)
3. Pediatrics (PEDS)
4. Orthopedics (ORTHO)
5. Neurology (NEURO)
6. Pharmacy (PHARM)
7. Laboratory (LAB)

### Users/Staff (8 total)
- **admin** / Admin@123456 - Super Admin
- **receptionist** / Receptionist@123456 - Receptionist (TEST ACCOUNT)
- **dr_nguyen** / Doctor@123456 - Dr. Nguyễn Văn A (General Medicine)
- **dr_tran** / Doctor@123456 - Dr. Trần Thị B (Cardiology)
- **dr_hoang** / Doctor@123456 - Dr. Hoàng Văn C (Pediatrics)
- **dr_pham** / Doctor@123456 - Dr. Phạm Thị D (Orthopedics)
- **dr_le** / Doctor@123456 - Dr. Lê Văn E (Neurology)
- Plus additional staff members

### Patients (10 total)
- PT001-PT010 with full contact info, insurance numbers, emergency contacts
- Sample data: Lê Văn Sơn, Nguyễn Thị Hoa, Trần Đức Minh, etc.

### Appointments (20 total)
- Mix of statuses: booked, confirmed, checked_in, in_consultation, completed
- Various appointment types: outpatient, inpatient_followup, emergency, telemedicine
- Linked to doctors, patients, departments, and schedules

### Doctor Schedules (30 total)
- 2 schedules per doctor for scheduling appointments

---

## Backend API Endpoints

### Dashboard Endpoints (`/api/dashboard`)
- **GET /dashboard/recent-activity** - Get recent activities (appointments, queue, audit logs)
- **GET /dashboard/doctor-status** - Get doctor availability and workload stats
- **GET /dashboard/stats** - Overall dashboard statistics
- **GET /dashboard/upcoming-appointments** - Next 7 days of appointments

### Appointment Endpoints (`/api/appointments`)
- **GET /appointments** - List all appointments (supports filters: status, date, patient_id, doctor_id)
- **GET /appointments/:appointmentId** - Get appointment details
- **GET /appointments/by-date** - Get appointments by date
- **GET /appointments/today** - Get today's appointments
- **GET /appointments/upcoming** - Get upcoming appointments
- **POST /appointments** - Create new appointment
- **PATCH /appointments/:appointmentId** - Update appointment
- **POST /appointments/:appointmentId/check-in** - Check in patient
- **POST /appointments/:appointmentId/confirm** - Confirm appointment
- **POST /appointments/:appointmentId/cancel** - Cancel appointment

### Queue Endpoints (`/api/queue`)
- **GET /queue** - List queue tickets
- **GET /queue/departments** - Get departments with queue stats *(NEW)*
- **GET /queue/:ticketId** - Get queue ticket details
- **POST /queue** - Create queue ticket
- **GET /queue/department/:departmentId/board** - Department's queue board
- **GET /queue/summary/today** - Today's queue summary

### Patient Endpoints (`/api/patients`)
- **GET /patients** - List patients (support pagination)
- **GET /patients/:patientId** - Get patient details
- **GET /patients/search** - Search patients
- **POST /patients** - Create new patient

### Staff Endpoints (`/api/staff`)
- **GET /staff** - List staff/doctors
- **GET /staff/:staffId** - Get staff details
- **GET /staff/search** - Search staff
- **GET /staff/:staffId/schedule** - Get staff schedule

### Department Endpoints (`/api/departments`)
- **GET /departments** - List all departments
- **GET /departments/:departmentId** - Get department details

---

## Frontend - Receptionist Service (`web/src/services/receptionistService.js`)

All endpoints are already configured and ready to use:

### Patients API
```javascript
receptionistService.patients.list()           // Get all patients
receptionistService.patients.search(query)    // Search patients
receptionistService.patients.get(patientId)   // Get specific patient
receptionistService.patients.create(data)     // Create new patient
```

### Staff/Doctors API
```javascript
receptionistService.staff.list()              // Get all staff
receptionistService.staff.search(query)       // Search staff
receptionistService.staff.get(staffId)        // Get staff details
receptionistService.staff.getSchedule(staffId, date) // Get staff schedule
```

### Appointments API
```javascript
receptionistService.appointments.list()       // List all appointments
receptionistService.appointments.getPending() // Get pending/booked appointments
receptionistService.appointments.getByDate(date) // Get by date
```

### Queue API
```javascript
receptionistService.queue.getDepartments()    // Get queue departments
receptionistService.queue.list()              // List queue tickets
receptionistService.queue.getTodayQueueSummary() // Today's summary
```

### Dashboard API
```javascript
receptionistService.dashboard.getStats()           // Dashboard stats
receptionistService.dashboard.getRecentActivity()  // Recent activities
receptionistService.dashboard.getDoctorStatus()    // Doctor status
receptionistService.dashboard.getUpcomingAppointments() // Upcoming appointments
```

---

## Test Credentials for Receptionist Page

**Login as Receptionist:**
- Username: `receptionist`
- Password: `Receptionist@123456`

This account has permissions to:
- View all patients, appointments, and queue data
- Manage appointments (confirm, cancel, reschedule)
- Check in patients to queue
- View doctor availability
- Access dashboard and recent activities

---

## How to Use the Data

1. **Start Backend Server**: `cd backend && npm run dev`
2. **Start Frontend**: `cd web && npm run dev`
3. **Login** with receptionist credentials
4. **Receptionist Page** will automatically load all real data from the API
5. **Test Interactions**: Appointments, queue management, patient searches all use real database

---

## File Changes Made

### Backend
- ✅ `src/controllers/dashboard.controller.js` - NEW (Dashboard functionality)
- ✅ `src/routes/dashboard.routes.js` - NEW (Dashboard routes)
- ✅ `src/routes/index.js` - UPDATED (Added dashboard routes)
- ✅ `src/services/queue.service.js` - UPDATED (Added getDepartments method)
- ✅ `src/controllers/queue.controller.js` - UPDATED (Added getDepartments export)
- ✅ `src/routes/queue.routes.js` - UPDATED (Added /departments endpoint)

### Frontend
- ✅ `web/src/services/receptionistService.js` - UPDATED (Fixed API endpoints)

---

## Database Connection
- MongoDB URI: `mongodb://localhost:27017/healthcare-system`
- Database Name: `healthcare-system`
