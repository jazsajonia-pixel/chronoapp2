import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Globe, Lock } from "lucide-react-native";
import { AppError, describeError } from "@/lib/errors";
import { githubApi } from "./api";
import type { RepoSummary } from "@/types/github";
import { Btn, Field, Row, Sheet, Switch, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const NAME_RE = /^[A-Za-z0-9._-]+$/;

/** Client-side mirror of the server's name rules, for instant feedback. */
export function repoNameError(raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  if (name.length > 100) return "Repository names can be at most 100 characters.";
  if (!NAME_RE.test(name)) return "Use only letters, numbers, '-', '_' and '.'.";
  if (name === "." || name === "..") return "That name isn't allowed.";
  return null;
}

/** GitHub turns spaces etc. into dashes — do the same so what you see is what you get. */
const normalize = (raw: string) => raw.replace(/\s+/g, "-");

export function NewRepoSheet({ open, onOpenChange, owner, canCreatePrivate, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; owner: string; canCreatePrivate: boolean; onCreated: (repo: RepoSummary) => void }) {
  const { c, a } = useTheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [readme, setReadme] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setVisibility("public");
      setReadme(true);
      setError(null);
    }
  }, [open]);
  const nameErr = repoNameError(name);

  async function submit() {
    if (!name.trim() || nameErr) return;
    setBusy(true);
    setError(null);
    try {
      const repo = await githubApi.createRepo({ name: name.trim(), description: description.trim() || undefined, private: visibility === "private", autoInit: readme });
      onOpenChange(false);
      onCreated(repo);
    } catch (e) {
      setError(e instanceof AppError ? e.message || describeError(e).title : "Couldn't create the repository.");
    } finally {
      setBusy(false);
    }
  }

  const vis = (v: "public" | "private", Icon: typeof Globe, label: string, hint: string, disabled?: boolean) => {
    const on = visibility === v;
    return (
      <Pressable
        disabled={disabled}
        onPress={() => setVisibility(v)}
        testID={`option-${v}`}
        style={{ flex: 1, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, borderColor: on ? c.primary : c.border, backgroundColor: on ? a("primary", 0.08) : c.background, opacity: disabled ? 0.5 : 1 }}
      >
        <Row gap={6}>
          <Icon size={15} color={on ? c.primary : c.foreground} />
          <T variant="h3" style={{ fontSize: 14 }}>{label}</T>
        </Row>
        <T variant="tiny" style={{ marginTop: 4 }}>{hint}</T>
      </Pressable>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={() => !busy && onOpenChange(false)}
      title="New repository"
      description={`Creates an empty repository on GitHub under ${owner}.`}
      footer={<Btn label={busy ? "Creating…" : "Create repository"} loading={busy} disabled={!name.trim() || !!nameErr} onPress={() => void submit()} full testID="button-create-repo" />}
    >
      <View style={{ gap: 6 }}>
        <T variant="small" weight="medium" color="foreground">Name</T>
        <View style={{ flexDirection: "row", alignItems: "center", height: 44, borderWidth: 1, borderRadius: RADIUS.md, borderColor: nameErr ? c.danger : c.border, backgroundColor: c.background }}>
          <T variant="mono" color="mutedForeground" numberOfLines={1} style={{ paddingLeft: 12, maxWidth: "45%" }}>{owner}/</T>
          <Field
            value={name}
            onChangeText={(v) => setName(normalize(v))}
            placeholder="my-new-app"
            autoFocus
            maxLength={100}
            style={{ flex: 1 }}
            inputStyle={{ borderWidth: 0, backgroundColor: "transparent", paddingLeft: 2, fontFamily: FONT.mono }}
            testID="input-repo-name"
            onSubmitEditing={() => void submit()}
          />
        </View>
        {nameErr ? <T variant="small" color="danger">{nameErr}</T> : null}
      </View>
      <Field label="Description (optional)" value={description} onChangeText={setDescription} placeholder="What is this project about?" maxLength={350} testID="input-repo-description" />
      <View style={{ gap: 6 }}>
        <T variant="small" weight="medium" color="foreground">Visibility</T>
        <Row center={false}>
          {vis("public", Globe, "Public", "Anyone can see it.")}
          {vis("private", Lock, "Private", canCreatePrivate ? "Only you and collaborators." : "Sign in with private access first.", !canCreatePrivate)}
        </Row>
      </View>
      <Row style={{ justifyContent: "space-between", borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: 12 }}>
        <View style={{ flex: 1 }}>
          <T variant="h3" style={{ fontSize: 14 }}>Add a README</T>
          <T variant="tiny">Starts the repo with a first commit so you can open it right away.</T>
        </View>
        <Switch value={readme} onValueChange={setReadme} label="Add a README" />
      </Row>
      {error ? <T variant="small" color="danger" accessibilityRole="alert">{error}</T> : null}
    </Sheet>
  );
}
