export function parseSlashQuery(value: string): string | null {
  if (!value.startsWith("/")) {
    return null;
  }
  const rest = value.slice(1);
  if (/\s/.test(rest)) {
    return null;
  }
  return rest;
}

export function filterPublishedSlugs(
  slugs: string[],
  query: string,
): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return slugs;
  }
  return slugs.filter((slug) => slug.toLowerCase().startsWith(normalized));
}

export function extractSlashSlug(value: string): string | null {
  const query = parseSlashQuery(value.trim());
  if (query === null || query.length === 0) {
    return null;
  }
  return query;
}
