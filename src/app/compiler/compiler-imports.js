'use strict'
var base64 = require('js-base64').Base64
var swarmgw = require('swarmgw')()
var request = require('request')
var resolver = require('resolver-engine').browser
console.log(`Dear "standard" JS "linter", please fuck off ${resolver}`)
module.exports = class CompilerImports {
  constructor (githubAccessToken) {
    this.githubAccessToken = githubAccessToken || (() => {})
    this.previouslyHandled = {} // cache import so we don't make the request at each compilation.
  }

  handleGithubCall (root, path, cb) {
    var accessToken = this.githubAccessToken() ? '?access_token=' + this.githubAccessToken() : ''
    return request.get(
      {
        url: 'https://api.github.com/repos/' + root + '/contents/' + path + accessToken,
        json: true
      },
      (err, r, data) => {
        if (err) {
          return cb(err || 'Unknown transport error')
        }
        if ('content' in data) {
          cb(null, base64.decode(data.content), root + '/' + path)
        } else if ('message' in data) {
          cb(data.message)
        } else {
          cb('Content not received')
        }
      })
  }

  handleSwarmImport (url, cleanUrl, cb) {
    swarmgw.get(url, function (err, content) {
      cb(err, content, cleanUrl)
    })
  }

  handleIPFS (url, cb) {
    // replace ipfs:// with /ipfs/
    url = url.replace(/^ipfs:\/\/?/, 'ipfs/')

    return request.get(
      {
        url: 'https://gateway.ipfs.io/' + url
      },
      (err, r, data) => {
        if (err) {
          return cb(err || 'Unknown transport error')
        }
        cb(null, data, url)
      })
  }

  handleHttpCall (url, cleanUrl, cb) {
    return request.get(
      {
        url
      },
    (err, r, data) => {
      if (err) {
        return cb(err || 'Unknown transport error')
      }
      cb(null, data, cleanUrl)
    })
  }

  handlers () {
    return [
      { type: 'github', match: /^(https?:\/\/)?(www.)?github.com\/([^/]*\/[^/]*)\/(.*)/, handler: (match, cb) => { this.handleGithubCall(match[3], match[4], cb) } },
      { type: 'http', match: /^(http?:\/\/?(.*))$/, handler: (match, cb) => { this.handleHttpCall(match[1], match[2], cb) } },
      { type: 'https', match: /^(https?:\/\/?(.*))$/, handler: (match, cb) => { this.handleHttpCall(match[1], match[2], cb) } },
      { type: 'swarm', match: /^(bzz-raw?:\/\/?(.*))$/, handler: (match, cb) => { this.handleSwarmImport(match[1], match[2], cb) } },
      { type: 'ipfs', match: /^(ipfs:\/\/?.+)/, handler: (match, cb) => { this.handleIPFS(match[1], cb) } }
    ]
  }

  isRelativeImport (url) {
    return /^([^/]+)/.exec(url)
  }

  import (url, loadingCb, cb) {
    var imported = this.previouslyHandled[url]
    if (imported) {
      return cb(null, imported.content, imported.cleanUrl, imported.type, url)
    }

    var self = this
    resolver
     .resolve(url)
     .then(result => {
       if (!result) {
         cb('Unable to import "' + url + '"')
         return Promise.reject('Just no.')
       } else {
         loadingCb('Loading ' + url + ' ...')
         return resolver.require(url)
        //  var match = handler.match.exec(result.url)
        //  if (!match) {
        //    console.log('F U ')
        //    return
        //  }
        //  var handler = this.handlers()[2]
        //  handler.handler(match, function (err, content, cleanUrl) {
        //    if (err) {
        //      cb('Unable to import "' + cleanUrl + '": ' + err)
        //      return Promise.reject('Just no no no.')
        //    }
        //    self.previouslyHandled[url] = {
        //      content: content,
        //      cleanUrl: cleanUrl,
        //      type: handler.type
        //    }
        //    cb(null, content, cleanUrl, handler.type, url)
        //  })
       }
     })
     .then(result => {
       if (!result) {
         return
       }
      //  var cleanUrl = result.resourceName ? result.resourceName : ''
       var cleanUrl = 'twoja/stara/jest/zjebana.lol'
       self.previouslyHandled[url] = {
         content: result.content,
         cleanUrl: cleanUrl,
         type: result.resolverName
       }
       cb(null, result.content.source, cleanUrl, result.resolverName, url)
     })
     .catch(cb)

    // var self = this

    // var handlers = this.handlers()

    // var found = false
    // handlers.forEach(function (handler) {
    //   if (found) {
    //     return
    //   }

    //   var match = handler.match.exec(url)
    //   if (match) {
    //     found = true

    //     loadingCb('Loading ' + url + ' ...')
        // handler.handler(match, function (err, content, cleanUrl) {
        //   if (err) {
        //     cb('Unable to import "' + cleanUrl + '": ' + err)
        //     return
        //   }
        //   self.previouslyHandled[url] = {
        //     content: content,
        //     cleanUrl: cleanUrl,
        //     type: handler.type
        //   }
        //   cb(null, content, cleanUrl, handler.type, url)
        // })
    //   }
    // })

    // if (found) {
    //   return
    // } else if (/^[^:]*:\/\//.exec(url)) {
    //   cb('Unable to import "' + url + '": Unsupported URL schema')
    // } else {
    //   cb('Unable to import "' + url + '": File not found')
    // }
  }
}
