"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  FileText,
  FolderClosed,
  FolderPlus,
  Link2,
  LockKeyhole,
  Plus,
  ReceiptText,
  Search,
  Tag,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  documentExpiryState,
  documentKindLabel,
  documentMeta,
  normalizeDocumentTags,
  type DocumentArchiveInput,
  type DocumentFolder,
  type DocumentKind,
  type DocumentVisibility,
  type HouseholdDocument,
} from "./documents-data";
import { useModalAccessibility } from "./modal-accessibility";

export type DocumentRelationOption = {
  id: string;
  label: string;
  meta?: string | null;
};

export type DocumentRelationGroups = {
  transactions: DocumentRelationOption[];
  subscriptions: DocumentRelationOption[];
  tasks: DocumentRelationOption[];
};

type DocumentEditorProps = {
  document?: HouseholdDocument | null;
  folders: DocumentFolder[];
  relations: DocumentRelationGroups;
  onArchive: (document: HouseholdDocument, archived: boolean) => Promise<boolean>;
  onClose: () => void;
  onOpen: (document: HouseholdDocument) => void | Promise<void>;
  onSave: (input: DocumentArchiveInput, file?: File) => Promise<boolean>;
};

const documentKinds: DocumentKind[] = ["invoice", "receipt", "insurance", "payslip", "contract", "warranty", "other"];

function toggleValue(values: string[], value: string, selected: boolean) {
  return selected ? [...new Set([...values, value])] : values.filter((entry) => entry !== value);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function RelationChecklist({ icon, label, options, selected, setSelected }: {
  icon: ReactNode;
  label: string;
  options: DocumentRelationOption[];
  selected: string[];
  setSelected: (values: string[]) => void;
}) {
  return (
    <section className="document-relation-group">
      <header><span>{icon}{label}</span><small>{selected.length} valgt</small></header>
      {options.length ? (
        <div>
          {options.map((option) => (
            <label key={option.id}>
              <input checked={selected.includes(option.id)} onChange={(event) => setSelected(toggleValue(selected, option.id, event.target.checked))} type="checkbox" />
              <span><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</span>
            </label>
          ))}
        </div>
      ) : <p>Ingen elementer at forbinde endnu.</p>}
    </section>
  );
}

function DocumentEditor({ document, folders, relations, onArchive, onClose, onOpen, onSave }: DocumentEditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(document?.title ?? "");
  const [kind, setKind] = useState<DocumentKind>(document?.kind ?? "other");
  const [visibility, setVisibility] = useState<DocumentVisibility>(document?.visibility ?? "household");
  const [folderId, setFolderId] = useState(document?.folderId ?? "");
  const [documentDate, setDocumentDate] = useState(document?.documentDate ?? "");
  const [expiresOn, setExpiresOn] = useState(document?.expiresOn ?? "");
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [tagText, setTagText] = useState(document?.tags.map((tag) => tag.name).join(", ") ?? "");
  const [transactionIds, setTransactionIds] = useState(document?.linkedTransactionIds ?? []);
  const [subscriptionIds, setSubscriptionIds] = useState(document?.linkedSubscriptionIds ?? []);
  const [taskIds, setTaskIds] = useState(document?.linkedTaskIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalAccessibility(onClose, busy);
  const submit = async () => {
    if (busy || !title.trim() || (!document && !file)) return;
    if (documentDate && expiresOn && expiresOn < documentDate) {
      setError("Udløbsdatoen kan ikke ligge før dokumentdatoen.");
      return;
    }
    setBusy(true);
    setError("");
    const saved = await onSave({
      title: title.trim(),
      kind,
      visibility,
      folderId: folderId || null,
      documentDate: documentDate || null,
      expiresOn: expiresOn || null,
      notes: notes.trim() || null,
      tagNames: normalizeDocumentTags([tagText]),
      transactionIds,
      subscriptionIds,
      taskIds,
    }, file ?? undefined);
    if (!saved) setError("Dokumentet kunne ikke gemmes. Prøv igen.");
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose} role="presentation">
      <section aria-labelledby="document-editor-title" aria-modal="true" className="quick-modal document-editor-modal" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <button aria-label="Luk" className="modal-close" disabled={busy} onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><FileText size={20} /></span>
        <div><h2 id="document-editor-title">{document ? "Dokumentdetaljer" : "Upload dokument"}</h2><p className="modal-intro">Saml fil, frister og forbindelser ét sted.</p></div>

        {!document ? (
          <label className="file-drop document-file-drop">
            <Upload size={22} />
            <strong>{file ? file.name : "Vælg dokument"}</strong>
            <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "PDF, billede, Word eller Excel · højst 20 MB"}</small>
            <input accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; setFile(nextFile); if (nextFile && !title) setTitle(nextFile.name.replace(/\.[^.]+$/, "")); }} required type="file" />
          </label>
        ) : null}

        <div className="document-form-grid">
          <label className="wide">Titel<input autoFocus maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Fx Husforsikring 2026" required value={title} /></label>
          <label>Type<select onChange={(event) => setKind(event.target.value as DocumentKind)} value={kind}>{documentKinds.map((value) => <option key={value} value={value}>{documentKindLabel(value)}</option>)}</select></label>
          <label>Adgang<select onChange={(event) => setVisibility(event.target.value as DocumentVisibility)} value={visibility}><option value="household">Hele husstanden</option><option value="private">{document ? "Kun dokumentets ejer" : "Kun mig"}</option></select></label>
          <label>Mappe<select onChange={(event) => setFolderId(event.target.value)} value={folderId}><option value="">Uden mappe</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
          <label>Dokumentdato<input onChange={(event) => setDocumentDate(event.target.value)} type="date" value={documentDate} /></label>
          <label>Udløber<input min={documentDate || undefined} onChange={(event) => setExpiresOn(event.target.value)} type="date" value={expiresOn} /></label>
          <label>Tags<input maxLength={500} onChange={(event) => setTagText(event.target.value)} placeholder="Fx bolig, skat, garanti" value={tagText} /><small>Adskil med komma · højst 12</small></label>
          <label className="wide">Noter<textarea maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Praktiske noter, policenummer eller kontaktoplysninger" rows={2} value={notes} /></label>
        </div>

        <details className="document-relations">
          <summary><span><Link2 size={16} />Forbind dokumentet</span><small>{transactionIds.length + subscriptionIds.length + taskIds.length} forbindelser</small></summary>
          <div className="document-relation-grid">
            <RelationChecklist icon={<ReceiptText size={14} />} label="Posteringer" options={relations.transactions} selected={transactionIds} setSelected={setTransactionIds} />
            <RelationChecklist icon={<Link2 size={14} />} label="Abonnementer" options={relations.subscriptions} selected={subscriptionIds} setSelected={setSubscriptionIds} />
            <RelationChecklist icon={<CheckSquare size={14} />} label="Opgaver" options={relations.tasks} selected={taskIds} setSelected={setTaskIds} />
          </div>
        </details>

        <p className="privacy-note">{visibility === "private" ? document ? "Privat: kun dokumentets ejer kan åbne det og se dets forbindelser." : "Privat: kun du kan åbne dokumentet og se dets forbindelser." : "Delt: alle medlemmer af husstanden kan åbne dokumentet."}</p>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <footer className="document-modal-actions">
          <div>
            {document ? <button className="secondary-button" disabled={busy} onClick={() => void onOpen(document)} type="button"><ExternalLink size={15} />Åbn fil</button> : null}
            {document ? <button className="secondary-button" disabled={busy} onClick={async () => { setBusy(true); const changed = await onArchive(document, !document.archivedAt); if (!changed) { setError("Arkivstatus kunne ikke ændres."); setBusy(false); } }} type="button">{document.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />}{document.archivedAt ? "Gendan" : "Arkivér"}</button> : null}
          </div>
          <div><button className="secondary-button" disabled={busy} onClick={onClose} type="button">Annuller</button><button className="primary-button" disabled={busy || !title.trim() || (!document && !file)} onClick={() => void submit()} type="button">{busy ? "Gemmer…" : document ? "Gem ændringer" : "Upload dokument"}</button></div>
        </footer>
      </section>
    </div>
  );
}

function FolderModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalAccessibility(onClose, busy);
  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onClose} role="presentation">
      <section aria-labelledby="folder-modal-title" aria-modal="true" className="quick-modal checklist-modal compact folder-modal" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <button aria-label="Luk" className="modal-close" disabled={busy} onClick={onClose} type="button"><X size={18} /></button>
        <span className="modal-icon"><FolderPlus size={20} /></span>
        <div><h2 id="folder-modal-title">Ny mappe</h2><p className="modal-intro">Brug få, tydelige mapper til de vigtigste områder.</p></div>
        <label>Mappenavn<input autoFocus maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Fx Bolig" value={name} /></label>
        {error ? <p className="modal-error" role="alert">{error}</p> : null}
        <footer className="checklist-modal-actions"><span /><div><button className="secondary-button" disabled={busy} onClick={onClose} type="button">Annuller</button><button className="primary-button" disabled={busy || !name.trim()} onClick={async () => { setBusy(true); const saved = await onSave(name.trim()); if (!saved) { setError("Mappen kunne ikke oprettes."); setBusy(false); } }} type="button">{busy ? "Opretter…" : "Opret mappe"}</button></div></footer>
      </section>
    </div>
  );
}

export function DocumentLibraryView({
  createRequested,
  currentUserId,
  documents,
  folders,
  isOwner,
  onArchive,
  onCreateFolder,
  onCreateRequestHandled,
  onOpen,
  onSave,
  onUpload,
  relations,
}: {
  createRequested: boolean;
  currentUserId?: string;
  documents: HouseholdDocument[];
  folders: DocumentFolder[];
  isOwner: boolean;
  onArchive: (document: HouseholdDocument, archived: boolean) => Promise<boolean>;
  onCreateFolder: (name: string) => Promise<boolean>;
  onCreateRequestHandled: () => void;
  onOpen: (document: HouseholdDocument) => void | Promise<void>;
  onSave: (document: HouseholdDocument, input: DocumentArchiveInput) => Promise<boolean>;
  onUpload: (file: File, input: DocumentArchiveInput) => Promise<boolean>;
  relations: DocumentRelationGroups;
}) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [kind, setKind] = useState<"all" | DocumentKind>("all");
  const [status, setStatus] = useState<"active" | "expiring" | "archived">("active");
  const [sort, setSort] = useState<"newest" | "name" | "expiry">("newest");
  const [editing, setEditing] = useState<HouseholdDocument | null | undefined>(createRequested ? null : undefined);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const closeEditor = () => {
    setEditing(undefined);
    if (createRequested) onCreateRequestHandled();
  };
  const expiringCount = documents.filter((document) => !document.archivedAt && documentExpiryState(document.expiresOn) !== "none").length;
  const activeCount = documents.filter((document) => !document.archivedAt).length;
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("da-DK");
    return documents.filter((document) => {
      const expiryState = documentExpiryState(document.expiresOn);
      const searchText = [document.title, documentKindLabel(document.kind), document.folderName ?? "", document.notes ?? "", ...document.tags.map((tag) => tag.name)].join(" ").toLocaleLowerCase("da-DK");
      if (normalizedQuery && !searchText.includes(normalizedQuery)) return false;
      if (folder === "unfiled" && document.folderId) return false;
      if (folder !== "all" && folder !== "unfiled" && document.folderId !== folder) return false;
      if (kind !== "all" && document.kind !== kind) return false;
      if (status === "active" && document.archivedAt) return false;
      if (status === "archived" && !document.archivedAt) return false;
      if (status === "expiring" && (document.archivedAt || expiryState === "none")) return false;
      return true;
    }).sort((left, right) => {
      if (sort === "name") return left.title.localeCompare(right.title, "da");
      if (sort === "expiry") return (left.expiresOn ?? "9999-12-31").localeCompare(right.expiresOn ?? "9999-12-31");
      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [documents, folder, kind, query, sort, status]);

  return (
    <div className="document-library-page">
      <div className="module-toolbar"><div><h2>Dokumenter</h2><p>Søg, organisér og forbind husholdningens vigtige papirer.</p></div><button className="primary-button" onClick={() => setEditing(null)} type="button"><Upload size={16} />Upload dokument</button></div>
      <section className="document-summary-rail" aria-label="Dokumentoverblik">
        <span><small>Aktive dokumenter</small><strong>{activeCount}</strong></span>
        <span><small>Udløbne og snart udløbne</small><strong className={expiringCount ? "warning" : ""}>{expiringCount}</strong></span>
        <span><small>Private dokumenter</small><strong>{documents.filter((document) => !document.archivedAt && document.visibility === "private").length}</strong></span>
      </section>
      <section className="panel document-archive-shell">
        <aside className="document-folder-rail" aria-label="Mapper">
          <header><strong>Mapper</strong><button aria-label="Opret mappe" onClick={() => setFolderModalOpen(true)} type="button"><Plus size={15} /></button></header>
          <button aria-pressed={folder === "all"} className={folder === "all" ? "active" : ""} onClick={() => setFolder("all")} type="button"><FolderClosed size={15} />Alle<span>{activeCount}</span></button>
          {folders.map((item) => <button aria-pressed={folder === item.id} className={folder === item.id ? "active" : ""} key={item.id} onClick={() => setFolder(item.id)} type="button"><i style={{ background: item.color }} />{item.name}<span>{documents.filter((document) => !document.archivedAt && document.folderId === item.id).length}</span></button>)}
          <button aria-pressed={folder === "unfiled"} className={folder === "unfiled" ? "active" : ""} onClick={() => setFolder("unfiled")} type="button"><FileText size={15} />Uden mappe<span>{documents.filter((document) => !document.archivedAt && !document.folderId).length}</span></button>
        </aside>
        <div className="document-archive-main">
          <div className="document-toolbar">
            <label><Search size={16} /><input aria-label="Søg i dokumenter" onChange={(event) => setQuery(event.target.value)} placeholder="Søg i titel, tags eller noter" value={query} /></label>
            <div className="document-status-tabs" role="group" aria-label="Dokumentstatus">{([['active','Aktive'],['expiring',`Udløber (${expiringCount})`],['archived','Arkiv']] as const).map(([value,label]) => <button aria-pressed={status === value} className={status === value ? "active" : ""} key={value} onClick={() => setStatus(value)} type="button">{label}</button>)}</div>
            <select aria-label="Filtrér efter type" onChange={(event) => setKind(event.target.value as "all" | DocumentKind)} value={kind}><option value="all">Alle typer</option>{documentKinds.map((value) => <option key={value} value={value}>{documentKindLabel(value)}</option>)}</select>
            <select aria-label="Sortér dokumenter" onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}><option value="newest">Nyeste først</option><option value="name">Navn A–Å</option><option value="expiry">Udløb først</option></select>
          </div>
          <div className="document-archive-list" role="list">
            {visible.map((document) => {
              const expiryState = documentExpiryState(document.expiresOn);
              const canEdit = isOwner || document.createdBy === currentUserId;
              const relationCount = document.linkedTransactionIds.length + document.linkedSubscriptionIds.length + document.linkedTaskIds.length;
              return (
                <article className={document.archivedAt ? "is-archived" : ""} key={document.id} role="listitem">
                  <button aria-label={`Åbn filen ${document.title}`} className={`document-file-icon file-kind-${document.kind}`} onClick={() => void onOpen(document)} type="button"><FileText size={18} /></button>
                  <button className="document-row-main" disabled={!canEdit} onClick={() => canEdit && setEditing(document)} type="button"><strong>{document.title}</strong><small>{documentMeta(document)}</small><span>{document.tags.slice(0, 3).map((tag) => <em key={tag.id}><Tag size={10} />{tag.name}</em>)}</span></button>
                  <span className="document-folder-cell">{document.folderName ? <><i style={{ background: document.folderColor ?? "#5b6ee1" }} />{document.folderName}</> : "Uden mappe"}</span>
                  <span className="document-relation-cell">{relationCount ? <><Link2 size={13} />{relationCount} {relationCount === 1 ? "forbindelse" : "forbindelser"}</> : "Ikke forbundet"}</span>
                  <span className={`document-expiry-cell ${expiryState}`}>{document.expiresOn ? <><CalendarClock size={13} />{expiryState === "expired" ? "Udløbet" : expiryState === "soon" ? `Udløber ${dateLabel(document.expiresOn)}` : dateLabel(document.expiresOn)}</> : "Intet udløb"}</span>
                  <span className="document-access-cell">{document.visibility === "private" ? <><LockKeyhole size={13} />Privat</> : <><Users size={13} />Husstanden</>}</span>
                  {canEdit ? <button aria-label={`Redigér ${document.title}`} className="row-edit" onClick={() => setEditing(document)} type="button">Redigér</button> : <span />}
                </article>
              );
            })}
            {!visible.length ? <div className="empty-state action-empty"><FileText size={21} /><div><strong>{query ? "Ingen dokumenter matcher" : status === "archived" ? "Arkivet er tomt" : "Ingen dokumenter i denne visning"}</strong><span>Juster filtrene eller upload et nyt dokument.</span></div><button onClick={() => setEditing(null)} type="button"><Upload size={15} />Upload dokument</button></div> : null}
          </div>
        </div>
      </section>
      {editing !== undefined ? <DocumentEditor document={editing} folders={folders} relations={relations} onArchive={async (document, archived) => { const changed = await onArchive(document, archived); if (changed) closeEditor(); return changed; }} onClose={closeEditor} onOpen={onOpen} onSave={async (input, file) => { const saved = editing ? await onSave(editing, input) : file ? await onUpload(file, input) : false; if (saved) closeEditor(); return saved; }} /> : null}
      {folderModalOpen ? <FolderModal onClose={() => setFolderModalOpen(false)} onSave={async (name) => { const saved = await onCreateFolder(name); if (saved) setFolderModalOpen(false); return saved; }} /> : null}
    </div>
  );
}
