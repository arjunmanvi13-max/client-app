import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";

type FormFileDropzoneProps = {
  label?: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  testID?: string;
  compact?: boolean;
};

/** Visual dropzone for photo/document uploads (preview-only until backend wiring). */
export function FormFileDropzone({
  label = "Photo / document",
  hint = "Drag & drop or click to browse",
  accept = "image/*,.pdf",
  disabled,
  testID = "file-dropzone",
  compact,
}: FormFileDropzoneProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onPick = () => {
    if (disabled || Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setFileName(file.name);
      if (file.type.startsWith("image/")) {
        setPreviewUri(URL.createObjectURL(file));
      } else {
        setPreviewUri(null);
      }
    };
    input.click();
  };

  const onClear = () => {
    setPreviewUri(null);
    setFileName(null);
  };

  return (
    <View style={[s.wrap, compact && s.wrapCompact]}>
      {label ? <Text style={[s.label, compact && s.labelCompact]}>{label}</Text> : null}
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={onPick}
        style={({ hovered }: { hovered?: boolean }) => [
          s.zone,
          compact && s.zoneCompact,
          disabled && s.zoneDisabled,
          hovered && !disabled && s.zoneHover,
        ]}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={[s.preview, compact && s.previewCompact]} resizeMode="cover" />
        ) : (
          <View style={s.placeholder}>
            <View style={[s.iconCircle, compact && s.iconCircleCompact]}>
              <Feather name="upload-cloud" size={compact ? 16 : 20} color={colors.primary} />
            </View>
            <Text style={[s.zoneTitle, compact && s.zoneTitleCompact]}>{hint}</Text>
            <Text style={s.zoneSub}>PNG, JPG or PDF</Text>
          </View>
        )}
        {fileName ? (
          <View style={s.fileMeta}>
            <Feather name="paperclip" size={12} color={colors.muted2} />
            <Text style={s.fileName} numberOfLines={1}>{fileName}</Text>
            {!disabled && (
              <Pressable onPress={onClear} hitSlop={8} testID={`${testID}-clear`}>
                <Feather name="x" size={14} color={colors.hint} />
              </Pressable>
            )}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  wrapCompact: { gap: 4 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted },
  labelCompact: { fontSize: 10 },
  zone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  zoneCompact: { minHeight: 88, padding: 8 },
  zoneHover: { borderColor: "#10B981", backgroundColor: "#ECFDF5" },
  zoneDisabled: { opacity: 0.6 },
  placeholder: { alignItems: "center", gap: 4 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySofter,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconCircleCompact: { width: 32, height: 32, borderRadius: 16 },
  zoneTitle: { fontSize: 12, fontWeight: "700", color: colors.ink, textAlign: "center" },
  zoneTitleCompact: { fontSize: 11 },
  zoneSub: { fontSize: 10, color: colors.hint },
  preview: { width: 72, height: 72, borderRadius: radii.md },
  previewCompact: { width: 56, height: 56 },
  fileMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  fileName: { flex: 1, fontSize: 11, fontWeight: "600", color: colors.muted },
});
