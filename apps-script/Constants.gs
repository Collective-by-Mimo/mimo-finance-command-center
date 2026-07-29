/**
 * Mimo's Finance Command Center - Constants
 */
var MFIAS = MFIAS || {};

MFIAS.Constants = {
  APP_NAME: "Mimo's Finance Command Center",
  VERSION: "2.0.0",
  TIMEZONE: "Asia/Dubai",
  DEFAULT_CURRENCY: "AED",
  
  SHEETS: {
    INVOICES: "INVOICES",
    CLIENTS: "CLIENTS",
    BANK_ACCOUNTS: "BANK_ACCOUNTS",
    TRANSACTIONS: "TRANSACTIONS",
    INCOME_TRACKER: "INCOME_TRACKER",
    EXPENSES_TRACKER: "EXPENSES_TRACKER",
    LOANS_AND_CREDITS: "LOANS_AND_CREDITS",
    DEADLINES: "DEADLINES",
    LOOKUPS: "LOOKUPS",
    DASHBOARD: "DASHBOARD"
  },

  SERVICE_CATEGORIES: [
    { group: 'PROFESSIONAL SERVICES', items: ['Management Consulting', 'Business Strategy Advisory', 'Project Management', 'Operations Consulting'] },
    { group: 'CREATIVE & MEDIA', items: ['Creative Direction', 'Content Creation', 'Brand Development', 'Photography & Videography'] },
    { group: 'PERFORMANCE', items: ['Acting Services', 'Film Direction', 'Commercial Performance', 'Voice Over Services'] },
    { group: 'DIGITAL', items: ['Digital Marketing', 'Website Development', 'SEO & Online Presence', 'Automation & AI Services'] },
    { group: 'FREELANCE', items: ['General Freelance Work', 'Short-term Project', 'Research Services'] }
  ]
};
