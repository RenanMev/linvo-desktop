import { getCurrentWindow } from "@tauri-apps/api/window";

import { applyWindowSurfaceConfig } from "@/lib/auth/apply-window-surface";
import { configForSurfaceMode } from "@/lib/auth/window-auth";
import {
  ONBOARDING_MIN_SIZE,
  ONBOARDING_SIZE,
} from "@/lib/window-mode";
import type { MonitorInfo } from "@/lib/window-position";
import { readWorkArea } from "@/lib/window-work-area";

export function resolveOnboardingWindowSize(
  workArea: MonitorInfo | null,
) {
  if (!workArea) {
    return ONBOARDING_SIZE;
  }

  return {
    width: Math.max(
      ONBOARDING_MIN_SIZE.width,
      Math.min(ONBOARDING_SIZE.width, Math.floor(workArea.size.width)),
    ),
    height: Math.max(
      ONBOARDING_MIN_SIZE.height,
      Math.min(ONBOARDING_SIZE.height, Math.floor(workArea.size.height)),
    ),
  };
}

export async function applyOnboardingWindowSurface(): Promise<void> {
  const scaleFactor = await getCurrentWindow().scaleFactor();
  const workArea = await readWorkArea();
  const logicalWorkArea =
    workArea && scaleFactor > 0
      ? {
          position: {
            x: workArea.position.x / scaleFactor,
            y: workArea.position.y / scaleFactor,
          },
          size: {
            width: workArea.size.width / scaleFactor,
            height: workArea.size.height / scaleFactor,
          },
        }
      : workArea;

  await applyWindowSurfaceConfig({
    ...configForSurfaceMode("onboarding"),
    size: resolveOnboardingWindowSize(logicalWorkArea),
  });
}
