import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { AppShell } from "@/components/inbtwn/AppShell";
import { Field, TextInput, PrimaryButton } from "@/components/inbtwn/bits";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const profile = useQuery(profileQuery);

  if (profile.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper font-mono text-[12px] text-ink-soft">
        Loading your board…
      </div>
    );
  }
  if (profile.isError) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <div>
          <div className="font-display text-[24px]">Couldn't load your profile</div>
          <p className="mt-2 font-mono text-[12px] text-ink-soft">{profile.error.message}</p>
        </div>
      </div>
    );
  }
  if (!profile.data) {
    return (
      <Onboarding
        defaultOrg={(user.user_metadata?.organisation_name as string | undefined) ?? ""}
        defaultName={(user.user_metadata?.full_name as string | undefined) ?? ""}
      />
    );
  }

  return (
    <AppShell orgName={profile.data.organisation?.name}>
      <Outlet />
    </AppShell>
  );
}

function Onboarding({ defaultOrg, defaultName }: { defaultOrg: string; defaultName: string }) {
  const qc = useQueryClient();
  const [orgName, setOrgName] = useState(defaultOrg);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Give your organisation a name.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("setup_organisation", {
      _org_name: orgName.trim(),
      _user_name: name.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <div className="min-h-screen bg-shell">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-paper px-6 pt-14">
        <div className="font-display text-[34px] leading-none">Set up your kitchen</div>
        <p className="mt-2 font-mono text-[12px] text-ink-soft">
          Everything you create — clients, events, recipes — belongs to this organisation.
        </p>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <Field label="Organisation name" required>
            <TextInput value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. INBTWN Kitchen" />
          </Field>
          <Field label="Your name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Chef" />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Setting up…" : "Create organisation"}
          </PrimaryButton>
        </form>
        <button
          onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))}
          className="mt-6 self-start font-mono text-[11px] text-ink-soft underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
