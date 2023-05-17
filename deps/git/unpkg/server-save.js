'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var cors = _interopDefault(require('cors'));
var express = _interopDefault(require('express'));
var morgan = _interopDefault(require('morgan'));
var path = _interopDefault(require('path'));
var tar = _interopDefault(require('tar-stream'));
var mime = _interopDefault(require('mime'));
var SRIToolbox = _interopDefault(require('sri-toolbox'));
var url = _interopDefault(require('url'));
var https = _interopDefault(require('https'));
var gunzip = _interopDefault(require('gunzip-maybe'));
var LRUCache = _interopDefault(require('lru-cache'));
var server$1 = require('react-dom/server');
var semver = _interopDefault(require('semver'));
var core = require('@emotion/core');
var React = require('react');
var PropTypes = _interopDefault(require('prop-types'));
var VisuallyHidden = _interopDefault(require('@reach/visually-hidden'));
var sortBy = _interopDefault(require('sort-by'));
var formatBytes = _interopDefault(require('pretty-bytes'));
var jsesc = _interopDefault(require('jsesc'));
var hljs = _interopDefault(require('highlight.js'));
var etag = _interopDefault(require('etag'));
var cheerio = _interopDefault(require('cheerio'));
var babel = _interopDefault(require('@babel/core'));
var URL = _interopDefault(require('whatwg-url'));
var warning = _interopDefault(require('warning'));
var dateFns = require('date-fns');
var fetch$1 = _interopDefault(require('isomorphic-fetch'));
var util = _interopDefault(require('util'));
var validateNpmPackageName = _interopDefault(require('validate-npm-package-name'));

/**
 * Useful for wrapping `async` request handlers in Express
 * so they automatically propagate errors.
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(error => {
      req.log.error(`Unexpected error in ${handler.name}!`);
      req.log.error(error.stack);
      next(error);
    });
  };
}

function bufferStream(stream) {
  return new Promise((accept, reject) => {
    const chunks = [];
    stream.on('error', reject).on('data', chunk => chunks.push(chunk)).on('end', () => accept(Buffer.concat(chunks)));
  });
}

mime.define({
  'text/plain': ['authors', 'changes', 'license', 'makefile', 'patents', 'readme', 'ts', 'flow']
},
/* force */
true);
const textFiles = /\/?(\.[a-z]*rc|\.git[a-z]*|\.[a-z]*ignore|\.lock)$/i;
function getContentType(file) {
  const name = path.basename(file);
  return textFiles.test(name) ? 'text/plain' : mime.getType(name) || 'text/plain';
}

function getIntegrity(data) {
  return SRIToolbox.generate({
    algorithms: ['sha384']
  }, data);
}

const npmRegistryURL = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';
const agent = new https.Agent({
  keepAlive: true
});
const oneMegabyte = 1024 * 1024;
const oneSecond = 1000;
const oneMinute = oneSecond * 60;
const cache = new LRUCache({
  max: oneMegabyte * 40,
  length: Buffer.byteLength,
  maxAge: oneSecond
});
const notFound = '';

function get(options) {
  return new Promise((accept, reject) => {
    https.get(options, accept).on('error', reject);
  });
}

function isScopedPackageName(packageName) {
  return packageName.startsWith('@');
}

function encodePackageName(packageName) {
  return isScopedPackageName(packageName) ? `@${encodeURIComponent(packageName.substring(1))}` : encodeURIComponent(packageName);
}

async function fetchPackageInfo(packageName, log) {
  const name = encodePackageName(packageName);
  const infoURL = `${npmRegistryURL}/${name}`;
  log.debug('Fetching package info for %s from %s', packageName, infoURL);
  const {
    hostname,
    pathname
  } = url.parse(infoURL);
  const options = {
    agent: agent,
    hostname: hostname,
    path: pathname,
    headers: {
      Accept: 'application/json'
    }
  };
  const res = await get(options);

  if (res.statusCode === 200) {
    return bufferStream(res).then(JSON.parse);
  }

  if (res.statusCode === 404) {
    return null;
  }

  const content = (await bufferStream(res)).toString('utf-8');
  log.error('Error fetching info for %s (status: %s)', packageName, res.statusCode);
  log.error(content);
  return null;
}

async function fetchVersionsAndTags(packageName, log) {
  const info = await fetchPackageInfo(packageName, log);
  return info && info.versions ? {
    versions: Object.keys(info.versions),
    tags: info['dist-tags']
  } : null;
}
/**
 * Returns an object of available { versions, tags }.
 * Uses a cache to avoid over-fetching from the registry.
 */


async function getVersionsAndTags(packageName, log) {
  const cacheKey = `versions-${packageName}`;
  const cacheValue = cache.get(cacheKey);

  if (cacheValue != null) {
    return cacheValue === notFound ? null : JSON.parse(cacheValue);
  }

  const value = await fetchVersionsAndTags(packageName, log);

  if (value == null) {
    cache.set(cacheKey, notFound, 5 * oneMinute);
    return null;
  }

  cache.set(cacheKey, JSON.stringify(value), oneMinute);
  return value;
} // All the keys that sometimes appear in package info
// docs that we don't need. There are probably more.

const packageConfigExcludeKeys = ['browserify', 'bugs', 'directories', 'engines', 'files', 'homepage', 'keywords', 'maintainers', 'scripts'];

function cleanPackageConfig(config) {
  return Object.keys(config).reduce((memo, key) => {
    if (!key.startsWith('_') && !packageConfigExcludeKeys.includes(key)) {
      memo[key] = config[key];
    }

    return memo;
  }, {});
}

async function fetchPackageConfig(packageName, version, log) {
  const info = await fetchPackageInfo(packageName, log);
  return info && info.versions && version in info.versions ? cleanPackageConfig(info.versions[version]) : null;
}
/**
 * Returns metadata about a package, mostly the same as package.json.
 * Uses a cache to avoid over-fetching from the registry.
 */


async function getPackageConfig(packageName, version, log) {
  const cacheKey = `config-${packageName}-${version}`;
  const cacheValue = cache.get(cacheKey);

  if (cacheValue != null) {
    return cacheValue === notFound ? null : JSON.parse(cacheValue);
  }

  const value = await fetchPackageConfig(packageName, version, log);

  if (value == null) {
    cache.set(cacheKey, notFound, 5 * oneMinute);
    return null;
  }

  cache.set(cacheKey, JSON.stringify(value), oneMinute);
  return value;
}
/**
 * Returns a stream of the tarball'd contents of the given package.
 */

async function getPackage(packageName, version, log) {
  const tarballName = isScopedPackageName(packageName) ? packageName.split('/')[1] : packageName;
  const tarballURL = `${npmRegistryURL}/${packageName}/-/${tarballName}-${version}.tgz`;
  log.debug('Fetching package for %s from %s', packageName, tarballURL);
  const {
    hostname,
    pathname
  } = url.parse(tarballURL);
  const options = {
    agent: agent,
    hostname: hostname,
    path: pathname
  };
  const res = await get(options);

  if (res.statusCode === 200) {
    const stream = res.pipe(gunzip()); // stream.pause();

    return stream;
  }

  if (res.statusCode === 404) {
    return null;
  }

  const content = (await bufferStream(res)).toString('utf-8');
  log.error('Error fetching tarball for %s@%s (status: %s)', packageName, version, res.statusCode);
  log.error(content);
  return null;
}

function Object.assign() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _taggedTemplateLiteralLoose(strings, raw) {
  if (!raw) {
    raw = strings.slice(0);
  }

  strings.raw = raw;
  return strings;
}

var fontSans = "\nfont-family: -apple-system,\n  BlinkMacSystemFont,\n  \"Segoe UI\",\n  \"Roboto\",\n  \"Oxygen\",\n  \"Ubuntu\",\n  \"Cantarell\",\n  \"Fira Sans\",\n  \"Droid Sans\",\n  \"Helvetica Neue\",\n  sans-serif;\n";
var fontMono = "\nfont-family: Menlo,\n  Monaco,\n  Lucida Console,\n  Liberation Mono,\n  DejaVu Sans Mono,\n  Bitstream Vera Sans Mono,\n  Courier New,\n  monospace;\n";

function formatNumber(n) {
  var digits = String(n).split('');
  var groups = [];

  while (digits.length) {
    groups.unshift(digits.splice(-3).join(''));
  }

  return groups.join(',');
}
function formatPercent(n, decimals) {
  if (decimals === void 0) {
    decimals = 1;
  }

  return (n * 100).toPrecision(decimals + 2);
}

var maxWidth = 700;
function ContentArea(_ref) {
  return core.jsx("div", {
    css: {
      border: '1px solid #dfe2e5',
      borderRadius: 3,
      ["@media (max-width: " + maxWidth + "px)"]: {
        borderRightWidth: 0,
        borderLeftWidth: 0
      },
      ..._ref.css
    }
  }, _ref.children);
}

function ContentAreaHeaderBar(_ref2) { 
  return core.jsx("div", {
    css: {
      padding: 10,
      background: '#f6f8fa',
      color: '#424242',
      border: '1px solid #d1d5da',
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      margin: '-1px -1px 0',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ["@media (max-width: " + maxWidth + "px)"]: {
        paddingRight: 20,
        paddingLeft: 20
      },
      ..._ref2.css
    }
  }, _ref2.children);
}

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = React.createContext && React.createContext(DefaultContext);

var __assign = global && global.__assign || function () {
  __assign = Object.assign || function (t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];

      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }

    return t;
  };

  return __assign.apply(this, arguments);
};

var __rest = global && global.__rest || function (s, e) {
  var t = {};

  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];

  if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]];
  return t;
};

function Tree2Element(tree) {
  return tree && tree.map(function (node, i) {
    return React.createElement(node.tag, Object.assign({
      key: i
    }, node.attr), Tree2Element(node.child));
  });
}

function GenIcon(data) {
  return function (props) {
    return React.createElement(IconBase, Object.assign({
      attr: Object.assign({}, data.attr)
    }, props), Tree2Element(data.child));
  };
}
function IconBase(props) {
  var elem = function (conf) {
    var computedSize = props.size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + ' ' : '') + props.className;

    var attr = props.attr,
        title = props.title,
        svgProps = __rest(props, ["attr", "title"]);

    return React.createElement("svg", Object.assign({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: Object.assign({
        color: props.color || conf.color
      }, conf.style, props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && React.createElement("title", null, title), props.children);
  };

  return IconContext !== undefined ? React.createElement(IconContext.Consumer, null, function (conf) {
    return elem(conf);
  }) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
var GoFileCode = function (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 12 16"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M8.5 1H1c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4.5L8.5 1zM11 14H1V2h7l3 3v9zM5 6.98L3.5 8.5 5 10l-.5 1L2 8.5 4.5 6l.5.98zM7.5 6L10 8.5 7.5 11l-.5-.98L8.5 8.5 7 7l.5-1z"}}]})(props);
};
GoFileCode.displayName = "GoFileCode";
var GoFileDirectory = function (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 14 16"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z"}}]})(props);
};
GoFileDirectory.displayName = "GoFileDirectory";
var GoFile = function (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 12 16"},"child":[{"tag":"path","attr":{"fillRule":"evenodd","d":"M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z"}}]})(props);
};
GoFile.displayName = "GoFile";

// THIS FILE IS AUTO GENERATED
var FaGithub = function (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 496 512"},"child":[{"tag":"path","attr":{"d":"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"}}]})(props);
};
FaGithub.displayName = "FaGithub";
var FaTwitter = function (props) {
  return GenIcon({"tag":"svg","attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"}}]})(props);
};
FaTwitter.displayName = "FaTwitter";

function createIcon(Type, _ref) {
  var css = _ref.css,
      rest = _objectWithoutPropertiesLoose(_ref, ["css"]);

  return core.jsx(Type, Object.assign({
    css: Object.assign({}, css, {
      verticalAlign: 'text-bottom'
    })
  }, rest));
}

function FileIcon(props) {
  return createIcon(GoFile, props);
}
function FileCodeIcon(props) {
  return createIcon(GoFileCode, props);
}
function FolderIcon(props) {
  return createIcon(GoFileDirectory, props);
}
function TwitterIcon(props) {
  return createIcon(FaTwitter, props);
}
function GitHubIcon(props) {
  return createIcon(FaGithub, props);
}

var linkStyle = {
  color: '#0076ff',
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline'
  }
};
var tableCellStyle = {
  paddingTop: 6,
  paddingRight: 3,
  paddingBottom: 6,
  paddingLeft: 3,
  borderTop: '1px solid #eaecef'
};

var iconCellStyle = Object.assign({}, tableCellStyle, {
  color: '#424242',
  width: 17,
  paddingRight: 2,
  paddingLeft: 10,
  '@media (max-width: 700px)': {
    paddingLeft: 20
  }
});

var typeCellStyle = Object.assign({}, tableCellStyle, {
  textAlign: 'right',
  paddingRight: 10,
  '@media (max-width: 700px)': {
    paddingRight: 20
  }
});

function getRelName(path, base) {
  return path.substr(base.length > 1 ? base.length + 1 : 1);
}

function FolderViewer(_ref) {
  var path = _ref.path,
      entries = _ref.details;

  var _Object$keys$reduce = Object.keys(entries).reduce(function (memo, key) {
    var subdirs = memo.subdirs,
        files = memo.files;
    var entry = entries[key];

    if (entry.type === 'directory') {
      subdirs.push(entry);
    } else if (entry.type === 'file') {
      files.push(entry);
    }

    return memo;
  }, {
    subdirs: [],
    files: []
  }),
      subdirs = _Object$keys$reduce.subdirs,
      files = _Object$keys$reduce.files;

  subdirs.sort(sortBy('path'));
  files.sort(sortBy('path'));
  var rows = [];

  if (path !== '/') {
    rows.push(core.jsx("tr", {
      key: ".."
    }, core.jsx("td", {
      css: iconCellStyle
    }), core.jsx("td", {
      css: tableCellStyle
    }, core.jsx("a", {
      title: "Parent directory",
      href: "../",
      css: linkStyle
    }, "..")), core.jsx("td", {
      css: tableCellStyle
    }), core.jsx("td", {
      css: typeCellStyle
    })));
  }

  subdirs.forEach(function (_ref2) {
    var dirname = _ref2.path;
    var relName = getRelName(dirname, path);
    var href = relName + '/';
    rows.push(core.jsx("tr", {
      key: relName
    }, core.jsx("td", {
      css: iconCellStyle
    }, core.jsx(FolderIcon, null)), core.jsx("td", {
      css: tableCellStyle
    }, core.jsx("a", {
      title: relName,
      href: href,
      css: linkStyle
    }, relName)), core.jsx("td", {
      css: tableCellStyle
    }, "-"), core.jsx("td", {
      css: typeCellStyle
    }, "-")));
  });
  files.forEach(function (_ref3) {
    var filename = _ref3.path,
        size = _ref3.size,
        contentType = _ref3.contentType;
    var relName = getRelName(filename, path);
    var href = relName;
    rows.push(core.jsx("tr", {
      key: relName
    }, core.jsx("td", {
      css: iconCellStyle
    }, contentType === 'text/plain' || contentType === 'text/markdown' ? core.jsx(FileIcon, null) : core.jsx(FileCodeIcon, null)), core.jsx("td", {
      css: tableCellStyle
    }, core.jsx("a", {
      title: relName,
      href: href,
      css: linkStyle
    }, relName)), core.jsx("td", {
      css: tableCellStyle
    }, formatBytes(size)), core.jsx("td", {
      css: typeCellStyle
    }, contentType)));
  });
  var counts = [];

  if (files.length > 0) {
    counts.push(files.length + " file" + (files.length === 1 ? '' : 's'));
  }

  if (subdirs.length > 0) {
    counts.push(subdirs.length + " folder" + (subdirs.length === 1 ? '' : 's'));
  }

  return core.jsx(ContentArea, null, core.jsx(ContentAreaHeaderBar, null, core.jsx("span", null, counts.join(', '))), core.jsx("table", {
    css: {
      width: '100%',
      borderCollapse: 'collapse',
      borderRadius: 2,
      background: '#fff',
      '@media (max-width: 700px)': {
        '& th + th + th + th, & td + td + td + td': {
          display: 'none'
        }
      },
      '& tr:first-of-type td': {
        borderTop: 0
      }
    }
  }, core.jsx("thead", null, core.jsx("tr", null, core.jsx("th", null, core.jsx(VisuallyHidden, null, "Icon")), core.jsx("th", null, core.jsx(VisuallyHidden, null, "Name")), core.jsx("th", null, core.jsx(VisuallyHidden, null, "Size")), core.jsx("th", null, core.jsx(VisuallyHidden, null, "Content Type")))), core.jsx("tbody", null, rows)));
}

if (process.env.NODE_ENV !== 'production') {
  FolderViewer.propTypes = {
    path: PropTypes.string.isRequired,
    details: PropTypes.objectOf(PropTypes.shape({
      path: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['directory', 'file']).isRequired,
      contentType: PropTypes.string,
      // file only
      integrity: PropTypes.string,
      // file only
      size: PropTypes.number // file only

    })).isRequired
  };
}

function createHTML(content) {
  return {
    __html: content
  };
}

/** @jsx jsx */

function getBasename(path) {
  var segments = path.split('/');
  return segments[segments.length - 1];
}

function ImageViewer(_ref) {
  var path = _ref.path,
      uri = _ref.uri;
  return core.jsx("div", {
    css: {
      padding: 20,
      textAlign: 'center'
    }
  }, core.jsx("img", {
    alt: getBasename(path),
    src: uri
  }));
}

function CodeListing(_ref2) {
  var highlights = _ref2.highlights;
  var lines = highlights.slice(0);
  var hasTrailingNewline = lines.length && lines[lines.length - 1] === '';

  if (hasTrailingNewline) {
    lines.pop();
  }

  return core.jsx("div", {
    className: "code-listing",
    css: {
      overflowX: 'auto',
      overflowY: 'hidden',
      paddingTop: 5,
      paddingBottom: 5
    }
  }, core.jsx("table", {
    css: {
      border: 'none',
      borderCollapse: 'collapse',
      borderSpacing: 0
    }
  }, core.jsx("tbody", null, lines.map(function (line, index) {
    var lineNumber = index + 1;
    return core.jsx("tr", {
      key: index
    }, core.jsx("td", {
      id: "L" + lineNumber,
      css: {
        paddingLeft: 10,
        paddingRight: 10,
        color: 'rgba(27,31,35,.3)',
        textAlign: 'right',
        verticalAlign: 'top',
        width: '1%',
        minWidth: 50,
        userSelect: 'none'
      }
    }, core.jsx("span", null, lineNumber)), core.jsx("td", {
      id: "LC" + lineNumber,
      css: {
        paddingLeft: 10,
        paddingRight: 10,
        color: '#24292e',
        whiteSpace: 'pre'
      }
    }, core.jsx("code", {
      dangerouslySetInnerHTML: createHTML(line)
    })));
  }), !hasTrailingNewline && core.jsx("tr", {
    key: "no-newline"
  }, core.jsx("td", {
    css: {
      paddingLeft: 10,
      paddingRight: 10,
      color: 'rgba(27,31,35,.3)',
      textAlign: 'right',
      verticalAlign: 'top',
      width: '1%',
      minWidth: 50,
      userSelect: 'none'
    }
  }, "\\"), core.jsx("td", {
    css: {
      paddingLeft: 10,
      color: 'rgba(27,31,35,.3)',
      userSelect: 'none'
    }
  }, "No newline at end of file")))));
}

function BinaryViewer() {
  return core.jsx("div", {
    css: {
      padding: 20
    }
  }, core.jsx("p", {
    css: {
      textAlign: 'center'
    }
  }, "No preview available."));
}

function FileViewer(_ref3) {
  var packageName = _ref3.packageName,
      packageVersion = _ref3.packageVersion,
      path = _ref3.path,
      details = _ref3.details;
  var highlights = details.highlights,
      uri = details.uri,
      language = details.language,
      size = details.size;
  return core.jsx(ContentArea, null, core.jsx(ContentAreaHeaderBar, null, core.jsx("span", null, formatBytes(size)), core.jsx("span", null, language), core.jsx("span", null, core.jsx("a", {
    href: "/" + packageName + "@" + packageVersion + path,
    css: {
      display: 'inline-block',
      marginLeft: 8,
      padding: '2px 8px',
      textDecoration: 'none',
      fontWeight: 600,
      fontSize: '0.9rem',
      color: '#24292e',
      backgroundColor: '#eff3f6',
      border: '1px solid rgba(27,31,35,.2)',
      borderRadius: 3,
      ':hover': {
        backgroundColor: '#e6ebf1',
        borderColor: 'rgba(27,31,35,.35)'
      },
      ':active': {
        backgroundColor: '#e9ecef',
        borderColor: 'rgba(27,31,35,.35)',
        boxShadow: 'inset 0 0.15em 0.3em rgba(27,31,35,.15)'
      }
    }
  }, "View Raw"))), highlights ? core.jsx(CodeListing, {
    highlights: highlights
  }) : uri ? core.jsx(ImageViewer, {
    path: path,
    uri: uri
  }) : core.jsx(BinaryViewer, null));
}

if (process.env.NODE_ENV !== 'production') {
  FileViewer.propTypes = {
    path: PropTypes.string.isRequired,
    details: PropTypes.shape({
      contentType: PropTypes.string.isRequired,
      highlights: PropTypes.arrayOf(PropTypes.string),
      // code
      uri: PropTypes.string,
      // images
      integrity: PropTypes.string.isRequired,
      language: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired
    }).isRequired
  };
}

var SelectDownArrow = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAYAAAC9vt6cAAAAAXNSR0IArs4c6QAAARFJREFUKBVjZAACNS39RhBNKrh17WI9o4quoT3Dn78HSNUMUs/CzOTI/O7Vi4dCYpJ3/jP+92BkYGAlyiBGhm8MjIxJt65e3MQM0vDu9YvLYmISILYZELOBxHABRkaGr0yMzF23r12YDFIDNgDEePv65SEhEXENBkYGFSAXuyGMjF8Z/jOsvX3tYiFIDwgwQSgIaaijnvj/P8M5IO8HsjiY/f//D4b//88A1SQhywG9jQr09PS4v/1mPAeUUPzP8B8cJowMjL+Bqu6xMQmaXL164AuyDgwDQJLa2qYSP//9vARkCoMVMzK8YeVkNbh+9uxzMB+JwGoASF5Vx0jz/98/18BqmZi171w9D2EjaaYKEwAEK00XQLdJuwAAAABJRU5ErkJggg==";

function _templateObject2() {
  var data = _taggedTemplateLiteralLoose(["\n  .code-listing {\n    background: #fbfdff;\n    color: #383a42;\n  }\n  .code-comment,\n  .code-quote {\n    color: #a0a1a7;\n    font-style: italic;\n  }\n  .code-doctag,\n  .code-keyword,\n  .code-link,\n  .code-formula {\n    color: #a626a4;\n  }\n  .code-section,\n  .code-name,\n  .code-selector-tag,\n  .code-deletion,\n  .code-subst {\n    color: #e45649;\n  }\n  .code-literal {\n    color: #0184bb;\n  }\n  .code-string,\n  .code-regexp,\n  .code-addition,\n  .code-attribute,\n  .code-meta-string {\n    color: #50a14f;\n  }\n  .code-built_in,\n  .code-class .code-title {\n    color: #c18401;\n  }\n  .code-attr,\n  .code-variable,\n  .code-template-variable,\n  .code-type,\n  .code-selector-class,\n  .code-selector-attr,\n  .code-selector-pseudo,\n  .code-number {\n    color: #986801;\n  }\n  .code-symbol,\n  .code-bullet,\n  .code-meta,\n  .code-selector-id,\n  .code-title {\n    color: #4078f2;\n  }\n  .code-emphasis {\n    font-style: italic;\n  }\n  .code-strong {\n    font-weight: bold;\n  }\n"]);

  _templateObject2 = function _templateObject2() {
    return data;
  };

  return data;
}

function _templateObject() {
  var data = _taggedTemplateLiteralLoose(["\n  html {\n    box-sizing: border-box;\n  }\n  *,\n  *:before,\n  *:after {\n    box-sizing: inherit;\n  }\n\n  html,\n  body,\n  #root {\n    height: 100%;\n    margin: 0;\n  }\n\n  body {\n    ", "\n    font-size: 16px;\n    line-height: 1.5;\n    overflow-wrap: break-word;\n    background: white;\n    color: black;\n  }\n\n  code {\n    ", "\n  }\n\n  th,\n  td {\n    padding: 0;\n  }\n\n  select {\n    font-size: inherit;\n  }\n\n  #root {\n    display: flex;\n    flex-direction: column;\n  }\n"]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}
var buildId = "af8c8db";
var globalStyles = core.css(_templateObject(), fontSans, fontMono); // Adapted from https://github.com/highlightjs/highlight.js/blob/master/src/styles/atom-one-light.css

var lightCodeStyles = core.css(_templateObject2());

function Link(_ref) {
  var css = _ref.css,
      rest = _objectWithoutPropertiesLoose(_ref, ["css"]);

  return (// eslint-disable-next-line jsx-a11y/anchor-has-content
    core.jsx("a", Object.assign({}, rest, {
      css: Object.assign({
        color: '#0076ff',
        textDecoration: 'none',
        ':hover': {
          textDecoration: 'underline'
        }
      }, css)
    }))
  );
}

function AppHeader() {
  return core.jsx("header", {
    css: {
      marginTop: '2rem'
    }
  }, core.jsx("h1", {
    css: {
      textAlign: 'center',
      fontSize: '3rem',
      letterSpacing: '0.05em'
    }
  }, core.jsx("a", {
    href: "/",
    css: {
      color: '#000',
      textDecoration: 'none'
    }
  }, "UNPKG")));
}

function AppNavigation(_ref2) {
  var packageName = _ref2.packageName,
      packageVersion = _ref2.packageVersion,
      availableVersions = _ref2.availableVersions,
      filename = _ref2.filename;

  function handleVersionChange(nextVersion) {
    window.location.href = window.location.href.replace('@' + packageVersion, '@' + nextVersion);
  }

  var breadcrumbs = [];

  if (filename === '/') {
    breadcrumbs.push(packageName);
  } else {
    var url = "/browse/" + packageName + "@" + packageVersion;
    breadcrumbs.push(core.jsx(Link, {
      href: url + "/"
    }, packageName));
    var segments = filename.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
    var lastSegment = segments.pop();
    segments.forEach(function (segment) {
      url += "/" + segment;
      breadcrumbs.push(core.jsx(Link, {
        href: url + "/"
      }, segment));
    });
    breadcrumbs.push(lastSegment);
  }

  return core.jsx("header", {
    css: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      '@media (max-width: 700px)': {
        flexDirection: 'column-reverse',
        alignItems: 'flex-start'
      }
    }
  }, core.jsx("h1", {
    css: {
      fontSize: '1.5rem',
      fontWeight: 'normal',
      flex: 1,
      wordBreak: 'break-all'
    }
  }, core.jsx("nav", null, breadcrumbs.map(function (item, index, array) {
    return core.jsx(React.Fragment, {
      key: index
    }, index !== 0 && core.jsx("span", {
      css: {
        paddingLeft: 5,
        paddingRight: 5
      }
    }, "/"), index === array.length - 1 ? core.jsx("strong", null, item) : item);
  }))), core.jsx(PackageVersionPicker, {
    packageVersion: packageVersion,
    availableVersions: availableVersions,
    onChange: handleVersionChange
  }));
}

function PackageVersionPicker(_ref3) {
  var packageVersion = _ref3.packageVersion,
      availableVersions = _ref3.availableVersions,
      onChange = _ref3.onChange;

  function handleChange(event) {
    if (onChange) onChange(event.target.value);
  }

  return core.jsx("p", {
    css: {
      marginLeft: 20,
      '@media (max-width: 700px)': {
        marginLeft: 0,
        marginBottom: 0
      }
    }
  }, core.jsx("label", null, "Version:", ' ', core.jsx("select", {
    name: "version",
    defaultValue: packageVersion,
    onChange: handleChange,
    css: {
      appearance: 'none',
      cursor: 'pointer',
      padding: '4px 24px 4px 8px',
      fontWeight: 600,
      fontSize: '0.9em',
      color: '#24292e',
      border: '1px solid rgba(27,31,35,.2)',
      borderRadius: 3,
      backgroundColor: '#eff3f6',
      backgroundImage: "url(" + SelectDownArrow + ")",
      backgroundPosition: 'right 8px center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'auto 25%',
      ':hover': {
        backgroundColor: '#e6ebf1',
        borderColor: 'rgba(27,31,35,.35)'
      },
      ':active': {
        backgroundColor: '#e9ecef',
        borderColor: 'rgba(27,31,35,.35)',
        boxShadow: 'inset 0 0.15em 0.3em rgba(27,31,35,.15)'
      }
    }
  }, availableVersions.map(function (v) {
    return core.jsx("option", {
      key: v,
      value: v
    }, v);
  }))));
}

function AppContent(_ref4) {
  var packageName = _ref4.packageName,
      packageVersion = _ref4.packageVersion,
      target = _ref4.target;
  return target.type === 'directory' ? core.jsx(FolderViewer, {
    path: target.path,
    details: target.details
  }) : target.type === 'file' ? core.jsx(FileViewer, {
    packageName: packageName,
    packageVersion: packageVersion,
    path: target.path,
    details: target.details
  }) : null;
}

function App(_ref5) {
  var packageName = _ref5.packageName,
      packageVersion = _ref5.packageVersion,
      _ref5$availableVersio = _ref5.availableVersions,
      availableVersions = _ref5$availableVersio === void 0 ? [] : _ref5$availableVersio,
      filename = _ref5.filename,
      target = _ref5.target;
  var maxContentWidth = 940; // TODO: Make this changeable
  return core.jsx(React.Fragment, null, core.jsx(core.Global, {
    styles: globalStyles
  }), core.jsx(core.Global, {
    styles: lightCodeStyles
  }), core.jsx("div", {
    css: {
      flex: '1 0 auto'
    }
  }, core.jsx("div", {
    css: {
      maxWidth: maxContentWidth,
      padding: '0 20px',
      margin: '0 auto'
    }
  }, core.jsx(AppHeader, null)), core.jsx("div", {
    css: {
      maxWidth: maxContentWidth,
      padding: '0 20px',
      margin: '0 auto'
    }
  }, core.jsx(AppNavigation, {
    packageName: packageName,
    packageVersion: packageVersion,
    availableVersions: availableVersions,
    filename: filename
  })), core.jsx("div", {
    css: {
      maxWidth: maxContentWidth,
      padding: '0 20px',
      margin: '0 auto',
      '@media (max-width: 700px)': {
        padding: 0,
        margin: 0
      }
    }
  }, core.jsx(AppContent, {
    packageName: packageName,
    packageVersion: packageVersion,
    target: target
  }))), core.jsx("footer", {
    css: {
      marginTop: '5rem',
      background: 'black',
      color: '#aaa'
    }
  }, core.jsx("div", {
    css: {
      maxWidth: maxContentWidth,
      padding: '10px 20px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, core.jsx("p", null, core.jsx("span", null, "Build: ", buildId)), core.jsx("p", null, core.jsx("span", null, "\xA9 ", new Date().getFullYear(), " UNPKG")), core.jsx("p", {
    css: {
      fontSize: '1.5rem'
    }
  }, core.jsx("a", {
    href: "https://twitter.com/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      ':hover': {
        color: 'white'
      }
    }
  }, core.jsx(TwitterIcon, null)), core.jsx("a", {
    href: "https://github.com/mjackson/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      ':hover': {
        color: 'white'
      },
      marginLeft: '1rem'
    }
  }, core.jsx(GitHubIcon, null))))));
}

if (process.env.NODE_ENV !== 'production') {
  var targetType = PropTypes.shape({
    path: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['directory', 'file']).isRequired,
    details: PropTypes.object.isRequired
  });
  App.propTypes = {
    packageName: PropTypes.string.isRequired,
    packageVersion: PropTypes.string.isRequired,
    availableVersions: PropTypes.arrayOf(PropTypes.string),
    filename: PropTypes.string.isRequired,
    target: targetType.isRequired
  };
}

/**
 * Encodes some data as JSON that may safely be included in HTML.
 */

function encodeJSONForScript(data) {
  return jsesc(data, {
    json: true,
    isScriptContext: true
  });
}

function createHTML$1(code) {
  return {
    __html: code
  };
}
function createScript(script) {
  return React.createElement('script', {
    dangerouslySetInnerHTML: createHTML$1(script)
  });
}

const promiseShim = 'window.Promise || document.write(\'\\x3Cscript src="/es6-promise@4.2.5/dist/es6-promise.min.js">\\x3C/script>\\x3Cscript>ES6Promise.polyfill()\\x3C/script>\')';
const fetchShim = 'window.fetch || document.write(\'\\x3Cscript src="/whatwg-fetch@3.0.0/dist/fetch.umd.js">\\x3C/script>\')';
function MainTemplate({
  title = 'UNPKG',
  description = 'The CDN for everything on npm',
  favicon = '/favicon.ico',
  data,
  content = createHTML$1(''),
  elements = []
}) {
  return React.createElement('html', {
    lang: 'en'
  }, React.createElement('head', null, // Global site tag (gtag.js) - Google Analytics
  React.createElement('script', {
    async: true,
    src: 'https://www.googletagmanager.com/gtag/js?id=UA-140352188-1'
  }), createScript(`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'UA-140352188-1');`), React.createElement('meta', {
    charSet: 'utf-8'
  }), React.createElement('meta', {
    httpEquiv: 'X-UA-Compatible',
    content: 'IE=edge,chrome=1'
  }), description && React.createElement('meta', {
    name: 'description',
    content: description
  }), React.createElement('meta', {
    name: 'viewport',
    content: 'width=device-width,initial-scale=1,maximum-scale=1'
  }), React.createElement('meta', {
    name: 'timestamp',
    content: new Date().toISOString()
  }), favicon && React.createElement('link', {
    rel: 'shortcut icon',
    href: favicon
  }), React.createElement('title', null, title), createScript(promiseShim), createScript(fetchShim), data && createScript(`window.__DATA__ = ${encodeJSONForScript(data)}`)), React.createElement('body', null, React.createElement('div', {
    id: 'root',
    dangerouslySetInnerHTML: content
  }), ...elements));
}

if (process.env.NODE_ENV !== 'production') {
  const htmlType = PropTypes.shape({
    __html: PropTypes.string
  });
  MainTemplate.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    favicon: PropTypes.string,
    data: PropTypes.any,
    content: htmlType,
    elements: PropTypes.arrayOf(PropTypes.node)
  };
}

var entryManifest = [{"browse":[{"format":"iife","globalImports":["react","react-dom","@emotion/core"],"url":"/_client/browse-c8f283be.js","code":"(function (React, ReactDOM, core) {\n  'use strict';\n\n  var React__default = 'default' in React ? React['default'] : React;\n  ReactDOM = ReactDOM && ReactDOM.hasOwnProperty('default') ? ReactDOM['default'] : ReactDOM;\n\n  function Object.assign() {\n    _extends = Object.assign || function (target) {\n      for (var i = 1; i < arguments.length; i++) {\n        var source = arguments[i];\n\n        for (var key in source) {\n          if (Object.prototype.hasOwnProperty.call(source, key)) {\n            target[key] = source[key];\n          }\n        }\n      }\n\n      return target;\n    };\n\n    return _extends.apply(this, arguments);\n  }\n\n  function _objectWithoutPropertiesLoose(source, excluded) {\n    if (source == null) return {};\n    var target = {};\n    var sourceKeys = Object.keys(source);\n    var key, i;\n\n    for (i = 0; i < sourceKeys.length; i++) {\n      key = sourceKeys[i];\n      if (excluded.indexOf(key) >= 0) continue;\n      target[key] = source[key];\n    }\n\n    return target;\n  }\n\n  function _taggedTemplateLiteralLoose(strings, raw) {\n    if (!raw) {\n      raw = strings.slice(0);\n    }\n\n    strings.raw = raw;\n    return strings;\n  }\n\n  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};\n\n  function unwrapExports (x) {\n  \treturn x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;\n  }\n\n  function createCommonjsModule(fn, module) {\n  \treturn module = { exports: {} }, fn(module, module.exports), module.exports;\n  }\n\n  var reactIs_production_min = createCommonjsModule(function (module, exports) {\n  Object.defineProperty(exports,\"__esModule\",{value:!0});\n  var b=\"function\"===typeof Symbol&&Symbol.for,c=b?Symbol.for(\"react.element\"):60103,d=b?Symbol.for(\"react.portal\"):60106,e=b?Symbol.for(\"react.fragment\"):60107,f=b?Symbol.for(\"react.strict_mode\"):60108,g=b?Symbol.for(\"react.profiler\"):60114,h=b?Symbol.for(\"react.provider\"):60109,k=b?Symbol.for(\"react.context\"):60110,l=b?Symbol.for(\"react.async_mode\"):60111,m=b?Symbol.for(\"react.concurrent_mode\"):60111,n=b?Symbol.for(\"react.forward_ref\"):60112,p=b?Symbol.for(\"react.suspense\"):60113,q=b?Symbol.for(\"react.memo\"):\n  60115,r=b?Symbol.for(\"react.lazy\"):60116;function t(a){if(\"object\"===typeof a&&null!==a){var u=a.$$typeof;switch(u){case c:switch(a=a.type,a){case l:case m:case e:case g:case f:case p:return a;default:switch(a=a&&a.$$typeof,a){case k:case n:case h:return a;default:return u}}case r:case q:case d:return u}}}function v(a){return t(a)===m}exports.typeOf=t;exports.AsyncMode=l;exports.ConcurrentMode=m;exports.ContextConsumer=k;exports.ContextProvider=h;exports.Element=c;exports.ForwardRef=n;\n  exports.Fragment=e;exports.Lazy=r;exports.Memo=q;exports.Portal=d;exports.Profiler=g;exports.StrictMode=f;exports.Suspense=p;exports.isValidElementType=function(a){return \"string\"===typeof a||\"function\"===typeof a||a===e||a===m||a===g||a===f||a===p||\"object\"===typeof a&&null!==a&&(a.$$typeof===r||a.$$typeof===q||a.$$typeof===h||a.$$typeof===k||a.$$typeof===n)};exports.isAsyncMode=function(a){return v(a)||t(a)===l};exports.isConcurrentMode=v;exports.isContextConsumer=function(a){return t(a)===k};\n  exports.isContextProvider=function(a){return t(a)===h};exports.isElement=function(a){return \"object\"===typeof a&&null!==a&&a.$$typeof===c};exports.isForwardRef=function(a){return t(a)===n};exports.isFragment=function(a){return t(a)===e};exports.isLazy=function(a){return t(a)===r};exports.isMemo=function(a){return t(a)===q};exports.isPortal=function(a){return t(a)===d};exports.isProfiler=function(a){return t(a)===g};exports.isStrictMode=function(a){return t(a)===f};\n  exports.isSuspense=function(a){return t(a)===p};\n  });\n\n  unwrapExports(reactIs_production_min);\n  var reactIs_production_min_1 = reactIs_production_min.typeOf;\n  var reactIs_production_min_2 = reactIs_production_min.AsyncMode;\n  var reactIs_production_min_3 = reactIs_production_min.ConcurrentMode;\n  var reactIs_production_min_4 = reactIs_production_min.ContextConsumer;\n  var reactIs_production_min_5 = reactIs_production_min.ContextProvider;\n  var reactIs_production_min_6 = reactIs_production_min.Element;\n  var reactIs_production_min_7 = reactIs_production_min.ForwardRef;\n  var reactIs_production_min_8 = reactIs_production_min.Fragment;\n  var reactIs_production_min_9 = reactIs_production_min.Lazy;\n  var reactIs_production_min_10 = reactIs_production_min.Memo;\n  var reactIs_production_min_11 = reactIs_production_min.Portal;\n  var reactIs_production_min_12 = reactIs_production_min.Profiler;\n  var reactIs_production_min_13 = reactIs_production_min.StrictMode;\n  var reactIs_production_min_14 = reactIs_production_min.Suspense;\n  var reactIs_production_min_15 = reactIs_production_min.isValidElementType;\n  var reactIs_production_min_16 = reactIs_production_min.isAsyncMode;\n  var reactIs_production_min_17 = reactIs_production_min.isConcurrentMode;\n  var reactIs_production_min_18 = reactIs_production_min.isContextConsumer;\n  var reactIs_production_min_19 = reactIs_production_min.isContextProvider;\n  var reactIs_production_min_20 = reactIs_production_min.isElement;\n  var reactIs_production_min_21 = reactIs_production_min.isForwardRef;\n  var reactIs_production_min_22 = reactIs_production_min.isFragment;\n  var reactIs_production_min_23 = reactIs_production_min.isLazy;\n  var reactIs_production_min_24 = reactIs_production_min.isMemo;\n  var reactIs_production_min_25 = reactIs_production_min.isPortal;\n  var reactIs_production_min_26 = reactIs_production_min.isProfiler;\n  var reactIs_production_min_27 = reactIs_production_min.isStrictMode;\n  var reactIs_production_min_28 = reactIs_production_min.isSuspense;\n\n  var reactIs_development = createCommonjsModule(function (module, exports) {\n\n\n\n  {\n    (function() {\n\n  Object.defineProperty(exports, '__esModule', { value: true });\n\n  // The Symbol used to tag the ReactElement-like types. If there is no native Symbol\n  // nor polyfill, then a plain number is used for performance.\n  var hasSymbol = typeof Symbol === 'function' && Symbol.for;\n\n  var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;\n  var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;\n  var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;\n  var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;\n  var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;\n  var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;\n  var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace;\n  var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;\n  var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;\n  var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;\n  var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;\n  var REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;\n  var REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;\n\n  function isValidElementType(type) {\n    return typeof type === 'string' || typeof type === 'function' ||\n    // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.\n    type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || typeof type === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE);\n  }\n\n  /**\n   * Forked from fbjs/warning:\n   * https://github.com/facebook/fbjs/blob/e66ba20ad5be433eb54423f2b097d829324d9de6/packages/fbjs/src/__forks__/warning.js\n   *\n   * Only change is we use console.warn instead of console.error,\n   * and do nothing when 'console' is not supported.\n   * This really simplifies the code.\n   * ---\n   * Similar to invariant but only logs a warning if the condition is not met.\n   * This can be used to log issues in development environments in critical\n   * paths. Removing the logging code for production environments will keep the\n   * same logic and follow the same code paths.\n   */\n\n  var lowPriorityWarning = function () {};\n\n  {\n    var printWarning = function (format) {\n      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {\n        args[_key - 1] = arguments[_key];\n      }\n\n      var argIndex = 0;\n      var message = 'Warning: ' + format.replace(/%s/g, function () {\n        return args[argIndex++];\n      });\n      if (typeof console !== 'undefined') {\n        console.warn(message);\n      }\n      try {\n        // --- Welcome to debugging React ---\n        // This error was thrown as a convenience so that you can use this stack\n        // to find the callsite that caused this warning to fire.\n        throw new Error(message);\n      } catch (x) {}\n    };\n\n    lowPriorityWarning = function (condition, format) {\n      if (format === undefined) {\n        throw new Error('`lowPriorityWarning(condition, format, ...args)` requires a warning ' + 'message argument');\n      }\n      if (!condition) {\n        for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {\n          args[_key2 - 2] = arguments[_key2];\n        }\n\n        printWarning.apply(undefined, [format].concat(args));\n      }\n    };\n  }\n\n  var lowPriorityWarning$1 = lowPriorityWarning;\n\n  function typeOf(object) {\n    if (typeof object === 'object' && object !== null) {\n      var $$typeof = object.$$typeof;\n      switch ($$typeof) {\n        case REACT_ELEMENT_TYPE:\n          var type = object.type;\n\n          switch (type) {\n            case REACT_ASYNC_MODE_TYPE:\n            case REACT_CONCURRENT_MODE_TYPE:\n            case REACT_FRAGMENT_TYPE:\n            case REACT_PROFILER_TYPE:\n            case REACT_STRICT_MODE_TYPE:\n            case REACT_SUSPENSE_TYPE:\n              return type;\n            default:\n              var $$typeofType = type && type.$$typeof;\n\n              switch ($$typeofType) {\n                case REACT_CONTEXT_TYPE:\n                case REACT_FORWARD_REF_TYPE:\n                case REACT_PROVIDER_TYPE:\n                  return $$typeofType;\n                default:\n                  return $$typeof;\n              }\n          }\n        case REACT_LAZY_TYPE:\n        case REACT_MEMO_TYPE:\n        case REACT_PORTAL_TYPE:\n          return $$typeof;\n      }\n    }\n\n    return undefined;\n  }\n\n  // AsyncMode is deprecated along with isAsyncMode\n  var AsyncMode = REACT_ASYNC_MODE_TYPE;\n  var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;\n  var ContextConsumer = REACT_CONTEXT_TYPE;\n  var ContextProvider = REACT_PROVIDER_TYPE;\n  var Element = REACT_ELEMENT_TYPE;\n  var ForwardRef = REACT_FORWARD_REF_TYPE;\n  var Fragment = REACT_FRAGMENT_TYPE;\n  var Lazy = REACT_LAZY_TYPE;\n  var Memo = REACT_MEMO_TYPE;\n  var Portal = REACT_PORTAL_TYPE;\n  var Profiler = REACT_PROFILER_TYPE;\n  var StrictMode = REACT_STRICT_MODE_TYPE;\n  var Suspense = REACT_SUSPENSE_TYPE;\n\n  var hasWarnedAboutDeprecatedIsAsyncMode = false;\n\n  // AsyncMode should be deprecated\n  function isAsyncMode(object) {\n    {\n      if (!hasWarnedAboutDeprecatedIsAsyncMode) {\n        hasWarnedAboutDeprecatedIsAsyncMode = true;\n        lowPriorityWarning$1(false, 'The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');\n      }\n    }\n    return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;\n  }\n  function isConcurrentMode(object) {\n    return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;\n  }\n  function isContextConsumer(object) {\n    return typeOf(object) === REACT_CONTEXT_TYPE;\n  }\n  function isContextProvider(object) {\n    return typeOf(object) === REACT_PROVIDER_TYPE;\n  }\n  function isElement(object) {\n    return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;\n  }\n  function isForwardRef(object) {\n    return typeOf(object) === REACT_FORWARD_REF_TYPE;\n  }\n  function isFragment(object) {\n    return typeOf(object) === REACT_FRAGMENT_TYPE;\n  }\n  function isLazy(object) {\n    return typeOf(object) === REACT_LAZY_TYPE;\n  }\n  function isMemo(object) {\n    return typeOf(object) === REACT_MEMO_TYPE;\n  }\n  function isPortal(object) {\n    return typeOf(object) === REACT_PORTAL_TYPE;\n  }\n  function isProfiler(object) {\n    return typeOf(object) === REACT_PROFILER_TYPE;\n  }\n  function isStrictMode(object) {\n    return typeOf(object) === REACT_STRICT_MODE_TYPE;\n  }\n  function isSuspense(object) {\n    return typeOf(object) === REACT_SUSPENSE_TYPE;\n  }\n\n  exports.typeOf = typeOf;\n  exports.AsyncMode = AsyncMode;\n  exports.ConcurrentMode = ConcurrentMode;\n  exports.ContextConsumer = ContextConsumer;\n  exports.ContextProvider = ContextProvider;\n  exports.Element = Element;\n  exports.ForwardRef = ForwardRef;\n  exports.Fragment = Fragment;\n  exports.Lazy = Lazy;\n  exports.Memo = Memo;\n  exports.Portal = Portal;\n  exports.Profiler = Profiler;\n  exports.StrictMode = StrictMode;\n  exports.Suspense = Suspense;\n  exports.isValidElementType = isValidElementType;\n  exports.isAsyncMode = isAsyncMode;\n  exports.isConcurrentMode = isConcurrentMode;\n  exports.isContextConsumer = isContextConsumer;\n  exports.isContextProvider = isContextProvider;\n  exports.isElement = isElement;\n  exports.isForwardRef = isForwardRef;\n  exports.isFragment = isFragment;\n  exports.isLazy = isLazy;\n  exports.isMemo = isMemo;\n  exports.isPortal = isPortal;\n  exports.isProfiler = isProfiler;\n  exports.isStrictMode = isStrictMode;\n  exports.isSuspense = isSuspense;\n    })();\n  }\n  });\n\n  unwrapExports(reactIs_development);\n  var reactIs_development_1 = reactIs_development.typeOf;\n  var reactIs_development_2 = reactIs_development.AsyncMode;\n  var reactIs_development_3 = reactIs_development.ConcurrentMode;\n  var reactIs_development_4 = reactIs_development.ContextConsumer;\n  var reactIs_development_5 = reactIs_development.ContextProvider;\n  var reactIs_development_6 = reactIs_development.Element;\n  var reactIs_development_7 = reactIs_development.ForwardRef;\n  var reactIs_development_8 = reactIs_development.Fragment;\n  var reactIs_development_9 = reactIs_development.Lazy;\n  var reactIs_development_10 = reactIs_development.Memo;\n  var reactIs_development_11 = reactIs_development.Portal;\n  var reactIs_development_12 = reactIs_development.Profiler;\n  var reactIs_development_13 = reactIs_development.StrictMode;\n  var reactIs_development_14 = reactIs_development.Suspense;\n  var reactIs_development_15 = reactIs_development.isValidElementType;\n  var reactIs_development_16 = reactIs_development.isAsyncMode;\n  var reactIs_development_17 = reactIs_development.isConcurrentMode;\n  var reactIs_development_18 = reactIs_development.isContextConsumer;\n  var reactIs_development_19 = reactIs_development.isContextProvider;\n  var reactIs_development_20 = reactIs_development.isElement;\n  var reactIs_development_21 = reactIs_development.isForwardRef;\n  var reactIs_development_22 = reactIs_development.isFragment;\n  var reactIs_development_23 = reactIs_development.isLazy;\n  var reactIs_development_24 = reactIs_development.isMemo;\n  var reactIs_development_25 = reactIs_development.isPortal;\n  var reactIs_development_26 = reactIs_development.isProfiler;\n  var reactIs_development_27 = reactIs_development.isStrictMode;\n  var reactIs_development_28 = reactIs_development.isSuspense;\n\n  var reactIs = createCommonjsModule(function (module) {\n\n  {\n    module.exports = reactIs_development;\n  }\n  });\n\n  /*\n  object-assign\n  (c) Sindre Sorhus\n  @license MIT\n  */\n  /* eslint-disable no-unused-vars */\n  var getOwnPropertySymbols = Object.getOwnPropertySymbols;\n  var hasOwnProperty = Object.prototype.hasOwnProperty;\n  var propIsEnumerable = Object.prototype.propertyIsEnumerable;\n\n  function toObject(val) {\n  \tif (val === null || val === undefined) {\n  \t\tthrow new TypeError('Object.assign cannot be called with null or undefined');\n  \t}\n\n  \treturn Object(val);\n  }\n\n  function shouldUseNative() {\n  \ttry {\n  \t\tif (!Object.assign) {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\t// Detect buggy property enumeration order in older V8 versions.\n\n  \t\t// https://bugs.chromium.org/p/v8/issues/detail?id=4118\n  \t\tvar test1 = new String('abc');  // eslint-disable-line no-new-wrappers\n  \t\ttest1[5] = 'de';\n  \t\tif (Object.getOwnPropertyNames(test1)[0] === '5') {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\t// https://bugs.chromium.org/p/v8/issues/detail?id=3056\n  \t\tvar test2 = {};\n  \t\tfor (var i = 0; i < 10; i++) {\n  \t\t\ttest2['_' + String.fromCharCode(i)] = i;\n  \t\t}\n  \t\tvar order2 = Object.getOwnPropertyNames(test2).map(function (n) {\n  \t\t\treturn test2[n];\n  \t\t});\n  \t\tif (order2.join('') !== '0123456789') {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\t// https://bugs.chromium.org/p/v8/issues/detail?id=3056\n  \t\tvar test3 = {};\n  \t\t'abcdefghijklmnopqrst'.split('').forEach(function (letter) {\n  \t\t\ttest3[letter] = letter;\n  \t\t});\n  \t\tif (Object.keys(Object.assign({}, test3)).join('') !==\n  \t\t\t\t'abcdefghijklmnopqrst') {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\treturn true;\n  \t} catch (err) {\n  \t\t// We don't expect any of the above to throw, but better to be safe.\n  \t\treturn false;\n  \t}\n  }\n\n  var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {\n  \tvar from;\n  \tvar to = toObject(target);\n  \tvar symbols;\n\n  \tfor (var s = 1; s < arguments.length; s++) {\n  \t\tfrom = Object(arguments[s]);\n\n  \t\tfor (var key in from) {\n  \t\t\tif (hasOwnProperty.call(from, key)) {\n  \t\t\t\tto[key] = from[key];\n  \t\t\t}\n  \t\t}\n\n  \t\tif (getOwnPropertySymbols) {\n  \t\t\tsymbols = getOwnPropertySymbols(from);\n  \t\t\tfor (var i = 0; i < symbols.length; i++) {\n  \t\t\t\tif (propIsEnumerable.call(from, symbols[i])) {\n  \t\t\t\t\tto[symbols[i]] = from[symbols[i]];\n  \t\t\t\t}\n  \t\t\t}\n  \t\t}\n  \t}\n\n  \treturn to;\n  };\n\n  /**\n   * Copyright (c) 2013-present, Facebook, Inc.\n   *\n   * This source code is licensed under the MIT license found in the\n   * LICENSE file in the root directory of this source tree.\n   */\n\n  var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';\n\n  var ReactPropTypesSecret_1 = ReactPropTypesSecret;\n\n  var printWarning = function() {};\n\n  {\n    var ReactPropTypesSecret$1 = ReactPropTypesSecret_1;\n    var loggedTypeFailures = {};\n    var has = Function.call.bind(Object.prototype.hasOwnProperty);\n\n    printWarning = function(text) {\n      var message = 'Warning: ' + text;\n      if (typeof console !== 'undefined') {\n        console.error(message);\n      }\n      try {\n        // --- Welcome to debugging React ---\n        // This error was thrown as a convenience so that you can use this stack\n        // to find the callsite that caused this warning to fire.\n        throw new Error(message);\n      } catch (x) {}\n    };\n  }\n\n  /**\n   * Assert that the values match with the type specs.\n   * Error messages are memorized and will only be shown once.\n   *\n   * @param {object} typeSpecs Map of name to a ReactPropType\n   * @param {object} values Runtime values that need to be type-checked\n   * @param {string} location e.g. \"prop\", \"context\", \"child context\"\n   * @param {string} componentName Name of the component for error messages.\n   * @param {?Function} getStack Returns the component stack.\n   * @private\n   */\n  function checkPropTypes(typeSpecs, values, location, componentName, getStack) {\n    {\n      for (var typeSpecName in typeSpecs) {\n        if (has(typeSpecs, typeSpecName)) {\n          var error;\n          // Prop type validation may throw. In case they do, we don't want to\n          // fail the render phase where it didn't fail before. So we log it.\n          // After these have been cleaned up, we'll let them throw.\n          try {\n            // This is intentionally an invariant that gets caught. It's the same\n            // behavior as without this statement except with a better message.\n            if (typeof typeSpecs[typeSpecName] !== 'function') {\n              var err = Error(\n                (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +\n                'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.'\n              );\n              err.name = 'Invariant Violation';\n              throw err;\n            }\n            error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret$1);\n          } catch (ex) {\n            error = ex;\n          }\n          if (error && !(error instanceof Error)) {\n            printWarning(\n              (componentName || 'React class') + ': type specification of ' +\n              location + ' `' + typeSpecName + '` is invalid; the type checker ' +\n              'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +\n              'You may have forgotten to pass an argument to the type checker ' +\n              'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +\n              'shape all require an argument).'\n            );\n          }\n          if (error instanceof Error && !(error.message in loggedTypeFailures)) {\n            // Only monitor this failure once because there tends to be a lot of the\n            // same error.\n            loggedTypeFailures[error.message] = true;\n\n            var stack = getStack ? getStack() : '';\n\n            printWarning(\n              'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')\n            );\n          }\n        }\n      }\n    }\n  }\n\n  /**\n   * Resets warning cache when testing.\n   *\n   * @private\n   */\n  checkPropTypes.resetWarningCache = function() {\n    {\n      loggedTypeFailures = {};\n    }\n  };\n\n  var checkPropTypes_1 = checkPropTypes;\n\n  var has$1 = Function.call.bind(Object.prototype.hasOwnProperty);\n  var printWarning$1 = function() {};\n\n  {\n    printWarning$1 = function(text) {\n      var message = 'Warning: ' + text;\n      if (typeof console !== 'undefined') {\n        console.error(message);\n      }\n      try {\n        // --- Welcome to debugging React ---\n        // This error was thrown as a convenience so that you can use this stack\n        // to find the callsite that caused this warning to fire.\n        throw new Error(message);\n      } catch (x) {}\n    };\n  }\n\n  function emptyFunctionThatReturnsNull() {\n    return null;\n  }\n\n  var factoryWithTypeCheckers = function(isValidElement, throwOnDirectAccess) {\n    /* global Symbol */\n    var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;\n    var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.\n\n    /**\n     * Returns the iterator method function contained on the iterable object.\n     *\n     * Be sure to invoke the function with the iterable as context:\n     *\n     *     var iteratorFn = getIteratorFn(myIterable);\n     *     if (iteratorFn) {\n     *       var iterator = iteratorFn.call(myIterable);\n     *       ...\n     *     }\n     *\n     * @param {?object} maybeIterable\n     * @return {?function}\n     */\n    function getIteratorFn(maybeIterable) {\n      var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);\n      if (typeof iteratorFn === 'function') {\n        return iteratorFn;\n      }\n    }\n\n    /**\n     * Collection of methods that allow declaration and validation of props that are\n     * supplied to React components. Example usage:\n     *\n     *   var Props = require('ReactPropTypes');\n     *   var MyArticle = React.createClass({\n     *     propTypes: {\n     *       // An optional string prop named \"description\".\n     *       description: Props.string,\n     *\n     *       // A required enum prop named \"category\".\n     *       category: Props.oneOf(['News','Photos']).isRequired,\n     *\n     *       // A prop named \"dialog\" that requires an instance of Dialog.\n     *       dialog: Props.instanceOf(Dialog).isRequired\n     *     },\n     *     render: function() { ... }\n     *   });\n     *\n     * A more formal specification of how these methods are used:\n     *\n     *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)\n     *   decl := ReactPropTypes.{type}(.isRequired)?\n     *\n     * Each and every declaration produces a function with the same signature. This\n     * allows the creation of custom validation functions. For example:\n     *\n     *  var MyLink = React.createClass({\n     *    propTypes: {\n     *      // An optional string or URI prop named \"href\".\n     *      href: function(props, propName, componentName) {\n     *        var propValue = props[propName];\n     *        if (propValue != null && typeof propValue !== 'string' &&\n     *            !(propValue instanceof URI)) {\n     *          return new Error(\n     *            'Expected a string or an URI for ' + propName + ' in ' +\n     *            componentName\n     *          );\n     *        }\n     *      }\n     *    },\n     *    render: function() {...}\n     *  });\n     *\n     * @internal\n     */\n\n    var ANONYMOUS = '<<anonymous>>';\n\n    // Important!\n    // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.\n    var ReactPropTypes = {\n      array: createPrimitiveTypeChecker('array'),\n      bool: createPrimitiveTypeChecker('boolean'),\n      func: createPrimitiveTypeChecker('function'),\n      number: createPrimitiveTypeChecker('number'),\n      object: createPrimitiveTypeChecker('object'),\n      string: createPrimitiveTypeChecker('string'),\n      symbol: createPrimitiveTypeChecker('symbol'),\n\n      any: createAnyTypeChecker(),\n      arrayOf: createArrayOfTypeChecker,\n      element: createElementTypeChecker(),\n      elementType: createElementTypeTypeChecker(),\n      instanceOf: createInstanceTypeChecker,\n      node: createNodeChecker(),\n      objectOf: createObjectOfTypeChecker,\n      oneOf: createEnumTypeChecker,\n      oneOfType: createUnionTypeChecker,\n      shape: createShapeTypeChecker,\n      exact: createStrictShapeTypeChecker,\n    };\n\n    /**\n     * inlined Object.is polyfill to avoid requiring consumers ship their own\n     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is\n     */\n    /*eslint-disable no-self-compare*/\n    function is(x, y) {\n      // SameValue algorithm\n      if (x === y) {\n        // Steps 1-5, 7-10\n        // Steps 6.b-6.e: +0 != -0\n        return x !== 0 || 1 / x === 1 / y;\n      } else {\n        // Step 6.a: NaN == NaN\n        return x !== x && y !== y;\n      }\n    }\n    /*eslint-enable no-self-compare*/\n\n    /**\n     * We use an Error-like object for backward compatibility as people may call\n     * PropTypes directly and inspect their output. However, we don't use real\n     * Errors anymore. We don't inspect their stack anyway, and creating them\n     * is prohibitively expensive if they are created too often, such as what\n     * happens in oneOfType() for any type before the one that matched.\n     */\n    function PropTypeError(message) {\n      this.message = message;\n      this.stack = '';\n    }\n    // Make `instanceof Error` still work for returned errors.\n    PropTypeError.prototype = Error.prototype;\n\n    function createChainableTypeChecker(validate) {\n      {\n        var manualPropTypeCallCache = {};\n        var manualPropTypeWarningCount = 0;\n      }\n      function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {\n        componentName = componentName || ANONYMOUS;\n        propFullName = propFullName || propName;\n\n        if (secret !== ReactPropTypesSecret_1) {\n          if (throwOnDirectAccess) {\n            // New behavior only for users of `prop-types` package\n            var err = new Error(\n              'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +\n              'Use `PropTypes.checkPropTypes()` to call them. ' +\n              'Read more at http://fb.me/use-check-prop-types'\n            );\n            err.name = 'Invariant Violation';\n            throw err;\n          } else if (typeof console !== 'undefined') {\n            // Old behavior for people using React.PropTypes\n            var cacheKey = componentName + ':' + propName;\n            if (\n              !manualPropTypeCallCache[cacheKey] &&\n              // Avoid spamming the console because they are often not actionable except for lib authors\n              manualPropTypeWarningCount < 3\n            ) {\n              printWarning$1(\n                'You are manually calling a React.PropTypes validation ' +\n                'function for the `' + propFullName + '` prop on `' + componentName  + '`. This is deprecated ' +\n                'and will throw in the standalone `prop-types` package. ' +\n                'You may be seeing this warning due to a third-party PropTypes ' +\n                'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.'\n              );\n              manualPropTypeCallCache[cacheKey] = true;\n              manualPropTypeWarningCount++;\n            }\n          }\n        }\n        if (props[propName] == null) {\n          if (isRequired) {\n            if (props[propName] === null) {\n              return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));\n            }\n            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));\n          }\n          return null;\n        } else {\n          return validate(props, propName, componentName, location, propFullName);\n        }\n      }\n\n      var chainedCheckType = checkType.bind(null, false);\n      chainedCheckType.isRequired = checkType.bind(null, true);\n\n      return chainedCheckType;\n    }\n\n    function createPrimitiveTypeChecker(expectedType) {\n      function validate(props, propName, componentName, location, propFullName, secret) {\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== expectedType) {\n          // `propValue` being instance of, say, date/regexp, pass the 'object'\n          // check, but we can offer a more precise error message here rather than\n          // 'of type `object`'.\n          var preciseType = getPreciseType(propValue);\n\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createAnyTypeChecker() {\n      return createChainableTypeChecker(emptyFunctionThatReturnsNull);\n    }\n\n    function createArrayOfTypeChecker(typeChecker) {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (typeof typeChecker !== 'function') {\n          return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');\n        }\n        var propValue = props[propName];\n        if (!Array.isArray(propValue)) {\n          var propType = getPropType(propValue);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));\n        }\n        for (var i = 0; i < propValue.length; i++) {\n          var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret_1);\n          if (error instanceof Error) {\n            return error;\n          }\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createElementTypeChecker() {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        if (!isValidElement(propValue)) {\n          var propType = getPropType(propValue);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createElementTypeTypeChecker() {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        if (!reactIs.isValidElementType(propValue)) {\n          var propType = getPropType(propValue);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement type.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createInstanceTypeChecker(expectedClass) {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (!(props[propName] instanceof expectedClass)) {\n          var expectedClassName = expectedClass.name || ANONYMOUS;\n          var actualClassName = getClassName(props[propName]);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createEnumTypeChecker(expectedValues) {\n      if (!Array.isArray(expectedValues)) {\n        {\n          if (arguments.length > 1) {\n            printWarning$1(\n              'Invalid arguments supplied to oneOf, expected an array, got ' + arguments.length + ' arguments. ' +\n              'A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).'\n            );\n          } else {\n            printWarning$1('Invalid argument supplied to oneOf, expected an array.');\n          }\n        }\n        return emptyFunctionThatReturnsNull;\n      }\n\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        for (var i = 0; i < expectedValues.length; i++) {\n          if (is(propValue, expectedValues[i])) {\n            return null;\n          }\n        }\n\n        var valuesString = JSON.stringify(expectedValues, function replacer(key, value) {\n          var type = getPreciseType(value);\n          if (type === 'symbol') {\n            return String(value);\n          }\n          return value;\n        });\n        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + String(propValue) + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createObjectOfTypeChecker(typeChecker) {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (typeof typeChecker !== 'function') {\n          return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');\n        }\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== 'object') {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));\n        }\n        for (var key in propValue) {\n          if (has$1(propValue, key)) {\n            var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);\n            if (error instanceof Error) {\n              return error;\n            }\n          }\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createUnionTypeChecker(arrayOfTypeCheckers) {\n      if (!Array.isArray(arrayOfTypeCheckers)) {\n        printWarning$1('Invalid argument supplied to oneOfType, expected an instance of array.');\n        return emptyFunctionThatReturnsNull;\n      }\n\n      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {\n        var checker = arrayOfTypeCheckers[i];\n        if (typeof checker !== 'function') {\n          printWarning$1(\n            'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +\n            'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'\n          );\n          return emptyFunctionThatReturnsNull;\n        }\n      }\n\n      function validate(props, propName, componentName, location, propFullName) {\n        for (var i = 0; i < arrayOfTypeCheckers.length; i++) {\n          var checker = arrayOfTypeCheckers[i];\n          if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret_1) == null) {\n            return null;\n          }\n        }\n\n        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createNodeChecker() {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (!isNode(props[propName])) {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createShapeTypeChecker(shapeTypes) {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== 'object') {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));\n        }\n        for (var key in shapeTypes) {\n          var checker = shapeTypes[key];\n          if (!checker) {\n            continue;\n          }\n          var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);\n          if (error) {\n            return error;\n          }\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createStrictShapeTypeChecker(shapeTypes) {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== 'object') {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));\n        }\n        // We need to check all keys in case some are required but missing from\n        // props.\n        var allKeys = objectAssign({}, props[propName], shapeTypes);\n        for (var key in allKeys) {\n          var checker = shapeTypes[key];\n          if (!checker) {\n            return new PropTypeError(\n              'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +\n              '\\nBad object: ' + JSON.stringify(props[propName], null, '  ') +\n              '\\nValid keys: ' +  JSON.stringify(Object.keys(shapeTypes), null, '  ')\n            );\n          }\n          var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);\n          if (error) {\n            return error;\n          }\n        }\n        return null;\n      }\n\n      return createChainableTypeChecker(validate);\n    }\n\n    function isNode(propValue) {\n      switch (typeof propValue) {\n        case 'number':\n        case 'string':\n        case 'undefined':\n          return true;\n        case 'boolean':\n          return !propValue;\n        case 'object':\n          if (Array.isArray(propValue)) {\n            return propValue.every(isNode);\n          }\n          if (propValue === null || isValidElement(propValue)) {\n            return true;\n          }\n\n          var iteratorFn = getIteratorFn(propValue);\n          if (iteratorFn) {\n            var iterator = iteratorFn.call(propValue);\n            var step;\n            if (iteratorFn !== propValue.entries) {\n              while (!(step = iterator.next()).done) {\n                if (!isNode(step.value)) {\n                  return false;\n                }\n              }\n            } else {\n              // Iterator will provide entry [k,v] tuples rather than values.\n              while (!(step = iterator.next()).done) {\n                var entry = step.value;\n                if (entry) {\n                  if (!isNode(entry[1])) {\n                    return false;\n                  }\n                }\n              }\n            }\n          } else {\n            return false;\n          }\n\n          return true;\n        default:\n          return false;\n      }\n    }\n\n    function isSymbol(propType, propValue) {\n      // Native Symbol.\n      if (propType === 'symbol') {\n        return true;\n      }\n\n      // falsy value can't be a Symbol\n      if (!propValue) {\n        return false;\n      }\n\n      // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'\n      if (propValue['@@toStringTag'] === 'Symbol') {\n        return true;\n      }\n\n      // Fallback for non-spec compliant Symbols which are polyfilled.\n      if (typeof Symbol === 'function' && propValue instanceof Symbol) {\n        return true;\n      }\n\n      return false;\n    }\n\n    // Equivalent of `typeof` but with special handling for array and regexp.\n    function getPropType(propValue) {\n      var propType = typeof propValue;\n      if (Array.isArray(propValue)) {\n        return 'array';\n      }\n      if (propValue instanceof RegExp) {\n        // Old webkits (at least until Android 4.0) return 'function' rather than\n        // 'object' for typeof a RegExp. We'll normalize this here so that /bla/\n        // passes PropTypes.object.\n        return 'object';\n      }\n      if (isSymbol(propType, propValue)) {\n        return 'symbol';\n      }\n      return propType;\n    }\n\n    // This handles more types than `getPropType`. Only used for error messages.\n    // See `createPrimitiveTypeChecker`.\n    function getPreciseType(propValue) {\n      if (typeof propValue === 'undefined' || propValue === null) {\n        return '' + propValue;\n      }\n      var propType = getPropType(propValue);\n      if (propType === 'object') {\n        if (propValue instanceof Date) {\n          return 'date';\n        } else if (propValue instanceof RegExp) {\n          return 'regexp';\n        }\n      }\n      return propType;\n    }\n\n    // Returns a string that is postfixed to a warning about an invalid type.\n    // For example, \"undefined\" or \"of type array\"\n    function getPostfixForTypeWarning(value) {\n      var type = getPreciseType(value);\n      switch (type) {\n        case 'array':\n        case 'object':\n          return 'an ' + type;\n        case 'boolean':\n        case 'date':\n        case 'regexp':\n          return 'a ' + type;\n        default:\n          return type;\n      }\n    }\n\n    // Returns class name of the object, if any.\n    function getClassName(propValue) {\n      if (!propValue.constructor || !propValue.constructor.name) {\n        return ANONYMOUS;\n      }\n      return propValue.constructor.name;\n    }\n\n    ReactPropTypes.checkPropTypes = checkPropTypes_1;\n    ReactPropTypes.resetWarningCache = checkPropTypes_1.resetWarningCache;\n    ReactPropTypes.PropTypes = ReactPropTypes;\n\n    return ReactPropTypes;\n  };\n\n  var propTypes = createCommonjsModule(function (module) {\n  /**\n   * Copyright (c) 2013-present, Facebook, Inc.\n   *\n   * This source code is licensed under the MIT license found in the\n   * LICENSE file in the root directory of this source tree.\n   */\n\n  {\n    var ReactIs = reactIs;\n\n    // By explicitly using `prop-types` you are opting into new development behavior.\n    // http://fb.me/prop-types-in-prod\n    var throwOnDirectAccess = true;\n    module.exports = factoryWithTypeCheckers(ReactIs.isElement, throwOnDirectAccess);\n  }\n  });\n\n  var fontSans = \"\\nfont-family: -apple-system,\\n  BlinkMacSystemFont,\\n  \\\"Segoe UI\\\",\\n  \\\"Roboto\\\",\\n  \\\"Oxygen\\\",\\n  \\\"Ubuntu\\\",\\n  \\\"Cantarell\\\",\\n  \\\"Fira Sans\\\",\\n  \\\"Droid Sans\\\",\\n  \\\"Helvetica Neue\\\",\\n  sans-serif;\\n\";\n  var fontMono = \"\\nfont-family: Menlo,\\n  Monaco,\\n  Lucida Console,\\n  Liberation Mono,\\n  DejaVu Sans Mono,\\n  Bitstream Vera Sans Mono,\\n  Courier New,\\n  monospace;\\n\";\n\n  var _extends$1 = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };\n\n  var style = {\n    border: 0,\n    clip: \"rect(0 0 0 0)\",\n    height: \"1px\",\n    width: \"1px\",\n    margin: \"-1px\",\n    padding: 0,\n    overflow: \"hidden\",\n    position: \"absolute\"\n  };\n\n  var VisuallyHidden = (function (props) {\n    return React__default.createElement(\"div\", _extends$1({ style: style }, props));\n  });\n\n  var objectPath = createCommonjsModule(function (module) {\n  (function (root, factory){\n\n    /*istanbul ignore next:cant test*/\n    {\n      module.exports = factory();\n    }\n  })(commonjsGlobal, function(){\n\n    var\n      toStr = Object.prototype.toString,\n      _hasOwnProperty = Object.prototype.hasOwnProperty;\n\n    function isEmpty(value){\n      if (!value) {\n        return true;\n      }\n      if (isArray(value) && value.length === 0) {\n        return true;\n      } else {\n        for (var i in value) {\n          if (_hasOwnProperty.call(value, i)) {\n            return false;\n          }\n        }\n        return true;\n      }\n    }\n\n    function toString(type){\n      return toStr.call(type);\n    }\n\n    function isNumber(value){\n      return typeof value === 'number' || toString(value) === \"[object Number]\";\n    }\n\n    function isString(obj){\n      return typeof obj === 'string' || toString(obj) === \"[object String]\";\n    }\n\n    function isObject(obj){\n      return typeof obj === 'object' && toString(obj) === \"[object Object]\";\n    }\n\n    function isArray(obj){\n      return typeof obj === 'object' && typeof obj.length === 'number' && toString(obj) === '[object Array]';\n    }\n\n    function isBoolean(obj){\n      return typeof obj === 'boolean' || toString(obj) === '[object Boolean]';\n    }\n\n    function getKey(key){\n      var intKey = parseInt(key);\n      if (intKey.toString() === key) {\n        return intKey;\n      }\n      return key;\n    }\n\n    function set(obj, path, value, doNotReplace){\n      if (isNumber(path)) {\n        path = [path];\n      }\n      if (isEmpty(path)) {\n        return obj;\n      }\n      if (isString(path)) {\n        return set(obj, path.split('.'), value, doNotReplace);\n      }\n      var currentPath = getKey(path[0]);\n\n      if (path.length === 1) {\n        var oldVal = obj[currentPath];\n        if (oldVal === void 0 || !doNotReplace) {\n          obj[currentPath] = value;\n        }\n        return oldVal;\n      }\n\n      if (obj[currentPath] === void 0) {\n        if (isNumber(currentPath)) {\n          obj[currentPath] = [];\n        } else {\n          obj[currentPath] = {};\n        }\n      }\n\n      return set(obj[currentPath], path.slice(1), value, doNotReplace);\n    }\n\n    function del(obj, path) {\n      if (isNumber(path)) {\n        path = [path];\n      }\n\n      if (isEmpty(obj)) {\n        return void 0;\n      }\n\n      if (isEmpty(path)) {\n        return obj;\n      }\n      if(isString(path)) {\n        return del(obj, path.split('.'));\n      }\n\n      var currentPath = getKey(path[0]);\n      var oldVal = obj[currentPath];\n\n      if(path.length === 1) {\n        if (oldVal !== void 0) {\n          if (isArray(obj)) {\n            obj.splice(currentPath, 1);\n          } else {\n            delete obj[currentPath];\n          }\n        }\n      } else {\n        if (obj[currentPath] !== void 0) {\n          return del(obj[currentPath], path.slice(1));\n        }\n      }\n\n      return obj;\n    }\n\n    var objectPath = {};\n\n    objectPath.ensureExists = function (obj, path, value){\n      return set(obj, path, value, true);\n    };\n\n    objectPath.set = function (obj, path, value, doNotReplace){\n      return set(obj, path, value, doNotReplace);\n    };\n\n    objectPath.insert = function (obj, path, value, at){\n      var arr = objectPath.get(obj, path);\n      at = ~~at;\n      if (!isArray(arr)) {\n        arr = [];\n        objectPath.set(obj, path, arr);\n      }\n      arr.splice(at, 0, value);\n    };\n\n    objectPath.empty = function(obj, path) {\n      if (isEmpty(path)) {\n        return obj;\n      }\n      if (isEmpty(obj)) {\n        return void 0;\n      }\n\n      var value, i;\n      if (!(value = objectPath.get(obj, path))) {\n        return obj;\n      }\n\n      if (isString(value)) {\n        return objectPath.set(obj, path, '');\n      } else if (isBoolean(value)) {\n        return objectPath.set(obj, path, false);\n      } else if (isNumber(value)) {\n        return objectPath.set(obj, path, 0);\n      } else if (isArray(value)) {\n        value.length = 0;\n      } else if (isObject(value)) {\n        for (i in value) {\n          if (_hasOwnProperty.call(value, i)) {\n            delete value[i];\n          }\n        }\n      } else {\n        return objectPath.set(obj, path, null);\n      }\n    };\n\n    objectPath.push = function (obj, path /*, values */){\n      var arr = objectPath.get(obj, path);\n      if (!isArray(arr)) {\n        arr = [];\n        objectPath.set(obj, path, arr);\n      }\n\n      arr.push.apply(arr, Array.prototype.slice.call(arguments, 2));\n    };\n\n    objectPath.coalesce = function (obj, paths, defaultValue) {\n      var value;\n\n      for (var i = 0, len = paths.length; i < len; i++) {\n        if ((value = objectPath.get(obj, paths[i])) !== void 0) {\n          return value;\n        }\n      }\n\n      return defaultValue;\n    };\n\n    objectPath.get = function (obj, path, defaultValue){\n      if (isNumber(path)) {\n        path = [path];\n      }\n      if (isEmpty(path)) {\n        return obj;\n      }\n      if (isEmpty(obj)) {\n        return defaultValue;\n      }\n      if (isString(path)) {\n        return objectPath.get(obj, path.split('.'), defaultValue);\n      }\n\n      var currentPath = getKey(path[0]);\n\n      if (path.length === 1) {\n        if (obj[currentPath] === void 0) {\n          return defaultValue;\n        }\n        return obj[currentPath];\n      }\n\n      return objectPath.get(obj[currentPath], path.slice(1), defaultValue);\n    };\n\n    objectPath.del = function(obj, path) {\n      return del(obj, path);\n    };\n\n    return objectPath;\n  });\n  });\n\n  var sortBy;\n  var sort;\n  var type;\n\n  /**\n   * Filters args based on their type\n   * @param  {String} type Type of property to filter by\n   * @return {Function}\n   */\n  type = function(type) {\n      return function(arg) {\n          return typeof arg === type;\n      };\n  };\n\n  /**\n   * Return a comparator function\n   * @param  {String} property The key to sort by\n   * @param  {Function} map Function to apply to each property\n   * @return {Function}        Returns the comparator function\n   */\n  sort = function sort(property, map) {\n      var sortOrder = 1;\n      var apply = map || function(_, value) { return value };\n\n      if (property[0] === \"-\") {\n          sortOrder = -1;\n          property = property.substr(1);\n      }\n\n      return function fn(a,b) {\n          var result;\n          var am = apply(property, objectPath.get(a, property));\n          var bm = apply(property, objectPath.get(b, property));\n          if (am < bm) result = -1;\n          if (am > bm) result = 1;\n          if (am === bm) result = 0;\n          return result * sortOrder;\n      }\n  };\n\n  /**\n   * Return a comparator function that sorts by multiple keys\n   * @return {Function} Returns the comparator function\n   */\n  sortBy = function sortBy() {\n\n      var args = Array.prototype.slice.call(arguments);\n      var properties = args.filter(type('string'));\n      var map = args.filter(type('function'))[0];\n\n      return function fn(obj1, obj2) {\n          var numberOfProperties = properties.length,\n              result = 0,\n              i = 0;\n\n          /* try getting a different result from 0 (equal)\n           * as long as we have extra properties to compare\n           */\n          while(result === 0 && i < numberOfProperties) {\n              result = sort(properties[i], map)(obj1, obj2);\n              i++;\n          }\n          return result;\n      };\n  };\n\n  /**\n   * Expose `sortBy`\n   * @type {Function}\n   */\n  var sortBy_1 = sortBy;\n\n  const UNITS = [\n  \t'B',\n  \t'kB',\n  \t'MB',\n  \t'GB',\n  \t'TB',\n  \t'PB',\n  \t'EB',\n  \t'ZB',\n  \t'YB'\n  ];\n\n  /*\n  Formats the given number using `Number#toLocaleString`.\n  - If locale is a string, the value is expected to be a locale-key (for example: `de`).\n  - If locale is true, the system default locale is used for translation.\n  - If no value for locale is specified, the number is returned unmodified.\n  */\n  const toLocaleString = (number, locale) => {\n  \tlet result = number;\n  \tif (typeof locale === 'string') {\n  \t\tresult = number.toLocaleString(locale);\n  \t} else if (locale === true) {\n  \t\tresult = number.toLocaleString();\n  \t}\n\n  \treturn result;\n  };\n\n  var prettyBytes = (number, options) => {\n  \tif (!Number.isFinite(number)) {\n  \t\tthrow new TypeError(`Expected a finite number, got ${typeof number}: ${number}`);\n  \t}\n\n  \toptions = Object.assign({}, options);\n\n  \tif (options.signed && number === 0) {\n  \t\treturn ' 0 B';\n  \t}\n\n  \tconst isNegative = number < 0;\n  \tconst prefix = isNegative ? '-' : (options.signed ? '+' : '');\n\n  \tif (isNegative) {\n  \t\tnumber = -number;\n  \t}\n\n  \tif (number < 1) {\n  \t\tconst numberString = toLocaleString(number, options.locale);\n  \t\treturn prefix + numberString + ' B';\n  \t}\n\n  \tconst exponent = Math.min(Math.floor(Math.log10(number) / 3), UNITS.length - 1);\n  \t// eslint-disable-next-line unicorn/prefer-exponentiation-operator\n  \tnumber = Number((number / Math.pow(1000, exponent)).toPrecision(3));\n  \tconst numberString = toLocaleString(number, options.locale);\n\n  \tconst unit = UNITS[exponent];\n\n  \treturn prefix + numberString + ' ' + unit;\n  };\n\n  var maxWidth = 700;\n  function ContentArea(_ref) {\n    var _extends2;\n\n    var children = _ref.children,\n        css = _ref.css;\n    return core.jsx(\"div\", {\n      css: Object.assign((_extends2 = {\n        border: '1px solid #dfe2e5',\n        borderRadius: 3\n      }, _extends2[\"@media (max-width: \" + maxWidth + \"px)\"] = {\n        borderRightWidth: 0,\n        borderLeftWidth: 0\n      }, _extends2), css)\n    }, children);\n  }\n  function ContentAreaHeaderBar(_ref2) {\n    var _extends3;\n\n    var children = _ref2.children,\n        css = _ref2.css;\n    return core.jsx(\"div\", {\n      css: Object.assign((_extends3 = {\n        padding: 10,\n        background: '#f6f8fa',\n        color: '#424242',\n        border: '1px solid #d1d5da',\n        borderTopLeftRadius: 3,\n        borderTopRightRadius: 3,\n        margin: '-1px -1px 0',\n        display: 'flex',\n        flexDirection: 'row',\n        alignItems: 'center',\n        justifyContent: 'space-between'\n      }, _extends3[\"@media (max-width: \" + maxWidth + \"px)\"] = {\n        paddingRight: 20,\n        paddingLeft: 20\n      }, _extends3), css)\n    }, children);\n  }\n\n  var DefaultContext = {\n    color: undefined,\n    size: undefined,\n    className: undefined,\n    style: undefined,\n    attr: undefined\n  };\n  var IconContext = React.createContext && React.createContext(DefaultContext);\n\n  var __assign = window && window.__assign || function () {\n    __assign = Object.assign || function (t) {\n      for (var s, i = 1, n = arguments.length; i < n; i++) {\n        s = arguments[i];\n\n        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];\n      }\n\n      return t;\n    };\n\n    return __assign.apply(this, arguments);\n  };\n\n  var __rest = window && window.__rest || function (s, e) {\n    var t = {};\n\n    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];\n\n    if (s != null && typeof Object.getOwnPropertySymbols === \"function\") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]];\n    return t;\n  };\n\n  function Tree2Element(tree) {\n    return tree && tree.map(function (node, i) {\n      return React.createElement(node.tag, Object.assign({\n        key: i\n      }, node.attr), Tree2Element(node.child));\n    });\n  }\n\n  function GenIcon(data) {\n    return function (props) {\n      return React.createElement(IconBase, Object.assign({\n        attr: Object.assign({}, data.attr)\n      }, props), Tree2Element(data.child));\n    };\n  }\n  function IconBase(props) {\n    var elem = function (conf) {\n      var computedSize = props.size || conf.size || \"1em\";\n      var className;\n      if (conf.className) className = conf.className;\n      if (props.className) className = (className ? className + ' ' : '') + props.className;\n\n      var attr = props.attr,\n          title = props.title,\n          svgProps = __rest(props, [\"attr\", \"title\"]);\n\n      return React.createElement(\"svg\", Object.assign({\n        stroke: \"currentColor\",\n        fill: \"currentColor\",\n        strokeWidth: \"0\"\n      }, conf.attr, attr, svgProps, {\n        className: className,\n        style: Object.assign({\n          color: props.color || conf.color\n        }, conf.style, props.style),\n        height: computedSize,\n        width: computedSize,\n        xmlns: \"http://www.w3.org/2000/svg\"\n      }), title && React.createElement(\"title\", null, title), props.children);\n    };\n\n    return IconContext !== undefined ? React.createElement(IconContext.Consumer, null, function (conf) {\n      return elem(conf);\n    }) : elem(DefaultContext);\n  }\n\n  // THIS FILE IS AUTO GENERATED\n  var GoFileCode = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 12 16\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"fillRule\":\"evenodd\",\"d\":\"M8.5 1H1c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4.5L8.5 1zM11 14H1V2h7l3 3v9zM5 6.98L3.5 8.5 5 10l-.5 1L2 8.5 4.5 6l.5.98zM7.5 6L10 8.5 7.5 11l-.5-.98L8.5 8.5 7 7l.5-1z\"}}]})(props);\n  };\n  GoFileCode.displayName = \"GoFileCode\";\n  var GoFileDirectory = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 14 16\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"fillRule\":\"evenodd\",\"d\":\"M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z\"}}]})(props);\n  };\n  GoFileDirectory.displayName = \"GoFileDirectory\";\n  var GoFile = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 12 16\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"fillRule\":\"evenodd\",\"d\":\"M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z\"}}]})(props);\n  };\n  GoFile.displayName = \"GoFile\";\n\n  // THIS FILE IS AUTO GENERATED\n  var FaGithub = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 496 512\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"d\":\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"}}]})(props);\n  };\n  FaGithub.displayName = \"FaGithub\";\n  var FaTwitter = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 512 512\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"d\":\"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z\"}}]})(props);\n  };\n  FaTwitter.displayName = \"FaTwitter\";\n\n  function createIcon(Type, _ref) {\n    var css = _ref.css,\n        rest = _objectWithoutPropertiesLoose(_ref, [\"css\"]);\n\n    return core.jsx(Type, Object.assign({\n      css: Object.assign({}, css, {\n        verticalAlign: 'text-bottom'\n      })\n    }, rest));\n  }\n\n  function FileIcon(props) {\n    return createIcon(GoFile, props);\n  }\n  function FileCodeIcon(props) {\n    return createIcon(GoFileCode, props);\n  }\n  function FolderIcon(props) {\n    return createIcon(GoFileDirectory, props);\n  }\n  function TwitterIcon(props) {\n    return createIcon(FaTwitter, props);\n  }\n  function GitHubIcon(props) {\n    return createIcon(FaGithub, props);\n  }\n\n  var linkStyle = {\n    color: '#0076ff',\n    textDecoration: 'none',\n    ':hover': {\n      textDecoration: 'underline'\n    }\n  };\n  var tableCellStyle = {\n    paddingTop: 6,\n    paddingRight: 3,\n    paddingBottom: 6,\n    paddingLeft: 3,\n    borderTop: '1px solid #eaecef'\n  };\n\n  var iconCellStyle = Object.assign({}, tableCellStyle, {\n    color: '#424242',\n    width: 17,\n    paddingRight: 2,\n    paddingLeft: 10,\n    '@media (max-width: 700px)': {\n      paddingLeft: 20\n    }\n  });\n\n  var typeCellStyle = Object.assign({}, tableCellStyle, {\n    textAlign: 'right',\n    paddingRight: 10,\n    '@media (max-width: 700px)': {\n      paddingRight: 20\n    }\n  });\n\n  function getRelName(path, base) {\n    return path.substr(base.length > 1 ? base.length + 1 : 1);\n  }\n\n  function FolderViewer(_ref) {\n    var path = _ref.path,\n        entries = _ref.details;\n\n    var _Object$keys$reduce = Object.keys(entries).reduce(function (memo, key) {\n      var subdirs = memo.subdirs,\n          files = memo.files;\n      var entry = entries[key];\n\n      if (entry.type === 'directory') {\n        subdirs.push(entry);\n      } else if (entry.type === 'file') {\n        files.push(entry);\n      }\n\n      return memo;\n    }, {\n      subdirs: [],\n      files: []\n    }),\n        subdirs = _Object$keys$reduce.subdirs,\n        files = _Object$keys$reduce.files;\n\n    subdirs.sort(sortBy_1('path'));\n    files.sort(sortBy_1('path'));\n    var rows = [];\n\n    if (path !== '/') {\n      rows.push(core.jsx(\"tr\", {\n        key: \"..\"\n      }, core.jsx(\"td\", {\n        css: iconCellStyle\n      }), core.jsx(\"td\", {\n        css: tableCellStyle\n      }, core.jsx(\"a\", {\n        title: \"Parent directory\",\n        href: \"../\",\n        css: linkStyle\n      }, \"..\")), core.jsx(\"td\", {\n        css: tableCellStyle\n      }), core.jsx(\"td\", {\n        css: typeCellStyle\n      })));\n    }\n\n    subdirs.forEach(function (_ref2) {\n      var dirname = _ref2.path;\n      var relName = getRelName(dirname, path);\n      var href = relName + '/';\n      rows.push(core.jsx(\"tr\", {\n        key: relName\n      }, core.jsx(\"td\", {\n        css: iconCellStyle\n      }, core.jsx(FolderIcon, null)), core.jsx(\"td\", {\n        css: tableCellStyle\n      }, core.jsx(\"a\", {\n        title: relName,\n        href: href,\n        css: linkStyle\n      }, relName)), core.jsx(\"td\", {\n        css: tableCellStyle\n      }, \"-\"), core.jsx(\"td\", {\n        css: typeCellStyle\n      }, \"-\")));\n    });\n    files.forEach(function (_ref3) {\n      var filename = _ref3.path,\n          size = _ref3.size,\n          contentType = _ref3.contentType;\n      var relName = getRelName(filename, path);\n      var href = relName;\n      rows.push(core.jsx(\"tr\", {\n        key: relName\n      }, core.jsx(\"td\", {\n        css: iconCellStyle\n      }, contentType === 'text/plain' || contentType === 'text/markdown' ? core.jsx(FileIcon, null) : core.jsx(FileCodeIcon, null)), core.jsx(\"td\", {\n        css: tableCellStyle\n      }, core.jsx(\"a\", {\n        title: relName,\n        href: href,\n        css: linkStyle\n      }, relName)), core.jsx(\"td\", {\n        css: tableCellStyle\n      }, prettyBytes(size)), core.jsx(\"td\", {\n        css: typeCellStyle\n      }, contentType)));\n    });\n    var counts = [];\n\n    if (files.length > 0) {\n      counts.push(files.length + \" file\" + (files.length === 1 ? '' : 's'));\n    }\n\n    if (subdirs.length > 0) {\n      counts.push(subdirs.length + \" folder\" + (subdirs.length === 1 ? '' : 's'));\n    }\n\n    return core.jsx(ContentArea, null, core.jsx(ContentAreaHeaderBar, null, core.jsx(\"span\", null, counts.join(', '))), core.jsx(\"table\", {\n      css: {\n        width: '100%',\n        borderCollapse: 'collapse',\n        borderRadius: 2,\n        background: '#fff',\n        '@media (max-width: 700px)': {\n          '& th + th + th + th, & td + td + td + td': {\n            display: 'none'\n          }\n        },\n        '& tr:first-of-type td': {\n          borderTop: 0\n        }\n      }\n    }, core.jsx(\"thead\", null, core.jsx(\"tr\", null, core.jsx(\"th\", null, core.jsx(VisuallyHidden, null, \"Icon\")), core.jsx(\"th\", null, core.jsx(VisuallyHidden, null, \"Name\")), core.jsx(\"th\", null, core.jsx(VisuallyHidden, null, \"Size\")), core.jsx(\"th\", null, core.jsx(VisuallyHidden, null, \"Content Type\")))), core.jsx(\"tbody\", null, rows)));\n  }\n\n  {\n    FolderViewer.propTypes = {\n      path: propTypes.string.isRequired,\n      details: propTypes.objectOf(propTypes.shape({\n        path: propTypes.string.isRequired,\n        type: propTypes.oneOf(['directory', 'file']).isRequired,\n        contentType: propTypes.string,\n        // file only\n        integrity: propTypes.string,\n        // file only\n        size: propTypes.number // file only\n\n      })).isRequired\n    };\n  }\n\n  function createHTML(content) {\n    return {\n      __html: content\n    };\n  }\n\n  /** @jsx jsx */\n\n  function getBasename(path) {\n    var segments = path.split('/');\n    return segments[segments.length - 1];\n  }\n\n  function ImageViewer(_ref) {\n    var path = _ref.path,\n        uri = _ref.uri;\n    return core.jsx(\"div\", {\n      css: {\n        padding: 20,\n        textAlign: 'center'\n      }\n    }, core.jsx(\"img\", {\n      alt: getBasename(path),\n      src: uri\n    }));\n  }\n\n  function CodeListing(_ref2) {\n    var highlights = _ref2.highlights;\n    var lines = highlights.slice(0);\n    var hasTrailingNewline = lines.length && lines[lines.length - 1] === '';\n\n    if (hasTrailingNewline) {\n      lines.pop();\n    }\n\n    return core.jsx(\"div\", {\n      className: \"code-listing\",\n      css: {\n        overflowX: 'auto',\n        overflowY: 'hidden',\n        paddingTop: 5,\n        paddingBottom: 5\n      }\n    }, core.jsx(\"table\", {\n      css: {\n        border: 'none',\n        borderCollapse: 'collapse',\n        borderSpacing: 0\n      }\n    }, core.jsx(\"tbody\", null, lines.map(function (line, index) {\n      var lineNumber = index + 1;\n      return core.jsx(\"tr\", {\n        key: index\n      }, core.jsx(\"td\", {\n        id: \"L\" + lineNumber,\n        css: {\n          paddingLeft: 10,\n          paddingRight: 10,\n          color: 'rgba(27,31,35,.3)',\n          textAlign: 'right',\n          verticalAlign: 'top',\n          width: '1%',\n          minWidth: 50,\n          userSelect: 'none'\n        }\n      }, core.jsx(\"span\", null, lineNumber)), core.jsx(\"td\", {\n        id: \"LC\" + lineNumber,\n        css: {\n          paddingLeft: 10,\n          paddingRight: 10,\n          color: '#24292e',\n          whiteSpace: 'pre'\n        }\n      }, core.jsx(\"code\", {\n        dangerouslySetInnerHTML: createHTML(line)\n      })));\n    }), !hasTrailingNewline && core.jsx(\"tr\", {\n      key: \"no-newline\"\n    }, core.jsx(\"td\", {\n      css: {\n        paddingLeft: 10,\n        paddingRight: 10,\n        color: 'rgba(27,31,35,.3)',\n        textAlign: 'right',\n        verticalAlign: 'top',\n        width: '1%',\n        minWidth: 50,\n        userSelect: 'none'\n      }\n    }, \"\\\\\"), core.jsx(\"td\", {\n      css: {\n        paddingLeft: 10,\n        color: 'rgba(27,31,35,.3)',\n        userSelect: 'none'\n      }\n    }, \"No newline at end of file\")))));\n  }\n\n  function BinaryViewer() {\n    return core.jsx(\"div\", {\n      css: {\n        padding: 20\n      }\n    }, core.jsx(\"p\", {\n      css: {\n        textAlign: 'center'\n      }\n    }, \"No preview available.\"));\n  }\n\n  function FileViewer(_ref3) {\n    var packageName = _ref3.packageName,\n        packageVersion = _ref3.packageVersion,\n        path = _ref3.path,\n        details = _ref3.details;\n    var highlights = details.highlights,\n        uri = details.uri,\n        language = details.language,\n        size = details.size;\n    return core.jsx(ContentArea, null, core.jsx(ContentAreaHeaderBar, null, core.jsx(\"span\", null, prettyBytes(size)), core.jsx(\"span\", null, language), core.jsx(\"span\", null, core.jsx(\"a\", {\n      href: \"/\" + packageName + \"@\" + packageVersion + path,\n      css: {\n        display: 'inline-block',\n        marginLeft: 8,\n        padding: '2px 8px',\n        textDecoration: 'none',\n        fontWeight: 600,\n        fontSize: '0.9rem',\n        color: '#24292e',\n        backgroundColor: '#eff3f6',\n        border: '1px solid rgba(27,31,35,.2)',\n        borderRadius: 3,\n        ':hover': {\n          backgroundColor: '#e6ebf1',\n          borderColor: 'rgba(27,31,35,.35)'\n        },\n        ':active': {\n          backgroundColor: '#e9ecef',\n          borderColor: 'rgba(27,31,35,.35)',\n          boxShadow: 'inset 0 0.15em 0.3em rgba(27,31,35,.15)'\n        }\n      }\n    }, \"View Raw\"))), highlights ? core.jsx(CodeListing, {\n      highlights: highlights\n    }) : uri ? core.jsx(ImageViewer, {\n      path: path,\n      uri: uri\n    }) : core.jsx(BinaryViewer, null));\n  }\n\n  {\n    FileViewer.propTypes = {\n      path: propTypes.string.isRequired,\n      details: propTypes.shape({\n        contentType: propTypes.string.isRequired,\n        highlights: propTypes.arrayOf(propTypes.string),\n        // code\n        uri: propTypes.string,\n        // images\n        integrity: propTypes.string.isRequired,\n        language: propTypes.string.isRequired,\n        size: propTypes.number.isRequired\n      }).isRequired\n    };\n  }\n\n  var SelectDownArrow = \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAYAAAC9vt6cAAAAAXNSR0IArs4c6QAAARFJREFUKBVjZAACNS39RhBNKrh17WI9o4quoT3Dn78HSNUMUs/CzOTI/O7Vi4dCYpJ3/jP+92BkYGAlyiBGhm8MjIxJt65e3MQM0vDu9YvLYmISILYZELOBxHABRkaGr0yMzF23r12YDFIDNgDEePv65SEhEXENBkYGFSAXuyGMjF8Z/jOsvX3tYiFIDwgwQSgIaaijnvj/P8M5IO8HsjiY/f//D4b//88A1SQhywG9jQr09PS4v/1mPAeUUPzP8B8cJowMjL+Bqu6xMQmaXL164AuyDgwDQJLa2qYSP//9vARkCoMVMzK8YeVkNbh+9uxzMB+JwGoASF5Vx0jz/98/18BqmZi171w9D2EjaaYKEwAEK00XQLdJuwAAAABJRU5ErkJggg==\";\n\n  function _templateObject2() {\n    var data = _taggedTemplateLiteralLoose([\"\\n  .code-listing {\\n    background: #fbfdff;\\n    color: #383a42;\\n  }\\n  .code-comment,\\n  .code-quote {\\n    color: #a0a1a7;\\n    font-style: italic;\\n  }\\n  .code-doctag,\\n  .code-keyword,\\n  .code-link,\\n  .code-formula {\\n    color: #a626a4;\\n  }\\n  .code-section,\\n  .code-name,\\n  .code-selector-tag,\\n  .code-deletion,\\n  .code-subst {\\n    color: #e45649;\\n  }\\n  .code-literal {\\n    color: #0184bb;\\n  }\\n  .code-string,\\n  .code-regexp,\\n  .code-addition,\\n  .code-attribute,\\n  .code-meta-string {\\n    color: #50a14f;\\n  }\\n  .code-built_in,\\n  .code-class .code-title {\\n    color: #c18401;\\n  }\\n  .code-attr,\\n  .code-variable,\\n  .code-template-variable,\\n  .code-type,\\n  .code-selector-class,\\n  .code-selector-attr,\\n  .code-selector-pseudo,\\n  .code-number {\\n    color: #986801;\\n  }\\n  .code-symbol,\\n  .code-bullet,\\n  .code-meta,\\n  .code-selector-id,\\n  .code-title {\\n    color: #4078f2;\\n  }\\n  .code-emphasis {\\n    font-style: italic;\\n  }\\n  .code-strong {\\n    font-weight: bold;\\n  }\\n\"]);\n\n    _templateObject2 = function _templateObject2() {\n      return data;\n    };\n\n    return data;\n  }\n\n  function _templateObject() {\n    var data = _taggedTemplateLiteralLoose([\"\\n  html {\\n    box-sizing: border-box;\\n  }\\n  *,\\n  *:before,\\n  *:after {\\n    box-sizing: inherit;\\n  }\\n\\n  html,\\n  body,\\n  #root {\\n    height: 100%;\\n    margin: 0;\\n  }\\n\\n  body {\\n    \", \"\\n    font-size: 16px;\\n    line-height: 1.5;\\n    overflow-wrap: break-word;\\n    background: white;\\n    color: black;\\n  }\\n\\n  code {\\n    \", \"\\n  }\\n\\n  th,\\n  td {\\n    padding: 0;\\n  }\\n\\n  select {\\n    font-size: inherit;\\n  }\\n\\n  #root {\\n    display: flex;\\n    flex-direction: column;\\n  }\\n\"]);\n\n    _templateObject = function _templateObject() {\n      return data;\n    };\n\n    return data;\n  }\n  var buildId = \"af8c8db\";\n  var globalStyles = core.css(_templateObject(), fontSans, fontMono); // Adapted from https://github.com/highlightjs/highlight.js/blob/master/src/styles/atom-one-light.css\n\n  var lightCodeStyles = core.css(_templateObject2());\n\n  function Link(_ref) {\n    var css = _ref.css,\n        rest = _objectWithoutPropertiesLoose(_ref, [\"css\"]);\n\n    return (// eslint-disable-next-line jsx-a11y/anchor-has-content\n      core.jsx(\"a\", Object.assign({}, rest, {\n        css: Object.assign({\n          color: '#0076ff',\n          textDecoration: 'none',\n          ':hover': {\n            textDecoration: 'underline'\n          }\n        }, css)\n      }))\n    );\n  }\n\n  function AppHeader() {\n    return core.jsx(\"header\", {\n      css: {\n        marginTop: '2rem'\n      }\n    }, core.jsx(\"h1\", {\n      css: {\n        textAlign: 'center',\n        fontSize: '3rem',\n        letterSpacing: '0.05em'\n      }\n    }, core.jsx(\"a\", {\n      href: \"/\",\n      css: {\n        color: '#000',\n        textDecoration: 'none'\n      }\n    }, \"UNPKG\")));\n  }\n\n  function AppNavigation(_ref2) {\n    var packageName = _ref2.packageName,\n        packageVersion = _ref2.packageVersion,\n        availableVersions = _ref2.availableVersions,\n        filename = _ref2.filename;\n\n    function handleVersionChange(nextVersion) {\n      window.location.href = window.location.href.replace('@' + packageVersion, '@' + nextVersion);\n    }\n\n    var breadcrumbs = [];\n\n    if (filename === '/') {\n      breadcrumbs.push(packageName);\n    } else {\n      var url = \"/browse/\" + packageName + \"@\" + packageVersion;\n      breadcrumbs.push(core.jsx(Link, {\n        href: url + \"/\"\n      }, packageName));\n      var segments = filename.replace(/^\\/+/, '').replace(/\\/+$/, '').split('/');\n      var lastSegment = segments.pop();\n      segments.forEach(function (segment) {\n        url += \"/\" + segment;\n        breadcrumbs.push(core.jsx(Link, {\n          href: url + \"/\"\n        }, segment));\n      });\n      breadcrumbs.push(lastSegment);\n    }\n\n    return core.jsx(\"header\", {\n      css: {\n        display: 'flex',\n        flexDirection: 'row',\n        alignItems: 'center',\n        '@media (max-width: 700px)': {\n          flexDirection: 'column-reverse',\n          alignItems: 'flex-start'\n        }\n      }\n    }, core.jsx(\"h1\", {\n      css: {\n        fontSize: '1.5rem',\n        fontWeight: 'normal',\n        flex: 1,\n        wordBreak: 'break-all'\n      }\n    }, core.jsx(\"nav\", null, breadcrumbs.map(function (item, index, array) {\n      return core.jsx(React.Fragment, {\n        key: index\n      }, index !== 0 && core.jsx(\"span\", {\n        css: {\n          paddingLeft: 5,\n          paddingRight: 5\n        }\n      }, \"/\"), index === array.length - 1 ? core.jsx(\"strong\", null, item) : item);\n    }))), core.jsx(PackageVersionPicker, {\n      packageVersion: packageVersion,\n      availableVersions: availableVersions,\n      onChange: handleVersionChange\n    }));\n  }\n\n  function PackageVersionPicker(_ref3) {\n    var packageVersion = _ref3.packageVersion,\n        availableVersions = _ref3.availableVersions,\n        onChange = _ref3.onChange;\n\n    function handleChange(event) {\n      if (onChange) onChange(event.target.value);\n    }\n\n    return core.jsx(\"p\", {\n      css: {\n        marginLeft: 20,\n        '@media (max-width: 700px)': {\n          marginLeft: 0,\n          marginBottom: 0\n        }\n      }\n    }, core.jsx(\"label\", null, \"Version:\", ' ', core.jsx(\"select\", {\n      name: \"version\",\n      defaultValue: packageVersion,\n      onChange: handleChange,\n      css: {\n        appearance: 'none',\n        cursor: 'pointer',\n        padding: '4px 24px 4px 8px',\n        fontWeight: 600,\n        fontSize: '0.9em',\n        color: '#24292e',\n        border: '1px solid rgba(27,31,35,.2)',\n        borderRadius: 3,\n        backgroundColor: '#eff3f6',\n        backgroundImage: \"url(\" + SelectDownArrow + \")\",\n        backgroundPosition: 'right 8px center',\n        backgroundRepeat: 'no-repeat',\n        backgroundSize: 'auto 25%',\n        ':hover': {\n          backgroundColor: '#e6ebf1',\n          borderColor: 'rgba(27,31,35,.35)'\n        },\n        ':active': {\n          backgroundColor: '#e9ecef',\n          borderColor: 'rgba(27,31,35,.35)',\n          boxShadow: 'inset 0 0.15em 0.3em rgba(27,31,35,.15)'\n        }\n      }\n    }, availableVersions.map(function (v) {\n      return core.jsx(\"option\", {\n        key: v,\n        value: v\n      }, v);\n    }))));\n  }\n\n  function AppContent(_ref4) {\n    var packageName = _ref4.packageName,\n        packageVersion = _ref4.packageVersion,\n        target = _ref4.target;\n    return target.type === 'directory' ? core.jsx(FolderViewer, {\n      path: target.path,\n      details: target.details\n    }) : target.type === 'file' ? core.jsx(FileViewer, {\n      packageName: packageName,\n      packageVersion: packageVersion,\n      path: target.path,\n      details: target.details\n    }) : null;\n  }\n\n  function App(_ref5) {\n    var packageName = _ref5.packageName,\n        packageVersion = _ref5.packageVersion,\n        _ref5$availableVersio = _ref5.availableVersions,\n        availableVersions = _ref5$availableVersio === void 0 ? [] : _ref5$availableVersio,\n        filename = _ref5.filename,\n        target = _ref5.target;\n    var maxContentWidth = 940; // TODO: Make this changeable\n    return core.jsx(React.Fragment, null, core.jsx(core.Global, {\n      styles: globalStyles\n    }), core.jsx(core.Global, {\n      styles: lightCodeStyles\n    }), core.jsx(\"div\", {\n      css: {\n        flex: '1 0 auto'\n      }\n    }, core.jsx(\"div\", {\n      css: {\n        maxWidth: maxContentWidth,\n        padding: '0 20px',\n        margin: '0 auto'\n      }\n    }, core.jsx(AppHeader, null)), core.jsx(\"div\", {\n      css: {\n        maxWidth: maxContentWidth,\n        padding: '0 20px',\n        margin: '0 auto'\n      }\n    }, core.jsx(AppNavigation, {\n      packageName: packageName,\n      packageVersion: packageVersion,\n      availableVersions: availableVersions,\n      filename: filename\n    })), core.jsx(\"div\", {\n      css: {\n        maxWidth: maxContentWidth,\n        padding: '0 20px',\n        margin: '0 auto',\n        '@media (max-width: 700px)': {\n          padding: 0,\n          margin: 0\n        }\n      }\n    }, core.jsx(AppContent, {\n      packageName: packageName,\n      packageVersion: packageVersion,\n      target: target\n    }))), core.jsx(\"footer\", {\n      css: {\n        marginTop: '5rem',\n        background: 'black',\n        color: '#aaa'\n      }\n    }, core.jsx(\"div\", {\n      css: {\n        maxWidth: maxContentWidth,\n        padding: '10px 20px',\n        margin: '0 auto',\n        display: 'flex',\n        flexDirection: 'row',\n        alignItems: 'center',\n        justifyContent: 'space-between'\n      }\n    }, core.jsx(\"p\", null, core.jsx(\"span\", null, \"Build: \", buildId)), core.jsx(\"p\", null, core.jsx(\"span\", null, \"\\xA9 \", new Date().getFullYear(), \" UNPKG\")), core.jsx(\"p\", {\n      css: {\n        fontSize: '1.5rem'\n      }\n    }, core.jsx(\"a\", {\n      href: \"https://twitter.com/unpkg\",\n      css: {\n        color: '#aaa',\n        display: 'inline-block',\n        ':hover': {\n          color: 'white'\n        }\n      }\n    }, core.jsx(TwitterIcon, null)), core.jsx(\"a\", {\n      href: \"https://github.com/mjackson/unpkg\",\n      css: {\n        color: '#aaa',\n        display: 'inline-block',\n        ':hover': {\n          color: 'white'\n        },\n        marginLeft: '1rem'\n      }\n    }, core.jsx(GitHubIcon, null))))));\n  }\n\n  {\n    var targetType = propTypes.shape({\n      path: propTypes.string.isRequired,\n      type: propTypes.oneOf(['directory', 'file']).isRequired,\n      details: propTypes.object.isRequired\n    });\n    App.propTypes = {\n      packageName: propTypes.string.isRequired,\n      packageVersion: propTypes.string.isRequired,\n      availableVersions: propTypes.arrayOf(propTypes.string),\n      filename: propTypes.string.isRequired,\n      target: targetType.isRequired\n    };\n  }\n\n  var props = window.__DATA__ || {};\n  ReactDOM.hydrate(React__default.createElement(App, props), document.getElementById('root'));\n\n}(React, ReactDOM, emotionCore));\n"}]},{"main":[{"format":"iife","globalImports":["react","react-dom","@emotion/core"],"url":"/_client/main-6494353e.js","code":"(function (React, ReactDOM, core) {\n  'use strict';\n\n  var React__default = 'default' in React ? React['default'] : React;\n  ReactDOM = ReactDOM && ReactDOM.hasOwnProperty('default') ? ReactDOM['default'] : ReactDOM;\n\n  function Object.assign() {\n    _extends = Object.assign || function (target) {\n      for (var i = 1; i < arguments.length; i++) {\n        var source = arguments[i];\n\n        for (var key in source) {\n          if (Object.prototype.hasOwnProperty.call(source, key)) {\n            target[key] = source[key];\n          }\n        }\n      }\n\n      return target;\n    };\n\n    return _extends.apply(this, arguments);\n  }\n\n  function _objectWithoutPropertiesLoose(source, excluded) {\n    if (source == null) return {};\n    var target = {};\n    var sourceKeys = Object.keys(source);\n    var key, i;\n\n    for (i = 0; i < sourceKeys.length; i++) {\n      key = sourceKeys[i];\n      if (excluded.indexOf(key) >= 0) continue;\n      target[key] = source[key];\n    }\n\n    return target;\n  }\n\n  function _taggedTemplateLiteralLoose(strings, raw) {\n    if (!raw) {\n      raw = strings.slice(0);\n    }\n\n    strings.raw = raw;\n    return strings;\n  }\n\n  function unwrapExports (x) {\n  \treturn x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;\n  }\n\n  function createCommonjsModule(fn, module) {\n  \treturn module = { exports: {} }, fn(module, module.exports), module.exports;\n  }\n\n  var reactIs_production_min = createCommonjsModule(function (module, exports) {\n  Object.defineProperty(exports,\"__esModule\",{value:!0});\n  var b=\"function\"===typeof Symbol&&Symbol.for,c=b?Symbol.for(\"react.element\"):60103,d=b?Symbol.for(\"react.portal\"):60106,e=b?Symbol.for(\"react.fragment\"):60107,f=b?Symbol.for(\"react.strict_mode\"):60108,g=b?Symbol.for(\"react.profiler\"):60114,h=b?Symbol.for(\"react.provider\"):60109,k=b?Symbol.for(\"react.context\"):60110,l=b?Symbol.for(\"react.async_mode\"):60111,m=b?Symbol.for(\"react.concurrent_mode\"):60111,n=b?Symbol.for(\"react.forward_ref\"):60112,p=b?Symbol.for(\"react.suspense\"):60113,q=b?Symbol.for(\"react.memo\"):\n  60115,r=b?Symbol.for(\"react.lazy\"):60116;function t(a){if(\"object\"===typeof a&&null!==a){var u=a.$$typeof;switch(u){case c:switch(a=a.type,a){case l:case m:case e:case g:case f:case p:return a;default:switch(a=a&&a.$$typeof,a){case k:case n:case h:return a;default:return u}}case r:case q:case d:return u}}}function v(a){return t(a)===m}exports.typeOf=t;exports.AsyncMode=l;exports.ConcurrentMode=m;exports.ContextConsumer=k;exports.ContextProvider=h;exports.Element=c;exports.ForwardRef=n;\n  exports.Fragment=e;exports.Lazy=r;exports.Memo=q;exports.Portal=d;exports.Profiler=g;exports.StrictMode=f;exports.Suspense=p;exports.isValidElementType=function(a){return \"string\"===typeof a||\"function\"===typeof a||a===e||a===m||a===g||a===f||a===p||\"object\"===typeof a&&null!==a&&(a.$$typeof===r||a.$$typeof===q||a.$$typeof===h||a.$$typeof===k||a.$$typeof===n)};exports.isAsyncMode=function(a){return v(a)||t(a)===l};exports.isConcurrentMode=v;exports.isContextConsumer=function(a){return t(a)===k};\n  exports.isContextProvider=function(a){return t(a)===h};exports.isElement=function(a){return \"object\"===typeof a&&null!==a&&a.$$typeof===c};exports.isForwardRef=function(a){return t(a)===n};exports.isFragment=function(a){return t(a)===e};exports.isLazy=function(a){return t(a)===r};exports.isMemo=function(a){return t(a)===q};exports.isPortal=function(a){return t(a)===d};exports.isProfiler=function(a){return t(a)===g};exports.isStrictMode=function(a){return t(a)===f};\n  exports.isSuspense=function(a){return t(a)===p};\n  });\n\n  unwrapExports(reactIs_production_min);\n  var reactIs_production_min_1 = reactIs_production_min.typeOf;\n  var reactIs_production_min_2 = reactIs_production_min.AsyncMode;\n  var reactIs_production_min_3 = reactIs_production_min.ConcurrentMode;\n  var reactIs_production_min_4 = reactIs_production_min.ContextConsumer;\n  var reactIs_production_min_5 = reactIs_production_min.ContextProvider;\n  var reactIs_production_min_6 = reactIs_production_min.Element;\n  var reactIs_production_min_7 = reactIs_production_min.ForwardRef;\n  var reactIs_production_min_8 = reactIs_production_min.Fragment;\n  var reactIs_production_min_9 = reactIs_production_min.Lazy;\n  var reactIs_production_min_10 = reactIs_production_min.Memo;\n  var reactIs_production_min_11 = reactIs_production_min.Portal;\n  var reactIs_production_min_12 = reactIs_production_min.Profiler;\n  var reactIs_production_min_13 = reactIs_production_min.StrictMode;\n  var reactIs_production_min_14 = reactIs_production_min.Suspense;\n  var reactIs_production_min_15 = reactIs_production_min.isValidElementType;\n  var reactIs_production_min_16 = reactIs_production_min.isAsyncMode;\n  var reactIs_production_min_17 = reactIs_production_min.isConcurrentMode;\n  var reactIs_production_min_18 = reactIs_production_min.isContextConsumer;\n  var reactIs_production_min_19 = reactIs_production_min.isContextProvider;\n  var reactIs_production_min_20 = reactIs_production_min.isElement;\n  var reactIs_production_min_21 = reactIs_production_min.isForwardRef;\n  var reactIs_production_min_22 = reactIs_production_min.isFragment;\n  var reactIs_production_min_23 = reactIs_production_min.isLazy;\n  var reactIs_production_min_24 = reactIs_production_min.isMemo;\n  var reactIs_production_min_25 = reactIs_production_min.isPortal;\n  var reactIs_production_min_26 = reactIs_production_min.isProfiler;\n  var reactIs_production_min_27 = reactIs_production_min.isStrictMode;\n  var reactIs_production_min_28 = reactIs_production_min.isSuspense;\n\n  var reactIs_development = createCommonjsModule(function (module, exports) {\n\n\n\n  {\n    (function() {\n\n  Object.defineProperty(exports, '__esModule', { value: true });\n\n  // The Symbol used to tag the ReactElement-like types. If there is no native Symbol\n  // nor polyfill, then a plain number is used for performance.\n  var hasSymbol = typeof Symbol === 'function' && Symbol.for;\n\n  var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;\n  var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;\n  var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;\n  var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;\n  var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;\n  var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;\n  var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace;\n  var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;\n  var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;\n  var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;\n  var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;\n  var REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;\n  var REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;\n\n  function isValidElementType(type) {\n    return typeof type === 'string' || typeof type === 'function' ||\n    // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.\n    type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || typeof type === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE);\n  }\n\n  /**\n   * Forked from fbjs/warning:\n   * https://github.com/facebook/fbjs/blob/e66ba20ad5be433eb54423f2b097d829324d9de6/packages/fbjs/src/__forks__/warning.js\n   *\n   * Only change is we use console.warn instead of console.error,\n   * and do nothing when 'console' is not supported.\n   * This really simplifies the code.\n   * ---\n   * Similar to invariant but only logs a warning if the condition is not met.\n   * This can be used to log issues in development environments in critical\n   * paths. Removing the logging code for production environments will keep the\n   * same logic and follow the same code paths.\n   */\n\n  var lowPriorityWarning = function () {};\n\n  {\n    var printWarning = function (format) {\n      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {\n        args[_key - 1] = arguments[_key];\n      }\n\n      var argIndex = 0;\n      var message = 'Warning: ' + format.replace(/%s/g, function () {\n        return args[argIndex++];\n      });\n      if (typeof console !== 'undefined') {\n        console.warn(message);\n      }\n      try {\n        // --- Welcome to debugging React ---\n        // This error was thrown as a convenience so that you can use this stack\n        // to find the callsite that caused this warning to fire.\n        throw new Error(message);\n      } catch (x) {}\n    };\n\n    lowPriorityWarning = function (condition, format) {\n      if (format === undefined) {\n        throw new Error('`lowPriorityWarning(condition, format, ...args)` requires a warning ' + 'message argument');\n      }\n      if (!condition) {\n        for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {\n          args[_key2 - 2] = arguments[_key2];\n        }\n\n        printWarning.apply(undefined, [format].concat(args));\n      }\n    };\n  }\n\n  var lowPriorityWarning$1 = lowPriorityWarning;\n\n  function typeOf(object) {\n    if (typeof object === 'object' && object !== null) {\n      var $$typeof = object.$$typeof;\n      switch ($$typeof) {\n        case REACT_ELEMENT_TYPE:\n          var type = object.type;\n\n          switch (type) {\n            case REACT_ASYNC_MODE_TYPE:\n            case REACT_CONCURRENT_MODE_TYPE:\n            case REACT_FRAGMENT_TYPE:\n            case REACT_PROFILER_TYPE:\n            case REACT_STRICT_MODE_TYPE:\n            case REACT_SUSPENSE_TYPE:\n              return type;\n            default:\n              var $$typeofType = type && type.$$typeof;\n\n              switch ($$typeofType) {\n                case REACT_CONTEXT_TYPE:\n                case REACT_FORWARD_REF_TYPE:\n                case REACT_PROVIDER_TYPE:\n                  return $$typeofType;\n                default:\n                  return $$typeof;\n              }\n          }\n        case REACT_LAZY_TYPE:\n        case REACT_MEMO_TYPE:\n        case REACT_PORTAL_TYPE:\n          return $$typeof;\n      }\n    }\n\n    return undefined;\n  }\n\n  // AsyncMode is deprecated along with isAsyncMode\n  var AsyncMode = REACT_ASYNC_MODE_TYPE;\n  var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;\n  var ContextConsumer = REACT_CONTEXT_TYPE;\n  var ContextProvider = REACT_PROVIDER_TYPE;\n  var Element = REACT_ELEMENT_TYPE;\n  var ForwardRef = REACT_FORWARD_REF_TYPE;\n  var Fragment = REACT_FRAGMENT_TYPE;\n  var Lazy = REACT_LAZY_TYPE;\n  var Memo = REACT_MEMO_TYPE;\n  var Portal = REACT_PORTAL_TYPE;\n  var Profiler = REACT_PROFILER_TYPE;\n  var StrictMode = REACT_STRICT_MODE_TYPE;\n  var Suspense = REACT_SUSPENSE_TYPE;\n\n  var hasWarnedAboutDeprecatedIsAsyncMode = false;\n\n  // AsyncMode should be deprecated\n  function isAsyncMode(object) {\n    {\n      if (!hasWarnedAboutDeprecatedIsAsyncMode) {\n        hasWarnedAboutDeprecatedIsAsyncMode = true;\n        lowPriorityWarning$1(false, 'The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');\n      }\n    }\n    return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;\n  }\n  function isConcurrentMode(object) {\n    return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;\n  }\n  function isContextConsumer(object) {\n    return typeOf(object) === REACT_CONTEXT_TYPE;\n  }\n  function isContextProvider(object) {\n    return typeOf(object) === REACT_PROVIDER_TYPE;\n  }\n  function isElement(object) {\n    return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;\n  }\n  function isForwardRef(object) {\n    return typeOf(object) === REACT_FORWARD_REF_TYPE;\n  }\n  function isFragment(object) {\n    return typeOf(object) === REACT_FRAGMENT_TYPE;\n  }\n  function isLazy(object) {\n    return typeOf(object) === REACT_LAZY_TYPE;\n  }\n  function isMemo(object) {\n    return typeOf(object) === REACT_MEMO_TYPE;\n  }\n  function isPortal(object) {\n    return typeOf(object) === REACT_PORTAL_TYPE;\n  }\n  function isProfiler(object) {\n    return typeOf(object) === REACT_PROFILER_TYPE;\n  }\n  function isStrictMode(object) {\n    return typeOf(object) === REACT_STRICT_MODE_TYPE;\n  }\n  function isSuspense(object) {\n    return typeOf(object) === REACT_SUSPENSE_TYPE;\n  }\n\n  exports.typeOf = typeOf;\n  exports.AsyncMode = AsyncMode;\n  exports.ConcurrentMode = ConcurrentMode;\n  exports.ContextConsumer = ContextConsumer;\n  exports.ContextProvider = ContextProvider;\n  exports.Element = Element;\n  exports.ForwardRef = ForwardRef;\n  exports.Fragment = Fragment;\n  exports.Lazy = Lazy;\n  exports.Memo = Memo;\n  exports.Portal = Portal;\n  exports.Profiler = Profiler;\n  exports.StrictMode = StrictMode;\n  exports.Suspense = Suspense;\n  exports.isValidElementType = isValidElementType;\n  exports.isAsyncMode = isAsyncMode;\n  exports.isConcurrentMode = isConcurrentMode;\n  exports.isContextConsumer = isContextConsumer;\n  exports.isContextProvider = isContextProvider;\n  exports.isElement = isElement;\n  exports.isForwardRef = isForwardRef;\n  exports.isFragment = isFragment;\n  exports.isLazy = isLazy;\n  exports.isMemo = isMemo;\n  exports.isPortal = isPortal;\n  exports.isProfiler = isProfiler;\n  exports.isStrictMode = isStrictMode;\n  exports.isSuspense = isSuspense;\n    })();\n  }\n  });\n\n  unwrapExports(reactIs_development);\n  var reactIs_development_1 = reactIs_development.typeOf;\n  var reactIs_development_2 = reactIs_development.AsyncMode;\n  var reactIs_development_3 = reactIs_development.ConcurrentMode;\n  var reactIs_development_4 = reactIs_development.ContextConsumer;\n  var reactIs_development_5 = reactIs_development.ContextProvider;\n  var reactIs_development_6 = reactIs_development.Element;\n  var reactIs_development_7 = reactIs_development.ForwardRef;\n  var reactIs_development_8 = reactIs_development.Fragment;\n  var reactIs_development_9 = reactIs_development.Lazy;\n  var reactIs_development_10 = reactIs_development.Memo;\n  var reactIs_development_11 = reactIs_development.Portal;\n  var reactIs_development_12 = reactIs_development.Profiler;\n  var reactIs_development_13 = reactIs_development.StrictMode;\n  var reactIs_development_14 = reactIs_development.Suspense;\n  var reactIs_development_15 = reactIs_development.isValidElementType;\n  var reactIs_development_16 = reactIs_development.isAsyncMode;\n  var reactIs_development_17 = reactIs_development.isConcurrentMode;\n  var reactIs_development_18 = reactIs_development.isContextConsumer;\n  var reactIs_development_19 = reactIs_development.isContextProvider;\n  var reactIs_development_20 = reactIs_development.isElement;\n  var reactIs_development_21 = reactIs_development.isForwardRef;\n  var reactIs_development_22 = reactIs_development.isFragment;\n  var reactIs_development_23 = reactIs_development.isLazy;\n  var reactIs_development_24 = reactIs_development.isMemo;\n  var reactIs_development_25 = reactIs_development.isPortal;\n  var reactIs_development_26 = reactIs_development.isProfiler;\n  var reactIs_development_27 = reactIs_development.isStrictMode;\n  var reactIs_development_28 = reactIs_development.isSuspense;\n\n  var reactIs = createCommonjsModule(function (module) {\n\n  {\n    module.exports = reactIs_development;\n  }\n  });\n\n  /*\n  object-assign\n  (c) Sindre Sorhus\n  @license MIT\n  */\n  /* eslint-disable no-unused-vars */\n  var getOwnPropertySymbols = Object.getOwnPropertySymbols;\n  var hasOwnProperty = Object.prototype.hasOwnProperty;\n  var propIsEnumerable = Object.prototype.propertyIsEnumerable;\n\n  function toObject(val) {\n  \tif (val === null || val === undefined) {\n  \t\tthrow new TypeError('Object.assign cannot be called with null or undefined');\n  \t}\n\n  \treturn Object(val);\n  }\n\n  function shouldUseNative() {\n  \ttry {\n  \t\tif (!Object.assign) {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\t// Detect buggy property enumeration order in older V8 versions.\n\n  \t\t// https://bugs.chromium.org/p/v8/issues/detail?id=4118\n  \t\tvar test1 = new String('abc');  // eslint-disable-line no-new-wrappers\n  \t\ttest1[5] = 'de';\n  \t\tif (Object.getOwnPropertyNames(test1)[0] === '5') {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\t// https://bugs.chromium.org/p/v8/issues/detail?id=3056\n  \t\tvar test2 = {};\n  \t\tfor (var i = 0; i < 10; i++) {\n  \t\t\ttest2['_' + String.fromCharCode(i)] = i;\n  \t\t}\n  \t\tvar order2 = Object.getOwnPropertyNames(test2).map(function (n) {\n  \t\t\treturn test2[n];\n  \t\t});\n  \t\tif (order2.join('') !== '0123456789') {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\t// https://bugs.chromium.org/p/v8/issues/detail?id=3056\n  \t\tvar test3 = {};\n  \t\t'abcdefghijklmnopqrst'.split('').forEach(function (letter) {\n  \t\t\ttest3[letter] = letter;\n  \t\t});\n  \t\tif (Object.keys(Object.assign({}, test3)).join('') !==\n  \t\t\t\t'abcdefghijklmnopqrst') {\n  \t\t\treturn false;\n  \t\t}\n\n  \t\treturn true;\n  \t} catch (err) {\n  \t\t// We don't expect any of the above to throw, but better to be safe.\n  \t\treturn false;\n  \t}\n  }\n\n  var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {\n  \tvar from;\n  \tvar to = toObject(target);\n  \tvar symbols;\n\n  \tfor (var s = 1; s < arguments.length; s++) {\n  \t\tfrom = Object(arguments[s]);\n\n  \t\tfor (var key in from) {\n  \t\t\tif (hasOwnProperty.call(from, key)) {\n  \t\t\t\tto[key] = from[key];\n  \t\t\t}\n  \t\t}\n\n  \t\tif (getOwnPropertySymbols) {\n  \t\t\tsymbols = getOwnPropertySymbols(from);\n  \t\t\tfor (var i = 0; i < symbols.length; i++) {\n  \t\t\t\tif (propIsEnumerable.call(from, symbols[i])) {\n  \t\t\t\t\tto[symbols[i]] = from[symbols[i]];\n  \t\t\t\t}\n  \t\t\t}\n  \t\t}\n  \t}\n\n  \treturn to;\n  };\n\n  /**\n   * Copyright (c) 2013-present, Facebook, Inc.\n   *\n   * This source code is licensed under the MIT license found in the\n   * LICENSE file in the root directory of this source tree.\n   */\n\n  var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';\n\n  var ReactPropTypesSecret_1 = ReactPropTypesSecret;\n\n  var printWarning = function() {};\n\n  {\n    var ReactPropTypesSecret$1 = ReactPropTypesSecret_1;\n    var loggedTypeFailures = {};\n    var has = Function.call.bind(Object.prototype.hasOwnProperty);\n\n    printWarning = function(text) {\n      var message = 'Warning: ' + text;\n      if (typeof console !== 'undefined') {\n        console.error(message);\n      }\n      try {\n        // --- Welcome to debugging React ---\n        // This error was thrown as a convenience so that you can use this stack\n        // to find the callsite that caused this warning to fire.\n        throw new Error(message);\n      } catch (x) {}\n    };\n  }\n\n  /**\n   * Assert that the values match with the type specs.\n   * Error messages are memorized and will only be shown once.\n   *\n   * @param {object} typeSpecs Map of name to a ReactPropType\n   * @param {object} values Runtime values that need to be type-checked\n   * @param {string} location e.g. \"prop\", \"context\", \"child context\"\n   * @param {string} componentName Name of the component for error messages.\n   * @param {?Function} getStack Returns the component stack.\n   * @private\n   */\n  function checkPropTypes(typeSpecs, values, location, componentName, getStack) {\n    {\n      for (var typeSpecName in typeSpecs) {\n        if (has(typeSpecs, typeSpecName)) {\n          var error;\n          // Prop type validation may throw. In case they do, we don't want to\n          // fail the render phase where it didn't fail before. So we log it.\n          // After these have been cleaned up, we'll let them throw.\n          try {\n            // This is intentionally an invariant that gets caught. It's the same\n            // behavior as without this statement except with a better message.\n            if (typeof typeSpecs[typeSpecName] !== 'function') {\n              var err = Error(\n                (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +\n                'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.'\n              );\n              err.name = 'Invariant Violation';\n              throw err;\n            }\n            error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret$1);\n          } catch (ex) {\n            error = ex;\n          }\n          if (error && !(error instanceof Error)) {\n            printWarning(\n              (componentName || 'React class') + ': type specification of ' +\n              location + ' `' + typeSpecName + '` is invalid; the type checker ' +\n              'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +\n              'You may have forgotten to pass an argument to the type checker ' +\n              'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +\n              'shape all require an argument).'\n            );\n          }\n          if (error instanceof Error && !(error.message in loggedTypeFailures)) {\n            // Only monitor this failure once because there tends to be a lot of the\n            // same error.\n            loggedTypeFailures[error.message] = true;\n\n            var stack = getStack ? getStack() : '';\n\n            printWarning(\n              'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')\n            );\n          }\n        }\n      }\n    }\n  }\n\n  /**\n   * Resets warning cache when testing.\n   *\n   * @private\n   */\n  checkPropTypes.resetWarningCache = function() {\n    {\n      loggedTypeFailures = {};\n    }\n  };\n\n  var checkPropTypes_1 = checkPropTypes;\n\n  var has$1 = Function.call.bind(Object.prototype.hasOwnProperty);\n  var printWarning$1 = function() {};\n\n  {\n    printWarning$1 = function(text) {\n      var message = 'Warning: ' + text;\n      if (typeof console !== 'undefined') {\n        console.error(message);\n      }\n      try {\n        // --- Welcome to debugging React ---\n        // This error was thrown as a convenience so that you can use this stack\n        // to find the callsite that caused this warning to fire.\n        throw new Error(message);\n      } catch (x) {}\n    };\n  }\n\n  function emptyFunctionThatReturnsNull() {\n    return null;\n  }\n\n  var factoryWithTypeCheckers = function(isValidElement, throwOnDirectAccess) {\n    /* global Symbol */\n    var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;\n    var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.\n\n    /**\n     * Returns the iterator method function contained on the iterable object.\n     *\n     * Be sure to invoke the function with the iterable as context:\n     *\n     *     var iteratorFn = getIteratorFn(myIterable);\n     *     if (iteratorFn) {\n     *       var iterator = iteratorFn.call(myIterable);\n     *       ...\n     *     }\n     *\n     * @param {?object} maybeIterable\n     * @return {?function}\n     */\n    function getIteratorFn(maybeIterable) {\n      var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);\n      if (typeof iteratorFn === 'function') {\n        return iteratorFn;\n      }\n    }\n\n    /**\n     * Collection of methods that allow declaration and validation of props that are\n     * supplied to React components. Example usage:\n     *\n     *   var Props = require('ReactPropTypes');\n     *   var MyArticle = React.createClass({\n     *     propTypes: {\n     *       // An optional string prop named \"description\".\n     *       description: Props.string,\n     *\n     *       // A required enum prop named \"category\".\n     *       category: Props.oneOf(['News','Photos']).isRequired,\n     *\n     *       // A prop named \"dialog\" that requires an instance of Dialog.\n     *       dialog: Props.instanceOf(Dialog).isRequired\n     *     },\n     *     render: function() { ... }\n     *   });\n     *\n     * A more formal specification of how these methods are used:\n     *\n     *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)\n     *   decl := ReactPropTypes.{type}(.isRequired)?\n     *\n     * Each and every declaration produces a function with the same signature. This\n     * allows the creation of custom validation functions. For example:\n     *\n     *  var MyLink = React.createClass({\n     *    propTypes: {\n     *      // An optional string or URI prop named \"href\".\n     *      href: function(props, propName, componentName) {\n     *        var propValue = props[propName];\n     *        if (propValue != null && typeof propValue !== 'string' &&\n     *            !(propValue instanceof URI)) {\n     *          return new Error(\n     *            'Expected a string or an URI for ' + propName + ' in ' +\n     *            componentName\n     *          );\n     *        }\n     *      }\n     *    },\n     *    render: function() {...}\n     *  });\n     *\n     * @internal\n     */\n\n    var ANONYMOUS = '<<anonymous>>';\n\n    // Important!\n    // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.\n    var ReactPropTypes = {\n      array: createPrimitiveTypeChecker('array'),\n      bool: createPrimitiveTypeChecker('boolean'),\n      func: createPrimitiveTypeChecker('function'),\n      number: createPrimitiveTypeChecker('number'),\n      object: createPrimitiveTypeChecker('object'),\n      string: createPrimitiveTypeChecker('string'),\n      symbol: createPrimitiveTypeChecker('symbol'),\n\n      any: createAnyTypeChecker(),\n      arrayOf: createArrayOfTypeChecker,\n      element: createElementTypeChecker(),\n      elementType: createElementTypeTypeChecker(),\n      instanceOf: createInstanceTypeChecker,\n      node: createNodeChecker(),\n      objectOf: createObjectOfTypeChecker,\n      oneOf: createEnumTypeChecker,\n      oneOfType: createUnionTypeChecker,\n      shape: createShapeTypeChecker,\n      exact: createStrictShapeTypeChecker,\n    };\n\n    /**\n     * inlined Object.is polyfill to avoid requiring consumers ship their own\n     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is\n     */\n    /*eslint-disable no-self-compare*/\n    function is(x, y) {\n      // SameValue algorithm\n      if (x === y) {\n        // Steps 1-5, 7-10\n        // Steps 6.b-6.e: +0 != -0\n        return x !== 0 || 1 / x === 1 / y;\n      } else {\n        // Step 6.a: NaN == NaN\n        return x !== x && y !== y;\n      }\n    }\n    /*eslint-enable no-self-compare*/\n\n    /**\n     * We use an Error-like object for backward compatibility as people may call\n     * PropTypes directly and inspect their output. However, we don't use real\n     * Errors anymore. We don't inspect their stack anyway, and creating them\n     * is prohibitively expensive if they are created too often, such as what\n     * happens in oneOfType() for any type before the one that matched.\n     */\n    function PropTypeError(message) {\n      this.message = message;\n      this.stack = '';\n    }\n    // Make `instanceof Error` still work for returned errors.\n    PropTypeError.prototype = Error.prototype;\n\n    function createChainableTypeChecker(validate) {\n      {\n        var manualPropTypeCallCache = {};\n        var manualPropTypeWarningCount = 0;\n      }\n      function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {\n        componentName = componentName || ANONYMOUS;\n        propFullName = propFullName || propName;\n\n        if (secret !== ReactPropTypesSecret_1) {\n          if (throwOnDirectAccess) {\n            // New behavior only for users of `prop-types` package\n            var err = new Error(\n              'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +\n              'Use `PropTypes.checkPropTypes()` to call them. ' +\n              'Read more at http://fb.me/use-check-prop-types'\n            );\n            err.name = 'Invariant Violation';\n            throw err;\n          } else if (typeof console !== 'undefined') {\n            // Old behavior for people using React.PropTypes\n            var cacheKey = componentName + ':' + propName;\n            if (\n              !manualPropTypeCallCache[cacheKey] &&\n              // Avoid spamming the console because they are often not actionable except for lib authors\n              manualPropTypeWarningCount < 3\n            ) {\n              printWarning$1(\n                'You are manually calling a React.PropTypes validation ' +\n                'function for the `' + propFullName + '` prop on `' + componentName  + '`. This is deprecated ' +\n                'and will throw in the standalone `prop-types` package. ' +\n                'You may be seeing this warning due to a third-party PropTypes ' +\n                'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.'\n              );\n              manualPropTypeCallCache[cacheKey] = true;\n              manualPropTypeWarningCount++;\n            }\n          }\n        }\n        if (props[propName] == null) {\n          if (isRequired) {\n            if (props[propName] === null) {\n              return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));\n            }\n            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));\n          }\n          return null;\n        } else {\n          return validate(props, propName, componentName, location, propFullName);\n        }\n      }\n\n      var chainedCheckType = checkType.bind(null, false);\n      chainedCheckType.isRequired = checkType.bind(null, true);\n\n      return chainedCheckType;\n    }\n\n    function createPrimitiveTypeChecker(expectedType) {\n      function validate(props, propName, componentName, location, propFullName, secret) {\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== expectedType) {\n          // `propValue` being instance of, say, date/regexp, pass the 'object'\n          // check, but we can offer a more precise error message here rather than\n          // 'of type `object`'.\n          var preciseType = getPreciseType(propValue);\n\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createAnyTypeChecker() {\n      return createChainableTypeChecker(emptyFunctionThatReturnsNull);\n    }\n\n    function createArrayOfTypeChecker(typeChecker) {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (typeof typeChecker !== 'function') {\n          return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');\n        }\n        var propValue = props[propName];\n        if (!Array.isArray(propValue)) {\n          var propType = getPropType(propValue);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));\n        }\n        for (var i = 0; i < propValue.length; i++) {\n          var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret_1);\n          if (error instanceof Error) {\n            return error;\n          }\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createElementTypeChecker() {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        if (!isValidElement(propValue)) {\n          var propType = getPropType(propValue);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createElementTypeTypeChecker() {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        if (!reactIs.isValidElementType(propValue)) {\n          var propType = getPropType(propValue);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement type.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createInstanceTypeChecker(expectedClass) {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (!(props[propName] instanceof expectedClass)) {\n          var expectedClassName = expectedClass.name || ANONYMOUS;\n          var actualClassName = getClassName(props[propName]);\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createEnumTypeChecker(expectedValues) {\n      if (!Array.isArray(expectedValues)) {\n        {\n          if (arguments.length > 1) {\n            printWarning$1(\n              'Invalid arguments supplied to oneOf, expected an array, got ' + arguments.length + ' arguments. ' +\n              'A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).'\n            );\n          } else {\n            printWarning$1('Invalid argument supplied to oneOf, expected an array.');\n          }\n        }\n        return emptyFunctionThatReturnsNull;\n      }\n\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        for (var i = 0; i < expectedValues.length; i++) {\n          if (is(propValue, expectedValues[i])) {\n            return null;\n          }\n        }\n\n        var valuesString = JSON.stringify(expectedValues, function replacer(key, value) {\n          var type = getPreciseType(value);\n          if (type === 'symbol') {\n            return String(value);\n          }\n          return value;\n        });\n        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + String(propValue) + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createObjectOfTypeChecker(typeChecker) {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (typeof typeChecker !== 'function') {\n          return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');\n        }\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== 'object') {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));\n        }\n        for (var key in propValue) {\n          if (has$1(propValue, key)) {\n            var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);\n            if (error instanceof Error) {\n              return error;\n            }\n          }\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createUnionTypeChecker(arrayOfTypeCheckers) {\n      if (!Array.isArray(arrayOfTypeCheckers)) {\n        printWarning$1('Invalid argument supplied to oneOfType, expected an instance of array.');\n        return emptyFunctionThatReturnsNull;\n      }\n\n      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {\n        var checker = arrayOfTypeCheckers[i];\n        if (typeof checker !== 'function') {\n          printWarning$1(\n            'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +\n            'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'\n          );\n          return emptyFunctionThatReturnsNull;\n        }\n      }\n\n      function validate(props, propName, componentName, location, propFullName) {\n        for (var i = 0; i < arrayOfTypeCheckers.length; i++) {\n          var checker = arrayOfTypeCheckers[i];\n          if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret_1) == null) {\n            return null;\n          }\n        }\n\n        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createNodeChecker() {\n      function validate(props, propName, componentName, location, propFullName) {\n        if (!isNode(props[propName])) {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createShapeTypeChecker(shapeTypes) {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== 'object') {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));\n        }\n        for (var key in shapeTypes) {\n          var checker = shapeTypes[key];\n          if (!checker) {\n            continue;\n          }\n          var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);\n          if (error) {\n            return error;\n          }\n        }\n        return null;\n      }\n      return createChainableTypeChecker(validate);\n    }\n\n    function createStrictShapeTypeChecker(shapeTypes) {\n      function validate(props, propName, componentName, location, propFullName) {\n        var propValue = props[propName];\n        var propType = getPropType(propValue);\n        if (propType !== 'object') {\n          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));\n        }\n        // We need to check all keys in case some are required but missing from\n        // props.\n        var allKeys = objectAssign({}, props[propName], shapeTypes);\n        for (var key in allKeys) {\n          var checker = shapeTypes[key];\n          if (!checker) {\n            return new PropTypeError(\n              'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +\n              '\\nBad object: ' + JSON.stringify(props[propName], null, '  ') +\n              '\\nValid keys: ' +  JSON.stringify(Object.keys(shapeTypes), null, '  ')\n            );\n          }\n          var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret_1);\n          if (error) {\n            return error;\n          }\n        }\n        return null;\n      }\n\n      return createChainableTypeChecker(validate);\n    }\n\n    function isNode(propValue) {\n      switch (typeof propValue) {\n        case 'number':\n        case 'string':\n        case 'undefined':\n          return true;\n        case 'boolean':\n          return !propValue;\n        case 'object':\n          if (Array.isArray(propValue)) {\n            return propValue.every(isNode);\n          }\n          if (propValue === null || isValidElement(propValue)) {\n            return true;\n          }\n\n          var iteratorFn = getIteratorFn(propValue);\n          if (iteratorFn) {\n            var iterator = iteratorFn.call(propValue);\n            var step;\n            if (iteratorFn !== propValue.entries) {\n              while (!(step = iterator.next()).done) {\n                if (!isNode(step.value)) {\n                  return false;\n                }\n              }\n            } else {\n              // Iterator will provide entry [k,v] tuples rather than values.\n              while (!(step = iterator.next()).done) {\n                var entry = step.value;\n                if (entry) {\n                  if (!isNode(entry[1])) {\n                    return false;\n                  }\n                }\n              }\n            }\n          } else {\n            return false;\n          }\n\n          return true;\n        default:\n          return false;\n      }\n    }\n\n    function isSymbol(propType, propValue) {\n      // Native Symbol.\n      if (propType === 'symbol') {\n        return true;\n      }\n\n      // falsy value can't be a Symbol\n      if (!propValue) {\n        return false;\n      }\n\n      // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'\n      if (propValue['@@toStringTag'] === 'Symbol') {\n        return true;\n      }\n\n      // Fallback for non-spec compliant Symbols which are polyfilled.\n      if (typeof Symbol === 'function' && propValue instanceof Symbol) {\n        return true;\n      }\n\n      return false;\n    }\n\n    // Equivalent of `typeof` but with special handling for array and regexp.\n    function getPropType(propValue) {\n      var propType = typeof propValue;\n      if (Array.isArray(propValue)) {\n        return 'array';\n      }\n      if (propValue instanceof RegExp) {\n        // Old webkits (at least until Android 4.0) return 'function' rather than\n        // 'object' for typeof a RegExp. We'll normalize this here so that /bla/\n        // passes PropTypes.object.\n        return 'object';\n      }\n      if (isSymbol(propType, propValue)) {\n        return 'symbol';\n      }\n      return propType;\n    }\n\n    // This handles more types than `getPropType`. Only used for error messages.\n    // See `createPrimitiveTypeChecker`.\n    function getPreciseType(propValue) {\n      if (typeof propValue === 'undefined' || propValue === null) {\n        return '' + propValue;\n      }\n      var propType = getPropType(propValue);\n      if (propType === 'object') {\n        if (propValue instanceof Date) {\n          return 'date';\n        } else if (propValue instanceof RegExp) {\n          return 'regexp';\n        }\n      }\n      return propType;\n    }\n\n    // Returns a string that is postfixed to a warning about an invalid type.\n    // For example, \"undefined\" or \"of type array\"\n    function getPostfixForTypeWarning(value) {\n      var type = getPreciseType(value);\n      switch (type) {\n        case 'array':\n        case 'object':\n          return 'an ' + type;\n        case 'boolean':\n        case 'date':\n        case 'regexp':\n          return 'a ' + type;\n        default:\n          return type;\n      }\n    }\n\n    // Returns class name of the object, if any.\n    function getClassName(propValue) {\n      if (!propValue.constructor || !propValue.constructor.name) {\n        return ANONYMOUS;\n      }\n      return propValue.constructor.name;\n    }\n\n    ReactPropTypes.checkPropTypes = checkPropTypes_1;\n    ReactPropTypes.resetWarningCache = checkPropTypes_1.resetWarningCache;\n    ReactPropTypes.PropTypes = ReactPropTypes;\n\n    return ReactPropTypes;\n  };\n\n  var propTypes = createCommonjsModule(function (module) {\n  /**\n   * Copyright (c) 2013-present, Facebook, Inc.\n   *\n   * This source code is licensed under the MIT license found in the\n   * LICENSE file in the root directory of this source tree.\n   */\n\n  {\n    var ReactIs = reactIs;\n\n    // By explicitly using `prop-types` you are opting into new development behavior.\n    // http://fb.me/prop-types-in-prod\n    var throwOnDirectAccess = true;\n    module.exports = factoryWithTypeCheckers(ReactIs.isElement, throwOnDirectAccess);\n  }\n  });\n\n  const UNITS = [\n  \t'B',\n  \t'kB',\n  \t'MB',\n  \t'GB',\n  \t'TB',\n  \t'PB',\n  \t'EB',\n  \t'ZB',\n  \t'YB'\n  ];\n\n  /*\n  Formats the given number using `Number#toLocaleString`.\n  - If locale is a string, the value is expected to be a locale-key (for example: `de`).\n  - If locale is true, the system default locale is used for translation.\n  - If no value for locale is specified, the number is returned unmodified.\n  */\n  const toLocaleString = (number, locale) => {\n  \tlet result = number;\n  \tif (typeof locale === 'string') {\n  \t\tresult = number.toLocaleString(locale);\n  \t} else if (locale === true) {\n  \t\tresult = number.toLocaleString();\n  \t}\n\n  \treturn result;\n  };\n\n  var prettyBytes = (number, options) => {\n  \tif (!Number.isFinite(number)) {\n  \t\tthrow new TypeError(`Expected a finite number, got ${typeof number}: ${number}`);\n  \t}\n\n  \toptions = Object.assign({}, options);\n\n  \tif (options.signed && number === 0) {\n  \t\treturn ' 0 B';\n  \t}\n\n  \tconst isNegative = number < 0;\n  \tconst prefix = isNegative ? '-' : (options.signed ? '+' : '');\n\n  \tif (isNegative) {\n  \t\tnumber = -number;\n  \t}\n\n  \tif (number < 1) {\n  \t\tconst numberString = toLocaleString(number, options.locale);\n  \t\treturn prefix + numberString + ' B';\n  \t}\n\n  \tconst exponent = Math.min(Math.floor(Math.log10(number) / 3), UNITS.length - 1);\n  \t// eslint-disable-next-line unicorn/prefer-exponentiation-operator\n  \tnumber = Number((number / Math.pow(1000, exponent)).toPrecision(3));\n  \tconst numberString = toLocaleString(number, options.locale);\n\n  \tconst unit = UNITS[exponent];\n\n  \treturn prefix + numberString + ' ' + unit;\n  };\n\n  var MILLISECONDS_IN_MINUTE = 60000;\n\n  /**\n   * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.\n   * They usually appear for dates that denote time before the timezones were introduced\n   * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891\n   * and GMT+01:00:00 after that date)\n   *\n   * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,\n   * which would lead to incorrect calculations.\n   *\n   * This function returns the timezone offset in milliseconds that takes seconds in account.\n   */\n  var getTimezoneOffsetInMilliseconds = function getTimezoneOffsetInMilliseconds (dirtyDate) {\n    var date = new Date(dirtyDate.getTime());\n    var baseTimezoneOffset = date.getTimezoneOffset();\n    date.setSeconds(0, 0);\n    var millisecondsPartOfTimezoneOffset = date.getTime() % MILLISECONDS_IN_MINUTE;\n\n    return baseTimezoneOffset * MILLISECONDS_IN_MINUTE + millisecondsPartOfTimezoneOffset\n  };\n\n  /**\n   * @category Common Helpers\n   * @summary Is the given argument an instance of Date?\n   *\n   * @description\n   * Is the given argument an instance of Date?\n   *\n   * @param {*} argument - the argument to check\n   * @returns {Boolean} the given argument is an instance of Date\n   *\n   * @example\n   * // Is 'mayonnaise' a Date?\n   * var result = isDate('mayonnaise')\n   * //=> false\n   */\n  function isDate (argument) {\n    return argument instanceof Date\n  }\n\n  var is_date = isDate;\n\n  var MILLISECONDS_IN_HOUR = 3600000;\n  var MILLISECONDS_IN_MINUTE$1 = 60000;\n  var DEFAULT_ADDITIONAL_DIGITS = 2;\n\n  var parseTokenDateTimeDelimeter = /[T ]/;\n  var parseTokenPlainTime = /:/;\n\n  // year tokens\n  var parseTokenYY = /^(\\d{2})$/;\n  var parseTokensYYY = [\n    /^([+-]\\d{2})$/, // 0 additional digits\n    /^([+-]\\d{3})$/, // 1 additional digit\n    /^([+-]\\d{4})$/ // 2 additional digits\n  ];\n\n  var parseTokenYYYY = /^(\\d{4})/;\n  var parseTokensYYYYY = [\n    /^([+-]\\d{4})/, // 0 additional digits\n    /^([+-]\\d{5})/, // 1 additional digit\n    /^([+-]\\d{6})/ // 2 additional digits\n  ];\n\n  // date tokens\n  var parseTokenMM = /^-(\\d{2})$/;\n  var parseTokenDDD = /^-?(\\d{3})$/;\n  var parseTokenMMDD = /^-?(\\d{2})-?(\\d{2})$/;\n  var parseTokenWww = /^-?W(\\d{2})$/;\n  var parseTokenWwwD = /^-?W(\\d{2})-?(\\d{1})$/;\n\n  // time tokens\n  var parseTokenHH = /^(\\d{2}([.,]\\d*)?)$/;\n  var parseTokenHHMM = /^(\\d{2}):?(\\d{2}([.,]\\d*)?)$/;\n  var parseTokenHHMMSS = /^(\\d{2}):?(\\d{2}):?(\\d{2}([.,]\\d*)?)$/;\n\n  // timezone tokens\n  var parseTokenTimezone = /([Z+-].*)$/;\n  var parseTokenTimezoneZ = /^(Z)$/;\n  var parseTokenTimezoneHH = /^([+-])(\\d{2})$/;\n  var parseTokenTimezoneHHMM = /^([+-])(\\d{2}):?(\\d{2})$/;\n\n  /**\n   * @category Common Helpers\n   * @summary Convert the given argument to an instance of Date.\n   *\n   * @description\n   * Convert the given argument to an instance of Date.\n   *\n   * If the argument is an instance of Date, the function returns its clone.\n   *\n   * If the argument is a number, it is treated as a timestamp.\n   *\n   * If an argument is a string, the function tries to parse it.\n   * Function accepts complete ISO 8601 formats as well as partial implementations.\n   * ISO 8601: http://en.wikipedia.org/wiki/ISO_8601\n   *\n   * If all above fails, the function passes the given argument to Date constructor.\n   *\n   * @param {Date|String|Number} argument - the value to convert\n   * @param {Object} [options] - the object with options\n   * @param {0 | 1 | 2} [options.additionalDigits=2] - the additional number of digits in the extended year format\n   * @returns {Date} the parsed date in the local time zone\n   *\n   * @example\n   * // Convert string '2014-02-11T11:30:30' to date:\n   * var result = parse('2014-02-11T11:30:30')\n   * //=> Tue Feb 11 2014 11:30:30\n   *\n   * @example\n   * // Parse string '+02014101',\n   * // if the additional number of digits in the extended year format is 1:\n   * var result = parse('+02014101', {additionalDigits: 1})\n   * //=> Fri Apr 11 2014 00:00:00\n   */\n  function parse (argument, dirtyOptions) {\n    if (is_date(argument)) {\n      // Prevent the date to lose the milliseconds when passed to new Date() in IE10\n      return new Date(argument.getTime())\n    } else if (typeof argument !== 'string') {\n      return new Date(argument)\n    }\n\n    var options = dirtyOptions || {};\n    var additionalDigits = options.additionalDigits;\n    if (additionalDigits == null) {\n      additionalDigits = DEFAULT_ADDITIONAL_DIGITS;\n    } else {\n      additionalDigits = Number(additionalDigits);\n    }\n\n    var dateStrings = splitDateString(argument);\n\n    var parseYearResult = parseYear(dateStrings.date, additionalDigits);\n    var year = parseYearResult.year;\n    var restDateString = parseYearResult.restDateString;\n\n    var date = parseDate(restDateString, year);\n\n    if (date) {\n      var timestamp = date.getTime();\n      var time = 0;\n      var offset;\n\n      if (dateStrings.time) {\n        time = parseTime(dateStrings.time);\n      }\n\n      if (dateStrings.timezone) {\n        offset = parseTimezone(dateStrings.timezone) * MILLISECONDS_IN_MINUTE$1;\n      } else {\n        var fullTime = timestamp + time;\n        var fullTimeDate = new Date(fullTime);\n\n        offset = getTimezoneOffsetInMilliseconds(fullTimeDate);\n\n        // Adjust time when it's coming from DST\n        var fullTimeDateNextDay = new Date(fullTime);\n        fullTimeDateNextDay.setDate(fullTimeDate.getDate() + 1);\n        var offsetDiff =\n          getTimezoneOffsetInMilliseconds(fullTimeDateNextDay) -\n          getTimezoneOffsetInMilliseconds(fullTimeDate);\n        if (offsetDiff > 0) {\n          offset += offsetDiff;\n        }\n      }\n\n      return new Date(timestamp + time + offset)\n    } else {\n      return new Date(argument)\n    }\n  }\n\n  function splitDateString (dateString) {\n    var dateStrings = {};\n    var array = dateString.split(parseTokenDateTimeDelimeter);\n    var timeString;\n\n    if (parseTokenPlainTime.test(array[0])) {\n      dateStrings.date = null;\n      timeString = array[0];\n    } else {\n      dateStrings.date = array[0];\n      timeString = array[1];\n    }\n\n    if (timeString) {\n      var token = parseTokenTimezone.exec(timeString);\n      if (token) {\n        dateStrings.time = timeString.replace(token[1], '');\n        dateStrings.timezone = token[1];\n      } else {\n        dateStrings.time = timeString;\n      }\n    }\n\n    return dateStrings\n  }\n\n  function parseYear (dateString, additionalDigits) {\n    var parseTokenYYY = parseTokensYYY[additionalDigits];\n    var parseTokenYYYYY = parseTokensYYYYY[additionalDigits];\n\n    var token;\n\n    // YYYY or ±YYYYY\n    token = parseTokenYYYY.exec(dateString) || parseTokenYYYYY.exec(dateString);\n    if (token) {\n      var yearString = token[1];\n      return {\n        year: parseInt(yearString, 10),\n        restDateString: dateString.slice(yearString.length)\n      }\n    }\n\n    // YY or ±YYY\n    token = parseTokenYY.exec(dateString) || parseTokenYYY.exec(dateString);\n    if (token) {\n      var centuryString = token[1];\n      return {\n        year: parseInt(centuryString, 10) * 100,\n        restDateString: dateString.slice(centuryString.length)\n      }\n    }\n\n    // Invalid ISO-formatted year\n    return {\n      year: null\n    }\n  }\n\n  function parseDate (dateString, year) {\n    // Invalid ISO-formatted year\n    if (year === null) {\n      return null\n    }\n\n    var token;\n    var date;\n    var month;\n    var week;\n\n    // YYYY\n    if (dateString.length === 0) {\n      date = new Date(0);\n      date.setUTCFullYear(year);\n      return date\n    }\n\n    // YYYY-MM\n    token = parseTokenMM.exec(dateString);\n    if (token) {\n      date = new Date(0);\n      month = parseInt(token[1], 10) - 1;\n      date.setUTCFullYear(year, month);\n      return date\n    }\n\n    // YYYY-DDD or YYYYDDD\n    token = parseTokenDDD.exec(dateString);\n    if (token) {\n      date = new Date(0);\n      var dayOfYear = parseInt(token[1], 10);\n      date.setUTCFullYear(year, 0, dayOfYear);\n      return date\n    }\n\n    // YYYY-MM-DD or YYYYMMDD\n    token = parseTokenMMDD.exec(dateString);\n    if (token) {\n      date = new Date(0);\n      month = parseInt(token[1], 10) - 1;\n      var day = parseInt(token[2], 10);\n      date.setUTCFullYear(year, month, day);\n      return date\n    }\n\n    // YYYY-Www or YYYYWww\n    token = parseTokenWww.exec(dateString);\n    if (token) {\n      week = parseInt(token[1], 10) - 1;\n      return dayOfISOYear(year, week)\n    }\n\n    // YYYY-Www-D or YYYYWwwD\n    token = parseTokenWwwD.exec(dateString);\n    if (token) {\n      week = parseInt(token[1], 10) - 1;\n      var dayOfWeek = parseInt(token[2], 10) - 1;\n      return dayOfISOYear(year, week, dayOfWeek)\n    }\n\n    // Invalid ISO-formatted date\n    return null\n  }\n\n  function parseTime (timeString) {\n    var token;\n    var hours;\n    var minutes;\n\n    // hh\n    token = parseTokenHH.exec(timeString);\n    if (token) {\n      hours = parseFloat(token[1].replace(',', '.'));\n      return (hours % 24) * MILLISECONDS_IN_HOUR\n    }\n\n    // hh:mm or hhmm\n    token = parseTokenHHMM.exec(timeString);\n    if (token) {\n      hours = parseInt(token[1], 10);\n      minutes = parseFloat(token[2].replace(',', '.'));\n      return (hours % 24) * MILLISECONDS_IN_HOUR +\n        minutes * MILLISECONDS_IN_MINUTE$1\n    }\n\n    // hh:mm:ss or hhmmss\n    token = parseTokenHHMMSS.exec(timeString);\n    if (token) {\n      hours = parseInt(token[1], 10);\n      minutes = parseInt(token[2], 10);\n      var seconds = parseFloat(token[3].replace(',', '.'));\n      return (hours % 24) * MILLISECONDS_IN_HOUR +\n        minutes * MILLISECONDS_IN_MINUTE$1 +\n        seconds * 1000\n    }\n\n    // Invalid ISO-formatted time\n    return null\n  }\n\n  function parseTimezone (timezoneString) {\n    var token;\n    var absoluteOffset;\n\n    // Z\n    token = parseTokenTimezoneZ.exec(timezoneString);\n    if (token) {\n      return 0\n    }\n\n    // ±hh\n    token = parseTokenTimezoneHH.exec(timezoneString);\n    if (token) {\n      absoluteOffset = parseInt(token[2], 10) * 60;\n      return (token[1] === '+') ? -absoluteOffset : absoluteOffset\n    }\n\n    // ±hh:mm or ±hhmm\n    token = parseTokenTimezoneHHMM.exec(timezoneString);\n    if (token) {\n      absoluteOffset = parseInt(token[2], 10) * 60 + parseInt(token[3], 10);\n      return (token[1] === '+') ? -absoluteOffset : absoluteOffset\n    }\n\n    return 0\n  }\n\n  function dayOfISOYear (isoYear, week, day) {\n    week = week || 0;\n    day = day || 0;\n    var date = new Date(0);\n    date.setUTCFullYear(isoYear, 0, 4);\n    var fourthOfJanuaryDay = date.getUTCDay() || 7;\n    var diff = week * 7 + day + 1 - fourthOfJanuaryDay;\n    date.setUTCDate(date.getUTCDate() + diff);\n    return date\n  }\n\n  var parse_1 = parse;\n\n  /**\n   * @category Year Helpers\n   * @summary Return the start of a year for the given date.\n   *\n   * @description\n   * Return the start of a year for the given date.\n   * The result will be in the local timezone.\n   *\n   * @param {Date|String|Number} date - the original date\n   * @returns {Date} the start of a year\n   *\n   * @example\n   * // The start of a year for 2 September 2014 11:55:00:\n   * var result = startOfYear(new Date(2014, 8, 2, 11, 55, 00))\n   * //=> Wed Jan 01 2014 00:00:00\n   */\n  function startOfYear (dirtyDate) {\n    var cleanDate = parse_1(dirtyDate);\n    var date = new Date(0);\n    date.setFullYear(cleanDate.getFullYear(), 0, 1);\n    date.setHours(0, 0, 0, 0);\n    return date\n  }\n\n  var start_of_year = startOfYear;\n\n  /**\n   * @category Day Helpers\n   * @summary Return the start of a day for the given date.\n   *\n   * @description\n   * Return the start of a day for the given date.\n   * The result will be in the local timezone.\n   *\n   * @param {Date|String|Number} date - the original date\n   * @returns {Date} the start of a day\n   *\n   * @example\n   * // The start of a day for 2 September 2014 11:55:00:\n   * var result = startOfDay(new Date(2014, 8, 2, 11, 55, 0))\n   * //=> Tue Sep 02 2014 00:00:00\n   */\n  function startOfDay (dirtyDate) {\n    var date = parse_1(dirtyDate);\n    date.setHours(0, 0, 0, 0);\n    return date\n  }\n\n  var start_of_day = startOfDay;\n\n  var MILLISECONDS_IN_MINUTE$2 = 60000;\n  var MILLISECONDS_IN_DAY = 86400000;\n\n  /**\n   * @category Day Helpers\n   * @summary Get the number of calendar days between the given dates.\n   *\n   * @description\n   * Get the number of calendar days between the given dates.\n   *\n   * @param {Date|String|Number} dateLeft - the later date\n   * @param {Date|String|Number} dateRight - the earlier date\n   * @returns {Number} the number of calendar days\n   *\n   * @example\n   * // How many calendar days are between\n   * // 2 July 2011 23:00:00 and 2 July 2012 00:00:00?\n   * var result = differenceInCalendarDays(\n   *   new Date(2012, 6, 2, 0, 0),\n   *   new Date(2011, 6, 2, 23, 0)\n   * )\n   * //=> 366\n   */\n  function differenceInCalendarDays (dirtyDateLeft, dirtyDateRight) {\n    var startOfDayLeft = start_of_day(dirtyDateLeft);\n    var startOfDayRight = start_of_day(dirtyDateRight);\n\n    var timestampLeft = startOfDayLeft.getTime() -\n      startOfDayLeft.getTimezoneOffset() * MILLISECONDS_IN_MINUTE$2;\n    var timestampRight = startOfDayRight.getTime() -\n      startOfDayRight.getTimezoneOffset() * MILLISECONDS_IN_MINUTE$2;\n\n    // Round the number of days to the nearest integer\n    // because the number of milliseconds in a day is not constant\n    // (e.g. it's different in the day of the daylight saving time clock shift)\n    return Math.round((timestampLeft - timestampRight) / MILLISECONDS_IN_DAY)\n  }\n\n  var difference_in_calendar_days = differenceInCalendarDays;\n\n  /**\n   * @category Day Helpers\n   * @summary Get the day of the year of the given date.\n   *\n   * @description\n   * Get the day of the year of the given date.\n   *\n   * @param {Date|String|Number} date - the given date\n   * @returns {Number} the day of year\n   *\n   * @example\n   * // Which day of the year is 2 July 2014?\n   * var result = getDayOfYear(new Date(2014, 6, 2))\n   * //=> 183\n   */\n  function getDayOfYear (dirtyDate) {\n    var date = parse_1(dirtyDate);\n    var diff = difference_in_calendar_days(date, start_of_year(date));\n    var dayOfYear = diff + 1;\n    return dayOfYear\n  }\n\n  var get_day_of_year = getDayOfYear;\n\n  /**\n   * @category Week Helpers\n   * @summary Return the start of a week for the given date.\n   *\n   * @description\n   * Return the start of a week for the given date.\n   * The result will be in the local timezone.\n   *\n   * @param {Date|String|Number} date - the original date\n   * @param {Object} [options] - the object with options\n   * @param {Number} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)\n   * @returns {Date} the start of a week\n   *\n   * @example\n   * // The start of a week for 2 September 2014 11:55:00:\n   * var result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0))\n   * //=> Sun Aug 31 2014 00:00:00\n   *\n   * @example\n   * // If the week starts on Monday, the start of the week for 2 September 2014 11:55:00:\n   * var result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0), {weekStartsOn: 1})\n   * //=> Mon Sep 01 2014 00:00:00\n   */\n  function startOfWeek (dirtyDate, dirtyOptions) {\n    var weekStartsOn = dirtyOptions ? (Number(dirtyOptions.weekStartsOn) || 0) : 0;\n\n    var date = parse_1(dirtyDate);\n    var day = date.getDay();\n    var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;\n\n    date.setDate(date.getDate() - diff);\n    date.setHours(0, 0, 0, 0);\n    return date\n  }\n\n  var start_of_week = startOfWeek;\n\n  /**\n   * @category ISO Week Helpers\n   * @summary Return the start of an ISO week for the given date.\n   *\n   * @description\n   * Return the start of an ISO week for the given date.\n   * The result will be in the local timezone.\n   *\n   * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date\n   *\n   * @param {Date|String|Number} date - the original date\n   * @returns {Date} the start of an ISO week\n   *\n   * @example\n   * // The start of an ISO week for 2 September 2014 11:55:00:\n   * var result = startOfISOWeek(new Date(2014, 8, 2, 11, 55, 0))\n   * //=> Mon Sep 01 2014 00:00:00\n   */\n  function startOfISOWeek (dirtyDate) {\n    return start_of_week(dirtyDate, {weekStartsOn: 1})\n  }\n\n  var start_of_iso_week = startOfISOWeek;\n\n  /**\n   * @category ISO Week-Numbering Year Helpers\n   * @summary Get the ISO week-numbering year of the given date.\n   *\n   * @description\n   * Get the ISO week-numbering year of the given date,\n   * which always starts 3 days before the year's first Thursday.\n   *\n   * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date\n   *\n   * @param {Date|String|Number} date - the given date\n   * @returns {Number} the ISO week-numbering year\n   *\n   * @example\n   * // Which ISO-week numbering year is 2 January 2005?\n   * var result = getISOYear(new Date(2005, 0, 2))\n   * //=> 2004\n   */\n  function getISOYear (dirtyDate) {\n    var date = parse_1(dirtyDate);\n    var year = date.getFullYear();\n\n    var fourthOfJanuaryOfNextYear = new Date(0);\n    fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);\n    fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);\n    var startOfNextYear = start_of_iso_week(fourthOfJanuaryOfNextYear);\n\n    var fourthOfJanuaryOfThisYear = new Date(0);\n    fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);\n    fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);\n    var startOfThisYear = start_of_iso_week(fourthOfJanuaryOfThisYear);\n\n    if (date.getTime() >= startOfNextYear.getTime()) {\n      return year + 1\n    } else if (date.getTime() >= startOfThisYear.getTime()) {\n      return year\n    } else {\n      return year - 1\n    }\n  }\n\n  var get_iso_year = getISOYear;\n\n  /**\n   * @category ISO Week-Numbering Year Helpers\n   * @summary Return the start of an ISO week-numbering year for the given date.\n   *\n   * @description\n   * Return the start of an ISO week-numbering year,\n   * which always starts 3 days before the year's first Thursday.\n   * The result will be in the local timezone.\n   *\n   * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date\n   *\n   * @param {Date|String|Number} date - the original date\n   * @returns {Date} the start of an ISO year\n   *\n   * @example\n   * // The start of an ISO week-numbering year for 2 July 2005:\n   * var result = startOfISOYear(new Date(2005, 6, 2))\n   * //=> Mon Jan 03 2005 00:00:00\n   */\n  function startOfISOYear (dirtyDate) {\n    var year = get_iso_year(dirtyDate);\n    var fourthOfJanuary = new Date(0);\n    fourthOfJanuary.setFullYear(year, 0, 4);\n    fourthOfJanuary.setHours(0, 0, 0, 0);\n    var date = start_of_iso_week(fourthOfJanuary);\n    return date\n  }\n\n  var start_of_iso_year = startOfISOYear;\n\n  var MILLISECONDS_IN_WEEK = 604800000;\n\n  /**\n   * @category ISO Week Helpers\n   * @summary Get the ISO week of the given date.\n   *\n   * @description\n   * Get the ISO week of the given date.\n   *\n   * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date\n   *\n   * @param {Date|String|Number} date - the given date\n   * @returns {Number} the ISO week\n   *\n   * @example\n   * // Which week of the ISO-week numbering year is 2 January 2005?\n   * var result = getISOWeek(new Date(2005, 0, 2))\n   * //=> 53\n   */\n  function getISOWeek (dirtyDate) {\n    var date = parse_1(dirtyDate);\n    var diff = start_of_iso_week(date).getTime() - start_of_iso_year(date).getTime();\n\n    // Round the number of days to the nearest integer\n    // because the number of milliseconds in a week is not constant\n    // (e.g. it's different in the week of the daylight saving time clock shift)\n    return Math.round(diff / MILLISECONDS_IN_WEEK) + 1\n  }\n\n  var get_iso_week = getISOWeek;\n\n  /**\n   * @category Common Helpers\n   * @summary Is the given date valid?\n   *\n   * @description\n   * Returns false if argument is Invalid Date and true otherwise.\n   * Invalid Date is a Date, whose time value is NaN.\n   *\n   * Time value of Date: http://es5.github.io/#x15.9.1.1\n   *\n   * @param {Date} date - the date to check\n   * @returns {Boolean} the date is valid\n   * @throws {TypeError} argument must be an instance of Date\n   *\n   * @example\n   * // For the valid date:\n   * var result = isValid(new Date(2014, 1, 31))\n   * //=> true\n   *\n   * @example\n   * // For the invalid date:\n   * var result = isValid(new Date(''))\n   * //=> false\n   */\n  function isValid (dirtyDate) {\n    if (is_date(dirtyDate)) {\n      return !isNaN(dirtyDate)\n    } else {\n      throw new TypeError(toString.call(dirtyDate) + ' is not an instance of Date')\n    }\n  }\n\n  var is_valid = isValid;\n\n  function buildDistanceInWordsLocale () {\n    var distanceInWordsLocale = {\n      lessThanXSeconds: {\n        one: 'less than a second',\n        other: 'less than {{count}} seconds'\n      },\n\n      xSeconds: {\n        one: '1 second',\n        other: '{{count}} seconds'\n      },\n\n      halfAMinute: 'half a minute',\n\n      lessThanXMinutes: {\n        one: 'less than a minute',\n        other: 'less than {{count}} minutes'\n      },\n\n      xMinutes: {\n        one: '1 minute',\n        other: '{{count}} minutes'\n      },\n\n      aboutXHours: {\n        one: 'about 1 hour',\n        other: 'about {{count}} hours'\n      },\n\n      xHours: {\n        one: '1 hour',\n        other: '{{count}} hours'\n      },\n\n      xDays: {\n        one: '1 day',\n        other: '{{count}} days'\n      },\n\n      aboutXMonths: {\n        one: 'about 1 month',\n        other: 'about {{count}} months'\n      },\n\n      xMonths: {\n        one: '1 month',\n        other: '{{count}} months'\n      },\n\n      aboutXYears: {\n        one: 'about 1 year',\n        other: 'about {{count}} years'\n      },\n\n      xYears: {\n        one: '1 year',\n        other: '{{count}} years'\n      },\n\n      overXYears: {\n        one: 'over 1 year',\n        other: 'over {{count}} years'\n      },\n\n      almostXYears: {\n        one: 'almost 1 year',\n        other: 'almost {{count}} years'\n      }\n    };\n\n    function localize (token, count, options) {\n      options = options || {};\n\n      var result;\n      if (typeof distanceInWordsLocale[token] === 'string') {\n        result = distanceInWordsLocale[token];\n      } else if (count === 1) {\n        result = distanceInWordsLocale[token].one;\n      } else {\n        result = distanceInWordsLocale[token].other.replace('{{count}}', count);\n      }\n\n      if (options.addSuffix) {\n        if (options.comparison > 0) {\n          return 'in ' + result\n        } else {\n          return result + ' ago'\n        }\n      }\n\n      return result\n    }\n\n    return {\n      localize: localize\n    }\n  }\n\n  var build_distance_in_words_locale = buildDistanceInWordsLocale;\n\n  var commonFormatterKeys = [\n    'M', 'MM', 'Q', 'D', 'DD', 'DDD', 'DDDD', 'd',\n    'E', 'W', 'WW', 'YY', 'YYYY', 'GG', 'GGGG',\n    'H', 'HH', 'h', 'hh', 'm', 'mm',\n    's', 'ss', 'S', 'SS', 'SSS',\n    'Z', 'ZZ', 'X', 'x'\n  ];\n\n  function buildFormattingTokensRegExp (formatters) {\n    var formatterKeys = [];\n    for (var key in formatters) {\n      if (formatters.hasOwnProperty(key)) {\n        formatterKeys.push(key);\n      }\n    }\n\n    var formattingTokens = commonFormatterKeys\n      .concat(formatterKeys)\n      .sort()\n      .reverse();\n    var formattingTokensRegExp = new RegExp(\n      '(\\\\[[^\\\\[]*\\\\])|(\\\\\\\\)?' + '(' + formattingTokens.join('|') + '|.)', 'g'\n    );\n\n    return formattingTokensRegExp\n  }\n\n  var build_formatting_tokens_reg_exp = buildFormattingTokensRegExp;\n\n  function buildFormatLocale () {\n    // Note: in English, the names of days of the week and months are capitalized.\n    // If you are making a new locale based on this one, check if the same is true for the language you're working on.\n    // Generally, formatted dates should look like they are in the middle of a sentence,\n    // e.g. in Spanish language the weekdays and months should be in the lowercase.\n    var months3char = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];\n    var monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];\n    var weekdays2char = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];\n    var weekdays3char = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];\n    var weekdaysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];\n    var meridiemUppercase = ['AM', 'PM'];\n    var meridiemLowercase = ['am', 'pm'];\n    var meridiemFull = ['a.m.', 'p.m.'];\n\n    var formatters = {\n      // Month: Jan, Feb, ..., Dec\n      'MMM': function (date) {\n        return months3char[date.getMonth()]\n      },\n\n      // Month: January, February, ..., December\n      'MMMM': function (date) {\n        return monthsFull[date.getMonth()]\n      },\n\n      // Day of week: Su, Mo, ..., Sa\n      'dd': function (date) {\n        return weekdays2char[date.getDay()]\n      },\n\n      // Day of week: Sun, Mon, ..., Sat\n      'ddd': function (date) {\n        return weekdays3char[date.getDay()]\n      },\n\n      // Day of week: Sunday, Monday, ..., Saturday\n      'dddd': function (date) {\n        return weekdaysFull[date.getDay()]\n      },\n\n      // AM, PM\n      'A': function (date) {\n        return (date.getHours() / 12) >= 1 ? meridiemUppercase[1] : meridiemUppercase[0]\n      },\n\n      // am, pm\n      'a': function (date) {\n        return (date.getHours() / 12) >= 1 ? meridiemLowercase[1] : meridiemLowercase[0]\n      },\n\n      // a.m., p.m.\n      'aa': function (date) {\n        return (date.getHours() / 12) >= 1 ? meridiemFull[1] : meridiemFull[0]\n      }\n    };\n\n    // Generate ordinal version of formatters: M -> Mo, D -> Do, etc.\n    var ordinalFormatters = ['M', 'D', 'DDD', 'd', 'Q', 'W'];\n    ordinalFormatters.forEach(function (formatterToken) {\n      formatters[formatterToken + 'o'] = function (date, formatters) {\n        return ordinal(formatters[formatterToken](date))\n      };\n    });\n\n    return {\n      formatters: formatters,\n      formattingTokensRegExp: build_formatting_tokens_reg_exp(formatters)\n    }\n  }\n\n  function ordinal (number) {\n    var rem100 = number % 100;\n    if (rem100 > 20 || rem100 < 10) {\n      switch (rem100 % 10) {\n        case 1:\n          return number + 'st'\n        case 2:\n          return number + 'nd'\n        case 3:\n          return number + 'rd'\n      }\n    }\n    return number + 'th'\n  }\n\n  var build_format_locale = buildFormatLocale;\n\n  /**\n   * @category Locales\n   * @summary English locale.\n   */\n  var en = {\n    distanceInWords: build_distance_in_words_locale(),\n    format: build_format_locale()\n  };\n\n  /**\n   * @category Common Helpers\n   * @summary Format the date.\n   *\n   * @description\n   * Return the formatted date string in the given format.\n   *\n   * Accepted tokens:\n   * | Unit                    | Token | Result examples                  |\n   * |-------------------------|-------|----------------------------------|\n   * | Month                   | M     | 1, 2, ..., 12                    |\n   * |                         | Mo    | 1st, 2nd, ..., 12th              |\n   * |                         | MM    | 01, 02, ..., 12                  |\n   * |                         | MMM   | Jan, Feb, ..., Dec               |\n   * |                         | MMMM  | January, February, ..., December |\n   * | Quarter                 | Q     | 1, 2, 3, 4                       |\n   * |                         | Qo    | 1st, 2nd, 3rd, 4th               |\n   * | Day of month            | D     | 1, 2, ..., 31                    |\n   * |                         | Do    | 1st, 2nd, ..., 31st              |\n   * |                         | DD    | 01, 02, ..., 31                  |\n   * | Day of year             | DDD   | 1, 2, ..., 366                   |\n   * |                         | DDDo  | 1st, 2nd, ..., 366th             |\n   * |                         | DDDD  | 001, 002, ..., 366               |\n   * | Day of week             | d     | 0, 1, ..., 6                     |\n   * |                         | do    | 0th, 1st, ..., 6th               |\n   * |                         | dd    | Su, Mo, ..., Sa                  |\n   * |                         | ddd   | Sun, Mon, ..., Sat               |\n   * |                         | dddd  | Sunday, Monday, ..., Saturday    |\n   * | Day of ISO week         | E     | 1, 2, ..., 7                     |\n   * | ISO week                | W     | 1, 2, ..., 53                    |\n   * |                         | Wo    | 1st, 2nd, ..., 53rd              |\n   * |                         | WW    | 01, 02, ..., 53                  |\n   * | Year                    | YY    | 00, 01, ..., 99                  |\n   * |                         | YYYY  | 1900, 1901, ..., 2099            |\n   * | ISO week-numbering year | GG    | 00, 01, ..., 99                  |\n   * |                         | GGGG  | 1900, 1901, ..., 2099            |\n   * | AM/PM                   | A     | AM, PM                           |\n   * |                         | a     | am, pm                           |\n   * |                         | aa    | a.m., p.m.                       |\n   * | Hour                    | H     | 0, 1, ... 23                     |\n   * |                         | HH    | 00, 01, ... 23                   |\n   * |                         | h     | 1, 2, ..., 12                    |\n   * |                         | hh    | 01, 02, ..., 12                  |\n   * | Minute                  | m     | 0, 1, ..., 59                    |\n   * |                         | mm    | 00, 01, ..., 59                  |\n   * | Second                  | s     | 0, 1, ..., 59                    |\n   * |                         | ss    | 00, 01, ..., 59                  |\n   * | 1/10 of second          | S     | 0, 1, ..., 9                     |\n   * | 1/100 of second         | SS    | 00, 01, ..., 99                  |\n   * | Millisecond             | SSS   | 000, 001, ..., 999               |\n   * | Timezone                | Z     | -01:00, +00:00, ... +12:00       |\n   * |                         | ZZ    | -0100, +0000, ..., +1200         |\n   * | Seconds timestamp       | X     | 512969520                        |\n   * | Milliseconds timestamp  | x     | 512969520900                     |\n   *\n   * The characters wrapped in square brackets are escaped.\n   *\n   * The result may vary by locale.\n   *\n   * @param {Date|String|Number} date - the original date\n   * @param {String} [format='YYYY-MM-DDTHH:mm:ss.SSSZ'] - the string of tokens\n   * @param {Object} [options] - the object with options\n   * @param {Object} [options.locale=enLocale] - the locale object\n   * @returns {String} the formatted date string\n   *\n   * @example\n   * // Represent 11 February 2014 in middle-endian format:\n   * var result = format(\n   *   new Date(2014, 1, 11),\n   *   'MM/DD/YYYY'\n   * )\n   * //=> '02/11/2014'\n   *\n   * @example\n   * // Represent 2 July 2014 in Esperanto:\n   * var eoLocale = require('date-fns/locale/eo')\n   * var result = format(\n   *   new Date(2014, 6, 2),\n   *   'Do [de] MMMM YYYY',\n   *   {locale: eoLocale}\n   * )\n   * //=> '2-a de julio 2014'\n   */\n  function format (dirtyDate, dirtyFormatStr, dirtyOptions) {\n    var formatStr = dirtyFormatStr ? String(dirtyFormatStr) : 'YYYY-MM-DDTHH:mm:ss.SSSZ';\n    var options = dirtyOptions || {};\n\n    var locale = options.locale;\n    var localeFormatters = en.format.formatters;\n    var formattingTokensRegExp = en.format.formattingTokensRegExp;\n    if (locale && locale.format && locale.format.formatters) {\n      localeFormatters = locale.format.formatters;\n\n      if (locale.format.formattingTokensRegExp) {\n        formattingTokensRegExp = locale.format.formattingTokensRegExp;\n      }\n    }\n\n    var date = parse_1(dirtyDate);\n\n    if (!is_valid(date)) {\n      return 'Invalid Date'\n    }\n\n    var formatFn = buildFormatFn(formatStr, localeFormatters, formattingTokensRegExp);\n\n    return formatFn(date)\n  }\n\n  var formatters = {\n    // Month: 1, 2, ..., 12\n    'M': function (date) {\n      return date.getMonth() + 1\n    },\n\n    // Month: 01, 02, ..., 12\n    'MM': function (date) {\n      return addLeadingZeros(date.getMonth() + 1, 2)\n    },\n\n    // Quarter: 1, 2, 3, 4\n    'Q': function (date) {\n      return Math.ceil((date.getMonth() + 1) / 3)\n    },\n\n    // Day of month: 1, 2, ..., 31\n    'D': function (date) {\n      return date.getDate()\n    },\n\n    // Day of month: 01, 02, ..., 31\n    'DD': function (date) {\n      return addLeadingZeros(date.getDate(), 2)\n    },\n\n    // Day of year: 1, 2, ..., 366\n    'DDD': function (date) {\n      return get_day_of_year(date)\n    },\n\n    // Day of year: 001, 002, ..., 366\n    'DDDD': function (date) {\n      return addLeadingZeros(get_day_of_year(date), 3)\n    },\n\n    // Day of week: 0, 1, ..., 6\n    'd': function (date) {\n      return date.getDay()\n    },\n\n    // Day of ISO week: 1, 2, ..., 7\n    'E': function (date) {\n      return date.getDay() || 7\n    },\n\n    // ISO week: 1, 2, ..., 53\n    'W': function (date) {\n      return get_iso_week(date)\n    },\n\n    // ISO week: 01, 02, ..., 53\n    'WW': function (date) {\n      return addLeadingZeros(get_iso_week(date), 2)\n    },\n\n    // Year: 00, 01, ..., 99\n    'YY': function (date) {\n      return addLeadingZeros(date.getFullYear(), 4).substr(2)\n    },\n\n    // Year: 1900, 1901, ..., 2099\n    'YYYY': function (date) {\n      return addLeadingZeros(date.getFullYear(), 4)\n    },\n\n    // ISO week-numbering year: 00, 01, ..., 99\n    'GG': function (date) {\n      return String(get_iso_year(date)).substr(2)\n    },\n\n    // ISO week-numbering year: 1900, 1901, ..., 2099\n    'GGGG': function (date) {\n      return get_iso_year(date)\n    },\n\n    // Hour: 0, 1, ... 23\n    'H': function (date) {\n      return date.getHours()\n    },\n\n    // Hour: 00, 01, ..., 23\n    'HH': function (date) {\n      return addLeadingZeros(date.getHours(), 2)\n    },\n\n    // Hour: 1, 2, ..., 12\n    'h': function (date) {\n      var hours = date.getHours();\n      if (hours === 0) {\n        return 12\n      } else if (hours > 12) {\n        return hours % 12\n      } else {\n        return hours\n      }\n    },\n\n    // Hour: 01, 02, ..., 12\n    'hh': function (date) {\n      return addLeadingZeros(formatters['h'](date), 2)\n    },\n\n    // Minute: 0, 1, ..., 59\n    'm': function (date) {\n      return date.getMinutes()\n    },\n\n    // Minute: 00, 01, ..., 59\n    'mm': function (date) {\n      return addLeadingZeros(date.getMinutes(), 2)\n    },\n\n    // Second: 0, 1, ..., 59\n    's': function (date) {\n      return date.getSeconds()\n    },\n\n    // Second: 00, 01, ..., 59\n    'ss': function (date) {\n      return addLeadingZeros(date.getSeconds(), 2)\n    },\n\n    // 1/10 of second: 0, 1, ..., 9\n    'S': function (date) {\n      return Math.floor(date.getMilliseconds() / 100)\n    },\n\n    // 1/100 of second: 00, 01, ..., 99\n    'SS': function (date) {\n      return addLeadingZeros(Math.floor(date.getMilliseconds() / 10), 2)\n    },\n\n    // Millisecond: 000, 001, ..., 999\n    'SSS': function (date) {\n      return addLeadingZeros(date.getMilliseconds(), 3)\n    },\n\n    // Timezone: -01:00, +00:00, ... +12:00\n    'Z': function (date) {\n      return formatTimezone(date.getTimezoneOffset(), ':')\n    },\n\n    // Timezone: -0100, +0000, ... +1200\n    'ZZ': function (date) {\n      return formatTimezone(date.getTimezoneOffset())\n    },\n\n    // Seconds timestamp: 512969520\n    'X': function (date) {\n      return Math.floor(date.getTime() / 1000)\n    },\n\n    // Milliseconds timestamp: 512969520900\n    'x': function (date) {\n      return date.getTime()\n    }\n  };\n\n  function buildFormatFn (formatStr, localeFormatters, formattingTokensRegExp) {\n    var array = formatStr.match(formattingTokensRegExp);\n    var length = array.length;\n\n    var i;\n    var formatter;\n    for (i = 0; i < length; i++) {\n      formatter = localeFormatters[array[i]] || formatters[array[i]];\n      if (formatter) {\n        array[i] = formatter;\n      } else {\n        array[i] = removeFormattingTokens(array[i]);\n      }\n    }\n\n    return function (date) {\n      var output = '';\n      for (var i = 0; i < length; i++) {\n        if (array[i] instanceof Function) {\n          output += array[i](date, formatters);\n        } else {\n          output += array[i];\n        }\n      }\n      return output\n    }\n  }\n\n  function removeFormattingTokens (input) {\n    if (input.match(/\\[[\\s\\S]/)) {\n      return input.replace(/^\\[|]$/g, '')\n    }\n    return input.replace(/\\\\/g, '')\n  }\n\n  function formatTimezone (offset, delimeter) {\n    delimeter = delimeter || '';\n    var sign = offset > 0 ? '-' : '+';\n    var absOffset = Math.abs(offset);\n    var hours = Math.floor(absOffset / 60);\n    var minutes = absOffset % 60;\n    return sign + addLeadingZeros(hours, 2) + delimeter + addLeadingZeros(minutes, 2)\n  }\n\n  function addLeadingZeros (number, targetLength) {\n    var output = Math.abs(number).toString();\n    while (output.length < targetLength) {\n      output = '0' + output;\n    }\n    return output\n  }\n\n  var format_1 = format;\n\n  function formatNumber(n) {\n    var digits = String(n).split('');\n    var groups = [];\n\n    while (digits.length) {\n      groups.unshift(digits.splice(-3).join(''));\n    }\n\n    return groups.join(',');\n  }\n  function formatPercent(n, decimals) {\n    if (decimals === void 0) {\n      decimals = 1;\n    }\n\n    return (n * 100).toPrecision(decimals + 2);\n  }\n\n  var fontSans = \"\\nfont-family: -apple-system,\\n  BlinkMacSystemFont,\\n  \\\"Segoe UI\\\",\\n  \\\"Roboto\\\",\\n  \\\"Oxygen\\\",\\n  \\\"Ubuntu\\\",\\n  \\\"Cantarell\\\",\\n  \\\"Fira Sans\\\",\\n  \\\"Droid Sans\\\",\\n  \\\"Helvetica Neue\\\",\\n  sans-serif;\\n\";\n  var fontMono = \"\\nfont-family: Menlo,\\n  Monaco,\\n  Lucida Console,\\n  Liberation Mono,\\n  DejaVu Sans Mono,\\n  Bitstream Vera Sans Mono,\\n  Courier New,\\n  monospace;\\n\";\n\n  var DefaultContext = {\n    color: undefined,\n    size: undefined,\n    className: undefined,\n    style: undefined,\n    attr: undefined\n  };\n  var IconContext = React.createContext && React.createContext(DefaultContext);\n\n  var __assign = window && window.__assign || function () {\n    __assign = Object.assign || function (t) {\n      for (var s, i = 1, n = arguments.length; i < n; i++) {\n        s = arguments[i];\n\n        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];\n      }\n\n      return t;\n    };\n\n    return __assign.apply(this, arguments);\n  };\n\n  var __rest = window && window.__rest || function (s, e) {\n    var t = {};\n\n    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];\n\n    if (s != null && typeof Object.getOwnPropertySymbols === \"function\") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]];\n    return t;\n  };\n\n  function Tree2Element(tree) {\n    return tree && tree.map(function (node, i) {\n      return React.createElement(node.tag, Object.assign({\n        key: i\n      }, node.attr), Tree2Element(node.child));\n    });\n  }\n\n  function GenIcon(data) {\n    return function (props) {\n      return React.createElement(IconBase, Object.assign({\n        attr: Object.assign({}, data.attr)\n      }, props), Tree2Element(data.child));\n    };\n  }\n  function IconBase(props) {\n    var elem = function (conf) {\n      var computedSize = props.size || conf.size || \"1em\";\n      var className;\n      if (conf.className) className = conf.className;\n      if (props.className) className = (className ? className + ' ' : '') + props.className;\n\n      var attr = props.attr,\n          title = props.title,\n          svgProps = __rest(props, [\"attr\", \"title\"]);\n\n      return React.createElement(\"svg\", Object.assign({\n        stroke: \"currentColor\",\n        fill: \"currentColor\",\n        strokeWidth: \"0\"\n      }, conf.attr, attr, svgProps, {\n        className: className,\n        style: Object.assign({\n          color: props.color || conf.color\n        }, conf.style, props.style),\n        height: computedSize,\n        width: computedSize,\n        xmlns: \"http://www.w3.org/2000/svg\"\n      }), title && React.createElement(\"title\", null, title), props.children);\n    };\n\n    return IconContext !== undefined ? React.createElement(IconContext.Consumer, null, function (conf) {\n      return elem(conf);\n    }) : elem(DefaultContext);\n  }\n\n  // THIS FILE IS AUTO GENERATED\n  var FaGithub = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 496 512\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"d\":\"M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z\"}}]})(props);\n  };\n  FaGithub.displayName = \"FaGithub\";\n  var FaTwitter = function (props) {\n    return GenIcon({\"tag\":\"svg\",\"attr\":{\"viewBox\":\"0 0 512 512\"},\"child\":[{\"tag\":\"path\",\"attr\":{\"d\":\"M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z\"}}]})(props);\n  };\n  FaTwitter.displayName = \"FaTwitter\";\n\n  function createIcon(Type, _ref) {\n    var css = _ref.css,\n        rest = _objectWithoutPropertiesLoose(_ref, [\"css\"]);\n\n    return core.jsx(Type, Object.assign({\n      css: Object.assign({}, css, {\n        verticalAlign: 'text-bottom'\n      })\n    }, rest));\n  }\n\n  function TwitterIcon(props) {\n    return createIcon(FaTwitter, props);\n  }\n  function GitHubIcon(props) {\n    return createIcon(FaGithub, props);\n  }\n\n  var CloudflareLogo = \"/_client/46bc46bc8accec6a.png\";\n\n  var FlyLogo = \"/_client/b870d5fb04d2854d.png\";\n\n  function _templateObject() {\n    var data = _taggedTemplateLiteralLoose([\"\\n  html {\\n    box-sizing: border-box;\\n  }\\n  *,\\n  *:before,\\n  *:after {\\n    box-sizing: inherit;\\n  }\\n\\n  html,\\n  body,\\n  #root {\\n    height: 100%;\\n    margin: 0;\\n  }\\n\\n  body {\\n    \", \"\\n    font-size: 16px;\\n    line-height: 1.5;\\n    overflow-wrap: break-word;\\n    background: white;\\n    color: black;\\n  }\\n\\n  code {\\n    \", \"\\n    font-size: 1rem;\\n    padding: 0 3px;\\n    background-color: #eee;\\n  }\\n\\n  dd,\\n  ul {\\n    margin-left: 0;\\n    padding-left: 25px;\\n  }\\n\"]);\n\n    _templateObject = function _templateObject() {\n      return data;\n    };\n\n    return data;\n  }\n  var buildId = \"af8c8db\";\n  var globalStyles = core.css(_templateObject(), fontSans, fontMono);\n\n  function Link(props) {\n    return (// eslint-disable-next-line jsx-a11y/anchor-has-content\n      core.jsx(\"a\", Object.assign({}, props, {\n        css: {\n          color: '#0076ff',\n          textDecoration: 'none',\n          ':hover': {\n            textDecoration: 'underline'\n          }\n        }\n      }))\n    );\n  }\n\n  function AboutLogo(_ref) {\n    var children = _ref.children;\n    return core.jsx(\"div\", {\n      css: {\n        textAlign: 'center',\n        flex: '1'\n      }\n    }, children);\n  }\n\n  function AboutLogoImage(props) {\n    // eslint-disable-next-line jsx-a11y/alt-text\n    return core.jsx(\"img\", Object.assign({}, props, {\n      css: {\n        maxWidth: '90%'\n      }\n    }));\n  }\n\n  function Stats(_ref2) {\n    var data = _ref2.data;\n    var totals = data.totals;\n    var since = parse_1(totals.since);\n    var until = parse_1(totals.until);\n    return core.jsx(\"p\", null, \"From \", core.jsx(\"strong\", null, format_1(since, 'MMM D')), \" to\", ' ', core.jsx(\"strong\", null, format_1(until, 'MMM D')), \" unpkg served\", ' ', core.jsx(\"strong\", null, formatNumber(totals.requests.all)), \" requests and a total of \", core.jsx(\"strong\", null, prettyBytes(totals.bandwidth.all)), \" of data to\", ' ', core.jsx(\"strong\", null, formatNumber(totals.uniques.all)), \" unique visitors,\", ' ', core.jsx(\"strong\", null, formatPercent(totals.requests.cached / totals.requests.all, 2), \"%\"), ' ', \"of which were served from the cache.\");\n  }\n\n  function App() {\n    var _useState = React.useState(typeof window === 'object' && window.localStorage && window.localStorage.savedStats ? JSON.parse(window.localStorage.savedStats) : null),\n        stats = _useState[0],\n        setStats = _useState[1];\n\n    var hasStats = !!(stats && !stats.error);\n    var stringStats = JSON.stringify(stats);\n    React.useEffect(function () {\n      window.localStorage.savedStats = stringStats;\n    }, [stringStats]);\n    React.useEffect(function () {\n      fetch('/api/stats?period=last-month').then(function (res) {\n        return res.json();\n      }).then(setStats);\n    }, []);\n    return core.jsx(React.Fragment, null, core.jsx(core.Global, {\n      styles: globalStyles\n    }), core.jsx(\"div\", {\n      css: {\n        maxWidth: 740,\n        margin: '0 auto'\n      }\n    }, core.jsx(\"div\", {\n      css: {\n        padding: '0 20px'\n      }\n    }, core.jsx(\"header\", null, core.jsx(\"h1\", {\n      css: {\n        textAlign: 'center',\n        fontSize: '4.5em',\n        letterSpacing: '0.05em',\n        '@media (min-width: 700px)': {\n          marginTop: '1.5em'\n        }\n      }\n    }, \"UNPKG\"), core.jsx(\"p\", null, \"unpkg is a fast, global content delivery network for everything on\", ' ', core.jsx(Link, {\n      href: \"https://www.npmjs.com/\"\n    }, \"npm\"), \". Use it to quickly and easily load any file from any package using a URL like:\"), core.jsx(\"div\", {\n      css: {\n        textAlign: 'center',\n        backgroundColor: '#eee',\n        margin: '2em 0',\n        padding: '5px 0'\n      }\n    }, \"unpkg.com/:package@:version/:file\"), hasStats && core.jsx(Stats, {\n      data: stats\n    })), core.jsx(\"h3\", {\n      css: {\n        fontSize: '1.6em'\n      },\n      id: \"examples\"\n    }, \"Examples\"), core.jsx(\"p\", null, \"Using a fixed version:\"), core.jsx(\"ul\", null, core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/react@16.7.0/umd/react.production.min.js\"\n    }, \"unpkg.com/react@16.7.0/umd/react.production.min.js\")), core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/react-dom@16.7.0/umd/react-dom.production.min.js\"\n    }, \"unpkg.com/react-dom@16.7.0/umd/react-dom.production.min.js\"))), core.jsx(\"p\", null, \"You may also use a\", ' ', core.jsx(Link, {\n      href: \"https://docs.npmjs.com/about-semantic-versioning\"\n    }, \"semver range\"), ' ', \"or a \", core.jsx(Link, {\n      href: \"https://docs.npmjs.com/cli/dist-tag\"\n    }, \"tag\"), ' ', \"instead of a fixed version number, or omit the version/tag entirely to use the \", core.jsx(\"code\", null, \"latest\"), \" tag.\"), core.jsx(\"ul\", null, core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/react@^16/umd/react.production.min.js\"\n    }, \"unpkg.com/react@^16/umd/react.production.min.js\")), core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/react/umd/react.production.min.js\"\n    }, \"unpkg.com/react/umd/react.production.min.js\"))), core.jsx(\"p\", null, \"If you omit the file path (i.e. use a \\u201Cbare\\u201D URL), unpkg will serve the file specified by the \", core.jsx(\"code\", null, \"unpkg\"), \" field in\", ' ', core.jsx(\"code\", null, \"package.json\"), \", or fall back to \", core.jsx(\"code\", null, \"main\"), \".\"), core.jsx(\"ul\", null, core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/jquery\"\n    }, \"unpkg.com/jquery\")), core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/three\"\n    }, \"unpkg.com/three\"))), core.jsx(\"p\", null, \"Append a \", core.jsx(\"code\", null, \"/\"), \" at the end of a URL to view a listing of all the files in a package.\"), core.jsx(\"ul\", null, core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/react/\"\n    }, \"unpkg.com/react/\")), core.jsx(\"li\", null, core.jsx(Link, {\n      href: \"/react-router/\"\n    }, \"unpkg.com/react-router/\"))), core.jsx(\"h3\", {\n      css: {\n        fontSize: '1.6em'\n      },\n      id: \"query-params\"\n    }, \"Query Parameters\"), core.jsx(\"dl\", null, core.jsx(\"dt\", null, core.jsx(\"code\", null, \"?meta\")), core.jsx(\"dd\", null, \"Return metadata about any file in a package as JSON (e.g.\", core.jsx(\"code\", null, \"/any/file?meta\"), \")\"), core.jsx(\"dt\", null, core.jsx(\"code\", null, \"?module\")), core.jsx(\"dd\", null, \"Expands all\", ' ', core.jsx(Link, {\n      href: \"https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier\"\n    }, \"\\u201Cbare\\u201D \", core.jsx(\"code\", null, \"import\"), \" specifiers\"), ' ', \"in JavaScript modules to unpkg URLs. This feature is\", ' ', core.jsx(\"em\", null, \"very experimental\"))), core.jsx(\"h3\", {\n      css: {\n        fontSize: '1.6em'\n      },\n      id: \"cache-behavior\"\n    }, \"Cache Behavior\"), core.jsx(\"p\", null, \"The CDN caches files based on their permanent URL, which includes the npm package version. This works because npm does not allow package authors to overwrite a package that has already been published with a different one at the same version number.\"), core.jsx(\"p\", null, \"Browsers are instructed (via the \", core.jsx(\"code\", null, \"Cache-Control\"), \" header) to cache assets indefinitely (1 year).\"), core.jsx(\"p\", null, \"URLs that do not specify a package version number redirect to one that does. This is the \", core.jsx(\"code\", null, \"latest\"), \" version when no version is specified, or the \", core.jsx(\"code\", null, \"maxSatisfying\"), \" version when a\", ' ', core.jsx(Link, {\n      href: \"https://github.com/npm/node-semver\"\n    }, \"semver version\"), ' ', \"is given. Redirects are cached for 10 minutes at the CDN, 1 minute in browsers.\"), core.jsx(\"p\", null, \"If you want users to be able to use the latest version when you cut a new release, the best policy is to put the version number in the URL directly in your installation instructions. This will also load more quickly because we won't have to resolve the latest version and redirect them.\"), core.jsx(\"h3\", {\n      css: {\n        fontSize: '1.6em'\n      },\n      id: \"workflow\"\n    }, \"Workflow\"), core.jsx(\"p\", null, \"For npm package authors, unpkg relieves the burden of publishing your code to a CDN in addition to the npm registry. All you need to do is include your\", ' ', core.jsx(Link, {\n      href: \"https://github.com/umdjs/umd\"\n    }, \"UMD\"), \" build in your npm package (not your repo, that's different!).\"), core.jsx(\"p\", null, \"You can do this easily using the following setup:\"), core.jsx(\"ul\", null, core.jsx(\"li\", null, \"Add the \", core.jsx(\"code\", null, \"umd\"), \" (or \", core.jsx(\"code\", null, \"dist\"), \") directory to your\", ' ', core.jsx(\"code\", null, \".gitignore\"), \" file\"), core.jsx(\"li\", null, \"Add the \", core.jsx(\"code\", null, \"umd\"), \" directory to your\", ' ', core.jsx(Link, {\n      href: \"https://docs.npmjs.com/files/package.json#files\"\n    }, \"files array\"), ' ', \"in \", core.jsx(\"code\", null, \"package.json\")), core.jsx(\"li\", null, \"Use a build script to generate your UMD build in the\", ' ', core.jsx(\"code\", null, \"umd\"), \" directory when you publish\")), core.jsx(\"p\", null, \"That's it! Now when you \", core.jsx(\"code\", null, \"npm publish\"), \" you'll have a version available on unpkg as well.\"), core.jsx(\"h3\", {\n      css: {\n        fontSize: '1.6em'\n      },\n      id: \"about\"\n    }, \"About\"), core.jsx(\"p\", null, \"unpkg is an\", ' ', core.jsx(Link, {\n      href: \"https://github.com/mjackson/unpkg\"\n    }, \"open source\"), ' ', \"project built and maintained by\", ' ', core.jsx(Link, {\n      href: \"https://twitter.com/mjackson\"\n    }, \"Michael Jackson\"), \". unpkg is not affiliated with or supported by npm, Inc. in any way. Please do not contact npm for help with unpkg. Instead, please reach out to \", core.jsx(Link, {\n      href: \"https://twitter.com/unpkg\"\n    }, \"@unpkg\"), \" with any questions or concerns.\"), core.jsx(\"p\", null, \"The unpkg CDN is powered by\", ' ', core.jsx(Link, {\n      href: \"https://www.cloudflare.com\"\n    }, \"Cloudflare\"), \", one of the world's largest and fastest cloud network platforms.\", ' ', hasStats && core.jsx(\"span\", null, \"In the past month, Cloudflare served over\", ' ', core.jsx(\"strong\", null, prettyBytes(stats.totals.bandwidth.all)), \" to\", ' ', core.jsx(\"strong\", null, formatNumber(stats.totals.uniques.all)), \" unique unpkg users all over the world.\")), core.jsx(\"div\", {\n      css: {\n        margin: '4em 0',\n        display: 'flex',\n        justifyContent: 'center'\n      }\n    }, core.jsx(AboutLogo, null, core.jsx(\"a\", {\n      href: \"https://www.cloudflare.com\"\n    }, core.jsx(AboutLogoImage, {\n      alt: \"Cloudflare\",\n      src: CloudflareLogo,\n      height: \"100\"\n    })))), core.jsx(\"p\", null, \"The origin server runs on auto-scaling infrastructure provided by\", ' ', core.jsx(Link, {\n      href: \"https://fly.io/\"\n    }, \"Fly.io\"), \". The app servers run in 17 cities around the world, and come and go based on active requests.\"), core.jsx(\"div\", {\n      css: {\n        margin: '4em 0 0',\n        display: 'flex',\n        justifyContent: 'center'\n      }\n    }, core.jsx(AboutLogo, null, core.jsx(\"a\", {\n      href: \"https://fly.io\"\n    }, core.jsx(AboutLogoImage, {\n      alt: \"Fly.io\",\n      src: FlyLogo,\n      width: \"320\"\n    })))))), core.jsx(\"footer\", {\n      css: {\n        marginTop: '5rem',\n        background: 'black',\n        color: '#aaa'\n      }\n    }, core.jsx(\"div\", {\n      css: {\n        maxWidth: 740,\n        padding: '10px 20px',\n        margin: '0 auto',\n        display: 'flex',\n        flexDirection: 'row',\n        alignItems: 'center',\n        justifyContent: 'space-between'\n      }\n    }, core.jsx(\"p\", null, core.jsx(\"span\", null, \"Build: \", buildId)), core.jsx(\"p\", null, core.jsx(\"span\", null, \"\\xA9 \", new Date().getFullYear(), \" UNPKG\")), core.jsx(\"p\", {\n      css: {\n        fontSize: '1.5rem'\n      }\n    }, core.jsx(\"a\", {\n      href: \"https://twitter.com/unpkg\",\n      css: {\n        color: '#aaa',\n        display: 'inline-block',\n        ':hover': {\n          color: 'white'\n        }\n      }\n    }, core.jsx(TwitterIcon, null)), core.jsx(\"a\", {\n      href: \"https://github.com/mjackson/unpkg\",\n      css: {\n        color: '#aaa',\n        display: 'inline-block',\n        marginLeft: '1rem',\n        ':hover': {\n          color: 'white'\n        }\n      }\n    }, core.jsx(GitHubIcon, null))))));\n  }\n\n  {\n    App.propTypes = {\n      location: propTypes.object,\n      children: propTypes.node\n    };\n  }\n\n  ReactDOM.render(React__default.createElement(App, null), document.getElementById('root'));\n\n}(React, ReactDOM, emotionCore));\n"}]}];

// Virtual module id; see rollup.config.js

function getEntryPoint(name, format) {
  for (let manifest of entryManifest) {
    let bundles = manifest[name];

    if (bundles) {
      return bundles.find(b => b.format === format);
    }
  }

  return null;
}

function getGlobalScripts(entryPoint, globalURLs) {
  return entryPoint.globalImports.map(id => {
    if (process.env.NODE_ENV !== 'production') {
      if (!globalURLs[id]) {
        throw new Error('Missing global URL for id "%s"', id);
      }
    }

    return React.createElement('script', {
      src: globalURLs[id]
    });
  });
}

function getScripts(entryName, format, globalURLs) {
  const entryPoint = getEntryPoint(entryName, format);
  if (!entryPoint) return [];
  return getGlobalScripts(entryPoint, globalURLs).concat( // Inline the code for this entry point into the page
  // itself instead of using another <script> tag
  createScript(entryPoint.code));
}

const doctype = '<!DOCTYPE html>';
const globalURLs = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging' ? {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.production.min.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.production.min.js'
} : {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.development.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.development.js'
};

function byVersion(a, b) {
  return semver.lt(a, b) ? -1 : semver.gt(a, b) ? 1 : 0;
}

async function getAvailableVersions(packageName, log) {
  const versionsAndTags = await getVersionsAndTags(packageName, log);
  return versionsAndTags ? versionsAndTags.versions.sort(byVersion) : [];
}

async function serveBrowsePage(req, res) {
  const availableVersions = await getAvailableVersions(req.packageName, req.log);
  const data = {
    packageName: req.packageName,
    packageVersion: req.packageVersion,
    availableVersions: availableVersions,
    filename: req.filename,
    target: req.browseTarget
  };
  const content = createHTML$1(server$1.renderToString(React.createElement(App, data)));
  const elements = getScripts('browse', 'iife', globalURLs);
  const html = doctype + server$1.renderToStaticMarkup(React.createElement(MainTemplate, {
    title: `UNPKG - ${req.packageName}`,
    description: `The CDN for ${req.packageName}`,
    data,
    content,
    elements
  }));
  res.set({
    'Cache-Control': 'public, max-age=14400',
    // 4 hours
    'Cache-Tag': 'browse'
  }).send(html);
}

var serveBrowsePage$1 = asyncHandler(serveBrowsePage);

async function findMatchingEntries(stream, filename) {
  // filename = /some/dir/name
  return new Promise((accept, reject) => {
    const entries = {};
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Dynamically create "directory" entries for all subdirectories
      // in this entry's path. Some tarballs omit directory entries for
      // some reason, so this is the "brute force" method.

      let dir = path.dirname(entry.path);

      while (dir !== '/') {
        if (!entries[dir] && path.dirname(dir) === filename) {
          entries[dir] = {
            path: dir,
            type: 'directory'
          };
        }

        dir = path.dirname(dir);
      } // Ignore non-files and files that aren't in this directory.


      if (entry.type !== 'file' || path.dirname(entry.path) !== filename) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.size = content.length;
        entries[entry.path] = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(entries);
    });
  });
}

async function serveDirectoryBrowser(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const filename = req.filename.slice(0, -1) || '/';
  const entries = await findMatchingEntries(stream, filename);

  if (Object.keys(entries).length === 0) {
    return res.status(404).send(`Not found: ${req.packageSpec}${req.filename}`);
  }

  req.browseTarget = {
    path: filename,
    type: 'directory',
    details: entries
  };
  serveBrowsePage$1(req, res);
}

var serveDirectoryBrowser$1 = asyncHandler(serveDirectoryBrowser);

async function findMatchingEntries$1(stream, filename) {
  // filename = /some/dir/name
  return new Promise((accept, reject) => {
    const entries = {};
    entries[filename] = {
      path: filename,
      type: 'directory'
    };
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Dynamically create "directory" entries for all subdirectories
      // in this entry's path. Some tarballs omit directory entries for
      // some reason, so this is the "brute force" method.

      let dir = path.dirname(entry.path);

      while (dir !== '/') {
        if (!entries[dir] && dir.startsWith(filename)) {
          entries[dir] = {
            path: dir,
            type: 'directory'
          };
        }

        dir = path.dirname(dir);
      } // Ignore non-files and files that don't match the prefix.


      if (entry.type !== 'file' || !entry.path.startsWith(filename)) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.lastModified = header.mtime.toUTCString();
        entry.size = content.length;
        entries[entry.path] = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(entries);
    });
  });
}

function getMatchingEntries(entry, entries) {
  return Object.keys(entries).filter(key => entry.path !== key && path.dirname(key) === entry.path).map(key => entries[key]);
}

function getMetadata(entry, entries) {
  const metadata = {
    path: entry.path,
    type: entry.type
  };

  if (entry.type === 'file') {
    metadata.contentType = entry.contentType;
    metadata.integrity = entry.integrity;
    metadata.lastModified = entry.lastModified;
    metadata.size = entry.size;
  } else if (entry.type === 'directory') {
    metadata.files = getMatchingEntries(entry, entries).map(e => getMetadata(e, entries));
  }

  return metadata;
}

async function serveDirectoryMetadata(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const filename = req.filename.slice(0, -1) || '/';
  const entries = await findMatchingEntries$1(stream, filename);
  const metadata = getMetadata(entries[filename], entries);
  res.send(metadata);
}

var serveDirectoryMetadata$1 = asyncHandler(serveDirectoryMetadata);

function createDataURI(contentType, content) {
  return `data:${contentType};base64,${content.toString('base64')}`;
}

function escapeHTML(code) {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
} // These should probably be added to highlight.js auto-detection.


const extLanguages = {
  map: 'json',
  mjs: 'javascript',
  tsbuildinfo: 'json',
  tsx: 'typescript',
  txt: 'text',
  vue: 'html'
};

function getLanguage(file) {
  // Try to guess the language based on the file extension.
  const ext = path.extname(file).substr(1);

  if (ext) {
    return extLanguages[ext] || ext;
  }

  const contentType = getContentType(file);

  if (contentType === 'text/plain') {
    return 'text';
  }

  return null;
}

function getLines(code) {
  return code.split('\n').map((line, index, array) => index === array.length - 1 ? line : line + '\n');
}
/**
 * Returns an array of HTML strings that highlight the given source code.
 */


function getHighlights(code, file) {
  const language = getLanguage(file);

  if (!language) {
    return null;
  }

  if (language === 'text') {
    return getLines(code).map(escapeHTML);
  }

  try {
    let continuation = false;
    const hi = getLines(code).map(line => {
      const result = hljs.highlight(language, line, false, continuation);
      continuation = result.top;
      return result;
    });
    return hi.map(result => result.value.replace(/<span class="hljs-(\w+)">/g, '<span class="code-$1">'));
  } catch (error) {
    // Probably an "unknown language" error.
    // console.error(error);
    return null;
  }
}

const contentTypeNames = {
  'application/javascript': 'JavaScript',
  'application/json': 'JSON',
  'application/octet-stream': 'Binary',
  'application/vnd.ms-fontobject': 'Embedded OpenType',
  'application/xml': 'XML',
  'image/svg+xml': 'SVG',
  'font/ttf': 'TrueType Font',
  'font/woff': 'WOFF',
  'font/woff2': 'WOFF2',
  'text/css': 'CSS',
  'text/html': 'HTML',
  'text/jsx': 'JSX',
  'text/markdown': 'Markdown',
  'text/plain': 'Plain Text',
  'text/x-scss': 'SCSS',
  'text/yaml': 'YAML'
};
/**
 * Gets a human-friendly name for whatever is in the given file.
 */

function getLanguageName(file) {
  // Content-Type is text/plain, but we can be more descriptive.
  if (/\.flow$/.test(file)) return 'Flow';
  if (/\.(d\.ts|tsx)$/.test(file)) return 'TypeScript'; // Content-Type is application/json, but we can be more descriptive.

  if (/\.map$/.test(file)) return 'Source Map (JSON)';
  const contentType = getContentType(file);
  return contentTypeNames[contentType] || contentType;
}

async function findEntry(stream, filename) {
  // filename = /some/file/name.js
  return new Promise((accept, reject) => {
    let foundEntry = null;
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Ignore non-files and files that don't match the name.

      if (entry.type !== 'file' || entry.path !== filename) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        entry.content = await bufferStream(stream);
        foundEntry = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(foundEntry);
    });
  });
}

async function serveFileBrowser(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const entry = await findEntry(stream, req.filename);

  if (!entry) {
    return res.status(404).send(`Not found: ${req.packageSpec}${req.filename}`);
  }

  const details = {
    contentType: getContentType(entry.path),
    integrity: getIntegrity(entry.content),
    language: getLanguageName(entry.path),
    size: entry.content.length
  };

  if (/^image\//.test(details.contentType)) {
    details.uri = createDataURI(details.contentType, entry.content);
    details.highlights = null;
  } else {
    details.uri = null;
    details.highlights = getHighlights(entry.content.toString('utf8'), entry.path);
  }

  req.browseTarget = {
    path: req.filename,
    type: 'file',
    details
  };
  serveBrowsePage$1(req, res);
}

var serveFileBrowser$1 = asyncHandler(serveFileBrowser);

async function findEntry$1(stream, filename) {
  // filename = /some/file/name.js
  return new Promise((accept, reject) => {
    let foundEntry = null;
    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `/index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+\/?/, '/'),
        type: header.type
      }; // Ignore non-files and files that don't match the name.

      if (entry.type !== 'file' || entry.path !== filename) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.lastModified = header.mtime.toUTCString();
        entry.size = content.length;
        foundEntry = entry;
        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept(foundEntry);
    });
  });
}

async function serveFileMetadata(req, res) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const entry = await findEntry$1(stream, req.filename);

  res.send(entry);
}

var serveFileMetadata$1 = asyncHandler(serveFileMetadata);

function getContentTypeHeader(type) {
  return type === 'application/javascript' ? type + '; charset=utf-8' : type;
}

function serveFile(req, res) {
  const tags = ['file'];
  const ext = path.extname(req.entry.path).substr(1);

  if (ext) {
    tags.push(`${ext}-file`);
  }

  res.set({
    'Content-Type': getContentTypeHeader(req.entry.contentType),
    'Content-Length': req.entry.size,
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Last-Modified': req.entry.lastModified,
    ETag: etag(req.entry.content),
    'Cache-Tag': tags.join(', ')
  }).send(req.entry.content);
}

var MILLISECONDS_IN_MINUTE = 60000;

/**
 * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
 * They usually appear for dates that denote time before the timezones were introduced
 * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
 * and GMT+01:00:00 after that date)
 *
 * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
 * which would lead to incorrect calculations.
 *
 * This function returns the timezone offset in milliseconds that takes seconds in account.
 */
var getTimezoneOffsetInMilliseconds = function getTimezoneOffsetInMilliseconds (dirtyDate) {
  var date = new Date(dirtyDate.getTime());
  var baseTimezoneOffset = date.getTimezoneOffset();
  date.setSeconds(0, 0);
  var millisecondsPartOfTimezoneOffset = date.getTime() % MILLISECONDS_IN_MINUTE;

  return baseTimezoneOffset * MILLISECONDS_IN_MINUTE + millisecondsPartOfTimezoneOffset
};

/**
 * @category Common Helpers
 * @summary Is the given argument an instance of Date?
 *
 * @description
 * Is the given argument an instance of Date?
 *
 * @param {*} argument - the argument to check
 * @returns {Boolean} the given argument is an instance of Date
 *
 * @example
 * // Is 'mayonnaise' a Date?
 * var result = isDate('mayonnaise')
 * //=> false
 */
function isDate (argument) {
  return argument instanceof Date
}

var is_date = isDate;

var MILLISECONDS_IN_HOUR = 3600000;
var MILLISECONDS_IN_MINUTE$1 = 60000;
var DEFAULT_ADDITIONAL_DIGITS = 2;

var parseTokenDateTimeDelimeter = /[T ]/;
var parseTokenPlainTime = /:/;

// year tokens
var parseTokenYY = /^(\d{2})$/;
var parseTokensYYY = [
  /^([+-]\d{2})$/, // 0 additional digits
  /^([+-]\d{3})$/, // 1 additional digit
  /^([+-]\d{4})$/ // 2 additional digits
];

var parseTokenYYYY = /^(\d{4})/;
var parseTokensYYYYY = [
  /^([+-]\d{4})/, // 0 additional digits
  /^([+-]\d{5})/, // 1 additional digit
  /^([+-]\d{6})/ // 2 additional digits
];

// date tokens
var parseTokenMM = /^-(\d{2})$/;
var parseTokenDDD = /^-?(\d{3})$/;
var parseTokenMMDD = /^-?(\d{2})-?(\d{2})$/;
var parseTokenWww = /^-?W(\d{2})$/;
var parseTokenWwwD = /^-?W(\d{2})-?(\d{1})$/;

// time tokens
var parseTokenHH = /^(\d{2}([.,]\d*)?)$/;
var parseTokenHHMM = /^(\d{2}):?(\d{2}([.,]\d*)?)$/;
var parseTokenHHMMSS = /^(\d{2}):?(\d{2}):?(\d{2}([.,]\d*)?)$/;

// timezone tokens
var parseTokenTimezone = /([Z+-].*)$/;
var parseTokenTimezoneZ = /^(Z)$/;
var parseTokenTimezoneHH = /^([+-])(\d{2})$/;
var parseTokenTimezoneHHMM = /^([+-])(\d{2}):?(\d{2})$/;

/**
 * @category Common Helpers
 * @summary Convert the given argument to an instance of Date.
 *
 * @description
 * Convert the given argument to an instance of Date.
 *
 * If the argument is an instance of Date, the function returns its clone.
 *
 * If the argument is a number, it is treated as a timestamp.
 *
 * If an argument is a string, the function tries to parse it.
 * Function accepts complete ISO 8601 formats as well as partial implementations.
 * ISO 8601: http://en.wikipedia.org/wiki/ISO_8601
 *
 * If all above fails, the function passes the given argument to Date constructor.
 *
 * @param {Date|String|Number} argument - the value to convert
 * @param {Object} [options] - the object with options
 * @param {0 | 1 | 2} [options.additionalDigits=2] - the additional number of digits in the extended year format
 * @returns {Date} the parsed date in the local time zone
 *
 * @example
 * // Convert string '2014-02-11T11:30:30' to date:
 * var result = parse('2014-02-11T11:30:30')
 * //=> Tue Feb 11 2014 11:30:30
 *
 * @example
 * // Parse string '+02014101',
 * // if the additional number of digits in the extended year format is 1:
 * var result = parse('+02014101', {additionalDigits: 1})
 * //=> Fri Apr 11 2014 00:00:00
 */
function parse (argument, dirtyOptions) {
  if (is_date(argument)) {
    // Prevent the date to lose the milliseconds when passed to new Date() in IE10
    return new Date(argument.getTime())
  } else if (typeof argument !== 'string') {
    return new Date(argument)
  }

  var options = dirtyOptions || {};
  var additionalDigits = options.additionalDigits;
  if (additionalDigits == null) {
    additionalDigits = DEFAULT_ADDITIONAL_DIGITS;
  } else {
    additionalDigits = Number(additionalDigits);
  }

  var dateStrings = splitDateString(argument);

  var parseYearResult = parseYear(dateStrings.date, additionalDigits);
  var year = parseYearResult.year;
  var restDateString = parseYearResult.restDateString;

  var date = parseDate(restDateString, year);

  if (date) {
    var timestamp = date.getTime();
    var time = 0;
    var offset;

    if (dateStrings.time) {
      time = parseTime(dateStrings.time);
    }

    if (dateStrings.timezone) {
      offset = parseTimezone(dateStrings.timezone) * MILLISECONDS_IN_MINUTE$1;
    } else {
      var fullTime = timestamp + time;
      var fullTimeDate = new Date(fullTime);

      offset = getTimezoneOffsetInMilliseconds(fullTimeDate);

      // Adjust time when it's coming from DST
      var fullTimeDateNextDay = new Date(fullTime);
      fullTimeDateNextDay.setDate(fullTimeDate.getDate() + 1);
      var offsetDiff =
        getTimezoneOffsetInMilliseconds(fullTimeDateNextDay) -
        getTimezoneOffsetInMilliseconds(fullTimeDate);
      if (offsetDiff > 0) {
        offset += offsetDiff;
      }
    }

    return new Date(timestamp + time + offset)
  } else {
    return new Date(argument)
  }
}

function splitDateString (dateString) {
  var dateStrings = {};
  var array = dateString.split(parseTokenDateTimeDelimeter);
  var timeString;

  if (parseTokenPlainTime.test(array[0])) {
    dateStrings.date = null;
    timeString = array[0];
  } else {
    dateStrings.date = array[0];
    timeString = array[1];
  }

  if (timeString) {
    var token = parseTokenTimezone.exec(timeString);
    if (token) {
      dateStrings.time = timeString.replace(token[1], '');
      dateStrings.timezone = token[1];
    } else {
      dateStrings.time = timeString;
    }
  }

  return dateStrings
}

function parseYear (dateString, additionalDigits) {
  var parseTokenYYY = parseTokensYYY[additionalDigits];
  var parseTokenYYYYY = parseTokensYYYYY[additionalDigits];

  var token;

  // YYYY or ±YYYYY
  token = parseTokenYYYY.exec(dateString) || parseTokenYYYYY.exec(dateString);
  if (token) {
    var yearString = token[1];
    return {
      year: parseInt(yearString, 10),
      restDateString: dateString.slice(yearString.length)
    }
  }

  // YY or ±YYY
  token = parseTokenYY.exec(dateString) || parseTokenYYY.exec(dateString);
  if (token) {
    var centuryString = token[1];
    return {
      year: parseInt(centuryString, 10) * 100,
      restDateString: dateString.slice(centuryString.length)
    }
  }

  // Invalid ISO-formatted year
  return {
    year: null
  }
}

function parseDate (dateString, year) {
  // Invalid ISO-formatted year
  if (year === null) {
    return null
  }

  var token;
  var date;
  var month;
  var week;

  // YYYY
  if (dateString.length === 0) {
    date = new Date(0);
    date.setUTCFullYear(year);
    return date
  }

  // YYYY-MM
  token = parseTokenMM.exec(dateString);
  if (token) {
    date = new Date(0);
    month = parseInt(token[1], 10) - 1;
    date.setUTCFullYear(year, month);
    return date
  }

  // YYYY-DDD or YYYYDDD
  token = parseTokenDDD.exec(dateString);
  if (token) {
    date = new Date(0);
    var dayOfYear = parseInt(token[1], 10);
    date.setUTCFullYear(year, 0, dayOfYear);
    return date
  }

  // YYYY-MM-DD or YYYYMMDD
  token = parseTokenMMDD.exec(dateString);
  if (token) {
    date = new Date(0);
    month = parseInt(token[1], 10) - 1;
    var day = parseInt(token[2], 10);
    date.setUTCFullYear(year, month, day);
    return date
  }

  // YYYY-Www or YYYYWww
  token = parseTokenWww.exec(dateString);
  if (token) {
    week = parseInt(token[1], 10) - 1;
    return dayOfISOYear(year, week)
  }

  // YYYY-Www-D or YYYYWwwD
  token = parseTokenWwwD.exec(dateString);
  if (token) {
    week = parseInt(token[1], 10) - 1;
    var dayOfWeek = parseInt(token[2], 10) - 1;
    return dayOfISOYear(year, week, dayOfWeek)
  }

  // Invalid ISO-formatted date
  return null
}

function parseTime (timeString) {
  var token;
  var hours;
  var minutes;

  // hh
  token = parseTokenHH.exec(timeString);
  if (token) {
    hours = parseFloat(token[1].replace(',', '.'));
    return (hours % 24) * MILLISECONDS_IN_HOUR
  }

  // hh:mm or hhmm
  token = parseTokenHHMM.exec(timeString);
  if (token) {
    hours = parseInt(token[1], 10);
    minutes = parseFloat(token[2].replace(',', '.'));
    return (hours % 24) * MILLISECONDS_IN_HOUR +
      minutes * MILLISECONDS_IN_MINUTE$1
  }

  // hh:mm:ss or hhmmss
  token = parseTokenHHMMSS.exec(timeString);
  if (token) {
    hours = parseInt(token[1], 10);
    minutes = parseInt(token[2], 10);
    var seconds = parseFloat(token[3].replace(',', '.'));
    return (hours % 24) * MILLISECONDS_IN_HOUR +
      minutes * MILLISECONDS_IN_MINUTE$1 +
      seconds * 1000
  }

  // Invalid ISO-formatted time
  return null
}

function parseTimezone (timezoneString) {
  var token;
  var absoluteOffset;

  // Z
  token = parseTokenTimezoneZ.exec(timezoneString);
  if (token) {
    return 0
  }

  // ±hh
  token = parseTokenTimezoneHH.exec(timezoneString);
  if (token) {
    absoluteOffset = parseInt(token[2], 10) * 60;
    return (token[1] === '+') ? -absoluteOffset : absoluteOffset
  }

  // ±hh:mm or ±hhmm
  token = parseTokenTimezoneHHMM.exec(timezoneString);
  if (token) {
    absoluteOffset = parseInt(token[2], 10) * 60 + parseInt(token[3], 10);
    return (token[1] === '+') ? -absoluteOffset : absoluteOffset
  }

  return 0
}

function dayOfISOYear (isoYear, week, day) {
  week = week || 0;
  day = day || 0;
  var date = new Date(0);
  date.setUTCFullYear(isoYear, 0, 4);
  var fourthOfJanuaryDay = date.getUTCDay() || 7;
  var diff = week * 7 + day + 1 - fourthOfJanuaryDay;
  date.setUTCDate(date.getUTCDate() + diff);
  return date
}

var parse_1 = parse;

/**
 * @category Year Helpers
 * @summary Return the start of a year for the given date.
 *
 * @description
 * Return the start of a year for the given date.
 * The result will be in the local timezone.
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of a year
 *
 * @example
 * // The start of a year for 2 September 2014 11:55:00:
 * var result = startOfYear(new Date(2014, 8, 2, 11, 55, 00))
 * //=> Wed Jan 01 2014 00:00:00
 */
function startOfYear (dirtyDate) {
  var cleanDate = parse_1(dirtyDate);
  var date = new Date(0);
  date.setFullYear(cleanDate.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date
}

var start_of_year = startOfYear;

/**
 * @category Day Helpers
 * @summary Return the start of a day for the given date.
 *
 * @description
 * Return the start of a day for the given date.
 * The result will be in the local timezone.
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of a day
 *
 * @example
 * // The start of a day for 2 September 2014 11:55:00:
 * var result = startOfDay(new Date(2014, 8, 2, 11, 55, 0))
 * //=> Tue Sep 02 2014 00:00:00
 */
function startOfDay (dirtyDate) {
  var date = parse_1(dirtyDate);
  date.setHours(0, 0, 0, 0);
  return date
}

var start_of_day = startOfDay;

var MILLISECONDS_IN_MINUTE$2 = 60000;
var MILLISECONDS_IN_DAY = 86400000;

/**
 * @category Day Helpers
 * @summary Get the number of calendar days between the given dates.
 *
 * @description
 * Get the number of calendar days between the given dates.
 *
 * @param {Date|String|Number} dateLeft - the later date
 * @param {Date|String|Number} dateRight - the earlier date
 * @returns {Number} the number of calendar days
 *
 * @example
 * // How many calendar days are between
 * // 2 July 2011 23:00:00 and 2 July 2012 00:00:00?
 * var result = differenceInCalendarDays(
 *   new Date(2012, 6, 2, 0, 0),
 *   new Date(2011, 6, 2, 23, 0)
 * )
 * //=> 366
 */
function differenceInCalendarDays (dirtyDateLeft, dirtyDateRight) {
  var startOfDayLeft = start_of_day(dirtyDateLeft);
  var startOfDayRight = start_of_day(dirtyDateRight);

  var timestampLeft = startOfDayLeft.getTime() -
    startOfDayLeft.getTimezoneOffset() * MILLISECONDS_IN_MINUTE$2;
  var timestampRight = startOfDayRight.getTime() -
    startOfDayRight.getTimezoneOffset() * MILLISECONDS_IN_MINUTE$2;

  // Round the number of days to the nearest integer
  // because the number of milliseconds in a day is not constant
  // (e.g. it's different in the day of the daylight saving time clock shift)
  return Math.round((timestampLeft - timestampRight) / MILLISECONDS_IN_DAY)
}

var difference_in_calendar_days = differenceInCalendarDays;

/**
 * @category Day Helpers
 * @summary Get the day of the year of the given date.
 *
 * @description
 * Get the day of the year of the given date.
 *
 * @param {Date|String|Number} date - the given date
 * @returns {Number} the day of year
 *
 * @example
 * // Which day of the year is 2 July 2014?
 * var result = getDayOfYear(new Date(2014, 6, 2))
 * //=> 183
 */
function getDayOfYear (dirtyDate) {
  var date = parse_1(dirtyDate);
  var diff = difference_in_calendar_days(date, start_of_year(date));
  var dayOfYear = diff + 1;
  return dayOfYear
}

var get_day_of_year = getDayOfYear;

/**
 * @category Week Helpers
 * @summary Return the start of a week for the given date.
 *
 * @description
 * Return the start of a week for the given date.
 * The result will be in the local timezone.
 *
 * @param {Date|String|Number} date - the original date
 * @param {Object} [options] - the object with options
 * @param {Number} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
 * @returns {Date} the start of a week
 *
 * @example
 * // The start of a week for 2 September 2014 11:55:00:
 * var result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0))
 * //=> Sun Aug 31 2014 00:00:00
 *
 * @example
 * // If the week starts on Monday, the start of the week for 2 September 2014 11:55:00:
 * var result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0), {weekStartsOn: 1})
 * //=> Mon Sep 01 2014 00:00:00
 */
function startOfWeek (dirtyDate, dirtyOptions) {
  var weekStartsOn = dirtyOptions ? (Number(dirtyOptions.weekStartsOn) || 0) : 0;

  var date = parse_1(dirtyDate);
  var day = date.getDay();
  var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;

  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date
}

var start_of_week = startOfWeek;

/**
 * @category ISO Week Helpers
 * @summary Return the start of an ISO week for the given date.
 *
 * @description
 * Return the start of an ISO week for the given date.
 * The result will be in the local timezone.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of an ISO week
 *
 * @example
 * // The start of an ISO week for 2 September 2014 11:55:00:
 * var result = startOfISOWeek(new Date(2014, 8, 2, 11, 55, 0))
 * //=> Mon Sep 01 2014 00:00:00
 */
function startOfISOWeek (dirtyDate) {
  return start_of_week(dirtyDate, {weekStartsOn: 1})
}

var start_of_iso_week = startOfISOWeek;

/**
 * @category ISO Week-Numbering Year Helpers
 * @summary Get the ISO week-numbering year of the given date.
 *
 * @description
 * Get the ISO week-numbering year of the given date,
 * which always starts 3 days before the year's first Thursday.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the given date
 * @returns {Number} the ISO week-numbering year
 *
 * @example
 * // Which ISO-week numbering year is 2 January 2005?
 * var result = getISOYear(new Date(2005, 0, 2))
 * //=> 2004
 */
function getISOYear (dirtyDate) {
  var date = parse_1(dirtyDate);
  var year = date.getFullYear();

  var fourthOfJanuaryOfNextYear = new Date(0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  var startOfNextYear = start_of_iso_week(fourthOfJanuaryOfNextYear);

  var fourthOfJanuaryOfThisYear = new Date(0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  var startOfThisYear = start_of_iso_week(fourthOfJanuaryOfThisYear);

  if (date.getTime() >= startOfNextYear.getTime()) {
    return year + 1
  } else if (date.getTime() >= startOfThisYear.getTime()) {
    return year
  } else {
    return year - 1
  }
}

var get_iso_year = getISOYear;

/**
 * @category ISO Week-Numbering Year Helpers
 * @summary Return the start of an ISO week-numbering year for the given date.
 *
 * @description
 * Return the start of an ISO week-numbering year,
 * which always starts 3 days before the year's first Thursday.
 * The result will be in the local timezone.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the original date
 * @returns {Date} the start of an ISO year
 *
 * @example
 * // The start of an ISO week-numbering year for 2 July 2005:
 * var result = startOfISOYear(new Date(2005, 6, 2))
 * //=> Mon Jan 03 2005 00:00:00
 */
function startOfISOYear (dirtyDate) {
  var year = get_iso_year(dirtyDate);
  var fourthOfJanuary = new Date(0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  var date = start_of_iso_week(fourthOfJanuary);
  return date
}

var start_of_iso_year = startOfISOYear;

var MILLISECONDS_IN_WEEK = 604800000;

/**
 * @category ISO Week Helpers
 * @summary Get the ISO week of the given date.
 *
 * @description
 * Get the ISO week of the given date.
 *
 * ISO week-numbering year: http://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date|String|Number} date - the given date
 * @returns {Number} the ISO week
 *
 * @example
 * // Which week of the ISO-week numbering year is 2 January 2005?
 * var result = getISOWeek(new Date(2005, 0, 2))
 * //=> 53
 */
function getISOWeek (dirtyDate) {
  var date = parse_1(dirtyDate);
  var diff = start_of_iso_week(date).getTime() - start_of_iso_year(date).getTime();

  // Round the number of days to the nearest integer
  // because the number of milliseconds in a week is not constant
  // (e.g. it's different in the week of the daylight saving time clock shift)
  return Math.round(diff / MILLISECONDS_IN_WEEK) + 1
}

var get_iso_week = getISOWeek;

/**
 * @category Common Helpers
 * @summary Is the given date valid?
 *
 * @description
 * Returns false if argument is Invalid Date and true otherwise.
 * Invalid Date is a Date, whose time value is NaN.
 *
 * Time value of Date: http://es5.github.io/#x15.9.1.1
 *
 * @param {Date} date - the date to check
 * @returns {Boolean} the date is valid
 * @throws {TypeError} argument must be an instance of Date
 *
 * @example
 * // For the valid date:
 * var result = isValid(new Date(2014, 1, 31))
 * //=> true
 *
 * @example
 * // For the invalid date:
 * var result = isValid(new Date(''))
 * //=> false
 */
function isValid (dirtyDate) {
  if (is_date(dirtyDate)) {
    return !isNaN(dirtyDate)
  } else {
    throw new TypeError(toString.call(dirtyDate) + ' is not an instance of Date')
  }
}

var is_valid = isValid;

function buildDistanceInWordsLocale () {
  var distanceInWordsLocale = {
    lessThanXSeconds: {
      one: 'less than a second',
      other: 'less than {{count}} seconds'
    },

    xSeconds: {
      one: '1 second',
      other: '{{count}} seconds'
    },

    halfAMinute: 'half a minute',

    lessThanXMinutes: {
      one: 'less than a minute',
      other: 'less than {{count}} minutes'
    },

    xMinutes: {
      one: '1 minute',
      other: '{{count}} minutes'
    },

    aboutXHours: {
      one: 'about 1 hour',
      other: 'about {{count}} hours'
    },

    xHours: {
      one: '1 hour',
      other: '{{count}} hours'
    },

    xDays: {
      one: '1 day',
      other: '{{count}} days'
    },

    aboutXMonths: {
      one: 'about 1 month',
      other: 'about {{count}} months'
    },

    xMonths: {
      one: '1 month',
      other: '{{count}} months'
    },

    aboutXYears: {
      one: 'about 1 year',
      other: 'about {{count}} years'
    },

    xYears: {
      one: '1 year',
      other: '{{count}} years'
    },

    overXYears: {
      one: 'over 1 year',
      other: 'over {{count}} years'
    },

    almostXYears: {
      one: 'almost 1 year',
      other: 'almost {{count}} years'
    }
  };

  function localize (token, count, options) {
    options = options || {};

    var result;
    if (typeof distanceInWordsLocale[token] === 'string') {
      result = distanceInWordsLocale[token];
    } else if (count === 1) {
      result = distanceInWordsLocale[token].one;
    } else {
      result = distanceInWordsLocale[token].other.replace('{{count}}', count);
    }

    if (options.addSuffix) {
      if (options.comparison > 0) {
        return 'in ' + result
      } else {
        return result + ' ago'
      }
    }

    return result
  }

  return {
    localize: localize
  }
}

var build_distance_in_words_locale = buildDistanceInWordsLocale;

var commonFormatterKeys = [
  'M', 'MM', 'Q', 'D', 'DD', 'DDD', 'DDDD', 'd',
  'E', 'W', 'WW', 'YY', 'YYYY', 'GG', 'GGGG',
  'H', 'HH', 'h', 'hh', 'm', 'mm',
  's', 'ss', 'S', 'SS', 'SSS',
  'Z', 'ZZ', 'X', 'x'
];

function buildFormattingTokensRegExp (formatters) {
  var formatterKeys = [];
  for (var key in formatters) {
    if (formatters.hasOwnProperty(key)) {
      formatterKeys.push(key);
    }
  }

  var formattingTokens = commonFormatterKeys
    .concat(formatterKeys)
    .sort()
    .reverse();
  var formattingTokensRegExp = new RegExp(
    '(\\[[^\\[]*\\])|(\\\\)?' + '(' + formattingTokens.join('|') + '|.)', 'g'
  );

  return formattingTokensRegExp
}

var build_formatting_tokens_reg_exp = buildFormattingTokensRegExp;

function buildFormatLocale () {
  // Note: in English, the names of days of the week and months are capitalized.
  // If you are making a new locale based on this one, check if the same is true for the language you're working on.
  // Generally, formatted dates should look like they are in the middle of a sentence,
  // e.g. in Spanish language the weekdays and months should be in the lowercase.
  var months3char = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var weekdays2char = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var weekdays3char = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var weekdaysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var meridiemUppercase = ['AM', 'PM'];
  var meridiemLowercase = ['am', 'pm'];
  var meridiemFull = ['a.m.', 'p.m.'];

  var formatters = {
    // Month: Jan, Feb, ..., Dec
    'MMM': function (date) {
      return months3char[date.getMonth()]
    },

    // Month: January, February, ..., December
    'MMMM': function (date) {
      return monthsFull[date.getMonth()]
    },

    // Day of week: Su, Mo, ..., Sa
    'dd': function (date) {
      return weekdays2char[date.getDay()]
    },

    // Day of week: Sun, Mon, ..., Sat
    'ddd': function (date) {
      return weekdays3char[date.getDay()]
    },

    // Day of week: Sunday, Monday, ..., Saturday
    'dddd': function (date) {
      return weekdaysFull[date.getDay()]
    },

    // AM, PM
    'A': function (date) {
      return (date.getHours() / 12) >= 1 ? meridiemUppercase[1] : meridiemUppercase[0]
    },

    // am, pm
    'a': function (date) {
      return (date.getHours() / 12) >= 1 ? meridiemLowercase[1] : meridiemLowercase[0]
    },

    // a.m., p.m.
    'aa': function (date) {
      return (date.getHours() / 12) >= 1 ? meridiemFull[1] : meridiemFull[0]
    }
  };

  // Generate ordinal version of formatters: M -> Mo, D -> Do, etc.
  var ordinalFormatters = ['M', 'D', 'DDD', 'd', 'Q', 'W'];
  ordinalFormatters.forEach(function (formatterToken) {
    formatters[formatterToken + 'o'] = function (date, formatters) {
      return ordinal(formatters[formatterToken](date))
    };
  });

  return {
    formatters: formatters,
    formattingTokensRegExp: build_formatting_tokens_reg_exp(formatters)
  }
}

function ordinal (number) {
  var rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + 'st'
      case 2:
        return number + 'nd'
      case 3:
        return number + 'rd'
    }
  }
  return number + 'th'
}

var build_format_locale = buildFormatLocale;

/**
 * @category Locales
 * @summary English locale.
 */
var en = {
  distanceInWords: build_distance_in_words_locale(),
  format: build_format_locale()
};

/**
 * @category Common Helpers
 * @summary Format the date.
 *
 * @description
 * Return the formatted date string in the given format.
 *
 * Accepted tokens:
 * | Unit                    | Token | Result examples                  |
 * |-------------------------|-------|----------------------------------|
 * | Month                   | M     | 1, 2, ..., 12                    |
 * |                         | Mo    | 1st, 2nd, ..., 12th              |
 * |                         | MM    | 01, 02, ..., 12                  |
 * |                         | MMM   | Jan, Feb, ..., Dec               |
 * |                         | MMMM  | January, February, ..., December |
 * | Quarter                 | Q     | 1, 2, 3, 4                       |
 * |                         | Qo    | 1st, 2nd, 3rd, 4th               |
 * | Day of month            | D     | 1, 2, ..., 31                    |
 * |                         | Do    | 1st, 2nd, ..., 31st              |
 * |                         | DD    | 01, 02, ..., 31                  |
 * | Day of year             | DDD   | 1, 2, ..., 366                   |
 * |                         | DDDo  | 1st, 2nd, ..., 366th             |
 * |                         | DDDD  | 001, 002, ..., 366               |
 * | Day of week             | d     | 0, 1, ..., 6                     |
 * |                         | do    | 0th, 1st, ..., 6th               |
 * |                         | dd    | Su, Mo, ..., Sa                  |
 * |                         | ddd   | Sun, Mon, ..., Sat               |
 * |                         | dddd  | Sunday, Monday, ..., Saturday    |
 * | Day of ISO week         | E     | 1, 2, ..., 7                     |
 * | ISO week                | W     | 1, 2, ..., 53                    |
 * |                         | Wo    | 1st, 2nd, ..., 53rd              |
 * |                         | WW    | 01, 02, ..., 53                  |
 * | Year                    | YY    | 00, 01, ..., 99                  |
 * |                         | YYYY  | 1900, 1901, ..., 2099            |
 * | ISO week-numbering year | GG    | 00, 01, ..., 99                  |
 * |                         | GGGG  | 1900, 1901, ..., 2099            |
 * | AM/PM                   | A     | AM, PM                           |
 * |                         | a     | am, pm                           |
 * |                         | aa    | a.m., p.m.                       |
 * | Hour                    | H     | 0, 1, ... 23                     |
 * |                         | HH    | 00, 01, ... 23                   |
 * |                         | h     | 1, 2, ..., 12                    |
 * |                         | hh    | 01, 02, ..., 12                  |
 * | Minute                  | m     | 0, 1, ..., 59                    |
 * |                         | mm    | 00, 01, ..., 59                  |
 * | Second                  | s     | 0, 1, ..., 59                    |
 * |                         | ss    | 00, 01, ..., 59                  |
 * | 1/10 of second          | S     | 0, 1, ..., 9                     |
 * | 1/100 of second         | SS    | 00, 01, ..., 99                  |
 * | Millisecond             | SSS   | 000, 001, ..., 999               |
 * | Timezone                | Z     | -01:00, +00:00, ... +12:00       |
 * |                         | ZZ    | -0100, +0000, ..., +1200         |
 * | Seconds timestamp       | X     | 512969520                        |
 * | Milliseconds timestamp  | x     | 512969520900                     |
 *
 * The characters wrapped in square brackets are escaped.
 *
 * The result may vary by locale.
 *
 * @param {Date|String|Number} date - the original date
 * @param {String} [format='YYYY-MM-DDTHH:mm:ss.SSSZ'] - the string of tokens
 * @param {Object} [options] - the object with options
 * @param {Object} [options.locale=enLocale] - the locale object
 * @returns {String} the formatted date string
 *
 * @example
 * // Represent 11 February 2014 in middle-endian format:
 * var result = format(
 *   new Date(2014, 1, 11),
 *   'MM/DD/YYYY'
 * )
 * //=> '02/11/2014'
 *
 * @example
 * // Represent 2 July 2014 in Esperanto:
 * var eoLocale = require('date-fns/locale/eo')
 * var result = format(
 *   new Date(2014, 6, 2),
 *   'Do [de] MMMM YYYY',
 *   {locale: eoLocale}
 * )
 * //=> '2-a de julio 2014'
 */
function format (dirtyDate, dirtyFormatStr, dirtyOptions) {
  var formatStr = dirtyFormatStr ? String(dirtyFormatStr) : 'YYYY-MM-DDTHH:mm:ss.SSSZ';
  var options = dirtyOptions || {};

  var locale = options.locale;
  var localeFormatters = en.format.formatters;
  var formattingTokensRegExp = en.format.formattingTokensRegExp;
  if (locale && locale.format && locale.format.formatters) {
    localeFormatters = locale.format.formatters;

    if (locale.format.formattingTokensRegExp) {
      formattingTokensRegExp = locale.format.formattingTokensRegExp;
    }
  }

  var date = parse_1(dirtyDate);

  if (!is_valid(date)) {
    return 'Invalid Date'
  }

  var formatFn = buildFormatFn(formatStr, localeFormatters, formattingTokensRegExp);

  return formatFn(date)
}

var formatters = {
  // Month: 1, 2, ..., 12
  'M': function (date) {
    return date.getMonth() + 1
  },

  // Month: 01, 02, ..., 12
  'MM': function (date) {
    return addLeadingZeros(date.getMonth() + 1, 2)
  },

  // Quarter: 1, 2, 3, 4
  'Q': function (date) {
    return Math.ceil((date.getMonth() + 1) / 3)
  },

  // Day of month: 1, 2, ..., 31
  'D': function (date) {
    return date.getDate()
  },

  // Day of month: 01, 02, ..., 31
  'DD': function (date) {
    return addLeadingZeros(date.getDate(), 2)
  },

  // Day of year: 1, 2, ..., 366
  'DDD': function (date) {
    return get_day_of_year(date)
  },

  // Day of year: 001, 002, ..., 366
  'DDDD': function (date) {
    return addLeadingZeros(get_day_of_year(date), 3)
  },

  // Day of week: 0, 1, ..., 6
  'd': function (date) {
    return date.getDay()
  },

  // Day of ISO week: 1, 2, ..., 7
  'E': function (date) {
    return date.getDay() || 7
  },

  // ISO week: 1, 2, ..., 53
  'W': function (date) {
    return get_iso_week(date)
  },

  // ISO week: 01, 02, ..., 53
  'WW': function (date) {
    return addLeadingZeros(get_iso_week(date), 2)
  },

  // Year: 00, 01, ..., 99
  'YY': function (date) {
    return addLeadingZeros(date.getFullYear(), 4).substr(2)
  },

  // Year: 1900, 1901, ..., 2099
  'YYYY': function (date) {
    return addLeadingZeros(date.getFullYear(), 4)
  },

  // ISO week-numbering year: 00, 01, ..., 99
  'GG': function (date) {
    return String(get_iso_year(date)).substr(2)
  },

  // ISO week-numbering year: 1900, 1901, ..., 2099
  'GGGG': function (date) {
    return get_iso_year(date)
  },

  // Hour: 0, 1, ... 23
  'H': function (date) {
    return date.getHours()
  },

  // Hour: 00, 01, ..., 23
  'HH': function (date) {
    return addLeadingZeros(date.getHours(), 2)
  },

  // Hour: 1, 2, ..., 12
  'h': function (date) {
    var hours = date.getHours();
    if (hours === 0) {
      return 12
    } else if (hours > 12) {
      return hours % 12
    } else {
      return hours
    }
  },

  // Hour: 01, 02, ..., 12
  'hh': function (date) {
    return addLeadingZeros(formatters['h'](date), 2)
  },

  // Minute: 0, 1, ..., 59
  'm': function (date) {
    return date.getMinutes()
  },

  // Minute: 00, 01, ..., 59
  'mm': function (date) {
    return addLeadingZeros(date.getMinutes(), 2)
  },

  // Second: 0, 1, ..., 59
  's': function (date) {
    return date.getSeconds()
  },

  // Second: 00, 01, ..., 59
  'ss': function (date) {
    return addLeadingZeros(date.getSeconds(), 2)
  },

  // 1/10 of second: 0, 1, ..., 9
  'S': function (date) {
    return Math.floor(date.getMilliseconds() / 100)
  },

  // 1/100 of second: 00, 01, ..., 99
  'SS': function (date) {
    return addLeadingZeros(Math.floor(date.getMilliseconds() / 10), 2)
  },

  // Millisecond: 000, 001, ..., 999
  'SSS': function (date) {
    return addLeadingZeros(date.getMilliseconds(), 3)
  },

  // Timezone: -01:00, +00:00, ... +12:00
  'Z': function (date) {
    return formatTimezone(date.getTimezoneOffset(), ':')
  },

  // Timezone: -0100, +0000, ... +1200
  'ZZ': function (date) {
    return formatTimezone(date.getTimezoneOffset())
  },

  // Seconds timestamp: 512969520
  'X': function (date) {
    return Math.floor(date.getTime() / 1000)
  },

  // Milliseconds timestamp: 512969520900
  'x': function (date) {
    return date.getTime()
  }
};

function buildFormatFn (formatStr, localeFormatters, formattingTokensRegExp) {
  var array = formatStr.match(formattingTokensRegExp);
  var length = array.length;

  var i;
  var formatter;
  for (i = 0; i < length; i++) {
    formatter = localeFormatters[array[i]] || formatters[array[i]];
    if (formatter) {
      array[i] = formatter;
    } else {
      array[i] = removeFormattingTokens(array[i]);
    }
  }

  return function (date) {
    var output = '';
    for (var i = 0; i < length; i++) {
      if (array[i] instanceof Function) {
        output += array[i](date, formatters);
      } else {
        output += array[i];
      }
    }
    return output
  }
}

function removeFormattingTokens (input) {
  if (input.match(/\[[\s\S]/)) {
    return input.replace(/^\[|]$/g, '')
  }
  return input.replace(/\\/g, '')
}

function formatTimezone (offset, delimeter) {
  delimeter = delimeter || '';
  var sign = offset > 0 ? '-' : '+';
  var absOffset = Math.abs(offset);
  var hours = Math.floor(absOffset / 60);
  var minutes = absOffset % 60;
  return sign + addLeadingZeros(hours, 2) + delimeter + addLeadingZeros(minutes, 2)
}

function addLeadingZeros (number, targetLength) {
  var output = Math.abs(number).toString();
  while (output.length < targetLength) {
    output = '0' + output;
  }
  return output
}

var format_1 = format;

function createIcon$1(Type, _ref) {
  var css = _ref.css,
      rest = _objectWithoutPropertiesLoose(_ref, ["css"]);

  return core.jsx(Type, Object.assign({
    css: Object.assign({}, css, {
      verticalAlign: 'text-bottom'
    })
  }, rest));
}

function TwitterIcon$1(props) {
  return createIcon$1(FaTwitter, props);
}
function GitHubIcon$1(props) {
  return createIcon$1(FaGithub, props);
}

var CloudflareLogo = "/_client/46bc46bc8accec6a.png";

var FlyLogo = "/_client/b870d5fb04d2854d.png";

function _templateObject$1() {
  var data = _taggedTemplateLiteralLoose(["\n  html {\n    box-sizing: border-box;\n  }\n  *,\n  *:before,\n  *:after {\n    box-sizing: inherit;\n  }\n\n  html,\n  body,\n  #root {\n    height: 100%;\n    margin: 0;\n  }\n\n  body {\n    ", "\n    font-size: 16px;\n    line-height: 1.5;\n    overflow-wrap: break-word;\n    background: white;\n    color: black;\n  }\n\n  code {\n    ", "\n    font-size: 1rem;\n    padding: 0 3px;\n    background-color: #eee;\n  }\n\n  dd,\n  ul {\n    margin-left: 0;\n    padding-left: 25px;\n  }\n"]);

  _templateObject$1 = function _templateObject() {
    return data;
  };

  return data;
}
var buildId$1 = "af8c8db";
var globalStyles$1 = core.css(_templateObject$1(), fontSans, fontMono);

function Link$1(props) {
  return (// eslint-disable-next-line jsx-a11y/anchor-has-content
    core.jsx("a", Object.assign({}, props, {
      css: {
        color: '#0076ff',
        textDecoration: 'none',
        ':hover': {
          textDecoration: 'underline'
        }
      }
    }))
  );
}

function AboutLogo(_ref) {
  var children = _ref.children;
  return core.jsx("div", {
    css: {
      textAlign: 'center',
      flex: '1'
    }
  }, children);
}

function AboutLogoImage(props) {
  // eslint-disable-next-line jsx-a11y/alt-text
  return core.jsx("img", Object.assign({}, props, {
    css: {
      maxWidth: '90%'
    }
  }));
}

function Stats(_ref2) {
  var data = _ref2.data;
  var totals = data.totals;
  var since = parse_1(totals.since);
  var until = parse_1(totals.until);
  return core.jsx("p", null, "From ", core.jsx("strong", null, format_1(since, 'MMM D')), " to", ' ', core.jsx("strong", null, format_1(until, 'MMM D')), " unpkg served", ' ', core.jsx("strong", null, formatNumber(totals.requests.all)), " requests and a total of ", core.jsx("strong", null, formatBytes(totals.bandwidth.all)), " of data to", ' ', core.jsx("strong", null, formatNumber(totals.uniques.all)), " unique visitors,", ' ', core.jsx("strong", null, formatPercent(totals.requests.cached / totals.requests.all, 2), "%"), ' ', "of which were served from the cache.");
}

function App$1() {
  var _useState = React.useState(typeof window === 'object' && window.localStorage && window.localStorage.savedStats ? JSON.parse(window.localStorage.savedStats) : null),
      stats = _useState[0],
      setStats = _useState[1];

  var hasStats = !!(stats && !stats.error);
  var stringStats = JSON.stringify(stats);
  React.useEffect(function () {
    window.localStorage.savedStats = stringStats;
  }, [stringStats]);
  React.useEffect(function () {
    fetch('/api/stats?period=last-month').then(function (res) {
      return res.json();
    }).then(setStats);
  }, []);
  return core.jsx(React.Fragment, null, core.jsx(core.Global, {
    styles: globalStyles$1
  }), core.jsx("div", {
    css: {
      maxWidth: 740,
      margin: '0 auto'
    }
  }, core.jsx("div", {
    css: {
      padding: '0 20px'
    }
  }, core.jsx("header", null, core.jsx("h1", {
    css: {
      textAlign: 'center',
      fontSize: '4.5em',
      letterSpacing: '0.05em',
      '@media (min-width: 700px)': {
        marginTop: '1.5em'
      }
    }
  }, "UNPKG"), core.jsx("p", null, "unpkg is a fast, global content delivery network for everything on", ' ', core.jsx(Link$1, {
    href: "https://www.npmjs.com/"
  }, "npm"), ". Use it to quickly and easily load any file from any package using a URL like:"), core.jsx("div", {
    css: {
      textAlign: 'center',
      backgroundColor: '#eee',
      margin: '2em 0',
      padding: '5px 0'
    }
  }, "unpkg.com/:package@:version/:file"), hasStats && core.jsx(Stats, {
    data: stats
  })), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "examples"
  }, "Examples"), core.jsx("p", null, "Using a fixed version:"), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/react@16.7.0/umd/react.production.min.js"
  }, "unpkg.com/react@16.7.0/umd/react.production.min.js")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/react-dom@16.7.0/umd/react-dom.production.min.js"
  }, "unpkg.com/react-dom@16.7.0/umd/react-dom.production.min.js"))), core.jsx("p", null, "You may also use a", ' ', core.jsx(Link$1, {
    href: "https://docs.npmjs.com/about-semantic-versioning"
  }, "semver range"), ' ', "or a ", core.jsx(Link$1, {
    href: "https://docs.npmjs.com/cli/dist-tag"
  }, "tag"), ' ', "instead of a fixed version number, or omit the version/tag entirely to use the ", core.jsx("code", null, "latest"), " tag."), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/react@^16/umd/react.production.min.js"
  }, "unpkg.com/react@^16/umd/react.production.min.js")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/react/umd/react.production.min.js"
  }, "unpkg.com/react/umd/react.production.min.js"))), core.jsx("p", null, "If you omit the file path (i.e. use a \u201Cbare\u201D URL), unpkg will serve the file specified by the ", core.jsx("code", null, "unpkg"), " field in", ' ', core.jsx("code", null, "package.json"), ", or fall back to ", core.jsx("code", null, "main"), "."), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/jquery"
  }, "unpkg.com/jquery")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/three"
  }, "unpkg.com/three"))), core.jsx("p", null, "Append a ", core.jsx("code", null, "/"), " at the end of a URL to view a listing of all the files in a package."), core.jsx("ul", null, core.jsx("li", null, core.jsx(Link$1, {
    href: "/react/"
  }, "unpkg.com/react/")), core.jsx("li", null, core.jsx(Link$1, {
    href: "/react-router/"
  }, "unpkg.com/react-router/"))), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "query-params"
  }, "Query Parameters"), core.jsx("dl", null, core.jsx("dt", null, core.jsx("code", null, "?meta")), core.jsx("dd", null, "Return metadata about any file in a package as JSON (e.g.", core.jsx("code", null, "/any/file?meta"), ")"), core.jsx("dt", null, core.jsx("code", null, "?module")), core.jsx("dd", null, "Expands all", ' ', core.jsx(Link$1, {
    href: "https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier"
  }, "\u201Cbare\u201D ", core.jsx("code", null, "import"), " specifiers"), ' ', "in JavaScript modules to unpkg URLs. This feature is", ' ', core.jsx("em", null, "very experimental"))), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "cache-behavior"
  }, "Cache Behavior"), core.jsx("p", null, "The CDN caches files based on their permanent URL, which includes the npm package version. This works because npm does not allow package authors to overwrite a package that has already been published with a different one at the same version number."), core.jsx("p", null, "Browsers are instructed (via the ", core.jsx("code", null, "Cache-Control"), " header) to cache assets indefinitely (1 year)."), core.jsx("p", null, "URLs that do not specify a package version number redirect to one that does. This is the ", core.jsx("code", null, "latest"), " version when no version is specified, or the ", core.jsx("code", null, "maxSatisfying"), " version when a", ' ', core.jsx(Link$1, {
    href: "https://github.com/npm/node-semver"
  }, "semver version"), ' ', "is given. Redirects are cached for 10 minutes at the CDN, 1 minute in browsers."), core.jsx("p", null, "If you want users to be able to use the latest version when you cut a new release, the best policy is to put the version number in the URL directly in your installation instructions. This will also load more quickly because we won't have to resolve the latest version and redirect them."), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "workflow"
  }, "Workflow"), core.jsx("p", null, "For npm package authors, unpkg relieves the burden of publishing your code to a CDN in addition to the npm registry. All you need to do is include your", ' ', core.jsx(Link$1, {
    href: "https://github.com/umdjs/umd"
  }, "UMD"), " build in your npm package (not your repo, that's different!)."), core.jsx("p", null, "You can do this easily using the following setup:"), core.jsx("ul", null, core.jsx("li", null, "Add the ", core.jsx("code", null, "umd"), " (or ", core.jsx("code", null, "dist"), ") directory to your", ' ', core.jsx("code", null, ".gitignore"), " file"), core.jsx("li", null, "Add the ", core.jsx("code", null, "umd"), " directory to your", ' ', core.jsx(Link$1, {
    href: "https://docs.npmjs.com/files/package.json#files"
  }, "files array"), ' ', "in ", core.jsx("code", null, "package.json")), core.jsx("li", null, "Use a build script to generate your UMD build in the", ' ', core.jsx("code", null, "umd"), " directory when you publish")), core.jsx("p", null, "That's it! Now when you ", core.jsx("code", null, "npm publish"), " you'll have a version available on unpkg as well."), core.jsx("h3", {
    css: {
      fontSize: '1.6em'
    },
    id: "about"
  }, "About"), core.jsx("p", null, "unpkg is an", ' ', core.jsx(Link$1, {
    href: "https://github.com/mjackson/unpkg"
  }, "open source"), ' ', "project built and maintained by", ' ', core.jsx(Link$1, {
    href: "https://twitter.com/mjackson"
  }, "Michael Jackson"), ". unpkg is not affiliated with or supported by npm, Inc. in any way. Please do not contact npm for help with unpkg. Instead, please reach out to ", core.jsx(Link$1, {
    href: "https://twitter.com/unpkg"
  }, "@unpkg"), " with any questions or concerns."), core.jsx("p", null, "The unpkg CDN is powered by", ' ', core.jsx(Link$1, {
    href: "https://www.cloudflare.com"
  }, "Cloudflare"), ", one of the world's largest and fastest cloud network platforms.", ' ', hasStats && core.jsx("span", null, "In the past month, Cloudflare served over", ' ', core.jsx("strong", null, formatBytes(stats.totals.bandwidth.all)), " to", ' ', core.jsx("strong", null, formatNumber(stats.totals.uniques.all)), " unique unpkg users all over the world.")), core.jsx("div", {
    css: {
      margin: '4em 0',
      display: 'flex',
      justifyContent: 'center'
    }
  }, core.jsx(AboutLogo, null, core.jsx("a", {
    href: "https://www.cloudflare.com"
  }, core.jsx(AboutLogoImage, {
    alt: "Cloudflare",
    src: CloudflareLogo,
    height: "100"
  })))), core.jsx("p", null, "The origin server runs on auto-scaling infrastructure provided by", ' ', core.jsx(Link$1, {
    href: "https://fly.io/"
  }, "Fly.io"), ". The app servers run in 17 cities around the world, and come and go based on active requests."), core.jsx("div", {
    css: {
      margin: '4em 0 0',
      display: 'flex',
      justifyContent: 'center'
    }
  }, core.jsx(AboutLogo, null, core.jsx("a", {
    href: "https://fly.io"
  }, core.jsx(AboutLogoImage, {
    alt: "Fly.io",
    src: FlyLogo,
    width: "320"
  })))))), core.jsx("footer", {
    css: {
      marginTop: '5rem',
      background: 'black',
      color: '#aaa'
    }
  }, core.jsx("div", {
    css: {
      maxWidth: 740,
      padding: '10px 20px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, core.jsx("p", null, core.jsx("span", null, "Build: ", buildId$1)), core.jsx("p", null, core.jsx("span", null, "\xA9 ", new Date().getFullYear(), " UNPKG")), core.jsx("p", {
    css: {
      fontSize: '1.5rem'
    }
  }, core.jsx("a", {
    href: "https://twitter.com/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      ':hover': {
        color: 'white'
      }
    }
  }, core.jsx(TwitterIcon$1, null)), core.jsx("a", {
    href: "https://github.com/mjackson/unpkg",
    css: {
      color: '#aaa',
      display: 'inline-block',
      marginLeft: '1rem',
      ':hover': {
        color: 'white'
      }
    }
  }, core.jsx(GitHubIcon$1, null))))));
}

if (process.env.NODE_ENV !== 'production') {
  App$1.propTypes = {
    location: PropTypes.object,
    children: PropTypes.node
  };
}

const doctype$1 = '<!DOCTYPE html>';
const globalURLs$1 = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging' ? {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.production.min.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.production.min.js'
} : {
  '@emotion/core': '/@emotion/core@10.0.6/dist/core.umd.min.js',
  react: '/react@16.8.6/umd/react.development.js',
  'react-dom': '/react-dom@16.8.6/umd/react-dom.development.js'
};
function serveMainPage(req, res) {
  const content = createHTML$1(server$1.renderToString(React.createElement(App$1)));
  const elements = getScripts('main', 'iife', globalURLs$1);
  const html = doctype$1 + server$1.renderToStaticMarkup(React.createElement(MainTemplate, {
    content,
    elements
  }));
  res.set({
    'Cache-Control': 'public, max-age=14400',
    // 4 hours
    'Cache-Tag': 'main'
  }).send(html);
}

const bareIdentifierFormat = /^((?:@[^/]+\/)?[^/]+)(\/.*)?$/;

function isValidURL(value) {
  return URL.parseURL(value) != null;
}

function isProbablyURLWithoutProtocol(value) {
  return value.substr(0, 2) === '//';
}

function isAbsoluteURL(value) {
  return isValidURL(value) || isProbablyURLWithoutProtocol(value);
}

function isBareIdentifier(value) {
  return value.charAt(0) !== '.' && value.charAt(0) !== '/';
}

function rewriteValue(
/* StringLiteral */
node, origin, dependencies) {
  if (isAbsoluteURL(node.value)) {
    return;
  }

  if (isBareIdentifier(node.value)) {
    // "bare" identifier
    const match = bareIdentifierFormat.exec(node.value);
    const packageName = match[1];
    const file = match[2] || '';
    warning(dependencies[packageName], 'Missing version info for package "%s" in dependencies; falling back to "latest"', packageName);
    const version = dependencies[packageName] || 'latest';
    node.value = `${origin}/${packageName}@${version}${file}?module`;
  } else {
    // local path
    node.value = `${node.value}?module`;
  }
}

function unpkgRewrite(origin, dependencies = {}) {
  return {
    manipulateOptions(opts, parserOpts) {
      parserOpts.plugins.push('dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom', 'importMeta');
    },

    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') {
          // Some other function call, not import();
          return;
        }

        rewriteValue(path.node.arguments[0], origin, dependencies);
      },

      ExportAllDeclaration(path) {
        rewriteValue(path.node.source, origin, dependencies);
      },

      ExportNamedDeclaration(path) {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return;
        }

        rewriteValue(path.node.source, origin, dependencies);
      },

      ImportDeclaration(path) {
        rewriteValue(path.node.source, origin, dependencies);
      }

    }
  };
}

const origin = process.env.ORIGIN || 'https://unpkg.com';
function rewriteBareModuleIdentifiers(code, packageConfig) {
  const dependencies = Object.assign({}, packageConfig.peerDependencies, packageConfig.dependencies);
  const options = {
    // Ignore .babelrc and package.json babel config
    // because we haven't installed dependencies so
    // we can't load plugins; see #84
    babelrc: false,
    // Make a reasonable attempt to preserve whitespace
    // from the original file. This ensures minified
    // .mjs stays minified; see #149
    retainLines: true,
    plugins: [unpkgRewrite(origin, dependencies), '@babel/plugin-proposal-optional-chaining', '@babel/plugin-proposal-nullish-coalescing-operator']
  };
  return babel.transform(code, options).code;
}

// TODO: ReUse the new serveMarkdownModule
function serveHTMLModule(req, res) {
  try {
    const $ = cheerio.load(req.entry.content.toString('utf8'));
    $('script[type=module]').each((index, element) => {
      $(element).html(rewriteBareModuleIdentifiers($(element).html(), req.packageConfig));
    });
    const code = $.html();
    res.set({
      'Content-Length': Buffer.byteLength(code),
      'Content-Type': getContentTypeHeader(req.entry.contentType),
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      ETag: etag(code),
      'Cache-Tag': 'file, html-file, html-module'
    }).send(code);
  } catch (error) {
    console.error(error);
    const errorName = error.constructor.name;
    const errorMessage = error.message.replace(/^.*?\/unpkg-.+?\//, `/${req.packageSpec}/`);
    const codeFrame = error.codeFrame;
    const debugInfo = `${errorName}: ${errorMessage}\n\n${codeFrame}`;
    res.status(500).type('text').send(`Cannot generate module for ${req.packageSpec}${req.filename}\n\n${debugInfo}`);
  }
}

function serveJavaScriptModule(req, res) {
  try {
    const code = rewriteBareModuleIdentifiers(req.entry.content.toString('utf8'), req.packageConfig);
    res.set({
      'Content-Length': Buffer.byteLength(code),
      'Content-Type': getContentTypeHeader(req.entry.contentType),
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      ETag: etag(code),
      'Cache-Tag': 'file, js-file, js-module'
    }).send(code);
  } catch (error) {
    console.error(error);
    const errorName = error.constructor.name;
    const errorMessage = error.message.replace(/^.*?\/unpkg-.+?\//, `/${req.packageSpec}/`);
    const codeFrame = error.codeFrame;
    const debugInfo = `${errorName}: ${errorMessage}\n\n${codeFrame}`;
    res.status(500).type('text').send(`Cannot generate module for ${req.packageSpec}${req.filename}\n\n${debugInfo}`);
  }
}

function serveModule(req, res) {
  if (req.entry.contentType === 'application/javascript') {
    return serveJavaScriptModule(req, res);
  }

  if (req.entry.contentType === 'text/html') {
    return serveHTMLModule(req, res);
  }

  res.status(403).type('text').send('module mode is available only for JavaScript and HTML files');
}

const cloudflareURL = 'https://api.cloudflare.com/client/v4';
const cloudflareEmail = process.env.CLOUDFLARE_EMAIL;
const cloudflareKey = process.env.CLOUDFLARE_KEY;

if (process.env.NODE_ENV !== 'production') {
  if (!cloudflareEmail) {
    throw new Error('Missing the $CLOUDFLARE_EMAIL environment variable');
  }

  if (!cloudflareKey) {
    throw new Error('Missing the $CLOUDFLARE_KEY environment variable');
  }
}

function get$1(path, headers) {
  return fetch$1(`${cloudflareURL}${path}`, {
    headers: Object.assign({}, headers, {
      'X-Auth-Email': cloudflareEmail,
      'X-Auth-Key': cloudflareKey
    })
  });
}

function getJSON(path, headers) {
  return get$1(path, headers).then(res => {
    return res.json();
  }).then(data => {
    if (!data.success) {
      console.error(`cloudflare.getJSON failed at ${path}`);
      console.error(data);
      throw new Error('Failed to getJSON from Cloudflare');
    }

    return data.result;
  });
}

function getZones(domains) {
  return Promise.all((Array.isArray(domains) ? domains : [domains]).map(domain => getJSON(`/zones?name=${domain}`))).then(results => results.reduce((memo, zones) => memo.concat(zones)));
}

function reduceResults(target, values) {
  Object.keys(values).forEach(key => {
    const value = values[key];

    if (typeof value === 'object' && value) {
      target[key] = reduceResults(target[key] || {}, value);
    } else if (typeof value === 'number') {
      target[key] = (target[key] || 0) + values[key];
    }
  });
  return target;
}

function getZoneAnalyticsDashboard(zones, since, until) {
  return Promise.all((Array.isArray(zones) ? zones : [zones]).map(zone => {
    return getJSON(`/zones/${zone.id}/analytics/dashboard?since=${since.toISOString()}&until=${until.toISOString()}`);
  })).then(results => results.reduce(reduceResults));
}

function extractPublicInfo(data) {
  return {
    since: data.since,
    until: data.until,
    requests: {
      all: data.requests.all,
      cached: data.requests.cached,
      country: data.requests.country,
      status: data.requests.http_status
    },
    bandwidth: {
      all: data.bandwidth.all,
      cached: data.bandwidth.cached,
      country: data.bandwidth.country
    },
    threats: {
      all: data.threats.all,
      country: data.threats.country
    },
    uniques: {
      all: data.uniques.all
    }
  };
}

const DomainNames = ['unpkg.com', 'npmcdn.com'];
async function getStats(since, until) {
  const zones = await getZones(DomainNames);
  const dashboard = await getZoneAnalyticsDashboard(zones, since, until);
  return {
    timeseries: dashboard.timeseries.map(extractPublicInfo),
    totals: extractPublicInfo(dashboard.totals)
  };
}

function serveStats(req, res) {
  let since, until;

  if (req.query.period) {
    switch (req.query.period) {
      case 'last-day':
        until = dateFns.startOfDay(new Date());
        since = dateFns.subDays(until, 1);
        break;

      case 'last-week':
        until = dateFns.startOfDay(new Date());
        since = dateFns.subDays(until, 7);
        break;

      case 'last-month':
      default:
        until = dateFns.startOfDay(new Date());
        since = dateFns.subDays(until, 30);
    }
  } else {
    until = req.query.until ? new Date(req.query.until) : dateFns.startOfDay(new Date());
    since = req.query.since ? new Date(req.query.since) : dateFns.subDays(until, 1);
  }

  if (isNaN(since.getTime())) {
    return res.status(403).send({
      error: '?since is not a valid date'
    });
  }

  if (isNaN(until.getTime())) {
    return res.status(403).send({
      error: '?until is not a valid date'
    });
  }

  if (until <= since) {
    return res.status(403).send({
      error: '?until date must come after ?since date'
    });
  }

  if (until >= new Date()) {
    return res.status(403).send({
      error: '?until must be a date in the past'
    });
  }

  getStats(since, until).then(stats => {
    res.set({
      'Cache-Control': 'public, max-age=3600',
      // 1 hour
      'Cache-Tag': 'stats'
    }).send(stats);
  }, error => {
    console.error(error);
    res.status(500).send({
      error: 'Unable to fetch stats'
    });
  });
}

function createSearch(query) {
  const keys = Object.keys(query).sort();
  const pairs = keys.reduce((memo, key) => memo.concat(query[key] == null || query[key] === '' ? key : `${key}=${encodeURIComponent(query[key])}`), []);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

/**
 * Reject URLs with invalid query parameters to increase cache hit rates.
 */

function allowQuery(validKeys = []) {
  if (!Array.isArray(validKeys)) {
    validKeys = [validKeys];
  }

  return (req, res, next) => {
    const keys = Object.keys(req.query);

    if (!keys.every(key => validKeys.includes(key))) {
      const newQuery = keys.filter(key => validKeys.includes(key)).reduce((query, key) => {
        query[key] = req.query[key];
        return query;
      }, {});
      return res.redirect(302, req.baseUrl + req.path + createSearch(newQuery));
    }

    next();
  };
}

const createPackageURL = (packageName, packageVersion, filename, query) =>
  `/${packageName}${packageVersion ? `@${packageVersion}` : ''}${filename || ''}${query ? createSearch(query) : ''}`;

function fileRedirect(req, res, entry) {
  // Redirect to the file with the extension so it's
  // clear which file is being served.
  res.set({
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Cache-Tag': 'redirect, file-redirect'
  }).redirect(302, createPackageURL(req.packageName, req.packageVersion, entry.path, req.query));
}

function indexRedirect(req, res, entry) {
  // Redirect to the index file so relative imports
  // resolve correctly.
  res.set({
    'Cache-Control': 'public, max-age=31536000',
    // 1 year
    'Cache-Tag': 'redirect, index-redirect'
  }).redirect(302, createPackageURL(req.packageName, req.packageVersion, entry.path, req.query));
}
/**
 * Search the given tarball for entries that match the given name.
 * Follows node's resolution algorithm.
 * https://nodejs.org/api/modules.html#modules_all_together
 */


function searchEntries(stream, filename) {
  // filename = /some/file/name.js or /some/dir/name
  return new Promise((accept, reject) => {
    const jsEntryFilename = `${filename}.js`;
    const jsonEntryFilename = `${filename}.json`;
    const matchingEntries = {};
    let foundEntry;

    if (filename === '/') {
      foundEntry = matchingEntries['/'] = {
        name: '/',
        type: 'directory'
      };
    }

    stream.pipe(tar.extract()).on('error', reject).on('entry', async (header, stream, next) => {
      const entry = {
        // Most packages have header names that look like `package/index.js`
        // so we shorten that to just `index.js` here. A few packages use a
        // prefix other than `package/`. e.g. the firebase package uses the
        // `firebase_npm/` prefix. So we just strip the first dir name.
        path: header.name.replace(/^[^/]+/g, ''),
        type: header.type
      }; // Skip non-files and files that don't match the entryName.

      if (entry.type !== 'file' || !entry.path.startsWith(filename)) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      matchingEntries[entry.path] = entry; // Dynamically create "directory" entries for all directories
      // that are in this file's path. Some tarballs omit these entries
      // for some reason, so this is the "brute force" method.

      let dir = path.dirname(entry.path);

      while (dir !== '/') {
        if (!matchingEntries[dir]) {
          matchingEntries[dir] = {
            name: dir,
            type: 'directory'
          };
        }

        dir = path.dirname(dir);
      }

      if (entry.path === filename || // Allow accessing e.g. `/index.js` or `/index.json`
      // using `/index` for compatibility with npm
      entry.path === jsEntryFilename || entry.path === jsonEntryFilename) {
        if (foundEntry) {
          if (foundEntry.path !== filename && (entry.path === filename || entry.path === jsEntryFilename && foundEntry.path === jsonEntryFilename)) {
            // This entry is higher priority than the one
            // we already found. Replace it.
            delete foundEntry.content;
            foundEntry = entry;
          }
        } else {
          foundEntry = entry;
        }
      }

      try {
        const content = await bufferStream(stream);
        entry.contentType = getContentType(entry.path);
        entry.integrity = getIntegrity(content);
        entry.lastModified = header.mtime.toUTCString();
        entry.size = content.length; // Set the content only for the foundEntry and
        // discard the buffer for all others.

        if (entry === foundEntry) {
          entry.content = content;
        }

        next();
      } catch (error) {
        next(error);
      }
    }).on('finish', () => {
      accept({
        // If we didn't find a matching file entry,
        // try a directory entry with the same name.
        foundEntry: foundEntry || matchingEntries[filename] || null,
        matchingEntries: matchingEntries
      });
    });
  });
}
/**
 * Fetch and search the archive to try and find the requested file.
 * Redirect to the "index" file if a directory was requested.
 */


async function findEntry$2(req, res, next) {
  const stream = await getPackage(req.packageName, req.packageVersion, req.log);
  const {
    foundEntry: entry,
    matchingEntries: entries
  } = await searchEntries(stream, req.filename);

  if (!entry) {
    return res.status(404).set({
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      'Cache-Tag': 'missing, missing-entry'
    }).type('text').send(`Cannot find "${req.filename}" in ${req.packageSpec}`);
  }

  if (entry.type === 'file' && entry.path !== req.filename) {
    return fileRedirect(req, res, entry);
  }

  if (entry.type === 'directory') {
    // We need to redirect to some "index" file inside the directory so
    // our URLs work in a similar way to require("lib") in node where it
    // uses `lib/index.js` when `lib` is a directory.
    const indexEntry = entries[`${req.filename}/index.js`] || entries[`${req.filename}/index.json`];

    if (indexEntry && indexEntry.type === 'file') {
      return indexRedirect(req, res, indexEntry);
    }

    return res.status(404).set({
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      'Cache-Tag': 'missing, missing-index'
    }).type('text').send(`Cannot find an index in "${req.filename}" in ${req.packageSpec}`);
  }

  req.entry = entry;
  next();
}

var findEntry$3 = asyncHandler(findEntry$2);

/**
 * Strips all query params from the URL to increase cache hit rates.
 */
function noQuery() {
  return (req, res, next) => {
    const keys = Object.keys(req.query);

    if (keys.length) {
      return res.redirect(302, req.baseUrl + req.path);
    }

    next();
  };
}

/**
 * Redirect old URLs that we no longer support.
 */

function redirectLegacyURLs(req, res, next) {
  // Permanently redirect /_meta/path to /path?meta
  if (req.path.match(/^\/_meta\//)) {
    req.query.meta = '';
    return res.redirect(301, req.path.substr(6) + createSearch(req.query));
  } // Permanently redirect /path?json => /path?meta


  if (req.query.json != null) {
    delete req.query.json;
    req.query.meta = '';
    return res.redirect(301, req.path + createSearch(req.query));
  }

  next();
}

const enableDebugging = process.env.DEBUG != null;

function noop() {}

function createLog(req) {
  return {
    debug: enableDebugging ? (format, ...args) => {
      console.log(util.format(format, ...args));
    } : noop,
    info: (format, ...args) => {
      console.log(util.format(format, ...args));
    },
    error: (format, ...args) => {
      console.error(util.format(format, ...args));
    }
  };
}

function requestLog(req, res, next) {
  req.log = createLog(req);
  next();
}

function filenameRedirect(req, res) {

}
/**
 * Redirect to the exact filename if the request omits one.
 */


async function validateFilename(req, res, next) {
  if (!req.filename) {
    let filename;

    if (req.query.module != null) {
      // See https://github.com/rollup/rollup/wiki/pkg.module
      filename = req.packageConfig.module || req.packageConfig['jsnext:main'];
  
      if (!filename) {
        // https://nodejs.org/api/esm.html#esm_code_package_json_code_code_type_code_field
        if (req.packageConfig.type === 'module') {
          // Use whatever is in pkg.main or index.js
          filename = req.packageConfig.main || '/index.js';
        } else if (req.packageConfig.main && /\.mjs$/.test(req.packageConfig.main)) {
          // Use .mjs file in pkg.main
          filename = req.packageConfig.main;
        }
      }
  
      if (!filename) {
        return res.status(404).type('text').send(`Package ${req.packageSpec} does not contain an ES module`);
      }
    } else if (req.query.main && req.packageConfig[req.query.main] && typeof req.packageConfig[req.query.main] === 'string') {
      // Deprecated, see #63
      filename = req.packageConfig[req.query.main];
    } else if (req.packageConfig.unpkg && typeof req.packageConfig.unpkg === 'string') {
      filename = req.packageConfig.unpkg;
    } else if (req.packageConfig.browser && typeof req.packageConfig.browser === 'string') {
      // Deprecated, see #63
      filename = req.packageConfig.browser;
    } else {
      filename = req.packageConfig.main || '/index.js';
    } // Redirect to the exact filename so relative imports
    // and URLs resolve correctly.
  
  
    res.set({
      'Cache-Control': 'public, max-age=31536000',
      // 1 year
      'Cache-Tag': 'redirect, filename-redirect'
    }).redirect(302, createPackageURL(req.packageName, req.packageVersion, filename.replace(/^[./]*/, '/'), req.query));
    return 
  }

  next();
}


/**
 * Parse the pathname in the URL. Reject invalid URLs.
 */

const validatePackagePathname = async (req, res, next) => {
  const packagePathnameFormat = /^\/((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(\/.*)?$/;
  const url = new URL(req.originalUrl,req.headers.host);
  const [packageName,packageVersion='latest',filenameBase=''] = packagePathnameFormat.exec(url.pathname) || []; // Disallow invalid pathnames.

  if (!packageName) {
    return res.status(403).send({
      error: `Invalid URL: ${req.path}`
    });
  };
  // const packageName = match[1];
  // const packageVersion = match[2] || 'latest';
  const filename = filenameBase.replace(/\/\/+/g, '/');
  const parsed = {
    // /@scope/name@version/file.js:
    packageName,
    // @scope/name
    packageVersion,
    // version
    packageSpec: `${packageName}@${packageVersion}`,
    // @scope/name@version
    filename // /file.js
  };

  req.packageName = parsed.packageName;
  req.packageVersion = parsed.packageVersion;
  req.packageSpec = parsed.packageSpec;
  req.filename = parsed.filename;
  // validatePackageName
  if (isHash(req.packageName)) {
    return res.status(403).type('text').send(`Invalid package name "${req.packageName}" (cannot be a hash)`);
  }

  const errors = validateNpmPackageName(req.packageName).errors;

  if (errors) {
    const reason = errors.join(', ');
    return res.status(403).type('text').send(`Invalid package name "${req.packageName}" (${reason})`);
  }

  // validateVersion versionsAndTags
  try {
    const { versions, tags } = await getVersionsAndTags(req.packageName, req.log) || {};

    if (!versions) {
      return res.status(404).type('text').send(`Cannot find package ${req.packageSpec}`);  
    }
    
    if (req.range in tags) {
      req.range = tags[req.range];
    }

    const newVersion = versions.includes(req.range) ? req.range : semver.maxSatisfying(versions, req.range);
    if (newVersion !== req.packageVersion) {
      return   res.set({
        'Cache-Control': 'public, s-maxage=600, max-age=60',
        // 10 mins on CDN, 1 min on clients
        'Cache-Tag': 'redirect, semver-redirect'
      }).redirect(302, req.baseUrl + createPackageURL(req.packageName, newVersion, req.filename, req.query));
    }

    req.packageConfig = await getPackageConfig(req.packageName, req.packageVersion, req.log);

    if (!req.packageConfig) {
      return res.status(500).type('text').send(`Cannot get config for package ${req.packageSpec}`);
    }
    next();
  } catch(e) {
    req.log.error(e.stack);
    next(e)
  }  
}

const hexValue = /^[a-f0-9]+$/i;

function isHash(value) {
  return value.length === 32 && hexValue.test(value);
}



const app = express();
app.disable('x-powered-by');
app.enable('trust proxy');
app.enable('strict routing');

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(cors());
app.use(express.static('public', {
  maxAge: '1y'
}));
app.use(requestLog);
app.get('/', serveMainPage);
app.get('/api/stats', serveStats);
app.use(redirectLegacyURLs);
app.enable('strict routing');
app.get('/browse/*/', noQuery(), validatePackagePathname, serveDirectoryBrowser$1);
app.get('/browse/*', noQuery(), validatePackagePathname, serveFileBrowser$1); // We need to route in this weird way because Express
// doesn't have a way to route based on query params.

const metaRouter = express.Router();
metaRouter.get('*/', allowQuery('meta'), validatePackagePathname, validateFilename, serveDirectoryMetadata$1);
metaRouter.get('*', allowQuery('meta'), validatePackagePathname, validateFilename, serveFileMetadata$1);
app.get('/meta', metaRouter);
const moduleRouter = express.Router();
moduleRouter.get('*', allowQuery('module'), validatePackagePathname, validateFilename, findEntry$3, serveModule);
app.get('/module', moduleRouter);
app.get((req, res, next) => {
  if (req.query.meta != null) {
    metadataRouter(req, res);
  } if (req.query.module != null) {
    moduleRouter(req, res);
  } else {
    next();
  }
});
app.get('*/', (req, res) => {
  res.redirect(302, '/browse' + req.url);
});
app.get('*', noQuery(), validatePackagePathname, validateFilename, findEntry$3, serveFile);

const port = process.env.PORT || '8080';
const server = app.listen(port, (req, res) => {
  console.log('Server listening on port %s, Ctrl+C to quit', port);
});

exports.app = app;
exports.metaRouter = metaRouter;
exports.moduleRouter = moduleRouter;
exports.server = server;

