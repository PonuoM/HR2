function doGet(e) {
  // สร้าง HTML จากไฟล์ template ของคุณ
  var html = HtmlService.createTemplateFromFile('public/index').evaluate();
  
  // *** บรรทัดสำคัญในการแก้ปัญหา ***
  // เพิ่ม Viewport Meta Tag ด้วยวิธีของ Apps Script
  html.addMetaTag('viewport', 'content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"');
  
  return html;
}

// ฟังก์ชันนี้จำเป็นเพื่อให้ <?!= include(...) ?> ใน HTML ทำงานได้
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}