import { useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const imagingTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'new', label: 'Kết quả mới' },
  { id: 'xray', label: 'X-quang' },
  { id: 'ultrasound', label: 'Siêu âm' },
  { id: 'ct', label: 'CT' },
  { id: 'mri', label: 'MRI' },
  { id: 'endoscopy', label: 'Nội soi' },
  { id: 'unviewed', label: 'Chưa xem' },
  { id: 'history', label: 'Lịch sử' },
]

const modalityLabels = {
  xray: 'X-quang',
  ultrasound: 'Siêu âm',
  ct: 'CT Scan',
  mri: 'MRI',
  mammography: 'Nhũ ảnh',
  fluoroscopy: 'Chiếu chụp',
}

function formatDate(value) {
  if (!value) return 'Chưa có ngày'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có ngày'

  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function normalizeModality(value) {
  const raw = String(value || '').toLowerCase()

  if (raw.includes('xray') || raw.includes('x-ray') || raw.includes('x_quang')) return 'xray'
  if (raw.includes('ultrasound') || raw.includes('sieu') || raw === 'us') return 'ultrasound'
  if (raw.includes('ct')) return 'ct'
  if (raw.includes('mri')) return 'mri'
  if (raw.includes('endoscopy') || raw.includes('noi_soi') || raw.includes('nội soi')) return 'endoscopy'
  return raw || 'other'
}

function getModalityLabel(value) {
  const normalized = normalizeModality(value)
  return modalityLabels[normalized] || String(value || 'Khác')
}

function getReportStatus(report) {
  if (report.is_critical) {
    return { status: 'Khẩn cấp', tone: 'critical' }
  }

  const status = String(report.status || '').toLowerCase()
  if (status === 'preliminary') {
    return { status: 'Cần theo dõi', tone: 'watch' }
  }

  return { status: 'Đã phát hành', tone: 'normal' }
}

function getReportThumb(order, category) {
  const bodyPart = String(order?.body_part || '').toLowerCase()

  if (bodyPart.includes('spine') || bodyPart.includes('cột sống') || bodyPart.includes('lumbar')) return 'spine'
  if (bodyPart.includes('brain') || bodyPart.includes('sọ') || bodyPart.includes('head')) return 'brain'
  if (bodyPart.includes('chest') || bodyPart.includes('ngực') || bodyPart.includes('phổi')) return 'chest'
  if (category === 'ultrasound') return 'ultrasound'
  if (category === 'ct') return 'brain'
  return 'chest'
}

function getReportSummary(report) {
  return (
    report.impression ||
    report.recommendation ||
    report.findings ||
    report.critical_note ||
    'Báo cáo đã được phát hành cho cổng bệnh nhân, chưa có phần nhận xét chi tiết.'
  )
}

function mapApiReport(report, index) {
  const order = report.imaging_order_id && typeof report.imaging_order_id === 'object' ? report.imaging_order_id : null
  const modality = order?.modality || report.modality
  const category = normalizeModality(modality)
  const bodyPart = order?.body_part || report.body_part || 'Chẩn đoán hình ảnh'
  const { status, tone } = getReportStatus(report)

  return {
    id: report.report_id || report._id || report.report_no || `imaging-${index}`,
    name: report.report_title || `${getModalityLabel(modality)} - ${bodyPart}`,
    date: formatDate(report.reported_at || report.verified_at || report.released_at || report.created_at),
    type: getModalityLabel(modality),
    category: ['xray', 'ultrasound', 'ct', 'mri', 'endoscopy'].includes(category) ? category : 'other',
    status,
    tone,
    thumb: getReportThumb(order, category),
    reportNo: report.report_no,
    summary: getReportSummary(report),
    doctor: report.radiologist_id?.full_name || report.radiologist_name || 'Chưa cập nhật',
    conclusion: report.impression || report.conclusion || report.findings || '',
    pdfUrl: report.pdf_url || report.file_url || report.attachment_url || '',
    imageUrl: report.pacs_url || report.image_url || report.dicom_viewer_url || '',
    patientViewedAt: report.patient_viewed_at,
    released: report.released_to_patient,
  }
}

export default function PatientImagingPage({ reports = [], loading = false, onMarkViewed }) {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedReportId, setSelectedReportId] = useState('')
  const imagingRecords = useMemo(() => reports.map(mapApiReport), [reports])
  const visibleRecords = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'history') return imagingRecords
    if (activeTab === 'new' || activeTab === 'unviewed') return imagingRecords.filter((record) => !record.patientViewedAt)
    return imagingRecords.filter((record) => record.category === activeTab)
  }, [activeTab, imagingRecords])
  const selectedReport = imagingRecords.find((record) => record.id === selectedReportId) || visibleRecords[0] || null

  return (
    <section className="patient-imaging-shell patient-panel">
      <div className="patient-imaging-head">
        <h1>Chẩn đoán hình ảnh</h1>

        <div className="patient-imaging-tabs" role="tablist" aria-label="Lọc chẩn đoán hình ảnh">
          {imagingTabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                className={`patient-imaging-tab${isActive ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="patient-imaging-table" role="table" aria-label="Danh sách chẩn đoán hình ảnh">
        <div className="patient-imaging-row patient-imaging-row-head" role="row">
          <span role="columnheader">Hình ảnh</span>
          <span role="columnheader">Tên khảo sát</span>
          <span role="columnheader">Ngày thực hiện</span>
          <span role="columnheader">Loại</span>
          <span role="columnheader">Kết quả</span>
          <span role="columnheader" aria-label="Thao tác" />
        </div>

        <div className="patient-imaging-list">
          {loading ? (
            <div className="patient-imaging-empty">Đang tải báo cáo chẩn đoán hình ảnh...</div>
          ) : visibleRecords.length ? (
            visibleRecords.map((record) => (
              <button
                key={record.id}
                className={`patient-imaging-row patient-imaging-card${selectedReportId === record.id ? ' is-selected' : ''}`}
                type="button"
                role="row"
                onClick={() => setSelectedReportId(record.id)}
              >
                <span className={`patient-imaging-thumb ${record.thumb}`} role="cell" aria-hidden="true" />
                <strong className="patient-imaging-name" role="cell">
                  {record.name}
                </strong>
                <span className="patient-imaging-date" role="cell">
                  {record.date}
                </span>
                <span className="patient-imaging-type" role="cell">
                  {record.type}
                </span>
                <span className={`patient-imaging-status ${record.tone}`} role="cell">
                  {record.status}
                </span>
                <span className="patient-imaging-action" role="cell" aria-hidden="true">
                  <PatientIcon name="chevron_right" />
                </span>
              </button>
            ))
          ) : (
            <div className="patient-imaging-empty">Chưa có báo cáo chẩn đoán hình ảnh được phát hành.</div>
          )}
        </div>
      </div>

      <div className="patient-imaging-note">
        <span className="patient-imaging-note-icon" aria-hidden="true">
          <PatientIcon name="info" />
        </span>
        {selectedReport ? (
          <p>
            <strong>{selectedReport.reportNo || selectedReport.name}</strong>
            <br />
            {selectedReport.summary}
            <br />
            Bác sĩ đọc kết quả: {selectedReport.doctor} | Trạng thái phát hành: {selectedReport.released ? 'Đã phát hành' : 'Chưa phát hành'}
          </p>
        ) : (
          <p>
            Chạm vào từng mục để xem tóm tắt kết quả đã được phát hành.
            <br />
            Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ bác sĩ để được tư vấn.
          </p>
        )}
        <span className="patient-imaging-note-art" aria-hidden="true">
          <PatientIcon name="image" />
        </span>
      </div>

      {selectedReport ? (
        <div className="patient-imaging-actions">
          <button type="button">
            <PatientIcon name="description" aria-hidden="true" />
            Xem kết quả
          </button>
          <button type="button" disabled={!selectedReport.pdfUrl}>
            <PatientIcon name="download" aria-hidden="true" />
            Tải PDF
          </button>
          <button type="button" disabled={!selectedReport.imageUrl}>
            <PatientIcon name="image" aria-hidden="true" />
            Xem ảnh
          </button>
          <button type="button" onClick={() => onMarkViewed?.(selectedReport.id)}>
            <PatientIcon name="visibility" aria-hidden="true" />
            Đánh dấu đã xem
          </button>
        </div>
      ) : null}
    </section>
  )
}
