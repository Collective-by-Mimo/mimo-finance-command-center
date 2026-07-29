/**
 * Mimo's Finance Command Center - Configuration
 */
var MFIAS = MFIAS || {};

MFIAS.Config = {
  FIXED_OPERATOR: {
    NAME: 'Mirmovsum Mirzazada',
    EMAIL: 'contact@movsummirzazada.com',
    EMAIL_LEGAL: 'legal@movsummirzazada.com',
    PHONE_UAE: '+971 58 592 9669',
    PHONE_AZE: '+994 99 7000 412',
    ADDRESS_UAE: 'Dubai, UAE',
    ADDRESS_AZE: 'Baku, Azerbaijan',
    WEBSITE: 'www.movsummirzazada.com',
    LOGO_URL: 'https://i.ibb.co/zhhm7ZzJ/Mimo-Collective-Logo-Main-Transparent-No-word.png',
    SIGNATURE_URL: 'https://i.ibb.co/bM32XPp9/Mimo-Doc-Signature-final.png',
    SEAL_URL: 'https://i.ibb.co/WvPSpVzy/main-seal-grok.jpg',
    APP_URL: 'https://ais-dev-ic23lejbogwr7eptuec343-634698103601.europe-west2.run.app'
  },

  getApiKey: function() {
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key || key === 'TO_BE_SET') throw new Error("GEMINI_API_KEY is missing in Script Properties.");
    return key;
  },

  getSpreadsheetId: function() {
    var storedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!storedId) throw new Error("SPREADSHEET_ID is missing in Script Properties. Set it via Project Settings > Script Properties.");
    return storedId;
  }
};
