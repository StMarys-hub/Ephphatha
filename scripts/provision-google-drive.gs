/**
 * EPHPHATHA AUTOMATED GOOGLE DRIVE & MASTER SHEET PROVISIONER (Google Apps Script)
 * Run this once inside https://script.google.com to create:
 *  - Ephphatha_Cloud_Root/
 *  - 00_System_Manifest_And_DB/ (with Ephphatha_Master_DB Google Sheet)
 *  - 01_Early_World/ through 12_The_Church/
 */

function provisionEphphathaGoogleDriveHierarchy() {
  var rootFolderName = 'Ephphatha_Cloud_Root';
  var rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), rootFolderName);

  var periodFolders = [
    '00_System_Manifest_And_DB',
    '01_Early_World',
    '02_Patriarchs',
    '03_Egypt_And_Exodus',
    '04_Desert_Wanderings',
    '05_Conquest_And_Judges',
    '06_Royal_Kingdom',
    '07_Divided_Kingdom',
    '08_Exile',
    '09_Return',
    '10_Maccabean_Revolt',
    '11_Messianic_Fulfillment',
    '12_The_Church'
  ];

  var folderManifest = {};
  for (var i = 0; i < periodFolders.length; i++) {
    var folderName = periodFolders[i];
    var sub = getOrCreateFolder_(rootFolder, folderName);
    folderManifest[folderName] = {
      id: sub.getId(),
      url: sub.getUrl()
    };
  }

  // Create Ephphatha_Master_DB Google Sheet inside 00_System_Manifest_And_DB
  var systemFolder = DriveApp.getFolderById(folderManifest['00_System_Manifest_And_DB'].id);
  var masterSheet = createMasterDatabaseSheet_(systemFolder);

  var output = {
    rootFolderId: rootFolder.getId(),
    rootFolderUrl: rootFolder.getUrl(),
    masterDatabaseSheetId: masterSheet.getId(),
    masterDatabaseSheetUrl: masterSheet.getUrl(),
    folders: folderManifest
  };

  Logger.log('=== EPHPHATHA CLOUD PROVISIONING COMPLETE ===');
  Logger.log(JSON.stringify(output, null, 2));
  return output;
}

function getOrCreateFolder_(parentFolder, name) {
  var iter = parentFolder.getFoldersByName(name);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(name);
}

function createMasterDatabaseSheet_(systemFolder) {
  var existing = systemFolder.getFilesByName('Ephphatha_Master_DB');
  if (existing.hasNext()) {
    var existingSs = SpreadsheetApp.openById(existing.next().getId());
    ensureMasterSchemaTabs_(existingSs);
    return existingSs;
  }

  var ss = SpreadsheetApp.create('Ephphatha_Master_DB');
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(systemFolder);

  ensureMasterSchemaTabs_(ss);
  return ss;
}

function ensureMasterSchemaTabs_(ss) {
  var schema = {
    'Users': ['user_id', 'display_name', 'email_or_contact', 'auth_method', 'streak_days', 'grace_shields', 'active_cohort_code', 'last_active_day', 'preferred_bible_version', 'lang_preference', 'verse_weight', 'show_latin_vulgate', 'updated_at'],
    'Progress_Logs': ['user_id', 'day_number', 'completed', 'audio_timestamp_sec', 'updated_at'],
    'Fellowship_Cohorts': ['cohort_id', 'invite_code', 'cohort_name', 'created_by_user_id', 'created_at', 'updated_at'],
    'Cohort_Members': ['invite_code', 'member_id', 'name', 'role', 'current_day', 'completed_count', 'streak_days', 'activity_status', 'encouragements', 'updated_at'],
    'Cohort_Reflections': ['invite_code', 'reflection_id', 'author_id', 'author_name', 'day_number', 'passage_ref', 'content', 'amen_count', 'created_at'],
    'Cohort_Prayers': ['invite_code', 'prayer_id', 'author_id', 'author_name', 'is_anonymous', 'category', 'content', 'praying_count', 'is_answered', 'created_at']
  };

  var firstSheet = ss.getActiveSheet();
  if (firstSheet && firstSheet.getName() === 'Sheet1') {
    firstSheet.setName('Users');
    firstSheet.appendRow(schema['Users']);
    firstSheet.setFrozenRows(1);
  }

  for (var tabName in schema) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(schema[tabName]);
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * HELPER: Automatically scans all 12 Period folders in Ephphatha_Cloud_Root,
 * detects the Day Number (1..365) from each filename (e.g. "Day 003.mp3", "003.m4a"),
 * and prints a ready-to-paste JSON Day Map!
 */
function listAllAudioFileIdsInDrive() {
  var rootIter = DriveApp.getRootFolder().getFoldersByName('Ephphatha_Cloud_Root');
  if (!rootIter.hasNext()) {
    Logger.log('Ephphatha_Cloud_Root not found. Run provisionEphphathaGoogleDriveHierarchy() first.');
    return;
  }
  var root = rootIter.next();
  var dayMap = {};
  var details = [];

  function scanFolder(folder) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      var dayMatch = name.match(/day[\s_.-]*0*(\d{1,3})(?!\d)/i) ||
                     name.match(/^0*(\d{1,3})(?:[\s_.-]|\b)/) ||
                     name.match(/(?:^|[\s_.-])0*(\d{3})(?:[\s_.-]|\.|$)/);
      if (dayMatch) {
        var dayNum = Number(dayMatch[1]);
        if (dayNum >= 1 && dayNum <= 365) {
          dayMap[String(dayNum)] = file.getId();
          details.push({ day: dayNum, fileName: name, fileId: file.getId(), folder: folder.getName() });
        }
      }
    }
  }

  scanFolder(root);
  var subFolders = root.getFolders();
  while (subFolders.hasNext()) {
    scanFolder(subFolders.next());
  }

  Logger.log('=== COPY & PASTE THIS JSON MAP INTO EPHPHATHA "SET AUDIO ID" BOX ===');
  Logger.log(JSON.stringify(dayMap));
  Logger.log('=== DETAILED FILE LIST ===');
  Logger.log(JSON.stringify(details, null, 2));
  return dayMap;
}

