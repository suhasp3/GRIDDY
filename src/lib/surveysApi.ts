import { GridConfig } from "../grid-types";
import { supabase } from "./supabase";

export interface SurveyMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
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
