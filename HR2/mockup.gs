function populateMockData() {
  const SPREADSHEET_ID_MOCKUP = "1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_MOCKUP);
  const sheetEmployees = ss.getSheetByName("Employees");
  const sheetLeaveRequests = ss.getSheetByName("LeaveRequests");
  const sheetNotifications = ss.getSheetByName("Notifications");

  if (!sheetEmployees || !sheetLeaveRequests || !sheetNotifications) {
    SpreadsheetApp.getUi().alert("ชีตบางชีตหายไป! กรุณารัน initialSetup() ก่อน");
    return;
  }
  
  clearSheetData_(sheetEmployees);
  clearSheetData_(sheetLeaveRequests);
  clearSheetData_(sheetNotifications);

  _populateEmployees(sheetEmployees);
  _populateLeaveRequests(sheetLeaveRequests);
  
  SpreadsheetApp.getUi().alert("สร้างข้อมูลตัวอย่างเสร็จสมบูรณ์!");
}

function clearSheetData_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
}

function _hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function _populateEmployees(sheet) {
  const commonPasswordHash = _hashPassword("admin1");
  const employeesData = [
    ["EMP001", "john.d", commonPasswordHash, "สมชาย ใจดี", "Employee", "IT Support", "MGR001", 30, 7, 6],
    ["EMP002", "jane.s", commonPasswordHash, "สมหญิง มุ่งมั่น", "Employee", "Sales", "MGR002", 30, 7, 8],
    ["EMP003", "david.p", commonPasswordHash, "เดวิด โปรแกรม", "Employee", "Development", "SUP001", 30, 7, 10],
    ["SUP001", "sara.c", commonPasswordHash, "สาระ หัวหน้าทีม", "Supervisor", "Development", "MGR001", 30, 7, 10],
    ["MGR001", "peter.j", commonPasswordHash, "พิเชษฐ์ บริหาร", "Manager", "IT", "", 30, 7, 12],
    ["MGR002", "mary.w", commonPasswordHash, "มารี วางแผน", "Manager", "Sales", "", 30, 7, 12],
    ["HR001",  "hr.admin", commonPasswordHash, "มานี มีแผนก", "HR", "HR", "", 30, 9, 15]
  ];
  sheet.getRange(2, 1, employeesData.length, employeesData[0].length).setValues(employeesData);
}

function _populateLeaveRequests(sheet) {
    const requestsData = [
      ["LR00003", "EMP001", "LeaveVacation", "2024-05-01T00:00:00.000Z", "2024-05-01T00:00:00.000Z", 1, "พักผ่อนประจำปี", "Approved", "2024-04-20T10:00:00.000Z", "2024-04-25T11:00:00.000Z"]
  ];
  if(requestsData.length > 0) {
    sheet.getRange(2, 1, requestsData.length, requestsData[0].length).setValues(requestsData);
  }
}