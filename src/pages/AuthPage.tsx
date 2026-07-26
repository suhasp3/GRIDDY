import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";

export default function AuthPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signup" && (!trimmedFirstName || !trimmedLastName)) {
      setError("Please enter your first name and last name.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(trimmedEmail, password);
        navigate("/");
      } else {
        await signUpWithEmail(trimmedEmail, password, trimmedFirstName, trimmedLastName);
        setMessage("Account created! Check your email to confirm, then sign in.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "rounded-lg border border-hairline bg-paper-window px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-paper px-4 font-sans"
      style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-hairline-warm bg-paper-card p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-accent font-serif text-base font-bold text-white">
            G
          </div>
          <span className="font-serif text-[19px] font-bold tracking-tight text-ink">
            GRIDDY
          </span>
        </div>

        <h1 className="mb-6 text-center font-serif text-xl font-bold text-ink">
          {mode === "signin" ? "Sign in to Griddy" : "Create an account"}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold tracking-widest text-ink-faint">
                  FIRST NAME
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required={mode === "signup"}
                  autoComplete="given-name"
                  className={inputClass}
                  placeholder="Jane"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold tracking-widest text-ink-faint">
                  LAST NAME
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required={mode === "signup"}
                  autoComplete="family-name"
                  className={inputClass}
                  placeholder="Doe"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold tracking-widest text-ink-faint">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold tracking-widest text-ink-faint">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-paper-window px-3 py-2 text-sm text-ink">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-5 text-center">
          {mode === "signin" ? (
            <p className="text-sm text-ink-muted">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
                className="font-semibold text-accent hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setMessage(null); }}
                className="font-semibold text-accent hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-ink-faint hover:text-ink-muted"
          >
            ← Back to editor
          </button>
        </div>
      </div>
    </div>
  );
}
