import { startTransition, useDeferredValue, useRef, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  defaultSelectedDocumentIds,
  documentCategories,
  documentLibrary,
} from '../data/patientPageData'

function getCategoryCount(documents, categoryId) {
  return documents.filter((document) => document.category === categoryId).length
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

function crc32(bytes) {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true)
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true)
}

function getDosDateTime(value) {
  const date = value ? new Date(value) : new Date()
  const year = Math.max(1980, date.getFullYear())

  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  }
}

function createZipBlob(files) {
  const encoder = new TextEncoder()
  const chunks = []
  const centralDirectory = []
  let offset = 0

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name)
    const dataBytes = encoder.encode(file.content)
    const { date, time } = getDosDateTime(file.modifiedAt)
    const crc = crc32(dataBytes)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, time)
    writeUint16(localView, 12, date)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, dataBytes.length)
    writeUint32(localView, 22, dataBytes.length)
    writeUint16(localView, 26, nameBytes.length)
    writeUint16(localView, 28, 0)
    localHeader.set(nameBytes, 30)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, time)
    writeUint16(centralView, 14, date)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, dataBytes.length)
    writeUint32(centralView, 24, dataBytes.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)

    chunks.push(localHeader, dataBytes)
    centralDirectory.push(centralHeader)
    offset += localHeader.length + dataBytes.length
  })

  const centralOffset = offset
  const centralSize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0)
  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralSize)
  writeUint32(endView, 16, centralOffset)
  writeUint16(endView, 20, 0)

  return new Blob([...chunks, ...centralDirectory, endRecord], { type: 'application/zip' })
}

function slugify(value) {
  return String(value || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/Ä‘/g, 'd')
    .replace(/Ä/g, 'D')
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

function buildDocumentContent(document) {
  return [
    `Ten tai lieu: ${document.title}`,
    `Mo ta: ${document.subtitle}`,
    `Ngay tao: ${document.date}`,
    `Dung luong: ${document.size}`,
    `Phan loai: ${document.category}`,
    '',
    'Noi dung mau duoc tao tu Kho tai lieu HealthCare.',
  ].join('\n')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getDocumentDownloadName(document) {
  return `${slugify(document.title)}-${document.id}.txt`
}

export default function PatientDocumentsPage({ onBookAppointment }) {
  const [documents, setDocuments] = useState(documentLibrary)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchValue, setSearchValue] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [viewedDocument, setViewedDocument] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [selectedIds, setSelectedIds] = useState(defaultSelectedDocumentIds)
  const uploadInputRef = useRef(null)
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
    startTransition(() => {
      setDocuments((current) => current.filter((document) => !selectedIds.includes(document.id)))
      setSelectedIds([])
    })
    setFeedback('Đã xóa tài liệu đã chọn.')
  }

  const downloadDocument = (document) => {
    downloadBlob(
      new Blob([buildDocumentContent(document)], { type: 'text/plain;charset=utf-8' }),
      getDocumentDownloadName(document),
    )
    setFeedback(`Đang tải ${document.title}.`)
  }

  const downloadZip = (documentsToDownload = selectedDocuments) => {
    if (!documentsToDownload.length) {
      setFeedback('Chọn ít nhất một tài liệu để tải ZIP.')
      return
    }

    const zipFiles = documentsToDownload.map((document) => ({
      name: getDocumentDownloadName(document),
      content: buildDocumentContent(document),
      modifiedAt: parseDocumentDate(document.date),
    }))

    downloadBlob(createZipBlob(zipFiles), `healthcare-documents-${documentsToDownload.length}.zip`)
    setFeedback(`Đang tải ZIP gồm ${documentsToDownload.length} tài liệu.`)
  }

  const handleUploadFiles = (event) => {
    const files = Array.from(event.target.files || [])

    if (!files.length) {
      return
    }

    const today = new Date().toLocaleDateString('vi-VN')
    const uploadedDocuments = files.map((file, index) => {
      const isImage = file.type.startsWith('image/')
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const title = file.name.replace(/\.[^.]+$/, '')

      return {
        id: `uploaded-${Date.now()}-${index}`,
        title,
        subtitle: isPdf ? 'Tài liệu tải lên | PDF' : isImage ? 'Hình ảnh tải lên' : 'Tài liệu tải lên',
        category: isImage ? 'labs' : 'records',
        date: today,
        size: formatFileSize(file.size),
        icon: isPdf ? 'picture_as_pdf' : isImage ? 'image' : 'description',
        tone: isPdf ? 'pdf' : isImage ? 'image' : 'record',
      }
    })

    startTransition(() => {
      setDocuments((current) => [...uploadedDocuments, ...current])
      setSelectedIds((current) => [...uploadedDocuments.map((document) => document.id), ...current])
    })

    setFeedback(`Đã thêm ${uploadedDocuments.length} tài liệu mới.`)
    event.target.value = ''
  }

  return (
    <div className="patient-documents-page">
      <input
        ref={uploadInputRef}
        type="file"
        hidden
        multiple
        accept=".pdf,image/*"
        onChange={handleUploadFiles}
      />

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
          onClick={() => uploadInputRef.current?.click()}
        >
          <div className="patient-documents-upload-icon">
            <PatientIcon name="upload_file" aria-hidden="true" />
          </div>
          <strong>Tải lên tài liệu mới</strong>
          <p>Kéo thả tệp PDF hoặc hình ảnh vào đây để lưu trữ bảo mật.</p>
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
