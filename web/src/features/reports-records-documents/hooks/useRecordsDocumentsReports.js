import { useCallback } from 'react';
import { reportsRecordsDocumentsApi } from '../api/reportsRecordsDocumentsApi';
import { useRecordsDocumentsReport } from './useRecordsDocumentsFilters';

export const useMedicalRecordsReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.medicalRecords(filters), []));
export const useFinalizedRecordsReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.finalizedRecords(filters), []));
export const useReleasedRecordsReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.releasedRecords(filters), []));
export const useVoidArchiveRecordsReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.voidArchive(filters), []));
export const useAttachmentReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.attachments(filters), []), { auto_refresh: true });
export const useRecordExportReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.exports(filters), []), { auto_refresh: true });
export const useDocumentTimelineReport = () => useRecordsDocumentsReport(useCallback((filters) => reportsRecordsDocumentsApi.timeline(filters), []));
