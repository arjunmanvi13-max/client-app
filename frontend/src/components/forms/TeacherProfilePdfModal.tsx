import { useEffect, useState } from "react";
import {
  View, Text, Modal, Pressable, StyleSheet, Platform, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow, spacing } from "../../theme";
import { useBreakpoint } from "../../useBreakpoint";

const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

async function fetchTeacherProfilePdf(userId: string): Promise<string> {
  const token = Platform.OS === "web" && typeof window !== "undefined"
    ? window.localStorage.getItem("pws_alpha_token")
    : null;
  const res = await fetch(`${API_ROOT}/api/users/${userId}/profile-pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "PDF preview failed");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

type TeacherProfilePdfModalProps = {
  visible: boolean;
  userId: string | null;
  teacherName?: string;
  onClose: () => void;
  onDone: () => void;
};

export function TeacherProfilePdfModal({
  visible,
  userId,
  teacherName,
  onClose,
  onDone,
}: TeacherProfilePdfModalProps) {
  const { isWide } = useBreakpoint();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) {
      setPdfUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    fetchTeacherProfilePdf(userId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPdfUrl(url);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Could not load PDF preview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, userId]);

  const download = () => {
    if (!pdfUrl || Platform.OS !== "web" || typeof window === "undefined") return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${(teacherName || "teacher").replace(/\s+/g, "_")}_profile.pdf`;
    a.click();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.card, isWide && s.cardWide]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Teacher Profile Preview</Text>
              <Text style={s.subtitle}>
                {teacherName ? `${teacherName} · PDF` : "Saved profile PDF"}
              </Text>
            </View>
            <TouchableOpacity testID="pdf-preview-close" onPress={onClose} style={s.iconBtn}>
              <Feather name="x" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <View style={s.viewer}>
            {loading && (
              <View style={s.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.loadingTxt}>Generating preview…</Text>
              </View>
            )}
            {!loading && error && (
              <View style={s.center}>
                <Feather name="alert-circle" size={28} color={colors.danger} />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            )}
            {!loading && !error && pdfUrl && Platform.OS === "web" && (
              // eslint-disable-next-line react/no-unknown-property
              <iframe
                title="Teacher profile PDF preview"
                src={pdfUrl}
                style={{ width: "100%", height: "100%", border: "none", borderRadius: 8 }}
              />
            )}
            {!loading && !error && pdfUrl && Platform.OS !== "web" && (
              <View style={s.center}>
                <Feather name="file-text" size={32} color={colors.primary} />
                <Text style={s.loadingTxt}>PDF ready — use Download below.</Text>
              </View>
            )}
          </View>

          <View style={s.actions}>
            {Platform.OS === "web" && pdfUrl && (
              <Pressable style={s.secondaryBtn} onPress={download}>
                <Feather name="download" size={16} color={colors.primary} />
                <Text style={s.secondaryTxt}>Download PDF</Text>
              </Pressable>
            )}
            <Pressable testID="pdf-preview-done" style={s.primaryBtn} onPress={onDone}>
              <Text style={s.primaryTxt}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadow.md,
  },
  cardWide: { maxWidth: 960 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  viewer: {
    height: 480,
    backgroundColor: colors.bg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  loadingTxt: { fontSize: 14, color: colors.muted },
  errorTxt: { fontSize: 14, color: colors.danger, textAlign: "center" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryTxt: { fontSize: 14, fontWeight: "700", color: colors.primary },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  primaryTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
