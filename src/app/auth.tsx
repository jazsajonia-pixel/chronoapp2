import { Redirect } from "expo-router";

/**
 * Deep-link target for chronoapp2://auth. The sign-in flow reads the handoff from the auth
 * session result directly; if the OS opens this route instead, just go back to the app.
 */
export default function AuthReturn() {
  return <Redirect href="/" />;
}
