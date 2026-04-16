import { useState } from "react";
import { useEditor } from "../EditorContext";
import { useAuth } from "../lib/authContext";
import { saveSurvey } from "../lib/surveysApi";

export default function SaveButton() {
  const { user } = useAuth();
  const { state, dispatch } = useEditor();
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = async () => {
    const title = state.config.name.trim();
    if (!title) {
      setErrorMsg("Please enter a survey title before saving.");
      setFlash("error");
      setTimeout(() => setFlash(null), 3000);
      return;
    }

    setSaving(true);
    setFlash(null);
    try {
      await saveSurvey(state.config, user?.id);
      dispatch({ type: "markSaved" });
      setFlash("saved");
      setTimeout(() => setFlash(null), 2000);
    } catch (e) {
      setErrorMsg((e as Error).message);
      setFlash("error");
      setTimeout(() => setFlash(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          flash === "saved"
            ? "bg-green-100 text-green-700"
            : flash === "error"
            ? "bg-red-100 text-red-700"
            : "bg-slate-900 text-white hover:bg-slate-700"
        }`}
      >
        {saving ? "Saving…" : flash === "saved" ? "Saved!" : "Save"}
      </button>
      {flash === "error" && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
