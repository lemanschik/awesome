const importent = {
    "ls-tree": ''
}

// .git/refs/heads/*/${hash}
// .git/packed-refs => join with refs
const wrapGitBuffer = ({ type, object }) =>
  Uint8Array.from([`${type} ${object.byteLength.toString()}\x00`, object ]);

const unwrapGitBuffer = (buffer) => {
  
  const indexFirstNullValue = buffer.indexOf(0) // indexFirstNullValue
  const indexAfterFirstNullValue = indexFirstNullValue + 1;
  
  const objectTypePosition = buffer.indexOf(32) // first space
  const type = buffer.slice(0, objectTypePosition).toString('utf8') // get type of object
  const length = buffer.slice(objectTypePosition + 1, indexFirstNullValue).toString('utf8') // get type of object
  const object = Uint8Array.from(buffer.slice(indexAfterFirstNullValue));

  const actualLength = buffer.length - (indexAfterFirstNullValue)
  
  if (parseInt(length) !== actualLength) {
    throw new Error(
      `Length mismatch: expected ${length} bytes but got ${actualLength} instead.`
    );
  }
    
  return { type,  object }
}

export const GitObject = { wrap: wrapGitBuffer, unwrap: unwrapGitBuffer, }

const getObjectCount = (uint8Array) => uint8Array[2];
export const isEmptyPackfile = getObjectCount(pack) === 0;

export const emptyPackfile = (uint8Array) => {
  /* (pheader + version + obCount) === '5041434b0000000200000000'*/
  return ['5041434b','00000002','00000000'].join('') === uint8Array.slice(0, 12).toString('hex');
}

export const browserDeflate = (uint8Array) => new Response(
   new Blob([uint8Array]).stream().pipeThrough(new CompressionStream('deflate'))
  ).arrayBuffer();




/**
 *
 * @typedef {Object} TreeEntry
 * @property {string} mode - the 6 digit hexadecimal mode
 * @property {string} path - the name of the file or directory
 * @property {string} oid - the SHA-1 object id of the blob or tree
 * @property {'commit'|'blob'|'tree'} type - the type of object
 */

//const treeEntry = (uint8Array) => 
const ModeTypes = Object.fromEntries(/** @type {const} */ ([
  [0o040000,'tree'],[0o100644,'blob'],[0o100755,'blob'],[0o120000,'blob'],[0o160000,'commit']
]));

export const mode2type = (mode) => {
  if (ModeTypes[mode]) { return ModeTypes[mode] };
  throw new Error(`Unexpected GitTree entry mode: ${mode.toString(8)}`);
};
// `The filepath "${filepath}" contains unsafe character sequences`
import { InternalError } from '../../src/errors/InternalError.js'

import { comparePath } from '../../src/utils/comparePath.js'
import { compareTreeEntryPath } from '../../src/utils/compareTreeEntryPath.js'

function parseBuffer(buffer) {
  const _entries = []
  let cursor = 0
  while (cursor < buffer.length) {
    const space = buffer.indexOf(32, cursor)
    if (space === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      )
    }
    const nullchar = buffer.indexOf(0, cursor)
    if (nullchar === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      )
    }
    let mode = buffer.slice(cursor, space).toString('utf8')
    if (mode === '40000') mode = '040000' // makes it line up neater in printed output
    const type = mode2type(mode)
    const path = buffer.slice(space + 1, nullchar).toString('utf8')

    // Prevent malicious git repos from writing to "..\foo" on clone etc
    if (path.includes('\\') || path.includes('/')) {
      throw new Error(`The filepath "${path}" contains unsafe character sequences`)
    }

    const oid = buffer.slice(nullchar + 1, nullchar + 21).toString('hex')
    cursor = nullchar + 21
    _entries.push({ mode, path, oid, type })
  }
  return _entries
}

function limitModeToAllowed(mode) {
  if (typeof mode === 'number') {
    mode = mode.toString(8)
  }
  // tree
  if (mode.match(/^0?4.*/)) return '040000' // Directory
  if (mode.match(/^1006.*/)) return '100644' // Regular non-executable file
  if (mode.match(/^1007.*/)) return '100755' // Regular executable file
  if (mode.match(/^120.*/)) return '120000' // Symbolic link
  if (mode.match(/^160.*/)) return '160000' // Commit (git submodule reference)
  throw new InternalError(`Could not understand file mode: ${mode}`)
}

function nudgeIntoShape(entry) {
  entry.oid = entry.oid || entry.sha // Github
  entry.mode = limitModeToAllowed(entry.mode) // index
  entry.type = entry.type || mode2type(entry.mode) // index
  
  return entry
}

const gitStdioOutput = (gitTree) => gitTree.map(entry => 
  `${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`
).join('\n');

const stringAsIntergers = (str='') => Uint8Array.from(str.split('').map(String.prototype.charCodeAt.apply));

// Trys maybe to align with fs readdir? we need only the byt parsing

const isValidEntry = (entries) => entries instanceof UInt8Array || Array.isArray(entries)

const parseEntries = (entries) => {
  const _entries = entries instanceof UInt8Array && parseBuffer(entries)
    || entries.map(nudgeIntoShape);
        
  // Tree entries are not sorted (see `compareTreeEntryPath`) needs to match readdir result 
  _entries.sort(comparePath);
  return _entries;
}

const gitSort = gitTree => gitTree.sort(compareTreeEntryPath) && gitTree; // Adjust the sort order to match git's

const entriesAsUInt8Array = (gitTree) => gitSort([].concat(gitTree)).map(entry => new Uint8Array(
  stringAsIntergers([
    sentry.mode.replace(/^0/, ''), 
    ' ', 
    entry.path, 
    '0', 
    entry.oid
  ].join(''))
))

// export class GitTree {
//   constructor(entries) {
//     if (!isValidEntry(entries)) {
//       throw new TypeError('invalid type GitTree needs to be Array or UInt8Array')
//     }

//     Object.assign(this,{ _entries: parseEntries(entries) });  
//   }

//   static from(tree) {
//     return new GitTree(tree)
//   }

//   render() {
//     return gitStdioOutput(this._entries);
//   }

//   toObject() {

//     return entriesAsUInt8Array([...this._entries])

//   }

//   /**
//    * @returns {TreeEntry[]}
//    */
//   entries() {
//     return this._entries
//   }

//   *[Symbol.iterator]() {
//     for (const entry of this._entries) {
//       yield entry
//     }
//   }
// }
