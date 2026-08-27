import { useEffect, useRef, type MutableRefObject } from "react";

type BeforeRemoveEvent = { preventDefault: () => void; data: { action: unknown } };

type NavigationLike = {
  /** Loose on the event name so expo-router's narrower union still assigns; the
   *  return value stays typed because useEffect uses it as the cleanup. */
  addListener?: (event: any, callback: (e: any) => void) => () => void;
  dispatch?: (action: any) => void;
};

/**
 * Blocks stack back/navigation when a form is dirty.
 * Uses `beforeRemove` instead of `usePreventRemove`, which requires PreventRemoveContext
 * that is not always available in Expo Router web/static layouts.
 */
export function useDirtyLeaveGuard(
  enabled: boolean,
  isDirty: boolean,
  skipRef: MutableRefObject<boolean>,
  navigation: NavigationLike,
  onBlocked: (continueLeave: () => void) => void,
) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigation?.addListener !== "function") return;

    return navigation.addListener("beforeRemove", (e: BeforeRemoveEvent) => {
      if (skipRef.current || !isDirtyRef.current) return;
      e.preventDefault();
      onBlocked(() => {
        skipRef.current = true;
        navigation.dispatch?.(e.data.action);
      });
    });
  }, [enabled, navigation, onBlocked, skipRef]);
}
