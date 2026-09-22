import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, PrimaryButton } from "@/components/inbtwn/bits";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — INBTWN OS" },
      { name: "description", content: "Sign in or create your INBTWN OS account and organisation." },
      { property: "og:title", content: "Sign in — INBTWN OS" },
      { property: "og:description", content: "Sign in or create your INBTWN OS account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter your email and a password of at least 6 characters.");
      return;
    }
    if (mode === "signup" && !orgName.trim()) {
      toast.error("Give your organisation a name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/today", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/today`,
            data: { organisation_name: orgName.trim(), full_name: name.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          const { error: rpcErr } = await supabase.rpc("setup_organisation", {
            _org_name: orgName.trim(),
            _user_name: name.trim() || undefined,
          });
          if (rpcErr && !/already exists/i.test(rpcErr.message)) throw rpcErr;
          navigate({ to: "/today", replace: true });
        } else {
          setCheckEmail(true);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-shell">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-paper px-6 pb-safe pt-14">
        <div className="font-display text-[44px] leading-none tracking-tight">
          INBTWN<span className="ml-1 align-top font-hand text-[13px]">OS</span>
        </div>
        <p className="mt-2 font-mono text-[12px] text-ink-soft">
          Enquiries → events → kitchen → invoice. One board.
        </p>

        {checkEmail ? (
          <div className="torn mt-10 bg-cream px-5 py-6">
            <div className="font-display text-[24px] leading-none">Check your inbox</div>
            <p className="mt-3 text-sm text-ink-soft">
              We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>.
              Open it, then come back and sign in. We'll set up{" "}
              <span className="font-semibold text-ink">{orgName}</span> on your first sign-in.
            </p>
            <button
              className="mt-4 font-mono text-[12px] text-flame underline"
              onClick={() => {
                setCheckEmail(false);
                setMode("signin");
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 flex gap-2">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`tap flex-1 rounded-sm font-mono text-[12px] ${
                    mode === m ? "bg-ink text-cream" : "bg-cream text-ink-soft outline-1 outline-ink/15"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              {mode === "signup" ? (
                <>
                  <Field label="Organisation name" required>
                    <TextInput
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. INBTWN Kitchen"
                      autoComplete="organization"
                    />
                  </Field>
                  <Field label="Your name">
                    <TextInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Chef"
                      autoComplete="name"
                    />
                  </Field>
                </>
              ) : null}
              <Field label="Email" required>
                <TextInput
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@kitchen.co.uk"
                />
              </Field>
              <Field label="Password" required hint={mode === "signup" ? "min 6 chars" : undefined}>
                <TextInput
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <PrimaryButton type="submit" disabled={busy} className="mt-2">
                {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account & organisation"}
              </PrimaryButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
