import { useState } from "react";
import { View } from "react-native";
import { KeyRound, Plus } from "lucide-react-native";
import { deleteProvider } from "@/features/ai/api";
import { ProviderCard } from "@/features/ai/provider-card";
import { ProviderForm } from "@/features/ai/provider-form";
import { StorageNotice } from "@/features/ai/storage-notice";
import { useProviders } from "@/features/ai/use-providers";
import type { PublicProvider } from "@/types/ai";
import { Btn, ConfirmSheet, EmptyState, ErrorState, Header, Screen, Skeleton, T } from "@/ui/kit";

export default function AIProvidersScreen() {
  const { state, reload, apply } = useProviders();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PublicProvider | null>(null);
  const [removing, setRemoving] = useState<PublicProvider | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const data = state.status === "ready" ? state.data : null;
  const userCount = data?.providers.filter((p) => p.source === "user").length ?? 0;
  const canAdd = !!data && data.storage !== "unavailable" && userCount < data.maxProviders;
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  return (
    <>
      <Header title="Chrono Flex" subtitle="AI providers" back right={canAdd ? <Btn label="Add" icon={Plus} size="sm" onPress={openAdd} testID="button-add-provider" /> : null} />
      <Screen>
        <T variant="small" style={{ fontSize: 14 }}>Bring your own API key, choose a provider, and make it the default for your AI workspace.</T>
        {state.status === "loading" ? (
          <View style={{ gap: 12 }} accessibilityLabel="Loading providers">
            <Skeleton height={80} />
            <Skeleton height={140} />
          </View>
        ) : state.status === "error" ? (
          <ErrorState error={state.error} onRetry={reload} />
        ) : (
          <View style={{ gap: 12 }}>
            <StorageNotice data={state.data} />
            {actionError ? <ErrorState error={actionError} onRetry={() => setActionError(null)} /> : null}
            {state.data.providers.length === 0 ? (
              <EmptyState icon={KeyRound} title="No AI providers yet" action={canAdd ? <Btn label="Add provider" icon={Plus} onPress={openAdd} testID="button-add-first-provider" /> : null}>
                Chrono uses the server-managed Google Gemini provider by default. Other account providers may be added, but they cannot replace Gemini as the platform default.
              </EmptyState>
            ) : (
              <View style={{ gap: 12 }} testID="list-providers">
                {state.data.providers.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    onChanged={(d) => {
                      setActionError(null);
                      apply(d);
                    }}
                    onError={setActionError}
                    geminiModels={data?.geminiModels}
                    onEdit={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                    onRemove={() => setRemoving(p)}
                  />
                ))}
              </View>
            )}
            {data && userCount >= data.maxProviders && data.storage !== "unavailable" ? (
              <T variant="tiny">Limit of {data.maxProviders} providers reached for {data.storage === "session" ? "session-only" : "saved"} storage.</T>
            ) : null}
            <ProviderForm open={formOpen} onOpenChange={setFormOpen} editing={editing} storageNote={state.data.storageNote} onSaved={apply} />
          </View>
        )}
      </Screen>
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.label ?? "provider"}?`}
        description="The encrypted key is deleted from Chrono. Revoke it in the provider's dashboard too if you no longer need it."
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          const r = removing;
          setRemoving(null);
          if (!r) return;
          try {
            apply(await deleteProvider(r.id));
            setActionError(null);
          } catch (err) {
            setActionError(err);
          }
        }}
      />
    </>
  );
}
