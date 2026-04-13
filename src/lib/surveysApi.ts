import { GridConfig } from "../grid-types";
import { supabase } from "./supabase";

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

function stableStringify(value: unknown): string {
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

function surveyFingerprint(name: string, config: GridConfig): string {
  const normalizedName = name.trim().toLowerCase();
  const { id: _ignoredId, ...configWithoutId } = config;

  return stableStringify({
    name: normalizedName,
    config: configWithoutId,
  });
}

export async function saveSurvey(config: GridConfig, userId: string): Promise<void> {
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

export async function listSurveys(userId: string): Promise<SurveyMeta[]> {
  const { data, error } = await supabase
    .from("surveys")
    .select("id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as SurveyMeta[];
}

export async function loadSurvey(id: string): Promise<GridConfig> {
  const { data, error } = await supabase
    .from("surveys")
    .select("config")
    .eq("id", id)
    .single();
  if (error) throw error;
  return (data as { config: GridConfig }).config;
}

export async function deleteSurvey(id: string): Promise<void> {
  const { error } = await supabase.from("surveys").delete().eq("id", id);
  if (error) throw error;
}

export async function getActiveSurveyQuestionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("surveys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function exportSurveys(userId: string): Promise<SurveysExportFile> {
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
  userId: string,
  surveys: ExportedSurvey[],
): Promise<ImportSurveysResult> {
  if (surveys.length === 0) {
    return { importedCount: 0, skippedDuplicateCount: 0 };
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
