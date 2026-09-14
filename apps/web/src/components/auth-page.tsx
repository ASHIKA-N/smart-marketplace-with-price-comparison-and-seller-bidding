"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "./providers";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters."),
  name: z.string().optional(),
  seller: z.boolean().optional(),
});
type Values = z.infer<typeof schema>;
export function AuthPage({
  mode,
}: {
  mode:
    | "login"
    | "register"
    | "forgot-password"
    | "reset-password"
    | "verify-email";
}) {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [demoToken, setDemoToken] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", name: "", seller: false },
  });
  const register = mode === "register";
  const recovery = [
    "forgot-password",
    "reset-password",
    "verify-email",
  ].includes(mode);
  const title = register
    ? "Your neighbourhood awaits."
    : mode === "forgot-password"
      ? "Let’s get you back in."
      : mode === "reset-password"
        ? "A fresh start."
        : mode === "verify-email"
          ? "Make it official."
          : "Welcome back, neighbour.";
  async function signIn(email: string, password: string) {
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(v: Values) {
    if (!register) {
      await signIn(v.email, v.password);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/auth/register", { method: "POST", body: v });
      await login(v.email, v.password);
      router.push(v.seller ? "/seller/shop" : "/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-art">
        <Image
          src="/images/photo-1441986300917-64674bd600d8.jpg"
          alt="A welcoming local shop"
          fill
          sizes="50vw"
        />
        <span className="eyebrow">GOOD FINDS. GOOD NEIGHBOURS.</span>
        <h2>
          Something good
          <br />
          is just around
          <br />
          the corner.
        </h2>
        <p>
          Real shops. Thoughtful finds. Better prices.
          <br />A marketplace made for the place you call home.
        </p>
      </div>
      <div className="auth-form">
        <span className="eyebrow">A LITTLE CLOSER TO LOCAL</span>
        <h1>{title}</h1>
        <p>
          {register
            ? "Create an account to discover, compare, and shop locally."
            : recovery
              ? "Follow the steps below to securely access your account."
              : "Sign in to find your favourites and discover something new."}
        </p>
        {recovery ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                if (mode === "forgot-password") {
                  const result = await api<{
                    message: string;
                    demoToken?: string;
                  }>("/auth/forgot-password", {
                    method: "POST",
                    body: { email: data.get("email") },
                  });
                  setSuccess(result.message);
                  setDemoToken(result.demoToken || "");
                } else {
                  await api(`/auth/${mode}`, {
                    method: "POST",
                    body: {
                      token: data.get("token"),
                      ...(mode === "reset-password"
                        ? { password: data.get("password") }
                        : {}),
                    },
                  });
                  setSuccess(
                    mode === "verify-email"
                      ? "Your email is verified."
                      : "Password updated. You can now sign in.",
                  );
                }
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "forgot-password" ? (
              <label className="field">
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
            ) : (
              <>
                <label className="field">
                  Recovery token
                  <input
                    name="token"
                    required
                    defaultValue={params.get("token") || ""}
                  />
                </label>
                {mode === "reset-password" && (
                  <label className="field">
                    New password
                    <input
                      name="password"
                      type="password"
                      minLength={10}
                      maxLength={128}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                )}
              </>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {success && <div className="form-success">{success}</div>}
            {demoToken && (
              <div className="demo-indicator">
                Local demo: email delivery is not configured.
                <br />
                <Link
                  className="text-link"
                  href={`/reset-password?token=${demoToken}`}
                >
                  Open your demo recovery link →
                </Link>
              </div>
            )}
            <Button disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "forgot-password"
                  ? "Get recovery instructions"
                  : mode === "verify-email"
                    ? "Verify email"
                    : "Update password"}
              <ArrowRight size={16} />
            </Button>
            <Link className="auth-switch" href="/login">
              Back to sign in
            </Link>
          </form>
        ) : (
          <>
            <form className="stack" onSubmit={form.handleSubmit(submit)}>
              {register && (
                <label className="field">
                  Full name
                  <input
                    {...form.register("name")}
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="field">
                Email address
                <input
                  {...form.register("email")}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {form.formState.errors.email && (
                  <small>{form.formState.errors.email.message}</small>
                )}
              </label>
              <label className="field">
                Password
                <input
                  {...form.register("password")}
                  type="password"
                  placeholder={
                    register ? "At least 10 characters" : "Your password"
                  }
                  autoComplete={register ? "new-password" : "current-password"}
                />
                {form.formState.errors.password && (
                  <small>{form.formState.errors.password.message}</small>
                )}
              </label>
              {register ? (
                <label className="checkbox">
                  <input {...form.register("seller")} type="checkbox" />I also
                  want to sell in my neighbourhood
                </label>
              ) : (
                <div className="row spread">
                  <span className="muted">
                    <ShieldCheck
                      size={13}
                      style={{ display: "inline", marginRight: 5 }}
                    />
                    Secure sign in
                  </span>
                  <Link href="/forgot-password">Forgot password?</Link>
                </div>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <Button disabled={busy}>
                {busy
                  ? "Just a moment…"
                  : register
                    ? "Create your account"
                    : "Sign in"}
                <ArrowRight size={16} />
              </Button>
            </form>
            <div className="auth-switch">
              {register
                ? "Already part of the neighbourhood?"
                : "New around here?"}{" "}
              <Link href={register ? "/login" : "/register"}>
                {register ? "Sign in" : "Create an account"}
              </Link>
            </div>
            <DemoLogin signIn={signIn} busy={busy} />
          </>
        )}
      </div>
    </div>
  );
}
function DemoLogin({
  signIn,
  busy,
}: {
  signIn: (email: string, password: string) => Promise<void>;
  busy: boolean;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void api<{ mode: string }>("/health")
      .then((r) => setAvailable(r.mode === "demo"))
      .catch(() => {});
  }, []);
  if (!available) return null;
  return (
    <div className="demo-login">
      <p>
        EXPLORE THE LOCAL DEMO
        <br />
        Sample accounts let you try the full buyer and seller experience.
      </p>
      <div className="row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => signIn("buyer@aroundly.local", "DemoPass123!")}
        >
          Try as a buyer
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => signIn("seller@aroundly.local", "DemoPass123!")}
        >
          Try as a seller
        </Button>
      </div>
    </div>
  );
}
