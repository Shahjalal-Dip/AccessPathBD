import { Report } from "@/modules/reports/entities/report.entity";
import { ReportEvidence } from "@/modules/reports/entities/report-evidence.entity";

export const evidenceUrl = (reportId: string, evidenceId: string) =>
  `/api/v1/reports/${reportId}/evidence/${evidenceId}/file`;

export const toEvidenceView = (e: ReportEvidence) => ({
  id: e.id,
  url: evidenceUrl(e.reportId, e.id),
  mimeType: e.mimeType,
  originalName: e.originalName,
  sizeBytes: e.sizeBytes,
  uploadedAt: e.uploadedAt,
});

export const toReportView = (r: Report, evidence: ReportEvidence[] = []) => ({
  id: r.id,
  buildingId: r.buildingId,
  featureId: r.featureId,
  observationStatus: r.observationStatus,
  description: r.description,
  observedAt: r.observedAt,
  moderationStatus: r.moderationStatus,
  submittedAt: r.createdAt,
  decidedAt: r.decidedAt,
  featureType: r.feature?.featureType,
  building: r.building
    ? { id: r.building.id, name: r.building.name }
    : undefined,
  evidence: evidence.map(toEvidenceView),
});
