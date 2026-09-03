import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportSurveys, ExportedSurvey } from "../lib/surveysApi";
import {
  buildQualtricsQsf,
  qsfEmbeddedFields,
  sanitizeEmbeddedDataField,
  QualtricsQsfItem,
} from "../lib/qualtricsExport";

/** Builds the Qualtrics export item for a saved survey, using `fieldLabel`
 * (defaulting to the survey's name) as the base for its embedded-data
 * field name(s). */
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

function makeQsfFileName() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `griddy-qualtrics-${iso}.qsf`;
}

export default function CombineSurveysPage() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<ExportedSurvey[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});
  const [surveyTitle, setSurveyTitle] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setFetching(true);
    setError(null);
    exportSurveys()
      .then((payload) => setSurveys(payload.surveys))
      .catch((e) => setError((e as Error).message))
      .finally(() => setFetching(false));
  }, []);

  const addQuestion = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeQuestion = (id: string) => {
    setSelectedIds((prev) => prev.filter((value) => value !== id));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const available = useMemo(
    () => surveys.filter((s) => !selectedIds.includes(s.id)),
    [surveys, selectedIds],
  );

  const ordered = useMemo(
    () =>
      selectedIds
        .map((id) => surveys.find((s) => s.id === id))
        .filter((s): s is ExportedSurvey => !!s),
    [selectedIds, surveys],
  );

  const qsfItems = useMemo(
    () =>
      ordered.map((survey) =>
        buildQsfItem(survey, fieldOverrides[survey.id] ?? survey.name ?? ""),
      ),
    [ordered, fieldOverrides],
  );

  const fieldCollisionError = useMemo(() => {
    const seen = new Map<string, string>();
    for (let i = 0; i < qsfItems.length; i++) {
      const item = qsfItems[i];
      const title = ordered[i]?.name || `Question ${i + 1}`;
      for (const field of qsfEmbeddedFields(item)) {
        const claimedBy = seen.get(field);
        if (claimedBy && claimedBy !== title) {
          return `"${title}" and "${claimedBy}" both write to the field "${field}". Give one of them a different data field name.`;
        }
        seen.set(field, title);
      }
    }
    return null;
  }, [qsfItems, ordered]);

  const defaultTitle = `GRIDDY Survey (${ordered.length} grid${ordered.length === 1 ? "" : "s"})`;

  const handleDownload = () => {
    if (ordered.length === 0 || fieldCollisionError) return;

    setDownloading(true);
    setError(null);
    setNotice(null);

    try {
      const qsf = buildQualtricsQsf(qsfItems, surveyTitle.trim() || defaultTitle);
      const blob = new Blob([qsf], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = makeQsfFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const fieldCount = qsfItems.reduce(
        (total, item) => total + qsfEmbeddedFields(item).length,
        0,
      );
      setNotice(
        `Downloaded a Qualtrics .qsf with ${ordered.length} grid${ordered.length === 1 ? "" : "s"} ` +
          `in the order shown, and ${fieldCount} embedded field${fieldCount === 1 ? "" : "s"}. ` +
          `In Qualtrics: Projects → Create project → Survey → "Import a QSF file", then Publish.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-paper px-6 py-8 font-sans"
      style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold text-ink">
            Make a multi-question survey
          </h1>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="text-sm font-semibold text-ink-muted hover:text-ink"
          >
            ← Back to My Surveys
          </button>
        </div>
        <p className="mb-6 text-sm text-ink-muted">
          Add saved grid questions below, put them in the order respondents should see
          them, then download one Qualtrics file. Each question becomes its own page,
          and the Next button moves respondents from one to the next in this order.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent">{error}</p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg bg-paper-window p-3 text-sm text-ink">{notice}</p>
        )}

        {fetching && <p className="text-sm text-ink-muted">Loading...</p>}

        {!fetching && surveys.length === 0 && (
          <p className="text-sm text-ink-muted">
            No saved surveys yet. Save a grid question from the editor first.
          </p>
        )}

        {/* ── Step 1: add questions ── */}
        {!fetching && surveys.length > 0 && (
          <div className="mb-6">
            <p className="mb-3 text-xs font-bold tracking-widest text-ink-faint">
              1 &middot; ADD QUESTIONS
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-ink-muted">
                All saved surveys are already added below.
              </p>
            ) : (
              <ul className="space-y-2">
                {available.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-hairline-warm bg-paper-card p-3"
                  >
                    <span className="font-semibold text-ink">
                      {s.name || s.id.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addQuestion(s.id)}
                      className="rounded-md bg-accent-tint px-3 py-1.5 text-sm font-semibold text-accent hover:opacity-90"
                    >
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Step 2: order & configure ── */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-bold tracking-widest text-ink-faint">
            2 &middot; ORDER &amp; NAME YOUR SURVEY
          </p>

          <label className="mb-3 flex flex-col gap-1 text-sm">
            <span className="text-ink-muted">Survey name</span>
            <input
              type="text"
              value={surveyTitle}
              onChange={(e) => setSurveyTitle(e.target.value)}
              placeholder={defaultTitle}
              className="rounded-md border border-hairline bg-paper-card px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </label>

          {ordered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline p-4 text-sm text-ink-muted">
              Nothing added yet — add questions above to build your survey.
            </p>
          ) : (
            <ul className="space-y-2">
              {ordered.map((survey, index) => (
                <li
                  key={survey.id}
                  className="flex flex-col gap-2 rounded-lg border border-hairline-warm bg-paper-card p-3 sm:flex-row sm:items-center sm:justify-between"
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
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${survey.name} earlier`}
                      className="rounded-md border border-hairline bg-paper-window px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-hairline-warm disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === ordered.length - 1}
                      aria-label={`Move ${survey.name} later`}
                      className="rounded-md border border-hairline bg-paper-window px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-hairline-warm disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(survey.id)}
                      aria-label={`Remove ${survey.name}`}
                      className="rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent hover:opacity-90"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {fieldCollisionError && (
            <p className="mt-3 text-sm font-semibold text-accent">{fieldCollisionError}</p>
          )}
        </div>

        {/* ── Step 3: download ── */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || ordered.length === 0 || !!fieldCollisionError}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? "Preparing…" : "Download .qsf"}
          </button>
          <span className="text-sm text-ink-faint">
            {ordered.length === 0
              ? "Add at least one question to enable download."
              : `${ordered.length} question${ordered.length === 1 ? "" : "s"} in this survey.`}
          </span>
        </div>
      </div>
    </div>
  );
}
