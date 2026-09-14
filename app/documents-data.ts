import { getSupabaseBrowserClient } from "./supabase-client";

export type DocumentKind = "invoice" | "receipt" | "insurance" | "payslip" | "contract" | "warranty" | "other";
export type DocumentVisibility = "household" | "private";

export type DocumentFolder = {
  id: string;
  name: string;
  color: string;
};

export type DocumentTag = {
  id: string;
  name: string;
  color: string;
};

export type DocumentArchiveInput = {
  title: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
  folderId: string | null;
  documentDate: string | null;
  expiresOn: string | null;
  notes: string | null;
  tagNames: string[];
  transactionIds: string[];
  subscriptionIds: string[];
  taskIds: string[];
};

export type HouseholdDocument = {
  id: string;
  title: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  processingStatus: string;
  folderId: string | null;
  folderName: string | null;
  folderColor: string | null;
  documentDate: string | null;
  expiresOn: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  tags: DocumentTag[];
  linkedTransactionIds: string[];
  linkedSubscriptionIds: string[];
  linkedTaskIds: string[];
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

function pushToMap(map: Map<string, string[]>, key: string, value: string) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

export function normalizeDocumentTags(values: string[]) {
  const seen = new Set<string>();
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => {
      const normalized = value.toLocaleLowerCase("da-DK");
      if (!value || value.length > 40 || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 12);
}

export async function loadDocumentFolders(householdId: string): Promise<DocumentFolder[]> {
  const result = await getSupabaseBrowserClient()
    .from("document_folders")
    .select("id, name, color")
    .eq("household_id", householdId)
    .order("name");
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function loadDocuments(householdId: string): Promise<HouseholdDocument[]> {
  const supabase = getSupabaseBrowserClient();
  const [documentsResult, foldersResult, tagsResult, tagLinksResult, transactionLinksResult, subscriptionLinksResult, taskLinksResult] = await Promise.all([
    supabase.from("documents").select("id, title, kind, visibility, mime_type, size_bytes, storage_path, processing_status, folder_id, document_date, expires_on, notes, archived_at, created_by, created_at").eq("household_id", householdId).order("created_at", { ascending: false }),
    supabase.from("document_folders").select("id, name, color").eq("household_id", householdId).order("name"),
    supabase.from("document_tags").select("id, name, color").eq("household_id", householdId).order("name"),
    supabase.from("document_tag_links").select("document_id, tag_id").eq("household_id", householdId),
    supabase.from("transaction_documents").select("transaction_id, document_id").eq("household_id", householdId),
    supabase.from("subscription_documents").select("subscription_id, document_id").eq("household_id", householdId),
    supabase.from("task_documents").select("task_id, document_id").eq("household_id", householdId),
  ]);
  for (const result of [documentsResult, foldersResult, tagsResult, tagLinksResult, transactionLinksResult, subscriptionLinksResult, taskLinksResult]) {
    if (result.error) throw result.error;
  }

  const folderById = new Map((foldersResult.data ?? []).map((folder) => [folder.id, folder]));
  const tagById = new Map((tagsResult.data ?? []).map((tag) => [tag.id, tag]));
  const tagIdsByDocument = new Map<string, string[]>();
  const transactionIdsByDocument = new Map<string, string[]>();
  const subscriptionIdsByDocument = new Map<string, string[]>();
  const taskIdsByDocument = new Map<string, string[]>();
  for (const link of tagLinksResult.data ?? []) pushToMap(tagIdsByDocument, link.document_id, link.tag_id);
  for (const link of transactionLinksResult.data ?? []) pushToMap(transactionIdsByDocument, link.document_id, link.transaction_id);
  for (const link of subscriptionLinksResult.data ?? []) pushToMap(subscriptionIdsByDocument, link.document_id, link.subscription_id);
  for (const link of taskLinksResult.data ?? []) pushToMap(taskIdsByDocument, link.document_id, link.task_id);

  return (documentsResult.data ?? []).map((document) => {
    const folder = document.folder_id ? folderById.get(document.folder_id) : null;
    return {
      id: document.id,
      title: document.title,
      kind: document.kind as DocumentKind,
      visibility: document.visibility as DocumentVisibility,
      mimeType: document.mime_type,
      sizeBytes: Number(document.size_bytes),
      storagePath: document.storage_path,
      processingStatus: document.processing_status,
      folderId: document.folder_id,
      folderName: folder?.name ?? null,
      folderColor: folder?.color ?? null,
      documentDate: document.document_date,
      expiresOn: document.expires_on,
      notes: document.notes,
      archivedAt: document.archived_at,
      createdBy: document.created_by,
      createdAt: document.created_at,
      tags: (tagIdsByDocument.get(document.id) ?? []).map((tagId) => tagById.get(tagId)).filter((tag): tag is DocumentTag => Boolean(tag)),
      linkedTransactionIds: transactionIdsByDocument.get(document.id) ?? [],
      linkedSubscriptionIds: subscriptionIdsByDocument.get(document.id) ?? [],
      linkedTaskIds: taskIdsByDocument.get(document.id) ?? [],
    };
  });
}

function validateArchiveInput(input: DocumentArchiveInput) {
  if (!input.title.trim()) throw new Error("Dokumentet skal have en titel.");
  if (input.notes && input.notes.length > 4000) throw new Error("Noter må højst være 4.000 tegn.");
  if (input.documentDate && input.expiresOn && input.expiresOn < input.documentDate) throw new Error("Udløbsdatoen kan ikke ligge før dokumentdatoen.");
}

export async function updateDocumentArchive(householdId: string, documentId: string, input: DocumentArchiveInput) {
  validateArchiveInput(input);
  const tagNames = normalizeDocumentTags(input.tagNames);
  const result = await getSupabaseBrowserClient().rpc("update_document_archive_metadata", {
    p_document_id: documentId,
    p_household_id: householdId,
    p_title: input.title.trim(),
    p_kind: input.kind,
    p_visibility: input.visibility,
    p_folder_id: input.folderId,
    p_document_date: input.documentDate,
    p_expires_on: input.expiresOn,
    p_notes: input.notes?.trim() || "",
    p_tag_names: tagNames,
    p_transaction_ids: [...new Set(input.transactionIds)],
    p_subscription_ids: [...new Set(input.subscriptionIds)],
    p_task_ids: [...new Set(input.taskIds)],
  });
  if (result.error) throw result.error;
}

export async function createDocumentFolder(householdId: string, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Mappen skal have et navn.");
  const result = await getSupabaseBrowserClient()
    .from("document_folders")
    .insert({ household_id: householdId, created_by: userId, name: trimmed })
    .select("id, name, color")
    .single();
  if (result.error) throw result.error;
  return result.data as DocumentFolder;
}

export async function setDocumentArchived(householdId: string, documentId: string, archived: boolean) {
  const result = await getSupabaseBrowserClient()
    .from("documents")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", documentId)
    .eq("household_id", householdId)
    .select("id")
    .single();
  if (result.error) throw result.error;
}

export async function uploadDocument({
  householdId,
  userId,
  file,
  input,
}: {
  householdId: string;
  userId: string;
  file: File;
  input: DocumentArchiveInput;
}) {
  validateArchiveInput(input);
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
    title: input.title.trim(),
    kind: input.kind,
    visibility: input.visibility,
    folder_id: input.folderId,
    document_date: input.documentDate,
    expires_on: input.expiresOn,
    notes: input.notes?.trim() || null,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    processing_status: "ready",
  }).select("id").single();
  if (metadataResult.error) {
    await supabase.storage.from(bucket).remove([storagePath]);
    throw metadataResult.error;
  }

  try {
    await updateDocumentArchive(householdId, metadataResult.data.id, input);
  } catch (error) {
    await supabase.from("documents").delete().eq("id", metadataResult.data.id).eq("household_id", householdId);
    await supabase.storage.from(bucket).remove([storagePath]);
    throw error;
  }
  return metadataResult.data.id;
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

function formattedBytes(sizeBytes: number) {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    : `${(sizeBytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function documentMeta(document: HouseholdDocument) {
  const sourceDate = document.documentDate ?? document.createdAt;
  const date = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${sourceDate.slice(0, 10)}T12:00:00`));
  return `${documentKindLabel(document.kind)} · ${date} · ${formattedBytes(document.sizeBytes)}`;
}

export function documentExpiryState(expiresOn: string | null, now = new Date()): "none" | "soon" | "expired" {
  if (!expiresOn) return "none";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (expiresOn < today) return "expired";
  const warningLimit = new Date(`${today}T12:00:00Z`);
  warningLimit.setUTCDate(warningLimit.getUTCDate() + 45);
  return expiresOn <= warningLimit.toISOString().slice(0, 10) ? "soon" : "none";
}
