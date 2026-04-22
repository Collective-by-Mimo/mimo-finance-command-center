import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import {
  createInvoice,
  createSyncLog,
  createTransaction,
  deleteInvoice,
  deleteTransaction,
  getInvoiceById,
  getInvoiceByRawEmailId,
  getInvoiceKPIs,
  getInvoicesByUser,
  getLatestSyncLog,
  getSyncLogs,
  getTransactionsByUser,
  getUserSettings,
  markOverdueInvoices,
  updateInvoice,
  updateSyncLog,
  updateTransaction,
  upsertUserSettings,
} from "./db";
import { z } from "zod";

// ─── Line Item Schema ─────────────────────────────────────────────────────────
const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

// ─── Invoice Router ───────────────────────────────────────────────────────────
const invoiceRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        type: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return getInvoicesByUser(ctx.user.id, input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return getInvoiceById(input.id, ctx.user.id);
    }),

  kpis: protectedProcedure.query(async ({ ctx }) => {
    await markOverdueInvoices(ctx.user.id);
    return getInvoiceKPIs(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        invoiceNumber: z.string().optional(),
        vendor: z.string().optional(),
        clientName: z.string().optional(),
        clientEmail: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
        type: z.enum(["income", "expense", "pending"]).optional(),
        issueDate: z.date().optional(),
        dueDate: z.date().optional(),
        lineItems: z.array(lineItemSchema).optional(),
        notes: z.string().optional(),
        source: z.enum(["manual", "gmail", "upload", "ai_generated"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createInvoice({
        userId: ctx.user.id,
        ...input,
        amount: input.amount?.toString(),
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        invoiceNumber: z.string().optional(),
        vendor: z.string().optional(),
        clientName: z.string().optional(),
        clientEmail: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
        type: z.enum(["income", "expense", "pending"]).optional(),
        issueDate: z.date().optional(),
        dueDate: z.date().optional(),
        paidDate: z.date().optional(),
        lineItems: z.array(lineItemSchema).optional(),
        notes: z.string().optional(),
        fileKey: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, amount, ...rest } = input;
      await updateInvoice(id, ctx.user.id, {
        ...rest,
        ...(amount !== undefined ? { amount: amount.toString() } : {}),
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteInvoice(input.id, ctx.user.id);
      return { success: true };
    }),

  uploadFile: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
        invoiceId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `invoices/${ctx.user.id}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      if (input.invoiceId) {
        await updateInvoice(input.invoiceId, ctx.user.id, {
          fileKey: key,
          fileUrl: url,
        });
      }
      return { key, url };
    }),

  parseDocument: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx: _ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a financial document parser. Extract structured invoice data from the provided text or document content. Return ONLY valid JSON with no markdown code blocks.`,
          },
          {
            role: "user",
            content: `Extract invoice data from this content and return JSON with these fields: invoiceNumber, vendor, clientName, clientEmail, description, amount (number), currency, issueDate (ISO string or null), dueDate (ISO string or null), lineItems (array of {description, quantity, unitPrice, total}), notes. Content:\n\n${input.content}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "invoice_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                invoiceNumber: { type: "string" },
                vendor: { type: "string" },
                clientName: { type: "string" },
                clientEmail: { type: "string" },
                description: { type: "string" },
                amount: { type: "number" },
                currency: { type: "string" },
                issueDate: { type: "string" },
                dueDate: { type: "string" },
                lineItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unitPrice: { type: "number" },
                      total: { type: "number" },
                    },
                    required: ["description", "quantity", "unitPrice", "total"],
                    additionalProperties: false,
                  },
                },
                notes: { type: "string" },
              },
              required: ["invoiceNumber", "vendor", "clientName", "clientEmail", "description", "amount", "currency", "issueDate", "dueDate", "lineItems", "notes"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = response.choices[0]?.message?.content ?? "{}";
      try {
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {};
      }
    }),
});

// ─── Transaction Router ───────────────────────────────────────────────────────
const transactionRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        type: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return getTransactionsByUser(ctx.user.id, input);
    }),

  create: protectedProcedure
    .input(
      z.object({
        description: z.string(),
        amount: z.number(),
        currency: z.string().optional(),
        type: z.enum(["income", "expense", "transfer"]),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        date: z.date(),
        invoiceId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createTransaction({
        userId: ctx.user.id,
        ...input,
        amount: input.amount.toString(),
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().optional(),
        amount: z.number().optional(),
        type: z.enum(["income", "expense", "transfer"]).optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        date: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, amount, ...rest } = input;
      await updateTransaction(id, ctx.user.id, {
        ...rest,
        ...(amount !== undefined ? { amount: amount.toString() } : {}),
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTransaction(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Sync Router ──────────────────────────────────────────────────────────────
const syncRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const latest = await getLatestSyncLog(ctx.user.id);
    const gmailSync = await getLatestSyncLog(ctx.user.id, "gmail");
    const sheetsSync = await getLatestSyncLog(ctx.user.id, "sheets");
    return { latest, gmailSync, sheetsSync };
  }),

  logs: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return getSyncLogs(ctx.user.id, input?.limit);
    }),

  triggerGmail: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    if (!settings?.appsScriptUrl) {
      return { success: false, error: "Apps Script URL not configured. Please set it in Settings." };
    }

    const logId = await createSyncLog({
      userId: ctx.user.id,
      syncType: "gmail",
      status: "running",
      message: "Gmail sync started",
    });

    try {
      const response = await fetch(settings.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({ action: "syncGmail" }),
      });

      if (!response.ok && response.status !== 302) {
        throw new Error(`Apps Script returned ${response.status}`);
      }

      let data: any = {};
      const text = await response.text();
      if (text && text.trim().startsWith("{")) {
        data = JSON.parse(text);
      }

      const itemsCreated = data.invoicesCreated ?? 0;
      const threads = data.threads ?? [];

      // Create invoices from Gmail data (skip duplicates)
      let actualCreated = 0;
      for (const thread of threads) {
        if (thread.invoiceData) {
          const inv = thread.invoiceData;
          const rawId = thread.messageId ?? thread.threadId;
          // Skip if already imported
          if (rawId) {
            const existing = await getInvoiceByRawEmailId(ctx.user.id, rawId);
            if (existing) continue;
          }
          actualCreated++;
          const invoiceId = await createInvoice({
            userId: ctx.user.id,
            vendor: inv.vendor ?? thread.from,
            description: inv.description ?? thread.subject,
            amount: inv.amount?.toString(),
            currency: inv.currency ?? "USD",
            issueDate: inv.issueDate ? new Date(inv.issueDate) : new Date(),
            dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
            source: "gmail",
            rawEmailId: thread.messageId ?? thread.threadId,
            status: "sent",
            type: "expense",
          });
          await notifyOwner({
            title: "New Invoice Detected",
            content: `Invoice from ${inv.vendor ?? thread.from} for ${inv.amount ?? "unknown amount"} detected via Gmail. Invoice ID: ${invoiceId}`,
          });
        }
      }

      await updateSyncLog(logId, {
         status: "success",
        message: `Synced ${threads.length} threads, created ${actualCreated} invoices`,
        itemsProcessed: threads.length,
        itemsCreated: actualCreated,
        completedAt: new Date(),
      });
      return { success: true, itemsProcessed: threads.length, itemsCreated: actualCreated };
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      await updateSyncLog(logId, {
        status: "error",
        message: msg,
        completedAt: new Date(),
      });
      await notifyOwner({
        title: "Gmail Sync Error",
        content: `Gmail sync failed: ${msg}`,
      });
      return { success: false, error: msg };
    }
  }),

  triggerSheets: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    if (!settings?.appsScriptUrl) {
      return { success: false, error: "Apps Script URL not configured." };
    }

    const logId = await createSyncLog({
      userId: ctx.user.id,
      syncType: "sheets",
      status: "running",
      message: "Sheets sync started",
    });

    try {
      const response = await fetch(settings.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({ action: "getDashboardData", sheetsId: settings.sheetsId }),
      });

      if (!response.ok && response.status !== 302) {
        throw new Error(`Apps Script returned ${response.status}`);
      }

      const text = await response.text();
      let data: any = {};
      if (text && text.trim().startsWith("{")) {
        data = JSON.parse(text);
      }

      const rows = data.transactions ?? [];
      let created = 0;
      for (const row of rows) {
        if (row.description && row.amount) {
          await createTransaction({
            userId: ctx.user.id,
            description: row.description,
            amount: String(row.amount),
            type: row.type ?? "expense",
            category: row.category,
            date: row.date ? new Date(row.date) : new Date(),
          });
          created++;
        }
      }

      await updateSyncLog(logId, {
        status: "success",
        message: `Synced ${rows.length} rows from Sheets`,
        itemsProcessed: rows.length,
        itemsCreated: created,
        completedAt: new Date(),
      });

      return { success: true, itemsProcessed: rows.length, itemsCreated: created };
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      await updateSyncLog(logId, {
        status: "error",
        message: msg,
        completedAt: new Date(),
      });
      await notifyOwner({
        title: "Sheets Sync Error",
        content: `Google Sheets sync failed: ${msg}`,
      });
      return { success: false, error: msg };
    }
  }),

  checkOverdue: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await markOverdueInvoices(ctx.user.id);
    if (count > 0) {
      await notifyOwner({
        title: "Overdue Invoices Detected",
        content: `${count} invoice(s) are now overdue and have been marked accordingly.`,
      });
    }
    return { overdueMarked: count };
  }),
});

// ─── AI Composer Router ───────────────────────────────────────────────────────
const aiRouter = router({
  composeInvoice: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx: _ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional invoice generator. Generate complete, structured invoice data from natural language descriptions. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Generate a professional invoice from this description: "${input.prompt}"${input.context ? `\n\nAdditional context: ${input.context}` : ""}. Return JSON with: invoiceNumber (auto-generate like INV-YYYY-XXXX), vendor, clientName, clientEmail, description, amount (total number), currency, issueDate (today ISO), dueDate (30 days from now ISO), lineItems (array of {description, quantity, unitPrice, total}), notes.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "invoice_composition",
            strict: true,
            schema: {
              type: "object",
              properties: {
                invoiceNumber: { type: "string" },
                vendor: { type: "string" },
                clientName: { type: "string" },
                clientEmail: { type: "string" },
                description: { type: "string" },
                amount: { type: "number" },
                currency: { type: "string" },
                issueDate: { type: "string" },
                dueDate: { type: "string" },
                lineItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unitPrice: { type: "number" },
                      total: { type: "number" },
                    },
                    required: ["description", "quantity", "unitPrice", "total"],
                    additionalProperties: false,
                  },
                },
                notes: { type: "string" },
              },
              required: ["invoiceNumber", "vendor", "clientName", "clientEmail", "description", "amount", "currency", "issueDate", "dueDate", "lineItems", "notes"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = response.choices[0]?.message?.content ?? "{}";
      try {
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {};
      }
    }),

  chat: protectedProcedure
    .input(z.object({ message: z.string(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional() }))
    .mutation(async ({ ctx: _ctx, input }) => {
      const messages: any[] = [
        { role: "system", content: "You are Mimo's Finance AI assistant. Help with invoice creation, financial analysis, and transaction categorization. Be concise and professional." },
        ...(input.history ?? []),
        { role: "user", content: input.message },
      ];
      const response = await invokeLLM({ messages });
      const content = response.choices[0]?.message?.content ?? "";
      return { reply: typeof content === "string" ? content : JSON.stringify(content) };
    }),
});

// ─── Settings Router ──────────────────────────────────────────────────────────
const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getUserSettings(ctx.user.id);
  }),

  update: protectedProcedure
    .input(
      z.object({
        appsScriptUrl: z.string().optional(),
        sheetsId: z.string().optional(),
        defaultCurrency: z.string().optional(),
        gmailLabelFilter: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertUserSettings(ctx.user.id, {
        appsScriptUrl: input.appsScriptUrl,
        sheetsId: input.sheetsId,
        defaultCurrency: input.defaultCurrency,
      });
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  invoice: invoiceRouter,
  transaction: transactionRouter,
  sync: syncRouter,
  ai: aiRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
