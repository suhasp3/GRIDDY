import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteSurvey,
  exportSurveys,
  importSurveys,
  listSurveys,
  loadSurvey,
  SurveyMeta,
  SurveysExportFile,
} from "../lib/surveysApi";
import { useEditor } from "../EditorContext";

function isValidExportFile(value: unknown): value is SurveysExportFile {
  if (!value || typeof value !== "object") return false;

  const maybeFile = value as Partial<SurveysExportFile>;
  if (maybeFile.version !== 1) return false;
  if (!Array.isArray(maybeFile.surveys)) return false;

  return maybeFile.surveys.every(
    (survey) =>
      !!survey &&
      typeof survey.id === "string" &&
      typeof survey.name === "string" &&
      typeof survey.config === "object" &&
      survey.config !== null,
  );
}

function makeExportFileName() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `griddy-surveys-${iso}.json`;
}

export default function HistoryPage() {
  const { dispatch } = useEditor();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyMeta[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshSurveys = async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await listSurveys();
      setSurveys(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    refreshSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = async (id: string) => {
    try {
      const config = await loadSurvey(id);
      dispatch({ type: "setConfig", config });
      dispatch({ type: "markSaved" });
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleExport = async () => {
    setTransferring(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await exportSurveys();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = makeExportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNotice(
        payload.surveys.length === 0
          ? "Exported an empty backup (no saved surveys yet)."
          : `Exported ${payload.surveys.length} survey${
              payload.surveys.length === 1 ? "" : "s"
            } to JSON.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTransferring(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setTransferring(true);
    setError(null);
    setNotice(null);

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;

      if (!isValidExportFile(parsed)) {
        throw new Error("Invalid backup file format. Use a GRIDDY export JSON file.");
      }

      const { importedCount, skippedDuplicateCount } = await importSurveys(
        parsed.surveys,
      );
      await refreshSurveys();

      if (importedCount === 0 && skippedDuplicateCount === 0) {
        setNotice("Backup imported, but it did not contain any surveys.");
      } else if (skippedDuplicateCount === 0) {
        setNotice(`Imported ${importedCount} survey${importedCount === 1 ? "" : "s"}.`);
      } else {
        setNotice(
          `Imported ${importedCount} survey${importedCount === 1 ? "" : "s"} and skipped ${skippedDuplicateCount} duplicate${skippedDuplicateCount === 1 ? "" : "s"}.`,
        );
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError("Import failed: file is not valid JSON.");
      } else {
        setError((e as Error).message);
      }
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSurvey(id);
      setSurveys((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div
      className="min-h-screen bg-paper px-6 py-8 font-sans"
      style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold text-ink">My Surveys</h1>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={transferring}
              className="rounded-md bg-paper-window px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-hairline-warm disabled:opacity-50"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => navigate("/history/combine")}
              disabled={transferring || surveys.length === 0}
              className="rounded-md bg-accent-tint px-3 py-1.5 text-sm font-semibold text-accent hover:opacity-90 disabled:opacity-50"
            >
              Make multi-question survey
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={transferring}
              className="rounded-md bg-paper-window px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-hairline-warm disabled:opacity-50"
            >
              Import JSON
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm font-semibold text-ink-muted hover:text-ink"
            >
              Back to editor
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent">{error}</p>
        )}

        {notice && (
          <p className="mb-4 rounded-lg bg-paper-window p-3 text-sm text-ink">{notice}</p>
        )}

        <p className="mb-4 text-sm text-ink-muted">
          Showing surveys saved in this browser. Each is one grid question — use "Make
          multi-question survey" to combine several into a single Qualtrics survey.
        </p>

        {fetching && <p className="text-sm text-ink-muted">Loading...</p>}

        {!fetching && surveys.length === 0 && (
          <p className="text-sm text-ink-muted">No saved surveys yet.</p>
        )}

        <ul className="space-y-3">
          {surveys.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-hairline-warm bg-paper-card p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-ink-faint mt-0.5">
                  Created {new Date(s.created_at).toLocaleDateString()} &middot; Last edited{" "}
                  {new Date(s.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpen(s.id)}
                  className="rounded-md bg-paper-window px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-hairline-warm"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
