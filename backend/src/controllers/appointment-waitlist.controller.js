const appointmentWaitlistService = require('../services/appointment-waitlist.service');
const { controllerHandler: wrap, requestMeta } = require('../common/controllers');

module.exports = {
  createWaitlist: wrap((req) => appointmentWaitlistService.createWaitlist(req.body, req.auth, requestMeta(req)), 'Tạo appointment waitlist thành công.', 201),
  listWaitlist: wrap((req) => appointmentWaitlistService.listWaitlist(req.query, req.auth), 'Lấy appointment waitlist thành công.'),
  offerSlot: wrap((req) => appointmentWaitlistService.offerSlot(req.params.waitlistId, req.body, req.auth, requestMeta(req)), 'Offer slot waitlist thành công.'),
  bookWaitlist: wrap((req) => appointmentWaitlistService.bookWaitlist(req.params.waitlistId, req.body, req.auth, requestMeta(req)), 'Book waitlist thành công.'),
  cancelWaitlist: wrap((req) => appointmentWaitlistService.cancelWaitlist(req.params.waitlistId, req.body, req.auth, requestMeta(req)), 'Cancel waitlist thành công.'),
};
