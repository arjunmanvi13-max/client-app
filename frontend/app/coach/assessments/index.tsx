import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert, Modal, Pressable, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api, useAuth } from "../../../src/auth";
import { useBreakpoint } from "../../../src/useBreakpoint";
import { LoadingState, ErrorState, EmptyState, getApiError, confirmAction } from "../../../src/ScreenStates";
import { formatDate, formatDateTime, DATE_PLACEHOLDER, toISODate, parseToISO } from "../../../src/dateFormat";
import { colors, radii, spacing } from "../../../src/theme";

type LoadState = "idle" | "loading" | "ready" | "outdated" | "error" | "locked";
type AssessmentStage = "week_1_baseline" | "week_4_progress" | "week_8_12_final";
type PlayerType = "Daily" | "Day Boarding" | "Hostel" | "Boarding";

const PLAYER_TYPES: PlayerType[] = ["Daily", "Day Boarding", "Hostel", "Boarding"];
const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;
const SESSIONS = ["Morning", "Evening"] as const;
const STAGES: { id: AssessmentStage; label: string }[] = [
  { id: "week_1_baseline", label: "Week 1 - Baseline" },
  { id: "week_4_progress", label: "Week 4 - Progress" },
  { id: "week_8_12_final", label: "Week 8-12 - Final" },
];
const CORE_KEYS = ["strength_conditioning", "game_awareness", "mental_attributes", "training_attitude"] as const;
type CoreKey = typeof CORE_KEYS[number];

const CRICKET_TECH = ["batting", "bowling", "fielding", "wicket_keeping", "running_between_wickets", "cricket_iq"] as const;
const FOOTBALL_TECH = ["dribbling", "passing", "shooting", "defending", "heading", "football_iq"] as const;

const CORE_LABELS: Record<CoreKey, string> = {
  strength_conditioning: "Strength & Conditioning",
  game_awareness: "Game Awareness",
  mental_attributes: "Mental Attributes",
  training_attitude: "Training Attitude",
};

const CORE_HINTS: Record<CoreKey, string> = {
  strength_conditioning: "Speed, strength, power, agility, endurance and mobility.",
  game_awareness: "Decision-making, tactical understanding and match awareness.",
  mental_attributes: "Confidence, focus, resilience and composure under pressure.",
  training_attitude: "Discipline, effort, coachability, teamwork and attendance.",
};

type TechKey = string;
type PlayerScores = {
  technical_sub: Record<string, number | null>;
  strength_conditioning: number | null;
  game_awareness: number | null;
  mental_attributes: number | null;
  training_attitude: number | null;
};

type PlayerRow = {
  player_id: string;
  name: string;
  age_group?: string;
  role?: string;
  scores: PlayerScores;
  technical_skill_avg?: number | null;
  overall_score?: number | null;
  completion_status?: string;
  coach_remark: string | null;
  status: string | null;
  complete: boolean;
  saved_by_name?: string | null;
  updated_at?: string | null;
  read_only?: boolean;
};

type DraftRow = { scores: PlayerScores; remark: string };

function techKeys(sport: string): readonly string[] {
  return sport === "Football" ? FOOTBALL_TECH : CRICKET_TECH;
}

function emptyScores(sport: string): PlayerScores {
  const technical_sub: Record<string, number | null> = {};
  techKeys(sport).forEach((k) => { technical_sub[k] = null; });
  return {
    technical_sub,
    strength_conditioning: null,
    game_awareness: null,
    mental_attributes: null,
    training_attitude: null,
  };
}

function scoreLabel(n: number): string {
  if (n <= 3) return "Beginner";
  if (n <= 5) return "Developing";
  if (n <= 7) return "Good";
  if (n <= 9) return "Very Good";
  return "Elite";
}

function scoreTint(n: number | null): string | undefined {
  if (n == null) return undefined;
  if (n <= 3) return colors.dangerSoft;
  if (n <= 5) return colors.warningSoft;
  if (n <= 7) return colors.infoSoft;
  if (n <= 9) return colors.primarySoft;
  return colors.successSoft;
}

function calcTechnicalAvg(technical_sub: Record<string, number | null>, sport: string): number | null {
  const keys = techKeys(sport);
  const vals = keys.map((k) => technical_sub[k]);
  if (vals.some((v) => v == null)) return null;
  return Math.round((vals.reduce((s, v) => s + (v || 0), 0) / keys.length) * 10) / 10;
}

function calcOverall(scores: PlayerScores, sport: string): number | null {
  const techAvg = calcTechnicalAvg(scores.technical_sub, sport);
  if (techAvg == null) return null;
  if (CORE_KEYS.some((k) => scores[k] == null)) return null;
  const sum = techAvg + CORE_KEYS.reduce((s, k) => s + (scores[k] || 0), 0);
  return Math.round((sum / 5) * 10) / 10;
}

function isComplete(scores: PlayerScores, sport: string): boolean {
  if (calcTechnicalAvg(scores.technical_sub, sport) == null) return false;
  return CORE_KEYS.every((k) => scores[k] != null);
}

function completionStatus(scores: PlayerScores, sport: string): string {
  const any = techKeys(sport).some((k) => scores.technical_sub[k] != null) || CORE_KEYS.some((k) => scores[k] != null);
  if (!any) return "Not Started";
  if (isComplete(scores, sport)) return "Completed";
  return "In Progress";
}

function stageLabel(id: AssessmentStage): string {
  return STAGES.find((s) => s.id === id)?.label || id;
}

function techLabel(key: string, meta: any[]): string {
  return meta.find((m) => m.key === key)?.label || key;
}

function techHint(key: string, meta: any[]): string {
  return meta.find((m) => m.key === key)?.coach || "";
}

export default function CoachAssessmentEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDesktop, isMobile, horizontalPadding, contentMaxWidth } = useBreakpoint();
  const { width } = useWindowDimensions();

  const canEnter = user?.role === "coach" || user?.role === "admin" || user?.role === "super_admin"
    || user?.permissions?.enter_coach_assessments;

  const [centre, setCentre] = useState<typeof CENTRES[number]>("Balua");
  const [sport, setSport] = useState<typeof SPORTS[number]>("Cricket");
  const [playerType, setPlayerType] = useState<PlayerType | "">("");
  const [assessmentStage, setAssessmentStage] = useState<AssessmentStage>("week_1_baseline");
  const [assessmentDate, setAssessmentDate] = useState(() => formatDate(toISODate()));
  const [sessionType, setSessionType] = useState<typeof SESSIONS[number] | "">("");

  const [ageGroup, setAgeGroup] = useState("All");
  const [playerSearch, setPlayerSearch] = useState("");

  const [centrePickerOpen, setCentrePickerOpen] = useState(false);
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const [playerTypePickerOpen, setPlayerTypePickerOpen] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const [metadata, setMetadata] = useState<any>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [allComplete, setAllComplete] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportParams, setExportParams] = useState<Record<string, string> | null>(null);

  const techMeta = useMemo(() => (
    sport === "Football" ? metadata?.football_technical : metadata?.cricket_technical
  ) || [], [sport, metadata]);

  const setupReady = useMemo(() => {
    if (!playerType) return false;
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
    if (playerType === "Daily" && !sessionType) return false;
    return true;
  }, [playerType, assessmentDate, sessionType]);

  const filterSnapshotKey = useMemo(() => JSON.stringify({
    centre, sport, playerType, assessmentStage,
    date: parseToISO(assessmentDate) || assessmentDate,
    sessionType, ageGroup, playerSearch,
  }), [centre, sport, playerType, assessmentStage, assessmentDate, sessionType, ageGroup, playerSearch]);

  const advancedFilterCount = useMemo(() => {
    let n = 0;
    if (playerType === "Daily" && sessionType) n++;
    if (ageGroup !== "All") n++;
    if (playerSearch.trim()) n++;
    return n;
  }, [playerType, sessionType, ageGroup, playerSearch]);

  const isLocked = batchStatus === "final" || batchStatus === "published" || loadState === "locked";
  const canExport = (batchStatus === "final" || batchStatus === "published") && allComplete
    && (loadState === "ready" || loadState === "locked") && !saving;
  const showGrid = setupReady && (loadState === "loading" || loadState === "ready" || loadState === "outdated" || loadState === "error" || loadState === "locked");

  const progressCount = useMemo(() => (
    Object.values(draft).filter((d) => isComplete(d.scores, sport)).length
  ), [draft, sport]);

  useEffect(() => {
    if (!canEnter) return;
    api.get("/coach-assessments/metadata").then((r) => {
      setMetadata(r.data);
      const allowed = r.data?.allowed_centres;
      if (allowed?.length === 1) setCentre(allowed[0]);
      const sports = r.data?.allowed_sports;
      if (sports?.length === 1) setSport(sports[0]);
    }).catch(() => {});
  }, [canEnter]);

  const loadPlayers = useCallback(async () => {
    if (!setupReady || !playerType) return;
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    setLoadState("loading");
    setError("");
    const params: Record<string, string> = {
      centre, sport, player_type: playerType,
      assessment_stage: assessmentStage, date: isoDate,
    };
    if (playerType === "Daily" && sessionType) params.session = sessionType;
    if (ageGroup !== "All") params.age_group = ageGroup;
    if (playerSearch.trim()) params.player_search = playerSearch.trim();

    try {
      const { data } = await api.get("/coach-assessments/grid", { params });
      const rows: PlayerRow[] = (data.players || []).map((p: any) => ({
        player_id: p.player_id,
        name: p.name,
        age_group: p.age_group,
        role: p.role,
        scores: normalizeScoresFromApi(p.scores, sport),
        technical_skill_avg: p.technical_skill_avg,
        overall_score: p.overall_score,
        completion_status: p.completion_status,
        coach_remark: p.coach_remark,
        status: p.status,
        complete: p.complete,
        saved_by_name: p.saved_by_name,
        updated_at: p.updated_at,
        read_only: p.read_only,
      }));
      setPlayers(rows);
      const d: Record<string, DraftRow> = {};
      rows.forEach((p) => {
        d[p.player_id] = { scores: { ...p.scores, technical_sub: { ...p.scores.technical_sub } }, remark: p.coach_remark || "" };
      });
      setDraft(d);
      setBatchStatus(data.batch_status);
      setAllComplete(!!data.all_complete);
      const exp: Record<string, string> = {
        centre, sport, player_type: playerType,
        assessment_stage: assessmentStage, date: isoDate,
      };
      if (playerType === "Daily" && sessionType) exp.session = sessionType;
      setExportParams(exp);
      setLoadState(
        data.batch_status === "final" || data.batch_status === "published" ? "locked" : rows.length ? "ready" : "ready",
      );
    } catch (e: any) {
      setError(getApiError(e, "Failed to load players"));
      setPlayers([]);
      setLoadState("error");
    }
  }, [setupReady, playerType, centre, sport, assessmentStage, assessmentDate, sessionType, ageGroup, playerSearch, sport]);

  useEffect(() => {
    if (!setupReady) {
      setLoadState("idle");
      setPlayers([]);
      return;
    }
    const t = setTimeout(() => { loadPlayers(); }, 300);
    return () => clearTimeout(t);
  }, [filterSnapshotKey, setupReady]);

  useEffect(() => {
    if (loadState === "ready" && players.length > 0) {
      const allDone = players.every((p) => isComplete((draft[p.player_id] || { scores: emptyScores(sport) }).scores, sport));
      setAllComplete(allDone && progressCount === players.length);
    }
  }, [draft, players, loadState, sport, progressCount]);

  const buildEntries = () => players.map((p) => {
    const row = draft[p.player_id] || { scores: emptyScores(sport), remark: "" };
    return {
      player_id: p.player_id,
      technical_sub: row.scores.technical_sub,
      strength_conditioning: row.scores.strength_conditioning,
      game_awareness: row.scores.game_awareness,
      mental_attributes: row.scores.mental_attributes,
      training_attitude: row.scores.training_attitude,
      coach_remark: row.remark.trim().slice(0, 300) || null,
    };
  });

  const save = async (status: "draft" | "final") => {
    if (!showGrid || players.length === 0 || !playerType) return;
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    if (status === "final") {
      const incomplete = players.filter((p) => !isComplete((draft[p.player_id] || { scores: emptyScores(sport) }).scores, sport));
      if (incomplete.length > 0) {
        Alert.alert("Cannot finalize", `All scores are required for every player. ${incomplete.length} player(s) incomplete.`);
        return;
      }
      confirmAction("Finalize assessment", "Finalized assessments become read-only for coaches. Continue?", () => doSave(status), { confirmLabel: "Finalize" });
      return;
    }
    await doSave(status);
  };

  const doSave = async (status: "draft" | "final") => {
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    setSaving(true);
    try {
      await api.post("/coach-assessments/batch", {
        centre, sport, player_type: playerType, session: playerType === "Daily" ? sessionType : undefined,
        assessment_stage: assessmentStage, date: isoDate, status, entries: buildEntries(),
      });
      Alert.alert("Saved", status === "final" ? "Assessment finalized." : "Draft saved.");
      await loadPlayers();
    } catch (e: any) {
      Alert.alert("Error", getApiError(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const doExportPdf = async (playerId?: string) => {
    if (!canExport || !exportParams) return;
    try {
      if (Platform.OS !== "web") {
        Alert.alert("Export PDF", "Open Player Assessment on desktop web to download PDF reports.");
        return;
      }
      const params = { ...exportParams };
      if (playerId) params.player_id = playerId;
      const r = await api.get("/coach-assessments/export/pdf", { params, responseType: "blob" });
      const isZip = r.headers["content-type"]?.includes("zip");
      const ext = isZip ? "zip" : "pdf";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data);
      a.download = `player-assessment-${exportParams.date}.${ext}`;
      if (!isZip) a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setExportMenuOpen(false);
    } catch (e: any) {
      const msg = getApiError(e, "Could not export PDF");
      if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Export failed: ${msg}`);
      else Alert.alert("Export failed", msg);
    }
  };

  const updateTechScore = (playerId: string, key: string, value: number | null) => {
    if (isLocked) return;
    setDraft((d) => {
      const row = d[playerId] || { scores: emptyScores(sport), remark: "" };
      return {
        ...d,
        [playerId]: {
          ...row,
          scores: {
            ...row.scores,
            technical_sub: { ...row.scores.technical_sub, [key]: value },
          },
        },
      };
    });
    if (loadState === "ready") setLoadState("outdated");
  };

  const updateCoreScore = (playerId: string, key: CoreKey, value: number | null) => {
    if (isLocked) return;
    setDraft((d) => {
      const row = d[playerId] || { scores: emptyScores(sport), remark: "" };
      return { ...d, [playerId]: { ...row, scores: { ...row.scores, [key]: value } } };
    });
    if (loadState === "ready") setLoadState("outdated");
  };

  const updateRemark = (playerId: string, remark: string) => {
    if (isLocked) return;
    setDraft((d) => ({ ...d, [playerId]: { scores: d[playerId]?.scores || emptyScores(sport), remark: remark.slice(0, 300) } }));
    if (loadState === "ready") setLoadState("outdated");
  };

  if (!canEnter) {
    return (
      <SafeAreaView style={s.wrap}>
        <View style={{ padding: 24 }}>
          <Text style={s.h1}>Player Assessment</Text>
          <Text style={{ marginTop: 12, color: colors.muted2 }}>Coach assessment entry is restricted to coaches.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const setupStacked = !isDesktop || width < 900;
  const isoDate = parseToISO(assessmentDate) || assessmentDate;
  const statusBadge = batchStatus === "published" ? "Published" : batchStatus === "final" ? "Finalized" : batchStatus === "draft" ? "Draft" : null;
  const allowedCentres: string[] = metadata?.allowed_centres || [...CENTRES];
  const allowedSports: string[] = metadata?.allowed_sports || [...SPORTS];

  return (
    <SafeAreaView style={s.wrap} testID="coach-assessment-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? spacing.xl : horizontalPadding,
          paddingBottom: 72,
          maxWidth: contentMaxWidth,
          alignSelf: contentMaxWidth ? "center" : undefined,
          width: contentMaxWidth ? "100%" : undefined,
        }}
      >
        <View style={[s.header, setupStacked && s.headerStacked]}>
          <View style={{ flex: 1 }}>
            {!isDesktop && (
              <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                <Feather name="chevron-left" size={22} color={colors.ink} />
              </TouchableOpacity>
            )}
            <Text style={s.overline}>OPERATIONS · PLAYER ASSESSMENTS</Text>
            <Text style={s.h1}>Player Assessment</Text>
            <Text style={s.helper}>Select centre, sport and player type — eligible players load automatically.</Text>
          </View>
          <View style={s.headerActions}>
            {statusBadge && showGrid && (
              <View style={[s.statusBadge, batchStatus === "final" || batchStatus === "published" ? s.statusBadgeFinal : s.statusBadgeDraft]}>
                <Text style={[s.statusBadgeTxt, batchStatus === "final" || batchStatus === "published" ? { color: colors.primary } : {}]}>{statusBadge}</Text>
              </View>
            )}
            <TouchableOpacity style={[s.secondaryBtn, (saving || isLocked || !showGrid || !players.length) && s.btnDisabled]} onPress={() => save("draft")} disabled={saving || isLocked || !showGrid || !players.length} testID="save-draft">
              <Text style={s.secondaryBtnTxt}>Save draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, (saving || isLocked || !showGrid || !players.length) && s.btnDisabled]} onPress={() => save("final")} disabled={saving || isLocked || !showGrid || !players.length} testID="finalize-assessment">
              <Text style={s.primaryBtnTxt}>Finalize assessment</Text>
            </TouchableOpacity>
            {isMobile ? (
              <TouchableOpacity style={[s.exportBtn, !canExport && s.btnDisabled]} onPress={() => setExportMenuOpen(true)} disabled={!canExport} testID="export-pdf-menu">
                <Feather name="file-text" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.exportBtn, !canExport && s.btnDisabled]} onPress={() => doExportPdf()} disabled={!canExport} testID="export-pdf">
                <Feather name="file-text" size={14} color="#fff" />
                <Text style={s.exportBtnTxt}>Export PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Setup bar */}
        <View style={[s.setupBar, setupStacked && s.setupBarStacked]}>
          <SetupField label="Centre" flex={1}>
            <TouchableOpacity style={s.selectBtn} onPress={() => setCentrePickerOpen(true)} testID="centre-picker">
              <Feather name="map-pin" size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt}>{centre}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>
          <SetupField label="Sport" flex={1}>
            <TouchableOpacity style={s.selectBtn} onPress={() => setSportPickerOpen(true)} testID="sport-picker">
              <Feather name="target" size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt}>{sport}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>
          <SetupField label="Player type" flex={1.1}>
            <TouchableOpacity style={[s.selectBtn, !playerType && s.selectBtnPlaceholder]} onPress={() => setPlayerTypePickerOpen(true)} testID="player-type-picker">
              <Feather name="users" size={15} color={colors.primary} />
              <Text style={[s.selectBtnTxt, !playerType && s.placeholderTxt]}>{playerType || "Select Player Type"}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>
          <SetupField label="Assessment stage" flex={1.2}>
            <TouchableOpacity style={s.selectBtn} onPress={() => setStagePickerOpen(true)} testID="stage-picker">
              <Feather name="layers" size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt} numberOfLines={1}>{stageLabel(assessmentStage)}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>
          <SetupField label="Assessment date" flex={1}>
            <TextInput testID="assessment-date" value={assessmentDate} onChangeText={setAssessmentDate} placeholder={DATE_PLACEHOLDER} placeholderTextColor={colors.hint} style={s.dateInput} />
          </SetupField>
          <SetupField label=" " flex={0.9}>
            <TouchableOpacity style={s.filtersBtn} onPress={() => setFiltersOpen((o) => !o)} testID="more-filters">
              <Feather name="sliders" size={15} color={colors.primary} />
              <Text style={s.filtersBtnTxt}>More filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}</Text>
            </TouchableOpacity>
          </SetupField>
        </View>

        {filtersOpen && !isMobile && (
          <MoreFiltersPanel
            playerType={playerType} sessionType={sessionType} setSessionType={setSessionType}
            ageGroup={ageGroup} setAgeGroup={setAgeGroup}
            playerSearch={playerSearch} setPlayerSearch={setPlayerSearch}
            ageGroups={metadata?.age_groups || ["All", "U-10", "U-12", "U-14", "U-16", "U-18", "Open"]}
            onClose={() => setFiltersOpen(false)}
          />
        )}

        <View style={s.legendBar}>
          <Text style={s.legendTxt}>Score guide: 1–3 Beginner · 4–5 Developing · 6–7 Good · 8–9 Very Good · 10 Elite</Text>
        </View>

        {!setupReady ? null : loadState === "loading" ? (
          <LoadingState message="Loading players…" />
        ) : loadState === "error" ? (
          <ErrorState message={error} onRetry={loadPlayers} compact />
        ) : players.length === 0 ? (
          <EmptyState icon="users" title="No eligible players" message="No eligible players found for the selected criteria." />
        ) : (
          <View style={s.previewCard}>
            {loadState === "outdated" && (
              <View style={s.outdatedBanner}>
                <Feather name="alert-circle" size={14} color="#B45309" />
                <Text style={s.outdatedTxt}>Scores changed — save draft before exporting.</Text>
              </View>
            )}
            {isLocked && (
              <View style={s.lockedBanner}>
                <Feather name="lock" size={14} color={colors.primary} />
                <Text style={s.lockedTxt}>Finalized — read-only for coaches. Contact admin to reopen.</Text>
              </View>
            )}

            <View style={s.previewHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle}>Player assessment</Text>
                <Text style={s.previewSub}>
                  {centre} · {sport} · {playerType}{playerType === "Daily" && sessionType ? ` · ${sessionType}` : ""} · {stageLabel(assessmentStage)} · {formatDate(isoDate)} · {players.length} players
                </Text>
              </View>
              <Text style={s.progressTxt} testID="assessment-progress">{progressCount} of {players.length} completed</Text>
            </View>

            <View style={{ gap: spacing.md }}>
              {players.map((p) => (
                <PlayerCard
                  key={p.player_id}
                  player={p}
                  draft={draft[p.player_id]}
                  sport={sport}
                  techMeta={techMeta}
                  locked={isLocked || !!p.read_only}
                  onTechScore={updateTechScore}
                  onCoreScore={updateCoreScore}
                  onRemark={updateRemark}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <PickerModal visible={centrePickerOpen} onClose={() => setCentrePickerOpen(false)} title="Select centre">
        {allowedCentres.map((v) => (
          <PickerRow key={v} label={v} selected={centre === v} onPress={() => { setCentre(v as any); setCentrePickerOpen(false); }} />
        ))}
      </PickerModal>
      <PickerModal visible={sportPickerOpen} onClose={() => setSportPickerOpen(false)} title="Select sport">
        {allowedSports.map((v) => (
          <PickerRow key={v} label={v} selected={sport === v} onPress={() => { setSport(v as any); setSportPickerOpen(false); }} />
        ))}
      </PickerModal>
      <PickerModal visible={playerTypePickerOpen} onClose={() => setPlayerTypePickerOpen(false)} title="Select player type">
        {PLAYER_TYPES.map((v) => (
          <PickerRow key={v} label={v} selected={playerType === v} onPress={() => { setPlayerType(v); setPlayerTypePickerOpen(false); if (v !== "Daily") setSessionType(""); }} testID={`player-type-${v}`} />
        ))}
      </PickerModal>
      <PickerModal visible={stagePickerOpen} onClose={() => setStagePickerOpen(false)} title="Assessment stage">
        {STAGES.map((st) => (
          <PickerRow key={st.id} label={st.label} selected={assessmentStage === st.id} onPress={() => { setAssessmentStage(st.id); setStagePickerOpen(false); }} />
        ))}
      </PickerModal>

      <PickerModal visible={filtersOpen && isMobile} onClose={() => setFiltersOpen(false)} title="More filters" sheet>
        <MoreFiltersPanel
          playerType={playerType} sessionType={sessionType} setSessionType={setSessionType}
          ageGroup={ageGroup} setAgeGroup={setAgeGroup}
          playerSearch={playerSearch} setPlayerSearch={setPlayerSearch}
          ageGroups={metadata?.age_groups || ["All", "U-10", "U-12", "U-14", "U-16", "U-18", "Open"]}
          embedded
        />
      </PickerModal>

      <PickerModal visible={exportMenuOpen} onClose={() => setExportMenuOpen(false)} title="Export PDF" sheet>
        <TouchableOpacity style={s.pickerRow} onPress={() => doExportPdf()} disabled={!canExport}>
          <Feather name="file-text" size={16} color={colors.primary} />
          <Text style={s.pickerRowTxt}>All players</Text>
        </TouchableOpacity>
        {players.map((p) => (
          <TouchableOpacity key={p.player_id} style={s.pickerRow} onPress={() => doExportPdf(p.player_id)} disabled={!canExport}>
            <Feather name="user" size={16} color={colors.primary} />
            <Text style={s.pickerRowTxt}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </PickerModal>
    </SafeAreaView>
  );
}

function normalizeScoresFromApi(raw: any, sport: string): PlayerScores {
  const base = emptyScores(sport);
  if (!raw) return base;
  if (raw.technical_sub) {
    techKeys(sport).forEach((k) => { base.technical_sub[k] = raw.technical_sub[k] ?? null; });
  }
  CORE_KEYS.forEach((k) => { base[k] = raw[k] ?? null; });
  return base;
}

function SetupField({ label, flex, children }: { label: string; flex?: number; children: React.ReactNode }) {
  return (
    <View style={{ flex: flex ?? 1, minWidth: 120 }}>
      {label.trim() ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

function PickerModal({ visible, onClose, title, children, sheet }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; sheet?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={[s.modalCard, sheet && s.modalSheet]} onPress={(e) => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}><Feather name="x" size={20} color={colors.muted} /></TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerRow({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} style={[s.pickerRow, selected && s.pickerRowActive]} onPress={onPress}>
      <Text style={[s.pickerRowTxt, selected && s.pickerRowTxtActive]}>{label}</Text>
      {selected && <Feather name="check" size={16} color={colors.primary} />}
    </TouchableOpacity>
  );
}

function MoreFiltersPanel(props: {
  playerType: PlayerType | ""; sessionType: string; setSessionType: (v: typeof SESSIONS[number]) => void;
  ageGroup: string; setAgeGroup: (v: string) => void;
  playerSearch: string; setPlayerSearch: (v: string) => void;
  ageGroups: string[]; onClose?: () => void; embedded?: boolean;
}) {
  const { playerType, sessionType, setSessionType, ageGroup, setAgeGroup, playerSearch, setPlayerSearch, ageGroups, onClose, embedded } = props;
  return (
    <View style={[s.advPanel, embedded && { borderWidth: 0, marginBottom: 0, padding: 0 }]}>
      {!embedded && onClose && (
        <View style={s.advPanelHead}>
          <Text style={s.advPanelTitle}>More filters</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={18} color={colors.muted2} /></TouchableOpacity>
        </View>
      )}
      {playerType === "Daily" && (
        <FilterChips label="Session type" value={sessionType || "Select"} options={SESSIONS} onChange={setSessionType} testID="session-type" required />
      )}
      <FilterChips label="Age group" value={ageGroup} options={ageGroups} onChange={setAgeGroup} testID="age-group" />
      <View style={s.filterField}>
        <Text style={s.filterFieldLabel}>Search player</Text>
        <TextInput testID="player-search" value={playerSearch} onChangeText={setPlayerSearch} placeholder="Name contains…" placeholderTextColor={colors.hint} style={s.filterInput} />
      </View>
    </View>
  );
}

function FilterChips({ label, value, options, onChange, testID, required }: {
  label: string; value: string; options: readonly string[]; onChange: (v: any) => void; testID?: string; required?: boolean;
}) {
  return (
    <View style={s.filterField}>
      <Text style={s.filterFieldLabel}>{label}{required ? " *" : ""}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.miniSelectRow}>
          {options.map((opt) => (
            <TouchableOpacity key={opt} testID={testID ? `${testID}-${opt}` : undefined} onPress={() => onChange(opt)} style={[s.miniSelect, value === opt && s.miniSelectActive]}>
              <Text style={[s.miniSelectTxt, value === opt && s.miniSelectTxtActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreSelector({ value, onChange, disabled }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const tint = scoreTint(value);
  return (
    <>
      <TouchableOpacity style={[s.scorePill, tint ? { backgroundColor: tint } : null, disabled && s.scoreDisabled]} onPress={() => !disabled && setOpen(true)} disabled={disabled}>
        <Text style={[s.scorePillTxt, value != null && { color: colors.ink }]}>{value != null ? value : "—"}</Text>
        {value != null && <Text style={s.scorePillHint}>{scoreLabel(value)}</Text>}
      </TouchableOpacity>
      <ScorePickerModal visible={open} value={value} onSelect={(v) => { onChange(v); setOpen(false); }} onClose={() => setOpen(false)} />
    </>
  );
}

function ScorePickerModal({ visible, value, onSelect, onClose }: { visible: boolean; value: number | null; onSelect: (v: number) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scoreModalOverlay} onPress={onClose}>
        <Pressable style={s.scoreModalCard} onPress={(e) => e.stopPropagation?.()}>
          <Text style={s.scoreModalTitle}>Score (1–10)</Text>
          <View style={s.scoreGrid}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <TouchableOpacity key={n} style={[s.scoreOption, value === n && s.scoreOptionActive, { backgroundColor: scoreTint(n) }]} onPress={() => onSelect(n)}>
                <Text style={[s.scoreOptionTxt, value === n && s.scoreOptionTxtActive]}>{n}</Text>
                <Text style={s.scoreOptionHint}>{scoreLabel(n)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PlayerCard({ player, draft, sport, techMeta, locked, onTechScore, onCoreScore, onRemark }: {
  player: PlayerRow; draft?: DraftRow; sport: string; techMeta: any[];
  locked: boolean;
  onTechScore: (id: string, key: string, v: number | null) => void;
  onCoreScore: (id: string, key: CoreKey, v: number | null) => void;
  onRemark: (id: string, v: string) => void;
}) {
  const row = draft || { scores: emptyScores(sport), remark: "" };
  const techAvg = calcTechnicalAvg(row.scores.technical_sub, sport);
  const overall = calcOverall(row.scores, sport);
  const status = completionStatus(row.scores, sport);

  return (
    <View style={s.playerCard} testID={`coach-asm-${player.player_id}`}>
      <View style={s.playerCardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.playerName}>{player.name}</Text>
          <Text style={s.playerMeta}>{player.role || player.age_group || "—"}</Text>
          {player.saved_by_name && (
            <Text style={s.savedMeta}>Saved by {player.saved_by_name}{player.updated_at ? ` · ${formatDateTime(player.updated_at)}` : ""}</Text>
          )}
        </View>
        <View style={s.statusCol}>
          <Text style={[s.playerStatus, status === "Completed" ? s.statusComplete : status === "In Progress" ? s.statusProgress : s.statusPending]}>{status}</Text>
          {overall != null && <Text style={s.overallBadge}>Overall: {overall}/10</Text>}
        </View>
      </View>

      <Text style={s.sectionTitle}>Technical Skill — {sport}</Text>
      {techAvg != null && (
        <View style={s.avgBadge}><Text style={s.avgBadgeTxt}>Technical Skill: {techAvg} / 10</Text></View>
      )}
      {techKeys(sport).map((k) => (
        <View key={k} style={s.paramRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.paramLabel}>{techLabel(k, techMeta)}</Text>
            <Text style={s.paramHint}>{techHint(k, techMeta)}</Text>
          </View>
          <ScoreSelector value={row.scores.technical_sub[k]} onChange={(v) => onTechScore(player.player_id, k, v)} disabled={locked} />
        </View>
      ))}

      {CORE_KEYS.map((k) => (
        <View key={k} style={s.paramRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.paramLabel}>{CORE_LABELS[k]}</Text>
            <Text style={s.paramHint}>{CORE_HINTS[k]}</Text>
          </View>
          <ScoreSelector value={row.scores[k]} onChange={(v) => onCoreScore(player.player_id, k, v)} disabled={locked} />
        </View>
      ))}

      <TextInput
        style={s.cardRemark}
        value={row.remark}
        onChangeText={(v) => onRemark(player.player_id, v)}
        placeholder="Coach remark (optional, max 300 characters)"
        placeholderTextColor={colors.hint}
        editable={!locked}
        multiline
        maxLength={300}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  headerStacked: { flexDirection: "column" },
  headerActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  backBtn: { padding: 6, borderRadius: radii.sm, backgroundColor: colors.primarySofter, marginBottom: spacing.sm, alignSelf: "flex-start" },
  overline: { fontSize: 10, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 2 },
  helper: { fontSize: 13, color: colors.muted2, marginTop: 4, lineHeight: 18 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  statusBadgeDraft: { backgroundColor: colors.warningSoft, borderColor: "#FDE68A" },
  statusBadgeFinal: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  statusBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#B45309" },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md },
  secondaryBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  secondaryBtnTxt: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md },
  exportBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  btnDisabled: { opacity: 0.45 },
  setupBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.06)" } as any, default: {} }) },
  setupBarStacked: { flexDirection: "column", alignItems: "stretch" },
  fieldLabel: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  selectBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42 },
  selectBtnPlaceholder: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  selectBtnTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink },
  placeholderTxt: { color: colors.muted2, fontWeight: "600" },
  dateInput: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, fontSize: 13, fontWeight: "600", color: colors.ink },
  filtersBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, backgroundColor: colors.primarySofter },
  filtersBtnTxt: { fontSize: 12, fontWeight: "800", color: colors.primary },
  legendBar: { backgroundColor: colors.surface2, borderRadius: radii.md, padding: 10, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  legendTxt: { fontSize: 11, fontWeight: "700", color: colors.muted2, textAlign: "center" },
  previewCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  previewHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md, flexWrap: "wrap" },
  previewTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  previewSub: { fontSize: 12, color: colors.muted2, marginTop: 4, lineHeight: 17 },
  progressTxt: { fontSize: 11, fontWeight: "800", color: colors.primary, backgroundColor: colors.primarySofter, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  outdatedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: radii.sm, padding: 10, marginBottom: spacing.md, borderWidth: 1, borderColor: "#FDE68A" },
  outdatedTxt: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },
  lockedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primarySofter, borderRadius: radii.sm, padding: 10, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primarySoft },
  lockedTxt: { flex: 1, fontSize: 12, color: colors.primary, fontWeight: "600" },
  playerCard: { backgroundColor: colors.surface2, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  playerCardHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  playerName: { fontSize: 15, fontWeight: "800", color: colors.ink },
  playerMeta: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  savedMeta: { fontSize: 10, color: colors.muted2, marginTop: 4 },
  statusCol: { alignItems: "flex-end", gap: 4 },
  playerStatus: { fontSize: 11, fontWeight: "800" },
  overallBadge: { fontSize: 11, fontWeight: "800", color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  avgBadge: { alignSelf: "flex-start", backgroundColor: colors.primarySofter, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md, marginBottom: 10, borderWidth: 1, borderColor: colors.primarySoft },
  avgBadgeTxt: { fontSize: 12, fontWeight: "800", color: colors.primary },
  paramRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: 10 },
  paramLabel: { fontSize: 12, fontWeight: "700", color: colors.ink },
  paramHint: { fontSize: 10, color: colors.muted2, marginTop: 2, lineHeight: 14 },
  cardRemark: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10, fontSize: 13, color: colors.ink, marginTop: 8, minHeight: 60, backgroundColor: colors.surface },
  statusComplete: { color: colors.success },
  statusProgress: { color: colors.warning },
  statusPending: { color: colors.muted2 },
  scorePill: { alignItems: "center", justifyContent: "center", minWidth: 52, paddingVertical: 6, paddingHorizontal: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  scorePillTxt: { fontSize: 16, fontWeight: "800", color: colors.muted2 },
  scorePillHint: { fontSize: 8, fontWeight: "700", color: colors.muted2, marginTop: 1 },
  scoreDisabled: { opacity: 0.55 },
  scoreModalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 24 },
  scoreModalCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, maxWidth: 360, alignSelf: "center", width: "100%" },
  scoreModalTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scoreOption: { width: 56, alignItems: "center", paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  scoreOptionActive: { borderColor: colors.primary, borderWidth: 2 },
  scoreOptionTxt: { fontSize: 16, fontWeight: "800", color: colors.ink },
  scoreOptionTxtActive: { color: colors.primary },
  scoreOptionHint: { fontSize: 7, fontWeight: "700", color: colors.muted2, marginTop: 2, textAlign: "center" },
  advPanel: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  advPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  advPanelTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  filterField: { gap: 6 },
  filterFieldLabel: { fontSize: 11, fontWeight: "700", color: colors.muted2 },
  filterInput: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.ink },
  miniSelectRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  miniSelect: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  miniSelectActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  miniSelectTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  miniSelectTxtActive: { color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, maxHeight: "80%" },
  modalSheet: { marginTop: "auto" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  pickerRowActive: { backgroundColor: colors.primarySofter, borderRadius: radii.sm },
  pickerRowTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  pickerRowTxtActive: { color: colors.primary, fontWeight: "800" },
});
