import { z } from "zod";

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "versão deve ser semver (ex: 1.2.3)");

export const desktopReleaseResponseSchema = z.object({
  latestVersion: semverSchema,
  minSupportedVersion: semverSchema,
  releaseNotes: z.string(),
  publishedAt: z.string().datetime(),
  downloadUrl: z.string().url(),
});

export type DesktopReleaseResponse = z.infer<
  typeof desktopReleaseResponseSchema
>;

export function compareSemver(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10));
  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }

  return 0;
}

export function isVersionBelow(current: string, target: string): boolean {
  return compareSemver(current, target) < 0;
}
