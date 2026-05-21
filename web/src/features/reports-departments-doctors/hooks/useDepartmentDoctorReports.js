import { reportsDepartmentsDoctorsApi } from '../api/reportsDepartmentsDoctorsApi';
import { useDepartmentDoctorReport } from './useDepartmentDoctorFilters';

export const useDepartmentPerformanceReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.departmentPerformance);
export const useDepartmentLoadReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.departmentLoad);
export const useDepartmentAppointmentsReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.departmentAppointments);
export const useDepartmentQueueReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.departmentQueue);
export const useDepartmentRevenueReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.departmentRevenue);
export const useDepartmentStaffReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.departmentStaff);
export const useDoctorPerformanceReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.doctorPerformance);
export const useDoctorUtilizationReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.doctorUtilization);
export const useDoctorNoShowReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.doctorNoShow);
export const useFollowUpReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.followUp);
export const usePersonalDoctorReport = () => useDepartmentDoctorReport(reportsDepartmentsDoctorsApi.personalReport);
