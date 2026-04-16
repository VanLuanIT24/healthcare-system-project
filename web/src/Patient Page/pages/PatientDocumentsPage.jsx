import { startTransition, useDeferredValue, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  defaultSelectedDocumentIds,
  documentCategories,
  documentLibrary,
} from '../data/patientPageData'

function getCategoryCount(documents, categoryId) {
  return documents.filter((document) => document.category === categoryId).length
}

export default function PatientDocumentsPage() {
  const [documents, setDocuments] = useState(documentLibrary)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchValue, setSearchValue] = useState('')
  const [selectedIds, setSelectedIds] = useState(defaultSelectedDocumentIds)
  const deferredSearch = useDeferredValue(searchValue)

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const visibleDocuments = documents.filter((document) => {
    const matchesCategory = activeCategory === 'all' || document.category === activeCategory
    const haystack = `${document.title} ${document.subtitle} ${document.date}`.toLowerCase()
    const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true
    return matchesCategory && matchesSearch
  })

  const selectedCount = selectedIds.length

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

  const deleteSelection = () => {
    startTransition(() => {
      setDocuments((current) => current.filter((document) => !selectedIds.includes(document.id)))
      setSelectedIds([])
    })
  }

  return (
    <div className="patient-documents-page">
      <section className="patient-documents-head">
        <div>
          <h1>Kho tài liệu của bạn</h1>
          <p>Quản lý và truy cập hồ sơ y tế bảo mật của bạn mọi lúc, mọi nơi.</p>
        </div>

        <div className="patient-documents-head-actions">
          <button className="patient-documents-zip-button" type="button">
            <PatientIcon name="folder_zip" aria-hidden="true" />
            <span>Tải về dưới dạng ZIP ({selectedCount || 0})</span>
          </button>

          <button className="patient-hero-button" type="button">
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
          <button className="patient-documents-filter-button" type="button">
            <PatientIcon name="calendar_today" aria-hidden="true" />
            <span>Lọc ngày</span>
          </button>
          <button className="patient-documents-filter-icon" type="button" aria-label="Mở bộ lọc">
            <PatientIcon name="filter_list" aria-hidden="true" />
          </button>
        </div>
      </section>

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
                >
                  Xem
                </button>
                <button
                  className={`patient-documents-download${selected ? ' is-selected' : ''}`}
                  type="button"
                >
                  {!selected ? <PatientIcon name="download" aria-hidden="true" /> : null}
                  <span>Tải về</span>
                </button>
              </div>
            </article>
          )
        })}

        <button className="patient-documents-upload-card" type="button">
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
            <button type="button">
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
    </div>
  )
}
