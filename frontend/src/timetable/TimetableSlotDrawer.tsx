import { useEffect, useMemo, useState } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet, Platform, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";
import { createSlot, deleteSlot, updateSlot } from "./timetableApi";
import type { TimetablePeriod, TimetableSlot } from "./timetableUtils";
import { DAY_LABELS, type DayOfWeek } from "./timetableUtils";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  slot: TimetableSlot | null;
  period: TimetablePeriod | null;
  day: DayOfWeek;
  classId: string;
  classLabel: string;
  academicYearId: string;
  allocationDate: string;
  subjects: Array<{ id: string; name: string; grade_ids?: string[] }>;
  teachers: Array<{ id: string; name: string; status?: string }>;
  canEdit: boolean;
  canDelete: boolean;
};

export function TimetableSlotDrawer({
  visible,
  onClose,
  onSaved,
  slot,
  period,
  day,
  classId,
  classLabel,
  academicYearId,
  allocationDate,
  subjects,
  teachers,
  canEdit,
  canDelete,
}: Props) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const eligibleSubjects = useMemo(
    () => subjects.filter((s) => !s.grade_ids?.length || s.grade_ids.includes(classId)),
    [subjects, classId],
  );

  useEffect(() => {
    if (!visible) return;
    setSubjectId(slot?.subject_id || null);
    setTeacherId(slot?.teacher_id || null);
    setRoom(slot?.room || "");
    setNotes(slot?.notes || "");
    setFieldError("");
  }, [visible, slot]);

  const save = async () => {
    if (!canEdit || !period) return;
    setSaving(true);
    setFieldError("");
    try {
      const body = {
        academic_year_id: academicYearId,
        class_id: classId,
        day_of_week: day,
        period_id: period.id,
        subject_id: subjectId,
        teacher_id: teacherId,
        room: room.trim() || null,
        notes: notes.trim() || null,
        allocation_date: allocationDate,
      };
      if (slot?.id) {
        await updateSlot(slot.id, body);
      } else {
        await createSlot(body);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Failed to save slot";
      setFieldError(typeof msg === "string" ? msg : JSON.stringify(msg));
      Alert.alert("Validation error", typeof msg === "string" ? msg : "Could not save allocation");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!slot?.id || !canDelete) return;
    Alert.alert(
      "Clear slot",
      `Remove allocation for ${classLabel}, ${DAY_LABELS[day]}, ${period?.period_label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await deleteSlot(slot.id);
              onSaved();
              onClose();
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.detail || "Failed to delete");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (!period) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.drawer} onPress={(e) => e.stopPropagation()}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{slot?.id ? "Edit allocation" : "Add allocation"}</Text>
              <Text style={s.meta}>
                {classLabel} · {DAY_LABELS[day]} · {period.period_label} ({period.start_time}–{period.end_time})
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.muted2} />
            </Pressable>
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            {fieldError ? (
              <View style={s.errorBox}>
                <Text style={s.errorTxt}>{fieldError}</Text>
              </View>
            ) : null}

            <Text style={s.label}>Subject</Text>
            <View style={s.chipRow}>
              {eligibleSubjects.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[s.chip, subjectId === sub.id && s.chipActive]}
                  onPress={() => setSubjectId(sub.id)}
                  disabled={!canEdit}
                >
                  <Text style={[s.chipTxt, subjectId === sub.id && s.chipTxtActive]}>{sub.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Teacher</Text>
            <View style={s.chipRow}>
              {teachers.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.chip, teacherId === t.id && s.chipActive]}
                  onPress={() => setTeacherId(t.id)}
                  disabled={!canEdit || t.status === "deactivated"}
                >
                  <Text style={[s.chipTxt, teacherId === t.id && s.chipTxtActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Room</Text>
            <TextInput
              style={s.input}
              value={room}
              onChangeText={setRoom}
              placeholder="Optional"
              editable={canEdit}
            />

            <Text style={s.label}>Notes</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional"
              multiline
              editable={canEdit}
            />
          </ScrollView>

          <View style={s.footer}>
            {slot?.id && canDelete ? (
              <TouchableOpacity style={s.deleteBtn} onPress={remove} disabled={saving}>
                <Feather name="trash-2" size={14} color="#B91C1C" />
                <Text style={s.deleteTxt}>Clear</Text>
              </TouchableOpacity>
            ) : <View />}
            <View style={s.footerRight}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              {canEdit && (
                <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={s.saveTxt}>Save draft</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-end",
    flexDirection: "row",
  },
  drawer: {
    width: Platform.OS === "web" ? 420 : "100%",
    maxWidth: "100%",
    height: "100%",
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    ...Platform.select({ web: { boxShadow: "-4px 0 24px rgba(15,23,42,0.12)" } as any, default: {} }),
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.md,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 12, color: colors.muted2, marginTop: 4, lineHeight: 18 },
  body: { flex: 1, padding: spacing.lg },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipTxt: { fontSize: 12, color: colors.ink2, fontWeight: "600" },
  chipTxtActive: { color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorTxt: { fontSize: 13, color: "#B91C1C" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  footerRight: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.md },
  cancelTxt: { fontSize: 14, fontWeight: "600", color: colors.muted },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.md,
    minWidth: 110,
    alignItems: "center",
  },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: spacing.sm },
  deleteTxt: { fontSize: 13, fontWeight: "600", color: "#B91C1C" },
});
