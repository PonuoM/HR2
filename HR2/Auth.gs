function loginUser(username, password) {
  try {
    const incomingPasswordHash = hashPasswordForLogin(password);

    const ss = SpreadsheetApp.openById("1wI1mBucukSkHOfsxrh5iDDbqTRrISgzhAbpcqZV7MyQ");
    const sheet = ss.getSheetByName("Employees");
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    for (const row of data) {
      const storedUsername = row[1];
      const storedPasswordHash = row[2];

      if (storedUsername.toLowerCase() === username.toLowerCase() && storedPasswordHash === incomingPasswordHash) {
        
        const sessionToken = Utilities.getUuid();
        const userPayload = {
          employeeId: row[0],
          username: storedUsername,
          fullName: row[3],
          role: row[4],
        };
        
        const userCache = CacheService.getUserCache();
        userCache.put(sessionToken, JSON.stringify(userPayload), 21600); 
        
        return { 
            isLoggedIn: true, 
            sessionToken: sessionToken,
            user: userPayload 
        };
      }
    }

    return { isLoggedIn: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };

  } catch (e) {
    Logger.log(e.toString());
    return { isLoggedIn: false, error: "เกิดข้อผิดพลาดในการ Login" };
  }
}

function checkUserSession(token) {
    if (!token) return { isLoggedIn: false };

    const userCache = CacheService.getUserCache();
    const sessionData = userCache.get(token);

    if (sessionData) {
        const user = JSON.parse(sessionData);
        return { 
            isLoggedIn: true,
            sessionToken: token,
            user: user
        };
    }
    return { isLoggedIn: false };
}

function logoutUser(token) {
    if (token) {
        const userCache = CacheService.getUserCache();
        userCache.remove(token);
    }
    return { loggedOut: true };
}

function hashPasswordForLogin(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}