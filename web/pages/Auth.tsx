import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { today } from "../../shared/dates.ts";
import { api, type Me } from "../api.ts";
import { signIn, signOut, signUp } from "../auth.ts";
import { SignMark } from "../App.tsx";
import { ErrorText, Field } from "../components/common.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";

function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <SignMark className="size-10" />
          <span className="text-lg font-semibold">Commission Tracker</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              <h1>{title}</h1>
            </CardTitle>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}

/** Reloads the account so App's guard flips to the signed-in routes; App then redirects to the dashboard. */
function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const refreshMe = useRefreshMe();
  const login = useMutation({ mutationFn: signIn, onSuccess: refreshMe });

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-positive underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorText error={login.error} />
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

export function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", hireDate: "" });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const refreshMe = useRefreshMe();
  const signup = useMutation({
    mutationFn: async ({ name, email, password, hireDate }: typeof form) => {
      await signUp({ name, email, password });
      await api.createProfile({ name, hireDate });
    },
    // Also after a failure: if the account was made but the profile wasn't, App asks for it again.
    onSettled: refreshMe,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    signup.mutate(form);
  }

  return (
    <AuthShell
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-positive underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Name">
          <Input autoComplete="name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />
        </Field>
        <Field label="Hire date" hint="Sets your tenure bonus and the $600 training draw for your first 90 days">
          <Input type="date" required max={today()} value={form.hireDate} onChange={set("hireDate")} />
        </Field>
        <ErrorText error={signup.error} />
        <Button type="submit" className="w-full" disabled={signup.isPending}>
          {signup.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}

/** Signed in to Neon Auth but without an app profile yet, e.g. when sign-up stopped halfway. */
export function SetupProfile({ account }: { account: Me["account"] }) {
  const [form, setForm] = useState({ name: account.name, hireDate: "" });
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const setup = useMutation({ mutationFn: api.createProfile, onSuccess: refreshMe });

  async function leave() {
    await signOut();
    qc.setQueryData(["me"], null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setup.mutate(form);
  }

  return (
    <AuthShell
      title="Finish setting up"
      footer={
        <>
          Signed in as {account.email}.{" "}
          <button type="button" onClick={leave} className="font-medium text-positive underline-offset-4 hover:underline">
            Sign out
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Name">
          <Input autoComplete="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Hire date" hint="Sets your tenure bonus and the $600 training draw for your first 90 days">
          <Input type="date" required max={today()} value={form.hireDate} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} />
        </Field>
        <ErrorText error={setup.error} />
        <Button type="submit" className="w-full" disabled={setup.isPending}>
          {setup.isPending ? "Saving…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
