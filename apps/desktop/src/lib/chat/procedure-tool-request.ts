const KNOWN_STATIC_TOOLS = new Set([
  "search_knowledge",
  "web_search",
  "read_clipboard",
  "create_procedure",
  "open_procedure",
]);

export type ProcedureOpenDecision =
  | { kind: "open"; slug: string }
  | { kind: "already_open"; slug: string }
  | { kind: "not_procedure" };

export function isCreateProcedureToolRequest(request: {
  name: string;
}): boolean {
  return request.name === "create_procedure";
}

export function resolveProcedureSlugFromToolRequest(request: {
  name: string;
  args?: Record<string, unknown>;
}): string | null {
  if (request.name === "open_procedure") {
    const slug = request.args?.slug;
    return typeof slug === "string" && slug.trim() ? slug.trim() : null;
  }
  if (KNOWN_STATIC_TOOLS.has(request.name)) {
    return null;
  }
  return request.name.trim() || null;
}

export function isOpenProcedureToolRequest(request: {
  name: string;
  args?: Record<string, unknown>;
}): boolean {
  if (request.name === "open_procedure") {
    return Boolean(resolveProcedureSlugFromToolRequest(request));
  }
  if (KNOWN_STATIC_TOOLS.has(request.name)) {
    return false;
  }
  return Boolean(request.name.trim());
}

export function decideProcedureOpenRequest(
  request: { name: string; args?: Record<string, unknown> },
  openedInChain: ReadonlySet<string>,
): ProcedureOpenDecision {
  if (!isOpenProcedureToolRequest(request)) {
    return { kind: "not_procedure" };
  }
  const slug = resolveProcedureSlugFromToolRequest(request);
  if (!slug) {
    return { kind: "not_procedure" };
  }
  if (openedInChain.has(slug)) {
    return { kind: "already_open", slug };
  }
  return { kind: "open", slug };
}

export function parseCreateProcedureArgs(args: Record<string, unknown>): {
  title: string;
  markdown?: string;
  steps?: string[];
} | null {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  if (!title) {
    return null;
  }

  const markdown =
    typeof args.markdown === "string" && args.markdown.trim()
      ? args.markdown.trim()
      : undefined;
  const steps = Array.isArray(args.steps)
    ? args.steps
        .filter((step): step is string => typeof step === "string")
        .map((step) => step.trim())
        .filter((step) => step.length > 0)
    : undefined;

  if (!markdown && (!steps || steps.length === 0)) {
    return null;
  }

  return { title, markdown, steps };
}
