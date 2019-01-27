'use strict'
var base64 = require('js-base64').Base64
var swarmgw = require('swarmgw')()
var request = require('request')
var resolver = require('resolver-engine').browser

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

  import (uri, loadingCb, cb) {
    var imported = this.previouslyHandled[uri]
    if (imported) {
      return cb(null, imported.content, imported.cleanUrl, imported.type, uri)
    }

    var self = this
    resolver
     .resolve(uri)
     .then(result => {
       if (!result) {
         cb('Unable to import "' + uri + '"')
         return Promise.reject('Just no.')
       } else {
         loadingCb('Loading ' + uri + ' ...')
         return resolver.require(uri)
       }
     })
     .then(result => {
       if (!result) {
         return
       }

       var cleanUrl = result.url
       self.previouslyHandled[uri] = {
         content: result.content,
         cleanUrl: cleanUrl,
         type: result.resolverName
       }
       cb(null, result.content.source, cleanUrl, result.resolverName, uri)
     })
     .catch(cb)
  }
}
