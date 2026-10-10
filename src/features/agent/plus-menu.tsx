import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, FileText, ImageIcon, Plus, WandSparkles } from "lucide-react-native";
import { AppError, describeError } from "@/lib/errors";
import { useSkills } from "@/features/skills/use-skills";
import { Badge, Row, Sheet, Switch, T, haptic } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

type View_ = "menu" | "skills";

function Item({ icon: Icon, title, subtitle, onPress, chevron, testID }: { icon: typeof Plus; title: string; subtitle: string; onPress: () => void; chevron?: boolean; testID: string }) {
  const { c, a } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 12, borderRadius: RADIUS.lg, backgroundColor: pressed ? c.surface2 : "transparent" })}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: a("primary", 0.12) }}>
        <Icon size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="medium">{title}</T>
        <T variant="tiny">{subtitle}</T>
      </View>
      {chevron ? <ChevronRight size={17} color={c.mutedForeground} /> : null}
    </Pressable>
  );
}

/**
 * The composer's "+" button: rotates into an ×, and opens chat tools — Skills / Add photos /
 * Add files. "Skills" swaps the menu for the skills list (toggle on/off, or add new).
 */
export function PlusMenu({ onAddPhotos, onAddFiles, disabled }: { onAddPhotos: () => void; onAddFiles: () => void; disabled?: boolean }) {
  const { c, a } = useTheme();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View_>("menu");
  const skills = useSkills();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const enabledCount = skills.all.filter((s) => skills.enabled.includes(s.id)).length;
  // Pickers can't present while the sheet is still animating away (iOS).
  const after = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 450);
  };
  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tap();
          setView("menu");
          setToggleError(null);
          setOpen((o) => !o);
        }}
        disabled={disabled}
        accessibilityState={{ expanded: open, disabled }}
        accessibilityLabel={open ? "Close chat tools" : "More chat tools"}
        testID="button-chat-plus"
        style={{ width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: open ? a("primary", 0.5) : c.border, backgroundColor: open ? a("primary", 0.1) : "transparent", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}
      >
        <View style={{ transform: [{ rotate: open ? "45deg" : "0deg" }] }}>
          <Plus size={17} color={open ? c.primary : c.mutedForeground} />
        </View>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={view === "menu" ? "Chat tools" : undefined}>
        {view === "menu" ? (
          <View testID="chat-tools-menu">
            <Item icon={WandSparkles} title="Skills" subtitle={`${enabledCount} enabled`} chevron onPress={() => setView("skills")} testID="button-chat-skills" />
            <Item icon={ImageIcon} title="Add photos" subtitle="Screenshots or images, up to 2 MB each" onPress={() => after(onAddPhotos)} testID="button-agent-upload-photo" />
            <Item icon={FileText} title="Add files" subtitle="Text or code files, up to 2 MB each" onPress={() => after(onAddFiles)} testID="button-agent-upload" />
          </View>
        ) : (
          <View testID="chat-skills-list" style={{ gap: 8 }}>
            <Row gap={6}>
              <Pressable onPress={() => setView("menu")} accessibilityLabel="Back to chat tools" testID="button-skills-back" hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={20} color={c.foreground} />
              </Pressable>
              <T variant="h3" style={{ flex: 1 }}>Skills</T>
              {skills.saving || skills.status === "loading" ? <ActivityIndicator size="small" color={c.primary} accessibilityLabel="Syncing" /> : null}
            </Row>
            <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
              {skills.all.map((s, i) => {
                const on = skills.enabled.includes(s.id);
                return (
                  <Row key={s.id} gap={10} style={{ minHeight: 52, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <T weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{s.name}</T>
                      {s.id.startsWith("u_") ? <Badge label="Custom" /> : null}
                    </View>
                    <Switch
                      value={on}
                      label={s.name}
                      testID={`skill-toggle-${s.id}`}
                      onValueChange={() => {
                        setToggleError(null);
                        skills.toggle(s.id).catch((e: unknown) => setToggleError(e instanceof AppError ? e.message || describeError(e).title : "Couldn't save."));
                      }}
                    />
                  </Row>
                );
              })}
            </View>
            {toggleError ? <T variant="small" color="danger" accessibilityRole="alert">{toggleError}</T> : null}
            <Pressable
              onPress={() => {
                setOpen(false);
                router.push("/skills");
              }}
              testID="link-add-skills"
              style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", minHeight: 44 }}
            >
              <Plus size={15} color={c.primary} />
              <T variant="small" color="primary" weight="semibold">Add skills</T>
            </Pressable>
          </View>
        )}
      </Sheet>
    </>
  );
}
