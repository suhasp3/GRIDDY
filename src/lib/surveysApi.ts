import { GridConfig } from "../grid-types";
import { supabase } from "./supabase";

const LOCAL_SURVEYS_STORAGE_KEY = "griddy.localSurveys.v1";

export interface SurveyMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ExportedSurvey {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  config: GridConfig;
}

export interface SurveysExportFile {
  version: 1;
  exportedAt: string;
  surveys: ExportedSurvey[];
}

export interface ImportSurveysResult {
  importedCount: number;
  skippedDuplicateCount: number;
}

function readLocalSurveys(): ExportedSurvey[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(LOCAL_SURVEYS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (survey): survey is ExportedSurvey =>
        !!survey &&
        typeof survey === "object" &&
        typeof survey.id === "string" &&
        typeof survey.name === "string" &&
        typeof survey.created_at === "string" &&
        typeof survey.updated_at === "string" &&
        typeof (survey as ExportedSurvey).config === "object" &&
        (survey as ExportedSurvey).config !== null,
    );
  } catch {
    return [];
  }
}

function writeLocalSurveys(surveys: ExportedSurvey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_SURVEYS_STORAGE_KEY, JSON.stringify(surveys));
}

function listLocalSurveyMeta(): SurveyMeta[] {
  return readLocalSurveys()
    .map(({ id, name, created_at, updated_at }) => ({
      id,
      name,
      created_at,
      updated_at,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function surveyFingerprint(name: string, config: GridConfig): string {
  const normalizedName = name.trim().toLowerCase();
  const { id: _ignoredId, ...configWithoutId } = config;

  return stableStringify({
    name: normalizedName,
    config: configWithoutId,
  });
}

export async function saveSurvey(config: GridConfig, userId?: string): Promise<void> {
  if (!userId) {
    const now = new Date().toISOString();
    const surveys = readLocalSurveys();
    const existingIndex = surveys.findIndex((survey) => survey.id === config.id);
    const existing = existingIndex >= 0 ? surveys[existingIndex] : null;
    const record: ExportedSurvey = {
      id: config.id,
      name: config.name,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      config,
    };

    if (existingIndex >= 0) {
      surveys[existingIndex] = record;
    } else {
      surveys.push(record);
    }

    writeLocalSurveys(surveys);
    return;
  }

  const { error } = await supabase.from("surveys").upsert(
    {
      id: config.id,
      user_id: userId,
      name: config.name,
      config,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function listSurveys(userId?: string): Promise<SurveyMeta[]> {
  if (!userId) {
    return listLocalSurveyMeta();
  }

  const { data, error } = await supabase
    .from("surveys")
    .select("id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as SurveyMeta[];
}

export async function loadSurvey(id: string, userId?: string): Promise<GridConfig> {
  if (!userId) {
    const survey = readLocalSurveys().find((item) => item.id === id);
    if (!survey) {
      throw new Error("Survey not found in local storage.");
    }
    return survey.config;
  }

  const { data, error } = await supabase
    .from("surveys")
    .select("config")
    .eq("id", id)
    .single();
  if (error) throw error;
  return (data as { config: GridConfig }).config;
}

export async function deleteSurvey(id: string, userId?: string): Promise<void> {
  if (!userId) {
    writeLocalSurveys(readLocalSurveys().filter((survey) => survey.id !== id));
    return;
  }

  const { error } = await supabase.from("surveys").delete().eq("id", id);
  if (error) throw error;
}

export async function getActiveSurveyQuestionCount(userId?: string): Promise<number> {
  if (!userId) {
    return readLocalSurveys().length;
  }

  const { count, error } = await supabase
    .from("surveys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function exportSurveys(userId?: string): Promise<SurveysExportFile> {
  if (!userId) {
    const surveys = [...readLocalSurveys()].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      surveys,
    };
  }

  const { data, error } = await supabase
    .from("surveys")
    .select("id, name, created_at, updated_at, config")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    surveys: (data ?? []) as ExportedSurvey[],
  };
}

export async function importSurveys(
  userId: string | undefined,
  surveys: ExportedSurvey[],
): Promise<ImportSurveysResult> {
  if (surveys.length === 0) {
    return { importedCount: 0, skippedDuplicateCount: 0 };
  }

  if (!userId) {
    const existingSurveys = readLocalSurveys();
    const existingById = new Map<string, string>();
    const existingFingerprints = new Set<string>();

    for (const survey of existingSurveys) {
      const fp = surveyFingerprint(survey.name, survey.config);
      existingById.set(survey.id, fp);
      existingFingerprints.add(fp);
    }

    const seenInImport = new Set<string>();
    const nextById = new Map(existingSurveys.map((survey) => [survey.id, survey]));
    let importedCount = 0;
    let skippedDuplicateCount = 0;

    for (const survey of surveys) {
      const fp = surveyFingerprint(survey.name, survey.config);

      if (seenInImport.has(fp)) {
        skippedDuplicateCount++;
        continue;
      }
      seenInImport.add(fp);

      if (existingById.has(survey.id) && existingById.get(survey.id) === fp) {
        skippedDuplicateCount++;
        continue;
      }

      if (!existingById.has(survey.id) && existingFingerprints.has(fp)) {
        skippedDuplicateCount++;
        continue;
      }

      nextById.set(survey.id, survey);
      existingById.set(survey.id, fp);
      existingFingerprints.add(fp);
      importedCount++;
    }

    writeLocalSurveys(Array.from(nextById.values()));
    return { importedCount, skippedDuplicateCount };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("surveys")
    .select("id, name, config")
    .eq("user_id", userId);

  if (existingError) throw existingError;

  const existingById = new Map<string, string>();
  const existingFingerprints = new Set<string>();

  for (const row of (existingRows ?? []) as Array<{
    id: string;
    name: string;
    config: GridConfig;
  }>) {
    const fp = surveyFingerprint(row.name, row.config);
    existingById.set(row.id, fp);
    existingFingerprints.add(fp);
  }

  const seenInImport = new Set<string>();
  const rowsToUpsert: Array<{
    id: string;
    user_id: string;
    name: string;
    config: GridConfig;
  }> = [];
  let skippedDuplicateCount = 0;

  for (const survey of surveys) {
    const fp = surveyFingerprint(survey.name, survey.config);

    if (seenInImport.has(fp)) {
      skippedDuplicateCount++;
      continue;
    }
    seenInImport.add(fp);

    if (existingById.has(survey.id)) {
      if (existingById.get(survey.id) === fp) {
        skippedDuplicateCount++;
        continue;
      }

      rowsToUpsert.push({
        id: survey.id,
        user_id: userId,
        name: survey.name,
        config: survey.config,
      });
      existingFingerprints.add(fp);
      continue;
    }

    if (existingFingerprints.has(fp)) {
      skippedDuplicateCount++;
      continue;
    }

    rowsToUpsert.push({
      id: survey.id,
      user_id: userId,
      name: survey.name,
      config: survey.config,
    });
    existingFingerprints.add(fp);
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await supabase
      .from("surveys")
      .upsert(rowsToUpsert, { onConflict: "id" });
    if (error) throw error;
  }

  return {
    importedCount: rowsToUpsert.length,
    skippedDuplicateCount,
  };
}
