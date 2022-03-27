const Path = require('path')
const fs = require('fs-extra')
const { readTextFile } = require('../fileUtils')
const Logger = require('../../Logger')

async function getJsonObjectsInFile(filepath) {
  var text = await readTextFile(filepath)
  var jsonlines = text.split(/\r?\n/).map(l => l.trim()).filter(l => !!l)
  if (!jsonlines.length) {
    Logger.debug('No lines in JSON file at path', filepath)
    return []
  }
  var jsonobjs = []
  for (const line of jsonlines) {
    try {
      jsonobjs.push(JSON.parse(line))
    } catch (error) {
      Logger.error('Failed to parse json obj line', line, error)
    }
  }
  return jsonobjs
}

function getJsonFilesInDir(path) {
  return fs.readdir(path).then((files) => {
    return files.filter(f => Path.extname(f) === '.json').map((filename) => Path.join(path, filename))
  }).catch((error) => {
    Logger.error(`Failed to readdir "${path}"`, error)
    return []
  })
}

async function loadJsonData(path) {
  Logger.info(`>> Loading data from "${path}"`)
  var jsonFiles = await getJsonFilesInDir(path)
  if (!jsonFiles.length) {
    Logger.warn('No JSON Files for path', path)
    return []
  }
  var allObjects = []
  for (const filepath of jsonFiles) {
    var jsonObjs = await getJsonObjectsInFile(filepath)
    allObjects = allObjects.concat(jsonObjs)
  }
  return allObjects
}

async function loadOldData() {
  var AudiobooksPath = Path.join(global.ConfigPath, 'audiobooks', 'data')
  var UsersPath = Path.join(global.ConfigPath, 'users', 'data')
  var SessionsPath = Path.join(global.ConfigPath, 'sessions', 'data')
  var LibrariesPath = Path.join(global.ConfigPath, 'libraries', 'data')
  var SettingsPath = Path.join(global.ConfigPath, 'settings', 'data')
  var CollectionsPath = Path.join(global.ConfigPath, 'collections', 'data')

  var audiobooks = []
  if (fs.pathExistsSync(AudiobooksPath)) {
    audiobooks = await loadJsonData(AudiobooksPath)
    Logger.info(`>>> Loaded ${audiobooks.length} Users`)
  }

  var users = []
  if (fs.pathExistsSync(UsersPath)) {
    users = await loadJsonData(UsersPath)
    Logger.info(`>>> Loaded ${users.length} Users`)
  }

  var sessions = []
  if (fs.pathExistsSync(SessionsPath)) {
    sessions = await loadJsonData(SessionsPath)
    Logger.info(`>>> Loaded ${sessions.length} Sessions`)
  }

  var libraries = []
  if (fs.pathExistsSync(LibrariesPath)) {
    libraries = await loadJsonData(LibrariesPath)
    Logger.info(`>>> Loaded ${libraries.length} Libraries`)
  }

  var settings = []
  if (fs.pathExistsSync(SettingsPath)) {
    settings = await loadJsonData(SettingsPath)
    Logger.info(`>>> Loaded ${settings.length} Settings`)
  }

  var collections = []
  if (fs.pathExistsSync(CollectionsPath)) {
    collections = await loadJsonData(CollectionsPath)
    Logger.info(`>>> Loaded ${collections.length} Collections`)
  }

  return {
    audiobooks,
    users,
    sessions,
    libraries,
    settings,
    collections
  }
}
module.exports.load = loadOldData

function moveDir(from, to) {
  try {
    return fs.move(from, to)
  } catch (error) {
    Logger.error('Failed to move to dir', from, to, error)
    return null
  }
}

module.exports.moveOld = async () => {
  var AudiobooksPath = Path.join(global.ConfigPath, 'audiobooks')
  var UsersPath = Path.join(global.ConfigPath, 'users')
  var SessionsPath = Path.join(global.ConfigPath, 'sessions')
  var LibrariesPath = Path.join(global.ConfigPath, 'libraries')
  var SettingsPath = Path.join(global.ConfigPath, 'settings')
  var CollectionsPath = Path.join(global.ConfigPath, 'collections')

  var moveToDir = Path.join(global.ConfigPath, 'oldDb')
  fs.ensureDirSync(moveToDir)

  await moveDir(AudiobooksPath, Path.join(moveToDir, 'audiobooks'))
  await moveDir(UsersPath, Path.join(moveToDir, 'users'))
  await moveDir(SessionsPath, Path.join(moveToDir, 'sessions'))
  await moveDir(LibrariesPath, Path.join(moveToDir, 'libraries'))
  await moveDir(SettingsPath, Path.join(moveToDir, 'settings'))
  await moveDir(CollectionsPath, Path.join(moveToDir, 'collections'))
}