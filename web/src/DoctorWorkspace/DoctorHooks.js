import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../utils/api'
import { parseDateValue, safeArray, toLocalDateKey } from './doctorData'
import {
  doctorApi,
  normalizeAppointment,
  normalizeEncounter,
  normalizePatient,
  normalizePrescription,
} from './doctorApi'

export function getTodayDate() {
  return toLocalDateKey(new Date())
}

export function toDateTimeInputValue(value) {
  const parsed = value ? new Date(value) : new Date()
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const year = safeDate.getFullYear()
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  const day = String(safeDate.getDate()).padStart(2, '0')
  const hour = String(safeDate.getHours()).padStart(2, '0')
  const minute = String(safeDate.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function buildFallbackName(id, prefix) {
  if (!id) {
    return prefix
  }

  return String(id)
}

export function extractPatient(payload) {
  return payload ? normalizePatient(payload) : null
}

export function extractEncounter(payload) {
  return payload ? normalizeEncounter(payload) : null
}

export function extractAppointment(payload) {
  return payload ? normalizeAppointment(payload) : null
}

export function extractPrescription(payload) {
  return payload ? normalizePrescription(payload) : null
}

export function extractItems(payload, fallback = []) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  return fallback
}

export function computeQueueBoard(board = {}) {
  const waiting = safeArray(board.waiting)
  const called = safeArray(board.called)
  const inService = safeArray(board.in_service)
  const completed = safeArray(board.completed)
  const currentServing = inService[0] || called[0] || null
  const queueItems = [...inService, ...called, ...waiting, ...completed]

  return {
    waiting,
    called,
    inService,
    completed,
    currentServing,
    queueItems,
  }
}

export function buildScheduleBuckets(schedules = [], selectedDate) {
  const selectedDateValue = selectedDate || getTodayDate()

  return safeArray(schedules).filter((schedule) => {
    const dateValue = schedule.shift_start || schedule.start_time
    return dateValue && toLocalDateKey(parseDateValue(dateValue)) === selectedDateValue
  })
}

export function useAsyncResource(loader, deps, fallbackData, options = {}) {
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({
    data: fallbackData,
    loading: true,
    error: '',
    isFallback: false,
  })

  useEffect(() => {
    let active = true

    async function run() {
      setState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const nextData = await loader()
        if (!active) {
          return
        }

        setState({
          data: nextData,
          loading: false,
          error: '',
          isFallback: false,
        })
      } catch (error) {
        if (!active) {
          return
        }

        setState({
          data: fallbackData,
          loading: false,
          error: getApiErrorMessage(error, options.fallbackMessage || 'Unable to load data.'),
          isFallback: true,
        })
      }
    }

    run()

    return () => {
      active = false
    }
  }, [...deps, reloadToken])

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  return [state, reload]
}

export function usePollingReload(reload, enabled, intervalMs = 30000) {
  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      reload()
    }, intervalMs)

    return () => window.clearInterval(intervalId)
  }, [enabled, intervalMs, reload])
}

export function usePatientMap(patientIds = []) {
  const [patientMap, setPatientMap] = useState({})
  const orderedIds = useMemo(() => [...new Set(patientIds.filter(Boolean))].sort(), [patientIds])
  const cacheKey = orderedIds.join('|')

  useEffect(() => {
    const missingIds = orderedIds.filter((id) => !patientMap[id])

    if (missingIds.length === 0) {
      return
    }

    let active = true

    async function loadPatients() {
      const entries = await Promise.all(
        missingIds.map(async (patientId) => {
          try {
            const patient = await doctorApi.patients.getDetail(patientId)
            return [patientId, patient]
          } catch {
            return [
              patientId,
              {
                patient_id: patientId,
                full_name: '',
                patient_code: patientId,
                status: '',
              },
            ]
          }
        }),
      )

      if (active) {
        setPatientMap((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      }
    }

    loadPatients()

    return () => {
      active = false
    }
  }, [cacheKey, orderedIds, patientMap])

  return patientMap
}
