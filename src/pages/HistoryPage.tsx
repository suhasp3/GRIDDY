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
  buildQualtricsMultiQuestionSnippet,
  buildQualtricsSnippet,
  sanitizeEmbeddedDataField,
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
  const [qualtricsBlocks, setQualtricsBlocks] = useState<
    Array<{ title: string; embeddedDataField: string; snippet: string }>
  >([]);
  const [currentBundleIndex, setCurrentBundleIndex] = useState(0);
  const [bundleCopied, setBundleCopied] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const makeBundleFileName = () => {
    const iso = new Date().toISOString().replace(/[:.]/g, "-");
    return `griddy-qualtrics-${iso}.txt`;
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
    if (!user) return;
    setFetching(true);
    listSurveys(user.id)
      .then(setSurveys)
      .catch((e) => setError((e as Error).message))
      .finally(() => setFetching(false));
  }, [user]);

  const refreshSurveys = async () => {
    if (!user) return;
    setFetching(true);
    setError(null);
    try {
      const data = await listSurveys(user.id);
      setSurveys(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

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
    if (!user) return;

    setTransferring(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await exportSurveys(user.id);
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
    if (!user || selectedSurveyIds.length === 0) return;

    setTransferring(true);
    setError(null);
    setNotice(null);
    setBundleCopied(false);

    try {
      const payload = await exportSurveys(user.id);
      const selected = payload.surveys.filter((survey) =>
        selectedSurveyIds.includes(survey.id),
      );

      if (selected.length === 0) {
        throw new Error("Select at least one saved survey to export.");
      }

      const generatedAt = new Date().toISOString();
      const multiItems = selected.map((survey) => {
        const embeddedDataField = sanitizeEmbeddedDataField(
          `GridAssignments_${survey.name || survey.id.slice(0, 8)}`,
          `GridAssignments_${survey.id.slice(0, 8)}`,
        );
        return {
          title: survey.name || survey.id,
          embeddedDataField,
          config: survey.config,
        };
      });

      const combinedSnippet = buildQualtricsMultiQuestionSnippet(multiItems);

      const bundle = [
        `/* GRIDDY Qualtrics bundle`,
        ` * Generated at: ${generatedAt}`,
        ` * Selected surveys: ${selected.length}`,
        ` * Paste this script into one Qualtrics question JavaScript editor.`,
        ` * The in-question Next button advances through exported questions.`,
        ` */`,
        "",
        combinedSnippet,
      ].join("\n\n");

      setQualtricsBlocks([
        {
          title: `Combined flow (${selected.length} questions)`,
          embeddedDataField: "Multiple fields (see code)",
          snippet: bundle,
        },
      ]);
      setCurrentBundleIndex(0);
      setBundleOpen(true);
      setNotice(
        `Prepared one combined Qualtrics script for ${selected.length} survey${selected.length === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTransferring(false);
    }
  };

  const handleCopyBundle = async () => {
    try {
      await navigator.clipboard.writeText(
        qualtricsBlocks[currentBundleIndex]?.snippet ?? "",
      );
      setBundleCopied(true);
      window.setTimeout(() => setBundleCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadBundle = () => {
    const generatedAt = new Date().toISOString();
    const bundle = [
      `/* GRIDDY Qualtrics bundle`,
      ` * Generated at: ${generatedAt}`,
      ` * Selected surveys: ${qualtricsBlocks.length}`,
      ` * Paste each block into the matching Qualtrics question JavaScript editor.`,
      ` */`,
      "",
      ...qualtricsBlocks.map((block) =>
        [
          `/* Survey: ${block.title}`,
          ` * Embedded Data field: ${block.embeddedDataField}`,
          ` * Qualtrics question id: paste into the matching question's JavaScript.`,
          ` */`,
          block.snippet,
        ].join("\n"),
      ),
    ].join("\n\n");

    const blob = new Blob([bundle], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = makeBundleFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user) return;

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
        user.id,
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

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Sign in to view your saved surveys.</p>
      </div>
    );
  }

  const currentBlock = qualtricsBlocks[currentBundleIndex] ?? null;
  const currentBlockLabel = currentBlock
    ? `${currentBundleIndex + 1} of ${qualtricsBlocks.length}`
    : "0 of 0";

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">My Surveys</h1>
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
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleExportQualtrics}
              disabled={transferring || selectedSurveyIds.length === 0}
              className="rounded-md bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-200 disabled:opacity-50"
            >
              Export Qualtrics
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={transferring}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Import JSON
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Back to editor
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {notice && (
          <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={selectAllSurveys}
            disabled={surveys.length === 0}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedSurveyIds.length === 0}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Clear selection
          </button>
          <span className="text-slate-500">
            {selectedSurveyIds.length} selected for Qualtrics export
          </span>
        </div>

        {fetching && <p className="text-sm text-slate-500">Loading...</p>}

        {!fetching && surveys.length === 0 && (
          <p className="text-sm text-slate-500">No saved surveys yet.</p>
        )}

        <ul className="space-y-3">
          {surveys.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedSurveyIds.includes(s.id)}
                  onChange={() => toggleSurveySelection(s.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  aria-label={`Select ${s.name}`}
                />
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Created {new Date(s.created_at).toLocaleDateString()} &middot; Last edited{" "}
                    {new Date(s.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpen(s.id)}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {bundleOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Qualtrics export bundle"
            onClick={() => setBundleOpen(false)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Qualtrics Export Bundle
                  </h2>
                  <p className="text-xs text-slate-500">
                    Paste this combined script into one Qualtrics question JavaScript editor.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBundle}
                    disabled={!currentBlock}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {bundleCopied ? "Copied!" : "Copy current"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadBundle}
                    disabled={qualtricsBlocks.length === 0}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Download all
                  </button>
                  <button
                    type="button"
                    onClick={() => setBundleOpen(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </header>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
                <span>
                  {currentBlock ? `Showing ${currentBlock.title}` : "No survey selected"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentBundleIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentBundleIndex === 0}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>{currentBlockLabel}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentBundleIndex((prev) =>
                        Math.min(qualtricsBlocks.length - 1, prev + 1),
                      )
                    }
                    disabled={currentBundleIndex >= qualtricsBlocks.length - 1}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 p-5">
                <textarea
                  className="h-[70vh] w-full resize-none rounded-xl border border-slate-200 bg-slate-950/90 p-3 font-mono text-[11px] text-slate-50 shadow-inner"
                  readOnly
                  value={
                    currentBlock
                      ? [
                          `/* Survey: ${currentBlock.title}`,
                          ` * Embedded Data field: ${currentBlock.embeddedDataField}`,
                          ` */`,
                          currentBlock.snippet,
                        ].join("\n")
                      : "Select one or more surveys to export."
                  }
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
