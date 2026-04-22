import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, Invoice, InsertInvoice, InsertTransaction, InsertSyncLog,
  invoices, syncLogs, transactions, userSettings, users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function createInvoice(data: Omit<InsertInvoice, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(invoices).values(data as InsertInvoice).$returningId();
  return result.id;
}

export async function getInvoicesByUser(
  userId: number,
  filters?: { status?: string; type?: string; search?: string; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(invoices.userId, userId)];
  if (filters?.status) conditions.push(eq(invoices.status, filters.status as any));
  if (filters?.type) conditions.push(eq(invoices.type, filters.type as any));
  if (filters?.search) {
    const s = `%${filters.search}%`;
    conditions.push(
      or(
        like(invoices.vendor, s),
        like(invoices.clientName, s),
        like(invoices.invoiceNumber, s),
        like(invoices.description, s)
      )!
    );
  }

  return db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .limit(filters?.limit ?? 50)
    .offset(filters?.offset ?? 0);
}

export async function getInvoiceById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function updateInvoice(id: number, userId: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(invoices).set(data).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
}

export async function deleteInvoice(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
}

export async function getInvoiceKPIs(userId: number) {
  const db = await getDb();
  if (!db) return { totalIncome: 0, totalExpenses: 0, balance: 0, pendingCount: 0, overdueCount: 0 };

  const allInvoices = await db.select().from(invoices).where(eq(invoices.userId, userId));

  let totalIncome = 0;
  let totalExpenses = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  for (const inv of allInvoices) {
    const amount = parseFloat(String(inv.amount ?? "0"));
    if (inv.status === "paid") {
      if (inv.type === "income") totalIncome += amount;
      else if (inv.type === "expense") totalExpenses += amount;
    }
    if (inv.status === "sent") pendingCount++;
    if (inv.status === "overdue") overdueCount++;
  }

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    pendingCount,
    overdueCount,
  };
}

export async function markOverdueInvoices(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db
    .update(invoices)
    .set({ status: "overdue" })
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.status, "sent"),
        lte(invoices.dueDate, now)
      )
    );
  return (result as any)[0]?.affectedRows ?? 0;
}

export async function getInvoiceByRawEmailId(userId: number, rawEmailId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.rawEmailId, rawEmailId)))
    .limit(1);
  return result[0] ?? null;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function createTransaction(data: Omit<InsertTransaction, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(transactions).values(data as InsertTransaction).$returningId();
  return result.id;
}

export async function getTransactionsByUser(
  userId: number,
  filters?: { type?: string; category?: string; search?: string; from?: Date; to?: Date; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(transactions.userId, userId)];
  if (filters?.type) conditions.push(eq(transactions.type, filters.type as any));
  if (filters?.category) conditions.push(eq(transactions.category, filters.category));
  if (filters?.search) conditions.push(like(transactions.description, `%${filters.search}%`));
  if (filters?.from) conditions.push(gte(transactions.date, filters.from));
  if (filters?.to) conditions.push(lte(transactions.date, filters.to));

  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);
}

export async function updateTransaction(id: number, userId: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

// ─── Sync Logs ────────────────────────────────────────────────────────────────

export async function createSyncLog(data: Omit<InsertSyncLog, "id">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(syncLogs).values(data as InsertSyncLog).$returningId();
  return result.id;
}

export async function updateSyncLog(id: number, data: Partial<InsertSyncLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncLogs).set(data).where(eq(syncLogs.id, id));
}

export async function getLatestSyncLog(userId: number, syncType?: "gmail" | "sheets" | "full") {
  const db = await getDb();
  if (!db) return undefined;

  const conditions = [eq(syncLogs.userId, userId)];
  if (syncType) conditions.push(eq(syncLogs.syncType, syncType));

  const result = await db
    .select()
    .from(syncLogs)
    .where(and(...conditions))
    .orderBy(desc(syncLogs.startedAt))
    .limit(1);
  return result[0];
}

export async function getSyncLogs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(syncLogs)
    .where(eq(syncLogs.userId, userId))
    .orderBy(desc(syncLogs.startedAt))
    .limit(limit);
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertUserSettings(
  userId: number,
  data: { appsScriptUrl?: string; sheetsId?: string; defaultCurrency?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await getUserSettings(userId);
  if (existing) {
    const updateData: Record<string, unknown> = {};
    if (data.appsScriptUrl !== undefined) updateData.appsScriptUrl = data.appsScriptUrl;
    if (data.sheetsId !== undefined) updateData.sheetsId = data.sheetsId;
    if (data.defaultCurrency !== undefined) updateData.defaultCurrency = data.defaultCurrency;
    if (Object.keys(updateData).length > 0) {
      await db.update(userSettings).set(updateData).where(eq(userSettings.userId, userId));
    }
  } else {
    await db.insert(userSettings).values({
      userId,
      appsScriptUrl: data.appsScriptUrl,
      sheetsId: data.sheetsId,
      defaultCurrency: data.defaultCurrency ?? "USD",
    });
  }
}
