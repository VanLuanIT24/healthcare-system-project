const { Appointment, DoctorSchedule, QueueTicket, ScheduleSlot } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  appointmentRepository: Appointment,
  doctorScheduleRepository: DoctorSchedule,
  queueTicketRepository: QueueTicket,
  scheduleSlotRepository: ScheduleSlot,
});
