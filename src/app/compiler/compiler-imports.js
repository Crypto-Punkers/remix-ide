'use strict'
var base64 = require('js-base64').Base64
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
