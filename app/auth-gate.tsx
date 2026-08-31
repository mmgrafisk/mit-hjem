"use client";

import { CheckCircle2, House, LoaderCircle, LockKeyhole, Mail, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { HouseholdApp } from "./household-app";
import { getSupabaseBrowserClient, type PublicSupabaseConfig } from "./supabase-client";

type AuthMode = "login" | "signup";
type Household = { id: string; name: string };

type AuthGateProps = {
  appUrl: string | null;
  supabaseConfig: PublicSupabaseConfig | null;
};

function authRedirectUrl(appUrl: string | null) {
  return new URL("/?auth=confirmed", appUrl || window.location.origin).toString();
}

function errorMessage(reason: unknown, fallback: string) {
  const message = reason instanceof Error
    ? reason.message
    : typeof reason === "object" && reason !== null && "message" in reason && typeof reason.message === "string"
      ? reason.message
      : fallback;
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "E-mail eller adgangskode er forkert.";
  if (normalized.includes("email not confirmed")) return "Bekræft din e-mail, før du logger ind. Du kan få tilsendt et nyt link nedenfor.";
  if (normalized.includes("otp_expired") || normalized.includes("expired") || normalized.includes("invalid or has expired")) {
    return "Bekræftelseslinket er udløbet eller allerede brugt. Indtast din e-mail og få tilsendt et nyt link.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Der er sendt for mange mails på kort tid. Vent et øjeblik, og prøv igen.";
  }
  if (normalized.includes("password should be at least")) return "Adgangskoden skal være på mindst 8 tegn.";
  return message || fallback;
}

function readAuthLinkError() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = params.get("error_code");
  const description = params.get("error_description");
  if (!code && !description) return null;
  return errorMessage({ message: description || code || "" }, "Bekræftelseslinket kunne ikke bruges.");
}

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

function ConfigurationErrorScreen() {
  return (
    <main className="auth-shell" data-color-mode="dark">
      <section className="auth-card auth-error-card">
        <div className="auth-brand"><span><House size={22} /></span><strong>Mit hjem</strong></div>
        <div className="auth-copy">
          <small>FORBINDELSESFEJL</small>
          <h1>Konfigurationen til login mangler</h1>
          <p>Siden kan ikke forbinde sikkert til login lige nu. Prøv igen senere.</p>
        </div>
        <button className="auth-submit" onClick={() => window.location.reload()} type="button">Prøv igen</button>
      </section>
    </main>
  );
}

function ConfiguredAuthGate({ appUrl, supabaseConfig }: { appUrl: string | null; supabaseConfig: PublicSupabaseConfig }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(supabaseConfig), [supabaseConfig]);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authLinkError] = useState(() => typeof window === "undefined" ? null : readAuthLinkError());
  const [error, setError] = useState<string | null>(authLinkError);
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setHousehold(null);
      setSessionReady(true);
    });
    if (authLinkError) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      void supabase.auth.signOut({ scope: "local" }).finally(() => {
        if (!active) return;
        setSession(null);
        setHousehold(null);
        setSessionReady(true);
      });
    } else {
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(errorMessage(sessionError, "Din session kunne ikke indlæses."));
        setSession(data.session);
        setSessionReady(true);
      });
    }
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, authLinkError]);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    ensureHousehold(session.user)
      .then((value) => { if (active) setHousehold(value); })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason, "Dit hjem kunne ikke åbnes."));
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
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirectUrl(appUrl) },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMode("login");
          setMessage("Kontoen er oprettet. Tjek din indbakke og bekræft din e-mail, før du logger ind.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (reason) {
      setError(errorMessage(reason, "Der opstod en fejl. Prøv igen."));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Indtast din e-mail først.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: { emailRedirectTo: authRedirectUrl(appUrl) },
      });
      if (resendError) throw resendError;
      setMessage("Et nyt bekræftelseslink er sendt. Brug altid det nyeste link i din indbakke.");
    } catch (reason) {
      setError(errorMessage(reason, "Bekræftelsesmailen kunne ikke sendes. Prøv igen."));
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
          {mode === "login" ? <button className="auth-secondary" disabled={busy} onClick={() => void resendConfirmation()} type="button">Send nyt bekræftelseslink</button> : null}
        </form>
        <p className="auth-trust">Dine data er private og adskilt fra andre husstande.</p>
      </section>
    </main>
  );
}

export function AuthGate({ appUrl, supabaseConfig }: AuthGateProps) {
  if (!supabaseConfig) return <ConfigurationErrorScreen />;
  return <ConfiguredAuthGate appUrl={appUrl} supabaseConfig={supabaseConfig} />;
}
