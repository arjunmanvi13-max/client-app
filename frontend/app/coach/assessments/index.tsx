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

import {
  ASSESSMENT_STAGES,
  CORE_KEYS,
  CoreKey,
  PlayerScores,
  TechAreaMeta,
  buildEntryPayload,
  calcAreaAvg,
  calcOverall,
  calcTechnicalMaster,
  completionLabel,
  completionStatus,
  emptyScores,
  isComplete,
  normalizeScoresFromApi,
  scoreTint,
} from "../../../src/assessmentSchema";

type LoadState = "idle" | "loading" | "ready" | "outdated" | "error" | "locked";
type PlayerType = "Daily" | "Day Boarding" | "Hostel" | "Boarding";

const PLAYER_TYPES: PlayerType[] = ["Daily", "Day Boarding", "Hostel", "Boarding"];
const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;
const SESSIONS = ["Morning", "Evening"] as const;

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

type PlayerRow = {
  player_id: string;
  name: string;
  age_group?: string;
  role?: string;
  scores: PlayerScores;
  technical_skill_master_average?: number | null;
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

function stageLabel(id: string, stages: { id: string; label: string }[]): string {
  return stages.find((s) => s.id === id)?.label || id;
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
  const [assessmentStage, setAssessmentStage] = useState("");
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [viewTab, setViewTab] = useState<"entry" | "year">("entry");
  const [yearSummary, setYearSummary] = useState<any>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  const [exportParams, setExportParams] = useState<Record<string, string> | null>(null);

  const techMeta: TechAreaMeta[] = useMemo(() => (
    sport === "Football" ? metadata?.football_technical : metadata?.cricket_technical
  ) || [], [sport, metadata]);

  const stageOptions: { id: string; label: string }[] = useMemo(() => {
    if (metadata?.stages?.length) return metadata.stages;
    return ASSESSMENT_STAGES;
  }, [metadata]);

  const setupReady = useMemo(() => {
    if (!playerType || !assessmentStage) return false;
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
    if (playerType === "Daily" && !sessionType) return false;
    return true;
  }, [playerType, assessmentStage, assessmentDate, sessionType]);

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
    players.filter((p) => isComplete((draft[p.player_id] || { scores: emptyScores(techMeta) }).scores, techMeta)).length
  ), [draft, players, techMeta]);

  const selectedPlayer = players[selectedIndex] || null;

  useEffect(() => {
    if (!canEnter) return;
    api.get("/coach-assessments/metadata").then((r) => {
      setMetadata(r.data);
      const allowed = r.data?.allowed_centres;
      if (allowed?.length === 1) setCentre(allowed[0]);
      const sports = r.data?.allowed_sports;
      if (sports?.length === 1) setSport(sports[0]);
      const stages = r.data?.stages;
      if (stages?.length) {
        setAssessmentStage((prev) => (prev && stages.some((s: { id: string }) => s.id === prev) ? prev : stages[0].id));
      }
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
        scores: normalizeScoresFromApi(p.scores, techMeta),
        technical_skill_master_average: p.technical_skill_master_average ?? p.scores?.technical_skill_master_average,
        overall_score: p.overall_score ?? p.scores?.overall_score,
        completion_status: p.completion_status,
        coach_remark: p.coach_remark,
        status: p.status,
        complete: p.complete,
        saved_by_name: p.saved_by_name,
        updated_at: p.updated_at,
        read_only: p.read_only,
      }));
      setPlayers(rows);
      setSelectedIndex(0);
      const d: Record<string, DraftRow> = {};
      rows.forEach((p) => {
        d[p.player_id] = {
          scores: JSON.parse(JSON.stringify(p.scores)),
          remark: p.coach_remark || "",
        };
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
  }, [setupReady, playerType, centre, sport, assessmentStage, assessmentDate, sessionType, ageGroup, playerSearch, techMeta]);

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
      const allDone = players.every((p) => isComplete((draft[p.player_id] || { scores: emptyScores(techMeta) }).scores, techMeta));
      setAllComplete(allDone && progressCount === players.length);
    }
  }, [draft, players, loadState, techMeta, progressCount]);

  const buildEntryFor = (playerId: string) => {
    const row = draft[playerId] || { scores: emptyScores(techMeta), remark: "" };
    return { player_id: playerId, ...buildEntryPayload(row.scores, row.remark) };
  };

  const buildEntries = () => players.map((p) => buildEntryFor(p.player_id));

  const autoSavePlayer = async (playerId: string) => {
    if (!showGrid || isLocked || !playerType) return;
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    setAutoSaving(true);
    try {
      await api.post("/coach-assessments/player", {
        centre, sport, player_type: playerType,
        session: playerType === "Daily" ? sessionType : undefined,
        assessment_stage: assessmentStage, date: isoDate,
        entry: buildEntryFor(playerId),
      });
      if (loadState === "outdated") setLoadState("ready");
    } catch {
      // silent on auto-save failure
    } finally {
      setAutoSaving(false);
    }
  };

  const navigateToPlayer = async (index: number) => {
    if (index < 0 || index >= players.length || index === selectedIndex) return;
    if (!isLocked && selectedPlayer) {
      await autoSavePlayer(selectedPlayer.player_id);
    }
    setSelectedIndex(index);
    setViewTab("entry");
  };

  const loadYearSummary = async (playerId: string) => {
    setYearLoading(true);
    try {
      const isoDate = parseToISO(assessmentDate) || assessmentDate;
      const year = parseInt(isoDate.slice(0, 4), 10);
      const { data } = await api.get(`/coach-assessments/year-summary/${playerId}`, { params: { year } });
      setYearSummary(data);
    } catch {
      setYearSummary(null);
    } finally {
      setYearLoading(false);
    }
  };

  useEffect(() => {
    if (viewTab === "year" && selectedPlayer) {
      loadYearSummary(selectedPlayer.player_id);
    }
  }, [viewTab, selectedPlayer?.player_id, assessmentDate]);

  const save = async (status: "draft" | "final") => {
    if (!showGrid || players.length === 0 || !playerType) return;
    const isoDate = parseToISO(assessmentDate) || assessmentDate;
    if (status === "final") {
      const incomplete = players.filter((p) => !isComplete((draft[p.player_id] || { scores: emptyScores(techMeta) }).scores, techMeta));
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

  const doExportPdf = async (playerId?: string, completedOnly = false) => {
    if (!canExport || !exportParams) return;
    try {
      if (Platform.OS !== "web") {
        Alert.alert("Export PDF", "Open Player Assessment on desktop web to download PDF reports.");
        return;
      }
      const params: Record<string, string> = { ...exportParams };
      if (playerId) params.player_id = playerId;
      if (completedOnly) params.completed_only = "true";
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

  const updateSubScore = (playerId: string, area: string, subKey: string, value: number) => {
    if (isLocked) return;
    setDraft((d) => {
      const row = d[playerId] || { scores: emptyScores(techMeta), remark: "" };
      return {
        ...d,
        [playerId]: {
          ...row,
          scores: {
            ...row.scores,
            technical_detail: {
              ...row.scores.technical_detail,
              [area]: { ...row.scores.technical_detail[area], [subKey]: value },
            },
          },
        },
      };
    });
    if (loadState === "ready") setLoadState("outdated");
  };

  const updateCoreScore = (playerId: string, key: CoreKey, value: number) => {
    if (isLocked) return;
    setDraft((d) => {
      const row = d[playerId] || { scores: emptyScores(techMeta), remark: "" };
      return { ...d, [playerId]: { ...row, scores: { ...row.scores, [key]: value } } };
    });
    if (loadState === "ready") setLoadState("outdated");
  };

  const updateRemark = (playerId: string, remark: string) => {
    if (isLocked) return;
    setDraft((d) => ({ ...d, [playerId]: { scores: d[playerId]?.scores || emptyScores(techMeta), remark: remark.slice(0, 300) } }));
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
              <TouchableOpacity style={[s.exportBtn, !canExport && s.btnDisabled]} onPress={() => setExportMenuOpen(true)} disabled={!canExport} testID="export-pdf">
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
              <Text style={s.selectBtnTxt} numberOfLines={1}>{stageLabel(assessmentStage, stageOptions) || "Select stage"}</Text>
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
          <Text style={s.legendTxt}>Score guide: 0 = N/A · 1–3 Beginner · 4–5 Developing · 6–7 Good · 8–9 Very Good · 10 Elite</Text>
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
                  {centre} · {sport} · {playerType}{playerType === "Daily" && sessionType ? ` · ${sessionType}` : ""} · {stageLabel(assessmentStage, stageOptions)} · {formatDate(isoDate)} · {players.length} players
                </Text>
              </View>
              <Text style={s.progressTxt} testID="assessment-progress">{progressCount} of {players.length} completed{autoSaving ? " · saving…" : ""}</Text>
            </View>

            {selectedPlayer && (
              <>
                <View style={s.tabRow}>
                  <TouchableOpacity style={[s.tabBtn, viewTab === "entry" && s.tabBtnActive]} onPress={() => setViewTab("entry")}>
                    <Text style={[s.tabBtnTxt, viewTab === "entry" && s.tabBtnTxtActive]}>Data entry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.tabBtn, viewTab === "year" && s.tabBtnActive]} onPress={() => setViewTab("year")}>
                    <Text style={[s.tabBtnTxt, viewTab === "year" && s.tabBtnTxtActive]}>Year summary</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.playerNav}>
                  <Text style={s.playerNavTitle}>
                    Player {selectedIndex + 1} of {players.length} — {selectedPlayer.name}
                  </Text>
                  <View style={s.playerNavActions}>
                    <TouchableOpacity style={[s.navBtn, selectedIndex === 0 && s.btnDisabled]} disabled={selectedIndex === 0} onPress={() => navigateToPlayer(selectedIndex - 1)}>
                      <Feather name="chevron-left" size={16} color={colors.primary} />
                      <Text style={s.navBtnTxt}>Previous</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.navBtn, selectedIndex >= players.length - 1 && s.btnDisabled]} disabled={selectedIndex >= players.length - 1} onPress={() => navigateToPlayer(selectedIndex + 1)}>
                      <Text style={s.navBtnTxt}>Next</Text>
                      <Feather name="chevron-right" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                  <View style={s.chipRow}>
                    {players.map((p, idx) => {
                      const st = completionStatus((draft[p.player_id] || { scores: emptyScores(techMeta) }).scores, techMeta);
                      return (
                        <TouchableOpacity
                          key={p.player_id}
                          style={[s.playerChip, idx === selectedIndex && s.playerChipActive]}
                          onPress={() => navigateToPlayer(idx)}
                        >
                          <Text style={[s.playerChipTxt, idx === selectedIndex && s.playerChipTxtActive]}>{p.name}</Text>
                          <Text style={s.playerChipSub}>{p.role || p.age_group || "—"}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <TouchableOpacity style={s.checklistToggle} onPress={() => setChecklistOpen((o) => !o)}>
                  <Feather name={checklistOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                  <Text style={s.checklistToggleTxt}>Player checklist</Text>
                </TouchableOpacity>
                {checklistOpen && (
                  <View style={s.checklistPanel}>
                    {players.map((p, idx) => {
                      const st = completionStatus((draft[p.player_id] || { scores: emptyScores(techMeta) }).scores, techMeta);
                      return (
                        <TouchableOpacity key={p.player_id} style={s.checklistRow} onPress={() => navigateToPlayer(idx)}>
                          <Text style={s.checklistName}>{p.name}</Text>
                          <Text style={[s.checklistStatus, st === "completed" ? s.statusComplete : st === "in_progress" ? s.statusProgress : s.statusPending]}>
                            {completionLabel(st)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {viewTab === "entry" ? (
                  <PlayerForm
                    player={selectedPlayer}
                    draft={draft[selectedPlayer.player_id]}
                    techMeta={techMeta}
                    locked={isLocked || !!selectedPlayer.read_only}
                    onSubScore={updateSubScore}
                    onCoreScore={updateCoreScore}
                    onRemark={updateRemark}
                  />
                ) : (
                  <YearSummaryPanel
                    loading={yearLoading}
                    summary={yearSummary}
                    onExport={() => doExportPdf(selectedPlayer.player_id)}
                    canExport={canExport}
                  />
                )}
              </>
            )}
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
        {stageOptions.map((st) => (
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
        <TouchableOpacity style={s.pickerRow} onPress={() => doExportPdf(selectedPlayer?.player_id)} disabled={!canExport}>
          <Feather name="user" size={16} color={colors.primary} />
          <Text style={s.pickerRowTxt}>Export this player</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.pickerRow} onPress={() => doExportPdf(undefined, true)} disabled={!canExport}>
          <Feather name="users" size={16} color={colors.primary} />
          <Text style={s.pickerRowTxt}>Export all completed players</Text>
        </TouchableOpacity>
      </PickerModal>
    </SafeAreaView>
  );
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

function SegmentedScore({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.segmentRow}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const active = value === n;
          const tint = scoreTint(n);
          return (
            <TouchableOpacity
              key={n}
              style={[s.segmentBtn, active && s.segmentBtnActive, tint && active ? { backgroundColor: tint } : null, disabled && s.scoreDisabled]}
              onPress={() => !disabled && onChange(n)}
              disabled={disabled}
            >
              <Text style={[s.segmentBtnTxt, active && s.segmentBtnTxtActive]}>{n === 0 ? "N/A" : n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function PlayerForm({ player, draft, techMeta, locked, onSubScore, onCoreScore, onRemark }: {
  player: PlayerRow;
  draft?: DraftRow;
  techMeta: TechAreaMeta[];
  locked: boolean;
  onSubScore: (id: string, area: string, subKey: string, v: number) => void;
  onCoreScore: (id: string, key: CoreKey, v: number) => void;
  onRemark: (id: string, v: string) => void;
}) {
  const row = draft || { scores: emptyScores(techMeta), remark: "" };
  const techMaster = calcTechnicalMaster(row.scores.technical_detail, techMeta);
  const overall = calcOverall(row.scores, techMeta);
  const status = completionStatus(row.scores, techMeta);

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
          <Text style={[s.playerStatus, status === "completed" ? s.statusComplete : status === "in_progress" ? s.statusProgress : s.statusPending]}>
            {completionLabel(status)}
          </Text>
          {overall != null && <Text style={s.overallBadge}>Overall: {overall}/10</Text>}
        </View>
      </View>

      <Text style={s.sectionTitle}>Technical Skill</Text>
      {techMaster != null && (
        <View style={s.avgBadge}><Text style={s.avgBadgeTxt}>Technical Skill: {techMaster} / 10</Text></View>
      )}

      {techMeta.map((area) => {
        const areaAvg = calcAreaAvg(row.scores.technical_detail, area.key);
        return (
          <View key={area.key} style={s.areaBlock}>
            <View style={s.areaHead}>
              <Text style={s.areaTitle}>{area.label}</Text>
              {areaAvg != null && <Text style={s.areaAvg}>{areaAvg}/10</Text>}
            </View>
            <Text style={s.areaParent}>{area.parent}</Text>
            {area.sub_params.map((sp) => (
              <View key={sp.key} style={s.subParamBlock}>
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.paramLabel}>{sp.label}</Text>
                  <Text style={s.paramHint}>{sp.coach}</Text>
                </View>
                <SegmentedScore
                  value={row.scores.technical_detail[area.key]?.[sp.key] ?? null}
                  onChange={(v) => onSubScore(player.player_id, area.key, sp.key, v)}
                  disabled={locked}
                />
              </View>
            ))}
          </View>
        );
      })}

      <Text style={[s.sectionTitle, { marginTop: spacing.md }]}>Other Parameters</Text>
      {CORE_KEYS.map((k) => (
        <View key={k} style={s.subParamBlock}>
          <View style={{ marginBottom: 6 }}>
            <Text style={s.paramLabel}>{CORE_LABELS[k]}</Text>
            <Text style={s.paramHint}>{CORE_HINTS[k]}</Text>
          </View>
          <SegmentedScore
            value={row.scores[k]}
            onChange={(v) => onCoreScore(player.player_id, k, v)}
            disabled={locked}
          />
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

function YearSummaryPanel({ loading, summary, onExport, canExport }: {
  loading: boolean; summary: any; onExport: () => void; canExport: boolean;
}) {
  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />;
  if (!summary?.comparison_rows?.length) {
    return <EmptyState icon="bar-chart-2" title="No year data yet" message="Complete and finalize assessments across terms to see year-over-year progress." compact />;
  }
  const stages = summary.stages || [];
  return (
    <View style={s.yearPanel}>
      <View style={s.yearPanelHead}>
        <Text style={s.yearPanelTitle}>Year summary — {summary.assessment_year}</Text>
        <TouchableOpacity style={[s.secondaryBtn, !canExport && s.btnDisabled]} onPress={onExport} disabled={!canExport}>
          <Text style={s.secondaryBtnTxt}>Export PDF</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={s.yearTableHead}>
            <Text style={[s.yearCell, s.yearCellParam]}>Parameter</Text>
            {stages.map((st: any) => (
              <Text key={st.id} style={s.yearCell}>{st.label.split("—")[0].trim()}</Text>
            ))}
            <Text style={s.yearCell}>Change</Text>
          </View>
          {summary.comparison_rows.map((row: any) => (
            <View key={row.key} style={[s.yearTableRow, row.key === "overall_score" && s.yearRowBold]}>
              <Text style={[s.yearCell, s.yearCellParam]}>{row.label}</Text>
              {(row.values || []).map((v: number | null, i: number) => (
                <Text key={i} style={s.yearCell}>{v != null ? v.toFixed(1) : "—"}</Text>
              ))}
              <Text style={[s.yearCell, row.change > 0 ? s.changeUp : row.change < 0 ? s.changeDown : null]}>
                {row.change != null ? `${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)} ${row.change > 0 ? "↑" : row.change < 0 ? "↓" : ""}` : "—"}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {Platform.OS === "web" && summary.completed_count >= 2 && (
        <YearProgressChart rows={summary.comparison_rows} stages={stages} />
      )}
    </View>
  );
}

function YearProgressChart({ rows, stages }: { rows: any[]; stages: any[] }) {
  const chartRows = rows.filter((r) => ["overall_score", "technical_skill"].includes(r.key) || r.key.includes("_"));
  const w = 520;
  const h = 180;
  const pad = 28;
  const colors_list = ["#1E3A8A", "#DC2626", "#059669", "#D97706", "#7C3AED", "#0891B2"];
  const lines = chartRows.slice(0, 6).map((row, li) => {
    const pts = (row.values || []).map((v: number | null, i: number) => {
      if (v == null) return null;
      const x = pad + (i / Math.max(stages.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (v / 10) * (h - pad * 2);
      return `${x},${y}`;
    }).filter(Boolean).join(" ");
    return { pts, color: colors_list[li % colors_list.length], label: row.label, bold: row.key === "overall_score" };
  }).filter((l) => l.pts.includes(","));

  if (!lines.length) return null;
  return (
    <View style={s.chartWrap}>
      <Text style={s.chartTitle}>Progress chart</Text>
      {/* @ts-ignore web svg */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0, 2, 4, 6, 8, 10].map((tick) => {
          const y = h - pad - (tick / 10) * (h - pad * 2);
          return <line key={tick} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#E2E8F0" strokeWidth={1} />;
        })}
        {lines.map((line, i) => (
          <polyline key={i} fill="none" stroke={line.color} strokeWidth={line.bold ? 3 : 1.5} points={line.pts} />
        ))}
      </svg>
      <View style={s.chartLegend}>
        {lines.map((line, i) => (
          <Text key={i} style={{ fontSize: 10, color: line.color, fontWeight: line.bold ? "800" : "600" }}>{line.label}</Text>
        ))}
      </View>
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
  tabRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  tabBtnTxtActive: { color: "#fff" },
  playerNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm, flexWrap: "wrap", gap: 8 },
  playerNavTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, flex: 1 },
  playerNavActions: { flexDirection: "row", gap: 8 },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  navBtnTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
  chipScroll: { marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  playerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, minWidth: 120 },
  playerChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  playerChipTxt: { fontSize: 12, fontWeight: "800", color: colors.ink },
  playerChipTxtActive: { color: colors.primary },
  playerChipSub: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  checklistToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginBottom: spacing.sm },
  checklistToggleTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
  checklistPanel: { backgroundColor: colors.surface2, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  checklistRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  checklistName: { fontSize: 13, fontWeight: "600", color: colors.ink },
  checklistStatus: { fontSize: 11, fontWeight: "800" },
  areaBlock: { marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  areaHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  areaTitle: { fontSize: 13, fontWeight: "800", color: colors.primary },
  areaAvg: { fontSize: 12, fontWeight: "800", color: colors.ink },
  areaParent: { fontSize: 10, color: colors.muted2, marginBottom: 8, lineHeight: 14 },
  subParamBlock: { marginBottom: 12 },
  segmentRow: { flexDirection: "row", gap: 4 },
  segmentBtn: { minWidth: 34, paddingHorizontal: 6, paddingVertical: 6, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center" },
  segmentBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  segmentBtnTxt: { fontSize: 11, fontWeight: "700", color: colors.muted2 },
  segmentBtnTxtActive: { color: colors.primary, fontWeight: "800" },
  yearPanel: { backgroundColor: colors.surface2, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  yearPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  yearPanelTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  yearTableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 4 },
  yearTableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  yearRowBold: { backgroundColor: colors.primarySofter },
  yearCell: { width: 72, fontSize: 10, fontWeight: "600", color: colors.ink, paddingRight: 6 },
  yearCellParam: { width: 120, fontWeight: "800" },
  changeUp: { color: colors.success },
  changeDown: { color: colors.danger },
  chartWrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  chartTitle: { fontSize: 12, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  chartLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
});
