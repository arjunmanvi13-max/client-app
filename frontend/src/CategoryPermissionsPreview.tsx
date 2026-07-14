import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "./auth";
import { enabledModuleLabels, type PreviewCatalogGroup } from "./categoryPermissionsUtil";
import { colors, radii } from "./theme";
import type { LoginUserType } from "./userClassification";

type Props = {
  userType: LoginUserType;
  displayName: string;
};

export function CategoryPermissionsPreview({ userType, displayName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/permissions/categories/${userType}`);
      const catalog = (data.catalog || []) as PreviewCatalogGroup[];
      const modules = (data.modules || {}) as Record<string, boolean>;
      setLocked(!!data.locked);
      setLabels(enabledModuleLabels(catalog, modules));
      setLoaded(true);
    } catch {
      setError("Could not load permission preview.");
    } finally {
      setLoading(false);
    }
  }, [loaded, userType]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <View style={s.wrap} testID="category-permissions-preview">
      <TouchableOpacity
        style={s.head}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID="category-permissions-preview-toggle"
      >
        <Feather name="shield" size={14} color={colors.primary} />
        <Text style={s.headTxt}>View {displayName} Permissions Preview</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </TouchableOpacity>

      {open && (
        <View style={s.body}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
          ) : error ? (
            <Text style={s.err}>{error}</Text>
          ) : (
            <>
              {locked ? (
                <Text style={s.note}>Full access — all modules enabled.</Text>
              ) : labels.length === 0 ? (
                <Text style={s.note}>No modules enabled for this category.</Text>
              ) : (
                labels.map((label) => (
                  <View key={label} style={s.row}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.item}>{label}</Text>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={s.linkBtn}
                onPress={() => router.push(`/admin/permissions?category=${userType}`)}
                testID="edit-category-permissions-link"
              >
                <Feather name="external-link" size={12} color={colors.primary} />
                <Text style={s.linkTxt}>Edit Category Permissions</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F0FDFA",
  },
  headTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink2 },
  body: { paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  bullet: { fontSize: 13, color: colors.primary, lineHeight: 20 },
  item: { flex: 1, fontSize: 13, color: colors.ink2, lineHeight: 20 },
  note: { fontSize: 12, color: colors.muted2, fontStyle: "italic", marginBottom: 4 },
  err: { fontSize: 12, color: colors.danger },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  linkTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
});
