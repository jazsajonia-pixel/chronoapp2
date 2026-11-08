import { useMemo, useState } from "react";
import { Share, View } from "react-native";
import { BookMarked, Download, Pencil, Plus, Search, Trash2 } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { useKnowledge } from "@/features/knowledge/store";
import { KNOWLEDGE_LIMITS, KnowledgeError, scopeLabel, searchNotes, toMarkdown, type KnowledgeNote, type KnowledgeScope } from "@/lib/knowledge";
import { Badge, Btn, ConfirmSheet, Divider, EmptyState, Field, Header, IconBtn, Row, Screen, Section, Segmented, Sheet, Switch, T, toast } from "@/ui/kit";
import { FONT, useTheme } from "@/ui/theme";

/**
 * Knowledge: facts and preferences the agent remembers between chats.
 * Stored only on this device, per GitHub account. Each chat sends just the notes that match it.
 */
export default function KnowledgeScreen() {
  const { session } = useSession();
  const userId = session.mode === "github" ? session.user.id : null;
  const login = session.mode === "github" ? session.user.login : "you";
  const kb = useKnowledge(userId);
  const { c } = useTheme();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<KnowledgeNote | "new" | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeNote | null>(null);

  const shown = useMemo(() => (query.trim() ? searchNotes(kb.notes, query, KNOWLEDGE_LIMITS.notes) : kb.notes), [kb.notes, query]);
  const groups = useMemo(() => {
    const m = new Map<KnowledgeScope, KnowledgeNote[]>();
    for (const n of shown) m.set(n.scope, [...(m.get(n.scope) ?? []), n]);
    // "All projects" first, then repositories alphabetically.
    return [...m.entries()].sort(([a], [b]) => (a === "global" ? -1 : b === "global" ? 1 : a.localeCompare(b)));
  }, [shown]);
  const projectScopes = useMemo(() => [...new Set(kb.notes.map((n) => n.scope).filter((s) => s !== "global"))], [kb.notes]);

  const exportAll = () => {
    if (!kb.notes.length) return;
    void Share.share({ message: toMarkdown(kb.notes, login), title: "Chrono knowledge" }).catch(() => undefined);
  };
  const list = { marginHorizontal: -16 };

  if (userId === null) {
    return (
      <>
        <Header title="Knowledge" back />
        <Screen>
          <EmptyState icon={BookMarked} title="Sign in to use knowledge">
            <T variant="small">Notes are saved on this device for your GitHub account.</T>
          </EmptyState>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Header title="Knowledge" back right={<Btn label="Add note" icon={Plus} size="sm" onPress={() => setEditing("new")} disabled={kb.notes.length >= KNOWLEDGE_LIMITS.notes} testID="button-add-note" />} />
      <Screen testID="screen-knowledge">
        <T variant="small" style={{ fontSize: 14 }}>
          What the agent remembers between chats: your preferences, project decisions and lessons learned. Saved only on this device for @{login}. Each chat sends just the notes that match it.
        </T>

        <View style={list}>
          <Row gap={14} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 15, fontFamily: FONT.medium }}>Use in chats</T>
              <T variant="small">Relevant notes are added to agent requests.</T>
            </View>
            <Switch value={kb.settings.enabled} onValueChange={(v) => kb.updateSettings({ ...kb.settings, enabled: v })} label="Use knowledge in chats" testID="switch-knowledge-enabled" />
          </Row>
          <Divider style={{ marginLeft: 16 }} />
          <Row gap={14} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 15, fontFamily: FONT.medium, opacity: kb.settings.enabled ? 1 : 0.5 }}>Save automatically</T>
              <T variant="small">The agent saves new notes itself. Each save shows in the chat with Undo.</T>
            </View>
            <Switch value={kb.settings.enabled && kb.settings.autoSave} disabled={!kb.settings.enabled} onValueChange={(v) => kb.updateSettings({ ...kb.settings, autoSave: v })} label="Save knowledge automatically" testID="switch-knowledge-autosave" />
          </Row>
        </View>

        {kb.notes.length ? (
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <Field label="" value={query} onChangeText={setQuery} placeholder={`Search ${kb.notes.length} note${kb.notes.length === 1 ? "" : "s"}`} autoCapitalize="none" testID="input-knowledge-search" accessibilityLabel="Search knowledge" />
            </View>
            <IconBtn icon={Download} label="Export as Markdown" size={44} onPress={exportAll} testID="button-export-knowledge" />
          </Row>
        ) : null}

        {kb.notes.length === 0 ? (
          <View testID="empty-knowledge" style={{ paddingVertical: 8, gap: 8, alignItems: "flex-start" }}>
            <T variant="small">
              No notes yet. {kb.settings.enabled && kb.settings.autoSave ? "The agent adds them as you work, or you can write one — e.g. \"Use pnpm, not npm\" or \"API errors return { error: { code, message } }\"." : "Write one — e.g. \"Use pnpm, not npm\"."}
            </T>
            <Btn label="Write a note" icon={Plus} size="sm" variant="secondary" onPress={() => setEditing("new")} testID="button-add-first-note" />
          </View>
        ) : shown.length === 0 ? (
          <Row gap={6}>
            <Search size={14} color={c.mutedForeground} />
            <T variant="small">No notes match "{query.trim()}".</T>
          </Row>
        ) : (
          groups.map(([scope, notes]) => (
            <Section key={scope} title={`${scopeLabel(scope)} · ${notes.length}`}>
              <View style={list} testID={`list-knowledge-${scope}`}>
                {notes.map((n, i) => (
                  <View key={n.id} testID={`row-note-${n.id}`}>
                    {i ? <Divider style={{ marginLeft: 16 }} /> : null}
                    <Row gap={4} style={{ paddingVertical: 10, paddingLeft: 16, paddingRight: 12, minHeight: 56 }}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Row gap={6}>
                          <T numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, lineHeight: 21, fontFamily: FONT.medium }}>{n.title}</T>
                          {n.source === "agent" ? <Badge label="agent" /> : null}
                        </Row>
                        <T variant="small" numberOfLines={3}>{n.body}</T>
                      </View>
                      <IconBtn icon={Pencil} label={`Edit ${n.title}`} size={44} onPress={() => setEditing(n)} testID={`button-edit-note-${n.id}`} />
                      <IconBtn icon={Trash2} label={`Delete ${n.title}`} size={44} onPress={() => setDeleting(n)} testID={`button-delete-note-${n.id}`} />
                    </Row>
                  </View>
                ))}
              </View>
            </Section>
          ))
        )}
      </Screen>

      <NoteEditor
        open={editing !== null}
        note={editing === "new" ? null : editing}
        projectScopes={projectScopes}
        onClose={() => setEditing(null)}
        onSubmit={(draft) => {
          const store = kb.store();
          if (!store) return "Sign in first.";
          try {
            const target = editing && editing !== "new" ? editing : null;
            store.save({ id: target?.id, ...draft, source: target?.source ?? "you" });
            toast(target ? `Saved "${draft.title}"` : `Added "${draft.title}"`, "success");
            setEditing(null);
            return null;
          } catch (err) {
            return err instanceof KnowledgeError ? err.message : "Couldn't save this note.";
          }
        }}
      />
      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="The agent will no longer see this note. This can't be undone."
        confirmLabel="Delete note"
        danger
        onConfirm={() => {
          const d = deleting;
          setDeleting(null);
          if (d) {
            kb.store()?.remove(d.id);
            toast(`Deleted "${d.title}"`);
          }
        }}
      />
    </>
  );
}

type Draft = { title: string; body: string; scope: KnowledgeScope };

function NoteEditor({ open, note, projectScopes, onClose, onSubmit }: { open: boolean; note: KnowledgeNote | null; projectScopes: KnowledgeScope[]; onClose: () => void; onSubmit: (d: Draft) => string | null }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"global" | "repo">("global");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  // Refill whenever the sheet opens or switches note (during render, not in an effect).
  const [filledFor, setFilledFor] = useState<{ open: boolean; note: KnowledgeNote | null }>({ open: false, note: null });
  if (filledFor.open !== open || filledFor.note !== note) {
    setFilledFor({ open, note });
    if (open) {
      setTitle(note?.title ?? "");
      setBody(note?.body ?? "");
      const isRepo = !!note && note.scope !== "global";
      setKind(isRepo ? "repo" : "global");
      setRepo(isRepo ? note.scope.slice("project:".length) : (projectScopes[0]?.slice("project:".length) ?? ""));
      setError(null);
      setTouched(false);
    }
  }
  const repoOk = /^[\w.-]+\/[\w.-]+$/.test(repo.trim());
  const titleErr = !title.trim() ? "Give the note a title." : null;
  const bodyErr = !body.trim() ? "Write what the agent should remember." : null;
  const repoErr = kind === "repo" && !repoOk ? "Use owner/repo, e.g. octocat/notes-api." : null;
  const submit = () => {
    setTouched(true);
    if (titleErr || bodyErr || repoErr) return;
    const scope: KnowledgeScope = kind === "global" ? "global" : `project:${repo.trim().toLowerCase()}`;
    setError(onSubmit({ title, body, scope }));
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={note ? "Edit note" : "New note"}
      description="Something the agent should remember. Don't put passwords or keys here — they're rejected."
      footer={
        <Row>
          <Btn label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Btn label={note ? "Save changes" : "Add note"} onPress={submit} style={{ flex: 1 }} testID="button-save-note" />
        </Row>
      }
    >
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: "global", label: "All projects" },
          { value: "repo", label: "One repository" },
        ]}
      />
      {kind === "repo" ? <Field label="Repository" value={repo} onChangeText={setRepo} placeholder="owner/repo" autoCapitalize="none" autoCorrect={false} mono error={touched ? repoErr : null} testID="input-note-repo" /> : null}
      <Field label={`Title  ·  ${title.length}/${KNOWLEDGE_LIMITS.title}`} value={title} maxLength={KNOWLEDGE_LIMITS.title} onChangeText={setTitle} placeholder="e.g. Package manager" error={touched ? titleErr : null} autoCapitalize="sentences" testID="input-note-title" />
      <Field
        label={`Note  ·  ${body.length}/${KNOWLEDGE_LIMITS.body}`}
        value={body}
        maxLength={KNOWLEDGE_LIMITS.body}
        onChangeText={setBody}
        multiline
        inputStyle={{ minHeight: 130 }}
        placeholder="e.g. Use pnpm, not npm. Lockfile is pnpm-lock.yaml."
        error={touched ? bodyErr : null}
        autoCapitalize="sentences"
        autoCorrect
        testID="input-note-body"
      />
      {error ? <T variant="small" color="danger" testID="text-note-error">{error}</T> : null}
    </Sheet>
  );
}

// A crash here stays on this screen (Try again / Go home) instead of taking down the app.
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/error-boundary";
