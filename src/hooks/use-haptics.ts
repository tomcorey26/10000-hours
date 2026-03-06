import { useWebHaptics } from "web-haptics/react";

export function useHaptics() {
  return useWebHaptics({ debug: false });
}
