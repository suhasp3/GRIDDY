import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
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
import {
  buildQualtricsQsf,
  qsfEmbeddedFields,
  sanitizeEmbeddedDataField,
  QualtricsQsfItem,
} from "../lib/qualtricsExport";

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
  const { user, loading: authLoading } = useAuth();
  const { dispatch } = useEditor();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyMeta[]>([]);
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const makeQsfFileName = () => {
    const iso = new Date().toISOString().replace(/[:.]/g, "-");
    return `griddy-qualtrics-${iso}.qsf`;
  };

  const toggleSurveySelection = (id: string) => {
    setSelectedSurveyIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const selectAllSurveys = () => {
    setSelectedSurveyIds(surveys.map((survey) => survey.id));
  };

  const clearSelection = () => {
    setSelectedSurveyIds([]);
  };

  useEffect(() => {
    setFetching(true);
    setError(null);
    listSurveys(user?.id)
      .then(setSurveys)
      .catch((e) => setError((e as Error).message))
      .finally(() => setFetching(false));
  }, [user?.id]);

  const refreshSurveys = async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await listSurveys(user?.id);
      setSurveys(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const handleOpen = async (id: string) => {
    try {
      const config = await loadSurvey(id, user?.id);
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
      const payload = await exportSurveys(user?.id);
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

  const handleExportQualtrics = async () => {
    if (selectedSurveyIds.length === 0) return;

    setTransferring(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await exportSurveys(user?.id);
      const selected = payload.surveys.filter((survey) =>
        selectedSurveyIds.includes(survey.id),
      );

      if (selected.length === 0) {
        throw new Error("Select at least one saved survey to export.");
      }

      const items: QualtricsQsfItem[] = selected.map((survey) => {
        const base = survey.name || survey.id.slice(0, 8);
        const fallback = survey.id.slice(0, 8);
        const isExperimental = !!survey.config.experimental?.enabled;

        if (isExperimental) {
          return {
            title: survey.name || survey.id,
            config: survey.config,
            prefillsField: sanitizeEmbeddedDataField(
              `GridPrefills_${base}`,
              `GridPrefills_${fallback}`,
            ),
            responsesField: sanitizeEmbeddedDataField(
              `GridResponses_${base}`,
              `GridResponses_${fallback}`,
            ),
          };
        }

        return {
          title: survey.name || survey.id,
          config: survey.config,
          embeddedDataField: sanitizeEmbeddedDataField(
            `GridAssignments_${base}`,
            `GridAssignments_${fallback}`,
          ),
        };
      });

      const qsf = buildQualtricsQsf(
        items,
        `GRIDDY Survey (${selected.length} grid${selected.length === 1 ? "" : "s"})`,
      );

      const blob = new Blob([qsf], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = makeQsfFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const fieldCount = items.reduce(
        (total, item) => total + qsfEmbeddedFields(item).length,
        0,
      );
      setNotice(
        `Downloaded a Qualtrics .qsf with ${selected.length} grid${selected.length === 1 ? "" : "s"} ` +
          `and ${fieldCount} embedded field${fieldCount === 1 ? "" : "s"}. ` +
          `In Qualtrics: Projects → Create project → Survey → "Import a QSF file", then Publish.`,
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
        user?.id,
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
      await deleteSurvey(id, user?.id);
      setSurveys((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (authLoading) return null;

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
              onClick={handleExportQualtrics}
              disabled={transferring || selectedSurveyIds.length === 0}
              className="rounded-md bg-accent-tint px-3 py-1.5 text-sm font-semibold text-accent hover:opacity-90 disabled:opacity-50"
            >
              Export Qualtrics (.qsf)
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
          {user
            ? "Signed in: showing surveys from your account."
            : "Not signed in: showing surveys saved in this browser only."}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={selectAllSurveys}
            disabled={surveys.length === 0}
            className="rounded-md border border-hairline bg-paper-card px-3 py-1.5 font-semibold text-ink-muted hover:bg-paper-window disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedSurveyIds.length === 0}
            className="rounded-md border border-hairline bg-paper-card px-3 py-1.5 font-semibold text-ink-muted hover:bg-paper-window disabled:opacity-50"
          >
            Clear selection
          </button>
          <span className="text-ink-faint">
            {selectedSurveyIds.length} selected for Qualtrics export
          </span>
        </div>

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
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedSurveyIds.includes(s.id)}
                  onChange={() => toggleSurveySelection(s.id)}
                  className="mt-1 h-4 w-4 rounded border-hairline"
                  aria-label={`Select ${s.name}`}
                />
                <div>
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-faint mt-0.5">
                    Created {new Date(s.created_at).toLocaleDateString()} &middot; Last edited{" "}
                    {new Date(s.updated_at).toLocaleDateString()}
                  </p>
                </div>
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
