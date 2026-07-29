/**
 * Mimo's Finance Command Center - Data Repository
 */
var MFIAS = MFIAS || {};

MFIAS.Repository = {
  /**
   * Gets all records from a specific sheet
   */
  getRecords: function(sheetName) {
    var ss = SpreadsheetApp.openById(MFIAS.Config.getSpreadsheetId());
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    var headers = data[0];
    var rows = data.slice(1);
    
    return rows.map(function(row) {
      var obj = {};
      headers.forEach(function(header, i) {
        obj[header] = row[i];
      });
      return obj;
    });
  },

  /**
   * Appends a single record to a sheet
   */
  insertRecord: function(sheetName, dataObj) {
    var ss = SpreadsheetApp.openById(MFIAS.Config.getSpreadsheetId());
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = headers.map(function(header) {
      return dataObj[header] !== undefined ? dataObj[header] : "";
    });
    
    sheet.appendRow(newRow);
    return true;
  },

  /**
   * Tracks status changes for invoices in a dedicated history sheet
   */
  addInvoiceHistory: function(invoiceId, statusUpdate) {
    var ss = SpreadsheetApp.openById(MFIAS.Config.getSpreadsheetId());
    var sheetName = 'Invoice_History';
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Invoice_ID', 'Status_Update', 'Timestamp']);
      // Format headers
      sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f3f3f3");
    }
    
    sheet.appendRow([invoiceId, statusUpdate, new Date()]);
    return true;
  }
};
