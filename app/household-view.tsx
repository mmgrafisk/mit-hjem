"use client";

import {
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadHouseholdAccess,
  removeHouseholdMember,
  revokeHouseholdInvitation,
  sendHouseholdInvitation,
  type HouseholdInvitation,
  type HouseholdMember,
} from "./household-data";
import { useModalAccessibility } from "./modal-accessibility";

type HouseholdViewProps = {
  householdId?: string;
  householdName: string;
  user?: { id: string; email: string; displayName: string };
  onSyncState?: (state: "saving" | "synced" | "error") => void;
};

function InvitationModal({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalAccessibility(onClose, saving);
  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Skriv en gyldig e-mailadresse.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSend(email);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Invitationen kunne ikke sendes.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={() => !saving && onClose()} role="presentation">
      <section
        aria-labelledby="invitation-dialog-title"
        aria-modal="true"
        className="invite-modal"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="Luk"
          className="modal-close"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
        <header>
          <span className="modal-icon">
            <MailPlus size={20} />
          </span>
          <div>
            <h2 id="invitation-dialog-title">Invitér til husstanden</h2>
            <p>Linket udløber automatisk efter syv dage.</p>
          </div>
        </header>
        <label>
          <span>E-mail</span>
          <input
            autoFocus
            onChange={(event) => setEmail(event.target.value)}
            placeholder="navn@eksempel.dk"
            type="email"
            value={email}
          />
        </label>
        {error ? (
          <p className="modal-error" role="alert">
            {error}
          </p>
        ) : null}
        <footer>
          <button className="secondary-button" onClick={onClose} type="button">
            Annuller
          </button>
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void submit()}
            type="button"
          >
            {saving ? "Sender…" : "Send invitation"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function HouseholdView({
  householdId,
  householdName,
  user,
  onSyncState,
}: HouseholdViewProps) {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => {
    if (!householdId || !user) return;
    const result = await loadHouseholdAccess(
      householdId,
      user.id,
      user.email,
      user.displayName,
    );
    setMembers(result.members);
    setInvitations(result.invitations);
    setIsOwner(result.isOwner);
  };
  useEffect(() => {
    const task = window.setTimeout(
      () =>
        void refresh().catch(() => {
          setError("Husstanden kunne ikke indlæses.");
          onSyncState?.("error");
        }),
      0,
    );
    return () => window.clearTimeout(task);
  }, [householdId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async (email: string) => {
    if (!householdId) return;
    onSyncState?.("saving");
    await sendHouseholdInvitation(householdId, email);
    await refresh();
    onSyncState?.("synced");
  };
  const revoke = async (invitationId: string) => {
    if (!householdId) return;
    onSyncState?.("saving");
    try {
      await revokeHouseholdInvitation(householdId, invitationId);
      await refresh();
      onSyncState?.("synced");
    } catch {
      setError("Invitationen kunne ikke tilbagekaldes.");
      onSyncState?.("error");
    }
  };
  const removeMember = async (memberUserId: string) => {
    if (!householdId) return;
    onSyncState?.("saving");
    try {
      await removeHouseholdMember(householdId, memberUserId);
      await refresh();
      onSyncState?.("synced");
    } catch {
      setError("Medlemmet kunne ikke fjernes.");
      onSyncState?.("error");
    }
  };
  return (
    <div className="household-page">
      <div className="module-toolbar">
        <div>
          <h2>{householdName}</h2>
          <p>
            Medlemmer kan redigere det fælles indhold. Kun ejeren styrer adgang.
          </p>
        </div>
        {isOwner ? (
          <button
            className="primary-button"
            onClick={() => setInviteOpen(true)}
            type="button"
          >
            <MailPlus size={16} /> Invitér medlem
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="modal-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="household-members">
        <header>
          <h3>Medlemmer</h3>
          <span>{members.length}</span>
        </header>
        {members.map((member) => (
          <article key={member.userId}>
            <span className="member-avatar">
              {member.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <strong>{member.name}</strong>
              <small>{member.email ?? "E-mail skjult"}</small>
            </div>
            <span className={`role-badge ${member.role}`}>
              <ShieldCheck size={14} />
              {member.role === "owner" ? "Ejer" : "Medlem"}
            </span>
            {isOwner && member.role === "member" ? (
              <button
                aria-label={`Fjern ${member.name}`}
                className="member-remove"
                onClick={() => void removeMember(member.userId)}
                title="Fjern medlem"
                type="button"
              >
                <Trash2 size={15} />
              </button>
            ) : null}
          </article>
        ))}
      </section>
      {isOwner ? (
        <section className="household-invitations">
          <header>
            <h3>Åbne invitationer</h3>
            <span>
              {
                invitations.filter(
                  (item) => !item.acceptedAt && !item.revokedAt,
                ).length
              }
            </span>
          </header>
          {invitations
            .filter((item) => !item.acceptedAt && !item.revokedAt)
            .map((invitation) => (
              <article key={invitation.id}>
                <MailPlus size={17} />
                <div>
                  <strong>{invitation.email}</strong>
                  <small>
                    Udløber{" "}
                    {new Intl.DateTimeFormat("da-DK", {
                      dateStyle: "medium",
                    }).format(new Date(invitation.expiresAt))}
                  </small>
                </div>
                <button
                  aria-label={`Gensend til ${invitation.email}`}
                  onClick={() => void send(invitation.email)}
                  title="Gensend"
                  type="button"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  aria-label={`Tilbagekald ${invitation.email}`}
                  onClick={() => void revoke(invitation.id)}
                  title="Tilbagekald"
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          {!invitations.some((item) => !item.acceptedAt && !item.revokedAt) ? (
            <div className="empty-state">
              <Users size={18} />
              Ingen åbne invitationer
            </div>
          ) : null}
        </section>
      ) : null}
      {inviteOpen ? (
        <InvitationModal onClose={() => setInviteOpen(false)} onSend={send} />
      ) : null}
    </div>
  );
}
