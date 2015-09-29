(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/base64-js/lib/b64.js","/../../node_modules/base64-js/lib")
},{"buffer":2,"rH1JPG":5}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/buffer/index.js","/../../node_modules/buffer")
},{"base64-js":1,"buffer":2,"ieee754":3,"rH1JPG":5}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/ieee754/index.js","/../../node_modules/ieee754")
},{"buffer":2,"rH1JPG":5}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * Object.observe polyfill - v0.2.4
 * by Massimo Artizzu (MaxArt2501)
 * 
 * https://github.com/MaxArt2501/object-observe
 * 
 * Licensed under the MIT License
 * See LICENSE for details
 */

// Some type definitions
/**
 * This represents the data relative to an observed object
 * @typedef  {Object}                     ObjectData
 * @property {Map<Handler, HandlerData>}  handlers
 * @property {String[]}                   properties
 * @property {*[]}                        values
 * @property {Descriptor[]}               descriptors
 * @property {Notifier}                   notifier
 * @property {Boolean}                    frozen
 * @property {Boolean}                    extensible
 * @property {Object}                     proto
 */
/**
 * Function definition of a handler
 * @callback Handler
 * @param {ChangeRecord[]}                changes
*/
/**
 * This represents the data relative to an observed object and one of its
 * handlers
 * @typedef  {Object}                     HandlerData
 * @property {Map<Object, ObservedData>}  observed
 * @property {ChangeRecord[]}             changeRecords
 */
/**
 * @typedef  {Object}                     ObservedData
 * @property {String[]}                   acceptList
 * @property {ObjectData}                 data
*/
/**
 * Type definition for a change. Any other property can be added using
 * the notify() or performChange() methods of the notifier.
 * @typedef  {Object}                     ChangeRecord
 * @property {String}                     type
 * @property {Object}                     object
 * @property {String}                     [name]
 * @property {*}                          [oldValue]
 * @property {Number}                     [index]
 */
/**
 * Type definition for a notifier (what Object.getNotifier returns)
 * @typedef  {Object}                     Notifier
 * @property {Function}                   notify
 * @property {Function}                   performChange
 */
/**
 * Function called with Notifier.performChange. It may optionally return a
 * ChangeRecord that gets automatically notified, but `type` and `object`
 * properties are overridden.
 * @callback Performer
 * @returns {ChangeRecord|undefined}
 */

Object.observe || (function(O, A, root) {
    "use strict";

        /**
         * Relates observed objects and their data
         * @type {Map<Object, ObjectData}
         */
    var observed,
        /**
         * List of handlers and their data
         * @type {Map<Handler, Map<Object, HandlerData>>}
         */
        handlers,

        defaultAcceptList = [ "add", "update", "delete", "reconfigure", "setPrototype", "preventExtensions" ];

    // Functions for internal usage

        /**
         * Checks if the argument is an Array object. Polyfills Array.isArray.
         * @function isArray
         * @param {?*} object
         * @returns {Boolean}
         */
    var isArray = A.isArray || (function(toString) {
            return function (object) { return toString.call(object) === "[object Array]"; };
        })(O.prototype.toString),

        /**
         * Returns the index of an item in a collection, or -1 if not found.
         * Uses the generic Array.indexOf or Array.prototype.indexOf if available.
         * @function inArray
         * @param {Array} array
         * @param {*} pivot           Item to look for
         * @param {Number} [start=0]  Index to start from
         * @returns {Number}
         */
        inArray = A.prototype.indexOf ? A.indexOf || function(array, pivot, start) {
            return A.prototype.indexOf.call(array, pivot, start);
        } : function(array, pivot, start) {
            for (var i = start || 0; i < array.length; i++)
                if (array[i] === pivot)
                    return i;
            return -1;
        },

        /**
         * Returns an instance of Map, or a Map-like object is Map is not
         * supported or doesn't support forEach()
         * @function createMap
         * @returns {Map}
         */
        createMap = typeof root.Map === "undefined" || !Map.prototype.forEach ? function() {
            // Lightweight shim of Map. Lacks clear(), entries(), keys() and
            // values() (the last 3 not supported by IE11, so can't use them),
            // it doesn't handle the constructor's argument (like IE11) and of
            // course it doesn't support for...of.
            // Chrome 31-35 and Firefox 13-24 have a basic support of Map, but
            // they lack forEach(), so their native implementation is bad for
            // this polyfill. (Chrome 36+ supports Object.observe.)
            var keys = [], values = [];

            return {
                size: 0,
                has: function(key) { return inArray(keys, key) > -1; },
                get: function(key) { return values[inArray(keys, key)]; },
                set: function(key, value) {
                    var i = inArray(keys, key);
                    if (i === -1) {
                        keys.push(key);
                        values.push(value);
                        this.size++;
                    } else values[i] = value;
                },
                "delete": function(key) {
                    var i = inArray(keys, key);
                    if (i > -1) {
                        keys.splice(i, 1);
                        values.splice(i, 1);
                        this.size--;
                    }
                },
                forEach: function(callback/*, thisObj*/) {
                    for (var i = 0; i < keys.length; i++)
                        callback.call(arguments[1], values[i], keys[i], this);
                }
            };
        } : function() { return new Map(); },

        /**
         * Simple shim for Object.getOwnPropertyNames when is not available
         * Misses checks on object, don't use as a replacement of Object.keys/getOwnPropertyNames
         * @function getProps
         * @param {Object} object
         * @returns {String[]}
         */
        getProps = O.getOwnPropertyNames ? (function() {
            var func = O.getOwnPropertyNames;
            try {
                arguments.callee;
            } catch (e) {
                // Strict mode is supported

                // In strict mode, we can't access to "arguments", "caller" and
                // "callee" properties of functions. Object.getOwnPropertyNames
                // returns [ "prototype", "length", "name" ] in Firefox; it returns
                // "caller" and "arguments" too in Chrome and in Internet
                // Explorer, so those values must be filtered.
                var avoid = (func(inArray).join(" ") + " ").replace(/prototype |length |name /g, "").slice(0, -1).split(" ");
                if (avoid.length) func = function(object) {
                    var props = O.getOwnPropertyNames(object);
                    if (typeof object === "function")
                        for (var i = 0, j; i < avoid.length;)
                            if ((j = inArray(props, avoid[i++])) > -1)
                                props.splice(j, 1);

                    return props;
                };
            }
            return func;
        })() : function(object) {
            // Poor-mouth version with for...in (IE8-)
            var props = [], prop, hop;
            if ("hasOwnProperty" in object) {
                for (prop in object)
                    if (object.hasOwnProperty(prop))
                        props.push(prop);
            } else {
                hop = O.hasOwnProperty;
                for (prop in object)
                    if (hop.call(object, prop))
                        props.push(prop);
            }

            // Inserting a common non-enumerable property of arrays
            if (isArray(object))
                props.push("length");

            return props;
        },

        /**
         * Return the prototype of the object... if defined.
         * @function getPrototype
         * @param {Object} object
         * @returns {Object}
         */
        getPrototype = O.getPrototypeOf,

        /**
         * Return the descriptor of the object... if defined.
         * IE8 supports a (useless) Object.getOwnPropertyDescriptor for DOM
         * nodes only, so defineProperties is checked instead.
         * @function getDescriptor
         * @param {Object} object
         * @param {String} property
         * @returns {Descriptor}
         */
        getDescriptor = O.defineProperties && O.getOwnPropertyDescriptor,

        /**
         * Sets up the next check and delivering iteration, using
         * requestAnimationFrame or a (close) polyfill.
         * @function nextFrame
         * @param {function} func
         * @returns {number}
         */
        nextFrame = root.requestAnimationFrame || root.webkitRequestAnimationFrame || (function() {
            var initial = +new Date,
                last = initial;
            return function(func) {
                return setTimeout(function() {
                    func((last = +new Date) - initial);
                }, 17);
            };
        })(),

        /**
         * Sets up the observation of an object
         * @function doObserve
         * @param {Object} object
         * @param {Handler} handler
         * @param {String[]} [acceptList]
         */
        doObserve = function(object, handler, acceptList) {

            var data = observed.get(object);

            if (data)
                setHandler(object, data, handler, acceptList);
            else {
                data = createObjectData(object);
                setHandler(object, data, handler, acceptList);
                
                if (observed.size === 1)
                    // Let the observation begin!
                    nextFrame(runGlobalLoop);
            }
        },

        /**
         * Creates the initial data for an observed object
         * @function createObjectData
         * @param {Object} object
         */
        createObjectData = function(object, data) {
            var props = getProps(object),
                values = [], descs, i = 0,
                data = {
                    handlers: createMap(),
                    frozen: O.isFrozen ? O.isFrozen(object) : false,
                    extensible: O.isExtensible ? O.isExtensible(object) : true,
                    proto: getPrototype && getPrototype(object),
                    properties: props,
                    values: values,
                    notifier: retrieveNotifier(object, data)
                };

            if (getDescriptor) {
                descs = data.descriptors = [];
                while (i < props.length) {
                    descs[i] = getDescriptor(object, props[i]);
                    values[i] = object[props[i++]];
                }
            } else while (i < props.length)
                values[i] = object[props[i++]];

            observed.set(object, data);

            return data;
        },

        /**
         * Performs basic property value change checks on an observed object
         * @function performPropertyChecks
         * @param {ObjectData} data
         * @param {Object} object
         * @param {String} [except]  Doesn't deliver the changes to the
         *                           handlers that accept this type
         */
        performPropertyChecks = (function() {
            var updateCheck = getDescriptor ? function(object, data, idx, except, descr) {
                var key = data.properties[idx],
                    value = object[key],
                    ovalue = data.values[idx],
                    odesc = data.descriptors[idx];

                if ("value" in descr && (ovalue === value
                        ? ovalue === 0 && 1/ovalue !== 1/value 
                        : ovalue === ovalue || value === value)) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "update",
                        object: object,
                        oldValue: ovalue
                    }, except);
                    data.values[idx] = value;
                }
                if (odesc.configurable && (!descr.configurable
                        || descr.writable !== odesc.writable
                        || descr.enumerable !== odesc.enumerable
                        || descr.get !== odesc.get
                        || descr.set !== odesc.set)) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "reconfigure",
                        object: object,
                        oldValue: ovalue
                    }, except);
                    data.descriptors[idx] = descr;
                }
            } : function(object, data, idx, except) {
                var key = data.properties[idx],
                    value = object[key],
                    ovalue = data.values[idx];

                if (ovalue === value ? ovalue === 0 && 1/ovalue !== 1/value 
                        : ovalue === ovalue || value === value) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "update",
                        object: object,
                        oldValue: ovalue
                    }, except);
                    data.values[idx] = value;
                }
            };

            // Checks if some property has been deleted
            var deletionCheck = getDescriptor ? function(object, props, proplen, data, except) {
                var i = props.length, descr;
                while (proplen && i--) {
                    if (props[i] !== null) {
                        descr = getDescriptor(object, props[i]);
                        proplen--;

                        // If there's no descriptor, the property has really
                        // been deleted; otherwise, it's been reconfigured so
                        // that's not enumerable anymore
                        if (descr) updateCheck(object, data, i, except, descr);
                        else {
                            addChangeRecord(object, data, {
                                name: props[i],
                                type: "delete",
                                object: object,
                                oldValue: data.values[i]
                            }, except);
                            data.properties.splice(i, 1);
                            data.values.splice(i, 1);
                            data.descriptors.splice(i, 1);
                        }
                    }
                }
            } : function(object, props, proplen, data, except) {
                var i = props.length;
                while (proplen && i--)
                    if (props[i] !== null) {
                        addChangeRecord(object, data, {
                            name: props[i],
                            type: "delete",
                            object: object,
                            oldValue: data.values[i]
                        }, except);
                        data.properties.splice(i, 1);
                        data.values.splice(i, 1);
                        proplen--;
                    }
            };

            return function(data, object, except) {
                if (!data.handlers.size || data.frozen) return;

                var props, proplen, keys,
                    values = data.values,
                    descs = data.descriptors,
                    i = 0, idx,
                    key, value,
                    proto, descr;

                // If the object isn't extensible, we don't need to check for new
                // or deleted properties
                if (data.extensible) {

                    props = data.properties.slice();
                    proplen = props.length;
                    keys = getProps(object);

                    if (descs) {
                        while (i < keys.length) {
                            key = keys[i++];
                            idx = inArray(props, key);
                            descr = getDescriptor(object, key);

                            if (idx === -1) {
                                addChangeRecord(object, data, {
                                    name: key,
                                    type: "add",
                                    object: object
                                }, except);
                                data.properties.push(key);
                                values.push(object[key]);
                                descs.push(descr);
                            } else {
                                props[idx] = null;
                                proplen--;
                                updateCheck(object, data, idx, except, descr);
                            }
                        }
                        deletionCheck(object, props, proplen, data, except);

                        if (!O.isExtensible(object)) {
                            data.extensible = false;
                            addChangeRecord(object, data, {
                                type: "preventExtensions",
                                object: object
                            }, except);

                            data.frozen = O.isFrozen(object);
                        }
                    } else {
                        while (i < keys.length) {
                            key = keys[i++];
                            idx = inArray(props, key);
                            value = object[key];

                            if (idx === -1) {
                                addChangeRecord(object, data, {
                                    name: key,
                                    type: "add",
                                    object: object
                                }, except);
                                data.properties.push(key);
                                values.push(value);
                            } else {
                                props[idx] = null;
                                proplen--;
                                updateCheck(object, data, idx, except);
                            }
                        }
                        deletionCheck(object, props, proplen, data, except);
                    }

                } else if (!data.frozen) {

                    // If the object is not extensible, but not frozen, we just have
                    // to check for value changes
                    for (; i < props.length; i++) {
                        key = props[i];
                        updateCheck(object, data, i, except, getDescriptor(object, key));
                    }

                    if (O.isFrozen(object))
                        data.frozen = true;
                }

                if (getPrototype) {
                    proto = getPrototype(object);
                    if (proto !== data.proto) {
                        addChangeRecord(object, data, {
                            type: "setPrototype",
                            name: "__proto__",
                            object: object,
                            oldValue: data.proto
                        });
                        data.proto = proto;
                    }
                }
            };
        })(),

        /**
         * Sets up the main loop for object observation and change notification
         * It stops if no object is observed.
         * @function runGlobalLoop
         */
        runGlobalLoop = function() {
            if (observed.size) {
                observed.forEach(performPropertyChecks);
                handlers.forEach(deliverHandlerRecords);
                nextFrame(runGlobalLoop);
            }
        },

        /**
         * Deliver the change records relative to a certain handler, and resets
         * the record list.
         * @param {HandlerData} hdata
         * @param {Handler} handler
         */
        deliverHandlerRecords = function(hdata, handler) {
            if (hdata.changeRecords.length) {
                handler(hdata.changeRecords);
                hdata.changeRecords = [];
            }
        },

        /**
         * Returns the notifier for an object - whether it's observed or not
         * @function retrieveNotifier
         * @param {Object} object
         * @param {ObjectData} [data]
         * @returns {Notifier}
         */
        retrieveNotifier = function(object, data) {
            if (arguments.length < 2)
                data = observed.get(object);

            /** @type {Notifier} */
            return data && data.notifier || {
                /**
                 * @method notify
                 * @see http://arv.github.io/ecmascript-object-observe/#notifierprototype._notify
                 * @memberof Notifier
                 * @param {ChangeRecord} changeRecord
                 */
                notify: function(changeRecord) {
                    changeRecord.type; // Just to check the property is there...

                    // If there's no data, the object has been unobserved
                    var data = observed.get(object);
                    if (data) {
                        var recordCopy = { object: object }, prop;
                        for (prop in changeRecord)
                            if (prop !== "object")
                                recordCopy[prop] = changeRecord[prop];
                        addChangeRecord(object, data, recordCopy);
                    }
                },

                /**
                 * @method performChange
                 * @see http://arv.github.io/ecmascript-object-observe/#notifierprototype_.performchange
                 * @memberof Notifier
                 * @param {String} changeType
                 * @param {Performer} func     The task performer
                 * @param {*} [thisObj]        Used to set `this` when calling func
                 */
                performChange: function(changeType, func/*, thisObj*/) {
                    if (typeof changeType !== "string")
                        throw new TypeError("Invalid non-string changeType");

                    if (typeof func !== "function")
                        throw new TypeError("Cannot perform non-function");

                    // If there's no data, the object has been unobserved
                    var data = observed.get(object),
                        prop, changeRecord,
                        result = func.call(arguments[2]);

                    data && performPropertyChecks(data, object, changeType);

                    // If there's no data, the object has been unobserved
                    if (data && result && typeof result === "object") {
                        changeRecord = { object: object, type: changeType };
                        for (prop in result)
                            if (prop !== "object" && prop !== "type")
                                changeRecord[prop] = result[prop];
                        addChangeRecord(object, data, changeRecord);
                    }
                }
            };
        },

        /**
         * Register (or redefines) an handler in the collection for a given
         * object and a given type accept list.
         * @function setHandler
         * @param {Object} object
         * @param {ObjectData} data
         * @param {Handler} handler
         * @param {String[]} acceptList
         */
        setHandler = function(object, data, handler, acceptList) {
            var hdata = handlers.get(handler);
            if (!hdata)
                handlers.set(handler, hdata = {
                    observed: createMap(),
                    changeRecords: []
                });
            hdata.observed.set(object, {
                acceptList: acceptList.slice(),
                data: data
            });
            data.handlers.set(handler, hdata);
        },

        /**
         * Adds a change record in a given ObjectData
         * @function addChangeRecord
         * @param {Object} object
         * @param {ObjectData} data
         * @param {ChangeRecord} changeRecord
         * @param {String} [except]
         */
        addChangeRecord = function(object, data, changeRecord, except) {
            data.handlers.forEach(function(hdata) {
                var acceptList = hdata.observed.get(object).acceptList;
                // If except is defined, Notifier.performChange has been
                // called, with except as the type.
                // All the handlers that accepts that type are skipped.
                if ((typeof except !== "string"
                        || inArray(acceptList, except) === -1)
                        && inArray(acceptList, changeRecord.type) > -1)
                    hdata.changeRecords.push(changeRecord);
            });
        };

    observed = createMap();
    handlers = createMap();

    /**
     * @function Object.observe
     * @see http://arv.github.io/ecmascript-object-observe/#Object.observe
     * @param {Object} object
     * @param {Handler} handler
     * @param {String[]} [acceptList]
     * @throws {TypeError}
     * @returns {Object}               The observed object
     */
    O.observe = function observe(object, handler, acceptList) {
        if (!object || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.observe cannot observe non-object");

        if (typeof handler !== "function")
            throw new TypeError("Object.observe cannot deliver to non-function");

        if (O.isFrozen && O.isFrozen(handler))
            throw new TypeError("Object.observe cannot deliver to a frozen function object");

        if (typeof acceptList === "undefined")
            acceptList = defaultAcceptList;
        else if (!acceptList || typeof acceptList !== "object")
            throw new TypeError("Third argument to Object.observe must be an array of strings.");

        doObserve(object, handler, acceptList);

        return object;
    };

    /**
     * @function Object.unobserve
     * @see http://arv.github.io/ecmascript-object-observe/#Object.unobserve
     * @param {Object} object
     * @param {Handler} handler
     * @throws {TypeError}
     * @returns {Object}         The given object
     */
    O.unobserve = function unobserve(object, handler) {
        if (object === null || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.unobserve cannot unobserve non-object");

        if (typeof handler !== "function")
            throw new TypeError("Object.unobserve cannot deliver to non-function");

        var hdata = handlers.get(handler), odata;

        if (hdata && (odata = hdata.observed.get(object))) {
            hdata.observed.forEach(function(odata, object) {
                performPropertyChecks(odata.data, object);
            });
            nextFrame(function() {
                deliverHandlerRecords(hdata, handler);
            });

            // In Firefox 13-18, size is a function, but createMap should fall
            // back to the shim for those versions
            if (hdata.observed.size === 1 && hdata.observed.has(object))
                handlers["delete"](handler);
            else hdata.observed["delete"](object);

            if (odata.data.handlers.size === 1)
                observed["delete"](object);
            else odata.data.handlers["delete"](handler);
        }

        return object;
    };

    /**
     * @function Object.getNotifier
     * @see http://arv.github.io/ecmascript-object-observe/#GetNotifier
     * @param {Object} object
     * @throws {TypeError}
     * @returns {Notifier}
     */
    O.getNotifier = function getNotifier(object) {
        if (object === null || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.getNotifier cannot getNotifier non-object");

        if (O.isFrozen && O.isFrozen(object)) return null;

        return retrieveNotifier(object);
    };

    /**
     * @function Object.deliverChangeRecords
     * @see http://arv.github.io/ecmascript-object-observe/#Object.deliverChangeRecords
     * @see http://arv.github.io/ecmascript-object-observe/#DeliverChangeRecords
     * @param {Handler} handler
     * @throws {TypeError}
     */
    O.deliverChangeRecords = function deliverChangeRecords(handler) {
        if (typeof handler !== "function")
            throw new TypeError("Object.deliverChangeRecords cannot deliver to non-function");

        var hdata = handlers.get(handler);
        if (hdata) {
            hdata.observed.forEach(function(odata, object) {
                performPropertyChecks(odata.data, object);
            });
            deliverHandlerRecords(hdata, handler);
        }
    };

})(Object, Array, this);
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/object.observe/dist/object-observe.js","/../../node_modules/object.observe/dist")
},{"buffer":2,"rH1JPG":5}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/process/browser.js","/../../node_modules/process")
},{"buffer":2,"rH1JPG":5}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var depthString = '                                                                                ';

    function DataNodeBase(key) {
        this.label = key;
        this.data = [''];
        this.rowIndexes = [];
        this.hasChildren = false;
        this.depth = 0;
        this.height = 1;
        this.expanded = false;
    }

    DataNodeBase.prototype.isNullObject = false;

    DataNodeBase.prototype.getValue = function(x) {
        return this.data[x];
    };

    DataNodeBase.prototype.prune = function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    };

    DataNodeBase.prototype.computeDepthString = function() {
        var string = depthString.substring(0, 2 + (this.depth * 3)) + this.label;
        return string;
    };

    DataNodeBase.prototype.computeHeight = function() {
        return 1;
    };

    DataNodeBase.prototype.getAllRowIndexes = function() {
        return this.rowIndexes;
    };

    DataNodeBase.prototype.computeAggregates = function(aggregator) {
        this.applyAggregates(aggregator);
    };

    DataNodeBase.prototype.applyAggregates = function(aggregator) {
        var indexes = this.getAllRowIndexes();
        if (indexes.length === 0) {
            return; // no data to rollup on
        }
        var aggregates = aggregator.aggregates;
        var data = this.data;
        data.length = aggregates.length + 1;

        var sorter = aggregator.sorterInstance;
        sorter.indexes = indexes;

        for (var i = 0; i < aggregates.length; i++) {
            var aggregate = aggregates[i];
            data[i + 1] = aggregate(sorter);
        }

        this.data = data;
    };

    DataNodeBase.prototype.buildView = function(aggregator) {
        aggregator.view.push(this);
    };

    DataNodeBase.prototype.toggleExpansionState = function() { /* aggregator */
        //do nothing by default
    };

    return DataNodeBase;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeBase.js","/")
},{"buffer":2,"rH1JPG":5}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Map = require('./Map');
var DataNodeBase = require('./DataNodeBase');

module.exports = (function() {

    var ExpandedMap = {
        true: '▾',
        false: '▸'
    };
    var depthString = '                                                                                ';

    function DataNodeGroup(key) {
        DataNodeBase.call(this, key);
        this.children = new Map();
    }

    DataNodeGroup.prototype = Object.create(DataNodeBase.prototype);

    DataNodeGroup.prototype.prune = function(depth) {
        this.depth = depth;
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.prune(this.depth + 1);
        }
        this.data[0] = this.computeDepthString();
    };

    DataNodeGroup.prototype.computeDepthString = function() {
        var icon = ExpandedMap[this.expanded + ''];
        var string = depthString.substring(0, this.depth * 3) + icon + ' ' + this.label;
        return string;
    };

    DataNodeGroup.prototype.getAllRowIndexes = function() {
        if (this.rowIndexes.length === 0) {
            this.rowIndexes = this.computeAllRowIndexes();
        }
        return this.rowIndexes;
    };

    DataNodeGroup.prototype.computeAllRowIndexes = function() {
        var result = [];
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            var childIndexes = child.getAllRowIndexes();
            Array.prototype.splice.apply(result, [result.length, 0].concat(childIndexes));
        }
        return result;
    };

    DataNodeGroup.prototype.toggleExpansionState = function(aggregator) { /* aggregator */
        this.expanded = !this.expanded;
        this.data[0] = this.computeDepthString();
        if (this.expanded) {
            this.computeAggregates(aggregator);
        }
    };

    DataNodeGroup.prototype.computeAggregates = function(aggregator) {
        this.applyAggregates(aggregator);
        if (!this.expanded) {
            return; // were not being viewed, don't have child nodes do computation;
        }
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].computeAggregates(aggregator);
        }
    };

    DataNodeGroup.prototype.buildView = function(aggregator) {
        aggregator.view.push(this);
        if (this.expanded) {
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                child.buildView(aggregator);
            }
        }
    };

    DataNodeGroup.prototype.computeHeight = function() {
        var height = 1; //I'm 1 high
        if (!this.expanded) {
            this.height = 1;
        } else {
            for (var i = 0; i < this.children.length; i++) {
                height = height + this.children[i].computeHeight();
            }
            this.height = height;
        }
        return this.height;
    };

    return DataNodeGroup;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeGroup.js","/")
},{"./DataNodeBase":6,"./Map":17,"buffer":2,"rH1JPG":5}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataNodeBase = require('./DataNodeBase');

module.exports = (function() {

    function DataNodeLeaf(key) {
        DataNodeBase.call(this, key);
    }

    DataNodeLeaf.prototype = Object.create(DataNodeBase.prototype);

    DataNodeLeaf.prototype.prune = function(depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    };

    DataNodeLeaf.prototype.computeHeight = function() {
        return 1;
    };

    DataNodeLeaf.prototype.getAllRowIndexes = function() {
        return this.rowIndexes;
    };

    DataNodeLeaf.prototype.computeAggregates = function(aggregator) {
        this.applyAggregates(aggregator);
    };

    DataNodeLeaf.prototype.buildView = function(aggregator) {
        aggregator.view.push(this);
    };

    return DataNodeLeaf;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeLeaf.js","/")
},{"./DataNodeBase":6,"buffer":2,"rH1JPG":5}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataNodeGroup = require('./DataNodeGroup');

module.exports = (function() {

    function DataNodeTree(key) {
        DataNodeGroup.call(this, key);
        this.height = 0;
        this.expanded = true;
    }

    DataNodeTree.prototype = Object.create(DataNodeGroup.prototype);

    DataNodeTree.prototype.prune = function() {
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.prune(0);
        }
    };

    DataNodeTree.prototype.buildView = function(aggregator) {
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.buildView(aggregator);
        }
    };

    DataNodeTree.prototype.computeHeight = function() {
        var height = 0;
        for (var i = 0; i < this.children.length; i++) {
            height = height + this.children[i].computeHeight();
        }
        this.height = height;

        return this.height;
    };


    return DataNodeTree;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeTree.js","/")
},{"./DataNodeGroup":7,"buffer":2,"rH1JPG":5}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./DataNodeTree');
var DataNodeGroup = require('./DataNodeGroup');
var DataNodeLeaf = require('./DataNodeLeaf');

module.exports = (function() {

    var headerify = function(string) {
        var pieces = string.replace(/[_-]/g, ' ').replace(/[A-Z]/g, ' $&').split(' ').map(function(s) {
            return s.charAt(0).toUpperCase() + s.slice(1);
        });
        return pieces.join(' ');
    };

    //?[t,c,b,a]
    // t is a dataSource,
    // a is a dicitionary of aggregates,  columnName:function
    // b is a dicitionary of groupbys, columnName:sourceColumnName
    // c is a list of constraints,

    function DataSourceAggregator(dataSource) {
        this.tree = new DataNodeTree('root');
        this.indexes = [];
        this.dataSource = dataSource;
        this.aggregates = [];
        this.headers = [];
        this.groupBys = [];
        this.view = [];
        this.sorterInstance = {};
        this.presortGroups = true;
    }

    DataSourceAggregator.prototype.isNullObject = false;

    DataSourceAggregator.prototype.addAggregate = function(columnName, func) {
        this.headers.push(headerify(columnName));
        this.aggregates.push(func);
    };

    DataSourceAggregator.prototype.addGroupBy = function(columnIndex) {
        this.groupBys.push(columnIndex);
    };

    DataSourceAggregator.prototype.hasGroups = function() {
        return this.groupBys.length > 0;
    };

    DataSourceAggregator.prototype.hasAggregates = function() {
        return this.aggregates.length > 0;
    };

    DataSourceAggregator.prototype.apply = function() {
        this.buildGroupTree();
    };

    DataSourceAggregator.prototype.clearGroups = function() {
        this.groupBys.length = 0;
    };

    DataSourceAggregator.prototype.clearAggregations = function() {
        this.aggregates.length = 0;
        this.headers.length = 0;
    };

    DataSourceAggregator.prototype.buildGroupTree = function() {
        var c, r, g, value, createFunc;
        var createBranch = function(key, map) {
            value = new DataNodeGroup(key);
            map.set(key, value);
            return value;
        };
        var createLeaf = function(key, map) {
            value = new DataNodeLeaf(key);
            map.set(key, value);
            return value;
        };
        var groupBys = this.groupBys;
        var source = this.dataSource;
        var rowCount = source.getRowCount();

        // lets sort our data first....
        if (this.presortGroups) {
            for (c = 0; c < groupBys.length; c++) {
                g = groupBys[groupBys.length - c - 1];
                source = new DataSourceSorter(source);
                source.sortOn(g);
            }
        }

        var tree = this.tree = new DataNodeTree('root');
        var path = tree;
        var leafDepth = groupBys.length - 1;
        for (r = 0; r < rowCount; r++) {
            for (c = 0; c < groupBys.length; c++) {
                g = groupBys[c];
                value = source.getValue(g, r);

                //test that I'm not a leaf
                createFunc = (c === leafDepth) ? createLeaf : createBranch;
                path = path.children.getIfAbsent(value, createFunc);
            }
            path.rowIndexes.push(r);
            path = tree;
        }
        this.sorterInstance = new DataSourceSorter(source);
        tree.prune();
        this.tree.computeAggregates(this);
        this.buildView();
    };

    DataSourceAggregator.prototype.buildView = function() {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    };

    DataSourceAggregator.prototype.getValue = function(x, y) {
        return this.view[y - 1].getValue(x); //header row
    };

    DataSourceAggregator.prototype.getColumnCount = function() {

        return this.aggregates.length + 1; // 1 is for the hierarchy column
    };

    DataSourceAggregator.prototype.getRowCount = function() {
        return this.view.length; //header column
    };

    DataSourceAggregator.prototype.click = function(y) {
        var group = this.view[y];
        group.toggleExpansionState(this);
        this.buildView();
    };

    DataSourceAggregator.prototype.getHeaders = function() {
        if (this.hasAggregates()) {
            return ['Tree'].concat(this.headers);
        }
        return ['Tree'].concat(this.dataSource.getHeaders());

    };

    DataSourceAggregator.prototype.setHeaders = function(headers) {
        this.dataSource.setHeaders(headers);
    };

    DataSourceAggregator.prototype.getFields = function() {
        return this.getHeaders();
    };

    DataSourceAggregator.prototype.getGrandTotals = function() {
        var view = this.view[0];
        var rowCount = this.getRowCount();
        if (!view || rowCount === 0) {
            return [];
        }
        return [view.data];
    };

    DataSourceAggregator.prototype.getRow = function(y) {
        var rowIndexes = this.view[y].rowIndexes;
        var result = new Array(rowIndexes.length);
        for (var i = 0; i < result.length; i++) {
            var object = this.dataSource.getRow(rowIndexes[i]);
            result[i] = object;
        }
        return result;
    };

    DataSourceAggregator.prototype.setData = function(arrayOfUniformObjects) {
        this.dataSource.setData(arrayOfUniformObjects);
        this.apply();
    };

    return DataSourceAggregator;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceAggregator.js","/")
},{"./DataNodeGroup":7,"./DataNodeLeaf":8,"./DataNodeTree":9,"./DataSourceSorter":14,"buffer":2,"rH1JPG":5}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    function DataSourceDecorator(dataSource) {
        this.dataSource = dataSource;
        this.indexes = [];
    }

    DataSourceDecorator.prototype.isNullObject = false;

    DataSourceDecorator.prototype.transposeY = function(y) {
        if (this.indexes.length !== 0) {
            return this.indexes[y];
        }
        return y;
    };

    DataSourceDecorator.prototype.getValue = function(x, y) {
        var value = this.dataSource.getValue(x, this.transposeY(y));
        return value;
    };

    DataSourceDecorator.prototype.getRow = function(y) {

        return this.dataSource.getRow(this.transposeY(y));
    };

    DataSourceDecorator.prototype.setValue = function(x, y, value) {

        this.dataSource.setValue(x, this.transposeY(y), value);
    };

    DataSourceDecorator.prototype.getColumnCount = function() {

        return this.dataSource.getColumnCount();
    };

    DataSourceDecorator.prototype.getFields = function() {

        return this.dataSource.getFields();
    };

    DataSourceDecorator.prototype.setFields = function(fields) {

        return this.dataSource.setFields(fields);
    };

    DataSourceDecorator.prototype.getRowCount = function() {
        if (this.indexes.length !== 0) {
            return this.indexes.length;
        }
        return this.dataSource.getRowCount();
    };

    DataSourceDecorator.prototype.setHeaders = function(headers) {
        return this.dataSource.setHeaders(headers);
    };

    DataSourceDecorator.prototype.getHeaders = function() {

        return this.dataSource.getHeaders();
    };

    DataSourceDecorator.prototype.getGrandTotals = function() {
        //nothing here
        return;
    };

    DataSourceDecorator.prototype.initializeIndexVector = function() {
        var rowCount = this.dataSource.getRowCount();
        var indexVector = new Array(rowCount);
        for (var r = 0; r < rowCount; r++) {
            indexVector[r] = r;
        }
        this.indexes = indexVector;
    };

    DataSourceDecorator.prototype.setData = function(arrayOfUniformObjects) {
        this.dataSource.setData(arrayOfUniformObjects);
    };

    return DataSourceDecorator;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceDecorator.js","/")
},{"buffer":2,"rH1JPG":5}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceDecorator = require('./DataSourceDecorator');

module.exports = (function() {

    function DataSourceFilter(dataSource) {
        DataSourceDecorator.call(this, dataSource, false);
        this.filters = [];
    }

    DataSourceFilter.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceFilter.prototype.addFilter = function(columnIndex, filter) {
        filter.columnIndex = columnIndex;
        this.filters.push(filter);
    };
    DataSourceFilter.prototype.setFilter = function(columnIndex, filter) {
        filter.columnIndex = columnIndex;
        this.filters.push(filter);
    };

    DataSourceFilter.prototype.clearFilters = function() { /* filter */
        this.filters.length = 0;
        this.indexes.length = 0;
    };

    DataSourceFilter.prototype.applyFilters = function() {
        if (this.filters.length === 0) {
            this.indexes.length = 0;
            return;
        }
        var indexes = this.indexes;
        indexes.length = 0;
        var count = this.dataSource.getRowCount();
        for (var r = 0; r < count; r++) {
            if (this.applyFiltersTo(r)) {
                indexes.push(r);
            }
        }
    };

    DataSourceFilter.prototype.applyFiltersTo = function(r) {
        var filters = this.filters;
        var isFiltered = true;
        for (var f = 0; f < filters.length; f++) {
            var filter = filters[f];
            var rowObject = this.dataSource.getRow(r);
            isFiltered = isFiltered && filter(this.dataSource.getValue(filter.columnIndex, r), rowObject, r);
        }
        return isFiltered;
    };

    return DataSourceFilter;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceFilter.js","/")
},{"./DataSourceDecorator":11,"buffer":2,"rH1JPG":5}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceDecorator = require('./DataSourceDecorator');

module.exports = (function() {

    function DataSourceGlobalFilter(dataSource) {
        DataSourceDecorator.call(this, dataSource, false);
        this.filter = null;
    }

    DataSourceGlobalFilter.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceGlobalFilter.prototype.setFilter = function(filter) {
        this.filter = filter;
    };

    DataSourceGlobalFilter.prototype.clearFilters = function() { /* filter */
        this.filter = null;
        this.indexes.length = 0;
    };

    DataSourceGlobalFilter.prototype.applyFilters = function() {
        if (!this.filter) {
            this.indexes.length = 0;
            return;
        }
        var indexes = this.indexes;
        indexes.length = 0;
        var count = this.dataSource.getRowCount();
        for (var r = 0; r < count; r++) {
            if (this.applyFilterTo(r)) {
                indexes.push(r);
            }
        }
    };

    DataSourceGlobalFilter.prototype.applyFilterTo = function(r) {
        var isFiltered = false;
        var filter = this.filter;
        var colCount = this.getColumnCount();
        var rowObject = this.dataSource.getRow(r);
        for (var i = 0; i < colCount; i++) {
            isFiltered = isFiltered || filter(this.dataSource.getValue(i, r), rowObject, r);
            if (isFiltered) {
                return true;
            }
        }
        return false;
    };

    return DataSourceGlobalFilter;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceGlobalFilter.js","/")
},{"./DataSourceDecorator":11,"buffer":2,"rH1JPG":5}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Utils = require('./Utils.js');
var DataSourceDecorator = require('./DataSourceDecorator');

module.exports = (function() {

    function DataSourceSorter(dataSource) {
        DataSourceDecorator.call(this, dataSource);
        this.descendingSort = false;
    }

    DataSourceSorter.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceSorter.prototype.sortOn = function(columnIndex, sortType) {
        if (sortType === 0) {
            this.indexes.length = 0;
            return;
        }
        this.initializeIndexVector();
        var self = this;
        Utils.stableSort(this.indexes, function(index) {
            return self.dataSource.getValue(columnIndex, index);
        }, sortType);
    };

    return DataSourceSorter;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceSorter.js","/")
},{"./DataSourceDecorator":11,"./Utils.js":18,"buffer":2,"rH1JPG":5}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceDecorator = require('./DataSourceDecorator');
var DataSourceSorter = require('./DataSourceSorter');

module.exports = (function() {

    function DataSourceSorterComposite(dataSource) {
        DataSourceDecorator.call(this, dataSource);
        this.sorts = [];
        this.last = this.dataSource;
    }

    DataSourceSorterComposite.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceSorterComposite.prototype.sortOn = function(columnIndex, sortType) {
        this.sorts.push([columnIndex, sortType]);
    };

    DataSourceSorterComposite.prototype.applySorts = function() {
        var sorts = this.sorts;
        var each = this.dataSource;
        for (var i = 0; i < sorts.length; i++) {
            var sort = sorts[i];
            each = new DataSourceSorter(each);
            each.sortOn(sort[0], sort[1]);
        }
        this.last = each;
    };

    DataSourceSorterComposite.prototype.clearSorts = function() {
        this.sorts.length = 0;
        this.last = this.dataSource;
    };

    DataSourceSorterComposite.prototype.getValue = function(x, y) {
        return this.last.getValue(x, y);
    };

    DataSourceSorterComposite.prototype.setValue = function(x, y, value) {
        this.last.setValue(x, y, value);
    };

    return DataSourceSorterComposite;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceSorterComposite.js","/")
},{"./DataSourceDecorator":11,"./DataSourceSorter":14,"buffer":2,"rH1JPG":5}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var headerify = function(string) {
        var pieces = string.replace(/[_-]/g, ' ').replace(/[A-Z]/g, ' $&').split(' ').map(function(s) {
            return s.charAt(0).toUpperCase() + s.slice(1);
        });
        return pieces.join(' ');
    };

    var computeFieldNames = function(object) {
        if (!object) {
            return [];
        }
        var fields = [].concat(Object.getOwnPropertyNames(object).filter(function(e) {
            return e.substr(0, 2) !== '__';
        }));
        return fields;
    };

    function JSDataSource(data, fields) {
        this.fields = fields || computeFieldNames(data[0]);
        this.headers = [];
        this.data = data;
    }

    JSDataSource.prototype.isNullObject = false;

    JSDataSource.prototype.getValue = function(x, y) {
        if (x === -1) {
            return y;
        }
        var value = this.data[y][this.fields[x]];
        return value;
    };

    JSDataSource.prototype.getRow = function(y) {

        return this.data[y];
    };

    JSDataSource.prototype.setValue = function(x, y, value) {

        this.data[y][this.fields[x]] = value;
    };

    JSDataSource.prototype.getColumnCount = function() {

        return this.getHeaders().length;
    };

    JSDataSource.prototype.getRowCount = function() {

        return this.data.length;
    };

    JSDataSource.prototype.getFields = function() {

        return this.fields;
    };

    JSDataSource.prototype.getHeaders = function() {
        if (!this.headers || this.headers.length === 0) {
            this.headers = this.getDefaultHeaders().map(function(each) {
                return headerify(each);
            });
        }
        return this.headers;
    };

    JSDataSource.prototype.getDefaultHeaders = function() {

        return this.getFields();
    };

    JSDataSource.prototype.setFields = function(fields) {

        this.fields = fields;
    };

    JSDataSource.prototype.setHeaders = function(headers) {

        this.headers = headers;
    };

    JSDataSource.prototype.getGrandTotals = function() {
        //nothing here
        return;
    };

    JSDataSource.prototype.setData = function(arrayOfUniformObjects) {
        this.data = arrayOfUniformObjects;
    };

    return JSDataSource;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/JSDataSource.js","/")
},{"buffer":2,"rH1JPG":5}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var oidPrefix = '.~.#%_'; //this should be something we never will see at the begining of a string
    var counter = 0;

    var hash = function(key) {
        var typeOf = typeof key;
        switch (typeOf) {
            case 'number':
                return oidPrefix + typeOf + '_' + key;
            case 'string':
                return oidPrefix + typeOf + '_' + key;
            case 'boolean':
                return oidPrefix + typeOf + '_' + key;
            case 'symbol':
                return oidPrefix + typeOf + '_' + key;
            case 'undefined':
                return oidPrefix + 'undefined';
            case 'object':
                /*eslint-disable */
                if (key.___finhash) {
                    return key.___finhash;
                }
                key.___finhash = oidPrefix + counter++;
                return key.___finhash;
            case 'function':
                if (key.___finhash) {
                    return key.___finhash;
                }
                key.___finhash = oidPrefix + counter++;
                return key.___finhash; /*eslint-enable */
        }
    };

    // Object.is polyfill, courtesy of @WebReflection
    var is = Object.is ||
        function(a, b) {
            return a === b ? a !== 0 || 1 / a == 1 / b : a != a && b != b; // eslint-disable-line
        };

    // More reliable indexOf, courtesy of @WebReflection
    var betterIndexOf = function(arr, value) {
        if (value != value || value === 0) { // eslint-disable-line
            for (var i = arr.length; i-- && !is(arr[i], value);) { // eslint-disable-line
            }
        } else {
            i = [].indexOf.call(arr, value);
        }
        return i;
    };

    function Mappy() {
        this.keys = [];
        this.data = {};
        this.values = [];
    }

    Mappy.prototype.set = function(key, value) {
        var hashCode = hash(key);
        if (this.data[hashCode] === undefined) {
            this.keys.push(key);
            this.values.push(value);
        }
        this.data[hashCode] = value;
    };

    Mappy.prototype.get = function(key) {
        var hashCode = hash(key);
        return this.data[hashCode];
    };

    Mappy.prototype.getIfAbsent = function(key, ifAbsentFunc) {
        var value = this.get(key);
        if (value === undefined) {
            value = ifAbsentFunc(key, this);
        }
        return value;
    };

    Mappy.prototype.size = function() {
        return this.keys.length;
    };

    Mappy.prototype.clear = function() {
        this.keys.length = 0;
        this.data = {};
    };

    Mappy.prototype.delete = function(key) {
        var hashCode = hash(key);
        if (this.data[hashCode] === undefined) {
            return;
        }
        var index = betterIndexOf(this.keys, key);
        this.keys.splice(index, 1);
        this.values.splice(index, 1);
        delete this.data[hashCode];
    };

    Mappy.prototype.forEach = function(func) {
        var keys = this.keys;
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            func(value, key, this);
        }
    };

    Mappy.prototype.map = function(func) {
        var keys = this.keys;
        var newMap = new Mappy();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            var transformed = func(value, key, this);
            newMap.set(key, transformed);
        }
        return newMap;
    };

    Mappy.prototype.copy = function() {
        var keys = this.keys;
        var newMap = new Mappy();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            newMap.set(key, value);
        }
        return newMap;
    };

    return Mappy;

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Map.js","/")
},{"buffer":2,"rH1JPG":5}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var stableSort = require('./stableSort.js');
var Map = require('./Map.js');

module.exports = (function() {

    return {
        stableSort: stableSort,
        Map: Map
    };

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Utils.js","/")
},{"./Map.js":17,"./stableSort.js":22,"buffer":2,"rH1JPG":5}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    return {

        count: function() { /* columIndex */
            return function(group) {
                var rows = group.getRowCount();
                return rows;
            };
        },

        sum: function(columIndex) {
            return function(group) {
                var sum = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    sum = sum + group.getValue(columIndex, r);
                }
                return sum;
            };
        },

        min: function(columIndex) {
            return function(group) {
                var min = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    min = Math.min(min, group.getValue(columIndex, r));
                }
                return min;
            };
        },


        max: function(columIndex) {
            return function(group) {
                var max = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    max = Math.max(max, group.getValue(columIndex, r));
                }
                return max;
            };
        },

        avg: function(columIndex) {
            return function(group) {
                var sum = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    sum = sum + group.getValue(columIndex, r);
                }
                return sum / rows;
            };
        },

        first: function(columIndex) {
            return function(group) {
                return group.getValue(columIndex, 0);
            };
        },

        last: function(columIndex) {
            return function(group) {
                var rows = group.getRowCount();
                return group.getValue(columIndex, rows - 1);
            };
        },

        stddev: function(columIndex) {
            return function(group) {
                var r;
                var sum = 0;
                var rows = group.getRowCount();
                for (r = 0; r < rows; r++) {
                    sum = sum + group.getValue(columIndex, r);
                }
                var mean = sum / rows;
                var variance = 0;
                for (r = 0; r < rows; r++) {
                    var dev = (group.getValue(columIndex, r) - mean);
                    variance = variance + (dev * dev);
                }
                var stddev = Math.sqrt(variance / rows);
                return stddev;
            };
        }
    };

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/aggregations.js","/")
},{"buffer":2,"rH1JPG":5}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var JSDataSource = require('./JSDataSource');
var DataSourceSorter = require('./DataSourceSorter');
var DataSourceSorterComposite = require('./DataSourceSorterComposite');
var DataSourceFilter = require('./DataSourceFilter');
var DataSourceGlobalFilter = require('./DataSourceGlobalFilter');
var DataSourceAggregator = require('./DataSourceAggregator');
var aggregations = require('./aggregations');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSourceSorter: DataSourceSorter,
        DataSourceSorterComposite: DataSourceSorterComposite,
        DataSourceFilter: DataSourceFilter,
        DataSourceGlobalFilter: DataSourceGlobalFilter,
        DataSourceAggregator: DataSourceAggregator,
        aggregations: aggregations
    };

})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/analytics.js","/")
},{"./DataSourceAggregator":10,"./DataSourceFilter":12,"./DataSourceGlobalFilter":13,"./DataSourceSorter":14,"./DataSourceSorterComposite":15,"./JSDataSource":16,"./aggregations":19,"buffer":2,"rH1JPG":5}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/* eslint-env node, browser */
'use strict';

var noop = function() {};

var oo = require('object.observe');
var analytics = require('./analytics.js');

noop(oo);

if (!window.fin) {
    window.fin = {};
}
if (!window.fin.analytics) {
    window.fin.analytics = analytics;
}
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_159c069c.js","/")
},{"./analytics.js":20,"buffer":2,"object.observe":4,"rH1JPG":5}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var stabilize = function(comparator, descending) {
    return function(arr1, arr2) {
        var x = arr1[0];
        var y = arr2[0];
        if (x === y) {
            x = descending ? arr2[1] : arr1[1];
            y = descending ? arr1[1] : arr2[1];
        } else {
            if (y === null) {
                return -1;
            }
            if (x === null) {
                return 1;
            }
        }
        return comparator(x, y);
    };
};


var ascendingNumbers = function(x, y) {
    return x - y;
};

var descendingNumbers = function(x, y) {
    return y - x;
};

var ascendingAllOthers = function(x, y) {
    return x < y ? -1 : 1;
};

var descendingAllOthers = function(x, y) {
    return y < x ? -1 : 1;
};

var ascending = function(typeOfData) {
    if (typeOfData === 'number') {
        return stabilize(ascendingNumbers, false);
    }
    return stabilize(ascendingAllOthers, false);
};

var descending = function(typeOfData) {
    if (typeOfData === 'number') {
        return stabilize(descendingNumbers, true);
    }
    return stabilize(descendingAllOthers, true);
};

module.exports = (function() {

    function sort(indexVector, dataSource, sortType) {

        var compare, i;

        if (indexVector.length === 0) {
            return; //nothing to do;
        }

        if (sortType === undefined) {
            sortType = 1;
        }

        if (sortType === 0) {
            return; // nothing to sort here;
        }

        var typeOfData = typeof dataSource(0);

        compare = (sortType === 1) ? ascending(typeOfData) : descending(typeOfData);

        //start the actually sorting.....
        var tmp = new Array(indexVector.length);

        //lets add the index for stability
        for (i = 0; i < indexVector.length; i++) {
            tmp[i] = [dataSource(i), i];
        }

        tmp.sort(compare);

        //copy the sorted values into our index vector
        for (i = 0; i < indexVector.length; i++) {
            indexVector[i] = tmp[i][1];
        }
    }

    return sort;
})();
}).call(this,require("rH1JPG"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/stableSort.js","/")
},{"buffer":2,"rH1JPG":5}]},{},[21])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL29iamVjdC5vYnNlcnZlL2Rpc3Qvb2JqZWN0LW9ic2VydmUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhTm9kZUJhc2UuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhTm9kZUdyb3VwLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YU5vZGVMZWFmLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YU5vZGVUcmVlLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YVNvdXJjZUFnZ3JlZ2F0b3IuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhU291cmNlRGVjb3JhdG9yLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YVNvdXJjZUZpbHRlci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VHbG9iYWxGaWx0ZXIuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhU291cmNlU29ydGVyLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvc3JjL2pzL0pTRGF0YVNvdXJjZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvc3JjL2pzL01hcC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvc3JjL2pzL1V0aWxzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvYWdncmVnYXRpb25zLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvYW5hbHl0aWNzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2ZpbmFuYWx5dGljcy9zcmMvanMvZmFrZV8xNTljMDY5Yy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW5hbmFseXRpY3Mvc3JjL2pzL3N0YWJsZVNvcnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2bENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3B1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXHR2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMgfHxcblx0XHQgICAgY29kZSA9PT0gUExVU19VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0ggfHxcblx0XHQgICAgY29kZSA9PT0gU0xBU0hfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYlwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTJcblxuLyoqXG4gKiBJZiBgQnVmZmVyLl91c2VUeXBlZEFycmF5c2A6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChjb21wYXRpYmxlIGRvd24gdG8gSUU2KVxuICovXG5CdWZmZXIuX3VzZVR5cGVkQXJyYXlzID0gKGZ1bmN0aW9uICgpIHtcbiAgLy8gRGV0ZWN0IGlmIGJyb3dzZXIgc3VwcG9ydHMgVHlwZWQgQXJyYXlzLiBTdXBwb3J0ZWQgYnJvd3NlcnMgYXJlIElFIDEwKywgRmlyZWZveCA0KyxcbiAgLy8gQ2hyb21lIDcrLCBTYWZhcmkgNS4xKywgT3BlcmEgMTEuNissIGlPUyA0LjIrLiBJZiB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGFkZGluZ1xuICAvLyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsIHRoZW4gdGhhdCdzIHRoZSBzYW1lIGFzIG5vIGBVaW50OEFycmF5YCBzdXBwb3J0XG4gIC8vIGJlY2F1c2Ugd2UgbmVlZCB0byBiZSBhYmxlIHRvIGFkZCBhbGwgdGhlIG5vZGUgQnVmZmVyIEFQSSBtZXRob2RzLiBUaGlzIGlzIGFuIGlzc3VlXG4gIC8vIGluIEZpcmVmb3ggNC0yOS4gTm93IGZpeGVkOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzhcbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiA0MiA9PT0gYXJyLmZvbygpICYmXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgLy8gQ2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pXG5cbiAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdFxuXG4gIC8vIFdvcmthcm91bmQ6IG5vZGUncyBiYXNlNjQgaW1wbGVtZW50YXRpb24gYWxsb3dzIGZvciBub24tcGFkZGVkIHN0cmluZ3NcbiAgLy8gd2hpbGUgYmFzZTY0LWpzIGRvZXMgbm90LlxuICBpZiAoZW5jb2RpbmcgPT09ICdiYXNlNjQnICYmIHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgc3ViamVjdCA9IHN0cmluZ3RyaW0oc3ViamVjdClcbiAgICB3aGlsZSAoc3ViamVjdC5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgICBzdWJqZWN0ID0gc3ViamVjdCArICc9J1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpbmQgdGhlIGxlbmd0aFxuICB2YXIgbGVuZ3RoXG4gIGlmICh0eXBlID09PSAnbnVtYmVyJylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdClcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpXG4gICAgbGVuZ3RoID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0Lmxlbmd0aCkgLy8gYXNzdW1lIHRoYXQgb2JqZWN0IGlzIGFycmF5LWxpa2VcbiAgZWxzZVxuICAgIHRocm93IG5ldyBFcnJvcignRmlyc3QgYXJndW1lbnQgbmVlZHMgdG8gYmUgYSBudW1iZXIsIGFycmF5IG9yIHN0cmluZy4nKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAvLyBQcmVmZXJyZWQ6IFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYnVmID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBUSElTIGluc3RhbmNlIG9mIEJ1ZmZlciAoY3JlYXRlZCBieSBgbmV3YClcbiAgICBidWYgPSB0aGlzXG4gICAgYnVmLmxlbmd0aCA9IGxlbmd0aFxuICAgIGJ1Zi5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgaVxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiB0eXBlb2Ygc3ViamVjdC5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJykge1xuICAgIC8vIFNwZWVkIG9wdGltaXphdGlvbiAtLSB1c2Ugc2V0IGlmIHdlJ3JlIGNvcHlpbmcgZnJvbSBhIHR5cGVkIGFycmF5XG4gICAgYnVmLl9zZXQoc3ViamVjdClcbiAgfSBlbHNlIGlmIChpc0FycmF5aXNoKHN1YmplY3QpKSB7XG4gICAgLy8gVHJlYXQgYXJyYXktaXNoIG9iamVjdHMgYXMgYSBieXRlIGFycmF5XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0LnJlYWRVSW50OChpKVxuICAgICAgZWxzZVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0W2ldXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgYnVmLndyaXRlKHN1YmplY3QsIDAsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbi8vIFNUQVRJQyBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gKGIpIHtcbiAgcmV0dXJuICEhKGIgIT09IG51bGwgJiYgYiAhPT0gdW5kZWZpbmVkICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uIChzdHIsIGVuY29kaW5nKSB7XG4gIHZhciByZXRcbiAgc3RyID0gc3RyICsgJydcbiAgc3dpdGNoIChlbmNvZGluZyB8fCAndXRmOCcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAvIDJcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0LCB0b3RhbExlbmd0aCkge1xuICBhc3NlcnQoaXNBcnJheShsaXN0KSwgJ1VzYWdlOiBCdWZmZXIuY29uY2F0KGxpc3QsIFt0b3RhbExlbmd0aF0pXFxuJyArXG4gICAgICAnbGlzdCBzaG91bGQgYmUgYW4gQXJyYXkuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdG90YWxMZW5ndGggIT09ICdudW1iZXInKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuLy8gQlVGRkVSIElOU1RBTkNFIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIF9oZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGFzc2VydChzdHJMZW4gJSAyID09PSAwLCAnSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ5dGUgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgYXNzZXJ0KCFpc05hTihieXRlKSwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gYnl0ZVxuICB9XG4gIEJ1ZmZlci5fY2hhcnNXcml0dGVuID0gaSAqIDJcbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gX3V0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF9hc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF9iaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBfYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIF9iYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX3V0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gU3VwcG9ydCBib3RoIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZylcbiAgLy8gYW5kIHRoZSBsZWdhY3kgKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIGlmICghaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHsgIC8vIGxlZ2FjeVxuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IF9oZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSBfdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IF9hc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBfYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IF9iYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gX3V0ZjE2bGVXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG4gIHN0YXJ0ID0gTnVtYmVyKHN0YXJ0KSB8fCAwXG4gIGVuZCA9IChlbmQgIT09IHVuZGVmaW5lZClcbiAgICA/IE51bWJlcihlbmQpXG4gICAgOiBlbmQgPSBzZWxmLmxlbmd0aFxuXG4gIC8vIEZhc3RwYXRoIGVtcHR5IHN0cmluZ3NcbiAgaWYgKGVuZCA9PT0gc3RhcnQpXG4gICAgcmV0dXJuICcnXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IF9oZXhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSBfdXRmOFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IF9hc2NpaVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBfYmluYXJ5U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IF9iYXNlNjRTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gX3V0ZjE2bGVTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBhc3NlcnQodGFyZ2V0X3N0YXJ0ID49IDAgJiYgdGFyZ2V0X3N0YXJ0IDwgdGFyZ2V0Lmxlbmd0aCxcbiAgICAgICd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCBzb3VyY2UubGVuZ3RoLCAnc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gc291cmNlLmxlbmd0aCwgJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwIHx8ICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbmZ1bmN0aW9uIF9iYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gX3V0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBfYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspXG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIF9iaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBfYXNjaWlTbGljZShidWYsIHN0YXJ0LCBlbmQpXG59XG5cbmZ1bmN0aW9uIF9oZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2krMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gY2xhbXAoc3RhcnQsIGxlbiwgMClcbiAgZW5kID0gY2xhbXAoZW5kLCBsZW4sIGxlbilcblxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZFVJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgfSBlbHNlIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAyXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gICAgdmFsIHw9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldCArIDNdIDw8IDI0ID4+PiAwKVxuICB9IGVsc2Uge1xuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDFdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDJdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgM11cbiAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldF0gPDwgMjQgPj4+IDApXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLFxuICAgICAgICAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgdmFyIG5lZyA9IHRoaXNbb2Zmc2V0XSAmIDB4ODBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIF9yZWFkSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gX3JlYWRVSW50MTYoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDMyKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDAwMDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmZmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZEZsb2F0IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkRG91YmxlIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZilcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVyblxuXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG59XG5cbmZ1bmN0aW9uIF93cml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmZmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmLCAtMHg4MClcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgdGhpcy53cml0ZVVJbnQ4KHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgdGhpcy53cml0ZVVJbnQ4KDB4ZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZiwgLTB4ODAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIF93cml0ZVVJbnQxNihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICBfd3JpdGVVSW50MTYoYnVmLCAweGZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MzIoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgMHhmZmZmZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsXG4gICAgICAgICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHZhbHVlID0gdmFsdWUuY2hhckNvZGVBdCgwKVxuICB9XG5cbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHZhbHVlKSwgJ3ZhbHVlIGlzIG5vdCBhIG51bWJlcicpXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHRoaXMubGVuZ3RoLCAnc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gdGhpcy5sZW5ndGgsICdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICB0aGlzW2ldID0gdmFsdWVcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvdXQgPSBbXVxuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIG91dFtpXSA9IHRvSGV4KHRoaXNbaV0pXG4gICAgaWYgKGkgPT09IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMpIHtcbiAgICAgIG91dFtpICsgMV0gPSAnLi4uJ1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBvdXQuam9pbignICcpICsgJz4nXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKVxuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbi8vIHNsaWNlKHN0YXJ0LCBlbmQpXG5mdW5jdGlvbiBjbGFtcCAoaW5kZXgsIGxlbiwgZGVmYXVsdFZhbHVlKSB7XG4gIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gZGVmYXVsdFZhbHVlXG4gIGluZGV4ID0gfn5pbmRleDsgIC8vIENvZXJjZSB0byBpbnRlZ2VyLlxuICBpZiAoaW5kZXggPj0gbGVuKSByZXR1cm4gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgaW5kZXggKz0gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gY29lcmNlIChsZW5ndGgpIHtcbiAgLy8gQ29lcmNlIGxlbmd0aCB0byBhIG51bWJlciAocG9zc2libHkgTmFOKSwgcm91bmQgdXBcbiAgLy8gaW4gY2FzZSBpdCdzIGZyYWN0aW9uYWwgKGUuZy4gMTIzLjQ1NikgdGhlbiBkbyBhXG4gIC8vIGRvdWJsZSBuZWdhdGUgdG8gY29lcmNlIGEgTmFOIHRvIDAuIEVhc3ksIHJpZ2h0P1xuICBsZW5ndGggPSB+fk1hdGguY2VpbCgrbGVuZ3RoKVxuICByZXR1cm4gbGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGhcbn1cblxuZnVuY3Rpb24gaXNBcnJheSAoc3ViamVjdCkge1xuICByZXR1cm4gKEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHN1YmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN1YmplY3QpID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0pKHN1YmplY3QpXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlpc2ggKHN1YmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXkoc3ViamVjdCkgfHwgQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpIHx8XG4gICAgICBzdWJqZWN0ICYmIHR5cGVvZiBzdWJqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIHN1YmplY3QubGVuZ3RoID09PSAnbnVtYmVyJ1xufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGIgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChiIDw9IDB4N0YpXG4gICAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSlcbiAgICBlbHNlIHtcbiAgICAgIHZhciBzdGFydCA9IGlcbiAgICAgIGlmIChiID49IDB4RDgwMCAmJiBiIDw9IDB4REZGRikgaSsrXG4gICAgICB2YXIgaCA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIuc2xpY2Uoc3RhcnQsIGkrMSkpLnN1YnN0cigxKS5zcGxpdCgnJScpXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGgubGVuZ3RoOyBqKyspXG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIHBvc1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cblxuLypcbiAqIFdlIGhhdmUgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIHZhbHVlIGlzIGEgdmFsaWQgaW50ZWdlci4gVGhpcyBtZWFucyB0aGF0IGl0XG4gKiBpcyBub24tbmVnYXRpdmUuIEl0IGhhcyBubyBmcmFjdGlvbmFsIGNvbXBvbmVudCBhbmQgdGhhdCBpdCBkb2VzIG5vdFxuICogZXhjZWVkIHRoZSBtYXhpbXVtIGFsbG93ZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZlcmlmdWludCAodmFsdWUsIG1heCkge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPj0gMCwgJ3NwZWNpZmllZCBhIG5lZ2F0aXZlIHZhbHVlIGZvciB3cml0aW5nIGFuIHVuc2lnbmVkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGlzIGxhcmdlciB0aGFuIG1heGltdW0gdmFsdWUgZm9yIHR5cGUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZnNpbnQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZklFRUU3NTQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxufVxuXG5mdW5jdGlvbiBhc3NlcnQgKHRlc3QsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0ZXN0KSB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSB8fCAnRmFpbGVkIGFzc2VydGlvbicpXG59XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwickgxSlBHXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9idWZmZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5leHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9pZWVlNzU0XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXHJcbiAqIE9iamVjdC5vYnNlcnZlIHBvbHlmaWxsIC0gdjAuMi40XHJcbiAqIGJ5IE1hc3NpbW8gQXJ0aXp6dSAoTWF4QXJ0MjUwMSlcclxuICogXHJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9NYXhBcnQyNTAxL29iamVjdC1vYnNlcnZlXHJcbiAqIFxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2VcclxuICogU2VlIExJQ0VOU0UgZm9yIGRldGFpbHNcclxuICovXHJcblxyXG4vLyBTb21lIHR5cGUgZGVmaW5pdGlvbnNcclxuLyoqXHJcbiAqIFRoaXMgcmVwcmVzZW50cyB0aGUgZGF0YSByZWxhdGl2ZSB0byBhbiBvYnNlcnZlZCBvYmplY3RcclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgT2JqZWN0RGF0YVxyXG4gKiBAcHJvcGVydHkge01hcDxIYW5kbGVyLCBIYW5kbGVyRGF0YT59ICBoYW5kbGVyc1xyXG4gKiBAcHJvcGVydHkge1N0cmluZ1tdfSAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzXHJcbiAqIEBwcm9wZXJ0eSB7KltdfSAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlc1xyXG4gKiBAcHJvcGVydHkge0Rlc2NyaXB0b3JbXX0gICAgICAgICAgICAgICBkZXNjcmlwdG9yc1xyXG4gKiBAcHJvcGVydHkge05vdGlmaWVyfSAgICAgICAgICAgICAgICAgICBub3RpZmllclxyXG4gKiBAcHJvcGVydHkge0Jvb2xlYW59ICAgICAgICAgICAgICAgICAgICBmcm96ZW5cclxuICogQHByb3BlcnR5IHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgZXh0ZW5zaWJsZVxyXG4gKiBAcHJvcGVydHkge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBwcm90b1xyXG4gKi9cclxuLyoqXHJcbiAqIEZ1bmN0aW9uIGRlZmluaXRpb24gb2YgYSBoYW5kbGVyXHJcbiAqIEBjYWxsYmFjayBIYW5kbGVyXHJcbiAqIEBwYXJhbSB7Q2hhbmdlUmVjb3JkW119ICAgICAgICAgICAgICAgIGNoYW5nZXNcclxuKi9cclxuLyoqXHJcbiAqIFRoaXMgcmVwcmVzZW50cyB0aGUgZGF0YSByZWxhdGl2ZSB0byBhbiBvYnNlcnZlZCBvYmplY3QgYW5kIG9uZSBvZiBpdHNcclxuICogaGFuZGxlcnNcclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgSGFuZGxlckRhdGFcclxuICogQHByb3BlcnR5IHtNYXA8T2JqZWN0LCBPYnNlcnZlZERhdGE+fSAgb2JzZXJ2ZWRcclxuICogQHByb3BlcnR5IHtDaGFuZ2VSZWNvcmRbXX0gICAgICAgICAgICAgY2hhbmdlUmVjb3Jkc1xyXG4gKi9cclxuLyoqXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIE9ic2VydmVkRGF0YVxyXG4gKiBAcHJvcGVydHkge1N0cmluZ1tdfSAgICAgICAgICAgICAgICAgICBhY2NlcHRMaXN0XHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0RGF0YX0gICAgICAgICAgICAgICAgIGRhdGFcclxuKi9cclxuLyoqXHJcbiAqIFR5cGUgZGVmaW5pdGlvbiBmb3IgYSBjaGFuZ2UuIEFueSBvdGhlciBwcm9wZXJ0eSBjYW4gYmUgYWRkZWQgdXNpbmdcclxuICogdGhlIG5vdGlmeSgpIG9yIHBlcmZvcm1DaGFuZ2UoKSBtZXRob2RzIG9mIHRoZSBub3RpZmllci5cclxuICogQHR5cGVkZWYgIHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgQ2hhbmdlUmVjb3JkXHJcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSAgICAgICAgICAgICAgICAgICAgIHR5cGVcclxuICogQHByb3BlcnR5IHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgb2JqZWN0XHJcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSAgICAgICAgICAgICAgICAgICAgIFtuYW1lXVxyXG4gKiBAcHJvcGVydHkgeyp9ICAgICAgICAgICAgICAgICAgICAgICAgICBbb2xkVmFsdWVdXHJcbiAqIEBwcm9wZXJ0eSB7TnVtYmVyfSAgICAgICAgICAgICAgICAgICAgIFtpbmRleF1cclxuICovXHJcbi8qKlxyXG4gKiBUeXBlIGRlZmluaXRpb24gZm9yIGEgbm90aWZpZXIgKHdoYXQgT2JqZWN0LmdldE5vdGlmaWVyIHJldHVybnMpXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIE5vdGlmaWVyXHJcbiAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259ICAgICAgICAgICAgICAgICAgIG5vdGlmeVxyXG4gKiBAcHJvcGVydHkge0Z1bmN0aW9ufSAgICAgICAgICAgICAgICAgICBwZXJmb3JtQ2hhbmdlXHJcbiAqL1xyXG4vKipcclxuICogRnVuY3Rpb24gY2FsbGVkIHdpdGggTm90aWZpZXIucGVyZm9ybUNoYW5nZS4gSXQgbWF5IG9wdGlvbmFsbHkgcmV0dXJuIGFcclxuICogQ2hhbmdlUmVjb3JkIHRoYXQgZ2V0cyBhdXRvbWF0aWNhbGx5IG5vdGlmaWVkLCBidXQgYHR5cGVgIGFuZCBgb2JqZWN0YFxyXG4gKiBwcm9wZXJ0aWVzIGFyZSBvdmVycmlkZGVuLlxyXG4gKiBAY2FsbGJhY2sgUGVyZm9ybWVyXHJcbiAqIEByZXR1cm5zIHtDaGFuZ2VSZWNvcmR8dW5kZWZpbmVkfVxyXG4gKi9cclxuXHJcbk9iamVjdC5vYnNlcnZlIHx8IChmdW5jdGlvbihPLCBBLCByb290KSB7XHJcbiAgICBcInVzZSBzdHJpY3RcIjtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmVsYXRlcyBvYnNlcnZlZCBvYmplY3RzIGFuZCB0aGVpciBkYXRhXHJcbiAgICAgICAgICogQHR5cGUge01hcDxPYmplY3QsIE9iamVjdERhdGF9XHJcbiAgICAgICAgICovXHJcbiAgICB2YXIgb2JzZXJ2ZWQsXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogTGlzdCBvZiBoYW5kbGVycyBhbmQgdGhlaXIgZGF0YVxyXG4gICAgICAgICAqIEB0eXBlIHtNYXA8SGFuZGxlciwgTWFwPE9iamVjdCwgSGFuZGxlckRhdGE+Pn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBoYW5kbGVycyxcclxuXHJcbiAgICAgICAgZGVmYXVsdEFjY2VwdExpc3QgPSBbIFwiYWRkXCIsIFwidXBkYXRlXCIsIFwiZGVsZXRlXCIsIFwicmVjb25maWd1cmVcIiwgXCJzZXRQcm90b3R5cGVcIiwgXCJwcmV2ZW50RXh0ZW5zaW9uc1wiIF07XHJcblxyXG4gICAgLy8gRnVuY3Rpb25zIGZvciBpbnRlcm5hbCB1c2FnZVxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDaGVja3MgaWYgdGhlIGFyZ3VtZW50IGlzIGFuIEFycmF5IG9iamVjdC4gUG9seWZpbGxzIEFycmF5LmlzQXJyYXkuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGlzQXJyYXlcclxuICAgICAgICAgKiBAcGFyYW0gez8qfSBvYmplY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgIHZhciBpc0FycmF5ID0gQS5pc0FycmF5IHx8IChmdW5jdGlvbih0b1N0cmluZykge1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG9iamVjdCkgeyByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmplY3QpID09PSBcIltvYmplY3QgQXJyYXldXCI7IH07XHJcbiAgICAgICAgfSkoTy5wcm90b3R5cGUudG9TdHJpbmcpLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBpbmRleCBvZiBhbiBpdGVtIGluIGEgY29sbGVjdGlvbiwgb3IgLTEgaWYgbm90IGZvdW5kLlxyXG4gICAgICAgICAqIFVzZXMgdGhlIGdlbmVyaWMgQXJyYXkuaW5kZXhPZiBvciBBcnJheS5wcm90b3R5cGUuaW5kZXhPZiBpZiBhdmFpbGFibGUuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGluQXJyYXlcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheVxyXG4gICAgICAgICAqIEBwYXJhbSB7Kn0gcGl2b3QgICAgICAgICAgIEl0ZW0gdG8gbG9vayBmb3JcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0PTBdICBJbmRleCB0byBzdGFydCBmcm9tXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbkFycmF5ID0gQS5wcm90b3R5cGUuaW5kZXhPZiA/IEEuaW5kZXhPZiB8fCBmdW5jdGlvbihhcnJheSwgcGl2b3QsIHN0YXJ0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBBLnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYXJyYXksIHBpdm90LCBzdGFydCk7XHJcbiAgICAgICAgfSA6IGZ1bmN0aW9uKGFycmF5LCBwaXZvdCwgc3RhcnQpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IHN0YXJ0IHx8IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKylcclxuICAgICAgICAgICAgICAgIGlmIChhcnJheVtpXSA9PT0gcGl2b3QpXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIE1hcCwgb3IgYSBNYXAtbGlrZSBvYmplY3QgaXMgTWFwIGlzIG5vdFxyXG4gICAgICAgICAqIHN1cHBvcnRlZCBvciBkb2Vzbid0IHN1cHBvcnQgZm9yRWFjaCgpXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGNyZWF0ZU1hcFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNYXB9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgY3JlYXRlTWFwID0gdHlwZW9mIHJvb3QuTWFwID09PSBcInVuZGVmaW5lZFwiIHx8ICFNYXAucHJvdG90eXBlLmZvckVhY2ggPyBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgLy8gTGlnaHR3ZWlnaHQgc2hpbSBvZiBNYXAuIExhY2tzIGNsZWFyKCksIGVudHJpZXMoKSwga2V5cygpIGFuZFxyXG4gICAgICAgICAgICAvLyB2YWx1ZXMoKSAodGhlIGxhc3QgMyBub3Qgc3VwcG9ydGVkIGJ5IElFMTEsIHNvIGNhbid0IHVzZSB0aGVtKSxcclxuICAgICAgICAgICAgLy8gaXQgZG9lc24ndCBoYW5kbGUgdGhlIGNvbnN0cnVjdG9yJ3MgYXJndW1lbnQgKGxpa2UgSUUxMSkgYW5kIG9mXHJcbiAgICAgICAgICAgIC8vIGNvdXJzZSBpdCBkb2Vzbid0IHN1cHBvcnQgZm9yLi4ub2YuXHJcbiAgICAgICAgICAgIC8vIENocm9tZSAzMS0zNSBhbmQgRmlyZWZveCAxMy0yNCBoYXZlIGEgYmFzaWMgc3VwcG9ydCBvZiBNYXAsIGJ1dFxyXG4gICAgICAgICAgICAvLyB0aGV5IGxhY2sgZm9yRWFjaCgpLCBzbyB0aGVpciBuYXRpdmUgaW1wbGVtZW50YXRpb24gaXMgYmFkIGZvclxyXG4gICAgICAgICAgICAvLyB0aGlzIHBvbHlmaWxsLiAoQ2hyb21lIDM2KyBzdXBwb3J0cyBPYmplY3Qub2JzZXJ2ZS4pXHJcbiAgICAgICAgICAgIHZhciBrZXlzID0gW10sIHZhbHVlcyA9IFtdO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHNpemU6IDAsXHJcbiAgICAgICAgICAgICAgICBoYXM6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gaW5BcnJheShrZXlzLCBrZXkpID4gLTE7IH0sXHJcbiAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gdmFsdWVzW2luQXJyYXkoa2V5cywga2V5KV07IH0sXHJcbiAgICAgICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IGluQXJyYXkoa2V5cywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5cy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaXplKys7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHZhbHVlc1tpXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIFwiZGVsZXRlXCI6IGZ1bmN0aW9uKGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gaW5BcnJheShrZXlzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpID4gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5cy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2l6ZS0tO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBmb3JFYWNoOiBmdW5jdGlvbihjYWxsYmFjay8qLCB0aGlzT2JqKi8pIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoYXJndW1lbnRzWzFdLCB2YWx1ZXNbaV0sIGtleXNbaV0sIHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gOiBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBNYXAoKTsgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2ltcGxlIHNoaW0gZm9yIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIHdoZW4gaXMgbm90IGF2YWlsYWJsZVxyXG4gICAgICAgICAqIE1pc3NlcyBjaGVja3Mgb24gb2JqZWN0LCBkb24ndCB1c2UgYXMgYSByZXBsYWNlbWVudCBvZiBPYmplY3Qua2V5cy9nZXRPd25Qcm9wZXJ0eU5hbWVzXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGdldFByb3BzXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmdbXX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRQcm9wcyA9IE8uZ2V0T3duUHJvcGVydHlOYW1lcyA/IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIGZ1bmMgPSBPLmdldE93blByb3BlcnR5TmFtZXM7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhcmd1bWVudHMuY2FsbGVlO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTdHJpY3QgbW9kZSBpcyBzdXBwb3J0ZWRcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBJbiBzdHJpY3QgbW9kZSwgd2UgY2FuJ3QgYWNjZXNzIHRvIFwiYXJndW1lbnRzXCIsIFwiY2FsbGVyXCIgYW5kXHJcbiAgICAgICAgICAgICAgICAvLyBcImNhbGxlZVwiIHByb3BlcnRpZXMgb2YgZnVuY3Rpb25zLiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lc1xyXG4gICAgICAgICAgICAgICAgLy8gcmV0dXJucyBbIFwicHJvdG90eXBlXCIsIFwibGVuZ3RoXCIsIFwibmFtZVwiIF0gaW4gRmlyZWZveDsgaXQgcmV0dXJuc1xyXG4gICAgICAgICAgICAgICAgLy8gXCJjYWxsZXJcIiBhbmQgXCJhcmd1bWVudHNcIiB0b28gaW4gQ2hyb21lIGFuZCBpbiBJbnRlcm5ldFxyXG4gICAgICAgICAgICAgICAgLy8gRXhwbG9yZXIsIHNvIHRob3NlIHZhbHVlcyBtdXN0IGJlIGZpbHRlcmVkLlxyXG4gICAgICAgICAgICAgICAgdmFyIGF2b2lkID0gKGZ1bmMoaW5BcnJheSkuam9pbihcIiBcIikgKyBcIiBcIikucmVwbGFjZSgvcHJvdG90eXBlIHxsZW5ndGggfG5hbWUgL2csIFwiXCIpLnNsaWNlKDAsIC0xKS5zcGxpdChcIiBcIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoYXZvaWQubGVuZ3RoKSBmdW5jID0gZnVuY3Rpb24ob2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BzID0gTy5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGo7IGkgPCBhdm9pZC5sZW5ndGg7KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChqID0gaW5BcnJheShwcm9wcywgYXZvaWRbaSsrXSkpID4gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMuc3BsaWNlKGosIDEpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcHM7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jO1xyXG4gICAgICAgIH0pKCkgOiBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgICAgICAgLy8gUG9vci1tb3V0aCB2ZXJzaW9uIHdpdGggZm9yLi4uaW4gKElFOC0pXHJcbiAgICAgICAgICAgIHZhciBwcm9wcyA9IFtdLCBwcm9wLCBob3A7XHJcbiAgICAgICAgICAgIGlmIChcImhhc093blByb3BlcnR5XCIgaW4gb2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gb2JqZWN0KVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3QuaGFzT3duUHJvcGVydHkocHJvcCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnB1c2gocHJvcCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBob3AgPSBPLmhhc093blByb3BlcnR5O1xyXG4gICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIG9iamVjdClcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaG9wLmNhbGwob2JqZWN0LCBwcm9wKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcHMucHVzaChwcm9wKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSW5zZXJ0aW5nIGEgY29tbW9uIG5vbi1lbnVtZXJhYmxlIHByb3BlcnR5IG9mIGFycmF5c1xyXG4gICAgICAgICAgICBpZiAoaXNBcnJheShvYmplY3QpKVxyXG4gICAgICAgICAgICAgICAgcHJvcHMucHVzaChcImxlbmd0aFwiKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBwcm9wcztcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm4gdGhlIHByb3RvdHlwZSBvZiB0aGUgb2JqZWN0Li4uIGlmIGRlZmluZWQuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGdldFByb3RvdHlwZVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFByb3RvdHlwZSA9IE8uZ2V0UHJvdG90eXBlT2YsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybiB0aGUgZGVzY3JpcHRvciBvZiB0aGUgb2JqZWN0Li4uIGlmIGRlZmluZWQuXHJcbiAgICAgICAgICogSUU4IHN1cHBvcnRzIGEgKHVzZWxlc3MpIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgZm9yIERPTVxyXG4gICAgICAgICAqIG5vZGVzIG9ubHksIHNvIGRlZmluZVByb3BlcnRpZXMgaXMgY2hlY2tlZCBpbnN0ZWFkLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBnZXREZXNjcmlwdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtEZXNjcmlwdG9yfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldERlc2NyaXB0b3IgPSBPLmRlZmluZVByb3BlcnRpZXMgJiYgTy5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IsXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNldHMgdXAgdGhlIG5leHQgY2hlY2sgYW5kIGRlbGl2ZXJpbmcgaXRlcmF0aW9uLCB1c2luZ1xyXG4gICAgICAgICAqIHJlcXVlc3RBbmltYXRpb25GcmFtZSBvciBhIChjbG9zZSkgcG9seWZpbGwuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIG5leHRGcmFtZVxyXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGZ1bmNcclxuICAgICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG5leHRGcmFtZSA9IHJvb3QucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IHJvb3Qud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIGluaXRpYWwgPSArbmV3IERhdGUsXHJcbiAgICAgICAgICAgICAgICBsYXN0ID0gaW5pdGlhbDtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGZ1bmMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmMoKGxhc3QgPSArbmV3IERhdGUpIC0gaW5pdGlhbCk7XHJcbiAgICAgICAgICAgICAgICB9LCAxNyk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSkoKSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2V0cyB1cCB0aGUgb2JzZXJ2YXRpb24gb2YgYW4gb2JqZWN0XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGRvT2JzZXJ2ZVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBbYWNjZXB0TGlzdF1cclxuICAgICAgICAgKi9cclxuICAgICAgICBkb09ic2VydmUgPSBmdW5jdGlvbihvYmplY3QsIGhhbmRsZXIsIGFjY2VwdExpc3QpIHtcclxuXHJcbiAgICAgICAgICAgIHZhciBkYXRhID0gb2JzZXJ2ZWQuZ2V0KG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoZGF0YSlcclxuICAgICAgICAgICAgICAgIHNldEhhbmRsZXIob2JqZWN0LCBkYXRhLCBoYW5kbGVyLCBhY2NlcHRMaXN0KTtcclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhID0gY3JlYXRlT2JqZWN0RGF0YShvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgc2V0SGFuZGxlcihvYmplY3QsIGRhdGEsIGhhbmRsZXIsIGFjY2VwdExpc3QpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAob2JzZXJ2ZWQuc2l6ZSA9PT0gMSlcclxuICAgICAgICAgICAgICAgICAgICAvLyBMZXQgdGhlIG9ic2VydmF0aW9uIGJlZ2luIVxyXG4gICAgICAgICAgICAgICAgICAgIG5leHRGcmFtZShydW5HbG9iYWxMb29wKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIENyZWF0ZXMgdGhlIGluaXRpYWwgZGF0YSBmb3IgYW4gb2JzZXJ2ZWQgb2JqZWN0XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGNyZWF0ZU9iamVjdERhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgY3JlYXRlT2JqZWN0RGF0YSA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSkge1xyXG4gICAgICAgICAgICB2YXIgcHJvcHMgPSBnZXRQcm9wcyhvYmplY3QpLFxyXG4gICAgICAgICAgICAgICAgdmFsdWVzID0gW10sIGRlc2NzLCBpID0gMCxcclxuICAgICAgICAgICAgICAgIGRhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcnM6IGNyZWF0ZU1hcCgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGZyb3plbjogTy5pc0Zyb3plbiA/IE8uaXNGcm96ZW4ob2JqZWN0KSA6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGV4dGVuc2libGU6IE8uaXNFeHRlbnNpYmxlID8gTy5pc0V4dGVuc2libGUob2JqZWN0KSA6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvdG86IGdldFByb3RvdHlwZSAmJiBnZXRQcm90b3R5cGUob2JqZWN0KSxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wcyxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZXM6IHZhbHVlcyxcclxuICAgICAgICAgICAgICAgICAgICBub3RpZmllcjogcmV0cmlldmVOb3RpZmllcihvYmplY3QsIGRhdGEpXHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKGdldERlc2NyaXB0b3IpIHtcclxuICAgICAgICAgICAgICAgIGRlc2NzID0gZGF0YS5kZXNjcmlwdG9ycyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBwcm9wcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICBkZXNjc1tpXSA9IGdldERlc2NyaXB0b3Iob2JqZWN0LCBwcm9wc1tpXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzW2ldID0gb2JqZWN0W3Byb3BzW2krK11dO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Ugd2hpbGUgKGkgPCBwcm9wcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICB2YWx1ZXNbaV0gPSBvYmplY3RbcHJvcHNbaSsrXV07XHJcblxyXG4gICAgICAgICAgICBvYnNlcnZlZC5zZXQob2JqZWN0LCBkYXRhKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFBlcmZvcm1zIGJhc2ljIHByb3BlcnR5IHZhbHVlIGNoYW5nZSBjaGVja3Mgb24gYW4gb2JzZXJ2ZWQgb2JqZWN0XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrc1xyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0RGF0YX0gZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gW2V4Y2VwdF0gIERvZXNuJ3QgZGVsaXZlciB0aGUgY2hhbmdlcyB0byB0aGVcclxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXJzIHRoYXQgYWNjZXB0IHRoaXMgdHlwZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyA9IChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIHVwZGF0ZUNoZWNrID0gZ2V0RGVzY3JpcHRvciA/IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgaWR4LCBleGNlcHQsIGRlc2NyKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZGF0YS5wcm9wZXJ0aWVzW2lkeF0sXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XSxcclxuICAgICAgICAgICAgICAgICAgICBvdmFsdWUgPSBkYXRhLnZhbHVlc1tpZHhdLFxyXG4gICAgICAgICAgICAgICAgICAgIG9kZXNjID0gZGF0YS5kZXNjcmlwdG9yc1tpZHhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChcInZhbHVlXCIgaW4gZGVzY3IgJiYgKG92YWx1ZSA9PT0gdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgPyBvdmFsdWUgPT09IDAgJiYgMS9vdmFsdWUgIT09IDEvdmFsdWUgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDogb3ZhbHVlID09PSBvdmFsdWUgfHwgdmFsdWUgPT09IHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG92YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXNbaWR4XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKG9kZXNjLmNvbmZpZ3VyYWJsZSAmJiAoIWRlc2NyLmNvbmZpZ3VyYWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci53cml0YWJsZSAhPT0gb2Rlc2Mud3JpdGFibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3IuZW51bWVyYWJsZSAhPT0gb2Rlc2MuZW51bWVyYWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci5nZXQgIT09IG9kZXNjLmdldFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBkZXNjci5zZXQgIT09IG9kZXNjLnNldCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJyZWNvbmZpZ3VyZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG92YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5kZXNjcmlwdG9yc1tpZHhdID0gZGVzY3I7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gOiBmdW5jdGlvbihvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZGF0YS5wcm9wZXJ0aWVzW2lkeF0sXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XSxcclxuICAgICAgICAgICAgICAgICAgICBvdmFsdWUgPSBkYXRhLnZhbHVlc1tpZHhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChvdmFsdWUgPT09IHZhbHVlID8gb3ZhbHVlID09PSAwICYmIDEvb3ZhbHVlICE9PSAxL3ZhbHVlIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG92YWx1ZSA9PT0gb3ZhbHVlIHx8IHZhbHVlID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG92YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXNbaWR4XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2tzIGlmIHNvbWUgcHJvcGVydHkgaGFzIGJlZW4gZGVsZXRlZFxyXG4gICAgICAgICAgICB2YXIgZGVsZXRpb25DaGVjayA9IGdldERlc2NyaXB0b3IgPyBmdW5jdGlvbihvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpID0gcHJvcHMubGVuZ3RoLCBkZXNjcjtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChwcm9wbGVuICYmIGktLSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wc1tpXSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjciA9IGdldERlc2NyaXB0b3Iob2JqZWN0LCBwcm9wc1tpXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGVzY3JpcHRvciwgdGhlIHByb3BlcnR5IGhhcyByZWFsbHlcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYmVlbiBkZWxldGVkOyBvdGhlcndpc2UsIGl0J3MgYmVlbiByZWNvbmZpZ3VyZWQgc29cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhhdCdzIG5vdCBlbnVtZXJhYmxlIGFueW1vcmVcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlc2NyKSB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGksIGV4Y2VwdCwgZGVzY3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9wc1tpXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBkYXRhLnZhbHVlc1tpXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnZhbHVlcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmRlc2NyaXB0b3JzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSA6IGZ1bmN0aW9uKG9iamVjdCwgcHJvcHMsIHByb3BsZW4sIGRhdGEsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGkgPSBwcm9wcy5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICB3aGlsZSAocHJvcGxlbiAmJiBpLS0pXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzW2ldICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHByb3BzW2ldLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJkZWxldGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IGRhdGEudmFsdWVzW2ldXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzLnNwbGljZShpLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGxlbi0tO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhLCBvYmplY3QsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLmhhbmRsZXJzLnNpemUgfHwgZGF0YS5mcm96ZW4pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgcHJvcHMsIHByb3BsZW4sIGtleXMsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzID0gZGF0YS52YWx1ZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzY3MgPSBkYXRhLmRlc2NyaXB0b3JzLFxyXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwLCBpZHgsXHJcbiAgICAgICAgICAgICAgICAgICAga2V5LCB2YWx1ZSxcclxuICAgICAgICAgICAgICAgICAgICBwcm90bywgZGVzY3I7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIG9iamVjdCBpc24ndCBleHRlbnNpYmxlLCB3ZSBkb24ndCBuZWVkIHRvIGNoZWNrIGZvciBuZXdcclxuICAgICAgICAgICAgICAgIC8vIG9yIGRlbGV0ZWQgcHJvcGVydGllc1xyXG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuZXh0ZW5zaWJsZSkge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBwcm9wcyA9IGRhdGEucHJvcGVydGllcy5zbGljZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3BsZW4gPSBwcm9wcy5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICAgICAga2V5cyA9IGdldFByb3BzKG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZXNjcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGtleXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZHggPSBpbkFycmF5KHByb3BzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3IgPSBnZXREZXNjcmlwdG9yKG9iamVjdCwga2V5KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWR4ID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFkZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9wZXJ0aWVzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaChvYmplY3Rba2V5XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3MucHVzaChkZXNjcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzW2lkeF0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0LCBkZXNjcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRpb25DaGVjayhvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFPLmlzRXh0ZW5zaWJsZShvYmplY3QpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmV4dGVuc2libGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInByZXZlbnRFeHRlbnNpb25zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5mcm96ZW4gPSBPLmlzRnJvemVuKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGtleXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2krK107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZHggPSBpbkFycmF5KHByb3BzLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3Rba2V5XTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWR4ID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZToga2V5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFkZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm9wZXJ0aWVzLnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzW2lkeF0gPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGlvbkNoZWNrKG9iamVjdCwgcHJvcHMsIHByb3BsZW4sIGRhdGEsIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWRhdGEuZnJvemVuKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBvYmplY3QgaXMgbm90IGV4dGVuc2libGUsIGJ1dCBub3QgZnJvemVuLCB3ZSBqdXN0IGhhdmVcclxuICAgICAgICAgICAgICAgICAgICAvLyB0byBjaGVjayBmb3IgdmFsdWUgY2hhbmdlc1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0gcHJvcHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZUNoZWNrKG9iamVjdCwgZGF0YSwgaSwgZXhjZXB0LCBnZXREZXNjcmlwdG9yKG9iamVjdCwga2V5KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoTy5pc0Zyb3plbihvYmplY3QpKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLmZyb3plbiA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGdldFByb3RvdHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb3RvID0gZ2V0UHJvdG90eXBlKG9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3RvICE9PSBkYXRhLnByb3RvKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic2V0UHJvdG90eXBlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIl9fcHJvdG9fX1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogZGF0YS5wcm90b1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5wcm90byA9IHByb3RvO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9KSgpLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTZXRzIHVwIHRoZSBtYWluIGxvb3AgZm9yIG9iamVjdCBvYnNlcnZhdGlvbiBhbmQgY2hhbmdlIG5vdGlmaWNhdGlvblxyXG4gICAgICAgICAqIEl0IHN0b3BzIGlmIG5vIG9iamVjdCBpcyBvYnNlcnZlZC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gcnVuR2xvYmFsTG9vcFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJ1bkdsb2JhbExvb3AgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKG9ic2VydmVkLnNpemUpIHtcclxuICAgICAgICAgICAgICAgIG9ic2VydmVkLmZvckVhY2gocGVyZm9ybVByb3BlcnR5Q2hlY2tzKTtcclxuICAgICAgICAgICAgICAgIGhhbmRsZXJzLmZvckVhY2goZGVsaXZlckhhbmRsZXJSZWNvcmRzKTtcclxuICAgICAgICAgICAgICAgIG5leHRGcmFtZShydW5HbG9iYWxMb29wKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIERlbGl2ZXIgdGhlIGNoYW5nZSByZWNvcmRzIHJlbGF0aXZlIHRvIGEgY2VydGFpbiBoYW5kbGVyLCBhbmQgcmVzZXRzXHJcbiAgICAgICAgICogdGhlIHJlY29yZCBsaXN0LlxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlckRhdGF9IGhkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZGVsaXZlckhhbmRsZXJSZWNvcmRzID0gZnVuY3Rpb24oaGRhdGEsIGhhbmRsZXIpIHtcclxuICAgICAgICAgICAgaWYgKGhkYXRhLmNoYW5nZVJlY29yZHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyKGhkYXRhLmNoYW5nZVJlY29yZHMpO1xyXG4gICAgICAgICAgICAgICAgaGRhdGEuY2hhbmdlUmVjb3JkcyA9IFtdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgbm90aWZpZXIgZm9yIGFuIG9iamVjdCAtIHdoZXRoZXIgaXQncyBvYnNlcnZlZCBvciBub3RcclxuICAgICAgICAgKiBAZnVuY3Rpb24gcmV0cmlldmVOb3RpZmllclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IFtkYXRhXVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOb3RpZmllcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICByZXRyaWV2ZU5vdGlmaWVyID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhKSB7XHJcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMilcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7Tm90aWZpZXJ9ICovXHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhICYmIGRhdGEubm90aWZpZXIgfHwge1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgKiBAbWV0aG9kIG5vdGlmeVxyXG4gICAgICAgICAgICAgICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNub3RpZmllcnByb3RvdHlwZS5fbm90aWZ5XHJcbiAgICAgICAgICAgICAgICAgKiBAbWVtYmVyb2YgTm90aWZpZXJcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Q2hhbmdlUmVjb3JkfSBjaGFuZ2VSZWNvcmRcclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgbm90aWZ5OiBmdW5jdGlvbihjaGFuZ2VSZWNvcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmQudHlwZTsgLy8gSnVzdCB0byBjaGVjayB0aGUgcHJvcGVydHkgaXMgdGhlcmUuLi5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkYXRhLCB0aGUgb2JqZWN0IGhhcyBiZWVuIHVub2JzZXJ2ZWRcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWNvcmRDb3B5ID0geyBvYmplY3Q6IG9iamVjdCB9LCBwcm9wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gY2hhbmdlUmVjb3JkKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3AgIT09IFwib2JqZWN0XCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVjb3JkQ29weVtwcm9wXSA9IGNoYW5nZVJlY29yZFtwcm9wXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwgcmVjb3JkQ29weSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAqIEBtZXRob2QgcGVyZm9ybUNoYW5nZVxyXG4gICAgICAgICAgICAgICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNub3RpZmllcnByb3RvdHlwZV8ucGVyZm9ybWNoYW5nZVxyXG4gICAgICAgICAgICAgICAgICogQG1lbWJlcm9mIE5vdGlmaWVyXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2hhbmdlVHlwZVxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtQZXJmb3JtZXJ9IGZ1bmMgICAgIFRoZSB0YXNrIHBlcmZvcm1lclxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHsqfSBbdGhpc09ial0gICAgICAgIFVzZWQgdG8gc2V0IGB0aGlzYCB3aGVuIGNhbGxpbmcgZnVuY1xyXG4gICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICBwZXJmb3JtQ2hhbmdlOiBmdW5jdGlvbihjaGFuZ2VUeXBlLCBmdW5jLyosIHRoaXNPYmoqLykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hhbmdlVHlwZSAhPT0gXCJzdHJpbmdcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgbm9uLXN0cmluZyBjaGFuZ2VUeXBlXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBwZXJmb3JtIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkYXRhLCB0aGUgb2JqZWN0IGhhcyBiZWVuIHVub2JzZXJ2ZWRcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wLCBjaGFuZ2VSZWNvcmQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuY2FsbChhcmd1bWVudHNbMl0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBkYXRhICYmIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyhkYXRhLCBvYmplY3QsIGNoYW5nZVR5cGUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIGRhdGEsIHRoZSBvYmplY3QgaGFzIGJlZW4gdW5vYnNlcnZlZFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhICYmIHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0ID09PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZCA9IHsgb2JqZWN0OiBvYmplY3QsIHR5cGU6IGNoYW5nZVR5cGUgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIHJlc3VsdClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wICE9PSBcIm9iamVjdFwiICYmIHByb3AgIT09IFwidHlwZVwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZFtwcm9wXSA9IHJlc3VsdFtwcm9wXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwgY2hhbmdlUmVjb3JkKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmVnaXN0ZXIgKG9yIHJlZGVmaW5lcykgYW4gaGFuZGxlciBpbiB0aGUgY29sbGVjdGlvbiBmb3IgYSBnaXZlblxyXG4gICAgICAgICAqIG9iamVjdCBhbmQgYSBnaXZlbiB0eXBlIGFjY2VwdCBsaXN0LlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBzZXRIYW5kbGVyXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0RGF0YX0gZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nW119IGFjY2VwdExpc3RcclxuICAgICAgICAgKi9cclxuICAgICAgICBzZXRIYW5kbGVyID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBoYW5kbGVyLCBhY2NlcHRMaXN0KSB7XHJcbiAgICAgICAgICAgIHZhciBoZGF0YSA9IGhhbmRsZXJzLmdldChoYW5kbGVyKTtcclxuICAgICAgICAgICAgaWYgKCFoZGF0YSlcclxuICAgICAgICAgICAgICAgIGhhbmRsZXJzLnNldChoYW5kbGVyLCBoZGF0YSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBvYnNlcnZlZDogY3JlYXRlTWFwKCksXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlUmVjb3JkczogW11cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBoZGF0YS5vYnNlcnZlZC5zZXQob2JqZWN0LCB7XHJcbiAgICAgICAgICAgICAgICBhY2NlcHRMaXN0OiBhY2NlcHRMaXN0LnNsaWNlKCksXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBkYXRhLmhhbmRsZXJzLnNldChoYW5kbGVyLCBoZGF0YSk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQWRkcyBhIGNoYW5nZSByZWNvcmQgaW4gYSBnaXZlbiBPYmplY3REYXRhXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIGFkZENoYW5nZVJlY29yZFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge0NoYW5nZVJlY29yZH0gY2hhbmdlUmVjb3JkXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IFtleGNlcHRdXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkQ2hhbmdlUmVjb3JkID0gZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBjaGFuZ2VSZWNvcmQsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICBkYXRhLmhhbmRsZXJzLmZvckVhY2goZnVuY3Rpb24oaGRhdGEpIHtcclxuICAgICAgICAgICAgICAgIHZhciBhY2NlcHRMaXN0ID0gaGRhdGEub2JzZXJ2ZWQuZ2V0KG9iamVjdCkuYWNjZXB0TGlzdDtcclxuICAgICAgICAgICAgICAgIC8vIElmIGV4Y2VwdCBpcyBkZWZpbmVkLCBOb3RpZmllci5wZXJmb3JtQ2hhbmdlIGhhcyBiZWVuXHJcbiAgICAgICAgICAgICAgICAvLyBjYWxsZWQsIHdpdGggZXhjZXB0IGFzIHRoZSB0eXBlLlxyXG4gICAgICAgICAgICAgICAgLy8gQWxsIHRoZSBoYW5kbGVycyB0aGF0IGFjY2VwdHMgdGhhdCB0eXBlIGFyZSBza2lwcGVkLlxyXG4gICAgICAgICAgICAgICAgaWYgKCh0eXBlb2YgZXhjZXB0ICE9PSBcInN0cmluZ1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGluQXJyYXkoYWNjZXB0TGlzdCwgZXhjZXB0KSA9PT0gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICYmIGluQXJyYXkoYWNjZXB0TGlzdCwgY2hhbmdlUmVjb3JkLnR5cGUpID4gLTEpXHJcbiAgICAgICAgICAgICAgICAgICAgaGRhdGEuY2hhbmdlUmVjb3Jkcy5wdXNoKGNoYW5nZVJlY29yZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgb2JzZXJ2ZWQgPSBjcmVhdGVNYXAoKTtcclxuICAgIGhhbmRsZXJzID0gY3JlYXRlTWFwKCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0Lm9ic2VydmVcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jT2JqZWN0Lm9ic2VydmVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICogQHBhcmFtIHtTdHJpbmdbXX0gW2FjY2VwdExpc3RdXHJcbiAgICAgKiBAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAgICAgICAgICAgICAgIFRoZSBvYnNlcnZlZCBvYmplY3RcclxuICAgICAqL1xyXG4gICAgTy5vYnNlcnZlID0gZnVuY3Rpb24gb2JzZXJ2ZShvYmplY3QsIGhhbmRsZXIsIGFjY2VwdExpc3QpIHtcclxuICAgICAgICBpZiAoIW9iamVjdCB8fCB0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiBvYmplY3QgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCBvYnNlcnZlIG5vbi1vYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0Lm9ic2VydmUgY2Fubm90IGRlbGl2ZXIgdG8gbm9uLWZ1bmN0aW9uXCIpO1xyXG5cclxuICAgICAgICBpZiAoTy5pc0Zyb3plbiAmJiBPLmlzRnJvemVuKGhhbmRsZXIpKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0Lm9ic2VydmUgY2Fubm90IGRlbGl2ZXIgdG8gYSBmcm96ZW4gZnVuY3Rpb24gb2JqZWN0XCIpO1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIGFjY2VwdExpc3QgPT09IFwidW5kZWZpbmVkXCIpXHJcbiAgICAgICAgICAgIGFjY2VwdExpc3QgPSBkZWZhdWx0QWNjZXB0TGlzdDtcclxuICAgICAgICBlbHNlIGlmICghYWNjZXB0TGlzdCB8fCB0eXBlb2YgYWNjZXB0TGlzdCAhPT0gXCJvYmplY3RcIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoaXJkIGFyZ3VtZW50IHRvIE9iamVjdC5vYnNlcnZlIG11c3QgYmUgYW4gYXJyYXkgb2Ygc3RyaW5ncy5cIik7XHJcblxyXG4gICAgICAgIGRvT2JzZXJ2ZShvYmplY3QsIGhhbmRsZXIsIGFjY2VwdExpc3QpO1xyXG5cclxuICAgICAgICByZXR1cm4gb2JqZWN0O1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBmdW5jdGlvbiBPYmplY3QudW5vYnNlcnZlXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI09iamVjdC51bm9ic2VydmVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gICAgICAgICBUaGUgZ2l2ZW4gb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIE8udW5vYnNlcnZlID0gZnVuY3Rpb24gdW5vYnNlcnZlKG9iamVjdCwgaGFuZGxlcikge1xyXG4gICAgICAgIGlmIChvYmplY3QgPT09IG51bGwgfHwgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QudW5vYnNlcnZlIGNhbm5vdCB1bm9ic2VydmUgbm9uLW9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QudW5vYnNlcnZlIGNhbm5vdCBkZWxpdmVyIHRvIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgdmFyIGhkYXRhID0gaGFuZGxlcnMuZ2V0KGhhbmRsZXIpLCBvZGF0YTtcclxuXHJcbiAgICAgICAgaWYgKGhkYXRhICYmIChvZGF0YSA9IGhkYXRhLm9ic2VydmVkLmdldChvYmplY3QpKSkge1xyXG4gICAgICAgICAgICBoZGF0YS5vYnNlcnZlZC5mb3JFYWNoKGZ1bmN0aW9uKG9kYXRhLCBvYmplY3QpIHtcclxuICAgICAgICAgICAgICAgIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyhvZGF0YS5kYXRhLCBvYmplY3QpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgbmV4dEZyYW1lKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgZGVsaXZlckhhbmRsZXJSZWNvcmRzKGhkYXRhLCBoYW5kbGVyKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBJbiBGaXJlZm94IDEzLTE4LCBzaXplIGlzIGEgZnVuY3Rpb24sIGJ1dCBjcmVhdGVNYXAgc2hvdWxkIGZhbGxcclxuICAgICAgICAgICAgLy8gYmFjayB0byB0aGUgc2hpbSBmb3IgdGhvc2UgdmVyc2lvbnNcclxuICAgICAgICAgICAgaWYgKGhkYXRhLm9ic2VydmVkLnNpemUgPT09IDEgJiYgaGRhdGEub2JzZXJ2ZWQuaGFzKG9iamVjdCkpXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyc1tcImRlbGV0ZVwiXShoYW5kbGVyKTtcclxuICAgICAgICAgICAgZWxzZSBoZGF0YS5vYnNlcnZlZFtcImRlbGV0ZVwiXShvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgaWYgKG9kYXRhLmRhdGEuaGFuZGxlcnMuc2l6ZSA9PT0gMSlcclxuICAgICAgICAgICAgICAgIG9ic2VydmVkW1wiZGVsZXRlXCJdKG9iamVjdCk7XHJcbiAgICAgICAgICAgIGVsc2Ugb2RhdGEuZGF0YS5oYW5kbGVyc1tcImRlbGV0ZVwiXShoYW5kbGVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBvYmplY3Q7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC5nZXROb3RpZmllclxyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNHZXROb3RpZmllclxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICogQHJldHVybnMge05vdGlmaWVyfVxyXG4gICAgICovXHJcbiAgICBPLmdldE5vdGlmaWVyID0gZnVuY3Rpb24gZ2V0Tm90aWZpZXIob2JqZWN0KSB7XHJcbiAgICAgICAgaWYgKG9iamVjdCA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiBvYmplY3QgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5nZXROb3RpZmllciBjYW5ub3QgZ2V0Tm90aWZpZXIgbm9uLW9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKE8uaXNGcm96ZW4gJiYgTy5pc0Zyb3plbihvYmplY3QpKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHJldHJpZXZlTm90aWZpZXIob2JqZWN0KTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI09iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3Jkc1xyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNEZWxpdmVyQ2hhbmdlUmVjb3Jkc1xyXG4gICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgKiBAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbiAgICAgKi9cclxuICAgIE8uZGVsaXZlckNoYW5nZVJlY29yZHMgPSBmdW5jdGlvbiBkZWxpdmVyQ2hhbmdlUmVjb3JkcyhoYW5kbGVyKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHMgY2Fubm90IGRlbGl2ZXIgdG8gbm9uLWZ1bmN0aW9uXCIpO1xyXG5cclxuICAgICAgICB2YXIgaGRhdGEgPSBoYW5kbGVycy5nZXQoaGFuZGxlcik7XHJcbiAgICAgICAgaWYgKGhkYXRhKSB7XHJcbiAgICAgICAgICAgIGhkYXRhLm9ic2VydmVkLmZvckVhY2goZnVuY3Rpb24ob2RhdGEsIG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgcGVyZm9ybVByb3BlcnR5Q2hlY2tzKG9kYXRhLmRhdGEsIG9iamVjdCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBkZWxpdmVySGFuZGxlclJlY29yZHMoaGRhdGEsIGhhbmRsZXIpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG59KShPYmplY3QsIEFycmF5LCB0aGlzKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwickgxSlBHXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL29iamVjdC5vYnNlcnZlL2Rpc3Qvb2JqZWN0LW9ic2VydmUuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvb2JqZWN0Lm9ic2VydmUvZGlzdFwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcInJIMUpQR1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvcHJvY2Vzc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgZGVwdGhTdHJpbmcgPSAnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnO1xuXG4gICAgZnVuY3Rpb24gRGF0YU5vZGVCYXNlKGtleSkge1xuICAgICAgICB0aGlzLmxhYmVsID0ga2V5O1xuICAgICAgICB0aGlzLmRhdGEgPSBbJyddO1xuICAgICAgICB0aGlzLnJvd0luZGV4ZXMgPSBbXTtcbiAgICAgICAgdGhpcy5oYXNDaGlsZHJlbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRlcHRoID0gMDtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAxO1xuICAgICAgICB0aGlzLmV4cGFuZGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgRGF0YU5vZGVCYXNlLnByb3RvdHlwZS5pc051bGxPYmplY3QgPSBmYWxzZTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbih4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFbeF07XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUucHJ1bmUgPSBmdW5jdGlvbihkZXB0aCkge1xuICAgICAgICB0aGlzLmRlcHRoID0gZGVwdGg7XG4gICAgICAgIHRoaXMuZGF0YVswXSA9IHRoaXMuY29tcHV0ZURlcHRoU3RyaW5nKCk7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuY29tcHV0ZURlcHRoU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdHJpbmcgPSBkZXB0aFN0cmluZy5zdWJzdHJpbmcoMCwgMiArICh0aGlzLmRlcHRoICogMykpICsgdGhpcy5sYWJlbDtcbiAgICAgICAgcmV0dXJuIHN0cmluZztcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVCYXNlLnByb3RvdHlwZS5jb21wdXRlSGVpZ2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmdldEFsbFJvd0luZGV4ZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm93SW5kZXhlcztcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVCYXNlLnByb3RvdHlwZS5jb21wdXRlQWdncmVnYXRlcyA9IGZ1bmN0aW9uKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgdGhpcy5hcHBseUFnZ3JlZ2F0ZXMoYWdncmVnYXRvcik7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuYXBwbHlBZ2dyZWdhdGVzID0gZnVuY3Rpb24oYWdncmVnYXRvcikge1xuICAgICAgICB2YXIgaW5kZXhlcyA9IHRoaXMuZ2V0QWxsUm93SW5kZXhlcygpO1xuICAgICAgICBpZiAoaW5kZXhlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gbm8gZGF0YSB0byByb2xsdXAgb25cbiAgICAgICAgfVxuICAgICAgICB2YXIgYWdncmVnYXRlcyA9IGFnZ3JlZ2F0b3IuYWdncmVnYXRlcztcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICAgIGRhdGEubGVuZ3RoID0gYWdncmVnYXRlcy5sZW5ndGggKyAxO1xuXG4gICAgICAgIHZhciBzb3J0ZXIgPSBhZ2dyZWdhdG9yLnNvcnRlckluc3RhbmNlO1xuICAgICAgICBzb3J0ZXIuaW5kZXhlcyA9IGluZGV4ZXM7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhZ2dyZWdhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgYWdncmVnYXRlID0gYWdncmVnYXRlc1tpXTtcbiAgICAgICAgICAgIGRhdGFbaSArIDFdID0gYWdncmVnYXRlKHNvcnRlcik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmJ1aWxkVmlldyA9IGZ1bmN0aW9uKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgYWdncmVnYXRvci52aWV3LnB1c2godGhpcyk7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUudG9nZ2xlRXhwYW5zaW9uU3RhdGUgPSBmdW5jdGlvbigpIHsgLyogYWdncmVnYXRvciAqL1xuICAgICAgICAvL2RvIG5vdGhpbmcgYnkgZGVmYXVsdFxuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YU5vZGVCYXNlO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhTm9kZUJhc2UuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBNYXAgPSByZXF1aXJlKCcuL01hcCcpO1xudmFyIERhdGFOb2RlQmFzZSA9IHJlcXVpcmUoJy4vRGF0YU5vZGVCYXNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIEV4cGFuZGVkTWFwID0ge1xuICAgICAgICB0cnVlOiAn4pa+JyxcbiAgICAgICAgZmFsc2U6ICfilrgnXG4gICAgfTtcbiAgICB2YXIgZGVwdGhTdHJpbmcgPSAnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnO1xuXG4gICAgZnVuY3Rpb24gRGF0YU5vZGVHcm91cChrZXkpIHtcbiAgICAgICAgRGF0YU5vZGVCYXNlLmNhbGwodGhpcywga2V5KTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IG5ldyBNYXAoKTtcbiAgICB9XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGF0YU5vZGVCYXNlLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5wcnVuZSA9IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgICAgIHRoaXMuZGVwdGggPSBkZXB0aDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW4udmFsdWVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baV07XG4gICAgICAgICAgICBjaGlsZC5wcnVuZSh0aGlzLmRlcHRoICsgMSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5kYXRhWzBdID0gdGhpcy5jb21wdXRlRGVwdGhTdHJpbmcoKTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUuY29tcHV0ZURlcHRoU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBpY29uID0gRXhwYW5kZWRNYXBbdGhpcy5leHBhbmRlZCArICcnXTtcbiAgICAgICAgdmFyIHN0cmluZyA9IGRlcHRoU3RyaW5nLnN1YnN0cmluZygwLCB0aGlzLmRlcHRoICogMykgKyBpY29uICsgJyAnICsgdGhpcy5sYWJlbDtcbiAgICAgICAgcmV0dXJuIHN0cmluZztcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUuZ2V0QWxsUm93SW5kZXhlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5yb3dJbmRleGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5yb3dJbmRleGVzID0gdGhpcy5jb21wdXRlQWxsUm93SW5kZXhlcygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnJvd0luZGV4ZXM7XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVBbGxSb3dJbmRleGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgdmFyIGNoaWxkSW5kZXhlcyA9IGNoaWxkLmdldEFsbFJvd0luZGV4ZXMoKTtcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkocmVzdWx0LCBbcmVzdWx0Lmxlbmd0aCwgMF0uY29uY2F0KGNoaWxkSW5kZXhlcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLnRvZ2dsZUV4cGFuc2lvblN0YXRlID0gZnVuY3Rpb24oYWdncmVnYXRvcikgeyAvKiBhZ2dyZWdhdG9yICovXG4gICAgICAgIHRoaXMuZXhwYW5kZWQgPSAhdGhpcy5leHBhbmRlZDtcbiAgICAgICAgdGhpcy5kYXRhWzBdID0gdGhpcy5jb21wdXRlRGVwdGhTdHJpbmcoKTtcbiAgICAgICAgaWYgKHRoaXMuZXhwYW5kZWQpIHtcbiAgICAgICAgICAgIHRoaXMuY29tcHV0ZUFnZ3JlZ2F0ZXMoYWdncmVnYXRvcik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUuY29tcHV0ZUFnZ3JlZ2F0ZXMgPSBmdW5jdGlvbihhZ2dyZWdhdG9yKSB7XG4gICAgICAgIHRoaXMuYXBwbHlBZ2dyZWdhdGVzKGFnZ3JlZ2F0b3IpO1xuICAgICAgICBpZiAoIXRoaXMuZXhwYW5kZWQpIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gd2VyZSBub3QgYmVpbmcgdmlld2VkLCBkb24ndCBoYXZlIGNoaWxkIG5vZGVzIGRvIGNvbXB1dGF0aW9uO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbltpXS5jb21wdXRlQWdncmVnYXRlcyhhZ2dyZWdhdG9yKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5idWlsZFZpZXcgPSBmdW5jdGlvbihhZ2dyZWdhdG9yKSB7XG4gICAgICAgIGFnZ3JlZ2F0b3Iudmlldy5wdXNoKHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5leHBhbmRlZCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgICAgICBjaGlsZC5idWlsZFZpZXcoYWdncmVnYXRvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUuY29tcHV0ZUhlaWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaGVpZ2h0ID0gMTsgLy9JJ20gMSBoaWdoXG4gICAgICAgIGlmICghdGhpcy5leHBhbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gaGVpZ2h0ICsgdGhpcy5jaGlsZHJlbltpXS5jb21wdXRlSGVpZ2h0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5oZWlnaHQ7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhTm9kZUdyb3VwO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhTm9kZUdyb3VwLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YU5vZGVCYXNlID0gcmVxdWlyZSgnLi9EYXRhTm9kZUJhc2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhTm9kZUxlYWYoa2V5KSB7XG4gICAgICAgIERhdGFOb2RlQmFzZS5jYWxsKHRoaXMsIGtleSk7XG4gICAgfVxuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGF0YU5vZGVCYXNlLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZUxlYWYucHJvdG90eXBlLnBydW5lID0gZnVuY3Rpb24oZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aCA9IGRlcHRoO1xuICAgICAgICB0aGlzLmRhdGFbMF0gPSB0aGlzLmNvbXB1dGVEZXB0aFN0cmluZygpO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUxlYWYucHJvdG90eXBlLmNvbXB1dGVIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfTtcblxuICAgIERhdGFOb2RlTGVhZi5wcm90b3R5cGUuZ2V0QWxsUm93SW5kZXhlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yb3dJbmRleGVzO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUxlYWYucHJvdG90eXBlLmNvbXB1dGVBZ2dyZWdhdGVzID0gZnVuY3Rpb24oYWdncmVnYXRvcikge1xuICAgICAgICB0aGlzLmFwcGx5QWdncmVnYXRlcyhhZ2dyZWdhdG9yKTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZS5idWlsZFZpZXcgPSBmdW5jdGlvbihhZ2dyZWdhdG9yKSB7XG4gICAgICAgIGFnZ3JlZ2F0b3Iudmlldy5wdXNoKHRoaXMpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YU5vZGVMZWFmO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhTm9kZUxlYWYuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBEYXRhTm9kZUdyb3VwID0gcmVxdWlyZSgnLi9EYXRhTm9kZUdyb3VwJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgZnVuY3Rpb24gRGF0YU5vZGVUcmVlKGtleSkge1xuICAgICAgICBEYXRhTm9kZUdyb3VwLmNhbGwodGhpcywga2V5KTtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAwO1xuICAgICAgICB0aGlzLmV4cGFuZGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhTm9kZUdyb3VwLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlLnBydW5lID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuLnZhbHVlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY2hpbGQucHJ1bmUoMCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YU5vZGVUcmVlLnByb3RvdHlwZS5idWlsZFZpZXcgPSBmdW5jdGlvbihhZ2dyZWdhdG9yKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGNoaWxkLmJ1aWxkVmlldyhhZ2dyZWdhdG9yKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlLmNvbXB1dGVIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhlaWdodCA9IDA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaGVpZ2h0ID0gaGVpZ2h0ICsgdGhpcy5jaGlsZHJlbltpXS5jb21wdXRlSGVpZ2h0KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaGVpZ2h0O1xuICAgIH07XG5cblxuICAgIHJldHVybiBEYXRhTm9kZVRyZWU7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcInJIMUpQR1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFOb2RlVHJlZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIERhdGFTb3VyY2VTb3J0ZXIgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VTb3J0ZXInKTtcbnZhciBEYXRhTm9kZVRyZWUgPSByZXF1aXJlKCcuL0RhdGFOb2RlVHJlZScpO1xudmFyIERhdGFOb2RlR3JvdXAgPSByZXF1aXJlKCcuL0RhdGFOb2RlR3JvdXAnKTtcbnZhciBEYXRhTm9kZUxlYWYgPSByZXF1aXJlKCcuL0RhdGFOb2RlTGVhZicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBoZWFkZXJpZnkgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgdmFyIHBpZWNlcyA9IHN0cmluZy5yZXBsYWNlKC9bXy1dL2csICcgJykucmVwbGFjZSgvW0EtWl0vZywgJyAkJicpLnNwbGl0KCcgJykubWFwKGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgICAgIHJldHVybiBzLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcy5zbGljZSgxKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwaWVjZXMuam9pbignICcpO1xuICAgIH07XG5cbiAgICAvLz9bdCxjLGIsYV1cbiAgICAvLyB0IGlzIGEgZGF0YVNvdXJjZSxcbiAgICAvLyBhIGlzIGEgZGljaXRpb25hcnkgb2YgYWdncmVnYXRlcywgIGNvbHVtbk5hbWU6ZnVuY3Rpb25cbiAgICAvLyBiIGlzIGEgZGljaXRpb25hcnkgb2YgZ3JvdXBieXMsIGNvbHVtbk5hbWU6c291cmNlQ29sdW1uTmFtZVxuICAgIC8vIGMgaXMgYSBsaXN0IG9mIGNvbnN0cmFpbnRzLFxuXG4gICAgZnVuY3Rpb24gRGF0YVNvdXJjZUFnZ3JlZ2F0b3IoZGF0YVNvdXJjZSkge1xuICAgICAgICB0aGlzLnRyZWUgPSBuZXcgRGF0YU5vZGVUcmVlKCdyb290Jyk7XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IFtdO1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2UgPSBkYXRhU291cmNlO1xuICAgICAgICB0aGlzLmFnZ3JlZ2F0ZXMgPSBbXTtcbiAgICAgICAgdGhpcy5oZWFkZXJzID0gW107XG4gICAgICAgIHRoaXMuZ3JvdXBCeXMgPSBbXTtcbiAgICAgICAgdGhpcy52aWV3ID0gW107XG4gICAgICAgIHRoaXMuc29ydGVySW5zdGFuY2UgPSB7fTtcbiAgICAgICAgdGhpcy5wcmVzb3J0R3JvdXBzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuaXNOdWxsT2JqZWN0ID0gZmFsc2U7XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuYWRkQWdncmVnYXRlID0gZnVuY3Rpb24oY29sdW1uTmFtZSwgZnVuYykge1xuICAgICAgICB0aGlzLmhlYWRlcnMucHVzaChoZWFkZXJpZnkoY29sdW1uTmFtZSkpO1xuICAgICAgICB0aGlzLmFnZ3JlZ2F0ZXMucHVzaChmdW5jKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmFkZEdyb3VwQnkgPSBmdW5jdGlvbihjb2x1bW5JbmRleCkge1xuICAgICAgICB0aGlzLmdyb3VwQnlzLnB1c2goY29sdW1uSW5kZXgpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuaGFzR3JvdXBzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdyb3VwQnlzLmxlbmd0aCA+IDA7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5oYXNBZ2dyZWdhdGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFnZ3JlZ2F0ZXMubGVuZ3RoID4gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYnVpbGRHcm91cFRyZWUoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmNsZWFyR3JvdXBzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZ3JvdXBCeXMubGVuZ3RoID0gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmNsZWFyQWdncmVnYXRpb25zID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYWdncmVnYXRlcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmhlYWRlcnMubGVuZ3RoID0gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmJ1aWxkR3JvdXBUcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjLCByLCBnLCB2YWx1ZSwgY3JlYXRlRnVuYztcbiAgICAgICAgdmFyIGNyZWF0ZUJyYW5jaCA9IGZ1bmN0aW9uKGtleSwgbWFwKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ldyBEYXRhTm9kZUdyb3VwKGtleSk7XG4gICAgICAgICAgICBtYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgY3JlYXRlTGVhZiA9IGZ1bmN0aW9uKGtleSwgbWFwKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ldyBEYXRhTm9kZUxlYWYoa2V5KTtcbiAgICAgICAgICAgIG1hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBncm91cEJ5cyA9IHRoaXMuZ3JvdXBCeXM7XG4gICAgICAgIHZhciBzb3VyY2UgPSB0aGlzLmRhdGFTb3VyY2U7XG4gICAgICAgIHZhciByb3dDb3VudCA9IHNvdXJjZS5nZXRSb3dDb3VudCgpO1xuXG4gICAgICAgIC8vIGxldHMgc29ydCBvdXIgZGF0YSBmaXJzdC4uLi5cbiAgICAgICAgaWYgKHRoaXMucHJlc29ydEdyb3Vwcykge1xuICAgICAgICAgICAgZm9yIChjID0gMDsgYyA8IGdyb3VwQnlzLmxlbmd0aDsgYysrKSB7XG4gICAgICAgICAgICAgICAgZyA9IGdyb3VwQnlzW2dyb3VwQnlzLmxlbmd0aCAtIGMgLSAxXTtcbiAgICAgICAgICAgICAgICBzb3VyY2UgPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihzb3VyY2UpO1xuICAgICAgICAgICAgICAgIHNvdXJjZS5zb3J0T24oZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdHJlZSA9IHRoaXMudHJlZSA9IG5ldyBEYXRhTm9kZVRyZWUoJ3Jvb3QnKTtcbiAgICAgICAgdmFyIHBhdGggPSB0cmVlO1xuICAgICAgICB2YXIgbGVhZkRlcHRoID0gZ3JvdXBCeXMubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yIChyID0gMDsgciA8IHJvd0NvdW50OyByKyspIHtcbiAgICAgICAgICAgIGZvciAoYyA9IDA7IGMgPCBncm91cEJ5cy5sZW5ndGg7IGMrKykge1xuICAgICAgICAgICAgICAgIGcgPSBncm91cEJ5c1tjXTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNvdXJjZS5nZXRWYWx1ZShnLCByKTtcblxuICAgICAgICAgICAgICAgIC8vdGVzdCB0aGF0IEknbSBub3QgYSBsZWFmXG4gICAgICAgICAgICAgICAgY3JlYXRlRnVuYyA9IChjID09PSBsZWFmRGVwdGgpID8gY3JlYXRlTGVhZiA6IGNyZWF0ZUJyYW5jaDtcbiAgICAgICAgICAgICAgICBwYXRoID0gcGF0aC5jaGlsZHJlbi5nZXRJZkFic2VudCh2YWx1ZSwgY3JlYXRlRnVuYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXRoLnJvd0luZGV4ZXMucHVzaChyKTtcbiAgICAgICAgICAgIHBhdGggPSB0cmVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc29ydGVySW5zdGFuY2UgPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihzb3VyY2UpO1xuICAgICAgICB0cmVlLnBydW5lKCk7XG4gICAgICAgIHRoaXMudHJlZS5jb21wdXRlQWdncmVnYXRlcyh0aGlzKTtcbiAgICAgICAgdGhpcy5idWlsZFZpZXcoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmJ1aWxkVmlldyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnZpZXcubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy50cmVlLmNvbXB1dGVIZWlnaHQoKTtcbiAgICAgICAgdGhpcy50cmVlLmJ1aWxkVmlldyh0aGlzKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICByZXR1cm4gdGhpcy52aWV3W3kgLSAxXS5nZXRWYWx1ZSh4KTsgLy9oZWFkZXIgcm93XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFnZ3JlZ2F0ZXMubGVuZ3RoICsgMTsgLy8gMSBpcyBmb3IgdGhlIGhpZXJhcmNoeSBjb2x1bW5cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldFJvd0NvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZpZXcubGVuZ3RoOyAvL2hlYWRlciBjb2x1bW5cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmNsaWNrID0gZnVuY3Rpb24oeSkge1xuICAgICAgICB2YXIgZ3JvdXAgPSB0aGlzLnZpZXdbeV07XG4gICAgICAgIGdyb3VwLnRvZ2dsZUV4cGFuc2lvblN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLmJ1aWxkVmlldygpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuZ2V0SGVhZGVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5oYXNBZ2dyZWdhdGVzKCkpIHtcbiAgICAgICAgICAgIHJldHVybiBbJ1RyZWUnXS5jb25jYXQodGhpcy5oZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWydUcmVlJ10uY29uY2F0KHRoaXMuZGF0YVNvdXJjZS5nZXRIZWFkZXJzKCkpO1xuXG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5zZXRIZWFkZXJzID0gZnVuY3Rpb24oaGVhZGVycykge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc2V0SGVhZGVycyhoZWFkZXJzKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldEZpZWxkcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRIZWFkZXJzKCk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRHcmFuZFRvdGFscyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmlldyA9IHRoaXMudmlld1swXTtcbiAgICAgICAgdmFyIHJvd0NvdW50ID0gdGhpcy5nZXRSb3dDb3VudCgpO1xuICAgICAgICBpZiAoIXZpZXcgfHwgcm93Q291bnQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW3ZpZXcuZGF0YV07XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRSb3cgPSBmdW5jdGlvbih5KSB7XG4gICAgICAgIHZhciByb3dJbmRleGVzID0gdGhpcy52aWV3W3ldLnJvd0luZGV4ZXM7XG4gICAgICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXkocm93SW5kZXhlcy5sZW5ndGgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMuZGF0YVNvdXJjZS5nZXRSb3cocm93SW5kZXhlc1tpXSk7XG4gICAgICAgICAgICByZXN1bHRbaV0gPSBvYmplY3Q7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLnNldERhdGEgPSBmdW5jdGlvbihhcnJheU9mVW5pZm9ybU9iamVjdHMpIHtcbiAgICAgICAgdGhpcy5kYXRhU291cmNlLnNldERhdGEoYXJyYXlPZlVuaWZvcm1PYmplY3RzKTtcbiAgICAgICAgdGhpcy5hcHBseSgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YVNvdXJjZUFnZ3JlZ2F0b3I7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcInJIMUpQR1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFTb3VyY2VBZ2dyZWdhdG9yLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VEZWNvcmF0b3IoZGF0YVNvdXJjZSkge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2UgPSBkYXRhU291cmNlO1xuICAgICAgICB0aGlzLmluZGV4ZXMgPSBbXTtcbiAgICB9XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5pc051bGxPYmplY3QgPSBmYWxzZTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLnRyYW5zcG9zZVkgPSBmdW5jdGlvbih5KSB7XG4gICAgICAgIGlmICh0aGlzLmluZGV4ZXMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbmRleGVzW3ldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB5O1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gdGhpcy5kYXRhU291cmNlLmdldFZhbHVlKHgsIHRoaXMudHJhbnNwb3NlWSh5KSk7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0Um93ID0gZnVuY3Rpb24oeSkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93KHRoaXMudHJhbnNwb3NlWSh5KSk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24oeCwgeSwgdmFsdWUpIHtcblxuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc2V0VmFsdWUoeCwgdGhpcy50cmFuc3Bvc2VZKHkpLCB2YWx1ZSk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmdldENvbHVtbkNvdW50ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVNvdXJjZS5nZXRDb2x1bW5Db3VudCgpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRGaWVsZHMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLmdldEZpZWxkcygpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5zZXRGaWVsZHMgPSBmdW5jdGlvbihmaWVsZHMpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLnNldEZpZWxkcyhmaWVsZHMpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRSb3dDb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5pbmRleGVzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5kZXhlcy5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVNvdXJjZS5nZXRSb3dDb3VudCgpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5zZXRIZWFkZXJzID0gZnVuY3Rpb24oaGVhZGVycykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLnNldEhlYWRlcnMoaGVhZGVycyk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmdldEhlYWRlcnMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLmdldEhlYWRlcnMoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0R3JhbmRUb3RhbHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgLy9ub3RoaW5nIGhlcmVcbiAgICAgICAgcmV0dXJuO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5pbml0aWFsaXplSW5kZXhWZWN0b3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJvd0NvdW50ID0gdGhpcy5kYXRhU291cmNlLmdldFJvd0NvdW50KCk7XG4gICAgICAgIHZhciBpbmRleFZlY3RvciA9IG5ldyBBcnJheShyb3dDb3VudCk7XG4gICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcm93Q291bnQ7IHIrKykge1xuICAgICAgICAgICAgaW5kZXhWZWN0b3Jbcl0gPSByO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IGluZGV4VmVjdG9yO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5zZXREYXRhID0gZnVuY3Rpb24oYXJyYXlPZlVuaWZvcm1PYmplY3RzKSB7XG4gICAgICAgIHRoaXMuZGF0YVNvdXJjZS5zZXREYXRhKGFycmF5T2ZVbmlmb3JtT2JqZWN0cyk7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlRGVjb3JhdG9yO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlRGVjb3JhdG9yLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YVNvdXJjZURlY29yYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZURlY29yYXRvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VGaWx0ZXIoZGF0YVNvdXJjZSkge1xuICAgICAgICBEYXRhU291cmNlRGVjb3JhdG9yLmNhbGwodGhpcywgZGF0YVNvdXJjZSwgZmFsc2UpO1xuICAgICAgICB0aGlzLmZpbHRlcnMgPSBbXTtcbiAgICB9XG5cbiAgICBEYXRhU291cmNlRmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUpO1xuXG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUuYWRkRmlsdGVyID0gZnVuY3Rpb24oY29sdW1uSW5kZXgsIGZpbHRlcikge1xuICAgICAgICBmaWx0ZXIuY29sdW1uSW5kZXggPSBjb2x1bW5JbmRleDtcbiAgICAgICAgdGhpcy5maWx0ZXJzLnB1c2goZmlsdGVyKTtcbiAgICB9O1xuICAgIERhdGFTb3VyY2VGaWx0ZXIucHJvdG90eXBlLnNldEZpbHRlciA9IGZ1bmN0aW9uKGNvbHVtbkluZGV4LCBmaWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyLmNvbHVtbkluZGV4ID0gY29sdW1uSW5kZXg7XG4gICAgICAgIHRoaXMuZmlsdGVycy5wdXNoKGZpbHRlcik7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VGaWx0ZXIucHJvdG90eXBlLmNsZWFyRmlsdGVycyA9IGZ1bmN0aW9uKCkgeyAvKiBmaWx0ZXIgKi9cbiAgICAgICAgdGhpcy5maWx0ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRmlsdGVyLnByb3RvdHlwZS5hcHBseUZpbHRlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuZmlsdGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBpbmRleGVzID0gdGhpcy5pbmRleGVzO1xuICAgICAgICBpbmRleGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIHZhciBjb3VudCA9IHRoaXMuZGF0YVNvdXJjZS5nZXRSb3dDb3VudCgpO1xuICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IGNvdW50OyByKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGx5RmlsdGVyc1RvKHIpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhlcy5wdXNoKHIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VGaWx0ZXIucHJvdG90eXBlLmFwcGx5RmlsdGVyc1RvID0gZnVuY3Rpb24ocikge1xuICAgICAgICB2YXIgZmlsdGVycyA9IHRoaXMuZmlsdGVycztcbiAgICAgICAgdmFyIGlzRmlsdGVyZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBmID0gMDsgZiA8IGZpbHRlcnMubGVuZ3RoOyBmKyspIHtcbiAgICAgICAgICAgIHZhciBmaWx0ZXIgPSBmaWx0ZXJzW2ZdO1xuICAgICAgICAgICAgdmFyIHJvd09iamVjdCA9IHRoaXMuZGF0YVNvdXJjZS5nZXRSb3cocik7XG4gICAgICAgICAgICBpc0ZpbHRlcmVkID0gaXNGaWx0ZXJlZCAmJiBmaWx0ZXIodGhpcy5kYXRhU291cmNlLmdldFZhbHVlKGZpbHRlci5jb2x1bW5JbmRleCwgciksIHJvd09iamVjdCwgcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlzRmlsdGVyZWQ7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlRmlsdGVyO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlRmlsdGVyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YVNvdXJjZURlY29yYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZURlY29yYXRvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VHbG9iYWxGaWx0ZXIoZGF0YVNvdXJjZSkge1xuICAgICAgICBEYXRhU291cmNlRGVjb3JhdG9yLmNhbGwodGhpcywgZGF0YVNvdXJjZSwgZmFsc2UpO1xuICAgICAgICB0aGlzLmZpbHRlciA9IG51bGw7XG4gICAgfVxuXG4gICAgRGF0YVNvdXJjZUdsb2JhbEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlKTtcblxuICAgIERhdGFTb3VyY2VHbG9iYWxGaWx0ZXIucHJvdG90eXBlLnNldEZpbHRlciA9IGZ1bmN0aW9uKGZpbHRlcikge1xuICAgICAgICB0aGlzLmZpbHRlciA9IGZpbHRlcjtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUdsb2JhbEZpbHRlci5wcm90b3R5cGUuY2xlYXJGaWx0ZXJzID0gZnVuY3Rpb24oKSB7IC8qIGZpbHRlciAqL1xuICAgICAgICB0aGlzLmZpbHRlciA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyLnByb3RvdHlwZS5hcHBseUZpbHRlcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlcikge1xuICAgICAgICAgICAgdGhpcy5pbmRleGVzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgICAgIGluZGV4ZXMubGVuZ3RoID0gMDtcbiAgICAgICAgdmFyIGNvdW50ID0gdGhpcy5kYXRhU291cmNlLmdldFJvd0NvdW50KCk7XG4gICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgY291bnQ7IHIrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbHlGaWx0ZXJUbyhyKSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMucHVzaChyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyLnByb3RvdHlwZS5hcHBseUZpbHRlclRvID0gZnVuY3Rpb24ocikge1xuICAgICAgICB2YXIgaXNGaWx0ZXJlZCA9IGZhbHNlO1xuICAgICAgICB2YXIgZmlsdGVyID0gdGhpcy5maWx0ZXI7XG4gICAgICAgIHZhciBjb2xDb3VudCA9IHRoaXMuZ2V0Q29sdW1uQ291bnQoKTtcbiAgICAgICAgdmFyIHJvd09iamVjdCA9IHRoaXMuZGF0YVNvdXJjZS5nZXRSb3cocik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29sQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgaXNGaWx0ZXJlZCA9IGlzRmlsdGVyZWQgfHwgZmlsdGVyKHRoaXMuZGF0YVNvdXJjZS5nZXRWYWx1ZShpLCByKSwgcm93T2JqZWN0LCByKTtcbiAgICAgICAgICAgIGlmIChpc0ZpbHRlcmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YVNvdXJjZUdsb2JhbEZpbHRlcjtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwickgxSlBHXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YVNvdXJjZUdsb2JhbEZpbHRlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi9VdGlscy5qcycpO1xudmFyIERhdGFTb3VyY2VEZWNvcmF0b3IgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VEZWNvcmF0b3InKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlU29ydGVyKGRhdGFTb3VyY2UpIHtcbiAgICAgICAgRGF0YVNvdXJjZURlY29yYXRvci5jYWxsKHRoaXMsIGRhdGFTb3VyY2UpO1xuICAgICAgICB0aGlzLmRlc2NlbmRpbmdTb3J0ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgRGF0YVNvdXJjZVNvcnRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlKTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXIucHJvdG90eXBlLnNvcnRPbiA9IGZ1bmN0aW9uKGNvbHVtbkluZGV4LCBzb3J0VHlwZSkge1xuICAgICAgICBpZiAoc29ydFR5cGUgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUluZGV4VmVjdG9yKCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgVXRpbHMuc3RhYmxlU29ydCh0aGlzLmluZGV4ZXMsIGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5kYXRhU291cmNlLmdldFZhbHVlKGNvbHVtbkluZGV4LCBpbmRleCk7XG4gICAgICAgIH0sIHNvcnRUeXBlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFTb3VyY2VTb3J0ZXI7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcInJIMUpQR1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFTb3VyY2VTb3J0ZXIuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBEYXRhU291cmNlRGVjb3JhdG9yID0gcmVxdWlyZSgnLi9EYXRhU291cmNlRGVjb3JhdG9yJyk7XG52YXIgRGF0YVNvdXJjZVNvcnRlciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZVNvcnRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUoZGF0YVNvdXJjZSkge1xuICAgICAgICBEYXRhU291cmNlRGVjb3JhdG9yLmNhbGwodGhpcywgZGF0YVNvdXJjZSk7XG4gICAgICAgIHRoaXMuc29ydHMgPSBbXTtcbiAgICAgICAgdGhpcy5sYXN0ID0gdGhpcy5kYXRhU291cmNlO1xuICAgIH1cblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLnByb3RvdHlwZS5zb3J0T24gPSBmdW5jdGlvbihjb2x1bW5JbmRleCwgc29ydFR5cGUpIHtcbiAgICAgICAgdGhpcy5zb3J0cy5wdXNoKFtjb2x1bW5JbmRleCwgc29ydFR5cGVdKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZS5wcm90b3R5cGUuYXBwbHlTb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ydHMgPSB0aGlzLnNvcnRzO1xuICAgICAgICB2YXIgZWFjaCA9IHRoaXMuZGF0YVNvdXJjZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHNvcnQgPSBzb3J0c1tpXTtcbiAgICAgICAgICAgIGVhY2ggPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihlYWNoKTtcbiAgICAgICAgICAgIGVhY2guc29ydE9uKHNvcnRbMF0sIHNvcnRbMV0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubGFzdCA9IGVhY2g7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlLmNsZWFyU29ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3J0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmxhc3QgPSB0aGlzLmRhdGFTb3VyY2U7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXN0LmdldFZhbHVlKHgsIHkpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMubGFzdC5zZXRWYWx1ZSh4LCB5LCB2YWx1ZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBoZWFkZXJpZnkgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgdmFyIHBpZWNlcyA9IHN0cmluZy5yZXBsYWNlKC9bXy1dL2csICcgJykucmVwbGFjZSgvW0EtWl0vZywgJyAkJicpLnNwbGl0KCcgJykubWFwKGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgICAgIHJldHVybiBzLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcy5zbGljZSgxKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBwaWVjZXMuam9pbignICcpO1xuICAgIH07XG5cbiAgICB2YXIgY29tcHV0ZUZpZWxkTmFtZXMgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgICAgaWYgKCFvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZmllbGRzID0gW10uY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iamVjdCkuZmlsdGVyKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlLnN1YnN0cigwLCAyKSAhPT0gJ19fJztcbiAgICAgICAgfSkpO1xuICAgICAgICByZXR1cm4gZmllbGRzO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBKU0RhdGFTb3VyY2UoZGF0YSwgZmllbGRzKSB7XG4gICAgICAgIHRoaXMuZmllbGRzID0gZmllbGRzIHx8IGNvbXB1dGVGaWVsZE5hbWVzKGRhdGFbMF0pO1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB9XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLmlzTnVsbE9iamVjdCA9IGZhbHNlO1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgICAgaWYgKHggPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4geTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmRhdGFbeV1bdGhpcy5maWVsZHNbeF1dO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Um93ID0gZnVuY3Rpb24oeSkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFbeV07XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuc2V0VmFsdWUgPSBmdW5jdGlvbih4LCB5LCB2YWx1ZSkge1xuXG4gICAgICAgIHRoaXMuZGF0YVt5XVt0aGlzLmZpZWxkc1t4XV0gPSB2YWx1ZTtcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmdldEhlYWRlcnMoKS5sZW5ndGg7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRGaWVsZHMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5maWVsZHM7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0SGVhZGVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIXRoaXMuaGVhZGVycyB8fCB0aGlzLmhlYWRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWRlcnMgPSB0aGlzLmdldERlZmF1bHRIZWFkZXJzKCkubWFwKGZ1bmN0aW9uKGVhY2gpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyaWZ5KGVhY2gpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaGVhZGVycztcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXREZWZhdWx0SGVhZGVycyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmdldEZpZWxkcygpO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLnNldEZpZWxkcyA9IGZ1bmN0aW9uKGZpZWxkcykge1xuXG4gICAgICAgIHRoaXMuZmllbGRzID0gZmllbGRzO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLnNldEhlYWRlcnMgPSBmdW5jdGlvbihoZWFkZXJzKSB7XG5cbiAgICAgICAgdGhpcy5oZWFkZXJzID0gaGVhZGVycztcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRHcmFuZFRvdGFscyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAvL25vdGhpbmcgaGVyZVxuICAgICAgICByZXR1cm47XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuc2V0RGF0YSA9IGZ1bmN0aW9uKGFycmF5T2ZVbmlmb3JtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmRhdGEgPSBhcnJheU9mVW5pZm9ybU9iamVjdHM7XG4gICAgfTtcblxuICAgIHJldHVybiBKU0RhdGFTb3VyY2U7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcInJIMUpQR1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0pTRGF0YVNvdXJjZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgb2lkUHJlZml4ID0gJy5+LiMlXyc7IC8vdGhpcyBzaG91bGQgYmUgc29tZXRoaW5nIHdlIG5ldmVyIHdpbGwgc2VlIGF0IHRoZSBiZWdpbmluZyBvZiBhIHN0cmluZ1xuICAgIHZhciBjb3VudGVyID0gMDtcblxuICAgIHZhciBoYXNoID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHZhciB0eXBlT2YgPSB0eXBlb2Yga2V5O1xuICAgICAgICBzd2l0Y2ggKHR5cGVPZikge1xuICAgICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gb2lkUHJlZml4ICsgdHlwZU9mICsgJ18nICsga2V5O1xuICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gb2lkUHJlZml4ICsgdHlwZU9mICsgJ18nICsga2V5O1xuICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9pZFByZWZpeCArIHR5cGVPZiArICdfJyArIGtleTtcbiAgICAgICAgICAgIGNhc2UgJ3N5bWJvbCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9pZFByZWZpeCArIHR5cGVPZiArICdfJyArIGtleTtcbiAgICAgICAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9pZFByZWZpeCArICd1bmRlZmluZWQnO1xuICAgICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgICAgICAvKmVzbGludC1kaXNhYmxlICovXG4gICAgICAgICAgICAgICAgaWYgKGtleS5fX19maW5oYXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXkuX19fZmluaGFzaDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAga2V5Ll9fX2Zpbmhhc2ggPSBvaWRQcmVmaXggKyBjb3VudGVyKys7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleS5fX19maW5oYXNoO1xuICAgICAgICAgICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgICAgICAgICAgIGlmIChrZXkuX19fZmluaGFzaCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ga2V5Ll9fX2Zpbmhhc2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGtleS5fX19maW5oYXNoID0gb2lkUHJlZml4ICsgY291bnRlcisrO1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXkuX19fZmluaGFzaDsgLyplc2xpbnQtZW5hYmxlICovXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0LmlzIHBvbHlmaWxsLCBjb3VydGVzeSBvZiBAV2ViUmVmbGVjdGlvblxuICAgIHZhciBpcyA9IE9iamVjdC5pcyB8fFxuICAgICAgICBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYSA9PT0gYiA/IGEgIT09IDAgfHwgMSAvIGEgPT0gMSAvIGIgOiBhICE9IGEgJiYgYiAhPSBiOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIH07XG5cbiAgICAvLyBNb3JlIHJlbGlhYmxlIGluZGV4T2YsIGNvdXJ0ZXN5IG9mIEBXZWJSZWZsZWN0aW9uXG4gICAgdmFyIGJldHRlckluZGV4T2YgPSBmdW5jdGlvbihhcnIsIHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPSB2YWx1ZSB8fCB2YWx1ZSA9PT0gMCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gYXJyLmxlbmd0aDsgaS0tICYmICFpcyhhcnJbaV0sIHZhbHVlKTspIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaSA9IFtdLmluZGV4T2YuY2FsbChhcnIsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gTWFwcHkoKSB7XG4gICAgICAgIHRoaXMua2V5cyA9IFtdO1xuICAgICAgICB0aGlzLmRhdGEgPSB7fTtcbiAgICAgICAgdGhpcy52YWx1ZXMgPSBbXTtcbiAgICB9XG5cbiAgICBNYXBweS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaGFzaENvZGUgPSBoYXNoKGtleSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFbaGFzaENvZGVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5cy5wdXNoKGtleSk7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRhdGFbaGFzaENvZGVdID0gdmFsdWU7XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgdmFyIGhhc2hDb2RlID0gaGFzaChrZXkpO1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhW2hhc2hDb2RlXTtcbiAgICB9O1xuXG4gICAgTWFwcHkucHJvdG90eXBlLmdldElmQWJzZW50ID0gZnVuY3Rpb24oa2V5LCBpZkFic2VudEZ1bmMpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHZhbHVlID0gaWZBYnNlbnRGdW5jKGtleSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5rZXlzLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgTWFwcHkucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMua2V5cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmRhdGEgPSB7fTtcbiAgICB9O1xuXG4gICAgTWFwcHkucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICB2YXIgaGFzaENvZGUgPSBoYXNoKGtleSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFbaGFzaENvZGVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgaW5kZXggPSBiZXR0ZXJJbmRleE9mKHRoaXMua2V5cywga2V5KTtcbiAgICAgICAgdGhpcy5rZXlzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIHRoaXMudmFsdWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmRhdGFbaGFzaENvZGVdO1xuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAgICAgdmFyIGtleXMgPSB0aGlzLmtleXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgZnVuYyh2YWx1ZSwga2V5LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24oZnVuYykge1xuICAgICAgICB2YXIga2V5cyA9IHRoaXMua2V5cztcbiAgICAgICAgdmFyIG5ld01hcCA9IG5ldyBNYXBweSgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgICAgIHZhciB0cmFuc2Zvcm1lZCA9IGZ1bmModmFsdWUsIGtleSwgdGhpcyk7XG4gICAgICAgICAgICBuZXdNYXAuc2V0KGtleSwgdHJhbnNmb3JtZWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdNYXA7XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBrZXlzID0gdGhpcy5rZXlzO1xuICAgICAgICB2YXIgbmV3TWFwID0gbmV3IE1hcHB5KCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgbmV3TWFwLnNldChrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3TWFwO1xuICAgIH07XG5cbiAgICByZXR1cm4gTWFwcHk7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcInJIMUpQR1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL01hcC5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHN0YWJsZVNvcnQgPSByZXF1aXJlKCcuL3N0YWJsZVNvcnQuanMnKTtcbnZhciBNYXAgPSByZXF1aXJlKCcuL01hcC5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHN0YWJsZVNvcnQ6IHN0YWJsZVNvcnQsXG4gICAgICAgIE1hcDogTWFwXG4gICAgfTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwickgxSlBHXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvVXRpbHMuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgcmV0dXJuIHtcblxuICAgICAgICBjb3VudDogZnVuY3Rpb24oKSB7IC8qIGNvbHVtSW5kZXggKi9cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcm93cztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgc3VtOiBmdW5jdGlvbihjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICAgICAgICAgICAgICB2YXIgc3VtID0gMDtcbiAgICAgICAgICAgICAgICB2YXIgcm93cyA9IGdyb3VwLmdldFJvd0NvdW50KCk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc3VtID0gc3VtICsgZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzdW07XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG4gICAgICAgIG1pbjogZnVuY3Rpb24oY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1pbiA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IE1hdGgubWluKG1pbiwgZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWluO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuXG4gICAgICAgIG1heDogZnVuY3Rpb24oY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1heCA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1heCA9IE1hdGgubWF4KG1heCwgZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWF4O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBhdmc6IGZ1bmN0aW9uKGNvbHVtSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciBzdW0gPSAwO1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHJvd3M7IHIrKykge1xuICAgICAgICAgICAgICAgICAgICBzdW0gPSBzdW0gKyBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bSAvIHJvd3M7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG4gICAgICAgIGZpcnN0OiBmdW5jdGlvbihjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG4gICAgICAgIGxhc3Q6IGZ1bmN0aW9uKGNvbHVtSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcm93cyAtIDEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBzdGRkZXY6IGZ1bmN0aW9uKGNvbHVtSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciByO1xuICAgICAgICAgICAgICAgIHZhciBzdW0gPSAwO1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1bSA9IHN1bSArIGdyb3VwLmdldFZhbHVlKGNvbHVtSW5kZXgsIHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgbWVhbiA9IHN1bSAvIHJvd3M7XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhbmNlID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkZXYgPSAoZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcikgLSBtZWFuKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2UgPSB2YXJpYW5jZSArIChkZXYgKiBkZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgc3RkZGV2ID0gTWF0aC5zcXJ0KHZhcmlhbmNlIC8gcm93cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0ZGRldjtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9O1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9hZ2dyZWdhdGlvbnMuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBKU0RhdGFTb3VyY2UgPSByZXF1aXJlKCcuL0pTRGF0YVNvdXJjZScpO1xudmFyIERhdGFTb3VyY2VTb3J0ZXIgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VTb3J0ZXInKTtcbnZhciBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlID0gcmVxdWlyZSgnLi9EYXRhU291cmNlU29ydGVyQ29tcG9zaXRlJyk7XG52YXIgRGF0YVNvdXJjZUZpbHRlciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZUZpbHRlcicpO1xudmFyIERhdGFTb3VyY2VHbG9iYWxGaWx0ZXIgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VHbG9iYWxGaWx0ZXInKTtcbnZhciBEYXRhU291cmNlQWdncmVnYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZUFnZ3JlZ2F0b3InKTtcbnZhciBhZ2dyZWdhdGlvbnMgPSByZXF1aXJlKCcuL2FnZ3JlZ2F0aW9ucycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIEpTRGF0YVNvdXJjZTogSlNEYXRhU291cmNlLFxuICAgICAgICBEYXRhU291cmNlU29ydGVyOiBEYXRhU291cmNlU29ydGVyLFxuICAgICAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlOiBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLFxuICAgICAgICBEYXRhU291cmNlRmlsdGVyOiBEYXRhU291cmNlRmlsdGVyLFxuICAgICAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyOiBEYXRhU291cmNlR2xvYmFsRmlsdGVyLFxuICAgICAgICBEYXRhU291cmNlQWdncmVnYXRvcjogRGF0YVNvdXJjZUFnZ3JlZ2F0b3IsXG4gICAgICAgIGFnZ3JlZ2F0aW9uczogYWdncmVnYXRpb25zXG4gICAgfTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwickgxSlBHXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvYW5hbHl0aWNzLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyogZXNsaW50LWVudiBub2RlLCBicm93c2VyICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcblxudmFyIG9vID0gcmVxdWlyZSgnb2JqZWN0Lm9ic2VydmUnKTtcbnZhciBhbmFseXRpY3MgPSByZXF1aXJlKCcuL2FuYWx5dGljcy5qcycpO1xuXG5ub29wKG9vKTtcblxuaWYgKCF3aW5kb3cuZmluKSB7XG4gICAgd2luZG93LmZpbiA9IHt9O1xufVxuaWYgKCF3aW5kb3cuZmluLmFuYWx5dGljcykge1xuICAgIHdpbmRvdy5maW4uYW5hbHl0aWNzID0gYW5hbHl0aWNzO1xufVxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9mYWtlXzE1OWMwNjljLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RhYmlsaXplID0gZnVuY3Rpb24oY29tcGFyYXRvciwgZGVzY2VuZGluZykge1xuICAgIHJldHVybiBmdW5jdGlvbihhcnIxLCBhcnIyKSB7XG4gICAgICAgIHZhciB4ID0gYXJyMVswXTtcbiAgICAgICAgdmFyIHkgPSBhcnIyWzBdO1xuICAgICAgICBpZiAoeCA9PT0geSkge1xuICAgICAgICAgICAgeCA9IGRlc2NlbmRpbmcgPyBhcnIyWzFdIDogYXJyMVsxXTtcbiAgICAgICAgICAgIHkgPSBkZXNjZW5kaW5nID8gYXJyMVsxXSA6IGFycjJbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoeSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh4ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3IoeCwgeSk7XG4gICAgfTtcbn07XG5cblxudmFyIGFzY2VuZGluZ051bWJlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHggLSB5O1xufTtcblxudmFyIGRlc2NlbmRpbmdOdW1iZXJzID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIHJldHVybiB5IC0geDtcbn07XG5cbnZhciBhc2NlbmRpbmdBbGxPdGhlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHggPCB5ID8gLTEgOiAxO1xufTtcblxudmFyIGRlc2NlbmRpbmdBbGxPdGhlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHkgPCB4ID8gLTEgOiAxO1xufTtcblxudmFyIGFzY2VuZGluZyA9IGZ1bmN0aW9uKHR5cGVPZkRhdGEpIHtcbiAgICBpZiAodHlwZU9mRGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHN0YWJpbGl6ZShhc2NlbmRpbmdOdW1iZXJzLCBmYWxzZSk7XG4gICAgfVxuICAgIHJldHVybiBzdGFiaWxpemUoYXNjZW5kaW5nQWxsT3RoZXJzLCBmYWxzZSk7XG59O1xuXG52YXIgZGVzY2VuZGluZyA9IGZ1bmN0aW9uKHR5cGVPZkRhdGEpIHtcbiAgICBpZiAodHlwZU9mRGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHN0YWJpbGl6ZShkZXNjZW5kaW5nTnVtYmVycywgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBzdGFiaWxpemUoZGVzY2VuZGluZ0FsbE90aGVycywgdHJ1ZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIHNvcnQoaW5kZXhWZWN0b3IsIGRhdGFTb3VyY2UsIHNvcnRUeXBlKSB7XG5cbiAgICAgICAgdmFyIGNvbXBhcmUsIGk7XG5cbiAgICAgICAgaWYgKGluZGV4VmVjdG9yLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuOyAvL25vdGhpbmcgdG8gZG87XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydFR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc29ydFR5cGUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNvcnRUeXBlID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIG5vdGhpbmcgdG8gc29ydCBoZXJlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHR5cGVPZkRhdGEgPSB0eXBlb2YgZGF0YVNvdXJjZSgwKTtcblxuICAgICAgICBjb21wYXJlID0gKHNvcnRUeXBlID09PSAxKSA/IGFzY2VuZGluZyh0eXBlT2ZEYXRhKSA6IGRlc2NlbmRpbmcodHlwZU9mRGF0YSk7XG5cbiAgICAgICAgLy9zdGFydCB0aGUgYWN0dWFsbHkgc29ydGluZy4uLi4uXG4gICAgICAgIHZhciB0bXAgPSBuZXcgQXJyYXkoaW5kZXhWZWN0b3IubGVuZ3RoKTtcblxuICAgICAgICAvL2xldHMgYWRkIHRoZSBpbmRleCBmb3Igc3RhYmlsaXR5XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbmRleFZlY3Rvci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdG1wW2ldID0gW2RhdGFTb3VyY2UoaSksIGldO1xuICAgICAgICB9XG5cbiAgICAgICAgdG1wLnNvcnQoY29tcGFyZSk7XG5cbiAgICAgICAgLy9jb3B5IHRoZSBzb3J0ZWQgdmFsdWVzIGludG8gb3VyIGluZGV4IHZlY3RvclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaW5kZXhWZWN0b3IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGluZGV4VmVjdG9yW2ldID0gdG1wW2ldWzFdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNvcnQ7XG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJySDFKUEdcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zdGFibGVTb3J0LmpzXCIsXCIvXCIpIl19
