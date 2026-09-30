/**
 * Provenance vocabulary for archive records. The PostgreSQL schema itself lives in db.ts
 * (created idempotently at start-up; versions are recorded in schema_migrations).
 */

export const DATA_STATUSES = ['OFFICIAL', 'VERIFIED', 'EXTERNAL', 'SAMPLE', 'SYNTHETIC', 'UNVERIFIED'] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const REVIEW_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Status for a record from what we know about where it came from. */
export function deriveDataStatus(type: string, meta: Record<string, any>): DataStatus {
  if (meta?.dataStatus && (DATA_STATUSES as readonly string[]).includes(meta.dataStatus)) return meta.dataStatus;
  if (meta?.sample) return type === 'dataset' ? 'SYNTHETIC' : 'SAMPLE';
  return 'UNVERIFIED';
}

export function deriveProvenance(type: string, meta: Record<string, any>): Record<string, any> {
  if (meta?.sample) {
    return {
      source: 'POLARIS demo seed (server/seed.ts)',
      method: type === 'dataset' ? 'Synthetic sample extract generated from record metadata' : 'Illustrative demo record',
      note: 'Not an NCPOR data product. Replace through the admin API.',
    };
  }
  return {
    source: 'POLARIS seed from src/data/polarisData.ts',
    method: 'Compiled by the project team from public descriptions; not yet verified against NCPOR records',
  };
}
