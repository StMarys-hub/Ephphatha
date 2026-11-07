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
    return SpreadsheetApp.openById(existing.next().getId());
  }

  var ss = SpreadsheetApp.create('Ephphatha_Master_DB');
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(systemFolder);

  // Configure relational tabs
  var usersSheet = ss.getActiveSheet();
  usersSheet.setName('Users');
  usersSheet.appendRow(['user_id', 'display_name', 'auth_method', 'streak_days', 'grace_shields', 'updated_at']);

  var cohortsSheet = ss.insertSheet('Fellowship_Cohorts');
  cohortsSheet.appendRow(['cohort_id', 'cohort_name', 'invite_code', 'member_name', 'member_contact', 'status', 'amens_count', 'updated_at']);

  var logsSheet = ss.insertSheet('Progress_Logs');
  logsSheet.appendRow(['log_id', 'user_id', 'day_number', 'completed', 'audio_timestamp_sec', 'hmac_signature', 'synced_at']);

  return ss;
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

