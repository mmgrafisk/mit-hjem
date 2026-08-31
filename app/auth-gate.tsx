"use client";

import { CheckCircle2, House, LoaderCircle, LockKeyhole, Mail, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { HouseholdApp } from "./household-app";
import { getSupabaseBrowserClient } from "./supabase-client";

type AuthMode = "login" | "signup";
type Household = { id: string; name: string };

function userName(user: User) {
  const candidate = user.user_metadata?.full_name;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  return user.email?.split("@")[0] || "Bruger";
}

async function ensureHousehold(user: User): Promise<Household> {
  const supabase = getSupabaseBrowserClient();
  const fullName = userName(user);

  const profileResult = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    locale: "da-DK",
  });
  if (profileResult.error) throw profileResult.error;

  const membershipResult = await supabase
    .from("household_members")
    .select("household_id, households(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipResult.error) throw membershipResult.error;

  const joinedHousehold = membershipResult.data?.households;
  if (joinedHousehold && !Array.isArray(joinedHousehold)) return joinedHousehold;

  const existingResult = await supabase
    .from("households")
    .select("id, name")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;

  let household = existingResult.data;
  if (!household) {
    const createdResult = await supabase
      .from("households")
      .insert({ created_by: user.id, name: "Mit hjem", locale: "da-DK", currency: "DKK" })
      .select("id, name")
      .single();
    if (createdResult.error) throw createdResult.error;
    household = createdResult.data;
  }

  const memberResult = await supabase.from("household_members").upsert(
    {
      household_id: household.id,
      user_id: user.id,
      role: "owner",
    },
    { onConflict: "household_id,user_id" },
  );
  if (memberResult.error) throw memberResult.error;

  return household;
}

function LoadingScreen({ label = "Åbner dit hjem…" }: { label?: string }) {
  return (
    <main className="auth-shell auth-loading">
      <div className="auth-brand"><span><House size={22} /></span><strong>Mit hjem</strong></div>
      <LoaderCircle className="auth-spinner" size={28} />
      <p>{label}</p>
    </main>
  );
}

export function AuthGate() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setHousehold(null);
      setSessionReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    ensureHousehold(session.user)
      .then((value) => { if (active) setHousehold(value); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Dit hjem kunne ikke åbnes.");
      });
    return () => { active = false; };
  }, [session]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage("Kontoen er oprettet. Tjek din indbakke og bekræft din e-mail, før du logger ind.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der opstod en fejl. Prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  if (!sessionReady) return <LoadingScreen />;
  if (session && !household && !error) return <LoadingScreen label="Gør din husstand klar…" />;
  if (session && !household && error) {
    return (
      <main className="auth-shell" data-color-mode={dark ? "dark" : "light"}>
        <section className="auth-card auth-error-card">
          <div className="auth-brand"><span><House size={22} /></span><strong>Mit hjem</strong></div>
          <div className="auth-copy"><small>FORBINDELSESFEJL</small><h1>Dit hjem kunne ikke åbnes</h1><p>{error}</p></div>
          <button className="auth-submit" onClick={() => window.location.reload()} type="button">Prøv igen</button>
          <button className="auth-secondary" onClick={() => void supabase.auth.signOut()} type="button">Log ud</button>
        </section>
      </main>
    );
  }
  if (session && household) {
    return (
      <HouseholdApp
        householdId={household.id}
        householdName={household.name}
        onSignOut={async () => { await supabase.auth.signOut(); }}
        user={{ id: session.user.id, email: session.user.email ?? "", displayName: userName(session.user) }}
      />
    );
  }

  return (
    <main className="auth-shell" data-color-mode={dark ? "dark" : "light"}>
      <button className="auth-mode-button" onClick={() => setDark((value) => !value)} type="button" aria-label={dark ? "Skift til lyst tema" : "Skift til mørkt tema"}>
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <section className="auth-card">
        <div className="auth-brand"><span><House size={22} /></span><strong>Mit hjem</strong></div>
        <div className="auth-copy">
          <small>HELE HUSHOLDNINGEN ÉT STED</small>
          <h1>{mode === "login" ? "Velkommen hjem" : "Opret dit hjem"}</h1>
          <p>{mode === "login" ? "Log ind for at se budget, dokumenter, opgaver, indkøb og madplan." : "Start med din egen sikre husstand. Du kan invitere familien senere."}</p>
        </div>
        <div className="auth-tabs" role="tablist">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); setMessage(null); }} type="button">Log ind</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(null); setMessage(null); }} type="button">Opret konto</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" ? <label>Navn<div><CheckCircle2 size={18} /><input autoComplete="name" minLength={2} onChange={(event) => setFullName(event.target.value)} required value={fullName} placeholder="Dit navn" /></div></label> : null}
          <label>E-mail<div><Mail size={18} /><input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} placeholder="navn@eksempel.dk" /></div></label>
          <label>Adgangskode<div><LockKeyhole size={18} /><input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} placeholder="Mindst 8 tegn" /></div></label>
          {error ? <p className="auth-alert error" role="alert">{error}</p> : null}
          {message ? <p className="auth-alert success" role="status">{message}</p> : null}
          <button className="auth-submit" disabled={busy} type="submit">{busy ? <LoaderCircle className="auth-spinner" size={19} /> : null}{mode === "login" ? "Log ind" : "Opret konto"}</button>
        </form>
        <p className="auth-trust">Dine data er private og adskilt fra andre husstande.</p>
      </section>
    </main>
  );
}
