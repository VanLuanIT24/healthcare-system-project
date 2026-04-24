export const primaryNav = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'appointments', label: 'Appointments', icon: 'calendar', active: true },
  { id: 'patients', label: 'Patients', icon: 'patients' },
  { id: 'doctors', label: 'Doctors', icon: 'doctor' },
  { id: 'departments', label: 'Departments', icon: 'building' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
]

export const screens = [
  {
    id: 'list',
    step: '5.1',
    label: 'Appointment List',
    subtitle: 'Heavy-duty filtering for the scheduling control room.',
    endpoints: [
      'listAppointments',
      'searchAppointments',
      'listAppointmentsByPatient',
      'listAppointmentsByDoctor',
      'listAppointmentsByDepartment',
      'listUpcomingAppointments',
      'listTodayAppointments',
    ],
  },
  {
    id: 'create',
    step: '5.2',
    label: 'Staff Booking',
    subtitle: 'Front-desk booking flow for existing and walk-in patients.',
    endpoints: [
      'createAppointmentByStaff',
      'checkDoctorAvailability',
      'validateAppointmentSlot',
      'checkPatientDuplicateBooking',
    ],
  },
  {
    id: 'detail',
    step: '5.3',
    label: 'Appointment Detail',
    subtitle: 'Operational detail, linked queue ticket, encounter and audit trail.',
    endpoints: ['getAppointmentDetail', 'getAppointmentTimeline'],
  },
  {
    id: 'lifecycle',
    step: '5.4',
    label: 'Lifecycle Console',
    subtitle: 'Status orchestration for confirmation, check-in and completion.',
    endpoints: [
      'updateAppointment',
      'confirmAppointment',
      'cancelAppointment',
      'rescheduleAppointment',
      'checkInAppointment',
      'markAppointmentNoShow',
      'completeAppointment',
    ],
  },
  {
    id: 'summary',
    step: '5.5',
    label: 'Appointment Summary',
    subtitle: 'Daily, doctor and department level performance dashboard.',
    endpoints: ['getAppointmentSummary'],
  },
  {
    id: 'conflict',
    step: '5.6',
    label: 'Conflict Checker',
    subtitle: 'Pre-flight validation before staff commits a booking.',
    endpoints: [
      'checkAppointmentConflictForDoctor',
      'checkAppointmentConflictForPatient',
      'validateAppointmentTime',
    ],
  },
]

export const statusMeta = {
  booked: { label: 'Booked', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  checked_in: { label: 'Checked-In', tone: 'indigo' },
  in_consultation: { label: 'In Consultation', tone: 'orange' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  no_show: { label: 'No-Show', tone: 'amber' },
  rescheduled: { label: 'Rescheduled', tone: 'cyan' },
}

export const quickViews = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'critical', label: 'Critical' },
]

export const lifecycleTransitions = {
  booked: ['confirmed', 'cancelled', 'rescheduled', 'checked_in'],
  confirmed: ['checked_in', 'cancelled', 'rescheduled', 'no_show', 'completed'],
  checked_in: ['in_consultation', 'completed', 'cancelled'],
  in_consultation: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled: [],
}

export const lifecycleActions = [
  { id: 'confirmed', label: 'Confirm', icon: 'check' },
  { id: 'checked_in', label: 'Check-In', icon: 'queue' },
  { id: 'rescheduled', label: 'Reschedule', icon: 'shuffle' },
  { id: 'no_show', label: 'Mark No-Show', icon: 'slash' },
  { id: 'cancelled', label: 'Cancel', icon: 'cancel' },
  { id: 'completed', label: 'Complete', icon: 'spark' },
]

export const summaryRanges = ['Day', 'Week', 'Month']
