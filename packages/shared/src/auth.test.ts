import { describe, expect, it } from "vitest";

import {
  authResultSchema,
  emailSchema,
  loginInputSchema,
  passwordSchema,
  registerInputSchema,
} from "./auth";

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("Abcdef1!").success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = passwordSchema.safeParse("Ab1!xyz");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a letter", () => {
    const result = passwordSchema.safeParse("12345678!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a number", () => {
    const result = passwordSchema.safeParse("Abcdefgh!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a special character", () => {
    const result = passwordSchema.safeParse("Abcdefg1");
    expect(result.success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    const result = emailSchema.safeParse("User@Example.com");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("user@example.com");
    }
  });

  it("rejects an invalid email", () => {
    const result = emailSchema.safeParse("not-an-email");
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = emailSchema.safeParse("  user@example.com  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("user@example.com");
    }
  });
});

describe("registerInputSchema", () => {
  it("accepts valid register input", () => {
    const result = registerInputSchema.safeParse({
      name: "Renan",
      email: "renan@example.com",
      password: "Abcdef1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = registerInputSchema.safeParse({
      name: "   ",
      email: "renan@example.com",
      password: "Abcdef1!",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginInputSchema", () => {
  it("accepts valid login input", () => {
    const result = loginInputSchema.safeParse({
      email: "renan@example.com",
      password: "any-password",
    });
    expect(result.success).toBe(true);
  });
});

describe("authResultSchema", () => {
  it("accepts a valid auth result", () => {
    const result = authResultSchema.safeParse({
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        name: "Renan",
        email: "renan@example.com",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});
