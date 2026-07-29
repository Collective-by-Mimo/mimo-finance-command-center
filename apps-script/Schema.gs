/**
 * Mimo's Finance Command Center - Database Setup
 */
var MFIAS = MFIAS || {};

MFIAS.Schema = {
  setup: function() {
    var ss = SpreadsheetApp.openById(MFIAS.Config.getSpreadsheetId());
    
    // Setup Invoices Sheet
    var invoiceSheet = ss.getSheetByName("Invoices");
    if (!invoiceSheet) {
      invoiceSheet = ss.insertSheet("Invoices");
      var headers = [
        "Invoice_ID", "Invoice_No", "Created_At", "Client_Name", "Client_Email", 
        "Title", "Description", "Quantity", "Unit_Price", "Subtotal", 
        "VAT_Amount", "Total_Amount", "Currency", "Status", "Payment_Link"
      ];
      invoiceSheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight("bold")
        .setBackground("#f3f3f3");
      invoiceSheet.setFrozenRows(1);
    }
    
    return "Setup Complete";
  }
};
