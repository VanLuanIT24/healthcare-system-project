import { useDeferredValue, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { documentCategories } from '../data/patientPageData'

function getCategoryCount(documents, categoryId) {
  return documents.filter((document) => document.category === categoryId).length
}

function slugify(value) {
  return String(value || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function parseDocumentDate(value) {
  const [day, month, year] = String(value || '').split('/')

  if (!day || !month || !year) {
    return ''
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function formatDisplayDate(value) {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function formatFileSize(size) {
  if (!size) {
    return ''
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getAttachmentId(document) {
  return document.attachment_id || document._id || document.id
}

function getAttachmentTitle(document) {
  return document.original_name || document.file_name || document.title || 'Tài liệu y tế'
}

function mapAttachmentToDocument(document) {
  const mimeType = String(document.mime_type || '').toLowerCase()
  const category = document.category || document.entity_type || 'records'
  const isPdf = mimeType.includes('pdf') || getAttachmentTitle(document).toLowerCase().endsWith('.pdf')
  const isImage = mimeType.startsWith('image/')

  return {
    id: getAttachmentId(document),
    backendId: getAttachmentId(document),
    title: getAttachmentTitle(document),
    subtitle: document.description || document.entity_type || 'Tài liệu từ backend',
    category: documentCategories.some((item) => item.id === category) ? category : 'records',
    date: document.created_at ? new Date(document.created_at).toLocaleDateString('vi-VN') : '',
    size: formatFileSize(document.file_size),
    icon: isPdf ? 'picture_as_pdf' : isImage ? 'image' : 'description',
    tone: isPdf ? 'pdf' : isImage ? 'image' : 'record',
  }
}

export default function PatientDocumentsPage({
  documents: backendDocuments = [],
  error = '',
  loading = false,
  onBookAppointment,
  onDownloadDocument,
}) {
  const documents = backendDocuments.map(mapAttachmentToDocument)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchValue, setSearchValue] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [viewedDocument, setViewedDocument] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const deferredSearch = useDeferredValue(searchValue)

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const visibleDocuments = documents.filter((document) => {
    const matchesCategory = activeCategory === 'all' || document.category === activeCategory
    const haystack = `${document.title} ${document.subtitle} ${document.date}`.toLowerCase()
    const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true
    const documentDate = parseDocumentDate(document.date)
    const matchesDateFrom = dateFrom ? documentDate >= dateFrom : true
    const matchesDateTo = dateTo ? documentDate <= dateTo : true
    return matchesCategory && matchesSearch && matchesDateFrom && matchesDateTo
  })

  const selectedDocuments = documents.filter((document) => selectedIds.includes(document.id))
  const selectedCount = selectedDocuments.length
  const filtersActive = activeCategory !== 'all' || normalizedSearch || dateFrom || dateTo

  const toggleDocument = (documentId) => {
    setSelectedIds((current) =>
      current.includes(documentId)
        ? current.filter((item) => item !== documentId)
        : [...current, documentId],
    )
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const clearFilters = () => {
    setActiveCategory('all')
    setSearchValue('')
    setDateFrom('')
    setDateTo('')
  }

  const deleteSelection = () => {
    setFeedback('Chức năng xóa tài liệu từ cổng bệnh nhân chưa có API backend.')
  }

  const downloadDocument = async (document) => {
    if (!document.backendId || !onDownloadDocument) {
      setFeedback('Tài liệu này chưa có API tải xuống từ backend.')
      return
    }

    try {
      const downloadData = await onDownloadDocument(document.backendId)
      const fileName = downloadData?.download?.file_name || document.title
      setFeedback(`Backend đã xác nhận quyền tải xuống ${fileName}; API hiện trả metadata, chưa stream file thật.`)
    } catch (error) {
      setFeedback(error.message || 'Không thể tải tài liệu từ backend.')
    }
  }

  const downloadZip = (documentsToDownload = selectedDocuments) => {
    setFeedback(
      documentsToDownload.length
        ? 'Backend chưa có API tải ZIP cho nhiều tài liệu từ cổng bệnh nhân.'
        : 'Chọn ít nhất một tài liệu để tải ZIP.',
    )
  }

  return (
    <div className="patient-documents-page">
      <section className="patient-documents-head">
        <div>
          <h1>Kho tài liệu của bạn</h1>
          <p>Quản lý và truy cập hồ sơ y tế bảo mật của bạn mọi lúc, mọi nơi.</p>
        </div>

        <div className="patient-documents-head-actions">
          <button
            className="patient-documents-zip-button"
            type="button"
            disabled={!selectedCount}
            onClick={() => downloadZip()}
          >
            <PatientIcon name="folder_zip" aria-hidden="true" />
            <span>Tải về dưới dạng ZIP ({selectedCount || 0})</span>
          </button>

          <button className="patient-hero-button" type="button" onClick={onBookAppointment}>
            Đặt lịch khám
          </button>
        </div>
      </section>

      <section className="patient-documents-toolbar">
        <div className="patient-documents-search">
          <span className="patient-documents-search-icon" aria-hidden="true">
            <PatientIcon name="search" />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu theo tên hoặc ngày..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </div>

        <div className="patient-documents-toolbar-actions">
          <button
            className={`patient-documents-filter-button${showDateFilter ? ' is-active' : ''}`}
            type="button"
            onClick={() => setShowDateFilter((current) => !current)}
          >
            <PatientIcon name="calendar_today" aria-hidden="true" />
            <span>Lọc ngày</span>
          </button>
          <button
            className={`patient-documents-filter-icon${showFilterPanel ? ' is-active' : ''}`}
            type="button"
            aria-label="Mở bộ lọc"
            aria-expanded={showFilterPanel}
            onClick={() => setShowFilterPanel((current) => !current)}
          >
            <PatientIcon name="filter_list" aria-hidden="true" />
          </button>
        </div>
      </section>

      {showDateFilter || showFilterPanel ? (
        <section className="patient-documents-filter-panel">
          {showDateFilter ? (
            <div className="patient-documents-date-filter">
              <label>
                <span>Từ ngày</span>
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label>
                <span>Đến ngày</span>
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
            </div>
          ) : null}

          {showFilterPanel ? (
            <div className="patient-documents-quick-filters">
              <button
                className={activeCategory === 'all' ? 'is-active' : ''}
                type="button"
                onClick={() => setActiveCategory('all')}
              >
                Tất cả
              </button>
              {documentCategories.map((category) => (
                <button
                  key={category.id}
                  className={activeCategory === category.id ? 'is-active' : ''}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="patient-documents-filter-summary">
            <span>
              {visibleDocuments.length} tài liệu
              {dateFrom || dateTo
                ? ` - ${dateFrom ? formatDisplayDate(dateFrom) : '...'} đến ${
                    dateTo ? formatDisplayDate(dateTo) : '...'
                  }`
                : ''}
            </span>
            {filtersActive ? (
              <button type="button" onClick={clearFilters}>
                Xóa lọc
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {feedback ? (
        <div className="patient-documents-feedback" role="status">
          <PatientIcon name="check_circle" aria-hidden="true" />
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} aria-label="Đóng thông báo">
            <PatientIcon name="close" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="patient-documents-feedback" role="status">
          <PatientIcon name="hourglass_top" aria-hidden="true" />
          <span>Đang tải tài liệu từ backend...</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="patient-documents-feedback" role="alert">
          <PatientIcon name="warning" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="patient-documents-category-grid">
        {documentCategories.map((category) => (
          <button
            key={category.id}
            className={`patient-documents-category-card${activeCategory === category.id ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveCategory(category.id)}
          >
            <div className={`patient-documents-category-icon ${category.tone}`}>
              <PatientIcon name={category.icon} aria-hidden="true" />
            </div>
            <strong>{category.label}</strong>
            <span>{getCategoryCount(documents, category.id)} tài liệu</span>
          </button>
        ))}
      </section>

      <section className="patient-documents-grid">
        {visibleDocuments.map((document) => {
          const selected = selectedIds.includes(document.id)

          return (
            <article
              key={document.id}
              className={`patient-documents-card${selected ? ' is-selected' : ''}`}
            >
              <button
                className={`patient-documents-select${selected ? ' is-selected' : ''}`}
                type="button"
                aria-label={selected ? 'Bỏ chọn tài liệu' : 'Chọn tài liệu'}
                onClick={() => toggleDocument(document.id)}
              >
                {selected ? <PatientIcon name="check_circle" aria-hidden="true" /> : null}
              </button>

              <div className="patient-documents-card-head">
                <div className={`patient-documents-file-icon ${document.tone}`}>
                  <PatientIcon name={document.icon} aria-hidden="true" />
                </div>

                <div>
                  <h2>{document.title}</h2>
                  <p>{document.subtitle}</p>
                </div>
              </div>

              <div className="patient-documents-meta">
                <span>
                  <PatientIcon name="calendar_month" aria-hidden="true" />
                  {document.date}
                </span>
                <span>
                  <PatientIcon name="database" aria-hidden="true" />
                  {document.size}
                </span>
              </div>

              <div className="patient-documents-card-actions">
                <button
                  className={`patient-documents-view${selected ? ' is-selected' : ''}`}
                  type="button"
                  onClick={() => setViewedDocument(document)}
                >
                  Xem
                </button>
                <button
                  className={`patient-documents-download${selected ? ' is-selected' : ''}`}
                  type="button"
                  onClick={() => downloadDocument(document)}
                >
                  {!selected ? <PatientIcon name="download" aria-hidden="true" /> : null}
                  <span>Tải về</span>
                </button>
              </div>
            </article>
          )
        })}

        {!visibleDocuments.length ? (
          <div className="patient-documents-empty">
            <PatientIcon name="folder_off" aria-hidden="true" />
            <strong>Không có tài liệu phù hợp</strong>
            <span>Thử đổi từ khóa, danh mục hoặc bộ lọc ngày.</span>
          </div>
        ) : null}

        <button
          className="patient-documents-upload-card"
          type="button"
          onClick={() => setFeedback('Chưa có API upload tài liệu từ cổng bệnh nhân.')}
        >
          <div className="patient-documents-upload-icon">
            <PatientIcon name="upload_file" aria-hidden="true" />
          </div>
          <strong>Chưa có API upload</strong>
          <p>Backend patient portal hiện chỉ hỗ trợ xem và lấy metadata tải xuống tài liệu đã release.</p>
        </button>
      </section>

      {selectedCount ? (
        <div className="patient-documents-floating-bar">
          <div className="patient-documents-floating-count">
            <div>{selectedCount}</div>
            <span>Tài liệu đã chọn</span>
          </div>

          <div className="patient-documents-floating-actions">
            <button type="button" onClick={() => downloadZip()}>
              <PatientIcon name="download" aria-hidden="true" />
              <span>Tải ZIP</span>
            </button>
            <button type="button" onClick={deleteSelection}>
              <PatientIcon name="delete" aria-hidden="true" />
              <span>Xóa</span>
            </button>
            <button className="is-muted" type="button" onClick={clearSelection}>
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      {viewedDocument ? (
        <div className="patient-documents-modal-backdrop" role="presentation" onClick={() => setViewedDocument(null)}>
          <section
            className="patient-documents-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-document-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="patient-documents-modal-head">
              <div className={`patient-documents-file-icon ${viewedDocument.tone}`}>
                <PatientIcon name={viewedDocument.icon} aria-hidden="true" />
              </div>
              <div>
                <h2 id="patient-document-preview-title">{viewedDocument.title}</h2>
                <p>{viewedDocument.subtitle}</p>
              </div>
              <button type="button" aria-label="Đóng xem trước" onClick={() => setViewedDocument(null)}>
                <PatientIcon name="close" aria-hidden="true" />
              </button>
            </div>

            <div className="patient-documents-preview">
              <PatientIcon name={viewedDocument.tone === 'image' ? 'image' : 'description'} aria-hidden="true" />
              <strong>Bản xem trước tài liệu</strong>
              <span>Nội dung chi tiết sẽ được tải từ hệ thống lưu trữ khi kết nối backend thật.</span>
            </div>

            <dl className="patient-documents-modal-meta">
              <div>
                <dt>Ngày</dt>
                <dd>{viewedDocument.date}</dd>
              </div>
              <div>
                <dt>Dung lượng</dt>
                <dd>{viewedDocument.size}</dd>
              </div>
              <div>
                <dt>Phân loại</dt>
                <dd>{viewedDocument.category}</dd>
              </div>
            </dl>

            <div className="patient-documents-modal-actions">
              <button type="button" className="patient-documents-view" onClick={() => setViewedDocument(null)}>
                Đóng
              </button>
              <button
                type="button"
                className="patient-documents-download is-selected"
                onClick={() => downloadDocument(viewedDocument)}
              >
                <PatientIcon name="download" aria-hidden="true" />
                <span>Tải về</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
