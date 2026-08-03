import { useEffect, useState } from "react";

import { BarApp } from "@/BarApp";
import { LoginView } from "@/components/auth/login-view";
import { RegisterView } from "@/components/auth/register-view";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useWindowChrome } from "@/context/window-chrome-context";
import { useAuth } from "@/hooks/use-auth";
import { quitApp } from "@/lib/app-windows";
import { openPanel } from "@/lib/panel-window";

type AuthScreen = "login" | "register";

export function AuthGate() {
  const auth = useAuth();
  const { registerAuthPhase, registerTrayHandlers, updateTrayAuthState } =
    useWindowChrome();
  const [screen, setScreen] = useState<AuthScreen>("login");

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
      <div className="flex h-full w-full items-center justify-center gap-3 rounded-premium bg-neutral-deep text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        Validando sessão...
      </div>
    );
  }

  if (auth.phase === "unauthenticated") {
    if (screen === "register") {
      return (
        <RegisterView
          error={auth.error}
          onRegister={auth.register}
          onGoToLogin={() => setScreen("login")}
        />
      );
    }

    return (
      <LoginView
        error={auth.error}
        sessionWarning={auth.sessionWarning}
        onLogin={auth.login}
        onGoToRegister={() => setScreen("register")}
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
