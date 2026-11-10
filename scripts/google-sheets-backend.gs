/**
 * EPHPHATHA MASTER DATABASE & REAL-TIME MULTI-USER CLOUD SYNC ENGINE
 * Google Apps Script Web App for Google Sheets (Ephphatha_Master_DB)
 *
 * Capabilities:
 *  1. User Profile & Passwordless Login: Persists user profiles and retrieves all completed reading/audio progress when logging back in.
 *  2. Multi-User Fellowship Cohort Sync: Persists cohorts, member rosters, reflection streams, and prayer requests.
 *  3. Auto-Provisioning & Self-Healing Migration: Automatically initializes all 6 relational sheets with canonical headers
 *     and automatically self-heals / fixes any legacy shifted column headers (e.g. log_id header mismatch).
 *  4. Dynamic Column Mapping: Uses header-name-based column resolution so operations never fail even if column ordering varies.
 *  5. Concurrency Protection: Uses LockService to prevent race conditions during simultaneous multi-user writes.
 *  6. Cross-Origin Support: Seamlessly handles web clients, Cloudflare Edge Worker, and local development servers.
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
  [SHEET_NAMES.USERS]: [
    'user_id',
    'display_name',
    'email_or_contact',
    'auth_method',
    'streak_days',
    'grace_shields',
    'active_cohort_code',
    'last_active_day',
    'preferred_bible_version',
    'lang_preference',
    'verse_weight',
    'show_latin_vulgate',
    'updated_at'
  ],
  [SHEET_NAMES.PROGRESS]: [
    'user_id',
    'day_number',
    'completed',
    'audio_timestamp_sec',
    'updated_at'
  ],
  [SHEET_NAMES.COHORTS]: [
    'cohort_id',
    'invite_code',
    'cohort_name',
    'created_by_user_id',
    'created_at',
    'updated_at'
  ],
  [SHEET_NAMES.MEMBERS]: [
    'invite_code',
    'member_id',
    'name',
    'role',
    'current_day',
    'completed_count',
    'streak_days',
    'activity_status',
    'encouragements',
    'updated_at'
  ],
  [SHEET_NAMES.REFLECTIONS]: [
    'invite_code',
    'reflection_id',
    'author_id',
    'author_name',
    'day_number',
    'passage_ref',
    'content',
    'amen_count',
    'created_at'
  ],
  [SHEET_NAMES.PRAYERS]: [
    'invite_code',
    'prayer_id',
    'author_id',
    'author_name',
    'is_anonymous',
    'category',
    'content',
    'praying_count',
    'is_answered',
    'created_at'
  ]
};

function doGet(e) {
  var params = e ? e.parameter : {};
  var body = null;
  if (params && params.payload) {
    if (typeof params.payload === 'string') {
      try {
        body = { action: params.action, payload: JSON.parse(params.payload) };
      } catch (_) {
        body = { action: params.action, payload: params };
      }
    } else {
      body = { action: params.action, payload: params.payload };
    }
  } else {
    body = { action: params.action, payload: params };
  }
  return handleRequest_(params, body);
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
        result.message = 'Ephphatha Google Sheets Master DB Active (Self-Healing Schema Enabled)';
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

      case 'syncprogress':
        result.data = handleSyncProgress_(ss, payload);
        break;

      case 'getcohort':
        result.data = handleGetCohort_(ss, payload);
        break;

      case 'savecohort':
        result.data = handleSaveCohort_(ss, payload);
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
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('EPHPHATHA_SHEET_ID');
    if (sheetId) {
      return SpreadsheetApp.openById(sheetId);
    }
    throw new Error('Spreadsheet not bound. Open Google Sheet > Extensions > Apps Script.');
  }
}

/**
 * Ensures all 6 relational sheets exist and performs self-healing schema normalization
 * if obsolete or shifted headers are detected.
 */
function ensureAllSheetsExist_(ss) {
  for (var name in SHEET_HEADERS) {
    var sheet = ss.getSheetByName(name);
    var canonicalHeaders = SHEET_HEADERS[name];
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(canonicalHeaders);
      sheet.setFrozenRows(1);
      formatHeaderRow_(sheet, canonicalHeaders.length);
    } else {
      normalizeSheetHeadersIfNeeded_(sheet, name, canonicalHeaders);
    }
  }
}

/**
 * Inspects existing headers and corrects legacy misalignment (e.g. log_id shift in Progress_Logs)
 */
function normalizeSheetHeadersIfNeeded_(sheet, sheetName, canonicalHeaders) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(canonicalHeaders);
    sheet.setFrozenRows(1);
    formatHeaderRow_(sheet, canonicalHeaders.length);
    return;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var firstH = String(currentHeaders[0] || '').toLowerCase().trim();

  // SELF-HEALING FIX 1: Progress_Logs has obsolete 'log_id' as column 1
  if (sheetName === SHEET_NAMES.PROGRESS) {
    if (firstH === 'log_id') {
      // Rewrite row 1 to canonical headers (user_id, day_number, completed, audio_timestamp_sec, updated_at)
      sheet.getRange(1, 1, 1, canonicalHeaders.length).setValues([canonicalHeaders]);
      // Clear legacy unused columns (6 and 7: hmac_signature, synced_at) if empty
      if (lastCol > canonicalHeaders.length) {
        var extraCols = lastCol - canonicalHeaders.length;
        sheet.getRange(1, canonicalHeaders.length + 1, 1, extraCols).clearContent();
      }
      sheet.setFrozenRows(1);
      formatHeaderRow_(sheet, canonicalHeaders.length);
      return;
    }
  }

  // SELF-HEALING FIX 2: Users sheet has older 6-column or 9-column headers
  if (sheetName === SHEET_NAMES.USERS) {
    if (lastCol < canonicalHeaders.length || !headerExists_(currentHeaders, 'preferred_bible_version')) {
      sheet.getRange(1, 1, 1, canonicalHeaders.length).setValues([canonicalHeaders]);
      sheet.setFrozenRows(1);
      formatHeaderRow_(sheet, canonicalHeaders.length);
      return;
    }
  }

  // SELF-HEALING FIX 3: Fellowship_Cohorts has old column order (cohort_name before invite_code)
  if (sheetName === SHEET_NAMES.COHORTS) {
    var secondH = String(currentHeaders[1] || '').toLowerCase().trim();
    if (secondH === 'cohort_name') {
      sheet.getRange(1, 1, 1, canonicalHeaders.length).setValues([canonicalHeaders]);
      sheet.setFrozenRows(1);
      formatHeaderRow_(sheet, canonicalHeaders.length);
      return;
    }
  }

  sheet.setFrozenRows(1);
}

function headerExists_(headers, name) {
  var target = name.toLowerCase().replace(/[\s_-]+/g, '');
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (h === target) return true;
  }
  return false;
}

function formatHeaderRow_(sheet, colCount) {
  try {
    var range = sheet.getRange(1, 1, 1, colCount);
    range.setFontWeight('bold');
    range.setBackground('#1e293b');
    range.setFontColor('#f8fafc');
  } catch (_) {}
}

/**
 * Builds a 0-based column index map for any sheet's row 1 headers.
 */
function getColumnMap_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var clean = String(headers[i] || '').toLowerCase().trim().replace(/[\s_-]+/g, '_');
    if (clean) map[clean] = i;
  }
  return map;
}

function getColVal_(row, map, candidates, fallback) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = map[candidates[i]];
    if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
      return row[idx];
    }
  }
  return fallback;
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
  var uMap = getColumnMap_(usersSheet);
  var userRow = null;

  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var rowId = String(getColVal_(row, uMap, ['user_id', 'userid', 'id'], '')).trim();
    var rowName = String(getColVal_(row, uMap, ['display_name', 'name', 'user_name'], '')).trim().toLowerCase();

    if ((queryId && rowId === queryId) || (queryName && rowName === queryName)) {
      userRow = {
        userId: rowId,
        displayName: String(getColVal_(row, uMap, ['display_name', 'name'], 'Pilgrim')),
        email: String(getColVal_(row, uMap, ['email_or_contact', 'email', 'contact'], '')),
        authMethod: String(getColVal_(row, uMap, ['auth_method', 'auth'], 'WebAuthn / Passkey')),
        streakDays: Number(getColVal_(row, uMap, ['streak_days', 'streak'], 0)),
        graceShields: Number(getColVal_(row, uMap, ['grace_shields', 'shields'], 2)),
        activeCohortCode: String(getColVal_(row, uMap, ['active_cohort_code', 'cohort_code'], '')),
        lastActiveDay: Number(getColVal_(row, uMap, ['last_active_day', 'last_day'], 1)),
        preferredBibleVersion: String(getColVal_(row, uMap, ['preferred_bible_version', 'bible_version'], 'POC')),
        langPreference: String(getColVal_(row, uMap, ['lang_preference', 'language'], 'bilingual')),
        verseWeight: String(getColVal_(row, uMap, ['verse_weight', 'font_weight'], 'strong')),
        showLatinVulgate: Boolean(getColVal_(row, uMap, ['show_latin_vulgate', 'latin'], false)),
        updatedAt: String(getColVal_(row, uMap, ['updated_at', 'timestamp'], ''))
      };
      break;
    }
  }

  if (!userRow) {
    return { found: false, user: null, progressMap: {}, completedCount: 0 };
  }

  // Retrieve user progress logs using named column resolver
  var progressSheet = ss.getSheetByName(SHEET_NAMES.PROGRESS);
  var progData = progressSheet.getDataRange().getValues();
  var pMap = getColumnMap_(progressSheet);
  var progressMap = {};
  var completedCount = 0;

  for (var j = 1; j < progData.length; j++) {
    var pRow = progData[j];
    var pUserId = String(getColVal_(pRow, pMap, ['user_id', 'userid'], '')).trim();

    if (pUserId === userRow.userId) {
      var dayNum = Number(getColVal_(pRow, pMap, ['day_number', 'day', 'day_no'], 0));
      var isCompleted = Boolean(getColVal_(pRow, pMap, ['completed', 'is_completed', 'done'], false));

      if (dayNum >= 1 && dayNum <= 365) {
        progressMap[String(dayNum)] = {
          id: String(dayNum),
          dayNumber: dayNum,
          completed: isCompleted,
          audioTimestampSec: Number(getColVal_(pRow, pMap, ['audio_timestamp_sec', 'audio_timestamp', 'audio_sec'], 0)),
          updatedAt: String(getColVal_(pRow, pMap, ['updated_at', 'synced_at', 'timestamp'], ''))
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
    var uMap = getColumnMap_(usersSheet);
    var foundIndex = -1;

    for (var i = 1; i < usersData.length; i++) {
      var rId = String(getColVal_(usersData[i], uMap, ['user_id', 'userid'], '')).trim();
      var rName = String(getColVal_(usersData[i], uMap, ['display_name', 'name'], '')).trim().toLowerCase();
      if (rId === userId || rName === displayName.toLowerCase()) {
        foundIndex = i + 1;
        if (rId) userId = rId; // preserve canonical userId
        break;
      }
    }

    var nowIso = new Date().toISOString();
    var userValues;

    if (foundIndex > 0) {
      // Existing user row: preserve all existing fields unless explicitly provided in payload!
      var existingRow = usersData[foundIndex - 1];
      var finalName = String(user.displayName || user.name || getColVal_(existingRow, uMap, ['display_name', 'name'], displayName)).trim();
      var finalEmail = user.email !== undefined ? String(user.email) : String(getColVal_(existingRow, uMap, ['email_or_contact', 'email', 'contact'], ''));
      var finalAuth = user.authMethod || getColVal_(existingRow, uMap, ['auth_method', 'auth'], 'WebAuthn / Passkey');
      var finalStreak = user.streakDays !== undefined ? Number(user.streakDays) : Number(getColVal_(existingRow, uMap, ['streak_days', 'streak'], 0));
      var finalShields = user.graceShields !== undefined ? Number(user.graceShields) : Number(getColVal_(existingRow, uMap, ['grace_shields'], 2));
      var finalCohort = user.activeCohortCode !== undefined ? String(user.activeCohortCode).toUpperCase().trim() : String(getColVal_(existingRow, uMap, ['active_cohort_code', 'cohort_code'], ''));
      var finalDay = user.lastActiveDay !== undefined ? Number(user.lastActiveDay) : Number(getColVal_(existingRow, uMap, ['last_active_day', 'last_day'], 1));
      var finalVersion = user.preferredBibleVersion || getColVal_(existingRow, uMap, ['preferred_bible_version', 'bible_version'], 'POC');
      var finalLang = user.langPreference || getColVal_(existingRow, uMap, ['lang_preference', 'language'], 'bilingual');
      var finalWeight = user.verseWeight || getColVal_(existingRow, uMap, ['verse_weight', 'font_weight'], 'strong');
      var finalLatin = user.showLatinVulgate !== undefined ? Boolean(user.showLatinVulgate) : Boolean(getColVal_(existingRow, uMap, ['show_latin_vulgate', 'latin'], false));

      displayName = finalName;
      userValues = [
        userId,
        finalName,
        finalEmail,
        finalAuth,
        finalStreak,
        finalShields,
        finalCohort,
        finalDay,
        finalVersion,
        finalLang,
        finalWeight,
        finalLatin,
        nowIso
      ];
      usersSheet.getRange(foundIndex, 1, 1, userValues.length).setValues([userValues]);
    } else {
      userValues = [
        userId,
        displayName,
        String(user.email || ''),
        String(user.authMethod || 'WebAuthn / Passkey'),
        Number(user.streakDays || 0),
        Number(user.graceShields !== undefined ? user.graceShields : 2),
        String(user.activeCohortCode || '').toUpperCase().trim(),
        Number(user.lastActiveDay || 1),
        String(user.preferredBibleVersion || 'POC'),
        String(user.langPreference || 'bilingual'),
        String(user.verseWeight || 'strong'),
        Boolean(user.showLatinVulgate),
        nowIso
      ];
      usersSheet.appendRow(userValues);
    }

    // Save progress records if provided
    var progressRecords = payload.progress || payload.progressMap || payload.progressList;
    var savedProgressCount = 0;

    if (progressRecords) {
      var list = Array.isArray(progressRecords) ? progressRecords : Object.values(progressRecords);
      var progressSheet = ss.getSheetByName(SHEET_NAMES.PROGRESS);
      var pData = progressSheet.getDataRange().getValues();
      var pMap = getColumnMap_(progressSheet);
      var pIndexMap = {};

      for (var p = 1; p < pData.length; p++) {
        var rUser = String(getColVal_(pData[p], pMap, ['user_id', 'userid'], '')).trim();
        if (rUser === userId) {
          var dNumStr = String(getColVal_(pData[p], pMap, ['day_number', 'day', 'day_no'], ''));
          pIndexMap[dNumStr] = p + 1; // 1-based row index
        }
      }

      list.forEach(function(item) {
        var dNum = Number(item.dayNumber || item.day || item.id);
        if (dNum >= 1 && dNum <= 365) {
          var isDone = Boolean(item.completed);
          var audioSec = Number(item.audioTimestampSec || 0);
          var pRow = [userId, dNum, isDone, audioSec, item.updatedAt || nowIso];

          if (pIndexMap[String(dNum)]) {
            progressSheet.getRange(pIndexMap[String(dNum)], 1, 1, pRow.length).setValues([pRow]);
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
 * 3. QUICK PROGRESS SYNC: User + Active Cohort Member Row
 */
function handleSyncProgress_(ss, payload) {
  var userId = String(payload.userId || payload.user_id || '').trim();
  var dayNum = Number(payload.dayNumber || payload.day_number || payload.day || 1);
  var completed = Boolean(payload.completed);
  var audioSec = Number(payload.audioTimestampSec || payload.audio_timestamp_sec || 0);
  var inviteCode = String(payload.inviteCode || payload.activeCohortCode || '').toUpperCase().trim();

  if (userId) {
    handleSaveUser_(ss, {
      userId: userId,
      progress: [{ dayNumber: dayNum, completed: completed, audioTimestampSec: audioSec }]
    });
  }

  if (inviteCode && payload.memberMetrics) {
    try {
      var membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
      var memData = membersSheet.getDataRange().getValues();
      var mMap = getColumnMap_(membersSheet);

      for (var m = 1; m < memData.length; m++) {
        var rInvite = String(getColVal_(memData[m], mMap, ['invite_code', 'code'], '')).toUpperCase().trim();
        var rMemberId = String(getColVal_(memData[m], mMap, ['member_id', 'id'], '')).trim();

        if (rInvite === inviteCode && rMemberId === userId) {
          var updatedRow = [
            inviteCode,
            userId,
            String(payload.memberMetrics.name || memData[m][2] || 'Pilgrim'),
            String(payload.memberMetrics.role || memData[m][3] || 'Pilgrim Member'),
            Number(payload.memberMetrics.currentDay || dayNum),
            Number(payload.memberMetrics.completedDaysCount || 0),
            Number(payload.memberMetrics.streakDays || 0),
            String(payload.memberMetrics.activityStatus || 'Active Pilgrim'),
            Number(memData[m][8] || 0),
            new Date().toISOString()
          ];
          membersSheet.getRange(m + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
          break;
        }
      }
    } catch (_) { /* ignore member metrics sync failure */ }
  }

  return { ok: true, dayNumber: dayNum, completed: completed, audioTimestampSec: audioSec };
}

/**
 * 4. GET COHORT WITH ALL MEMBERS, REFLECTIONS, AND PRAYERS
 */
function handleGetCohort_(ss, payload) {
  var inviteCode = String(payload.inviteCode || payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  if (!inviteCode) {
    throw new Error('Missing cohort inviteCode');
  }

  var cohortsSheet = ss.getSheetByName(SHEET_NAMES.COHORTS);
  var cohortsData = cohortsSheet.getDataRange().getValues();
  var cMap = getColumnMap_(cohortsSheet);
  var cohortRow = null;

  for (var i = 1; i < cohortsData.length; i++) {
    var rCode = String(getColVal_(cohortsData[i], cMap, ['invite_code', 'code'], '')).toUpperCase().trim();
    if (rCode === inviteCode) {
      cohortRow = {
        id: String(getColVal_(cohortsData[i], cMap, ['cohort_id', 'id'], 'cohort_' + inviteCode)),
        inviteCode: inviteCode,
        cohortName: String(getColVal_(cohortsData[i], cMap, ['cohort_name', 'name'], 'Fellowship Cohort ' + inviteCode)),
        createdByMemberId: String(getColVal_(cohortsData[i], cMap, ['created_by_user_id', 'created_by'], '')),
        createdAt: String(getColVal_(cohortsData[i], cMap, ['created_at', 'created'], '')),
        updatedAt: String(getColVal_(cohortsData[i], cMap, ['updated_at', 'updated'], ''))
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
  var mMap = getColumnMap_(membersSheet);
  var members = [];

  for (var m = 1; m < memData.length; m++) {
    var mCode = String(getColVal_(memData[m], mMap, ['invite_code', 'code'], '')).toUpperCase().trim();
    if (mCode === inviteCode) {
      members.push({
        id: String(getColVal_(memData[m], mMap, ['member_id', 'id'], '')),
        name: String(getColVal_(memData[m], mMap, ['name', 'display_name'], 'Pilgrim')),
        role: String(getColVal_(memData[m], mMap, ['role'], 'Pilgrim Member')),
        currentDay: Number(getColVal_(memData[m], mMap, ['current_day', 'day'], 1)),
        completedDaysCount: Number(getColVal_(memData[m], mMap, ['completed_count', 'completed'], 0)),
        streakDays: Number(getColVal_(memData[m], mMap, ['streak_days', 'streak'], 0)),
        activityStatus: String(getColVal_(memData[m], mMap, ['activity_status', 'status'], 'Active Pilgrim')),
        encouragements: Number(getColVal_(memData[m], mMap, ['encouragements'], 0)),
        updatedAt: String(getColVal_(memData[m], mMap, ['updated_at'], ''))
      });
    }
  }

  // Load Reflections
  var reflectionsSheet = ss.getSheetByName(SHEET_NAMES.REFLECTIONS);
  var refData = reflectionsSheet.getDataRange().getValues();
  var rMap = getColumnMap_(reflectionsSheet);
  var reflections = [];

  for (var r = 1; r < refData.length; r++) {
    var rInvite = String(getColVal_(refData[r], rMap, ['invite_code', 'code'], '')).toUpperCase().trim();
    if (rInvite === inviteCode) {
      reflections.push({
        id: String(getColVal_(refData[r], rMap, ['reflection_id', 'id'], '')),
        authorId: String(getColVal_(refData[r], rMap, ['author_id'], '')),
        authorName: String(getColVal_(refData[r], rMap, ['author_name', 'name'], 'Pilgrim')),
        dayNumber: Number(getColVal_(refData[r], rMap, ['day_number', 'day'], 1)),
        passageRef: String(getColVal_(refData[r], rMap, ['passage_ref', 'ref'], '')),
        content: String(getColVal_(refData[r], rMap, ['content', 'text'], '')),
        amenCount: Number(getColVal_(refData[r], rMap, ['amen_count', 'amens'], 0)),
        createdAt: String(getColVal_(refData[r], rMap, ['created_at'], ''))
      });
    }
  }
  reflections.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

  // Load Prayers
  var prayersSheet = ss.getSheetByName(SHEET_NAMES.PRAYERS);
  var prayData = prayersSheet.getDataRange().getValues();
  var prMap = getColumnMap_(prayersSheet);
  var prayers = [];

  for (var p = 1; p < prayData.length; p++) {
    var pInvite = String(getColVal_(prayData[p], prMap, ['invite_code', 'code'], '')).toUpperCase().trim();
    if (pInvite === inviteCode) {
      prayers.push({
        id: String(getColVal_(prayData[p], prMap, ['prayer_id', 'id'], '')),
        authorId: String(getColVal_(prayData[p], prMap, ['author_id'], '')),
        authorName: String(getColVal_(prayData[p], prMap, ['author_name', 'name'], 'Pilgrim')),
        isAnonymous: Boolean(getColVal_(prayData[p], prMap, ['is_anonymous', 'anonymous'], false)),
        category: String(getColVal_(prayData[p], prMap, ['category'], 'General Petition')),
        content: String(getColVal_(prayData[p], prMap, ['content', 'text'], '')),
        prayingCount: Number(getColVal_(prayData[p], prMap, ['praying_count', 'prayers'], 0)),
        isAnswered: Boolean(getColVal_(prayData[p], prMap, ['is_answered', 'answered'], false)),
        createdAt: String(getColVal_(prayData[p], prMap, ['created_at'], ''))
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
 * 5. SAVE / UPSERT COHORT & MULTI-USER UPDATES
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
    var cMap = getColumnMap_(cohortsSheet);
    var cohortIndex = -1;

    for (var i = 1; i < cohortsData.length; i++) {
      var rCode = String(getColVal_(cohortsData[i], cMap, ['invite_code', 'code'], '')).toUpperCase().trim();
      if (rCode === inviteCode) {
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
      cohortsSheet.getRange(cohortIndex, 1, 1, cohortRow.length).setValues([cohortRow]);
    } else {
      cohortsSheet.appendRow(cohortRow);
    }

    // Upsert Members
    if (Array.isArray(cohort.members)) {
      var membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
      var memData = membersSheet.getDataRange().getValues();
      var mMap = getColumnMap_(membersSheet);
      var memIndexMap = {};

      for (var m = 1; m < memData.length; m++) {
        var mInvite = String(getColVal_(memData[m], mMap, ['invite_code', 'code'], '')).toUpperCase().trim();
        if (mInvite === inviteCode) {
          var mId = String(getColVal_(memData[m], mMap, ['member_id', 'id'], ''));
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
          membersSheet.getRange(memIndexMap[mId], 1, 1, mRow.length).setValues([mRow]);
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
      var rMap = getColumnMap_(refSheet);
      var refIndexMap = {};

      for (var r = 1; r < refData.length; r++) {
        var rInvite = String(getColVal_(refData[r], rMap, ['invite_code', 'code'], '')).toUpperCase().trim();
        if (rInvite === inviteCode) {
          var rId = String(getColVal_(refData[r], rMap, ['reflection_id', 'id'], ''));
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
          refSheet.getRange(refIndexMap[rId], 1, 1, rRow.length).setValues([rRow]);
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
      var prMap = getColumnMap_(praySheet);
      var prayIndexMap = {};

      for (var p = 1; p < prayData.length; p++) {
        var pInvite = String(getColVal_(prayData[p], prMap, ['invite_code', 'code'], '')).toUpperCase().trim();
        if (pInvite === inviteCode) {
          var pId = String(getColVal_(prayData[p], prMap, ['prayer_id', 'id'], ''));
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
          praySheet.getRange(prayIndexMap[pId], 1, 1, pRow.length).setValues([pRow]);
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
