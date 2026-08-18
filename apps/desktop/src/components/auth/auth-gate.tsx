import { useEffect } from "react";

import { BarApp } from "@/BarApp";
import { LoginView } from "@/components/auth/login-view";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useWindowChrome } from "@/context/window-chrome-context";
import { useAuth } from "@/hooks/use-auth";
import { quitApp } from "@/lib/app-windows";
import { openPanel } from "@/lib/panel-window";

export function AuthGate() {
  const auth = useAuth();
  const { registerAuthPhase, registerTrayHandlers, updateTrayAuthState } =
    useWindowChrome();

  useEffect(() => {
    registerAuthPhase(auth.phase);
  }, [auth.phase, registerAuthPhase]);

  useEffect(() => {
    updateTrayAuthState({ phase: auth.phase, user: auth.user });

    registerTrayHandlers({
      openChat: async () => {
        if (!auth.user) {
          return;
        }
        await openPanel("/chat", auth.user);
      },
      openSettings: async () => {
        if (!auth.user) {
          return;
        }
        await openPanel("/settings/general", auth.user);
      },
      logoutAndQuit: async () => {
        await auth.logout();
        await quitApp();
      },
    });
  }, [
    auth.phase,
    auth.user,
    auth.logout,
    registerTrayHandlers,
    updateTrayAuthState,
  ]);

  if (auth.isChecking) {
    return (
      <div className="window-shell flex h-full w-full items-center justify-center gap-3 rounded-premium bg-background text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        Validando sessão...
      </div>
    );
  }

  if (auth.phase === "unauthenticated") {
    return (
      <LoginView
        error={auth.error}
        sessionWarning={auth.sessionWarning}
        onLogin={auth.login}
        onRegister={auth.register}
      />
    );
  }

  if (auth.phase === "onboarding" && auth.user) {
    return (
      <OnboardingShell
        user={auth.user}
        onComplete={auth.completeOnboarding}
      />
    );
  }

  if (auth.phase === "floating" && auth.user) {
    return <BarApp sessionWarning={auth.sessionWarning} user={auth.user} />;
  }

  return null;
}
