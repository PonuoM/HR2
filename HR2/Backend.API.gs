function _validateToken(token) {
    if (!token) return null;
    const userCache = CacheService.getUserCache();
    const sessionData = userCache.get(token);
    return sessionData ? JSON.parse(sessionData) : null;
}

function getDashboardData(token) {
    const user = _validateToken(token);
    if (!user) return { error: "Invalid session" };
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const leaveBalance = _getLeaveBalance(ss, user.employeeId);
        let dashboardData = {
            leaveBalance: leaveBalance,
            managerTasks: [],
            hrTasks: []
        };
        if (user.role === "Manager" || user.role === "Supervisor") {
             dashboardData.managerTasks = _getManagerTasks(ss, user.employeeId);
        }
        if (user.role === "HR") {
            dashboardData.hrTasks = _getHRTasks(ss);
        }
        return dashboardData;
    } catch (e) {
        Logger.log(e.toString());
        return { error: `เกิดข้อผิดพลาดในการโหลดข้อมูล: ${e.message}` };
    }
}

function getHRManagementData(token) {
    const user = _validateToken(token);
    if (!user || user.role !== 'HR') return { success: false, message: 'ไม่มีสิทธิ์เข้าถึง' };
    
    const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
    const empSheet = ss.getSheetByName("Employees");
    const empData = empSheet.getDataRange().getValues();
    const headers = empData.shift();
    const deptIndex = headers.indexOf("Department");
    const roleIndex = headers.indexOf("Role");
    const idIndex = headers.indexOf("EmployeeID");
    const nameIndex = headers.indexOf("FullName");

    const empList = empData.map(row => {
        let empObject = {};
        headers.forEach((header, index) => {
            if (header !== "PasswordHash") { empObject[header] = row[index]; }
        });
        return empObject;
    });

    const departments = [...new Set(empData.map(row => row[deptIndex]).filter(Boolean))];
    const potentialManagers = empData
        .filter(row => row[roleIndex] === 'Manager' || row[roleIndex] === 'Supervisor')
        .map(row => ({ id: row[idIndex], name: row[nameIndex], department: row[deptIndex] }));

    return { success: true, employees: empList, departments: departments, managers: potentialManagers };
}

function addNewEmployee(token, newEmployeeData) {
    const user = _validateToken(token);
    if (!user || user.role !== 'HR') return { success: false, message: 'ไม่มีสิทธิ์เข้าถึง' };
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const empSheet = ss.getSheetByName("Employees");
        
        const lastRow = empSheet.getLastRow();
        const existingUsers = lastRow > 1 ? empSheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
        const idExists = existingUsers.some(row => row[0] === newEmployeeData.EmployeeID);
        const usernameExists = existingUsers.some(row => row[1] === newEmployeeData.Username);

        if (idExists) { return { success: false, message: "รหัสพนักงานนี้มีอยู่แล้วในระบบ" }; }
        if (usernameExists) { return { success: false, message: "Username นี้มีอยู่แล้วในระบบ" }; }
        
        const defaultPassword = newEmployeeData.EmployeeID + "@pass";
        const passwordHash = _hashPasswordForNewUser(defaultPassword);
        
        const newRow = [
            newEmployeeData.EmployeeID, newEmployeeData.Username, passwordHash,
            newEmployeeData.FullName, newEmployeeData.Role, newEmployeeData.Department,
            newEmployeeData.ManagerID, newEmployeeData.LeaveSickQuota, newEmployeeData.LeaveBusinessQuota,
            newEmployeeData.LeaveVacationQuota
        ];
        empSheet.appendRow(newRow);
        
        return { success: true, message: `เพิ่มพนักงาน ${newEmployeeData.FullName} สำเร็จ\nรหัสผ่านเริ่มต้นคือ: ${defaultPassword}` };
    } catch (e) {
        Logger.log(e.toString());
        return { success: false, message: `เกิดข้อผิดพลาด: ${e.message}` };
    }
}

function _hashPasswordForNewUser(password) {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
    return digest.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function _getLeaveBalance(spreadsheet, employeeId) {
    const empSheet = spreadsheet.getSheetByName("Employees");
    const leaveReqSheet = spreadsheet.getSheetByName("LeaveRequests");
    const empData = empSheet.getDataRange().getValues();
    const headers = empData[0];
    const empHeaders = {
        employeeID: headers.indexOf("EmployeeID"),
        sickQuota: headers.indexOf("LeaveSickQuota"),
        businessQuota: headers.indexOf("LeaveBusinessQuota"),
        vacationQuota: headers.indexOf("LeaveVacationQuota")
    };
    const employeeRow = empData.find(row => row[empHeaders.employeeID] === employeeId);
    if (!employeeRow) return {
        LeaveSick: { quota: 0, used: 0 },
        LeaveBusiness: { quota: 0, used: 0 },
        LeaveVacation: { quota: 0, used: 0 }
    };
    
    const leaveData = leaveReqSheet.getLastRow() > 1 ? leaveReqSheet.getRange(2, 1, leaveReqSheet.getLastRow() - 1, 8).getValues() : [];
    
    const usedSick = leaveData.filter(r => r[1] === employeeId && r[2] === "LeaveSick" && r[7] === "Approved").reduce((sum, r) => sum + Number(r[5]), 0);
    const usedBusiness = leaveData.filter(r => r[1] === employeeId && r[2] === "LeaveBusiness" && r[7] === "Approved").reduce((sum, r) => sum + Number(r[5]), 0);
    const usedVacation = leaveData.filter(r => r[1] === employeeId && r[2] === "LeaveVacation" && r[7] === "Approved").reduce((sum, r) => sum + Number(r[5]), 0);
  
    return {
      LeaveSick: { quota: Number(employeeRow[empHeaders.sickQuota]), used: usedSick },
      LeaveBusiness: { quota: Number(employeeRow[empHeaders.businessQuota]), used: usedBusiness },
      LeaveVacation: { quota: Number(employeeRow[empHeaders.vacationQuota]), used: usedVacation }
    };
}

function getAllNotifications(token) {
    const user = _validateToken(token);
    if (!user) return []; 
    const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
    const notiSheet = ss.getSheetByName("Notifications");
    if(notiSheet.getLastRow() < 2) return [];
    const notiData = notiSheet.getRange(2, 1, notiSheet.getLastRow() - 1, notiSheet.getLastColumn()).getValues();
    const userNotifications = [];
    const now = new Date();
    for (const row of notiData) {
        if (row[1] === user.employeeId && new Date(row[6]) > now) {
            userNotifications.push({
                notificationId: row[0], message: row[2], linkToRequestId: row[3], status: row[4],
                createdDate: new Date(row[5]).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
            });
        }
    }
    return userNotifications.sort((a,b) => new Date(b.createdDate) - new Date(a.createdDate));
}

function markNotificationsAsRead(token, notificationIds) {
    const user = _validateToken(token);
    if (!user) return { success: false, message: "Invalid session" };
    if (!notificationIds || notificationIds.length === 0) return { success: true };
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const notiSheet = ss.getSheetByName("Notifications");
        const dataRange = notiSheet.getRange("A:E");
        const data = dataRange.getValues();
        for (let i = 1; i < data.length; i++) {
            if (notificationIds.includes(data[i][0])) {
                notiSheet.getRange(i + 1, 5).setValue("Read");
            }
        }
        return { success: true };
    } catch(e) {
        return { success: false, message: e.message };
    }
}

function submitLeaveRequest(token, leaveData) {
  const user = _validateToken(token);
  if (!user) return { success: false, message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  try {
    const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
    const balance = _getLeaveBalance(ss, user.employeeId);
    
    const startDate = new Date(leaveData.startDate);
    const endDate = new Date(leaveData.endDate);
    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (totalDays <= 0) return { success: false, message: "จำนวนวันลาไม่ถูกต้อง" };
    
    const remaining = balance[leaveData.leaveType].quota - balance[leaveData.leaveType].used;
    if(totalDays > remaining) {
      return { success: false, message: `วันลาประเภทนี้คงเหลือไม่พอ (เหลือ ${remaining} วัน)` };
    }

    const empSheet = ss.getSheetByName("Employees");
    const empDataRange = empSheet.getRange("A:G");
    const empValues = empDataRange.getValues();
    let managerId = null;
    for (let i = 1; i < empValues.length; i++) {
        if (empValues[i][0] === user.employeeId) { managerId = empValues[i][6]; break; }
    }
    if (!managerId) return { success: false, message: "ไม่พบข้อมูลหัวหน้างานของคุณในระบบ" };

    const leaveReqSheet = ss.getSheetByName("LeaveRequests");
    const newRequestId = "LR" + Utilities.getUuid().substring(0, 5).toUpperCase();
    leaveReqSheet.appendRow([ newRequestId, user.employeeId, leaveData.leaveType, startDate.toISOString(), endDate.toISOString(), totalDays, leaveData.reason, "Pending Manager", new Date().toISOString(), new Date().toISOString() ]);
    
    const leaveTypeTh = { LeaveSick: "ลาป่วย", LeaveBusiness: "ลากิจ", LeaveVacation: "ลาพักร้อน" };
    _createNotification(ss, managerId, `มีคำขออนุมัติ (${leaveTypeTh[leaveData.leaveType]}) จากคุณ ${user.fullName}`, newRequestId);
    
    return { success: true, message: "ยื่นใบลาสำเร็จ! รอการอนุมัติ" };
  } catch (e) {
    Logger.log(e.toString());
    return { success: false, message: `เกิดข้อผิดพลาด: ${e.message}` };
  }
}

function approveLeaveRequest(token, requestId) {
    const user = _validateToken(token);
    if (!user) return { success: false, message: "Invalid session" };
    const nextStatus = "Pending HR";
    const messageForEmployee = `ใบลา (ID: ${requestId}) ได้รับการอนุมัติจากหัวหน้าแล้ว รอฝ่ายบุคคลตรวจสอบ`;
    return _updateLeaveStatus(requestId, nextStatus, messageForEmployee, true);
}

function rejectLeaveRequest(token, requestId) {
    const user = _validateToken(token);
    if (!user) return { success: false, message: "Invalid session" };
    const nextStatus = "Rejected";
    const messageForEmployee = `ใบลา (ID: ${requestId}) ถูกปฏิเสธโดยหัวหน้างาน`;
    return _updateLeaveStatus(requestId, nextStatus, messageForEmployee, false);
}

function finalizeApproval(token, requestId) {
    const user = _validateToken(token);
    if (!user) return { success: false, message: "Invalid session" };
    const nextStatus = "Approved";
    const messageForEmployee = `ใบลาของคุณ (ID: ${requestId}) ได้รับการอนุมัติเรียบร้อยแล้ว`;
    return _updateLeaveStatus(requestId, nextStatus, messageForEmployee, false);
}

function finalizeRejection(token, requestId) {
    const user = _validateToken(token);
    if (!user) return { success: false, message: "Invalid session" };
    const nextStatus = "Rejected";
    const messageForEmployee = `ใบลาของคุณ (ID: ${requestId}) ถูกปฏิเสธโดยฝ่ายบุคคล`;
    return _updateLeaveStatus(requestId, nextStatus, messageForEmployee, false);
}

function _updateLeaveStatus(requestId, newStatus, messageForEmployee, notifyHR) {
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const leaveSheet = ss.getSheetByName("LeaveRequests");
        
        const textFinder = leaveSheet.getRange("A:A").createTextFinder(requestId);
        const foundCell = textFinder.findNext();
        if (!foundCell) return { success: false, message: "ไม่พบใบลาที่ต้องการ (ID: " + requestId + ")" };
        
        const targetRowIndex = foundCell.getRow();
        const employeeId = leaveSheet.getRange(targetRowIndex, 2).getValue();
        const leaveType = leaveSheet.getRange(targetRowIndex, 3).getValue();
        
        leaveSheet.getRange(targetRowIndex, 8).setValue(newStatus);
        leaveSheet.getRange(targetRowIndex, 10).setValue(new Date().toISOString());

        _createNotification(ss, employeeId, messageForEmployee, requestId);

        if (notifyHR) {
             const empSheet = ss.getSheetByName("Employees");
             const empData = empSheet.getDataRange().getValues();
             const headers = empData[0];
             const roleIndex = headers.indexOf("Role");
             const idIndex = headers.indexOf("EmployeeID");
             const nameIndex = headers.indexOf("FullName");
             
             const hrUsers = empData.filter(row => row[roleIndex] === "HR");
             
             const employeeNameRow = empData.find(row => row[idIndex] === employeeId);
             const employeeName = employeeNameRow ? employeeNameRow[nameIndex] : employeeId;

             hrUsers.forEach(hr => {
                 const hrId = hr[idIndex];
                 const leaveTypeMap = {'LeaveVacation':'ลาพักร้อน', 'LeaveBusiness':'ลากิจ', 'LeaveSick':'ลาป่วย'};
                 const messageForHR = `มีคำขอลา (${leaveTypeMap[leaveType] || leaveType}) จากคุณ ${employeeName} รอการตรวจสอบ`;
                 _createNotification(ss, hrId, messageForHR, requestId);
             });
        }
        
        return { success: true, message: `ดำเนินการสำเร็จ! อัปเดตสถานะเป็น ${newStatus}` };

    } catch(e) {
        return { success: false, message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล: " + e.message };
    }
}

function _createNotification(spreadsheet, targetUserId, message, linkRequestId) {
    const notiSheet = spreadsheet.getSheetByName("Notifications");
    const newNotiId = "NOTI" + Utilities.getUuid().substring(0, 5).toUpperCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    const now = new Date().toISOString();
    notiSheet.appendRow([ newNotiId, targetUserId, message, linkRequestId, "Unread", now, expiryDate.toISOString() ]);
}

function _getManagerTasks(spreadsheet, managerId) {
    const empSheet = spreadsheet.getSheetByName("Employees");
    const leaveSheet = spreadsheet.getSheetByName("LeaveRequests");
    const employees = empSheet.getRange("A2:H" + empSheet.getLastRow()).getValues();
    const leaveRequests = leaveSheet.getRange("A2:I" + leaveSheet.getLastRow()).getValues();
    const subordinateIds = employees.filter(emp => emp[6] === managerId).map(emp => emp[0]);
    if (subordinateIds.length === 0) return [];
    const employeeIdToNameMap = new Map(employees.map(emp => [emp[0], emp[3]]));
    const tasks = leaveRequests
        .filter(req => subordinateIds.includes(req[1]) && req[7] === 'Pending Manager')
        .map(req => ({
            requestId: req[0], employeeName: employeeIdToNameMap.get(req[1]) || 'Unknown', leaveType: req[2],
            startDate: new Date(req[3]).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric'}),
            endDate: new Date(req[4]).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric'}),
            totalDays: req[5], reason: req[6]
        }));
    return tasks;
}

function _getHRTasks(spreadsheet) {
    const empSheet = spreadsheet.getSheetByName("Employees");
    const leaveSheet = spreadsheet.getSheetByName("LeaveRequests");
    const employees = empSheet.getRange("A2:D" + empSheet.getLastRow()).getValues();
    const leaveRequests = leaveSheet.getRange("A2:I" + leaveSheet.getLastRow()).getValues();
    const employeeIdToNameMap = new Map(employees.map(emp => [emp[0], emp[3]]));
    const tasks = leaveRequests
        .filter(req => req[7] === 'Pending HR')
        .map(req => ({
            requestId: req[0], employeeName: employeeIdToNameMap.get(req[1]) || 'Unknown', leaveType: req[2],
            startDate: new Date(req[3]).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric'}),
            endDate: new Date(req[4]).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric'}),
            totalDays: req[5], reason: req[6]
        }));
    return tasks;
}

function cleanupOldNotifications() {
    const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
    const notiSheet = ss.getSheetByName("Notifications");
    if (notiSheet.getLastRow() < 2) return;
    const data = notiSheet.getDataRange().getValues();
    const rowsToDelete = [];
    const now = new Date();
    for (let i = data.length - 1; i > 0; i--) {
        const status = data[i][4];
        const expiryDate = new Date(data[i][6]);
        const createdDate = new Date(data[i][5]);
        const isExpired = expiryDate < now;
        const isReadAndOld = (status === 'Read' && (now.getTime() - createdDate.getTime()) > (30 * 24 * 60 * 60 * 1000));
        if (isExpired || isReadAndOld) { rowsToDelete.push(i + 1); }
    }
    if (rowsToDelete.length > 0) { for (const rowIndex of rowsToDelete) { notiSheet.deleteRow(rowIndex); } }
}

function updateEmployeeData(token, employeeUpdate) {
    const user = _validateToken(token);
    if (!user || user.role !== 'HR') return { success: false, message: 'ไม่มีสิทธิ์เข้าถึง' };
    
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const empSheet = ss.getSheetByName("Employees");
        const empData = empSheet.getDataRange().getValues();
        const headers = empData[0];
        const targetRowIndex = empData.findIndex(row => row[headers.indexOf("EmployeeID")] === employeeUpdate.EmployeeID);
        
        if (targetRowIndex !== -1) {
            const rowNumber = targetRowIndex + 1;
            headers.forEach((header, index) => {
                if (employeeUpdate.hasOwnProperty(header)) {
                    empSheet.getRange(rowNumber, index + 1).setValue(employeeUpdate[header]);
                }
            });
            return { success: true, message: `อัปเดตข้อมูลคุณ ${employeeUpdate.FullName} สำเร็จ` };
        } else {
            return { success: false, message: 'ไม่พบพนักงานที่ต้องการแก้ไข' };
        }
    } catch(e) {
        return { success: false, message: `เกิดข้อผิดพลาด: ${e.message}` };
    }
}

function changeUserPassword(token, oldPassword, newPassword) {
    const user = _validateToken(token);
    if (!user) return { success: false, message: "Session ไม่ถูกต้อง" };
    
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const empSheet = ss.getSheetByName("Employees");
        const empData = empSheet.getDataRange().getValues();
        const headers = empData.shift();
        const idIndex = headers.indexOf("EmployeeID");
        const hashIndex = headers.indexOf("PasswordHash");

        const userRowIndex = empData.findIndex(row => row[idIndex] === user.employeeId);

        if (userRowIndex === -1) {
            return { success: false, message: "ไม่พบข้อมูลผู้ใช้ในระบบ" };
        }

        const storedHash = empData[userRowIndex][hashIndex];
        const oldPasswordHash = _hashPasswordForNewUser(oldPassword);

        if (storedHash !== oldPasswordHash) {
            return { success: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
        }
        
        const newPasswordHash = _hashPasswordForNewUser(newPassword);
        empSheet.getRange(userRowIndex + 2, hashIndex + 1).setValue(newPasswordHash);
        
        return { success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ!" };

    } catch (e) {
        Logger.log("Change Password Error: " + e.toString());
        return { success: false, message: "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน" };
    }
}

function getLeaveHistory(token) {
    const user = _validateToken(token);
    if (!user) return { success: false, history: [] };
    try {
        const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
        const leaveSheet = ss.getSheetByName("LeaveRequests");
        if (leaveSheet.getLastRow() < 2) return { success: true, history: [] };

        const leaveData = leaveSheet.getRange(2, 1, leaveSheet.getLastRow() - 1, leaveSheet.getLastColumn()).getValues();
        const userHistory = [];
        const leaveTypeMap = {'LeaveVacation':'ลาพักร้อน', 'LeaveBusiness':'ลากิจ', 'LeaveSick':'ลาป่วย'};
        const statusMap = {'Approved':'อนุมัติแล้ว', 'Rejected':'ปฏิเสธ', 'Pending Manager':'รอหัวหน้าอนุมัติ', 'Pending HR': 'รอ HR อนุมัติ'};


        for(const row of leaveData){
            if(row[1] === user.employeeId) {
                userHistory.push({
                    requestDate: new Date(row[8]).toLocaleDateString('th-TH'),
                    leaveType: leaveTypeMap[row[2]] || row[2],
                    startDate: new Date(row[3]).toLocaleDateString('th-TH'),
                    endDate: new Date(row[4]).toLocaleDateString('th-TH'),
                    totalDays: row[5],
                    status: statusMap[row[7]] || row[7],
                    statusClass: row[7]
                });
            }
        }
        return { success: true, history: userHistory.reverse() };
    } catch(e) {
        Logger.log("Get History Error: " + e.toString());
        return { success: false, history: [] };
    }
}