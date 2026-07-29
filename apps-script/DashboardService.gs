/**
 * Mimo's Finance Command Center - Dashboard Logic
 */
var MFIAS = MFIAS || {};

MFIAS.DashboardService = {
  getData: function() {
    var invoices = MFIAS.Repository.getRecords("Invoices");
    
    var totalInvoiced = 0;
    var totalOutstanding = 0;
    var receivedThisMonth = 0;
    var now = new Date();
    
    invoices.forEach(function(inv) {
      var amount = parseFloat(inv.Total_Amount) || 0;
      totalInvoiced += amount;
      
      if (inv.Status !== "PAID") {
        totalOutstanding += amount;
      }
      
      var date = new Date(inv.Created_At);
      if (inv.Status === "PAID" && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        receivedThisMonth += amount;
      }
    });

    return {
      metrics: [
        { label: "Total Invoiced", value: totalInvoiced, currency: "AED" },
        { label: "Total Outstanding", value: totalOutstanding, currency: "AED" },
        { label: "Received (Month)", value: receivedThisMonth, currency: "AED" },
        { label: "Active Invoices", value: invoices.length, currency: "COUNT" }
      ],
      recentInvoices: invoices.slice(-5).reverse() // Last 5 invoices
    };
  }
};
