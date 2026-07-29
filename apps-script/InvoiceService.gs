/**
 * Mimo's Finance Command Center - Invoice Logic
 */
var MFIAS = MFIAS || {};

MFIAS.InvoiceService = {
  /**
   * Generates the invoice data structure without saving it.
   * Useful for previews and dry-runs.
   */
  generateData: function(formData) {
    var invoiceId = Utilities.getUuid();
    var timestamp = new Date();
    
    // Get sequence number (count existing invoices)
    var invoices = MFIAS.Repository.getRecords("Invoices");
    var sequence = (invoices.length + 1).toString().padStart(5, '0');
    
    // Format: #INV/MM_AE_00059_MM-YYYY-XXXX
    var month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
    var year = timestamp.getFullYear();
    var random = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    var invoiceNo = "#INV/MM_AE_" + sequence + "_MM-" + month + "-" + year + "-" + random;
    
    // Calculate totals
    var subtotal = (formData.quantity || 0) * (formData.unit_price || 0);
    var vat = subtotal * 0.05; // 5% VAT default
    var total = subtotal + vat;

    return {
      "Invoice_ID": invoiceId,
      "Invoice_No": invoiceNo,
      "Created_At": timestamp,
      "Client_Name": formData.client_name || "Draft Client",
      "Client_Email": formData.client_email || "",
      "Title": formData.invoice_title || "Untitled Invoice",
      "Description": formData.service_description || "",
      "Quantity": formData.quantity || 0,
      "Unit_Price": formData.unit_price || 0,
      "Subtotal": subtotal,
      "VAT_Amount": vat,
      "Total_Amount": total,
      "Currency": formData.currency || "AED",
      "Status": "PREVIEW",
      "Payment_Link": MFIAS.Config.FIXED_OPERATOR.APP_URL + "?invoiceId=" + invoiceId
    };
  },

  create: function(formData) {
    var record = this.generateData(formData);
    record.Status = "DRAFT"; // Set real status
    MFIAS.Repository.insertRecord("Invoices", record);
    MFIAS.Repository.addInvoiceHistory(record.Invoice_ID, "Invoice created as DRAFT");
    return record;
  },

  preview: function(formData) {
    return this.generateData(formData);
  }
};
