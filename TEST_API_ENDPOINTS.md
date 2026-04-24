# Test API Endpoints - Receptionist Dashboard

## Cách Test API

### Dùng cURL
```bash
# Lấy token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"receptionist","password":"Receptionist@123456"}'

# Copy lấy token từ response, rồi dùng nó trong các request tiếp theo
# Ví dụ:
curl -X GET http://localhost:3000/api/patients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Dùng Postman
1. Import collection này hoặc tạo manual
2. Set base URL: `http://localhost:3000/api`
3. Add Header: `Authorization: Bearer {token}`

---

## 📊 Sample API Responses

### 1️⃣ GET /patients
```json
{
  "data": {
    "items": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0",
        "patient_code": "PT001",
        "full_name": "Lê Văn Sơn",
        "date_of_birth": "1980-05-15",
        "gender": "male",
        "phone": "+84912345678",
        "email": "levanson@email.com",
        "address": "123 Đường 1, Quận 1, TP.HCM",
        "national_id": "123456789012",
        "insurance_number": "INS-001-2024",
        "status": "active"
      },
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j1",
        "patient_code": "PT002",
        "full_name": "Nguyễn Thị Hoa",
        ...
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 10,
      "pages": 1
    }
  }
}
```

### 2️⃣ GET /appointments
```json
{
  "data": {
    "items": [
      {
        "appointment_id": "65a1b2c3d4e5f6g7...",
        "patient_id": "65a1b2c3d4e5f6...",
        "doctor_id": "65a1b2c3d4e5f6...",
        "department_id": "65a1b2c3d4e5f6...",
        "appointment_time": "2024-04-20T09:00:00.000Z",
        "appointment_type": "outpatient",
        "reason": "General Checkup",
        "status": "confirmed",
        "source": "Online"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 20,
      "pages": 2
    }
  }
}
```

### 3️⃣ GET /staff
```json
{
  "data": {
    "items": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0",
        "username": "dr_nguyen",
        "full_name": "Dr. Nguyễn Văn A",
        "email": "dr.nguyen@hospital.com",
        "phone": "+84905111111",
        "employee_code": "DR001",
        "department_id": "65a1b2c3d4e5f6...",
        "status": "active",
        "last_login_at": "2024-04-19T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 4️⃣ GET /queue/departments
```json
{
  "data": {
    "items": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0",
        "department_code": "GEN_MED",
        "department_name": "General Medicine",
        "department_type": "Clinical",
        "status": "active",
        "waitingPatients": 3,
        "inServicePatients": 1,
        "totalActive": 4
      },
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j1",
        "department_code": "CARD",
        "department_name": "Cardiology",
        "waitingPatients": 2,
        "inServicePatients": 0,
        "totalActive": 2
      }
    ]
  }
}
```

### 5️⃣ GET /dashboard/recent-activity
```json
{
  "data": {
    "items": [
      {
        "id": "65a1b2c3d4e5f6g7h8i9j0",
        "type": "appointment",
        "action": "Appointment confirmed",
        "description": "Lê Văn Sơn with Dr. Nguyễn Văn A",
        "timestamp": "2024-04-19T14:30:00.000Z",
        "status": "confirmed"
      },
      {
        "id": "65a1b2c3d4e5f6g7h8i9j1",
        "type": "queue",
        "action": "Queue waiting",
        "description": "Nguyễn Thị Hoa - Ticket: N-001-2024-001",
        "timestamp": "2024-04-19T14:25:00.000Z",
        "status": "waiting"
      }
    ]
  }
}
```

### 6️⃣ GET /dashboard/doctor-status
```json
{
  "data": {
    "items": [
      {
        "doctorId": "65a1b2c3d4e5f6g7h8i9j0",
        "name": "Dr. Nguyễn Văn A",
        "email": "dr.nguyen@hospital.com",
        "phone": "+84905111111",
        "department": "General Medicine",
        "status": "busy",
        "todayAppointments": 5,
        "completedAppointments": 2,
        "waitingPatients": 1,
        "lastLogin": "2024-04-19T08:00:00.000Z"
      },
      {
        "doctorId": "65a1b2c3d4e5f6g7h8i9j1",
        "name": "Dr. Trần Thị B",
        "email": "dr.tran@hospital.com",
        "department": "Cardiology",
        "status": "available",
        "todayAppointments": 3,
        "completedAppointments": 0,
        "waitingPatients": 0,
        "lastLogin": "2024-04-19T09:15:00.000Z"
      }
    ]
  }
}
```

### 7️⃣ GET /dashboard/stats
```json
{
  "data": {
    "appointmentsToday": 12,
    "completedToday": 4,
    "waitingPatients": 8,
    "activeDoctors": 5,
    "activePatients": 8,
    "completionRate": 33
  }
}
```

### 8️⃣ GET /dashboard/upcoming-appointments
```json
{
  "data": {
    "items": [
      {
        "id": "65a1b2c3d4e5f6g7h8i9j0",
        "patientName": "Lê Văn Sơn",
        "patientPhone": "+84912345678",
        "doctorName": "Dr. Nguyễn Văn A",
        "department": "General Medicine",
        "appointmentTime": "2024-04-20T09:00:00.000Z",
        "status": "confirmed",
        "type": "outpatient",
        "reason": "General Checkup"
      }
    ]
  }
}
```

### 9️⃣ POST /appointments (Create Appointment)
**Request:**
```json
{
  "patient_id": "65a1b2c3d4e5f6g7h8i9j0",
  "doctor_id": "65a1b2c3d4e5f6g7h8i9j1",
  "department_id": "65a1b2c3d4e5f6g7h8i9j2",
  "appointment_time": "2024-04-20T10:00:00Z",
  "appointment_type": "outpatient",
  "reason": "Follow-up consultation",
  "notes": "Patient requested morning slot"
}
```

**Response:**
```json
{
  "data": {
    "appointment_id": "65a1b2c3d4e5f6g7h8i9j0",
    "patient_id": "65a1b2c3d4e5f6g7h8i9j0",
    "doctor_id": "65a1b2c3d4e5f6g7h8i9j1",
    "appointment_time": "2024-04-20T10:00:00.000Z",
    "status": "booked",
    "created_at": "2024-04-19T15:00:00.000Z"
  }
}
```

### 🔟 POST /appointments/:appointmentId/check-in
**Request:** (No body needed)

**Response:**
```json
{
  "data": {
    "appointment_id": "65a1b2c3d4e5f6g7h8i9j0",
    "status": "checked_in",
    "checkin_time": "2024-04-19T15:05:00.000Z",
    "queue_ticket_id": "65a1b2c3d4e5f6g7h8i9j5"
  }
}
```

---

## 🔄 API Endpoints Tóm Tắt

| Method | Endpoint | Mô Tả |
|--------|----------|-------|
| GET | /patients | Danh sách bệnh nhân |
| GET | /patients/:id | Chi tiết bệnh nhân |
| POST | /patients | Tạo bệnh nhân mới |
| GET | /staff | Danh sách nhân viên |
| GET | /appointments | Danh sách lịch hẹn |
| POST | /appointments | Tạo lịch hẹn |
| POST | /appointments/:id/check-in | Check-in bệnh nhân |
| GET | /queue/departments | Danh sách phòng ban |
| GET | /dashboard/recent-activity | Hoạt động gần đây |
| GET | /dashboard/doctor-status | Trạng thái bác sĩ |
| GET | /dashboard/stats | Thống kê tổng quan |

---

## 🧪 Frontend Test

### Trong `useReceptionistData.js` Hook
```javascript
const {
  patients,      // 10 bệnh nhân từ API
  doctors,       // 5 bác sĩ từ API
  appointments,  // 20 lịch hẹn từ API
  queueDepartments,  // 7 phòng ban
  recentActivity,    // Hoạt động gần đây
  doctorStatus,      // Trạng thái bác sĩ
  loading,
  error
} = useReceptionistData()
```

Tất cả dữ liệu sẽ được populate từ database thực!

---

## ⚠️ Lưu Ý

- Tất cả request đều cần **Authorization header** với Bearer token
- Token có thể lấy từ `/auth/login` endpoint
- Response format theo convention: `{ data: {...}, message: "..." }`
- Pagination support: `limit`, `offset` hoặc `page` parameters
