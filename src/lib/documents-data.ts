import { db } from '@/lib/db';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Document } from '@/types';

const DOCUMENTS_BUCKET = 'documents';

type DocumentRow = {
  id: string;
  title: string;
  document_type: Document['documentType'];
  vehicle_id: string | null;
  driver_id: string | null;
  file_url: string;
  file_path: string | null;
  file_name: string;
  file_size: number;
  expiry_date: string | null;
  uploaded_at: string;
  updated_at: string;
};

function mapDocumentRow(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    documentType: row.document_type,
    vehicleId: row.vehicle_id || undefined,
    driverId: row.driver_id || undefined,
    fileUrl: row.file_url,
    filePath: row.file_path || undefined,
    fileName: row.file_name,
    fileSize: row.file_size,
    expiryDate: row.expiry_date || undefined,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
  };
}

function mapDocumentToRow(document: Document) {
  return {
    id: document.id,
    title: document.title,
    document_type: document.documentType,
    vehicle_id: document.vehicleId ?? null,
    driver_id: document.driverId ?? null,
    file_url: document.fileUrl,
    file_path: document.filePath ?? null,
    file_name: document.fileName,
    file_size: document.fileSize,
    expiry_date: document.expiryDate ?? null,
  };
}

async function withSupabaseRead<T>(fallback: () => T, action: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    return fallback();
  }

  try {
    return await action();
  } catch (error) {
    console.error('Supabase documents request failed.', error);
    throw error;
  }
}

async function withSupabaseWrite<T>(fallback: () => T, action: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    return fallback();
  }

  return action();
}

export async function listDocuments(): Promise<Document[]> {
  return withSupabaseRead(
    () => db.documents.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('documents')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return (data as DocumentRow[]).map(mapDocumentRow);
    }
  );
}

export async function uploadDocumentRecord(document: Document, file?: File): Promise<Document> {
  return withSupabaseWrite(
    () => db.documents.create(document),
    async () => {
      let fileUrl = document.fileUrl;
      let filePath = document.filePath;

      if (file) {
        const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
        const safeExtension = extension ? `.${extension}` : '';
        filePath = `${document.id}/${Date.now()}-${document.fileName.replace(/\s+/g, '-')}${safeExtension && !document.fileName.endsWith(safeExtension) ? safeExtension : ''}`;

        const { error: uploadError } = await supabase!.storage
          .from(DOCUMENTS_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase!.storage.from(DOCUMENTS_BUCKET).getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
      }

      const { data, error } = await supabase!
        .from('documents')
        .insert(
          mapDocumentToRow({
            ...document,
            fileUrl,
            filePath,
          })
        )
        .select()
        .single();

      if (error) throw error;
      return mapDocumentRow(data as DocumentRow);
    }
  );
}

export async function deleteDocumentRecord(document: Document): Promise<void> {
  void document;
  throw new Error('Document deletion is disabled.');
}
