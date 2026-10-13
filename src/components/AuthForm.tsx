import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "apple") {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      toast.error(error.message);
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Sign-in failed");
  }
}

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-glow">
      <h1 className="text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Join ReynaShows"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "login" ? "Log in to like and upload movies." : "Create an account to share your movies."}
      </p>
      <div className="mt-6 grid gap-2">
        <Button variant="outline" onClick={() => social("google")}>Continue with Google</Button>
        <Button variant="outline" onClick={() => social("apple")}>Continue with Apple</Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="grid gap-4">
        {mode === "signup" && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="marquee" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>New here? <Link to="/signup" className="text-primary hover:underline">Sign up</Link></>
        ) : (
          <>Have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link></>
        )}
      </p>
    </div>
  );
}
