import type { UserPublic } from "@linvo/shared";

import { getTokens } from "@/lib/auth/token-store";
import { PANEL_HOME_ROUTE } from "@/lib/panel-routes";
import { openPanel } from "@/lib/panel-window";

export async function enterLoggedInDesktop(
  user: UserPublic,
  route = PANEL_HOME_ROUTE,
): Promise<void> {
  const tokens = await getTokens();
  await openPanel(route, user, tokens);
}
