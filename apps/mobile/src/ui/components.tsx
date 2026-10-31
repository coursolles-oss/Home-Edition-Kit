import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, space } from "./theme";

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = "primary", disabled, loading, style }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.accentText : colors.accent} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" ? styles.buttonTextPrimary : styles.buttonTextSecondary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, onPress }: { label: string; onPress?: () => void }) {
  const content = <Text style={styles.chipText}>{label}</Text>;
  if (!onPress) return <View style={styles.chip}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.chipTappable, pressed && styles.buttonPressed]}
    >
      {content}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function Loading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingTitle}>{title}</Text>
      {detail ? <Text style={styles.loadingDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  buttonTextPrimary: { color: colors.accentText },
  buttonTextSecondary: { color: colors.accent },

  chip: {
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: colors.accentSoft,
  },
  chipTappable: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.card },
  chipText: { color: colors.text, fontSize: 14 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: space.sm,
  },

  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  errorText: { color: colors.danger, fontSize: 15 },

  notice: { backgroundColor: colors.warnSoft, borderRadius: radius.md, padding: space.md },
  noticeText: { color: colors.warnText, fontSize: 13 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.md },
  loadingTitle: { fontSize: 18, fontWeight: "600", color: colors.text, textAlign: "center" },
  loadingDetail: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
