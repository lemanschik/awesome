/* globals Blob: false, Promise: false, console: false, Worker: false, ProgressivePromise: false */

const { URL } = require("url");

const workerScript = () => {

class UntarStream {
    constructor(arrayBuffer) {
        this._bufferView = new DataView(arrayBuffer);
        this._position = 0;
    }
    
    readString(charCount) {
		//console.log("readString: position " + this.position() + ", " + charCount + " chars");
		const charCodes = [];
		for (let i = 0; i < charCount; ++i) {
			const charCode = this._bufferView.getUint8(this.position() + i, true);
			if (charCode !== 0) {
				charCodes.push(charCode);
			} else {
				break;
			}
		}
        this._position += charCount;
		return String.fromCharCode.apply(null, charCodes);
	}

    readBuffer(byteCount) {
		const arrayBuffer = this._bufferView.buffer.slice(this.position(), this.position() + byteCount);
		this._position += byteCount;
		return arrayBuffer;
	}
    peekUint32() {
		
	}
    position(newpos) {
		if (newpos === undefined) {
			return this._position;
		} else {
			this._position = newpos;
		}
	}

    size() {
		return this._bufferView.byteLength;
	}
}

    const PaxHeader = (arrayBuffer) => {
        // https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.3.0/com.ibm.zos.v2r3.bpxa500/paxex.htm
        // An extended header shall consist of one or more records, each constructed as follows:
        // "%d %s=%s\n", <length>, <keyword>, <value>

        // The extended header records shall be encoded according to the ISO/IEC10646-1:2000 standard (UTF-8).
        // The <length> field, <blank>, equals sign, and <newline> shown shall be limited to the portable character set, as
        // encoded in UTF-8. The <keyword> and <value> fields can be any UTF-8 characters. The <length> field shall be the
        // decimal length of the extended header record in octets, including the trailing <newline>.
        let arrayView = new Uint8Array(arrayBuffer);
        const fields = [];
        // TODO Benchmark agains decideUTF8(arrayView)
        
        const UTF8 = new TextDecoder('utf8');
        while (arrayView.length > 0) {
            // Decode arrayView up to the first space character; that is the total field length
            const fieldLength = parseInt(UTF8.decode(arrayView.subarray(0, arrayView.indexOf(0x20))));
            const fieldText = UTF8.decode(arrayView.subarray(0, fieldLength));
            const fieldMatch = fieldText.match(/^\d+ ([^=]+)=(.*)\n$/);

            if (fieldMatch === null) {
                throw new Error("Invalid PAX header data format.");
            }

            const fieldName = fieldMatch[1];
            const fieldValue = fieldMatch[2] && parseInt(fieldMatch[2]).toString() !== 'NaN' 
            // Don't parse float values since precision is lost    
            && fieldMatch[2].indexOf('.') === -1 ? parseInt(fieldMatch[2]) : fieldMatch[2];
            
            fields.push({
                name: fieldName,
                value: fieldValue || undefined,
            });
            
            arrayView = arrayView.subarray(fieldLength); // jump to next fild
        }
        
        return ({ applyHeader(file) {
            // If a field is of value null, it should be deleted from the file
            // https://www.mkssoftware.com/docs/man4/pax.4.asp
            fields.forEach(({name, value}) => {
                const fieldName = name === "path" 
                    // This overrides the name and prefix fields in the following header block.
                    ? 'name' 
                    : name === "linkpath" 
                    // This overrides the linkname field in the following header block.
                    ? 'linkname' 
                    : name;
                
                fieldName === "path" && delete file.prefix            
                !value ? delete file[fieldName] : file[fieldName] = value;
            });
        }});

    }

    class UntarArrayBufferStream {
        constructor(arrayBuffer) {
            this._stream = new UntarStream(arrayBuffer);
            this._paxHeader = null;
        }
        done() {   // A tar file ends with 4 zero bytes
            return !(this._stream.position() + 4 < this._stream.size() && this._bufferView.getUint32(this.position(), true) !== 0);
        }
        next() {
            return this._readNextFile();
        }
        [Symbol.iterator]() {
            return this;
        }
        _readNextFile() {
            // A tar file ends with 4 zero bytes
            const done = !(this._stream.position() + 4 < this._stream.size() && this._bufferView.getUint32(this.position(), true) !== 0);
            if (done) return { done };
            
            const stream = this._stream;
            
            const headerBeginPos = stream.position();
            const dataBeginPos = headerBeginPos + 512;
            
            // Read header
            const file = {
                name: stream.readString(100),
                mode: stream.readString(8),
                uid: parseInt(stream.readString(8)),
                gid: parseInt(stream.readString(8)),
                size: parseInt(stream.readString(12), 8),
                mtime: parseInt(stream.readString(12), 8),
                checksum: parseInt(stream.readString(8)),
                type: stream.readString(1),
                linkname: stream.readString(100),
                ustarFormat: stream.readString(6),
            };

            if (file.ustarFormat.includes("ustar")) {
                if (file.namePrefix.length > 0) {
                    file.name = `${file.namePrefix}/${file.name}`;
                }
                file.version = stream.readString(2);
                file.uname = stream.readString(32);
                file.gname = stream.readString(32);
                file.devmajor = parseInt(stream.readString(8));
                file.devminor = parseInt(stream.readString(8));
                file.namePrefix = stream.readString(155);
            }

            stream.position(dataBeginPos);
            
            let isHeaderFile = false;
            let paxHeader = null;
            
            // Derived from https://www.mkssoftware.com/docs/man4/pax.4.asp
            // and https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.3.0/com.ibm.zos.v2r3.bpxa500/pxarchfm.htm
            switch (file.type) {
                case "0": // Normal file is either "0" or "\0".
                case "": // In case of "\0", readString returns an empty string, that is "".
                    file.arrayBuffer = stream.readBuffer(file.size);
                    break;
                case "g": // Global PAX header
                    isHeaderFile = true;
                    this._paxHeader = PaxHeader(stream.readBuffer(file.size));
                    break;
                case "x": // PAX header
                    isHeaderFile = true;
                    paxHeader = PaxHeader(stream.readBuffer(file.size))
                    break;
                case "1": // Link to another file already archived
                    // TODO Should we do anything with these?
                    break;
                case "2": // Symbolic link
                    // TODO Should we do anything with these?
                    break;
                case "3": // Character special device (what does this mean??)
                case "4": // Block special device
                case "5": // Directory
                case "6": // FIFO special file
                case "7": // Reserved
                default: // Unknown file type
                    break;
            }

            if (file.arrayBuffer === undefined) {
                file.arrayBuffer = new ArrayBuffer(0);
            }

            let dataEndPos = dataBeginPos + file.size;

            // File data is padded to reach a 512 byte boundary; skip the padded bytes too.
            if (file.size % 512 !== 0) {
                dataEndPos += 512 - (file.size % 512);
            }

            stream.position(dataEndPos);
            // a PaxHeader Modifies the nextFile
            if (isHeaderFile) {
                const nextFile = this._readNextFile();
                if (this._paxHeader !== null) {
                    this._paxHeader.applyHeader(nextFile);
                }
        
                if (paxHeader !== null) {
                    paxHeader.applyHeader(nextFile);
                }    
                return nextFile;
            }
            
            return { value: file, done };
        }
    }

    // Registers or executes service worker 
    if (typeof self !== "undefined") {
        const worker = self;
        worker.onmessage = async ({ uri }) => {
            if (!uri) return worker.postMessage({ error: new Error(`Unknown message type: ${msg}`) });
            try {
                for (const file of new UntarArrayBufferStream(await (await fetch(uri)).arrayBuffer())) {       
                    worker.postMessage({ file: file }, [file.arrayBuffer]);
                }
                worker.postMessage({ done: true });
            } catch (message) {
                worker.postMessage({ error: message });
            }
        }
    } else {
        // Generating the serviceWorkerModule from this function.
        return new Worker(URL.createObjectURL(
            new Blob([`(${workerScript})()`],
            {type: 'application/javascript'})
        ));
    }
}

// Frontend code
export const untar = (uri) => {
    const worker = workerScript();
    return new ReadableStream({ start(progress) {
		worker.onerror = err => progress.cancel(err);
		worker.onmessage = ({data: message}) => {
			const methodByType = {
                log: ({ level, msg }) =>
                console[message.level](`Worker: ${messagess.msg}`),
                file: (file) => progress.enqueue(file),
                done: () => progress.close(),
                error: (message) =>
                [new Error(message)].forEach(err=>
                console.error(err)||progress.error(err)),
                default: () => progress.error(new Error(
                `Unknown message from worker: ${message}`)),
            };

            Object.keys(message).find(type=>methodByType(type) 
            && (methodByType[type](message[type]) || true))
            || methodByType('default');
		};

		//console.info("Sending arraybuffer to worker for fileion.");
        response.arrayBuffer().then(()=>worker.postMessage({ uri }));
    }, close(){
        worker.terminate();
    }});
}

export const blobURLCache = new WeakMap();
export const blob = (file) => new Response(file.arrayBuffer).blob;
export const blobUrl = (file) => () => /** @type {URL} */ 
    (blobURLCache.get(file) || 
    blobURLCache.set(file, URL.createObjectURL(IFile.blob(file)))
    .get(file));
export const readAsString = (file) => new Response(file.arrayBuffer).text;
export const readAsJSON = (file) => new Response(file.arrayBuffer).json;

export const decorateExtractedFile = (file) => {
    class IFile {
        blob = blob(file);
        blobUrl = blobUrl(file);
        readAsString = readAsString(file);
        readAsJSON = readAsJSON(file);
    }
	return Object.assign(file, new IFile());
}
