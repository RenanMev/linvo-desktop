import type { AuthPhase } from "@/lib/auth/auth-state";

export type WindowLabel = "main" | "panel" | "checklist" | "capture-overlay";

export type CloseAction =
  | "hide"
  | "close-panel"
  | "close-checklist"
  | "close-overlay";

export type CloseContext = {
  windowLabel: WindowLabel;
  authPhase: AuthPhase;
};

export function resolveCloseAction(ctx: CloseContext): CloseAction {
  if (ctx.windowLabel === "panel") {
    return "close-panel";
  }

  if (ctx.windowLabel === "checklist") {
    return "close-checklist";
  }

  if (ctx.windowLabel === "capture-overlay") {
    return "close-overlay";
  }

  return "hide";
}
