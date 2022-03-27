const Path = require('path')
const fs = require('fs-extra')
const filePerms = require('./utils/filePerms')
const { AceBase } = require('acebase')

const LibraryItem = require('./objects/LibraryItem')
const User = require('./objects/user/User')
const UserCollection = require('./objects/UserCollection')
const Library = require('./objects/Library')
const Author = require('./objects/entities/Author')
const Series = require('./objects/entities/Series')
const ServerSettings = require('./objects/ServerSettings')
const Logger = require('./Logger')

class AceDb {
  constructor() {
    this.LibraryItemsPath = Path.join(global.ConfigPath, 'libraryItems')
    this.UsersPath = Path.join(global.ConfigPath, 'users')
    this.SessionsPath = Path.join(global.ConfigPath, 'sessions')
    this.LibrariesPath = Path.join(global.ConfigPath, 'libraries')
    this.SettingsPath = Path.join(global.ConfigPath, 'settings')
    this.CollectionsPath = Path.join(global.ConfigPath, 'collections')
    this.AuthorsPath = Path.join(global.ConfigPath, 'authors')
    this.SeriesPath = Path.join(global.ConfigPath, 'series')

    this.DbPath = Path.join(global.ConfigPath, 'db')
    fs.ensureDirSync(this.DbPath)
    this.db = new AceBase('abs', { logLevel: 'warn', storage: { path: this.DbPath, removeVoidProperties: true } })

    // https://github.com/appy-one/acebase#mapping-data-to-custom-classes
    this.db.types.bind('users', User, { creator: User.fromDb, serializer: User.prototype.toJSON })
    this.db.types.bind('libraryItems', LibraryItem, { creator: LibraryItem.fromDb, serializer: LibraryItem.prototype.toJSON })
    this.db.types.bind('libraries', Library, { creator: Library.fromDb, serializer: Library.prototype.toJSON })
    this.db.types.bind('collections', UserCollection, { creator: UserCollection.fromDb, serializer: UserCollection.prototype.toJSON })
    this.db.types.bind('authors', Author, { creator: Author.fromDb, serializer: Author.prototype.toJSON })
    this.db.types.bind('series', Series, { creator: Series.fromDb, serializer: Series.prototype.toJSON })

    // Register after AceBase to ensure process.exit
    process.on('SIGINT', () => {
      process.exit(0)
    })
  }

  async init() {
    await filePerms.setDefault(this.DbPath)
    return new Promise((resolve) => {
      this.db.ready(() => {
        console.log('Ace Db Ready')
        resolve()
      })
    })
  }

  insertLibraryItem(libraryItem) {
    return this.db.ref(`libraryItems/${libraryItem.id}`).set(libraryItem).then((ref) => {
      return true
    }).catch((error) => {
      console.error('failed to insert lib item', error)
      return false
    })
  }

  async getLibraryItems() {
    var items = []
    await this.db.ref('libraryItems').forEach(libSnapshot => {
      items.push(libSnapshot.val())
    }).catch((error) => {
      console.error('failed to get lib item', error)
    })
    return items
  }

  addUpdateLibraryItems(libraryItems) {
    var libitems = {}
    libraryItems.forEach((li) => libitems[li.id] = li)
    return this.db.ref('libraryItems').update(libitems).then((ref) => {
      console.log('Added multiple library items', ref)
      return true
    }).catch((error) => {
      console.error('failed to insert lib items', error)
      return false
    })
  }

  upsertEntities(collection, entities) {
    const entityMap = {}
    entities.forEach((ent) => entityMap[ent.id] = ent)
    return this.db.ref(collection).update(entityMap).then((ref) => {
      Logger.debug(`[AceDb] Upserted ${collection} entities`, ref)
      return true
    }).catch((error) => {
      Logger.error('[AceDb] upsertEntities', error)
      return false
    })
  }

  upsertEntity(collection, entity, silence = false) {
    return this.db.ref(`${collection}/${entity.id}`).set(entity).then((ref) => {
      if (!silence) Logger.debug(`[AceDb] Upserted ${collection} entity`)
      return true
    }).catch((error) => {
      Logger.error('[AceDb] upsertEntity', error)
      return false
    })
  }
}
module.exports = AceDb