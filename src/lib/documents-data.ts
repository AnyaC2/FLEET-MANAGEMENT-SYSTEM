import { db } from '@/lib/db';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Document, DocumentAudience, DocumentTypeOption } from '@/types';

const DOCUMENTS_BUCKET = 'documents';
const DOCUMENT_TYPES_STORAGE_KEY = 'lfz_fleet_document_types';

const defaultDocumentTypes: DocumentTypeOption[] = [
  { id: 'default-registration', name: 'Registration', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-insurance', name: 'Insurance', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-road-worthiness', name: 'Road Worthiness Certificate', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-proof-of-ownership', name: 'Proof of Ownership Certificate', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-cmr', name: 'Central Motor Registry (CMR)', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-purchase-invoice', name: 'Purchase Invoice', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-customs-paper', name: 'Customs Paper', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-tinted-glass', name: 'Tinted Glass Permit', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-hackney', name: 'Hackney Permit', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-lasdri', name: 'LASDRI Card', appliesTo: 'both', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-service-receipt', name: 'Service Receipt', appliesTo: 'vehicle', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-license', name: 'License', appliesTo: 'driver', createdAt: new Date(0).toISOString(), isDefault: true },
  { id: 'default-other', name: 'Other', appliesTo: 'both', createdAt: new Date(0).toISOString(), isDefault: true },
];

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

type DocumentTypeRow = {
  id: string;
  name: string;
  applies_to: DocumentAudience | 'both';
  created_at: string;
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

function mapDocumentTypeRow(row: DocumentTypeRow): DocumentTypeOption {
  return {
    id: row.id,
    name: row.name,
    appliesTo: row.applies_to,
    createdAt: row.created_at,
  };
}

function mergeDocumentTypes(customTypes: DocumentTypeOption[]): DocumentTypeOption[] {
  const merged = new Map<string, DocumentTypeOption>();

  for (const item of defaultDocumentTypes) {
    merged.set(item.name.toLowerCase(), item);
  }

  for (const item of customTypes) {
    merged.set(item.name.toLowerCase(), item);
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getStoredDocumentTypes(): DocumentTypeOption[] {
  const raw = localStorage.getItem(DOCUMENT_TYPES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as DocumentTypeOption[];
  } catch (error) {
    console.error('Failed to parse stored document types.', error);
    return [];
  }
}

function saveStoredDocumentTypes(types: DocumentTypeOption[]) {
  localStorage.setItem(DOCUMENT_TYPES_STORAGE_KEY, JSON.stringify(types));
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

export async function listDocumentTypes(): Promise<DocumentTypeOption[]> {
  return withSupabaseRead(
    () => mergeDocumentTypes(getStoredDocumentTypes()),
    async () => {
      const { data, error } = await supabase!
        .from('document_types')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Supabase document types request failed, falling back to defaults/local types.', error);
        return mergeDocumentTypes(getStoredDocumentTypes());
      }
      return mergeDocumentTypes((data as DocumentTypeRow[]).map(mapDocumentTypeRow));
    }
  );
}

export async function createDocumentType(input: {
  name: string;
  appliesTo: DocumentAudience | 'both';
}): Promise<DocumentTypeOption> {
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error('Document type name is required');
  }

  return withSupabaseWrite(
    () => {
      const existing = getStoredDocumentTypes().find(
        (item) => item.name.toLowerCase() === normalizedName.toLowerCase()
      );
      if (existing) {
        return existing;
      }

      const created: DocumentTypeOption = {
        id: `doctype-${Date.now()}`,
        name: normalizedName,
        appliesTo: input.appliesTo,
        createdAt: new Date().toISOString(),
      };

      saveStoredDocumentTypes([...getStoredDocumentTypes(), created]);
      return created;
    },
    async () => {
      const existingTypes = await listDocumentTypes();
      const existing = existingTypes.find(
        (item) => item.name.toLowerCase() === normalizedName.toLowerCase()
      );
      if (existing) {
        return existing;
      }

      const { data, error } = await supabase!
        .from('document_types')
        .upsert(
          {
            id: crypto.randomUUID(),
            name: normalizedName,
            applies_to: input.appliesTo,
          },
          { onConflict: 'name' }
        )
        .select()
        .single();

      if (error) {
        console.error('Supabase document type write failed, saving locally instead.', error);
        const created: DocumentTypeOption = {
          id: `doctype-${Date.now()}`,
          name: normalizedName,
          appliesTo: input.appliesTo,
          createdAt: new Date().toISOString(),
        };
        saveStoredDocumentTypes([...getStoredDocumentTypes(), created]);
        return created;
      }
      return mapDocumentTypeRow(data as DocumentTypeRow);
    }
  );
}

export async function deleteDocumentRecord(document: Document): Promise<void> {
  void document;
  throw new Error('Document deletion is disabled.');
}
