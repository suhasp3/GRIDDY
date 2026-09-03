import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteSurvey,
  exportSurveys,
  ExportedSurvey,
  importSurveys,
  loadSurvey,
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

/** Builds the Qualtrics export item for a saved survey, using `fieldLabel`
 * (defaulting to the survey's name) as the base for its embedded-data
 * field name(s) — mirrors the naming scheme the export always used, just
 * with an overridable base instead of a hardcoded one. */
function buildQsfItem(survey: ExportedSurvey, fieldLabel: string): QualtricsQsfItem {
  const fallback = survey.id.slice(0, 8);
  const base = fieldLabel.trim() || fallback;
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
}

export default function HistoryPage() {
  const { dispatch } = useEditor();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<ExportedSurvey[]>([]);
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<string[]>([]);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});
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

  const moveSelected = (index: number, direction: -1 | 1) => {
    setSelectedSurveyIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeFromSelection = (id: string) => {
    setSelectedSurveyIds((prev) => prev.filter((value) => value !== id));
  };

  const fetchSurveys = async () => {
    setFetching(true);
    setError(null);
    try {
      const payload = await exportSurveys();
      setSurveys(payload.surveys);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
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

  // Selected surveys, in the order the user picked/reordered them — this is
  // the order the resulting .qsf's blocks (and Next button) will follow.
  const orderedSelected = useMemo(
    () =>
      selectedSurveyIds
        .map((id) => surveys.find((s) => s.id === id))
        .filter((s): s is ExportedSurvey => !!s),
    [selectedSurveyIds, surveys],
  );

  const qsfItems = useMemo(
    () =>
      orderedSelected.map((survey) =>
        buildQsfItem(survey, fieldOverrides[survey.id] ?? survey.name ?? ""),
      ),
    [orderedSelected, fieldOverrides],
  );

  // Detect embedded-data field name collisions across the current selection
  // before letting the user export.
  const fieldCollisionError = useMemo(() => {
    const seen = new Map<string, string>(); // field name -> survey title that claimed it
    for (let i = 0; i < qsfItems.length; i++) {
      const item = qsfItems[i];
      const title = orderedSelected[i]?.name || `Question ${i + 1}`;
      for (const field of qsfEmbeddedFields(item)) {
        const claimedBy = seen.get(field);
        if (claimedBy && claimedBy !== title) {
          return `"${title}" and "${claimedBy}" both write to the field "${field}". Give one of them a different data field name.`;
        }
        seen.set(field, title);
      }
    }
    return null;
  }, [qsfItems, orderedSelected]);

  const handleExportQualtrics = async () => {
    if (orderedSelected.length === 0 || fieldCollisionError) return;

    setTransferring(true);
    setError(null);
    setNotice(null);

    try {
      const items = qsfItems;
      const qsf = buildQualtricsQsf(
        items,
        `GRIDDY Survey (${items.length} grid${items.length === 1 ? "" : "s"})`,
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
        `Downloaded a Qualtrics .qsf with ${items.length} grid${items.length === 1 ? "" : "s"} ` +
          `in the order shown, and ${fieldCount} embedded field${fieldCount === 1 ? "" : "s"}. ` +
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
        parsed.surveys,
      );
      await fetchSurveys();

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
      removeFromSelection(id);
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
              onClick={handleExportQualtrics}
              disabled={transferring || orderedSelected.length === 0 || !!fieldCollisionError}
              title={fieldCollisionError ?? undefined}
              className="rounded-md bg-accent-tint px-3 py-1.5 text-sm font-semibold text-accent hover:opacity-90 disabled:opacity-50"
            >
              Combine &amp; export to Qualtrics (.qsf)
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

        <p className="mb-1 text-sm text-ink-muted">
          Showing surveys saved in this browser.
        </p>
        <p className="mb-4 text-sm text-ink-muted">
          Select two or more below to combine them into one Qualtrics survey — each
          becomes its own page, and the Next button moves respondents through them in
          the order you set here.
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

        {orderedSelected.length > 0 && (
          <div className="mb-6 rounded-xl border border-hairline-warm bg-paper-window p-4">
            <p className="mb-3 text-xs font-bold tracking-widest text-ink-faint">
              EXPORT ORDER
            </p>
            <ul className="space-y-2">
              {orderedSelected.map((survey, index) => (
                <li
                  key={survey.id}
                  className="flex flex-col gap-2 rounded-lg border border-hairline bg-paper-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-bold text-accent">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-ink">
                      {survey.name || survey.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-ink-faint">
                      Data field
                      <input
                        type="text"
                        value={fieldOverrides[survey.id] ?? survey.name ?? ""}
                        onChange={(e) =>
                          setFieldOverrides((prev) => ({
                            ...prev,
                            [survey.id]: e.target.value,
                          }))
                        }
                        placeholder={survey.id.slice(0, 8)}
                        className="w-40 rounded-md border border-hairline bg-paper-window px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => moveSelected(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${survey.name} earlier`}
                      className="rounded-md border border-hairline bg-paper-window px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-hairline-warm disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelected(index, 1)}
                      disabled={index === orderedSelected.length - 1}
                      aria-label={`Move ${survey.name} later`}
                      className="rounded-md border border-hairline bg-paper-window px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-hairline-warm disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromSelection(survey.id)}
                      aria-label={`Remove ${survey.name} from selection`}
                      className="rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent hover:opacity-90"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {fieldCollisionError && (
              <p className="mt-3 text-xs font-semibold text-accent">{fieldCollisionError}</p>
            )}
          </div>
        )}

        {fetching && <p className="text-sm text-ink-muted">Loading...</p>}

        {!fetching && surveys.length === 0 && (
          <p className="text-sm text-ink-muted">No saved surveys yet.</p>
        )}

        <ul className="space-y-3">
          {surveys.map((s) => {
            const orderIndex = selectedSurveyIds.indexOf(s.id);
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-hairline-warm bg-paper-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={orderIndex !== -1}
                    onChange={() => toggleSurveySelection(s.id)}
                    className="mt-1 h-4 w-4 rounded border-hairline"
                    aria-label={`Select ${s.name}`}
                  />
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      {orderIndex !== -1 && (
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-bold text-accent">
                          {orderIndex + 1}
                        </span>
                      )}
                      {s.name}
                    </p>
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
            );
          })}
        </ul>
      </div>
    </div>
  );
}
