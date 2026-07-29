/**
 * Mimo's Finance Command Center - Gmail Automation
 */
var MFIAS = MFIAS || {};

MFIAS.GmailService = {
  /**
   * Searches for emails across the connected account
   * Recommendation: Link personal account to workspace via Gmail Settings > Accounts > Check mail from other accounts
   */
  searchEmails: function(query) {
    var threads = GmailApp.search(query, 0, 10);
    return threads.map(function(thread) {
      var lastMsg = thread.getMessages().pop();
      return {
        id: thread.getId(),
        subject: thread.getFirstMessageSubject(),
        from: lastMsg.getFrom(),
        date: lastMsg.getDate(),
        snippet: thread.getSnippet(),
        unread: thread.isUnread()
      };
    });
  },

  /**
   * Creates a draft email with automatic CC logic
   */
  createDraft: function(params) {
    var to = params.to;
    var subject = params.subject;
    var body = params.body;
    var cc = "finance@movsummirzazada.com"; // Automatic CC for finance
    
    // If there are additional CCs provided
    if (params.cc) {
      cc += "," + params.cc;
    }

    var draft = GmailApp.createDraft(to, subject, body, {
      cc: cc,
      name: "Mirmovsum Mirzazada | Mimo's Collective"
    });

    return {
      id: draft.getId(),
      to: to,
      cc: cc,
      subject: subject,
      status: "DRAFT_CREATED"
    };
  },

  /**
   * Generates an email draft based on an invoice
   */
  draftFromInvoice: function(invoiceId) {
    var invoices = MFIAS.Repository.getRecords("Invoices");
    var invoice = invoices.find(function(inv) { return inv.Invoice_ID === invoiceId; });
    
    if (!invoice) throw new Error("Invoice not found");

    var appUrl = MFIAS.Config.FIXED_OPERATOR.APP_URL;
    var previewLink = appUrl + "?invoiceId=" + invoiceId;

    var subject = "Invoice " + invoice.Invoice_No + " from Mimo's Collective";
    var body = "Dear " + invoice.Client_Name + ",\n\n" +
               "Please find the details for your recent invoice (" + invoice.Invoice_No + ") below:\n\n" +
               "Service: " + invoice.Title + "\n" +
               "Amount: " + invoice.Total_Amount + " " + invoice.Currency + "\n\n" +
               "Description: " + invoice.Description + "\n\n" +
               "You can view and download your invoice here:\n" + previewLink + "\n\n" +
               "Best regards,\n" +
               "Mirmovsum Mirzazada";

    return this.createDraft({
      to: invoice.Client_Email,
      subject: subject,
      body: body
    });
  }
};
