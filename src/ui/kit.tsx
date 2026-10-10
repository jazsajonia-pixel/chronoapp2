import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AlertTriangle, ChevronLeft, RotateCw, X, type LucideProps } from "lucide-react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { describeError } from "@/lib/errors";
import { FONT, RADIUS, useTheme, type ColorName } from "./theme";

export type Icon = ComponentType<LucideProps>;

export const haptic = {
  tap: () => void Haptics.selectionAsync().catch(() => {}),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

/* ───────────────────────── Text ───────────────────────── */

type Variant = "display" | "title" | "h2" | "h3" | "body" | "small" | "tiny" | "mono" | "monoSmall" | "label";
const VARIANT: Record<Variant, TextStyle> = {
  display: { fontSize: 40, lineHeight: 44, fontFamily: FONT.semibold, letterSpacing: -1.2 },
  title: { fontSize: 24, lineHeight: 30, fontFamily: FONT.semibold, letterSpacing: -0.5 },
  h2: { fontSize: 18, lineHeight: 24, fontFamily: FONT.semibold, letterSpacing: -0.2 },
  h3: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FONT.regular },
  small: { fontSize: 13, lineHeight: 18, fontFamily: FONT.regular },
  tiny: { fontSize: 11, lineHeight: 15, fontFamily: FONT.regular },
  mono: { fontSize: 13, lineHeight: 19, fontFamily: FONT.mono },
  monoSmall: { fontSize: 11, lineHeight: 15, fontFamily: FONT.mono },
  label: { fontSize: 11, lineHeight: 14, fontFamily: FONT.semibold, letterSpacing: 0.8, textTransform: "uppercase" },
};

export function T({
  variant = "body",
  color,
  weight,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: ColorName; weight?: "medium" | "semibold" | "bold" }) {
  const { c } = useTheme();
  const fw = weight ? { fontFamily: variant.startsWith("mono") ? FONT.monoMedium : FONT[weight] } : null;
  const defaultColor: ColorName = variant === "small" || variant === "tiny" || variant === "label" || variant === "monoSmall" ? "mutedForeground" : "foreground";
  return <Text {...rest} style={[VARIANT[variant], { color: c[color ?? defaultColor] }, fw, style]} />;
}

/* ───────────────────────── Buttons ───────────────────────── */

type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export function Btn({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon: IconC,
  iconRight: IconR,
  loading,
  disabled,
  full,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  icon?: Icon;
  iconRight?: Icon;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { c, a } = useTheme();
  const h = size === "sm" ? 36 : size === "lg" ? 52 : 44;
  const bg = { primary: c.primary, secondary: c.surface2, outline: "transparent", ghost: "transparent", danger: c.danger }[variant];
  const fg = { primary: c.primaryForeground, secondary: c.foreground, outline: c.foreground, ghost: c.foreground, danger: "#fff" }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: size === "sm" ? 12 : 16,
          borderRadius: RADIUS.md,
          backgroundColor: pressed && variant !== "primary" && variant !== "danger" ? a("foreground", 0.08) : bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: c.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: full ? "stretch" : "auto",
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : IconC ? <IconC size={size === "sm" ? 15 : 17} color={fg} /> : null}
      <Text numberOfLines={1} style={{ color: fg, fontFamily: FONT.semibold, fontSize: size === "sm" ? 13 : 15 }}>
        {label}
      </Text>
      {IconR ? <IconR size={16} color={fg} /> : null}
    </Pressable>
  );
}

export function IconBtn({
  icon: IconC,
  onPress,
  label,
  active,
  disabled,
  size = 40,
  color,
  badge,
  testID,
}: {
  icon: Icon;
  onPress?: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  color?: ColorName;
  badge?: number;
  testID?: string;
}) {
  const { c, a } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: RADIUS.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? a("primary", 0.14) : pressed ? a("foreground", 0.08) : "transparent",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <IconC size={Math.round(size * 0.48)} color={active ? c.primary : c[color ?? "foreground"]} />
      {badge ? (
        <View style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
          <Text style={{ color: c.primaryForeground, fontSize: 10, fontFamily: FONT.bold }}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ───────────────────────── Surfaces ───────────────────────── */

export function Card({ children, style, onPress, testID, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; tone?: "primary" | "danger" | "warning" }) {
  const { c, a } = useTheme();
  const base: ViewStyle = {
    backgroundColor: tone ? a(tone, 0.07) : c.surface,
    borderColor: tone ? a(tone, 0.35) : c.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
  };
  if (!onPress) return <View testID={testID} style={[base, style]}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [base, { opacity: pressed ? 0.8 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone = "muted", icon: IconC }: { label: string; tone?: "muted" | "primary" | "success" | "warning" | "danger"; icon?: Icon }) {
  const { c, a } = useTheme();
  const color = tone === "muted" ? c.mutedForeground : c[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: tone === "muted" ? c.surface2 : a(tone, 0.14), alignSelf: "flex-start" }}>
      {IconC ? <IconC size={12} color={color} /> : null}
      <Text numberOfLines={1} style={{ color, fontSize: 11, fontFamily: FONT.medium }}>
        {label}
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

export function Row({ children, gap = 8, style, center = true, testID }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; center?: boolean; testID?: string }) {
  return <View testID={testID} style={[{ flexDirection: "row", alignItems: center ? "center" : "flex-start", gap }, style]}>{children}</View>;
}

export function ListRow({
  icon: IconC,
  title,
  subtitle,
  right,
  onPress,
  danger,
  testID,
}: {
  icon?: Icon;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
}) {
  const { c, a } = useTheme();
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? a("foreground", 0.05) : "transparent" })}
    >
      {IconC ? (
        <View style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: danger ? a("danger", 0.12) : c.surface2, alignItems: "center", justifyContent: "center" }}>
          <IconC size={17} color={danger ? c.danger : c.foreground} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="h3" numberOfLines={1} style={danger ? { color: c.danger } : undefined}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 10 }, style]}>
      {title || action ? (
        <Row style={{ justifyContent: "space-between", paddingHorizontal: 2 }}>
          {title ? <T variant="label">{title}</T> : <View />}
          {action}
        </Row>
      ) : null}
      {children}
    </View>
  );
}

/* ───────────────────────── Inputs ───────────────────────── */

export function Field({ label, hint, error, style, inputStyle, mono, ...rest }: TextInputProps & { label?: string; hint?: string; error?: string | null; mono?: boolean; inputStyle?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style as ViewStyle]}>
      {label ? <T variant="small" weight="medium" color="foreground">{label}</T> : null}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[
          {
            minHeight: 44,
            borderWidth: 1,
            borderColor: error ? c.danger : focus ? c.ring : c.border,
            borderRadius: RADIUS.md,
            paddingHorizontal: 12,
            paddingVertical: rest.multiline ? 10 : 0,
            backgroundColor: c.background,
            color: c.foreground,
            fontFamily: mono ? FONT.mono : FONT.regular,
            fontSize: 15,
            textAlignVertical: rest.multiline ? "top" : "center",
          },
          inputStyle,
        ]}
      />
      {error ? <T variant="small" color="danger">{error}</T> : hint ? <T variant="tiny">{hint}</T> : null}
    </View>
  );
}

export function Switch({ value, onValueChange, disabled, label, testID }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; label?: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <RNSwitch
      testID={testID}
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        haptic.tap();
        onValueChange(v);
      }}
      trackColor={{ false: c.surface2, true: c.primary }}
      thumbColor={Platform.OS === "android" ? (value ? c.primaryForeground : c.mutedForeground) : undefined}
      ios_backgroundColor={c.surface2}
    />
  );
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string; icon?: Icon }[]; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.surface2, borderRadius: RADIUS.md, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={{ flex: 1, height: 34, borderRadius: RADIUS.sm, backgroundColor: on ? c.background : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {o.icon ? <o.icon size={14} color={on ? c.foreground : c.mutedForeground} /> : null}
            <Text style={{ fontFamily: on ? FONT.semibold : FONT.medium, fontSize: 13, color: on ? c.foreground : c.mutedForeground }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, icon: IconC }: { label: string; active?: boolean; onPress?: () => void; icon?: Icon }) {
  const { c, a } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: active ? a("primary", 0.5) : c.border, backgroundColor: active ? a("primary", 0.12) : c.surface }}
    >
      {IconC ? <IconC size={14} color={active ? c.primary : c.mutedForeground} /> : null}
      <Text style={{ fontSize: 13, fontFamily: FONT.medium, color: active ? c.primary : c.foreground }}>{label}</Text>
    </Pressable>
  );
}

/* ───────────────────────── States ───────────────────────── */

export function Spinner({ label = "Loading" }: { label?: string }) {
  const { c } = useTheme();
  return (
    <Row style={{ justifyContent: "center", paddingVertical: 16 }}>
      <ActivityIndicator size="small" color={c.mutedForeground} />
      <T variant="small">{label}</T>
    </Row>
  );
}

export function EmptyState({ icon: IconC, title, children, action }: { icon?: Icon; title: string; children?: ReactNode; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 36 }}>
      {IconC ? (
        <View style={{ width: 46, height: 46, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <IconC size={20} color={c.mutedForeground} />
        </View>
      ) : null}
      <T variant="h3" style={{ textAlign: "center" }}>{title}</T>
      {children ? (
        typeof children === "string" ? (
          <T variant="small" style={{ textAlign: "center", marginTop: 4, maxWidth: 300 }}>{children}</T>
        ) : (
          <View style={{ marginTop: 4, maxWidth: 320 }}>{children}</View>
        )
      ) : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, style }: { error: unknown; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const { c, a } = useTheme();
  const { title, hint, code, requestId } = describeError(error);
  return (
    <View accessibilityRole="alert" style={[{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: a("danger", 0.3), backgroundColor: a("danger", 0.05), padding: 16 }, style]}>
      <Row center={false} gap={12}>
        <AlertTriangle size={20} color={c.danger} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="small" style={{ marginTop: 4 }}>{hint}</T>
          <T variant="monoSmall" style={{ marginTop: 8, textTransform: "uppercase" }}>
            {code}
            {requestId ? ` · ref ${requestId}` : ""}
          </T>
        </View>
      </Row>
      {onRetry ? <Btn label="Try again" icon={RotateCw} variant="secondary" size="sm" full onPress={onRetry} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: RADIUS.sm, backgroundColor: c.surface2, opacity: v }, style]} />;
}

export function Avatar({ uri, size = 32 }: { uri?: string | null; size?: number }) {
  const { c } = useTheme();
  return <Image source={uri ? { uri } : undefined} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }} />;
}

/* ───────────────────────── Screen chrome ───────────────────────── */

export function Screen({ children, scroll = true, padded = true, refresh, contentStyle, testID }: { children: ReactNode; scroll?: boolean; padded?: boolean; refresh?: ReactNode; contentStyle?: StyleProp<ViewStyle>; testID?: string }) {
  const { c } = useTheme();
  const inner = [{ padding: padded ? 16 : 0, gap: 16, paddingBottom: 32 }, contentStyle];
  if (!scroll) return <View testID={testID} style={[{ flex: 1, backgroundColor: c.background }, ...inner]}>{children}</View>;
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={refresh as never}
    >
      {children}
    </ScrollView>
  );
}

export function Header({ title, subtitle, back, right, large }: { title: string; subtitle?: string; back?: boolean | (() => void); right?: ReactNode; large?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.background, borderBottomWidth: large ? 0 : 1, borderBottomColor: c.border }}>
      <Row style={{ minHeight: 52, paddingHorizontal: back ? 6 : 16, paddingRight: 8 }} gap={4}>
        {back ? <IconBtn icon={ChevronLeft} label="Back" onPress={typeof back === "function" ? back : () => (router.canGoBack() ? router.back() : router.replace("/home"))} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant={large ? "title" : "h2"} numberOfLines={1}>{title}</T>
          {subtitle ? <T variant="small" numberOfLines={1}>{subtitle}</T> : null}
        </View>
        {right ? <Row gap={2}>{right}</Row> : null}
      </Row>
    </View>
  );
}

/* ───────────────────────── Sheets & dialogs ───────────────────────── */

export function Sheet({ open, onClose, title, description, children, footer, full, scroll = true }: { open: boolean; onClose: () => void; title?: string; description?: string; children: ReactNode; footer?: ReactNode; full?: boolean; scroll?: boolean }) {
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: a("background", 0.6) }} />
        <View
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            borderWidth: 1,
            borderColor: c.border,
            maxHeight: full ? "94%" : "88%",
            minHeight: full ? "94%" : undefined,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.border }} />
          </View>
          {title ? (
            <Row style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <T variant="h2">{title}</T>
                {description ? <T variant="small" style={{ marginTop: 2 }}>{description}</T> : null}
              </View>
              <IconBtn icon={X} label="Close" onPress={onClose} size={36} />
            </Row>
          ) : null}
          {scroll ? (
            <ScrollView style={{ flexGrow: full ? 1 : 0 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: full ? 1 : undefined, padding: 16, gap: 12 }}>{children}</View>
          )}
          {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 8 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ConfirmSheet({ open, title, description, confirmLabel = "Confirm", danger, onConfirm, onClose, busy }: { open: boolean; title: string; description?: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Row>
          <Btn label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Btn label={confirmLabel} variant={danger ? "danger" : "primary"} onPress={onConfirm} loading={busy} style={{ flex: 1 }} />
        </Row>
      }
    >
      {typeof description === "string" ? <T variant="small">{description}</T> : description}
    </Sheet>
  );
}

export function PromptSheet({
  open,
  title,
  label,
  initial = "",
  placeholder,
  confirmLabel = "Save",
  validate,
  onSubmit,
  onClose,
  mono = true,
}: {
  open: boolean;
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (v: string) => string | null;
  onSubmit: (v: string) => void;
  onClose: () => void;
  mono?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setValue(initial);
      setErr(null);
    }
  }, [open, initial]);
  const submit = () => {
    const e = validate?.(value.trim()) ?? null;
    if (e) return setErr(e);
    onSubmit(value.trim());
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Row>
          <Btn label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Btn label={confirmLabel} onPress={submit} style={{ flex: 1 }} />
        </Row>
      }
    >
      <Field label={label} value={value} onChangeText={(v) => (setValue(v), setErr(null))} placeholder={placeholder} autoFocus mono={mono} error={err} onSubmitEditing={submit} returnKeyType="done" />
    </Sheet>
  );
}

/* ───────────────────────── Toasts ───────────────────────── */

type ToastMsg = { id: number; text: string; tone: "default" | "success" | "danger" };
let toasts: ToastMsg[] = [];
const toastListeners = new Set<(t: ToastMsg[]) => void>();
let toastSeq = 0;
export function toast(text: string, tone: ToastMsg["tone"] = "default") {
  const t = { id: ++toastSeq, text, tone };
  toasts = [...toasts.slice(-2), t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, 2800);
}

export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    toastListeners.add(setList);
    return () => void toastListeners.delete(setList);
  }, []);
  if (!list.length) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 80, gap: 8, alignItems: "center" }}>
      {list.map((t) => (
        <View key={t.id} style={{ backgroundColor: t.tone === "danger" ? c.danger : c.foreground, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg, maxWidth: 420 }}>
          <Text style={{ color: t.tone === "danger" ? "#fff" : c.background, fontFamily: FONT.medium, fontSize: 14 }}>{t.text}</Text>
        </View>
      ))}
    </View>
  );
}

export type { PressableProps };
