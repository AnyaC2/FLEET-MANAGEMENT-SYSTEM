import { db } from '@/lib/db';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ImportBatch } from '@/types';
import type { ImportExecutionResult, ImportWorkbookPreview } from '@/lib/data-import';

type ImportBatchRow = {
  id: string;
  file_name: string;
  imported_at: string;
  imported_by_user_id: string | null;
  imported_by_name: string | null;
  total_rows: number;
  valid_rows: number;
  created_counts: ImportBatch['created'];
  skipped_counts: ImportBatch['skipped'];
  issue_count: number;
  issues: ImportBatch['issues'];
  sheet_summaries: ImportBatch['sheets'];
};

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapRowToImportBatch(row: ImportBatchRow): ImportBatch {
  return {
    id: row.id,
    fileName: row.file_name,
    importedAt: row.imported_at,
    importedByUserId: row.imported_by_user_id || undefined,
    importedByName: row.imported_by_name || undefined,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    created: row.created_counts,
    skipped: row.skipped_counts,
    issueCount: row.issue_count,
    issues: row.issues,
    sheets: row.sheet_summaries,
  };
}

function mapImportBatchToRow(batch: ImportBatch): ImportBatchRow {
  return {
    id: batch.id,
    file_name: batch.fileName,
    imported_at: batch.importedAt,
    imported_by_user_id: batch.importedByUserId ?? null,
    imported_by_name: batch.importedByName ?? null,
    total_rows: batch.totalRows,
    valid_rows: batch.validRows,
    created_counts: batch.created,
    skipped_counts: batch.skipped,
    issue_count: batch.issueCount,
    issues: batch.issues,
    sheet_summaries: batch.sheets,
  };
}

function sortImportBatches(items: ImportBatch[]) {
  return [...items].sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

function buildImportBatch(input: {
  preview: ImportWorkbookPreview;
  result: ImportExecutionResult;
  importedBy?: { id?: string; name?: string } | null;
}): ImportBatch {
  const importedAt = new Date().toISOString();

  return {
    id: createId('imp'),
    fileName: input.preview.fileName,
    importedAt,
    importedByUserId: input.importedBy?.id,
    importedByName: input.importedBy?.name,
    totalRows: input.preview.totalRows,
    validRows: input.preview.validRows,
    created: input.result.created,
    skipped: input.result.skipped,
    issueCount: input.result.issues.length,
    issues: input.result.issues,
    sheets: input.preview.sheets,
  };
}

export async function listImportBatches(limit = 10): Promise<ImportBatch[]> {
  const local = () => sortImportBatches(db.importBatches.getAll()).slice(0, limit);

  if (!isSupabaseConfigured || !supabase) {
    return local();
  }

  try {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data as ImportBatchRow[] | null)?.map(mapRowToImportBatch) ?? [];
  } catch (error) {
    console.error('Failed to load import history from Supabase, falling back to local storage.', error);
    return local();
  }
}

export async function recordImportBatch(input: {
  preview: ImportWorkbookPreview;
  result: ImportExecutionResult;
  importedBy?: { id?: string; name?: string } | null;
}): Promise<ImportBatch> {
  const batch = buildImportBatch(input);
  db.importBatches.create(batch);

  if (!isSupabaseConfigured || !supabase) {
    return batch;
  }

  try {
    const { data, error } = await supabase
      .from('import_batches')
      .insert(mapImportBatchToRow(batch))
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapRowToImportBatch(data as ImportBatchRow);
  } catch (error) {
    console.error('Failed to persist import history to Supabase, kept local fallback.', error);
    return batch;
  }
}
