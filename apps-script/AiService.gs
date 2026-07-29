/**
 * Mimo's Finance Command Center - AI Engine (Gemini 1.5 Flash)
 */
var MFIAS = MFIAS || {};

MFIAS.AiService = {
  processPrompt: function(history, prompt) {
    var apiKey = MFIAS.Config.getApiKey();
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;

    var systemInstruction = "You are the AI Assistant for Mimo's Finance Command Center.\n" +
      "Help Mirmovsum Mirzazada draft invoices. Operator is in Dubai (AED).\n" +
      "Extract: client_name, client_email, invoice_title, service_description, quantity, unit_price, currency (default AED).\n" +
      "Always return valid JSON:\n" +
      "{\n" +
      "  \"message\": \"Conversational reply\",\n" +
      "  \"formData\": { ...fields... }\n" +
      "}";

    var contents = history || [];
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    var payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: contents,
      generationConfig: { responseMimeType: 'application/json' }
    };

    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());
    if (result.error) throw new Error(result.error.message);
    
    return result.candidates[0].content.parts[0].text;
  }
};
