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
    if (!user) return;
    setFetchingCount(true);
    setError(null);

    getActiveSurveyQuestionCount(user.id)
      .then(setQuestionCount)
      .catch((e) => setError((e as Error).message))
      .finally(() => setFetchingCount(false));
  }, [user]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-center text-slate-600">Sign in to view your profile.</p>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">My Profile</h1>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to editor
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">First Name</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {firstName || "Not set"}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Last Name</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {lastName || "Not set"}
            </div>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Email</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {user.email || "Not set"}
            </div>
          </div>

        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Stats</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-slate-700">User</p>
              <p className="text-base font-medium text-slate-900">{fullName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-700">Active Survey Questions</p>
              <p className="text-2xl font-semibold text-slate-900">
                {fetchingCount ? "..." : questionCount}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
