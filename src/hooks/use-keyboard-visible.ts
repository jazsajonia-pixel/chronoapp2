import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";

/** True while the software keyboard is on screen. */
export function useKeyboardVisible(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setShown(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/** Keyboard up on a short window (landscape phone): secondary chrome should step aside. */
export function useKeyboardCompact(): boolean {
  const shown = useKeyboardVisible();
  const { height } = useWindowDimensions();
  return shown && height < 520;
}
