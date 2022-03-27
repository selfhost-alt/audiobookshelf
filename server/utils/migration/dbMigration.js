const Path = require('path')
const fs = require('fs-extra')
const njodb = require("njodb")
const loadOldData = require('./loadOldData')

const { SupportedEbookTypes } = require('../globals')
const { PlayMethod } = require('../constants')
const { getId } = require('../index')
const Logger = require('../../Logger')

const Library = require('../../objects/Library')
const LibraryItem = require('../../objects/LibraryItem')
const Book = require('../../objects/mediaTypes/Book')

const BookMetadata = require('../../objects/metadata/BookMetadata')
const FileMetadata = require('../../objects/metadata/FileMetadata')

const AudioFile = require('../../objects/files/AudioFile')
const EBookFile = require('../../objects/files/EBookFile')
const LibraryFile = require('../../objects/files/LibraryFile')
const AudioMetaTags = require('../../objects/metadata/AudioMetaTags')

const Author = require('../../objects/entities/Author')
const Series = require('../../objects/entities/Series')

const MediaProgress = require('../../objects/user/MediaProgress')
const PlaybackSession = require('../../objects/PlaybackSession')

const { isObject } = require('..')
const User = require('../../objects/user/User')
const UserCollection = require('../../objects/UserCollection')
const ServerSettings = require('../../objects/ServerSettings')

var authorsToAdd = []
var existingDbAuthors = []
var seriesToAdd = []
var existingDbSeries = []

function makeAuthorsFromOldAb(authorsList) {
  return authorsList.filter(a => !!a).map(authorName => {
    var existingAuthor = authorsToAdd.find(a => a.name.toLowerCase() === authorName.toLowerCase())
    if (existingAuthor) {
      return existingAuthor.toJSONMinimal()
    }
    var existingDbAuthor = existingDbAuthors.find(a => a.name.toLowerCase() === authorName.toLowerCase())
    if (existingDbAuthor) {
      return existingDbAuthor.toJSONMinimal()
    }

    var newAuthor = new Author()
    newAuthor.setData({ name: authorName })
    authorsToAdd.push(newAuthor)
    Logger.debug(`>>> Created new author named "${authorName}"`)
    return newAuthor.toJSONMinimal()
  })
}

function makeSeriesFromOldAb({ series, volumeNumber }) {
  var existingSeries = seriesToAdd.find(s => s.name.toLowerCase() === series.toLowerCase())
  if (existingSeries) {
    return [existingSeries.toJSONMinimal(volumeNumber)]
  }
  var existingDbSeriesItem = existingDbSeries.find(s => s.name.toLowerCase() === series.toLowerCase())
  if (existingDbSeriesItem) {
    return [existingDbSeriesItem.toJSONMinimal(volumeNumber)]
  }
  var newSeries = new Series()
  newSeries.setData({ name: series })
  seriesToAdd.push(newSeries)
  Logger.info(`>>> Created new series named "${series}"`)
  return [newSeries.toJSONMinimal(volumeNumber)]
}

function getRelativePath(srcPath, basePath) {
  srcPath = srcPath.replace(/\\/g, '/')
  basePath = basePath.replace(/\\/g, '/')
  return srcPath.replace(basePath, '')
}

function makeFilesFromOldAb(audiobook) {
  var libraryFiles = []
  var ebookFiles = []

  var audioFiles = (audiobook.audioFiles || []).map((af) => {
    var fileMetadata = new FileMetadata(af)
    fileMetadata.path = af.fullPath
    fileMetadata.relPath = getRelativePath(af.fullPath, audiobook.fullPath)

    var newLibraryFile = new LibraryFile()
    newLibraryFile.ino = af.ino
    newLibraryFile.metadata = fileMetadata.clone()
    newLibraryFile.addedAt = af.addedAt
    newLibraryFile.updatedAt = Date.now()
    libraryFiles.push(newLibraryFile)

    var audioMetaTags = new AudioMetaTags(af.metadata || {}) // Old metaTags was named metadata
    delete af.metadata

    var newAudioFile = new AudioFile(af)
    newAudioFile.metadata = fileMetadata
    newAudioFile.metaTags = audioMetaTags
    newAudioFile.updatedAt = Date.now()
    return newAudioFile
  })

  var otherFiles = (audiobook.otherFiles || [])
  otherFiles.forEach((file) => {
    var fileMetadata = new FileMetadata(file)
    fileMetadata.path = file.fullPath
    fileMetadata.relPath = getRelativePath(file.fullPath, audiobook.fullPath)

    var newLibraryFile = new LibraryFile()
    newLibraryFile.ino = file.ino
    newLibraryFile.metadata = fileMetadata.clone()
    newLibraryFile.addedAt = file.addedAt
    newLibraryFile.updatedAt = Date.now()
    libraryFiles.push(newLibraryFile)

    var formatExt = (file.ext || '').slice(1)
    if (SupportedEbookTypes.includes(formatExt)) {
      var newEBookFile = new EBookFile()
      newEBookFile.ino = file.ino
      newEBookFile.metadata = fileMetadata
      newEBookFile.ebookFormat = formatExt
      newEBookFile.addedAt = file.addedAt
      newEBookFile.updatedAt = Date.now()
      ebookFiles.push(newEBookFile)
    }
  })

  return {
    libraryFiles,
    ebookFiles,
    audioFiles
  }
}

// Metadata path was changed to /metadata/items make sure cover is using new path
function cleanOldCoverPath(coverPath) {
  if (!coverPath) return null
  var oldMetadataPath = Path.posix.join(global.MetadataPath, 'books')
  if (coverPath.startsWith(oldMetadataPath)) {
    const newMetadataPath = Path.posix.join(global.MetadataPath, 'items')
    return coverPath.replace(oldMetadataPath, newMetadataPath)
  }
  return coverPath
}

function makeLibraryItemFromOldAb(audiobook) {
  var libraryItem = new LibraryItem()
  libraryItem.id = audiobook.id
  libraryItem.ino = audiobook.ino
  libraryItem.libraryId = audiobook.libraryId
  libraryItem.folderId = audiobook.folderId
  libraryItem.path = audiobook.fullPath
  libraryItem.relPath = audiobook.path
  libraryItem.mtimeMs = audiobook.mtimeMs || 0
  libraryItem.ctimeMs = audiobook.ctimeMs || 0
  libraryItem.birthtimeMs = audiobook.birthtimeMs || 0
  libraryItem.addedAt = audiobook.addedAt
  libraryItem.updatedAt = audiobook.lastUpdate
  libraryItem.lastScan = audiobook.lastScan
  libraryItem.scanVersion = audiobook.scanVersion
  libraryItem.isMissing = audiobook.isMissing
  libraryItem.mediaType = 'book'

  var bookEntity = new Book()
  var bookMetadata = new BookMetadata(audiobook.book)
  bookMetadata.publishedYear = audiobook.book.publishYear || null
  if (audiobook.book.narrator) {
    bookMetadata.narrators = audiobook.book.narrator.split(', ')
  }
  // Returns array of json minimal authors
  if (audiobook.book.authorFL) {
    bookMetadata.authors = makeAuthorsFromOldAb(audiobook.book.authorFL.split(', '))
  }

  // Returns array of json minimal series
  if (audiobook.book.series) {
    bookMetadata.series = makeSeriesFromOldAb(audiobook.book)
  }

  bookEntity.metadata = bookMetadata
  bookEntity.coverPath = cleanOldCoverPath(audiobook.book.coverFullPath)
  bookEntity.tags = [...audiobook.tags]

  var payload = makeFilesFromOldAb(audiobook)
  bookEntity.audioFiles = payload.audioFiles
  bookEntity.chapters = []
  if (audiobook.chapters && audiobook.chapters.length) {
    bookEntity.chapters = audiobook.chapters.map(c => ({ ...c }))
  }
  bookEntity.missingParts = audiobook.missingParts || []

  if (payload.ebookFiles.length) {
    bookEntity.ebookFile = payload.ebookFiles[0]
  }

  libraryItem.media = bookEntity
  libraryItem.libraryFiles = payload.libraryFiles
  return libraryItem
}

function cleanUserObject(userObj) {
  var cleanedUserPayload = {
    ...userObj,
    mediaProgress: [],
    bookmarks: []
  }

  // UserAudiobookData is now MediaProgress and AudioBookmarks separated
  if (userObj.audiobooks) {
    for (const audiobookId in userObj.audiobooks) {
      if (isObject(userObj.audiobooks[audiobookId])) {
        // Bookmarks now live on User.js object instead of inside UserAudiobookData
        if (userObj.audiobooks[audiobookId].bookmarks) {
          const cleanedBookmarks = userObj.audiobooks[audiobookId].bookmarks.map((bm) => {
            bm.libraryItemId = audiobookId
            return bm
          })
          cleanedUserPayload.bookmarks = cleanedUserPayload.bookmarks.concat(cleanedBookmarks)
        }

        var userAudiobookData = userObj.audiobooks[audiobookId] // Legacy object
        var liProgress = new MediaProgress() // New Progress Object
        liProgress.id = userAudiobookData.audiobookId
        liProgress.libraryItemId = userAudiobookData.audiobookId
        liProgress.duration = userAudiobookData.totalDuration
        liProgress.isFinished = !!userAudiobookData.isRead
        Object.keys(liProgress.toJSON()).forEach((key) => {
          if (userAudiobookData[key] !== undefined) {
            liProgress[key] = userAudiobookData[key]
          }
        })
        cleanedUserPayload.mediaProgress.push(liProgress.toJSON())
      }
    }
  }

  return new User(cleanedUserPayload)
}

function cleanSessionObj(userListeningSession) {
  var newPlaybackSession = new PlaybackSession(userListeningSession)
  newPlaybackSession.id = getId('play')
  newPlaybackSession.mediaType = 'book'
  newPlaybackSession.updatedAt = userListeningSession.lastUpdate
  newPlaybackSession.libraryItemId = userListeningSession.audiobookId
  newPlaybackSession.playMethod = PlayMethod.TRANSCODE

  // We only have title to transfer over nicely
  var bookMetadata = new BookMetadata()
  bookMetadata.title = userListeningSession.audiobookTitle || ''
  newPlaybackSession.mediaMetadata = bookMetadata

  return newPlaybackSession
}

async function checkUpdateMetadataPath() {
  var bookMetadataPath = Path.posix.join(global.MetadataPath, 'books') // OLD
  if (!(await fs.pathExists(bookMetadataPath))) {
    Logger.debug(`[dbMigration] No need to update books metadata path`)
    return
  }
  var itemsMetadataPath = Path.posix.join(global.MetadataPath, 'items')
  await fs.rename(bookMetadataPath, itemsMetadataPath)
  Logger.info(`>>> Renamed metadata dir from /metadata/books to /metadata/items`)
}

module.exports.migrate = async (aceDb) => {
  console.log('\n\n---- Testing new Db ----\n\n')
  await aceDb.init()

  if (!fs.pathExistsSync(Path.join(global.ConfigPath, 'audiobooks'))) {
    Logger.debug('>> No need to migrate anything')
    return false
  }

  Logger.info(`\n==== Starting Migration ====\n`)

  var oldData = await loadOldData.load()

  await checkUpdateMetadataPath()

  // Insert libraries to new db
  if (oldData.libraries.length) {
    var libraries = oldData.libraries.map((lib) => new Library(lib))
    await aceDb.upsertEntities('libraries', libraries)
  }

  // Insert Users to new db
  if (oldData.users.length) {
    var users = oldData.users.map((user) => cleanUserObject(user))
    await aceDb.upsertEntities('users', users)
  }

  // Insert Sessions to new db
  if (oldData.sessions.length) {
    var sessions = oldData.sessions.map((session) => cleanSessionObj(session))
    await aceDb.upsertEntities('sessions', sessions)
  }

  // Insert Collections to new db
  if (oldData.collections.length) {
    var collections = oldData.collections.map((collection) => new UserCollection(collection))
    await aceDb.upsertEntities('collections', collections)
  }

  // Insert Server Settings in settings to new db
  if (oldData.settings.length) {
    var serverSettings = oldData.settings.find(s => s.id == 'server-settings')
    if (serverSettings) {
      serverSettings = new ServerSettings(serverSettings)
      await aceDb.upsertEntity('settings', serverSettings)
    }
  }

  // Insert Library Items
  if (oldData.audiobooks.length) {
    var libraryItems = oldData.audiobooks.map((ab) => makeLibraryItemFromOldAb(ab))
    Logger.info(`>> ${libraryItems.length} Library Items made`)


    var libitemmap = {}

    libraryItems.forEach((lib) => libitemmap[lib.id] = lib)

    // Attempt at bulk insert
    // var tempfilepath = Path.join(global.ConfigPath, 'libitems.json')
    // var str = JSON.stringify(libitemmap).replace(/(:null)/g, ':"null"').replace(/(:true)/g, ':"true"').replace(/(:false)/g, ':"false"')
    // await fs.writeFile(tempfilepath, str)

    // const fd = fs.openSync(tempfilepath, 'r');
    // const read = length => {
    //   return new Promise((resolve, reject) => {
    //     const buffer = new Uint8Array(length);
    //     fs.read(fd, buffer, 0, length, null, err => {
    //       if (err) { reject(err); }
    //       else { resolve(buffer); }
    //     })
    //   })
    // }
    // await aceDb.db.ref('libraryItems').import(read);
    // fs.closeSync(fd);

    // await aceDb.upsertEntities('libraryItems', libraryItems)
    var total = libraryItems.length
    var lastPrint = 0
    var start = Date.now()
    for (let i = 0; i < libraryItems.length; i++) {
      await aceDb.upsertEntity('libraryItems', libraryItems[i], true)
      var perc = Math.round(100 * i / total)
      if (perc > 0 && perc % 10 == 0 && lastPrint != perc) {
        lastPrint = perc
        var elapsed = Math.floor((Date.now() - start) / 1000)
        Logger.info(`>> ${perc}% done inserting library items: ${elapsed} elapsed`)
      }

      // console.log('>> inserted library item ' + i)
    }
    var elapsed = Math.floor((Date.now() - start) / 1000)
    Logger.info(`>> Done inserting ${libraryItems.length} library items: ${elapsed} elapsed`)

    if (authorsToAdd.length) {
      Logger.info(`>>> ${authorsToAdd.length} Authors made`)
      await aceDb.upsertEntities('authors', authorsToAdd)
    }
    if (seriesToAdd.length) {
      Logger.info(`>>> ${seriesToAdd.length} Series made`)
      await aceDb.upsertEntities('series', seriesToAdd)
    }
  }

  await loadOldData.moveOld()

  Logger.info(`\n==== Migration Complete ====\n`)
}