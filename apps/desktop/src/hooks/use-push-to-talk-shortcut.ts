import { useEffect, useRef, useState } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

import {
  getStoredPushToTalkShortcut,
  pushToTalkShortcutCandidates,
  subscribePushToTalkShortcut,
} from "@/lib/voice/push-to-talk-shortcut";

type UsePushToTalkShortcutOptions = {
  enabled?: boolean;
  onPress: () => void;
  onRelease: () => void;
};

/*
 * Atalho global de segurar-para-falar (KAN-41/42).
 *
 * Global, não local: precisa funcionar com a ilha oculta ou sem foco — o
 * atendente está no sistema dele, não no Linvo. O plugin entrega `Pressed`
 * e `Released`, que é o que "segurar" precisa. Se o atalho escolhido já
 * estiver tomado por outro app, cai para o reserva (Ctrl+Shift+Space) e
 * expõe qual ficou em `registered` — a tela de Atalhos mostra isso.
 */
export function usePushToTalkShortcut({
  enabled = true,
  onPress,
  onRelease,
}: UsePushToTalkShortcutOptions) {
  const [preferred, setPreferred] = useState(getStoredPushToTalkShortcut);
  const [registered, setRegistered] = useState<string | null>(null);
  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);
  onPressRef.current = onPress;
  onReleaseRef.current = onRelease;

  useEffect(
    () =>
      subscribePushToTalkShortcut(() => {
        setPreferred(getStoredPushToTalkShortcut());
      }),
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setRegistered(null);
      return;
    }

    let active = true;
    let registeredShortcut: string | null = null;

    void (async () => {
      for (const shortcut of pushToTalkShortcutCandidates(preferred)) {
        try {
          await register(shortcut, (event) => {
            if (!active) {
              return;
            }
            if (event.state === "Pressed") {
              onPressRef.current();
            } else if (event.state === "Released") {
              onReleaseRef.current();
            }
          });
          registeredShortcut = shortcut;
          if (active) {
            setRegistered(shortcut);
          }
          return;
        } catch (error) {
          console.warn("Push-to-talk shortcut registration failed", {
            shortcut,
            error,
          });
        }
      }
      if (active) {
        setRegistered(null);
      }
    })();

    return () => {
      active = false;
      if (registeredShortcut) {
        void unregister(registeredShortcut).catch(() => undefined);
      }
    };
  }, [enabled, preferred]);

  return { preferred, registered };
}
