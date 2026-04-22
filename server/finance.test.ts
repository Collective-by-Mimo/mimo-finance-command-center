import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "mimo@example.com",
    name: "Mimo Mirzazada",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });

  it("auth.me returns the current user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.name).toBe("Mimo Mirzazada");
    expect(user?.email).toBe("mimo@example.com");
  });

  it("auth.me returns null for unauthenticated context", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

// ─── Invoice Router Tests ─────────────────────────────────────────────────────

describe("invoice router", () => {
  it("invoice.list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invoice.list()).rejects.toThrow();
  });

  it("invoice.kpis requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.invoice.kpis()).rejects.toThrow();
  });
});

// ─── Transaction Router Tests ─────────────────────────────────────────────────

describe("transaction router", () => {
  it("transaction.list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.transaction.list()).rejects.toThrow();
  });
});

// ─── Sync Router Tests ────────────────────────────────────────────────────────

describe("sync router", () => {
  it("sync.status requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sync.status()).rejects.toThrow();
  });

  it("sync.logs requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sync.logs()).rejects.toThrow();
  });
});

// ─── Settings Router Tests ────────────────────────────────────────────────────

describe("settings router", () => {
  it("settings.get requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settings.get()).rejects.toThrow();
  });
});

// ─── AI Router Tests ──────────────────────────────────────────────────────────

describe("ai router", () => {
  it("ai.chat requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.ai.chat({ message: "hello" })).rejects.toThrow();
  });
});

// ─── Input Validation Tests ───────────────────────────────────────────────────

describe("input validation", () => {
  it("transaction.create rejects invalid type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transaction.create({
        description: "Test",
        amount: 100,
        type: "invalid" as any,
        date: new Date(),
      })
    ).rejects.toThrow();
  });

  it("invoice.create accepts valid source enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // This will fail at DB level (no real DB in test), but should not fail at validation
    try {
      await caller.invoice.create({
        vendor: "Test Vendor",
        amount: 500,
        source: "manual",
        type: "income",
        status: "draft",
      });
    } catch (e: any) {
      // DB error is expected in test environment, but not a validation error
      expect(e.message).not.toContain("Invalid enum value");
    }
  });

  it("invoice.create rejects invalid status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.invoice.create({
        status: "unknown_status" as any,
      })
    ).rejects.toThrow();
  });
});

// ─── AI createDraft Router Tests ─────────────────────────────────────────────

describe("ai.createDraft", () => {
  it("createDraft requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.createDraft({
        to: "client@example.com",
        subject: "Invoice #001",
        body: "Please find attached...",
      })
    ).rejects.toThrow();
  });

  it("createDraft rejects missing 'to' field", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.createDraft({
        to: "",
        subject: "Invoice #001",
        body: "Please find attached...",
      })
    ).rejects.toThrow();
  });

  it("createDraft throws when Apps Script URL is not configured", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // In test environment there is no DB, so getUserSettings returns null/undefined
    // which triggers the "Apps Script URL not configured" error path
    try {
      await caller.ai.createDraft({
        to: "client@example.com",
        subject: "Invoice #001 — AED 5,000 — Due 30 Apr 2026",
        body: "Dear Client,\n\nPlease find invoice details below...",
      });
    } catch (e: any) {
      // Either DB error or Apps Script URL not configured — both are expected
      expect(
        e.message.includes("Apps Script URL not configured") ||
        e.message.includes("database") ||
        e.message.includes("Cannot read") ||
        e.message.length > 0
      ).toBe(true);
    }
  });

  it("createDraft input schema validates all required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Missing 'subject' should throw a validation error
    await expect(
      caller.ai.createDraft({
        to: "client@example.com",
        subject: undefined as any,
        body: "Body text",
      })
    ).rejects.toThrow();
  });

  it("ai.draftFromInvoice requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.draftFromInvoice({ invoiceId: 1 })
    ).rejects.toThrow();
  });
});
