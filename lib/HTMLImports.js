/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
window.HTMLImports = window.HTMLImports || {flags:{}};
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

  // imports
  var path = scope.path;
  var xhr = scope.xhr;
  var flags = scope.flags;

  // TODO(sorvell): this loader supports a dynamic list of urls
  // and an oncomplete callback that is called when the loader is done.
  // The polyfill currently does *not* need this dynamism or the onComplete
  // concept. Because of this, the loader could be simplified quite a bit.
  var Loader = function(onLoad, onComplete) {
    this.cache = {};
    this.onload = onLoad;
    this.oncomplete = onComplete;
    this.inflight = 0;
    this.pending = {};
  };

  Loader.prototype = {
    addNodes: function(nodes) {
      // number of transactions to complete
      this.inflight += nodes.length;
      // commence transactions
      for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
        this.require(n);
      }
      // anything to do?
      this.checkDone();
    },
    addNode: function(node) {
      // number of transactions to complete
      this.inflight++;
      // commence transactions
      this.require(node);
      // anything to do?
      this.checkDone();
    },
    require: function(elt) {
      var url = elt.src || elt.href;
      // ensure we have a standard url that can be used
      // reliably for deduping.
      // TODO(sjmiles): ad-hoc
      elt.__nodeUrl = url;
      // deduplication
      if (!this.dedupe(url, elt)) {
        // fetch this resource
        this.fetch(url, elt);
      }
    },
    dedupe: function(url, elt) {
      if (this.pending[url]) {
        // add to list of nodes waiting for inUrl
        this.pending[url].push(elt);
        // don't need fetch
        return true;
      }
      var resource;
      if (this.cache[url]) {
        this.onload(url, elt, this.cache[url]);
        // finished this transaction
        this.tail();
        // don't need fetch
        return true;
      }
      // first node waiting for inUrl
      this.pending[url] = [elt];
      // need fetch (not a dupe)
      return false;
    },
    fetch: function(url, elt) {
      flags.load && console.log('fetch', url, elt);
      if (url.match(/^data:/)) {
        // Handle Data URI Scheme
        var pieces = url.split(',');
        var header = pieces[0];
        var body = pieces[1];
        if(header.indexOf(';base64') > -1) {
          body = atob(body);
        } else {
          body = decodeURIComponent(body);
        }
        setTimeout(function() {
            this.receive(url, elt, null, body);
        }.bind(this), 0);
      } else {
        var receiveXhr = function(err, resource, redirectedUrl) {
          this.receive(url, elt, err, resource, redirectedUrl);
        }.bind(this);
        xhr.load(url, receiveXhr);
        // TODO(sorvell): blocked on)
        // https://code.google.com/p/chromium/issues/detail?id=257221
        // xhr'ing for a document makes scripts in imports runnable; otherwise
        // they are not; however, it requires that we have doctype=html in
        // the import which is unacceptable. This is only needed on Chrome
        // to avoid the bug above.
        /*
        if (isDocumentLink(elt)) {
          xhr.loadDocument(url, receiveXhr);
        } else {
          xhr.load(url, receiveXhr);
        }
        */
      }
    },
    receive: function(url, elt, err, resource, redirectedUrl) {
      this.cache[url] = resource;
      var $p = this.pending[url];
      if ( redirectedUrl && redirectedUrl !== url ) {
        this.cache[redirectedUrl] = resource;
        $p = $p.concat(this.pending[redirectedUrl]);
      }
      for (var i=0, l=$p.length, p; (i<l) && (p=$p[i]); i++) {
        //if (!err) {
          // If url was redirected, use the redirected location so paths are
          // calculated relative to that.
          this.onload(redirectedUrl || url, p, resource);
        //}
        this.tail();
      }
      this.pending[url] = null;
      if ( redirectedUrl && redirectedUrl !== url ) {
        this.pending[redirectedUrl] = null;
      }
    },
    tail: function() {
      --this.inflight;
      this.checkDone();
    },
    checkDone: function() {
      if (!this.inflight) {
        this.oncomplete();
      }
    }
  };

  xhr = xhr || {
    async: true,
    ok: function(request) {
      return (request.status >= 200 && request.status < 300)
          || (request.status === 304)
          || (request.status === 0);
    },
    load: function(url, next, nextContext) {
      var request = new XMLHttpRequest();
      if (scope.flags.debug || scope.flags.bust) {
        url += '?' + Math.random();
      }
      request.open('GET', url, xhr.async);
      request.addEventListener('readystatechange', function(e) {
        if (request.readyState === 4) {
          // Servers redirecting an import can add a Location header to help us
          // polyfill correctly.
          var locationHeader = request.getResponseHeader("Location");
          var redirectedUrl = null;
          if (locationHeader) {
            var redirectedUrl = (locationHeader.substr( 0, 1 ) === "/")
              ? location.origin + locationHeader  // Location is a relative path
              : redirectedUrl;                    // Full path
          }
          next.call(nextContext, !xhr.ok(request) && request,
              request.response || request.responseText, redirectedUrl);
        }
      });
      request.send();
      return request;
    },
    loadDocument: function(url, next, nextContext) {
      this.load(url, next, nextContext).responseType = 'document';
    }
  };

  // exports
  scope.xhr = xhr;
  scope.Loader = Loader;

})(window.HTMLImports);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var IMPORT_LINK_TYPE = 'import';
var flags = scope.flags;
var isIe = /Trident/.test(navigator.userAgent);
// TODO(sorvell): SD polyfill intrusion
var mainDoc = window.ShadowDOMPolyfill ? 
    window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;

// importParser
// highlander object to manage parsing of imports
// parses import related elements
// and ensures proper parse order
// parse order is enforced by crawling the tree and monitoring which elements
// have been parsed; async parsing is also supported.

// highlander object for parsing a document tree
var importParser = {
  // parse selectors for main document elements
  documentSelectors: 'link[rel=' + IMPORT_LINK_TYPE + ']',
  // parse selectors for import document elements
  importsSelectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'link[rel=stylesheet]',
    'style',
    'script:not([type])',
    'script[type="text/javascript"]'
  ].join(','),
  map: {
    link: 'parseLink',
    script: 'parseScript',
    style: 'parseStyle'
  },
  // try to parse the next import in the tree
  parseNext: function() {
    var next = this.nextToParse();
    if (next) {
      this.parse(next);
    }
  },
  parse: function(elt) {
    if (this.isParsed(elt)) {
      flags.parse && console.log('[%s] is already parsed', elt.localName);
      return;
    }
    var fn = this[this.map[elt.localName]];
    if (fn) {
      this.markParsing(elt);
      fn.call(this, elt);
    }
  },
  // only 1 element may be parsed at a time; parsing is async so each
  // parsing implementation must inform the system that parsing is complete
  // via markParsingComplete.
  // To prompt the system to parse the next element, parseNext should then be
  // called.
  // Note, parseNext used to be included at the end of markParsingComplete, but
  // we must not do this so that, for example, we can (1) mark parsing complete 
  // then (2) fire an import load event, and then (3) parse the next resource.
  markParsing: function(elt) {
    flags.parse && console.log('parsing', elt);
    this.parsingElement = elt;
  },
  markParsingComplete: function(elt) {
    elt.__importParsed = true;
    if (elt.__importElement) {
      elt.__importElement.__importParsed = true;
    }
    this.parsingElement = null;
    flags.parse && console.log('completed', elt);
  },
  invalidateParse: function(doc) {
    if (doc && doc.__importLink) {
      doc.__importParsed = doc.__importLink.__importParsed = false;
      this.parseSoon();
    }
  },
  parseSoon: function() {
    if (this._parseSoon) {
      cancelAnimationFrame(this._parseDelay);
    }
    var parser = this;
    this._parseSoon = requestAnimationFrame(function() {
      parser.parseNext();
    });
  },
  parseImport: function(elt) {
    // TODO(sorvell): consider if there's a better way to do this;
    // expose an imports parsing hook; this is needed, for example, by the
    // CustomElements polyfill.
    if (HTMLImports.__importsParsingHook) {
      HTMLImports.__importsParsingHook(elt);
    }
    elt.import.__importParsed = true;
    this.markParsingComplete(elt);
    // fire load event
    if (elt.__resource) {
      elt.dispatchEvent(new CustomEvent('load', {bubbles: false}));    
    } else {
      elt.dispatchEvent(new CustomEvent('error', {bubbles: false}));
    }
    // TODO(sorvell): workaround for Safari addEventListener not working
    // for elements not in the main document.
    if (elt.__pending) {
      var fn;
      while (elt.__pending.length) {
        fn = elt.__pending.shift();
        if (fn) {
          fn({target: elt});
        }
      }
    }
    this.parseNext();
  },
  parseLink: function(linkElt) {
    if (nodeIsImport(linkElt)) {
      this.parseImport(linkElt);
    } else {
      // make href absolute
      linkElt.href = linkElt.href;
      this.parseGeneric(linkElt);
    }
  },
  parseStyle: function(elt) {
    // TODO(sorvell): style element load event can just not fire so clone styles
    var src = elt;
    elt = cloneStyle(elt);
    elt.__importElement = src;
    this.parseGeneric(elt);
  },
  parseGeneric: function(elt) {
    this.trackElement(elt);
    document.head.appendChild(elt);
  },
  // tracks when a loadable element has loaded
  trackElement: function(elt, callback) {
    var self = this;
    var done = function(e) {
      if (callback) {
        callback(e);
      }
      self.markParsingComplete(elt);
      self.parseNext();
    };
    // NOTE:Android Browser lt 4.4 does not fire load event,fire directly is a good solution
     
	elt.addEventListener('load', done);
	elt.addEventListener('error', done);	
    if (elt.rel == "stylesheet") {
		(function(fn) {
			function _cssIsLoaded(cssStylesheet) {
				var cssLoaded = 0;
				try {
					if (cssStylesheet.sheet && cssStylesheet.sheet.cssRules.length > 0)
						cssLoaded = 1;
					else if (cssStylesheet.styleSheet && cssStylesheet.styleSheet.cssText.length > 0)
						cssLoaded = 1;
					else if (cssStylesheet.innerHTML && cssStylesheet.innerHTML.length > 0)
						cssLoaded = 1;
				} catch(ex) {
				}

				if (cssLoaded) {
					fn(new CustomEvent('load', {
						bubbles : false
					}));
					// your css is loaded! Do work!
					// I'd recommend having listeners subscribe to cssLoaded event,
					// and then here you can emit the event (ie. EventManager.emit('cssLoaded');
				} else {
					// I'm using underscore library, but setTimeout would work too
					// You basically just need to call the function again in say, 50 ms
					setTimeout(function() {
						_cssIsLoaded(cssStylesheet);
					}, 50);
				}

			}

			_cssIsLoaded(elt);
		})(done);
	}
    // NOTE: IE does not fire "load" event for styles that have already loaded
    // This is in violation of the spec, so we try our hardest to work around it
    if (isIe && elt.localName === 'style') {
      var fakeLoad = false;
      // If there's not @import in the textContent, assume it has loaded
      if (elt.textContent.indexOf('@import') == -1) {
        fakeLoad = true;
      // if we have a sheet, we have been parsed
      } else if (elt.sheet) {
        fakeLoad = true;
        var csr = elt.sheet.cssRules;
        var len = csr ? csr.length : 0;
        // search the rules for @import's
        for (var i = 0, r; (i < len) && (r = csr[i]); i++) {
          if (r.type === CSSRule.IMPORT_RULE) {
            // if every @import has resolved, fake the load
            fakeLoad = fakeLoad && Boolean(r.styleSheet);
          }
        }
      }
      // dispatch a fake load event and continue parsing
      if (fakeLoad) {
        done(new CustomEvent('load', {bubbles: false}));
      }
    }
  },
  // NOTE: execute scripts by injecting them and watching for the load/error
  // event. Inline scripts are handled via dataURL's because browsers tend to
  // provide correct parsing errors in this case. If this has any compatibility
  // issues, we can switch to injecting the inline script with textContent.
  // Scripts with dataURL's do not appear to generate load events and therefore
  // we assume they execute synchronously.
  parseScript: function(scriptElt) {
    var script = document.createElement('script');
    script.__importElement = scriptElt;
    script.src = scriptElt.src ? scriptElt.src : 
        generateScriptDataUrl(scriptElt);
    scope.currentScript = scriptElt;
    this.trackElement(script, function(e) {
      script.parentNode.removeChild(script);
      scope.currentScript = null;  
    });
    document.head.appendChild(script);
  },
  // determine the next element in the tree which should be parsed
  nextToParse: function() {
    return !this.parsingElement && this.nextToParseInDoc(mainDoc);
  },
  nextToParseInDoc: function(doc, link) {
    var nodes = doc.querySelectorAll(this.parseSelectorsForNode(doc));
    for (var i=0, l=nodes.length, p=0, n; (i<l) && (n=nodes[i]); i++) {
      if (!this.isParsed(n)) {
        if (this.hasResource(n)) {
          return nodeIsImport(n) ? this.nextToParseInDoc(n.import, n) : n;
        } else {
          return;
        }
      }
    }
    // all nodes have been parsed, ready to parse import, if any
    return link;
  },
  // return the set of parse selectors relevant for this node.
  parseSelectorsForNode: function(node) {
    var doc = node.ownerDocument || node;
    return doc === mainDoc ? this.documentSelectors : this.importsSelectors;
  },
  isParsed: function(node) {
    return node.__importParsed;
  },
  hasResource: function(node) {
    if (nodeIsImport(node) && !node.import) {
      return false;
    }
    return true;
  }
};

function nodeIsImport(elt) {
  return (elt.localName === 'link') && (elt.rel === IMPORT_LINK_TYPE);
}

function generateScriptDataUrl(script) {
  var scriptContent = generateScriptContent(script), b64;
  try {
    b64 = btoa(scriptContent);
  } catch(e) {
    b64 = btoa(unescape(encodeURIComponent(scriptContent)));
    console.warn('Script contained non-latin characters that were forced ' +
      'to latin. Some characters may be wrong.', script);
  }
  return 'data:text/javascript;base64,' + b64;
}

function generateScriptContent(script) {
  return script.textContent + generateSourceMapHint(script);
}

// calculate source map hint
function generateSourceMapHint(script) {
  var moniker = script.__nodeUrl;
  if (!moniker) {
    moniker = script.ownerDocument.baseURI;
    // there could be more than one script this url
    var tag = '[' + Math.floor((Math.random()+1)*1000) + ']';
    // TODO(sjmiles): Polymer hack, should be pluggable if we need to allow 
    // this sort of thing
    var matches = script.textContent.match(/Polymer\(['"]([^'"]*)/);
    tag = matches && matches[1] || tag;
    // tag the moniker
    moniker += '/' + tag + '.js';
  }
  return '\n//# sourceURL=' + moniker + '\n';
}

// style/stylesheet handling

// clone style with proper path resolution for main document
// NOTE: styles are the only elements that require direct path fixup.
function cloneStyle(style) {
  var clone = style.ownerDocument.createElement('style');
  clone.textContent = style.textContent;
  path.resolveUrlsInStyle(clone);
  return clone;
}

// path fixup: style elements in imports must be made relative to the main 
// document. We fixup url's in url() and @import.
var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
var CSS_IMPORT_REGEXP = /(@import[\s]+(?!url\())([^;]*)(;)/g;

var path = {
  resolveUrlsInStyle: function(style) {
    var doc = style.ownerDocument;
    var resolver = doc.createElement('a');
    style.textContent = this.resolveUrlsInCssText(style.textContent, resolver);
    return style;  
  },
  resolveUrlsInCssText: function(cssText, urlObj) {
    var r = this.replaceUrls(cssText, urlObj, CSS_URL_REGEXP);
    r = this.replaceUrls(r, urlObj, CSS_IMPORT_REGEXP);
    return r;
  },
  replaceUrls: function(text, urlObj, regexp) {
    return text.replace(regexp, function(m, pre, url, post) {
      var urlPath = url.replace(/["']/g, '');
      urlObj.href = urlPath;
      urlPath = urlObj.href;
      return pre + '\'' + urlPath + '\'' + post;
    });    
  }
}

// exports
scope.parser = importParser;
scope.path = path;
scope.isIE = isIe;

})(HTMLImports);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var hasNative = ('import' in document.createElement('link'));
var useNative = hasNative;
var flags = scope.flags;
var IMPORT_LINK_TYPE = 'import';

// TODO(sorvell): SD polyfill intrusion
var mainDoc = window.ShadowDOMPolyfill ? 
    ShadowDOMPolyfill.wrapIfNeeded(document) : document;

if (!useNative) {

  // imports
  var xhr = scope.xhr;
  var Loader = scope.Loader;
  var parser = scope.parser;

  // importer
  // highlander object to manage loading of imports

  // for any document, importer:
  // - loads any linked import documents (with deduping)

  var importer = {
    documents: {},
    // nodes to load in the mian document
    documentPreloadSelectors: 'link[rel=' + IMPORT_LINK_TYPE + ']',
    // nodes to load in imports
    importsPreloadSelectors: [
      'link[rel=' + IMPORT_LINK_TYPE + ']'
    ].join(','),
    loadNode: function(node) {
      importLoader.addNode(node);
    },
    // load all loadable elements within the parent element
    loadSubtree: function(parent) {
      var nodes = this.marshalNodes(parent);
      // add these nodes to loader's queue
      importLoader.addNodes(nodes);
    },
    marshalNodes: function(parent) {
      // all preloadable nodes in inDocument
      return parent.querySelectorAll(this.loadSelectorsForNode(parent));
    },
    // find the proper set of load selectors for a given node
    loadSelectorsForNode: function(node) {
      var doc = node.ownerDocument || node;
      return doc === mainDoc ? this.documentPreloadSelectors :
          this.importsPreloadSelectors;
    },
    loaded: function(url, elt, resource) {
      flags.load && console.log('loaded', url, elt);
      // store generic resource
      // TODO(sorvell): fails for nodes inside <template>.content
      // see https://code.google.com/p/chromium/issues/detail?id=249381.
      elt.__resource = resource;
      if (isDocumentLink(elt)) {
        var doc = this.documents[url];
        // if we've never seen a document at this url
        if (!doc) {
          // generate an HTMLDocument from data
          doc = makeDocument(resource, url);
          doc.__importLink = elt;
          // TODO(sorvell): we cannot use MO to detect parsed nodes because
          // SD polyfill does not report these as mutations.
          this.bootDocument(doc);
          // cache document
          this.documents[url] = doc;
        }
        // don't store import record until we're actually loaded
        // store document resource
        elt.import = doc;
      }
      parser.parseNext();
    },
    bootDocument: function(doc) {
      this.loadSubtree(doc);
      this.observe(doc);
      parser.parseNext();
    },
    loadedAll: function() {
      parser.parseNext();
    }
  };

  // loader singleton
  var importLoader = new Loader(importer.loaded.bind(importer), 
      importer.loadedAll.bind(importer));

  function isDocumentLink(elt) {
    return isLinkRel(elt, IMPORT_LINK_TYPE);
  }

  function isLinkRel(elt, rel) {
    return elt.localName === 'link' && elt.getAttribute('rel') === rel;
  }

  function isScript(elt) {
    return elt.localName === 'script';
  }

  function makeDocument(resource, url) {
    // create a new HTML document
    var doc = resource;
    if (!(doc instanceof Document)) {
      doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
    }
    // cache the new document's source url
    doc._URL = url;
    // establish a relative path via <base>
    var base = doc.createElement('base');
    base.setAttribute('href', url);
    // add baseURI support to browsers (IE) that lack it.
    if (!doc.baseURI) {
      doc.baseURI = url;
    }
    // ensure UTF-8 charset
    var meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');

    doc.head.appendChild(meta);
    doc.head.appendChild(base);
    // install HTML last as it may trigger CustomElement upgrades
    // TODO(sjmiles): problem wrt to template boostrapping below,
    // template bootstrapping must (?) come before element upgrade
    // but we cannot bootstrap templates until they are in a document
    // which is too late
    if (!(resource instanceof Document)) {
      // install html
      doc.body.innerHTML = resource;
    }
    // TODO(sorvell): ideally this code is not aware of Template polyfill,
    // but for now the polyfill needs help to bootstrap these templates
    if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
      HTMLTemplateElement.bootstrap(doc);
    }
    return doc;
  }
} else {
  // do nothing if using native imports
  var importer = {};
}

// NOTE: We cannot polyfill document.currentScript because it's not possible
// both to override and maintain the ability to capture the native value;
// therefore we choose to expose _currentScript both when native imports
// and the polyfill are in use.
var currentScriptDescriptor = {
  get: function() {
    return HTMLImports.currentScript || document.currentScript;
  },
  configurable: true
};

Object.defineProperty(document, '_currentScript', currentScriptDescriptor);
Object.defineProperty(mainDoc, '_currentScript', currentScriptDescriptor);

// Polyfill document.baseURI for browsers without it.
if (!document.baseURI) {
  var baseURIDescriptor = {
    get: function() {
      return window.location.href;
    },
    configurable: true
  };

  Object.defineProperty(document, 'baseURI', baseURIDescriptor);
  Object.defineProperty(mainDoc, 'baseURI', baseURIDescriptor);
}

// call a callback when all HTMLImports in the document at call (or at least
//  document ready) time have loaded.
// 1. ensure the document is in a ready state (has dom), then 
// 2. watch for loading of imports and call callback when done
function whenImportsReady(callback, doc) {
  doc = doc || mainDoc;
  // if document is loading, wait and try again
  whenDocumentReady(function() {
    watchImportsLoad(callback, doc);
  }, doc);
}

// call the callback when the document is in a ready state (has dom)
var requiredReadyState = HTMLImports.isIE ? 'complete' : 'interactive';
var READY_EVENT = 'readystatechange';
function isDocumentReady(doc) {
  return (doc.readyState === 'complete' ||
      doc.readyState === requiredReadyState);
}

// call <callback> when we ensure the document is in a ready state
function whenDocumentReady(callback, doc) {
  if (!isDocumentReady(doc)) {
    var checkReady = function() {
      if (doc.readyState === 'complete' || 
          doc.readyState === requiredReadyState) {
        doc.removeEventListener(READY_EVENT, checkReady);
        whenDocumentReady(callback, doc);
      }
    }
    doc.addEventListener(READY_EVENT, checkReady);
  } else if (callback) {
    callback();
  }
}

// call <callback> when we ensure all imports have loaded
function watchImportsLoad(callback, doc) {
  var imports = doc.querySelectorAll('link[rel=import]');
  var loaded = 0, l = imports.length;
  function checkDone(d) { 
    if (loaded == l) {
      callback && callback();
    }
  }
  function loadedImport(e) {
    loaded++;
    checkDone();
  }
  if (l) {
    for (var i=0, imp; (i<l) && (imp=imports[i]); i++) {
      if (isImportLoaded(imp)) {
        loadedImport.call(imp);
      } else {
        imp.addEventListener('load', loadedImport);
        imp.addEventListener('error', loadedImport);
      }
    }
  } else {
    checkDone();
  }
}

function isImportLoaded(link) {
  return useNative ? (link.import && (link.import.readyState !== 'loading')) || link.__loaded :
      link.__importParsed;
}

// TODO(sorvell): install a mutation observer to see if HTMLImports have loaded
// this is a workaround for https://www.w3.org/Bugs/Public/show_bug.cgi?id=25007
// and should be removed when this bug is addressed.
if (useNative) {
  new MutationObserver(function(mxns) {
    for (var i=0, l=mxns.length, m; (i < l) && (m=mxns[i]); i++) {
      if (m.addedNodes) {
        handleImports(m.addedNodes);
      }
    }
  }).observe(document.head, {childList: true});

  function handleImports(nodes) {
    for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
      if (isImport(n)) {
        handleImport(n);  
      }
    }
  }

  function isImport(element) {
    return element.localName === 'link' && element.rel === 'import';
  }

  function handleImport(element) {
    var loaded = element.import;
    if (loaded) {
      markTargetLoaded({target: element});
    } else {
      element.addEventListener('load', markTargetLoaded);
      element.addEventListener('error', markTargetLoaded);
    }
  }

  function markTargetLoaded(event) {
    event.target.__loaded = true;
  }

}

// exports
scope.hasNative = hasNative;
scope.useNative = useNative;
scope.importer = importer;
scope.whenImportsReady = whenImportsReady;
scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
scope.isImportLoaded = isImportLoaded;
scope.importLoader = importLoader;

})(window.HTMLImports);

 /*
Copyright 2013 The Polymer Authors. All rights reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file.
*/

(function(scope){

var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
var importSelector = 'link[rel=' + IMPORT_LINK_TYPE + ']';
var importer = scope.importer;
var parser = scope.parser;

// we track mutations for addedNodes, looking for imports
function handler(mutations) {
  for (var i=0, l=mutations.length, m; (i<l) && (m=mutations[i]); i++) {
    if (m.type === 'childList' && m.addedNodes.length) {
      addedNodes(m.addedNodes);
    }
  }
}

// find loadable elements and add them to the importer
function addedNodes(nodes) {
  var owner;
  for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
    owner = owner || n.ownerDocument;
    if (shouldLoadNode(n)) {
      importer.loadNode(n);
    }
    if (n.children && n.children.length) {
      addedNodes(n.children);
    }
  }
  // TODO(sorvell): This is not the right approach here. We shouldn't need to
  // invalidate parsing when an element is added. Disabling this code 
  // until a better approach is found.
  /*
  if (owner) {
    parser.invalidateParse(owner);
  }
  */
}

function shouldLoadNode(node) {
  return (node.nodeType === 1) && matches.call(node,
      importer.loadSelectorsForNode(node));
}

// x-plat matches
var matches = HTMLElement.prototype.matches || 
    HTMLElement.prototype.matchesSelector || 
    HTMLElement.prototype.webkitMatchesSelector ||
    HTMLElement.prototype.mozMatchesSelector ||
    HTMLElement.prototype.msMatchesSelector;

var observer = new MutationObserver(handler);

// observe the given root for loadable elements
function observe(root) {
  observer.observe(root, {childList: true, subtree: true});
}

// exports
// TODO(sorvell): factor so can put on scope
scope.observe = observe;
importer.observe = observe;

})(HTMLImports);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType, dictionary) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType,
        dictionary.bubbles === false ? false : true,
        dictionary.cancelable === false ? false : true,
        dictionary.detail);
     return e;
  };
}

// TODO(sorvell): SD polyfill intrusion
var doc = window.ShadowDOMPolyfill ? 
    window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;

// Fire the 'HTMLImportsLoaded' event when imports in document at load time 
// have loaded. This event is required to simulate the script blocking 
// behavior of native imports. A main document script that needs to be sure
// imports have loaded should wait for this event.
HTMLImports.whenImportsReady(function() {
  HTMLImports.ready = true;
  HTMLImports.readyTime = new Date().getTime();
  doc.dispatchEvent(
    new CustomEvent('HTMLImportsLoaded', {bubbles: true})
  );
});


// no need to bootstrap the polyfill when native imports is available.
if (!HTMLImports.useNative) {
  function bootstrap() {
    HTMLImports.importer.bootDocument(doc);
  }
    
  // TODO(sorvell): SD polyfill does *not* generate mutations for nodes added
  // by the parser. For this reason, we must wait until the dom exists to 
  // bootstrap.
  if (document.readyState === 'complete' ||
      (document.readyState === 'interactive' && !window.attachEvent)) {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
  }
}

})();
