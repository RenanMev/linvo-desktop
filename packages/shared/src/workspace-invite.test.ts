import { describe, expect, it } from "vitest";

import {
  formatInviteCode,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
  redeemInviteCodeInputSchema,
} from "./workspace-invite";

describe("normalizeInviteCode", () => {
  it("normalizes lowercase, hyphen, spaces and newlines to 8 chars", () => {
    expect(normalizeInviteCode("h7kp3rqm")).toBe("H7KP3RQM");
    expect(normalizeInviteCode("H7KP-3RQM")).toBe("H7KP3RQM");
    expect(normalizeInviteCode("H7KP 3RQM")).toBe("H7KP3RQM");
    expect(normalizeInviteCode("H7KP\n3RQM")).toBe("H7KP3RQM");
  });

  it("drops characters outside the alphabet silently", () => {
    expect(normalizeInviteCode("H7KP-OIQ1")).toBe("H7KPQ");
    expect(normalizeInviteCode("!!H7KP##3RQM??")).toBe("H7KP3RQM");
  });

  it("caps at INVITE_CODE_LENGTH", () => {
    expect(normalizeInviteCode("H7KP3RQMAAAA").length).toBe(INVITE_CODE_LENGTH);
  });
});

describe("formatInviteCode", () => {
  it("inserts a hyphen after the 4th character", () => {
    expect(formatInviteCode("H7KP3RQM")).toBe("H7KP-3RQM");
    expect(formatInviteCode("h7kp-3rqm")).toBe("H7KP-3RQM");
  });
});

describe("redeemInviteCodeInputSchema", () => {
  it("accepts formatted and raw codes", () => {
    expect(redeemInviteCodeInputSchema.parse({ code: "H7KP-3RQM" }).code).toBe(
      "H7KP3RQM",
    );
    expect(redeemInviteCodeInputSchema.parse({ code: "h7kp3rqm" }).code).toBe(
      "H7KP3RQM",
    );
  });

  it("rejects incomplete codes", () => {
    expect(redeemInviteCodeInputSchema.safeParse({ code: "H7KP" }).success).toBe(
      false,
    );
  });
});
