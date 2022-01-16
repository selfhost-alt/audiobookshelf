const fs = require('fs-extra')
const Path = require('path')
const rra = require('recursive-readdir-async')
const axios = require('axios')
const Logger = require('../Logger')
const globals = require('./globals')

async function getFileStat(path) {
  try {
    var stat = await fs.stat(path)
    return {
      size: stat.size,
      atime: stat.atime,
      mtime: stat.mtime,
      ctime: stat.ctime,
      birthtime: stat.birthtime
    }
  } catch (err) {
    console.error('Failed to stat', err)
    return false
  }
}
module.exports.getFileStat = getFileStat

async function getFileSize(path) {
  var stat = await getFileStat(path)
  if (!stat) return 0
  return stat.size || 0
}
module.exports.getFileSize = getFileSize

async function readTextFile(path) {
  try {
    var data = await fs.readFile(path)
    return String(data)
  } catch (error) {
    Logger.error(`[FileUtils] ReadTextFile error ${error}`)
    return ''
  }
}
module.exports.readTextFile = readTextFile

function bytesPretty(bytes, decimals = 0) {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  var dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i > 2 && dm === 0) dm = 1
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
module.exports.bytesPretty = bytesPretty

function setFileOwner(path, uid, gid) {
  try {
    return fs.chown(path, uid, gid).then(() => true)
  } catch (err) {
    console.error('Failed set file owner', err)
    return false
  }
}
module.exports.setFileOwner = setFileOwner

function getFileType(ext) {
  var ext_cleaned = ext.toLowerCase()
  if (ext_cleaned.startsWith('.')) ext_cleaned = ext_cleaned.slice(1)
  if (globals.SupportedAudioTypes.includes(ext_cleaned)) return 'audio'
  if (globals.SupportedImageTypes.includes(ext_cleaned)) return 'image'
  if (globals.SupportedEbookTypes.includes(ext_cleaned)) return 'ebook'
  if (ext_cleaned === 'nfo') return 'info'
  if (ext_cleaned === 'txt') return 'text'
  if (ext_cleaned === 'opf') return 'opf'
  return 'unknown'
}

function cleanNode(node, basePath) {
  node.id = node.stats.ino
  node.relativePath = node.fullname.replace(basePath, '')
  if (node.relativePath.startsWith('/')) node.relativePath = node.relativePath.substr(1)
  node.deep++

  if (node.isDirectory) {
    for (let i = 0; i < node.content.length; i++) {
      node.content[i] = cleanNode(node.content[i], node.fullname)
    }
  } else {
    node.fileType = getFileType(node.extension)
  }
  return node
}

async function recurseFileTree(path) {
  path = path.replace(/\\/g, '/')
  if (!path.endsWith('/')) path = path + '/'

  var rootStat = await fs.stat(path)
  var rootObj = {
    content: [],
    deep: 0,
    fullname: path,
    id: rootStat.ino,
    isDirectory: true,
    name: Path.basename(path),
    path: Path.dirname(path),
    relativePath: Path.basename(path),
    stats: rootStat
  }

  const options = {
    mode: rra.TREE,
    recursive: true,
    stats: true,
    ignoreFolders: true,
    extensions: true,
    deep: true,
    realPath: true,
    normalizePath: true
  }
  var list = await rra.list(path, options)
  if (list.error) {
    Logger.error(tag, 'Recurse files error', list.error)
    return []
  }

  for (let i = 0; i < list.length; i++) {
    list[i] = cleanNode(list[i], path)
  }
  rootObj.content = list

  return rootObj
}
module.exports.recurseFileTree = recurseFileTree

async function recurseFiles(path, relPathToReplace = null) {
  path = path.replace(/\\/g, '/')
  if (!path.endsWith('/')) path = path + '/'

  if (relPathToReplace) {
    relPathToReplace = relPathToReplace.replace(/\\/g, '/')
    if (!relPathToReplace.endsWith('/')) relPathToReplace += '/'
  } else {
    relPathToReplace = path
  }

  const options = {
    mode: rra.LIST,
    recursive: true,
    stats: false,
    ignoreFolders: true,
    extensions: true,
    deep: true,
    realPath: true,
    normalizePath: true
  }
  var list = await rra.list(path, options)
  if (list.error) {
    Logger.error('[fileUtils] Recurse files error', list.error)
    return []
  }

  list = list.filter((item) => {
    if (item.error) {
      Logger.error(`[fileUtils] Recurse files file "${item.fullName}" has error`, item.error)
      return false
    }

    // Ignore any file if a directory or the filename starts with "."
    var relpath = item.fullname.replace(relPathToReplace, '')
    var pathStartsWithPeriod = relpath.split('/').find(p => p.startsWith('.'))
    if (pathStartsWithPeriod) {
      Logger.debug(`[fileUtils] Ignoring path has . "${relpath}"`)
      return false
    }

    return true
  }).map((item) => ({
    name: item.name,
    path: item.fullname.replace(relPathToReplace, ''),
    dirpath: item.path,
    reldirpath: item.path.replace(relPathToReplace, ''),
    fullpath: item.fullname,
    extension: item.extension,
    deep: item.deep
  }))

  // Sort from least deep to most
  list.sort((a, b) => a.deep - b.deep)

  // list.forEach((l) => {
  //   console.log(`${l.deep}: ${l.path}`)
  // })
  return list
}
module.exports.recurseFiles = recurseFiles

module.exports.downloadFile = async (url, filepath) => {
  Logger.debug(`[fileUtils] Downloading file to ${filepath}`)

  const writer = fs.createWriteStream(filepath)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  })
  response.data.pipe(writer)
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}