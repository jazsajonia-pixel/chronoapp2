import { router } from "expo-router";
import { Compass } from "lucide-react-native";
import { Btn, EmptyState, Header, Screen } from "@/ui/kit";

export default function NotFound() {
  return (
    <>
      <Header title="Not found" back />
      <Screen>
        <EmptyState icon={Compass} title="This screen doesn't exist" action={<Btn label="Go home" onPress={() => router.replace("/")} />}>
          The link may be broken or the page may have moved.
        </EmptyState>
      </Screen>
    </>
  );
}
