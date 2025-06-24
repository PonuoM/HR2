function doGet(e) {
  if (e.pathInfo === "manifest.json") {
    return ContentService.createTextOutput(
      HtmlService.createHtmlOutputFromFile('manifest').getContent()
    ).setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('public/index').evaluate()
    .setTitle("ระบบลางานออนไลน์")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}