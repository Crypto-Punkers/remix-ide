'use strict'
var EventManager = require('../../lib/events')
var resolver = require('resolver-engine').browser

var URL = URL || window.URL
class ReadOnlyFileProvider {
  constructor () {
    this.event = new EventManager()
    this.files = {}
    // this.paths = {}
    // this.paths[type] = {}
    // this.type = type
    this.normalizedNames = {}
    this.readonly = true

    // TODO map of already resolved?
  }

  close (cb) {
    this.files = {}
    cb()
  }

  init (cb) {
    this.files = {}
  }

  exists (path, cb) {
    var cbw = (...args) => {
      console.log(`exists ${path}: ${args}`)
      cb(...args)
    }
    if (!this.files) return cbw(null, false)

    resolver.resolve(path)
    .then(res => {
      // TODO do something with 'res'
      console.log(`Resolved ${path} to ${res}`)
      cbw(null, this.files[path] !== undefined)
    })
    .catch(cbw)
  }

  get (path, cb) {
    var cbw = (...args) => {
      console.log(`get ${path}: ${args}`)
      cb(...args)
    }
    if (this.files[path]) return cbw(null, this.files[path])

    resolver.require(path)
    .then(res => {
      this.set(path, res.result, () => {
        cbw(null, res.result)
      })
    })
    .catch(cbw)
  }

  set (path, content, cb) {
    var cbw = (...args) => {
      console.log(`set ${path}: ${args}`)
      cb(...args)
    }
    resolver
    .require(path)
    .then(res => {
      var provider = res.resolverName
      var content = res.content
      var location = res.url
      var filePath = res.resourceName ? res.resourceName : (new URL(location).pathname)

      this.addReadOnly(`${provider}/${filePath}`, content)
      if (cb) cbw()
    })
    .catch(cbw)
    return true
  }

  addReadOnly (path, content, rawPath) {
    try { // lazy try to format JSON
      content = JSON.stringify(JSON.parse(content), null, '\t')
    } catch (e) {}
    if (!rawPath) rawPath = path
    // splitting off the path in a tree structure, the json tree is used in `resolveDirectory`
    var split = path
    var folder = false
    while (split.lastIndexOf('/') !== -1) {
      var subitem = split.substring(split.lastIndexOf('/'))
      split = split.substring(0, split.lastIndexOf('/'))
      if (!this.paths[this.type + '/' + split]) {
        this.paths[this.type + '/' + split] = {}
      }
      this.paths[this.type + '/' + split][split + subitem] = { isDirectory: folder }
      folder = true
    }
    this.paths[this.type][split] = { isDirectory: folder }
    this.files[path] = content
    this.normalizedNames[rawPath] = path
    this.event.trigger('fileAdded', [path, true])
    return true
  }

  isReadOnly (path) {
    return true
  }

  remove (path) {
  }

  rename (oldPath, newPath, isFolder) {
    return true
  }

  list () {
    return this.files
  }

  resolveDirectory (path, callback) {
    var self = this
    if (path[0] === '/') path = path.substring(1)
    if (!path) return callback(null, { [self.type]: { } })
    // we just return the json tree populated by `addReadOnly`
    callback(null, this.paths[path])
  }

  removePrefix (path) {
    return path.indexOf(this.type + '/') === 0 ? path.replace(this.type + '/', '') : path
  }
}

module.exports = ReadOnlyFileProvider
