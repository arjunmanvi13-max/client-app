import { colors } from "./theme";

export type AssessmentStage = "assessment_1" | "assessment_2" | "assessment_3" | "assessment_4";

export const ASSESSMENT_STAGES: { id: AssessmentStage; label: string }[] = [
  { id: "assessment_1", label: "Assessment 1 — Term 1 (Jan–Mar)" },
  { id: "assessment_2", label: "Assessment 2 — Term 2 (Apr–Jun)" },
  { id: "assessment_3", label: "Assessment 3 — Term 3 (Jul–Sep)" },
  { id: "assessment_4", label: "Assessment 4 — Term 4 (Oct–Dec)" },
];

export const CORE_KEYS = [
  "strength_conditioning",
  "game_awareness",
  "mental_attributes",
  "training_attitude",
] as const;

export type CoreKey = typeof CORE_KEYS[number];

export type TechnicalDetail = Record<string, Record<string, number | null>>;

export type PlayerScores = {
  technical_detail: TechnicalDetail;
  sub_parameter_averages?: Record<string, number | null>;
  technical_skill_master_average?: number | null;
  strength_conditioning: number | null;
  game_awareness: number | null;
  mental_attributes: number | null;
  training_attitude: number | null;
  overall_score?: number | null;
};

export type TechAreaMeta = {
  key: string;
  label: string;
  parent: string;
  sub_params: { key: string; label: string; coach: string }[];
};

function avgNonNa(values: (number | null | undefined)[]): number | null {
  const scored = values.filter((v) => v != null && v > 0) as number[];
  if (!scored.length) return null;
  return Math.round((scored.reduce((s, v) => s + v, 0) / scored.length) * 10) / 10;
}

export function scoreLabel(n: number): string {
  if (n === 0) return "N/A";
  if (n <= 3) return "Beginner";
  if (n <= 5) return "Developing";
  if (n <= 7) return "Good";
  if (n <= 9) return "Very Good";
  return "Elite";
}

export function scoreTint(n: number | null): string | undefined {
  if (n == null) return undefined;
  if (n === 0) return undefined;
  if (n <= 3) return colors.dangerSoft;
  if (n <= 5) return colors.warningSoft;
  if (n <= 7) return colors.infoSoft;
  if (n <= 9) return colors.primarySoft;
  return colors.successSoft;
}

export function emptyTechnicalDetail(techMeta: TechAreaMeta[]): TechnicalDetail {
  const out: TechnicalDetail = {};
  techMeta.forEach((area) => {
    out[area.key] = {};
    area.sub_params.forEach((sp) => { out[area.key][sp.key] = null; });
  });
  return out;
}

export function emptyScores(techMeta: TechAreaMeta[]): PlayerScores {
  return {
    technical_detail: emptyTechnicalDetail(techMeta),
    strength_conditioning: null,
    game_awareness: null,
    mental_attributes: null,
    training_attitude: null,
  };
}

export function calcAreaAvg(detail: TechnicalDetail, areaKey: string): number | null {
  const subs = detail[areaKey] || {};
  return avgNonNa(Object.values(subs));
}

export function calcTechnicalMaster(detail: TechnicalDetail, techMeta: TechAreaMeta[]): number | null {
  const avgs = techMeta.map((a) => calcAreaAvg(detail, a.key)).filter((v) => v != null) as number[];
  if (!avgs.length) return null;
  return Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 10) / 10;
}

export function calcOverall(scores: PlayerScores, techMeta: TechAreaMeta[]): number | null {
  const tech = calcTechnicalMaster(scores.technical_detail, techMeta);
  if (tech == null) return null;
  const core = CORE_KEYS.map((k) => scores[k]);
  if (core.some((v) => v == null)) return null;
  const parts = [tech, ...core.filter((v) => v != null && v > 0) as number[]];
  if (parts.length !== 5) return null;
  return Math.round((parts.reduce((s, v) => s + v, 0) / 5) * 10) / 10;
}

export function isComplete(scores: PlayerScores, techMeta: TechAreaMeta[]): boolean {
  for (const area of techMeta) {
    const subs = scores.technical_detail[area.key] || {};
    for (const sp of area.sub_params) {
      if (subs[sp.key] == null) return false;
    }
  }
  return CORE_KEYS.every((k) => scores[k] != null);
}

export function completionStatus(scores: PlayerScores, techMeta: TechAreaMeta[]): "not_started" | "in_progress" | "completed" {
  const any = techMeta.some((a) =>
    a.sub_params.some((sp) => scores.technical_detail[a.key]?.[sp.key] != null),
  ) || CORE_KEYS.some((k) => scores[k] != null);
  if (!any) return "not_started";
  if (isComplete(scores, techMeta)) return "completed";
  return "in_progress";
}

export function completionLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Not Started";
}

export function normalizeScoresFromApi(raw: any, techMeta: TechAreaMeta[]): PlayerScores {
  const base = emptyScores(techMeta);
  if (!raw) return base;
  if (raw.technical_detail) {
    techMeta.forEach((area) => {
      area.sub_params.forEach((sp) => {
        base.technical_detail[area.key][sp.key] = raw.technical_detail?.[area.key]?.[sp.key] ?? null;
      });
    });
  } else if (raw.technical_sub) {
    techMeta.forEach((area) => {
      const flat = raw.technical_sub[area.key];
      area.sub_params.forEach((sp) => {
        base.technical_detail[area.key][sp.key] = flat != null ? (flat > 0 ? flat : 0) : null;
      });
    });
  }
  CORE_KEYS.forEach((k) => { base[k] = raw[k] ?? null; });
  base.sub_parameter_averages = raw.sub_parameter_averages;
  base.technical_skill_master_average = raw.technical_skill_master_average;
  base.overall_score = raw.overall_score;
  return base;
}

export function buildEntryPayload(scores: PlayerScores, remark: string) {
  // API expects integers only in technical_detail — omit unset (null) sub-scores.
  const technical_detail: Record<string, Record<string, number>> = {};
  Object.entries(scores.technical_detail || {}).forEach(([area, subs]) => {
    const clean: Record<string, number> = {};
    Object.entries(subs || {}).forEach(([k, v]) => {
      if (v != null) clean[k] = v;
    });
    if (Object.keys(clean).length) technical_detail[area] = clean;
  });

  const payload: {
    technical_detail?: Record<string, Record<string, number>>;
    strength_conditioning: number | null;
    game_awareness: number | null;
    mental_attributes: number | null;
    training_attitude: number | null;
    coach_remark: string | null;
  } = {
    strength_conditioning: scores.strength_conditioning,
    game_awareness: scores.game_awareness,
    mental_attributes: scores.mental_attributes,
    training_attitude: scores.training_attitude,
    coach_remark: remark.trim().slice(0, 300) || null,
  };
  if (Object.keys(technical_detail).length) payload.technical_detail = technical_detail;
  return payload;
}
