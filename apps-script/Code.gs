/**
 * Mimo's Finance Command Center - Main Entry Point & API Bridge
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle("Mimo's Finance Command Center")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handles incoming POST requests from the React Frontend
 */
function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    var response = apiHandler(request);
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: "API Error: " + err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Central API Handler
 */
function apiHandler(request) {
  try {
    var action = request.action;
    var data = request.data || {};

    switch (action) {
      case 'getDashboard':
        return { success: true, data: MFIAS.DashboardService.getData() };
      case 'getInvoices':
        return { success: true, data: MFIAS.Repository.getRecords("Invoices") };
      case 'processAi':
        var aiResponse = MFIAS.AiService.processPrompt(data.history || [], data.prompt);
        return { success: true, data: JSON.parse(aiResponse) };
      case 'generateInvoice':
        var result = MFIAS.InvoiceService.create(data);
        return { success: true, data: result };
      case 'previewInvoice':
        var result = MFIAS.InvoiceService.preview(data);
        return { success: true, data: result };
      case 'runSetup':
        return { success: true, data: MFIAS.Schema.setup() };
      
      // --- Gmail Commands ---
      case 'searchEmails':
        return { success: true, data: MFIAS.GmailService.searchEmails(data.query) };
      case 'createDraft':
        return { success: true, data: MFIAS.GmailService.createDraft(data) };
      case 'draftFromInvoice':
        return { success: true, data: MFIAS.GmailService.draftFromInvoice(data.invoiceId) };
      case 'verifyGmail':
        return { 
          success: true, 
          data: {
            userEmail: Session.getActiveUser().getEmail(),
            effectiveUser: Session.getEffectiveUser().getEmail(),
            canAccessGmail: true,
            timestamp: new Date().toISOString()
          }
        };
        
      default:
        throw new Error("Unknown action: " + action);
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function runSetup() {
  return MFIAS.Schema.setup();
}

/**
 * Run this function manually in the Apps Script editor to test your setup.
 */
function testConnection() {
  var report = {
    timestamp: new Date().toISOString(),
    spreadsheet: "FAILED",
    gmail: "FAILED",
    scriptProperties: "FAILED",
    errors: []
  };

  try {
    var ss = SpreadsheetApp.openById(MFIAS.Config.getSpreadsheetId());
    report.spreadsheet = "OK (ID: " + ss.getId() + ")";
  } catch (e) {
    report.errors.push("Spreadsheet Error: " + e.message);
  }

  try {
    var email = Session.getActiveUser().getEmail();
    report.gmail = "OK (User: " + email + ")";
  } catch (e) {
    report.errors.push("Gmail/Session Error: " + e.message);
  }

  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    report.scriptProperties = "OK (Found " + Object.keys(props).length + " properties)";
  } catch (e) {
    report.errors.push("Properties Error: " + e.message);
  }

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
