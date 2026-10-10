import { useEffect, useState } from "react";
import { View } from "react-native";
import { Cloud, HardDrive, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react-native";
import { useSkills, type SkillDraft } from "@/features/skills/use-skills";
import { BUILTIN_SKILLS, SKILL_LIMITS, cleanSkillText, type UserSkill } from "@/lib/skills";
import { describeError } from "@/lib/errors";
import { Btn, ConfirmSheet, Divider, ErrorState, Field, Header, IconBtn, Row, Screen, Section, Sheet, Skeleton, Switch, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

/**
 * Skills: reusable guidance added to the agent's instructions.
 * Built-ins can be switched on/off; custom skills are synced to the account (Neon database).
 */
export default function SkillsScreen() {
  const skills = useSkills();
  const { c, a } = useTheme();
  const [editing, setEditing] = useState<UserSkill | "new" | null>(null);
  const [deleting, setDeleting] = useState<UserSkill | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const atLimit = skills.custom.length >= SKILL_LIMITS.maxCustom;

  useEffect(() => {
    if (!status || status.tone === "error") return;
    const t = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      setStatus({ tone: "ok", text: ok });
      return true;
    } catch (err) {
      const d = describeError(err);
      setStatus({ tone: "error", text: `${d.title}. ${d.hint}` });
      return false;
    }
  };
  const toggle = (id: string, name: string, on: boolean) => void run(skills.toggle(id), `${name} ${on ? "enabled" : "disabled"}`);
  const list = { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" as const };

  return (
    <>
      <Header title="Skills" large right={<Btn label="Add skill" icon={Plus} size="sm" onPress={() => setEditing("new")} disabled={atLimit} testID="button-add-skill" />} />
      <Screen>
        <T variant="small" style={{ fontSize: 14 }}>
          Reusable guidance Chrono adds to every AI request. Enabled skills shape how the agent works — they never change what it's allowed to do.
        </T>
        {status ? (
          <View accessibilityLiveRegion="polite" testID={status.tone === "ok" ? "text-skills-saved" : "text-skills-error"} style={{ borderRadius: RADIUS.md, padding: 10, borderWidth: 1, borderColor: status.tone === "ok" ? a("success", 0.3) : a("danger", 0.3), backgroundColor: status.tone === "ok" ? a("success", 0.08) : a("danger", 0.08) }}>
            <T variant="small" color={status.tone === "ok" ? "success" : "danger"}>{status.text}</T>
          </View>
        ) : null}

        <Section title="Built-in">
          <View style={list} testID="list-builtin-skills">
            {BUILTIN_SKILLS.map((s, i) => {
              const on = skills.enabled.includes(s.id);
              return (
                <View key={s.id}>
                  {i ? <Divider /> : null}
                  <Row gap={12} style={{ padding: 14 }} center={false}>
                    <View style={{ width: 32, height: 32, borderRadius: RADIUS.md, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
                      <Sparkles size={15} color={c.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="h3" style={{ fontSize: 14 }}>{s.name}</T>
                      <T variant="small">{s.description}</T>
                    </View>
                    <Switch value={on} onValueChange={(next) => toggle(s.id, s.name, next)} label={`${s.name} skill`} />
                  </Row>
                </View>
              );
            })}
          </View>
        </Section>

        <Section
          title={`Your skills ${skills.custom.length}/${SKILL_LIMITS.maxCustom}`}
          action={
            skills.storage ? (
              <Row gap={4} testID="text-skills-storage">
                {skills.storage === "database" ? <Cloud size={12} color={c.mutedForeground} /> : <HardDrive size={12} color={c.mutedForeground} />}
                <T variant="tiny">{skills.storage === "database" ? "Synced to your account" : "Saved for this sign-in only"}</T>
              </Row>
            ) : null
          }
        >
          {skills.status === "loading" && skills.custom.length === 0 ? (
            <View style={{ gap: 8 }} accessibilityLabel="Loading your skills">
              <Skeleton height={56} />
              <Skeleton height={56} />
            </View>
          ) : skills.status === "error" && skills.custom.length === 0 ? (
            <ErrorState error={skills.error} onRetry={() => void skills.reload()} />
          ) : skills.custom.length === 0 ? (
            <View testID="empty-custom-skills" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, padding: 20, alignItems: "center", gap: 6 }}>
              <Wand2 size={24} color={c.mutedForeground} />
              <T variant="h3">No custom skills yet</T>
              <T variant="small" style={{ textAlign: "center" }}>Write your own — e.g. "Use our design tokens", "Prefer Zod for validation", or your team's commit style.</T>
              <Btn label="Write a skill" icon={Plus} size="sm" onPress={() => setEditing("new")} style={{ marginTop: 6 }} testID="button-add-first-skill" />
            </View>
          ) : (
            <View style={list} testID="list-custom-skills">
              {skills.custom.map((s, i) => {
                const on = skills.enabled.includes(s.id);
                return (
                  <View key={s.id} testID={`row-skill-${s.id}`}>
                    {i ? <Divider /> : null}
                    <Row gap={4} style={{ paddingVertical: 10, paddingLeft: 14, paddingRight: 10 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T variant="h3" numberOfLines={1} style={{ fontSize: 14 }}>{s.name}</T>
                        <T variant="small" numberOfLines={2}>{s.description || s.instructions}</T>
                      </View>
                      <IconBtn icon={Pencil} label={`Edit ${s.name}`} size={36} onPress={() => setEditing(s)} testID={`button-edit-skill-${s.id}`} />
                      <IconBtn icon={Trash2} label={`Delete ${s.name}`} size={36} color="danger" onPress={() => setDeleting(s)} testID={`button-delete-skill-${s.id}`} />
                      <Switch value={on} onValueChange={(next) => toggle(s.id, s.name, next)} label={`${s.name} skill`} />
                    </Row>
                  </View>
                );
              })}
            </View>
          )}
          {atLimit ? <T variant="tiny">You've reached the limit of {SKILL_LIMITS.maxCustom} custom skills. Delete one to add another.</T> : null}
        </Section>
      </Screen>

      <SkillEditor
        open={editing !== null}
        skill={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSubmit={async (draft) => {
          const target = editing;
          const isEdit = !!target && target !== "new";
          const ok = await run(isEdit ? skills.update((target as UserSkill).id, draft) : skills.create(draft), isEdit ? `Saved "${draft.name}"` : `Added "${draft.name}"`);
          if (ok) setEditing(null);
          return ok;
        }}
      />
      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="The agent will stop using it. This can't be undone."
        confirmLabel="Delete skill"
        danger
        onConfirm={() => {
          const d = deleting;
          setDeleting(null);
          if (d) void run(skills.remove(d.id), `Deleted "${d.name}"`);
        }}
      />
    </>
  );
}

function SkillEditor({ open, skill, onClose, onSubmit }: { open: boolean; skill: UserSkill | null; onClose: () => void; onSubmit: (draft: SkillDraft) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(skill?.name ?? "");
    setDescription(skill?.description ?? "");
    setInstructions(skill?.instructions ?? "");
    setTouched(false);
    setBusy(false);
  }, [open, skill]);
  const nameErr = !name.trim() ? "Give the skill a name." : null;
  const instrErr = !instructions.trim() ? "Write what the agent should do." : null;
  const submit = async () => {
    setTouched(true);
    if (nameErr || instrErr) return;
    setBusy(true);
    const ok = await onSubmit({
      name: cleanSkillText(name, SKILL_LIMITS.name),
      description: cleanSkillText(description, SKILL_LIMITS.description),
      instructions: cleanSkillText(instructions, SKILL_LIMITS.instructions),
    });
    if (!ok) setBusy(false);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={skill ? "Edit skill" : "New skill"}
      description="Plain-language guidance the agent follows in every chat."
      footer={
        <Row>
          <Btn label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Btn label={busy ? "Saving…" : skill ? "Save changes" : "Add skill"} disabled={busy} onPress={() => void submit()} style={{ flex: 1 }} testID="button-save-skill" />
        </Row>
      }
    >
      <Field label={`Name  ·  ${name.length}/${SKILL_LIMITS.name}`} value={name} maxLength={SKILL_LIMITS.name} onChangeText={setName} placeholder="e.g. Our API conventions" error={touched ? nameErr : null} autoCapitalize="sentences" testID="input-skill-name" />
      <Field label={`Short description (optional)  ·  ${description.length}/${SKILL_LIMITS.description}`} value={description} maxLength={SKILL_LIMITS.description} onChangeText={setDescription} placeholder="Shown in the skills list" autoCapitalize="sentences" testID="input-skill-description" />
      <Field
        label={`Instructions  ·  ${instructions.length}/${SKILL_LIMITS.instructions}`}
        value={instructions}
        maxLength={SKILL_LIMITS.instructions}
        onChangeText={setInstructions}
        multiline
        inputStyle={{ minHeight: 150 }}
        placeholder="e.g. Validate request bodies with Zod. Return errors as { error: { code, message } }. Never log tokens."
        error={touched ? instrErr : null}
        autoCapitalize="sentences"
        autoCorrect
        testID="input-skill-instructions"
      />
    </Sheet>
  );
}
