import type { AuthPhase } from "@/lib/auth/auth-state";

export type WindowLabel = "main" | "panel";

export type CloseAction = "hide" | "close-panel";

export type CloseContext = {
  windowLabel: WindowLabel;
  authPhase: AuthPhase;
};

export function resolveCloseAction(ctx: CloseContext): CloseAction {
  if (ctx.windowLabel === "panel") {
    return "close-panel";
  }

  return "hide";
}
