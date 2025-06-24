function initialSetup() {
  const SPREADSHEET_ID = "1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  let sheetEmployees = ss.getSheetByName("Employees");
  if (!sheetEmployees) {
    sheetEmployees = ss.insertSheet("Employees");
  }
  const headersEmployees = ["EmployeeID", "Username", "PasswordHash", "FullName", "Role", "Department", "ManagerID", "LeaveSickQuota", "LeaveBusinessQuota", "LeaveVacationQuota"];
  sheetEmployees.getRange("A1:J1").setValues([headersEmployees]);
  sheetEmployees.setFrozenRows(1);

  let sheetLeaveRequests = ss.getSheetByName("LeaveRequests");
  if (!sheetLeaveRequests) {
    sheetLeaveRequests = ss.insertSheet("LeaveRequests");
  }
  const headersLeave = ["RequestID", "EmployeeID", "LeaveType", "StartDate", "EndDate", "TotalDays", "Reason", "Status", "RequestTimestamp", "LastUpdateTimestamp"];
  sheetLeaveRequests.getRange("A1:J1").setValues([headersLeave]);
  sheetLeaveRequests.setFrozenRows(1);
  
  let sheetNotifications = ss.getSheetByName("Notifications");
  if (!sheetNotifications) {
    sheetNotifications = ss.insertSheet("Notifications");
  }
  const headersNoti = ["NotificationID", "TargetUserID", "Message", "LinkToRequestID", "Status", "CreatedTimestamp", "ExpiryTimestamp"];
  sheetNotifications.getRange("A1:G1").setValues([headersNoti]);
  sheetNotifications.setFrozenRows(1);

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }
  
  SpreadsheetApp.getUi().alert("Setup Completed with Department Schema!");
}
