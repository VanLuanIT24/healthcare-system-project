import { useState, useEffect } from 'react';
import receptionistService from '../services/receptionistService';

/**
 * Custom hook to fetch and manage receptionist dashboard data
 * Handles loading, errors, and provides refetch capability
 */
export default function useReceptionistData() {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [queueDepartments, setQueueDepartments] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [doctorStatus, setDoctorStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all data in parallel
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching receptionist data...');

      // Fetch all data in parallel using Promise.allSettled
      const [
        patientsRes,
        staffRes,
        appointmentsRes,
        queueRes,
      ] = await Promise.allSettled([
        receptionistService.patients.list(),
        receptionistService.staff.list(),
        receptionistService.appointments.list(),
        receptionistService.queue.list(),
      ]);

      console.log('✅ API responses:', {
        patientsRes,
        staffRes,
        appointmentsRes,
        queueRes,
      });

      // Handle patient data - Transform to UI format
      if (patientsRes.status === 'fulfilled') {
        console.log('📦 Raw patients response:', patientsRes.value.data);
        let patientsList = [];
        
        // Handle different response structures
        if (Array.isArray(patientsRes.value.data)) {
          patientsList = patientsRes.value.data;
        } else if (Array.isArray(patientsRes.value.data?.data)) {
          patientsList = patientsRes.value.data.data;
        } else if (patientsRes.value.data?.data && !Array.isArray(patientsRes.value.data.data)) {
          // If data.data is an object with items array
          patientsList = patientsRes.value.data.data.items || patientsRes.value.data.data;
        }
        
        console.log('👥 Patients loaded:', patientsList.length, patientsList);
        
        // Transform patients to UI format
        const transformedPatients = Array.isArray(patientsList) ? patientsList.map((p, idx) => {
          const transformed = {
            id: p.patient_code || `PT-${idx + 1}`,
            _id: p.patient_id || p._id?.toString?.() || p._id, // Store MongoDB ID for API calls
            name: p.full_name || p.name || 'N/A',
            email: p.email || 'N/A',
            color: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16'][idx % 5],
            ins: p.insurance_number || 'N/A',
            insId: p.national_id || 'N/A',
            lastVisit: 'N/A',
            status: p.status?.charAt(0).toUpperCase() + p.status?.slice(1) || 'Active',
          };
          console.log(`Patient ${idx}: display_id=${transformed.id}, _id=${transformed._id}`);
          return transformed;
        }) : [];
        
        setPatients(transformedPatients);
      } else {
        console.error('❌ Failed to fetch patients:', patientsRes.reason);
        setPatients([]);
      }

      // Handle staff/doctors data - Transform to UI format
      if (staffRes.status === 'fulfilled') {
        console.log('📦 Raw staff response:', staffRes.value.data);
        let staffList = [];
        
        // Handle different response structures
        if (Array.isArray(staffRes.value.data)) {
          staffList = staffRes.value.data;
        } else if (Array.isArray(staffRes.value.data?.data)) {
          staffList = staffRes.value.data.data;
        } else if (staffRes.value.data?.data && !Array.isArray(staffRes.value.data.data)) {
          staffList = staffRes.value.data.data.items || staffRes.value.data.data;
        }
        
        console.log('👨‍⚕️ Doctors loaded:', staffList.length, staffList);
        
        // Transform staff to UI format
        const transformedStaff = Array.isArray(staffList) ? staffList.map((s, idx) => {
          const staffId = s.user_id || s._id?.toString?.() || s._id || `DR-${idx + 1}`;
          const deptId = s.department_id || s.department?._id || s.departmentId || null;
          const deptName = (typeof s.department === 'string' && s.department) || s.department?.name || s.department || 'General Medicine';
          return {
            id: staffId,
            _id: staffId, // Store both id and _id for consistency
            name: s.full_name || s.username || 'N/A',
            code: s.employee_code || `EMP-${idx + 1}`,
            email: s.email || 'N/A',
            phone: s.phone || 'N/A',
            department: deptName,
            department_id: deptId,
            status: 'available',
            isDoctor: s.employee_code && s.employee_code.startsWith('DR'),
          };
        }) : [];
        
        setDoctors(transformedStaff);
      } else {
        console.error('❌ Failed to fetch staff:', staffRes.reason);
        setDoctors([]);
      }

      // Handle appointments data - Transform to UI format
      if (appointmentsRes.status === 'fulfilled') {
        console.log('📦 Raw appointments response:', appointmentsRes.value.data);
        let appointmentsList = [];
        
        // Handle different response structures
        if (Array.isArray(appointmentsRes.value.data)) {
          appointmentsList = appointmentsRes.value.data;
        } else if (Array.isArray(appointmentsRes.value.data?.data)) {
          appointmentsList = appointmentsRes.value.data.data;
        } else if (appointmentsRes.value.data?.data && !Array.isArray(appointmentsRes.value.data.data)) {
          appointmentsList = appointmentsRes.value.data.data.items || appointmentsRes.value.data.data;
        }
        
        console.log('📅 Appointments loaded:', appointmentsList.length, appointmentsList);
        
        // Get patients and doctors data for lookup
        let patientsList = [];
        let staffList = [];
        
        if (patientsRes.status === 'fulfilled') {
          if (Array.isArray(patientsRes.value.data)) {
            patientsList = patientsRes.value.data;
          } else if (Array.isArray(patientsRes.value.data?.data)) {
            patientsList = patientsRes.value.data.data;
          } else if (patientsRes.value.data?.data?.items) {
            patientsList = patientsRes.value.data.data.items;
          }
        }
        
        if (staffRes.status === 'fulfilled') {
          if (Array.isArray(staffRes.value.data)) {
            staffList = staffRes.value.data;
          } else if (Array.isArray(staffRes.value.data?.data)) {
            staffList = staffRes.value.data.data;
          } else if (staffRes.value.data?.items) {
            staffList = staffRes.value.data.items;
          } else if (staffRes.value.data?.data?.items) {
            staffList = staffRes.value.data.data.items;
          }
        }
        
        // Create lookup maps for patient and doctor names
        const patientMap = {};
        const doctorMap = {};
        
        patientsList.forEach(p => {
          const patientId = p._id || p.patient_id;
          if (patientId) {
            const idStr = patientId.toString();
            patientMap[idStr] = p.full_name || p.name || 'Unknown Patient';
          }
        });
        
        staffList.forEach(s => {
          const staffId = s.user_id || s._id;
          if (staffId) {
            const idStr = staffId.toString?.() || String(staffId);
            const doctorName = s.full_name || s.username || 'Unknown Doctor';
            doctorMap[idStr] = doctorName;
          }
        });
        
        console.log('� Processed staff list for doctor mapping:', staffList.map(s => ({ 
          user_id: s.user_id, 
          full_name: s.full_name 
        })));
        
        console.log('�👨‍⚕️ Doctor lookup map:', doctorMap);
        
        // Transform appointments to UI format
        const transformedAppointments = Array.isArray(appointmentsList) ? appointmentsList.map(apt => {
          const appointmentTime = new Date(apt.appointment_time);
          const patientId = apt.patient_id?.toString ? apt.patient_id.toString() : String(apt.patient_id);
          const doctorId = apt.doctor_id?.toString ? apt.doctor_id.toString() : String(apt.doctor_id);
          
          // Look up doctor name with fallback
          let doctorName = doctorMap[doctorId];
          if (!doctorName && apt.doctor_id) {
            // Try alternative lookup keys
            doctorName = doctorMap[apt.doctor_id] || doctorMap[String(apt.doctor_id)];
          }
          
          const finalDoctor = doctorName || apt.doctorName || apt.doctor_name || 'Unknown Doctor';
          
          console.log(`📌 Appointment ${apt._id}: doctorId="${doctorId}", found="${finalDoctor}"`);
          
          return {
            id: apt._id || apt.appointment_id,
            appointmentTime: appointmentTime,
            date: appointmentTime.toLocaleDateString('en-US'),
            time: appointmentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            scheduledTime: appointmentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            patient: patientMap[patientId] || apt.patientName || 'Unknown Patient',
            patientName: patientMap[patientId] || apt.patientName || 'Unknown Patient',
            doctor: finalDoctor,
            doctorName: finalDoctor,
            status: apt.status || 'pending',
            badge: apt.status?.charAt(0).toUpperCase() + apt.status?.slice(1) || 'Pending',
            badgeClass: `badge-${apt.status || 'pending'}`,
            type: apt.appointment_type || 'outpatient',
            reason: apt.reason || '',
            raw: apt, // Keep raw data for reference
          };
        }) : [];
        
        setAppointments(transformedAppointments);
      } else {
        console.error('❌ Failed to fetch appointments:', appointmentsRes.reason);
        setAppointments([]);
      }

      // Handle queue data
      if (queueRes.status === 'fulfilled') {
        console.log('📦 Raw queue response:', queueRes.value.data);
        let queueList = [];
        
        // Handle different response structures
        if (Array.isArray(queueRes.value.data)) {
          queueList = queueRes.value.data;
        } else if (Array.isArray(queueRes.value.data?.data)) {
          queueList = queueRes.value.data.data;
        } else if (queueRes.value.data?.data && !Array.isArray(queueRes.value.data.data)) {
          queueList = queueRes.value.data.data.items || queueRes.value.data.data;
        }
        
        console.log('🎫 Queue tickets loaded:', queueList.length, queueList);
        
        // Transform queue to UI format
        const transformedQueue = Array.isArray(queueList) ? queueList.map((ticket, idx) => ({
          id: ticket._id || idx,
          label: 'Next',
          name: ticket.patientName || 'Patient ' + idx,
          ticket: ticket.queue_number || 'Q-' + (idx + 1),
          col: idx < 3 ? 'purple' : 'blue',
        })) : [];
        
        setQueueDepartments(transformedQueue);
      } else {
        console.error('❌ Failed to fetch queue:', queueRes.reason);
        setQueueDepartments([]);
      }

      // Mock recent activity from appointments
      if (appointmentsRes.status === 'fulfilled') {
        const appts = Array.isArray(appointmentsRes.value.data) ? appointmentsRes.value.data : 
                      Array.isArray(appointmentsRes.value.data?.data) ? appointmentsRes.value.data.data : [];
        const activity = appts.slice(0, 5).map((a, idx) => ({
          id: (a._id || a.appointment_id || idx).toString().slice(0, 6),
          name: a.patientName || 'Patient ' + idx,
          color: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16'][idx % 5],
          action: `Appointment ${a.status || 'updated'}`,
          method: 'Online',
          time: a.updated_at ? new Date(a.updated_at).toLocaleString() : 'N/A',
          tx: '✓ Confirmed',
        }));
        setRecentActivity(activity);
      }

      // Mock doctor status from staff
      if (staffRes.status === 'fulfilled') {
        const staff = Array.isArray(staffRes.value.data) ? staffRes.value.data : 
                      Array.isArray(staffRes.value.data?.data) ? staffRes.value.data.data : [];
        const docStatus = staff.filter(s => s.employee_code && s.employee_code.startsWith('DR')).slice(0, 5).map((s, idx) => ({
          name: s.full_name || 'Dr. ' + s.username,
          status: ['in-session', 'on-break', 'available', 'offline'][idx % 4],
          cls: ['in-session', 'on-break', 'available', 'offline'][idx % 4],
        }));
        setDoctorStatus(docStatus);
      }

      console.log('✓ All data fetched and transformed successfully');
    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setError(err?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Return state and refetch function
  return {
    patients,
    doctors,
    appointments,
    queueDepartments,
    recentActivity,
    doctorStatus,
    loading,
    error,
    refetch: fetchAllData,
  };
}
