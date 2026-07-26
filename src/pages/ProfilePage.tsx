import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { getActiveSurveyQuestionCount } from "../lib/surveysApi";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [questionCount, setQuestionCount] = useState(0);
  const [fetchingCount, setFetchingCount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = (user?.user_metadata?.first_name as string | undefined)?.trim() || "";
  const lastName = (user?.user_metadata?.last_name as string | undefined)?.trim() || "";

  const fullName = useMemo(() => {
    const name = [firstName, lastName].filter(Boolean).join(" ").trim();
    return name || "Not set";
  }, [firstName, lastName]);

  useEffect(() => {
    setFetchingCount(true);
    setError(null);

    getActiveSurveyQuestionCount(user?.id)
      .then(setQuestionCount)
      .catch((e) => setError((e as Error).message))
      .finally(() => setFetchingCount(false));
  }, [user?.id]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-paper px-4 font-sans"
        style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
      >
        <div className="w-full max-w-md rounded-2xl border border-hairline-warm bg-paper-card p-8 shadow-sm">
          <p className="text-center text-ink-muted">
            You are not signed in. Local survey saving is still available in this browser.
          </p>
          <div className="mt-6 rounded-xl border border-hairline bg-paper-window p-4">
            <p className="text-[11px] font-bold tracking-widest text-ink-faint">
              LOCAL SURVEYS
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {fetchingCount ? "..." : questionCount}
            </p>
          </div>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-paper px-6 py-8 font-sans"
      style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-hairline-warm bg-paper-card p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold text-ink">My Profile</h1>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm font-semibold text-ink-muted hover:text-ink"
          >
            ← Back to editor
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent">{error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-bold tracking-widest text-ink-faint">FIRST NAME</p>
            <div className="rounded-lg border border-hairline bg-paper-window px-3 py-2 text-sm text-ink">
              {firstName || "Not set"}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-bold tracking-widest text-ink-faint">LAST NAME</p>
            <div className="rounded-lg border border-hairline bg-paper-window px-3 py-2 text-sm text-ink">
              {lastName || "Not set"}
            </div>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] font-bold tracking-widest text-ink-faint">EMAIL</p>
            <div className="rounded-lg border border-hairline bg-paper-window px-3 py-2 text-sm text-ink">
              {user.email || "Not set"}
            </div>
          </div>

        </div>

        <div className="mt-6 rounded-xl border border-hairline bg-paper-window p-4">
          <p className="text-[11px] font-bold tracking-widest text-ink-faint">STATS</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-ink-muted">User</p>
              <p className="text-base font-semibold text-ink">{fullName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-ink-muted">Active Survey Questions</p>
              <p className="text-2xl font-bold text-ink">
                {fetchingCount ? "..." : questionCount}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
