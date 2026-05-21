import { request, unwrapData } from '../../../utils/api';

const unwrap = (response) => unwrapData(response);

export const reportsDepartmentsDoctorsApi = {
  overview: (params) => request('/reports/departments-doctors/overview', { params }).then(unwrap),
  departmentPerformance: (params) => request('/reports/departments-doctors/department-performance', { params }).then(unwrap),
  departmentLoad: (params) => request('/reports/departments-doctors/department-load', { params }).then(unwrap),
  departmentAppointments: (params) => request('/reports/departments-doctors/department-appointments', { params }).then(unwrap),
  departmentQueue: (params) => request('/reports/departments-doctors/department-queue', { params }).then(unwrap),
  departmentRevenue: (params) => request('/reports/departments-doctors/department-revenue', { params }).then(unwrap),
  departmentStaff: (params) => request('/reports/departments-doctors/department-staff', { params }).then(unwrap),
  doctorPerformance: (params) => request('/reports/departments-doctors/doctor-performance', { params }).then(unwrap),
  doctorUtilization: (params) => request('/reports/departments-doctors/doctor-utilization', { params }).then(unwrap),
  doctorNoShow: (params) => request('/reports/departments-doctors/doctor-no-show', { params }).then(unwrap),
  followUp: (params) => request('/reports/departments-doctors/follow-up', { params }).then(unwrap),
  personalReport: (params) => request('/reports/departments-doctors/personal-report', { params }).then(unwrap),
  exportReport: (params) => request('/reports/export', { params }).then(unwrap),
};
