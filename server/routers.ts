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

// ─── Apps Script API Helper ───────────────────────────────────────────────────
// Your Apps Script uses doPost(e) → apiHandler(request) with { action, data }
// The POST endpoint returns JSON: { success: boolean, data?: any, error?: string }
async function callAppsScript(appsScriptUrl: string, action: string, data: Record<string, any> = {}): Promise<any> {
  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({ action, data }),
  });

  const text = await response.text();

  // Apps Script may redirect (302) before returning JSON — follow the chain
  if (!text || !text.trim().startsWith("{")) {
    // If we got HTML back (login page or error), throw a descriptive error
    if (text.includes("Sign in") || text.includes("accounts.google.com")) {
      throw new Error("Apps Script requires authentication. Please re-deploy as 'Anyone, even anonymous'.");
    }
    if (text.includes("Page not found") || response.status === 405) {
      throw new Error("Apps Script POST endpoint not reachable. Ensure deployment access is set to 'Anyone' (not 'Anyone with Google account').");
    }
    throw new Error(`Unexpected response from Apps Script (status ${response.status})`);
  }

  const parsed = JSON.parse(text);
  if (!parsed.success) {
    throw new Error(parsed.error ?? "Apps Script returned an error");
  }
  return parsed.data;
}

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
// Maps to your Apps Script actions: searchEmails, getDashboard, getInvoices, verifyGmail
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

  // Verify the Apps Script connection (calls verifyGmail action)
  verify: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    if (!settings?.appsScriptUrl) {
      return { success: false, error: "Apps Script URL not configured. Please set it in Settings." };
    }
    try {
      const data = await callAppsScript(settings.appsScriptUrl, "verifyGmail");
      return { success: true, userEmail: data?.userEmail, timestamp: data?.timestamp };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }),

  // Gmail sync: calls searchEmails action → LLM parses each email → saves invoices
  triggerGmail: protectedProcedure
    .input(z.object({ query: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
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
        // Call your Apps Script searchEmails action
        // Default query: invoice-related emails
        const query = input?.query ?? "subject:(invoice OR receipt OR payment) is:unread";
        const threads: any[] = await callAppsScript(settings.appsScriptUrl, "searchEmails", { query });

        let actualCreated = 0;

        for (const thread of threads) {
          const rawId = thread.id;

          // Skip duplicates already imported
          if (rawId) {
            const existing = await getInvoiceByRawEmailId(ctx.user.id, rawId);
            if (existing) continue;
          }

          // Use LLM to extract invoice data from email snippet + subject
          const emailText = `Subject: ${thread.subject}\nFrom: ${thread.from}\nDate: ${thread.date}\nSnippet: ${thread.snippet}`;
          let extractedData: any = {};
          try {
            const llmResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are a financial document parser. Extract invoice data from email content. Return ONLY valid JSON. If no invoice data is found, return {"isInvoice": false}. If invoice data is found, return {"isInvoice": true, "vendor": "...", "amount": number_or_null, "currency": "AED", "description": "...", "dueDate": "ISO_or_null"}.`,
                },
                { role: "user", content: emailText },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "email_invoice_extract",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      isInvoice: { type: "boolean" },
                      vendor: { type: "string" },
                      amount: { type: "number" },
                      currency: { type: "string" },
                      description: { type: "string" },
                      dueDate: { type: "string" },
                    },
                    required: ["isInvoice", "vendor", "amount", "currency", "description", "dueDate"],
                    additionalProperties: false,
                  },
                },
              },
            });
            const raw = llmResponse.choices[0]?.message?.content ?? "{}";
            extractedData = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          } catch {
            extractedData = { isInvoice: false };
          }

          if (!extractedData.isInvoice) continue;

          actualCreated++;
          const invoiceId = await createInvoice({
            userId: ctx.user.id,
            vendor: extractedData.vendor ?? thread.from,
            description: extractedData.description ?? thread.subject,
            amount: extractedData.amount != null ? String(extractedData.amount) : undefined,
            currency: extractedData.currency ?? "AED",
            issueDate: thread.date ? new Date(thread.date) : new Date(),
            dueDate: extractedData.dueDate ? new Date(extractedData.dueDate) : undefined,
            source: "gmail",
            rawEmailId: rawId,
            status: "sent",
            type: "expense",
          });

          await notifyOwner({
            title: "New Invoice Detected via Gmail",
            content: `Invoice from ${extractedData.vendor ?? thread.from} for ${extractedData.amount ?? "unknown"} ${extractedData.currency ?? "AED"} detected. Invoice ID: ${invoiceId}`,
          });
        }

        await updateSyncLog(logId, {
          status: "success",
          message: `Scanned ${threads.length} emails, created ${actualCreated} invoices`,
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

  // Sheets sync: calls getDashboard action → imports invoices from your Google Sheet
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
      // Call your Apps Script getDashboard action which reads from the INVOICES sheet
      const dashboardData = await callAppsScript(settings.appsScriptUrl, "getDashboard");

      // Also pull raw invoices from the Invoices sheet
      const sheetInvoices: any[] = await callAppsScript(settings.appsScriptUrl, "getInvoices");

      let created = 0;
      for (const inv of sheetInvoices) {
        // Use Invoice_ID as the dedup key
        const rawId = inv.Invoice_ID ?? inv.Invoice_No;
        if (rawId) {
          const existing = await getInvoiceByRawEmailId(ctx.user.id, rawId);
          if (existing) continue;
        }

        // Map from your Apps Script schema to our DB schema
        // Apps Script fields: Invoice_ID, Invoice_No, Created_At, Client_Name, Client_Email,
        //   Title, Description, Quantity, Unit_Price, Subtotal, VAT_Amount, Total_Amount, Currency, Status
        const status = (inv.Status ?? "DRAFT").toLowerCase() as "draft" | "sent" | "paid" | "overdue" | "cancelled";
        const validStatus = ["draft", "sent", "paid", "overdue", "cancelled"].includes(status) ? status : "draft";

        await createInvoice({
          userId: ctx.user.id,
          invoiceNumber: inv.Invoice_No,
          vendor: "Mirmovsum Mirzazada", // operator is always Mimo
          clientName: inv.Client_Name,
          clientEmail: inv.Client_Email,
          description: inv.Description ?? inv.Title,
          amount: String(inv.Total_Amount ?? 0),
          currency: inv.Currency ?? "AED",
          issueDate: inv.Created_At ? new Date(inv.Created_At) : new Date(),
          source: "gmail", // sourced from Sheets (reusing gmail enum value for "external")
          rawEmailId: rawId,
          status: validStatus,
          type: "income",
          lineItems: inv.Quantity && inv.Unit_Price ? [{
            description: inv.Description ?? inv.Title ?? "Service",
            quantity: Number(inv.Quantity) || 1,
            unitPrice: Number(inv.Unit_Price) || 0,
            total: Number(inv.Subtotal) || 0,
          }] : undefined,
        });
        created++;
      }

      // Also sync dashboard metrics as a transaction summary
      const metrics = dashboardData?.metrics ?? [];
      const summaryMsg = metrics.map((m: any) => `${m.label}: ${m.value} ${m.currency}`).join(", ");

      await updateSyncLog(logId, {
        status: "success",
        message: `Synced ${sheetInvoices.length} invoices from Sheets. ${summaryMsg}`,
        itemsProcessed: sheetInvoices.length,
        itemsCreated: created,
        completedAt: new Date(),
      });

      return {
        success: true,
        itemsProcessed: sheetInvoices.length,
        itemsCreated: created,
        metrics: dashboardData?.metrics ?? [],
        recentInvoices: dashboardData?.recentInvoices ?? [],
      };
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

// ─── AI Router ────────────────────────────────────────────────────────────────
// processAi: uses your Apps Script AI (Gemini 1.5 Flash) for invoice composition
// generateInvoice: creates invoice in your Google Sheet via Apps Script
// composeInvoice / chat: uses Manus built-in LLM for local AI features
const aiRouter = router({

  // Calls your Apps Script processAi action (Gemini 1.5 Flash)
  // Returns { message: string, formData: { client_name, client_email, invoice_title,
  //   service_description, quantity, unit_price, currency } }
  processAi: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        history: z.array(
          z.object({
            role: z.enum(["user", "model"]),
            parts: z.array(z.object({ text: z.string() })),
          })
        ).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await getUserSettings(ctx.user.id);
      if (!settings?.appsScriptUrl) {
        throw new Error("Apps Script URL not configured. Please set it in Settings.");
      }
      const data = await callAppsScript(settings.appsScriptUrl, "processAi", {
        prompt: input.prompt,
        history: input.history ?? [],
      });
      // data = { message: string, formData: { client_name, client_email, ... } }
      return data as { message: string; formData: Record<string, any> };
    }),

  // Calls your Apps Script generateInvoice action → saves to Google Sheet
  // Then also saves to our local DB for full tracking
  generateInvoice: protectedProcedure
    .input(
      z.object({
        client_name: z.string(),
        client_email: z.string().optional(),
        invoice_title: z.string().optional(),
        service_description: z.string().optional(),
        quantity: z.number().optional(),
        unit_price: z.number().optional(),
        currency: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await getUserSettings(ctx.user.id);
      if (!settings?.appsScriptUrl) {
        throw new Error("Apps Script URL not configured. Please set it in Settings.");
      }

      // 1. Save to Google Sheet via Apps Script
      const sheetRecord = await callAppsScript(settings.appsScriptUrl, "generateInvoice", input);
      // sheetRecord = { Invoice_ID, Invoice_No, Created_At, Client_Name, Client_Email,
      //   Title, Description, Quantity, Unit_Price, Subtotal, VAT_Amount, Total_Amount, Currency, Status }

      // 2. Also save to local DB for full tracking
      const subtotal = (input.quantity ?? 1) * (input.unit_price ?? 0);
      const vat = subtotal * 0.05;
      const total = subtotal + vat;

      const id = await createInvoice({
        userId: ctx.user.id,
        invoiceNumber: sheetRecord?.Invoice_No,
        vendor: "Mirmovsum Mirzazada",
        clientName: input.client_name,
        clientEmail: input.client_email,
        description: input.service_description ?? input.invoice_title,
        amount: String(sheetRecord?.Total_Amount ?? total),
        currency: input.currency ?? "AED",
        issueDate: new Date(),
        source: "ai_generated",
        status: "draft",
        type: "income",
        lineItems: input.quantity && input.unit_price ? [{
          description: input.service_description ?? input.invoice_title ?? "Service",
          quantity: input.quantity,
          unitPrice: input.unit_price,
          total: subtotal,
        }] : undefined,
      });

      await notifyOwner({
        title: "New Invoice Generated",
        content: `AI-generated invoice for ${input.client_name}: ${sheetRecord?.Invoice_No ?? "N/A"}, Total: ${sheetRecord?.Total_Amount ?? total} ${input.currency ?? "AED"}`,
      });

      return { ...sheetRecord, localId: id };
    }),

  // Draft an email for an invoice via Apps Script
  draftFromInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getUserSettings(ctx.user.id);
      if (!settings?.appsScriptUrl) {
        throw new Error("Apps Script URL not configured.");
      }
      const data = await callAppsScript(settings.appsScriptUrl, "draftFromInvoice", {
        invoiceId: input.invoiceId,
      });
      return data as { id: string; status: string };
    }),

  // Create a custom Gmail draft
  createDraft: protectedProcedure
    .input(
      z.object({
        to: z.string(),
        subject: z.string(),
        body: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await getUserSettings(ctx.user.id);
      if (!settings?.appsScriptUrl) {
        throw new Error("Apps Script URL not configured.");
      }
      const data = await callAppsScript(settings.appsScriptUrl, "createDraft", input);
      return data as { id: string; status: string };
    }),

  // Local LLM compose (uses Manus built-in LLM, no Apps Script needed)
  composeInvoice: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx: _ctx, input }) => {
      const today = new Date().toISOString().split("T")[0];
      const due = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional invoice generator for Mirmovsum Mirzazada, Dubai-based consultant. Default currency: AED. Generate complete, structured invoice data from natural language descriptions. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Generate a professional invoice from this description: "${input.prompt}"${input.context ? `\n\nAdditional context: ${input.context}` : ""}. Return JSON with: invoiceNumber (format INV-${new Date().getFullYear()}-XXXX), vendor (use "Mirmovsum Mirzazada"), clientName, clientEmail, description, amount (total number), currency (default AED), issueDate ("${today}"), dueDate ("${due}"), lineItems (array of {description, quantity, unitPrice, total}), notes.`,
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

  // Local AI chat assistant
  chat: protectedProcedure
    .input(z.object({
      message: z.string(),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx: _ctx, input }) => {
      const messages: any[] = [
        {
          role: "system",
          content: `You are Mimo's Finance AI assistant for Mirmovsum Mirzazada, a Dubai-based consultant and creative professional. Help with invoice creation, financial analysis, transaction categorization, and business advice. Default currency is AED. Be concise, professional, and helpful.`,
        },
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
