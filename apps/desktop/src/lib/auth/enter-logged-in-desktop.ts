import type { UserPublic } from "@linvo/shared";

import { getTokens } from "@/lib/auth/token-store";
import { openPanel } from "@/lib/panel-window";

export async function enterLoggedInDesktop(
  user: UserPublic,
  route = "/chat",
): Promise<void> {
  const tokens = await getTokens();
  await openPanel(route, user, tokens);
}
