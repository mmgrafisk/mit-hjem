import { getSupabaseBrowserClient } from "./supabase-client";

export type DocumentKind = "invoice" | "receipt" | "insurance" | "payslip" | "contract" | "warranty" | "other";
export type DocumentVisibility = "household" | "private";

export type HouseholdDocument = {
  id: string;
  title: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  processingStatus: string;
  createdAt: string;
};

const bucket = "household-documents";
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function loadDocuments(householdId: string): Promise<HouseholdDocument[]> {
  const result = await getSupabaseBrowserClient()
    .from("documents")
    .select("id, title, kind, visibility, mime_type, size_bytes, storage_path, processing_status, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  return (result.data ?? []).map((document) => ({
    id: document.id,
    title: document.title,
    kind: document.kind as DocumentKind,
    visibility: document.visibility as DocumentVisibility,
    mimeType: document.mime_type,
    sizeBytes: Number(document.size_bytes),
    storagePath: document.storage_path,
    processingStatus: document.processing_status,
    createdAt: document.created_at,
  }));
}

export async function uploadDocument({
  householdId,
  userId,
  file,
  title,
  kind,
  visibility,
}: {
  householdId: string;
  userId: string;
  file: File;
  title: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
}) {
  if (!allowedMimeTypes.has(file.type)) throw new Error("Filtypen understøttes ikke.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Filen må højst fylde 20 MB.");
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "dokument";
  const storagePath = `${householdId}/${userId}/${crypto.randomUUID()}-${safeName}`;
  const supabase = getSupabaseBrowserClient();

  const uploadResult = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (uploadResult.error) throw uploadResult.error;

  const metadataResult = await supabase.from("documents").insert({
    household_id: householdId,
    created_by: userId,
    owner_user_id: userId,
    title,
    kind,
    visibility,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    processing_status: "ready",
  });
  if (metadataResult.error) {
    await supabase.storage.from(bucket).remove([storagePath]);
    throw metadataResult.error;
  }
}

export async function createDocumentUrl(storagePath: string) {
  const result = await getSupabaseBrowserClient().storage.from(bucket).createSignedUrl(storagePath, 60);
  if (result.error) throw result.error;
  return result.data.signedUrl;
}

export function documentKindLabel(kind: DocumentKind) {
  return ({
    invoice: "Faktura",
    receipt: "Kvittering",
    insurance: "Forsikring",
    payslip: "Lønseddel",
    contract: "Kontrakt",
    warranty: "Garanti",
    other: "Andet",
  } satisfies Record<DocumentKind, string>)[kind];
}

export function documentMeta(document: HouseholdDocument) {
  const date = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(document.createdAt));
  const size = document.sizeBytes < 1024 * 1024 ? `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB` : `${(document.sizeBytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${documentKindLabel(document.kind)} · ${date} · ${size}`;
}
