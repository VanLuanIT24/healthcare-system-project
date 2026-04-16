import { useDeferredValue, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  directoryProviders,
  directorySpecialties,
  directoryViewMeta,
} from '../data/patientPageData'

function cycleSpecialty(currentKey) {
  const currentIndex = directorySpecialties.findIndex((item) => item.key === currentKey)
  const nextIndex =
    currentIndex === -1 || currentIndex === directorySpecialties.length - 1 ? 0 : currentIndex + 1
  return directorySpecialties[nextIndex].key
}

export default function PatientDirectoryPage() {
  const [selectedProviderId, setSelectedProviderId] = useState('north-bay')
  const [openNowOnly, setOpenNowOnly] = useState(true)
  const [specialty, setSpecialty] = useState('all')
  const [sortMode, setSortMode] = useState('nearest')
  const deferredSpecialty = useDeferredValue(specialty)

  const filteredProviders = directoryProviders
    .filter((provider) => (openNowOnly ? provider.openNow : true))
    .filter((provider) =>
      deferredSpecialty === 'all' ? true : provider.specialty === deferredSpecialty,
    )
    .slice()
    .sort((left, right) =>
      sortMode === 'nearest' ? left.distance - right.distance : right.distance - left.distance,
    )

  const selectedProvider =
    filteredProviders.find((provider) => provider.id === selectedProviderId) ||
    filteredProviders[0] ||
    null

  const clinicCount = filteredProviders.filter((provider) => provider.type === 'clinic').length
  const pharmacyCount = filteredProviders.filter(
    (provider) => provider.type === 'pharmacy' && provider.openNow,
  ).length
  const specialtyLabel =
    directorySpecialties.find((item) => item.key === specialty)?.label || 'Tất cả'

  return (
    <div className="patient-directory-page">
      <section className="patient-directory-shell">
        <aside className="patient-directory-list-panel">
          <div className="patient-directory-filters">
            <button
              className={`patient-directory-chip${openNowOnly ? ' is-active' : ''}`}
              type="button"
              onClick={() => setOpenNowOnly((value) => !value)}
            >
              <PatientIcon name="schedule" aria-hidden="true" />
              <span>{openNowOnly ? 'Đang mở cửa' : 'Hiển thị tất cả'}</span>
            </button>

            <button
              className="patient-directory-chip is-muted"
              type="button"
              onClick={() => setSpecialty((current) => cycleSpecialty(current))}
            >
              <span>{specialtyLabel}</span>
              <PatientIcon name="expand_more" aria-hidden="true" />
            </button>

            <button
              className="patient-directory-chip is-muted"
              type="button"
              onClick={() =>
                setSortMode((current) => (current === 'nearest' ? 'farthest' : 'nearest'))
              }
            >
              <span>{sortMode === 'nearest' ? 'Gần nhất' : 'Xa nhất'}</span>
              <PatientIcon name="tune" aria-hidden="true" />
            </button>
          </div>

          <div className="patient-directory-card-list">
            {filteredProviders.map((provider) => {
              const isSelected = provider.id === selectedProvider?.id

              return (
                <article
                  key={provider.id}
                  className={`patient-directory-card${isSelected ? ' is-selected' : ''}`}
                >
                  <button
                    className="patient-directory-card-main"
                    type="button"
                    onClick={() => setSelectedProviderId(provider.id)}
                  >
                    <div className="patient-directory-card-head">
                      <span className={`patient-directory-badge ${provider.badgeTone}`}>
                        {provider.badge}
                      </span>

                      <span className="patient-directory-distance">
                        <PatientIcon name="near_me" aria-hidden="true" />
                        <span>{provider.distance} dặm</span>
                      </span>
                    </div>

                    <h2>{provider.name}</h2>
                    <p className="patient-directory-address">{provider.address}</p>

                    <div className="patient-directory-meta">
                      <span>
                        <PatientIcon name="call" aria-hidden="true" />
                        <span>{provider.phone}</span>
                      </span>

                      <span className={`patient-directory-status ${provider.statusTone}`}>
                        <PatientIcon
                          name={provider.statusTone === 'closing' ? 'history' : 'check_circle'}
                          aria-hidden="true"
                        />
                        <span>{provider.statusLabel}</span>
                      </span>
                    </div>
                  </button>

                  <div className="patient-directory-actions">
                    <button className="patient-directory-secondary-action" type="button">
                      <PatientIcon name="directions" aria-hidden="true" />
                      <span>Chỉ đường</span>
                    </button>

                    <button className="patient-directory-primary-action" type="button">
                      {provider.actionLabel}
                    </button>
                  </div>
                </article>
              )
            })}

            {!filteredProviders.length ? (
              <div className="patient-directory-empty">
                <PatientIcon name="location_off" aria-hidden="true" />
                <h3>Không tìm thấy địa điểm phù hợp</h3>
                <p>Thử mở rộng bộ lọc hoặc hiển thị tất cả cơ sở để xem thêm lựa chọn.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="patient-directory-map-panel">
          <div className="patient-directory-map-surface" aria-hidden="true" />

          <div className="patient-directory-markers">
            {filteredProviders.map((provider) => {
              const isSelected = provider.id === selectedProvider?.id

              return (
                <button
                  key={provider.id}
                  className={`patient-directory-marker ${provider.markerTone}${isSelected ? ' is-selected' : ''}`}
                  style={{ top: provider.markerTop, left: provider.markerLeft }}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                >
                  <span className="patient-directory-marker-pin">
                    <PatientIcon name={provider.markerIcon} aria-hidden="true" />
                  </span>
                  <span className="patient-directory-marker-label">{provider.markerLabel}</span>
                </button>
              )
            })}
          </div>

          <div className="patient-directory-map-controls">
            <div className="patient-directory-zoom-box">
              <button type="button" aria-label="Phóng to">
                <PatientIcon name="add" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Thu nhỏ">
                <PatientIcon name="remove" aria-hidden="true" />
              </button>
            </div>

            <button className="patient-directory-locate" type="button" aria-label="Xác định vị trí">
              <PatientIcon name="my_location" aria-hidden="true" />
            </button>
          </div>

          <div className="patient-directory-map-summary">
            <h3>Chế độ xem hiện tại</h3>
            <div className="patient-directory-summary-list">
              <div>
                <span className="is-clinic" />
                <p>{clinicCount} phòng khám khả dụng</p>
              </div>
              <div>
                <span className="is-pharmacy" />
                <p>{pharmacyCount} nhà thuốc đang mở</p>
              </div>
            </div>
            <p>{directoryViewMeta.radiusLabel}</p>
          </div>
        </section>
      </section>
    </div>
  )
}
