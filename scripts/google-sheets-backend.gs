/**
 * EPHPHATHA MASTER DATABASE & REAL-TIME MULTI-USER CLOUD SYNC ENGINE
 * Google Apps Script Web App for Google Sheets (Ephphatha_Master_DB)
 *
 * Capabilities:
 *  1. User Profile & Passwordless Login: Persists user profiles and retrieves all completed reading/audio progress when logging back in.
 *  2. Multi-User Fellowship Cohort Sync: Persists cohorts, member rosters, reflection streams, and prayer requests.
 *  3. Auto-Provisioning: Automatically initializes all 6 relational sheets with headers if they do not exist.
 *  4. Concurrency Protection: Uses LockService to prevent race conditions during simultaneous multi-user writes.
 *  5. Cross-Origin Support: Seamlessly handles web clients, Cloudflare Edge Worker, and local development servers.
 *
 * HOW TO DEPLOY:
 *  1. Open your Google Sheet (e.g., Ephphatha_Master_DB) or https://script.google.com
 *  2. Paste this script into Extensions > Apps Script (replace any existing code)
 *  3. Click "Deploy" > "New Deployment"
 *  4. Select type: "Web app"
 *  5. Execute as: "Me" | Who has access: "Anyone"
 *  6. Copy the Web App URL and paste it into Ephphatha Settings!
 */

const SHEET_NAMES = {
  USERS: 'Users',
  PROGRESS: 'Progress_Logs',
  COHORTS: 'Fellowship_Cohorts',
  MEMBERS: 'Cohort_Members',
  REFLECTIONS: 'Cohort_Reflections',
  PRAYERS: 'Cohort_Prayers'
};

const SHEET_HEADERS = {
  [SHEET_NAMES.USERS]: ['user_id', 'display_name', 'email_or_contact', 'auth_method', 'streak_days', 'grace_shields', 'active_cohort_code', 'last_active_day', 'updated_at'],
  [SHEET_NAMES.PROGRESS]: ['user_id', 'day_number', 'completed', 'audio_timestamp_sec', 'updated_at'],
  [SHEET_NAMES.COHORTS]: ['cohort_id', 'invite_code', 'cohort_name', 'created_by_user_id', 'created_at', 'updated_at'],
  [SHEET_NAMES.MEMBERS]: ['invite_code', 'member_id', 'name', 'role', 'current_day', 'completed_count', 'streak_days', 'activity_status', 'encouragements', 'updated_at'],
  [SHEET_NAMES.REFLECTIONS]: ['invite_code', 'reflection_id', 'author_id', 'author_name', 'day_number', 'passage_ref', 'content', 'amen_count', 'created_at'],
  [SHEET_NAMES.PRAYERS]: ['invite_code', 'prayer_id', 'author_id', 'author_name', 'is_anonymous', 'category', 'content', 'praying_count', 'is_answered', 'created_at']
};

function doGet(e) {
  return handleRequest_(e ? e.parameter : {}, null);
}

function doPost(e) {
  var params = e ? e.parameter : {};
  var body = null;
  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      try {
        body = JSON.parse(decodeURIComponent(e.postData.contents));
      } catch (err) {
        body = params;
      }
    }
  } else {
    body = params;
  }
  return handleRequest_(params, body);
}

function handleRequest_(params, body) {
  var action = (params.action || (body && body.action) || 'ping').toLowerCase();
  var payload = body && body.payload ? body.payload : (body || params);

  try {
    var ss = getSpreadsheet_();
    ensureAllSheetsExist_(ss);

    var result = { ok: true, action: action, timestamp: new Date().toISOString() };

    switch (action) {
      case 'ping':
        result.message = 'Ephphatha Google Sheets Master DB Active';
        result.spreadsheetTitle = ss.getName();
        result.spreadsheetId = ss.getId();
        break;

      case 'login':
      case 'getuser':
        result.data = handleGetUser_(ss, payload);
        break;

      case 'syncuser':
      case 'saveuser':
        result.data = handleSaveUser_(ss, payload);
        break;

      case 'getcohort':
        result.data = handleGetCohort_(ss, payload);
        break;

      case 'savecohort':
        result.data = handleSaveCohort_(ss, payload);
        break;

      case 'syncprogress':
        result.data = handleSyncProgress_(ss, payload);
        break;

      default:
        result.ok = false;
        result.error = 'Unknown action: ' + action;
        break;
    }

    return respondJson_(result);
  } catch (error) {
    return respondJson_({
      ok: false,
      action: action,
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    });
  }
}

function respondJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    // If running as standalone script bound to ScriptApp, open by specific ID if configured
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('EPHPHATHA_SHEET_ID');
    if (sheetId) {
      return SpreadsheetApp.openById(sheetId);
    }
    throw new Error('Spreadsheet not bound. Open Google Sheet > Extensions > Apps Script.');
  }
}

function ensureAllSheetsExist_(ss) {
  for (var name in SHEET_HEADERS) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(SHEET_HEADERS[name]);
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * 1. RETRIEVE USER PROFILE, COMPLETE PROGRESS MAP & ACTIVE COHORT
 */
function handleGetUser_(ss, payload) {
  var queryId = String(payload.userId || payload.user_id || payload.id || '').trim();
  var queryName = String(payload.displayName || payload.name || '').trim().toLowerCase();

  if (!queryId && !queryName) {
    throw new Error('Missing userId or displayName for user lookup');
  }

  var usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  var usersData = usersSheet.getDataRange().getValues();
  var userRow = null;

  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var rowId = String(row[0] || '').trim();
    var rowName = String(row[1] || '').trim().toLowerCase();

    if ((queryId && rowId === queryId) || (queryName && rowName === queryName)) {
      userRow = {
        userId: String(row[0]),
        displayName: String(row[1]),
        email: String(row[2]),
        authMethod: String(row[3]),
        streakDays: Number(row[4] || 0),
        graceShields: Number(row[5] || 2),
        activeCohortCode: String(row[6] || ''),
        lastActiveDay: Number(row[7] || 1),
        updatedAt: String(row[8] || '')
      };
      break;
    }
  }

  if (!userRow) {
    return { found: false, user: null, progressMap: {}, completedCount: 0 };
  }

  // Retrieve user progress logs
  var progressSheet = ss.getSheetByName(SHEET_NAMES.PROGRESS);
  var progData = progressSheet.getDataRange().getValues();
  var progressMap = {};
  var completedCount = 0;

  for (var j = 1; j < progData.length; j++) {
    var pRow = progData[j];
    if (String(pRow[0] || '').trim() === userRow.userId) {
      var dayNum = Number(pRow[1]);
      var isCompleted = Boolean(pRow[2]);
      if (dayNum >= 1 && dayNum <= 365) {
        progressMap[String(dayNum)] = {
          id: String(dayNum),
          dayNumber: dayNum,
          completed: isCompleted,
          audioTimestampSec: Number(pRow[3] || 0),
          updatedAt: String(pRow[4] || '')
        };
        if (isCompleted) completedCount++;
      }
    }
  }

  // Retrieve active cohort if assigned
  var cohort = null;
  if (userRow.activeCohortCode) {
    try {
      cohort = handleGetCohort_(ss, { inviteCode: userRow.activeCohortCode }).cohort;
    } catch (_) { /* ignore */ }
  }

  return {
    found: true,
    user: userRow,
    progressMap: progressMap,
    completedCount: completedCount,
    cohort: cohort
  };
}

/**
 * 2. SAVE / UPDATE USER PROFILE & PROGRESS LOGS
 */
function handleSaveUser_(ss, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var user = payload.user || payload;
    var userId = String(user.userId || user.user_id || user.id || '').trim();
    var displayName = String(user.displayName || user.name || 'Ephphatha Pilgrim').trim();
    if (!userId) {
      userId = 'pilgrim_' + Math.random().toString(36).slice(2, 10);
    }

    var usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
    var usersData = usersSheet.getDataRange().getValues();
    var foundIndex = -1;

    for (var i = 1; i < usersData.length; i++) {
      var rId = String(usersData[i][0] || '').trim();
      var rName = String(usersData[i][1] || '').trim().toLowerCase();
      if (rId === userId || rName === displayName.toLowerCase()) {
        foundIndex = i + 1;
        userId = String(usersData[i][0]); // preserve canonical userId
        break;
      }
    }

    var nowIso = new Date().toISOString();
    var rowValues = [
      userId,
      displayName,
      String(user.email || ''),
      String(user.authMethod || 'WebAuthn / Passkey'),
      Number(user.streakDays || 0),
      Number(user.graceShields !== undefined ? user.graceShields : 2),
      String(user.activeCohortCode || '').toUpperCase().trim(),
      Number(user.lastActiveDay || 1),
      nowIso
    ];

    if (foundIndex > 0) {
      usersSheet.getRange(foundIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      usersSheet.appendRow(rowValues);
    }

    // Save progress records if provided
    var progressRecords = payload.progress || payload.progressMap || payload.progressList;
    var savedProgressCount = 0;

    if (progressRecords) {
      var list = Array.isArray(progressRecords) ? progressRecords : Object.values(progressRecords);
      var progressSheet = ss.getSheetByName(SHEET_NAMES.PROGRESS);
      var pData = progressSheet.getDataRange().getValues();
      var pIndexMap = {};

      for (var p = 1; p < pData.length; p++) {
        if (String(pData[p][0] || '').trim() === userId) {
          var dNum = String(pData[p][1]);
          pIndexMap[dNum] = p + 1; // 1-based row index
        }
      }

      list.forEach(function(item) {
        var dNum = Number(item.dayNumber || item.day || item.id);
        if (dNum >= 1 && dNum <= 365) {
          var isDone = Boolean(item.completed);
          var audioSec = Number(item.audioTimestampSec || 0);
          var pRow = [userId, dNum, isDone, audioSec, item.updatedAt || nowIso];

          if (pIndexMap[String(dNum)]) {
            progressSheet.getRange(pIndexMap[String(dNum)], 1, 1, 5).setValues([pRow]);
          } else {
            progressSheet.appendRow(pRow);
            pIndexMap[String(dNum)] = progressSheet.getLastRow();
          }
          savedProgressCount++;
        }
      });
    }

    return {
      userId: userId,
      displayName: displayName,
      activeCohortCode: user.activeCohortCode || '',
      savedProgressCount: savedProgressCount,
      updatedAt: nowIso
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 3. GET COHORT WITH ALL MEMBERS, REFLECTIONS, AND PRAYERS
 */
function handleGetCohort_(ss, payload) {
  var inviteCode = String(payload.inviteCode || payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  if (!inviteCode) {
    throw new Error('Missing cohort inviteCode');
  }

  var cohortsSheet = ss.getSheetByName(SHEET_NAMES.COHORTS);
  var cohortsData = cohortsSheet.getDataRange().getValues();
  var cohortRow = null;

  for (var i = 1; i < cohortsData.length; i++) {
    if (String(cohortsData[i][1] || '').toUpperCase().trim() === inviteCode) {
      cohortRow = {
        id: String(cohortsData[i][0] || 'cohort_' + inviteCode),
        inviteCode: inviteCode,
        cohortName: String(cohortsData[i][2] || 'Fellowship Cohort ' + inviteCode),
        createdByMemberId: String(cohortsData[i][3] || ''),
        createdAt: String(cohortsData[i][4] || ''),
        updatedAt: String(cohortsData[i][5] || '')
      };
      break;
    }
  }

  if (!cohortRow) {
    return { found: false, cohort: null };
  }

  // Load Members
  var membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  var memData = membersSheet.getDataRange().getValues();
  var members = [];
  for (var m = 1; m < memData.length; m++) {
    if (String(memData[m][0] || '').toUpperCase().trim() === inviteCode) {
      members.push({
        id: String(memData[m][1]),
        name: String(memData[m][2]),
        role: String(memData[m][3] || 'Pilgrim Member'),
        currentDay: Number(memData[m][4] || 1),
        completedDaysCount: Number(memData[m][5] || 0),
        streakDays: Number(memData[m][6] || 0),
        activityStatus: String(memData[m][7] || 'Active Pilgrim'),
        encouragements: Number(memData[m][8] || 0),
        updatedAt: String(memData[m][9] || '')
      });
    }
  }

  // Load Reflections
  var reflectionsSheet = ss.getSheetByName(SHEET_NAMES.REFLECTIONS);
  var refData = reflectionsSheet.getDataRange().getValues();
  var reflections = [];
  for (var r = 1; r < refData.length; r++) {
    if (String(refData[r][0] || '').toUpperCase().trim() === inviteCode) {
      reflections.push({
        id: String(refData[r][1]),
        authorId: String(refData[r][2]),
        authorName: String(refData[r][3]),
        dayNumber: Number(refData[r][4] || 1),
        passageRef: String(refData[r][5]),
        content: String(refData[r][6]),
        amenCount: Number(refData[r][7] || 0),
        createdAt: String(refData[r][8] || '')
      });
    }
  }
  reflections.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

  // Load Prayers
  var prayersSheet = ss.getSheetByName(SHEET_NAMES.PRAYERS);
  var prayData = prayersSheet.getDataRange().getValues();
  var prayers = [];
  for (var p = 1; p < prayData.length; p++) {
    if (String(prayData[p][0] || '').toUpperCase().trim() === inviteCode) {
      prayers.push({
        id: String(prayData[p][1]),
        authorId: String(prayData[p][2]),
        authorName: String(prayData[p][3]),
        isAnonymous: Boolean(prayData[p][4]),
        category: String(prayData[p][5] || 'General Petition'),
        content: String(prayData[p][6]),
        prayingCount: Number(prayData[p][7] || 0),
        isAnswered: Boolean(prayData[p][8]),
        createdAt: String(prayData[p][9] || '')
      });
    }
  }
  prayers.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

  cohortRow.schemaVersion = 3;
  cohortRow.members = members;
  cohortRow.reflections = reflections;
  cohortRow.prayers = prayers;

  return { found: true, cohort: cohortRow };
}

/**
 * 4. SAVE / UPSERT COHORT & MULTI-USER UPDATES
 */
function handleSaveCohort_(ss, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var cohort = payload.cohort || payload;
    var inviteCode = String(cohort.inviteCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    if (!inviteCode) {
      throw new Error('Missing cohort inviteCode');
    }

    var nowIso = new Date().toISOString();
    var cohortsSheet = ss.getSheetByName(SHEET_NAMES.COHORTS);
    var cohortsData = cohortsSheet.getDataRange().getValues();
    var cohortIndex = -1;

    for (var i = 1; i < cohortsData.length; i++) {
      if (String(cohortsData[i][1] || '').toUpperCase().trim() === inviteCode) {
        cohortIndex = i + 1;
        break;
      }
    }

    var cohortRow = [
      cohort.id || ('cohort_' + inviteCode),
      inviteCode,
      cohort.cohortName || ('Fellowship Cohort ' + inviteCode),
      cohort.createdByMemberId || '',
      cohort.createdAt || nowIso,
      nowIso
    ];

    if (cohortIndex > 0) {
      cohortsSheet.getRange(cohortIndex, 1, 1, 6).setValues([cohortRow]);
    } else {
      cohortsSheet.appendRow(cohortRow);
    }

    // Upsert Members
    if (Array.isArray(cohort.members)) {
      var membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
      var memData = membersSheet.getDataRange().getValues();
      var memIndexMap = {};

      for (var m = 1; m < memData.length; m++) {
        if (String(memData[m][0] || '').toUpperCase().trim() === inviteCode) {
          var mId = String(memData[m][1]);
          memIndexMap[mId] = m + 1;
        }
      }

      cohort.members.forEach(function(member) {
        var mId = String(member.id);
        var mRow = [
          inviteCode,
          mId,
          String(member.name || 'Pilgrim'),
          String(member.role || 'Pilgrim Member'),
          Number(member.currentDay || 1),
          Number(member.completedDaysCount || 0),
          Number(member.streakDays || 0),
          String(member.activityStatus || 'Active Pilgrim'),
          Number(member.encouragements || 0),
          member.updatedAt || nowIso
        ];

        if (memIndexMap[mId]) {
          membersSheet.getRange(memIndexMap[mId], 1, 1, 10).setValues([mRow]);
        } else {
          membersSheet.appendRow(mRow);
          memIndexMap[mId] = membersSheet.getLastRow();
        }
      });
    }

    // Upsert Reflections
    if (Array.isArray(cohort.reflections)) {
      var refSheet = ss.getSheetByName(SHEET_NAMES.REFLECTIONS);
      var refData = refSheet.getDataRange().getValues();
      var refIndexMap = {};

      for (var r = 1; r < refData.length; r++) {
        if (String(refData[r][0] || '').toUpperCase().trim() === inviteCode) {
          var rId = String(refData[r][1]);
          refIndexMap[rId] = r + 1;
        }
      }

      cohort.reflections.forEach(function(item) {
        var rId = String(item.id);
        var rRow = [
          inviteCode,
          rId,
          String(item.authorId || ''),
          String(item.authorName || 'Pilgrim'),
          Number(item.dayNumber || 1),
          String(item.passageRef || ''),
          String(item.content || ''),
          Number(item.amenCount || 0),
          item.createdAt || nowIso
        ];

        if (refIndexMap[rId]) {
          refSheet.getRange(refIndexMap[rId], 1, 1, 9).setValues([rRow]);
        } else {
          refSheet.appendRow(rRow);
          refIndexMap[rId] = refSheet.getLastRow();
        }
      });
    }

    // Upsert Prayers
    if (Array.isArray(cohort.prayers)) {
      var praySheet = ss.getSheetByName(SHEET_NAMES.PRAYERS);
      var prayData = praySheet.getDataRange().getValues();
      var prayIndexMap = {};

      for (var p = 1; p < prayData.length; p++) {
        if (String(prayData[p][0] || '').toUpperCase().trim() === inviteCode) {
          var pId = String(prayData[p][1]);
          prayIndexMap[pId] = p + 1;
        }
      }

      cohort.prayers.forEach(function(item) {
        var pId = String(item.id);
        var pRow = [
          inviteCode,
          pId,
          item.isAnonymous ? 'anon' : String(item.authorId || ''),
          item.isAnonymous ? 'Anonymous Pilgrim' : String(item.authorName || 'Pilgrim'),
          Boolean(item.isAnonymous),
          String(item.category || 'General Petition'),
          String(item.content || ''),
          Number(item.prayingCount || 0),
          Boolean(item.isAnswered),
          item.createdAt || nowIso
        ];

        if (prayIndexMap[pId]) {
          praySheet.getRange(prayIndexMap[pId], 1, 1, 10).setValues([pRow]);
        } else {
          praySheet.appendRow(pRow);
          prayIndexMap[pId] = praySheet.getLastRow();
        }
      });
    }

    return handleGetCohort_(ss, { inviteCode: inviteCode });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 5. QUICK PROGRESS SYNC: User + Active Cohort Member Row
 */
function handleSyncProgress_(ss, payload) {
  var userId = String(payload.userId || '').trim();
  var dayNum = Number(payload.dayNumber || 1);
  var completed = Boolean(payload.completed);
  var inviteCode = String(payload.inviteCode || '').toUpperCase().trim();

  if (userId) {
    handleSaveUser_(ss, {
      userId: userId,
      progress: [{ dayNumber: dayNum, completed: completed, audioTimestampSec: Number(payload.audioTimestampSec || 0) }]
    });
  }

  if (inviteCode && payload.memberMetrics) {
    var membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
    var memData = membersSheet.getDataRange().getValues();
    for (var m = 1; m < memData.length; m++) {
      if (String(memData[m][0] || '').toUpperCase().trim() === inviteCode && String(memData[m][1] || '').trim() === userId) {
        membersSheet.getRange(m + 1, 5, 1, 5).setValues([[
          Number(payload.memberMetrics.currentDay || dayNum),
          Number(payload.memberMetrics.completedDaysCount || 0),
          Number(payload.memberMetrics.streakDays || 0),
          String(payload.memberMetrics.activityStatus || 'Active Pilgrim'),
          Number(memData[m][8] || 0)
        ]]);
        break;
      }
    }
  }

  return { ok: true, dayNumber: dayNum, completed: completed };
}
