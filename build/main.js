(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/index.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer")
},{"base64-js":2,"buffer":1,"ieee754":3,"oMfpAn":4}],2:[function(require,module,exports){
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

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib")
},{"buffer":1,"oMfpAn":4}],3:[function(require,module,exports){
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

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/buffer/node_modules/ieee754")
},{"buffer":1,"oMfpAn":4}],4:[function(require,module,exports){
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

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/process/browser.js","/../../node_modules/gulp-browserify/node_modules/browserify/node_modules/process")
},{"buffer":1,"oMfpAn":4}],5:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../../node_modules/object.observe/dist/object-observe.js","/../../node_modules/object.observe/dist")
},{"buffer":1,"oMfpAn":4}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function () {

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

    DataNodeBase.prototype.getValue = function (x) {
        return this.data[x];
    };

    DataNodeBase.prototype.prune = function (depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    };

    DataNodeBase.prototype.computeDepthString = function () {
        var string = depthString.substring(0, 2 + (this.depth * 3)) + this.label;
        return string;
    };

    DataNodeBase.prototype.computeHeight = function () {
        return 1;
    };

    DataNodeBase.prototype.getAllRowIndexes = function () {
        return this.rowIndexes;
    };

    DataNodeBase.prototype.computeAggregates = function (aggregator) {
        this.applyAggregates(aggregator);
    };

    DataNodeBase.prototype.applyAggregates = function (aggregator) {
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

    DataNodeBase.prototype.buildView = function (aggregator) {
        aggregator.view.push(this);
    };

    DataNodeBase.prototype.toggleExpansionState = function () { /* aggregator */
        //do nothing by default
    };

    return DataNodeBase;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeBase.js","/")
},{"buffer":1,"oMfpAn":4}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Map = require('./Map');
var DataNodeBase = require('./DataNodeBase');

module.exports = (function () {

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

    DataNodeGroup.prototype.prune = function (depth) {
        this.depth = depth;
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.prune(this.depth + 1);
        }
        this.data[0] = this.computeDepthString();
    };

    DataNodeGroup.prototype.computeDepthString = function () {
        var icon = ExpandedMap[this.expanded + ''];
        var string = depthString.substring(0, this.depth * 3) + icon + ' ' + this.label;
        return string;
    };

    DataNodeGroup.prototype.getAllRowIndexes = function () {
        if (this.rowIndexes.length === 0) {
            this.rowIndexes = this.computeAllRowIndexes();
        }
        return this.rowIndexes;
    };

    DataNodeGroup.prototype.computeAllRowIndexes = function () {
        var result = [];
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            var childIndexes = child.getAllRowIndexes();
            Array.prototype.splice.apply(result, [result.length, 0].concat(childIndexes));
        }
        return result;
    };

    DataNodeGroup.prototype.toggleExpansionState = function (aggregator) { /* aggregator */
        this.expanded = !this.expanded;
        this.data[0] = this.computeDepthString();
        if (this.expanded) {
            this.computeAggregates(aggregator);
        }
    };

    DataNodeGroup.prototype.computeAggregates = function (aggregator) {
        this.applyAggregates(aggregator);
        if (!this.expanded) {
            return; // were not being viewed, don't have child nodes do computation;
        }
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].computeAggregates(aggregator);
        }
    };

    DataNodeGroup.prototype.buildView = function (aggregator) {
        aggregator.view.push(this);
        if (this.expanded) {
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                child.buildView(aggregator);
            }
        }
    };

    DataNodeGroup.prototype.computeHeight = function () {
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeGroup.js","/")
},{"./DataNodeBase":6,"./Map":17,"buffer":1,"oMfpAn":4}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataNodeBase = require('./DataNodeBase');

module.exports = (function () {

    function DataNodeLeaf(key) {
        DataNodeBase.call(this, key);
    }

    DataNodeLeaf.prototype = Object.create(DataNodeBase.prototype);

    DataNodeLeaf.prototype.prune = function (depth) {
        this.depth = depth;
        this.data[0] = this.computeDepthString();
    };

    DataNodeLeaf.prototype.computeHeight = function () {
        return 1;
    };

    DataNodeLeaf.prototype.getAllRowIndexes = function () {
        return this.rowIndexes;
    };

    DataNodeLeaf.prototype.computeAggregates = function (aggregator) {
        this.applyAggregates(aggregator);
    };

    DataNodeLeaf.prototype.buildView = function (aggregator) {
        aggregator.view.push(this);
    };

    return DataNodeLeaf;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeLeaf.js","/")
},{"./DataNodeBase":6,"buffer":1,"oMfpAn":4}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataNodeGroup = require('./DataNodeGroup');

module.exports = (function () {

    function DataNodeTree(key) {
        DataNodeGroup.call(this, key);
        this.height = 0;
        this.expanded = true;
    }

    DataNodeTree.prototype = Object.create(DataNodeGroup.prototype);

    DataNodeTree.prototype.prune = function () {
        this.children = this.children.values;
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.prune(0);
        }
    };

    DataNodeTree.prototype.buildView = function (aggregator) {
        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.buildView(aggregator);
        }
    };

    DataNodeTree.prototype.computeHeight = function () {
        var height = 0;
        for (var i = 0; i < this.children.length; i++) {
            height = height + this.children[i].computeHeight();
        }
        this.height = height;

        return this.height;
    };


    return DataNodeTree;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeTree.js","/")
},{"./DataNodeGroup":7,"buffer":1,"oMfpAn":4}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./DataNodeTree');
var DataNodeGroup = require('./DataNodeGroup');
var DataNodeLeaf = require('./DataNodeLeaf');
var DataNodeLeaf = require('./DataNodeLeaf');
var Aggregations = require('./aggregations');

module.exports = (function () {

    var headerify = function (string) {
        var pieces = string.replace(/[_-]/g, ' ').replace(/[A-Z]/g, ' $&').split(' ').map(function (s) {
            return (s.charAt(0).toUpperCase() + s.slice(1)).trim();
        });
        pieces = pieces.filter(function (e) {
            return e.length !== 0;
        });
        return pieces.join(' ').trim();
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
        this.lastAggregate = {};
        this.setAggregates({});
    }

    DataSourceAggregator.prototype.isNullObject = false;

    DataSourceAggregator.prototype.setAggregates = function(aggregations) {
        this.lastAggregate = aggregations;
        var props = [];
        var i;
        this.clearAggregations();
        this.headers.length = 0;

        for (var key in aggregations) {
            props.push([key, aggregations[key]]);
        }

        if (props.length === 0) {
            var fields = [].concat(this.dataSource.getFields());
            fields.shift();
            for (i = 0; i < fields.length; i++) {
                props.push([fields[i], Aggregations.first(i)]); /* jshint ignore:line */
            }
        }

        if(this.hasGroups()) {
            this.headers.push('Tree');
        }

        for (i = 0; i < props.length; i++) {
            var agg = props[i];
            this.headers.push(headerify(agg[0]));
            this.aggregates.push(agg[1]);
        }
    };

    DataSourceAggregator.prototype.setGroupBys = function (columnIndexArray) {
        this.groupBys.length = 0;
        for (var i = 0; i < columnIndexArray.length; i++) {
            this.groupBys.push(columnIndexArray[i]);
        }
        this.setAggregates(this.lastAggregate);
    };

    DataSourceAggregator.prototype.hasGroups = function () {
        return this.groupBys.length > 0;
    };

    DataSourceAggregator.prototype.hasAggregates = function () {
        return this.aggregates.length > 0;
    };

    DataSourceAggregator.prototype.apply = function () {
        this.buildGroupTree();
    };

    DataSourceAggregator.prototype.clearGroups = function () {
        this.groupBys.length = 0;
    };

    DataSourceAggregator.prototype.clearAggregations = function () {
        this.aggregates.length = 0;
        this.headers.length = 0;
    };

    DataSourceAggregator.prototype.buildGroupTree = function () {
        var c, r, g, value, createFunc;
        var createBranch = function (key, map) {
            value = new DataNodeGroup(key);
            map.set(key, value);
            return value;
        };
        var createLeaf = function (key, map) {
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

    DataSourceAggregator.prototype.buildView = function () {
        this.view.length = 0;
        this.tree.computeHeight();
        this.tree.buildView(this);
    };

    DataSourceAggregator.prototype.getValue = function (x, y) {
        var row = this.view[y];
        if (!row) {
            return null;
        }
        return row.getValue(x);
    };

    DataSourceAggregator.prototype.getColumnCount = function () {
        var colCount = this.getHeaders().length; // 1 is for the hierarchy column
        return colCount;
    };

    DataSourceAggregator.prototype.getRowCount = function () {
        return this.view.length; //header column
    };

    DataSourceAggregator.prototype.click = function (y) {
        var group = this.view[y];
        group.toggleExpansionState(this);
        this.buildView();
    };

    DataSourceAggregator.prototype.getHeaders = function () {
        return this.headers;
    };

    DataSourceAggregator.prototype.setHeaders = function (headers) {
        this.dataSource.setHeaders(headers);
    };

    DataSourceAggregator.prototype.getFields = function () {
        return this.getHeaders();
    };

    DataSourceAggregator.prototype.getGrandTotals = function () {
        var view = this.view[0];
        var rowCount = this.getRowCount();
        if (!view || rowCount === 0) {
            return [];
        }
        return [view.data];
    };

    DataSourceAggregator.prototype.getRow = function (y) {
        var rowIndexes = this.view[y].rowIndexes;
        var result = new Array(rowIndexes.length);
        for (var i = 0; i < result.length; i++) {
            var object = this.dataSource.getRow(rowIndexes[i]);
            result[i] = object;
        }
        return result;
    };

    DataSourceAggregator.prototype.setData = function (arrayOfUniformObjects) {
        this.dataSource.setData(arrayOfUniformObjects);
        this.apply();
    };

    return DataSourceAggregator;

})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceAggregator.js","/")
},{"./DataNodeGroup":7,"./DataNodeLeaf":8,"./DataNodeTree":9,"./DataSourceSorter":14,"./aggregations":19,"buffer":1,"oMfpAn":4}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function () {

    function DataSourceDecorator(dataSource) {
        this.dataSource = dataSource;
        this.indexes = [];
    }

    DataSourceDecorator.prototype.isNullObject = false;

    DataSourceDecorator.prototype.transposeY = function (y) {
        if (this.indexes.length !== 0) {
            return this.indexes[y];
        }
        return y;
    };

    DataSourceDecorator.prototype.getValue = function (x, y) {
        var value = this.dataSource.getValue(x, this.transposeY(y));
        return value;
    };

    DataSourceDecorator.prototype.getRow = function (y) {

        return this.dataSource.getRow(this.transposeY(y));
    };

    DataSourceDecorator.prototype.setValue = function (x, y, value) {

        this.dataSource.setValue(x, this.transposeY(y), value);
    };

    DataSourceDecorator.prototype.getColumnCount = function () {

        return this.dataSource.getColumnCount();
    };

    DataSourceDecorator.prototype.getFields = function () {

        return this.dataSource.getFields();
    };

    DataSourceDecorator.prototype.setFields = function (fields) {

        return this.dataSource.setFields(fields);
    };

    DataSourceDecorator.prototype.getRowCount = function () {
        if (this.indexes.length !== 0) {
            return this.indexes.length;
        }
        return this.dataSource.getRowCount();
    };

    DataSourceDecorator.prototype.setHeaders = function (headers) {
        return this.dataSource.setHeaders(headers);
    };

    DataSourceDecorator.prototype.getHeaders = function () {

        return this.dataSource.getHeaders();
    };

    DataSourceDecorator.prototype.getGrandTotals = function () {
        //nothing here
        return;
    };

    DataSourceDecorator.prototype.initializeIndexVector = function () {
        var rowCount = this.dataSource.getRowCount();
        var indexVector = new Array(rowCount);
        for (var r = 0; r < rowCount; r++) {
            indexVector[r] = r;
        }
        this.indexes = indexVector;
    };

    DataSourceDecorator.prototype.setData = function (arrayOfUniformObjects) {
        this.dataSource.setData(arrayOfUniformObjects);
    };

    return DataSourceDecorator;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceDecorator.js","/")
},{"buffer":1,"oMfpAn":4}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceDecorator = require('./DataSourceDecorator');

module.exports = (function () {

    function DataSourceFilter(dataSource) {
        DataSourceDecorator.call(this, dataSource, false);
        this.filters = [];
    }

    DataSourceFilter.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceFilter.prototype.addFilter = function (columnIndex, filter) {
        filter.columnIndex = columnIndex;
        this.filters.push(filter);
    };
    DataSourceFilter.prototype.setFilter = function (columnIndex, filter) {
        filter.columnIndex = columnIndex;
        this.filters.push(filter);
    };

    DataSourceFilter.prototype.clearFilters = function () { /* filter */
        this.filters.length = 0;
        this.indexes.length = 0;
    };

    DataSourceFilter.prototype.applyFilters = function () {
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

    DataSourceFilter.prototype.applyFiltersTo = function (r) {
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceFilter.js","/")
},{"./DataSourceDecorator":11,"buffer":1,"oMfpAn":4}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceDecorator = require('./DataSourceDecorator');

module.exports = (function () {

    function DataSourceGlobalFilter(dataSource) {
        DataSourceDecorator.call(this, dataSource, false);
        this.filter = null;
    }

    DataSourceGlobalFilter.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceGlobalFilter.prototype.setFilter = function (filter) {
        this.filter = filter;
    };

    DataSourceGlobalFilter.prototype.clearFilters = function () { /* filter */
        this.filter = null;
        this.indexes.length = 0;
    };

    DataSourceGlobalFilter.prototype.applyFilters = function () {
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

    DataSourceGlobalFilter.prototype.applyFilterTo = function (r) {
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceGlobalFilter.js","/")
},{"./DataSourceDecorator":11,"buffer":1,"oMfpAn":4}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Utils = require('./Utils.js');
var DataSourceDecorator = require('./DataSourceDecorator');

module.exports = (function () {

    function DataSourceSorter(dataSource) {
        DataSourceDecorator.call(this, dataSource);
        this.descendingSort = false;
    }

    DataSourceSorter.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceSorter.prototype.sortOn = function (columnIndex, sortType) {
        if (sortType === 0) {
            this.indexes.length = 0;
            return;
        }
        this.initializeIndexVector();
        var self = this;
        Utils.stableSort(this.indexes, function (index) {
            return self.dataSource.getValue(columnIndex, index);
        }, sortType);
    };

    return DataSourceSorter;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceSorter.js","/")
},{"./DataSourceDecorator":11,"./Utils.js":18,"buffer":1,"oMfpAn":4}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceDecorator = require('./DataSourceDecorator');
var DataSourceSorter = require('./DataSourceSorter');

module.exports = (function () {

    function DataSourceSorterComposite(dataSource) {
        DataSourceDecorator.call(this, dataSource);
        this.sorts = [];
        this.last = this.dataSource;
    }

    DataSourceSorterComposite.prototype = Object.create(DataSourceDecorator.prototype);

    DataSourceSorterComposite.prototype.sortOn = function (columnIndex, sortType) {
        this.sorts.push([columnIndex, sortType]);
    };

    DataSourceSorterComposite.prototype.applySorts = function () {
        var sorts = this.sorts;
        var each = this.dataSource;
        for (var i = 0; i < sorts.length; i++) {
            var sort = sorts[i];
            each = new DataSourceSorter(each);
            each.sortOn(sort[0], sort[1]);
        }
        this.last = each;
    };

    DataSourceSorterComposite.prototype.clearSorts = function () {
        this.sorts.length = 0;
        this.last = this.dataSource;
    };

    DataSourceSorterComposite.prototype.getValue = function (x, y) {
        return this.last.getValue(x, y);
    };

    DataSourceSorterComposite.prototype.setValue = function (x, y, value) {
        this.last.setValue(x, y, value);
    };

    return DataSourceSorterComposite;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceSorterComposite.js","/")
},{"./DataSourceDecorator":11,"./DataSourceSorter":14,"buffer":1,"oMfpAn":4}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function () {

    var headerify = function (string) {
        var pieces = string.replace(/[_-]/g, ' ').replace(/[A-Z]/g, ' $&').split(' ').map(function (s) {
            return s.charAt(0).toUpperCase() + s.slice(1);
        });
        return pieces.join(' ');
    };

    var computeFieldNames = function (object) {
        if (!object) {
            return [];
        }
        var fields = [].concat(Object.getOwnPropertyNames(object).filter(function (e) {
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

    JSDataSource.prototype.getValue = function (x, y) {
        if (x === -1) {
            return y;
        }
        var row = this.data[y];
        if (!row) {
            return null;
        }
        var value = row[this.fields[x]];
        return value;
    };

    JSDataSource.prototype.getRow = function (y) {

        return this.data[y];
    };

    JSDataSource.prototype.setValue = function (x, y, value) {

        this.data[y][this.fields[x]] = value;
    };

    JSDataSource.prototype.getColumnCount = function () {

        return this.getHeaders().length;
    };

    JSDataSource.prototype.getRowCount = function () {

        return this.data.length;
    };

    JSDataSource.prototype.getFields = function () {

        return this.fields;
    };

    JSDataSource.prototype.getHeaders = function () {
        if (!this.headers || this.headers.length === 0) {
            this.headers = this.getDefaultHeaders().map(function (each) {
                return headerify(each);
            });
        }
        return this.headers;
    };

    JSDataSource.prototype.getDefaultHeaders = function () {

        return this.getFields();
    };

    JSDataSource.prototype.setFields = function (fields) {

        this.fields = fields;
    };

    JSDataSource.prototype.setHeaders = function (headers) {

        this.headers = headers;
    };

    JSDataSource.prototype.getGrandTotals = function () {
        //nothing here
        return;
    };

    JSDataSource.prototype.setData = function (arrayOfUniformObjects) {
        this.data = arrayOfUniformObjects;
    };

    return JSDataSource;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/JSDataSource.js","/")
},{"buffer":1,"oMfpAn":4}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function () {

    var oidPrefix = '.~.#%_'; //this should be something we never will see at the begining of a string
    var counter = 0;

    var hash = function (key) {
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
    function (a, b) {
        return a === b ? a !== 0 || 1 / a == 1 / b : a != a && b != b; // eslint-disable-line
    };

    // More reliable indexOf, courtesy of @WebReflection
    var betterIndexOf = function (arr, value) {
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

    Mappy.prototype.set = function (key, value) {
        var hashCode = hash(key);
        if (this.data[hashCode] === undefined) {
            this.keys.push(key);
            this.values.push(value);
        }
        this.data[hashCode] = value;
    };

    Mappy.prototype.get = function (key) {
        var hashCode = hash(key);
        return this.data[hashCode];
    };

    Mappy.prototype.getIfAbsent = function (key, ifAbsentFunc) {
        var value = this.get(key);
        if (value === undefined) {
            value = ifAbsentFunc(key, this);
        }
        return value;
    };

    Mappy.prototype.size = function () {
        return this.keys.length;
    };

    Mappy.prototype.clear = function () {
        this.keys.length = 0;
        this.data = {};
    };

    Mappy.prototype.delete = function (key) {
        var hashCode = hash(key);
        if (this.data[hashCode] === undefined) {
            return;
        }
        var index = betterIndexOf(this.keys, key);
        this.keys.splice(index, 1);
        this.values.splice(index, 1);
        delete this.data[hashCode];
    };

    Mappy.prototype.forEach = function (func) {
        var keys = this.keys;
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = this.get(key);
            func(value, key, this);
        }
    };

    Mappy.prototype.map = function (func) {
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

    Mappy.prototype.copy = function () {
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Map.js","/")
},{"buffer":1,"oMfpAn":4}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var stableSort = require('./stableSort.js');
var Map = require('./Map.js');

module.exports = (function () {

    return {
        stableSort: stableSort,
        Map: Map
    };

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Utils.js","/")
},{"./Map.js":17,"./stableSort.js":22,"buffer":1,"oMfpAn":4}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function () {

    return {

        count: function () { /* columIndex */
            return function (group) {
                var rows = group.getRowCount();
                return rows;
            };
        },

        sum: function (columIndex) {
            return function (group) {
                var sum = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    sum = sum + group.getValue(columIndex, r);
                }
                return sum;
            };
        },

        min: function (columIndex) {
            return function (group) {
                var min = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    min = Math.min(min, group.getValue(columIndex, r));
                }
                return min;
            };
        },


        max: function (columIndex) {
            return function (group) {
                var max = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    max = Math.max(max, group.getValue(columIndex, r));
                }
                return max;
            };
        },

        avg: function (columIndex) {
            return function (group) {
                var sum = 0;
                var rows = group.getRowCount();
                for (var r = 0; r < rows; r++) {
                    sum = sum + group.getValue(columIndex, r);
                }
                return sum / rows;
            };
        },

        first: function (columIndex) {
            return function (group) {
                return group.getValue(columIndex, 0);
            };
        },

        last: function (columIndex) {
            return function (group) {
                var rows = group.getRowCount();
                return group.getValue(columIndex, rows - 1);
            };
        },

        stddev: function (columIndex) {
            return function (group) {
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/aggregations.js","/")
},{"buffer":1,"oMfpAn":4}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var JSDataSource = require('./JSDataSource');
var DataSourceSorter = require('./DataSourceSorter');
var DataSourceSorterComposite = require('./DataSourceSorterComposite');
var DataSourceFilter = require('./DataSourceFilter');
var DataSourceGlobalFilter = require('./DataSourceGlobalFilter');
var DataSourceAggregator = require('./DataSourceAggregator');
var aggregations = require('./aggregations');

module.exports = (function () {

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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/analytics.js","/")
},{"./DataSourceAggregator":10,"./DataSourceFilter":12,"./DataSourceGlobalFilter":13,"./DataSourceSorter":14,"./DataSourceSorterComposite":15,"./JSDataSource":16,"./aggregations":19,"buffer":1,"oMfpAn":4}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/* eslint-env node, browser */
'use strict';

var noop = function () {};

var oo = require('object.observe');
var analytics = require('./analytics.js');

noop(oo);

if (!window.fin) {
    window.fin = {};
}
if (!window.fin.analytics) {
    window.fin.analytics = analytics;
}
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_9bd203a1.js","/")
},{"./analytics.js":20,"buffer":1,"oMfpAn":4,"object.observe":5}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var stabilize = function (comparator, descending) {
    return function (arr1, arr2) {
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


var ascendingNumbers = function (x, y) {
    return x - y;
};

var descendingNumbers = function (x, y) {
    return y - x;
};

var ascendingAllOthers = function (x, y) {
    return x < y ? -1 : 1;
};

var descendingAllOthers = function (x, y) {
    return y < x ? -1 : 1;
};

var ascending = function (typeOfData) {
    if (typeOfData === 'number') {
        return stabilize(ascendingNumbers, false);
    }
    return stabilize(ascendingAllOthers, false);
};

var descending = function (typeOfData) {
    if (typeOfData === 'number') {
        return stabilize(descendingNumbers, true);
    }
    return stabilize(descendingAllOthers, true);
};

module.exports = (function () {

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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/stableSort.js","/")
},{"buffer":1,"oMfpAn":4}]},{},[21])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9ub2RlX21vZHVsZXMvb2JqZWN0Lm9ic2VydmUvZGlzdC9vYmplY3Qtb2JzZXJ2ZS5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YU5vZGVCYXNlLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhTm9kZUdyb3VwLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhTm9kZUxlYWYuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFOb2RlVHJlZS5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YVNvdXJjZUFnZ3JlZ2F0b3IuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VEZWNvcmF0b3IuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VGaWx0ZXIuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VHbG9iYWxGaWx0ZXIuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VTb3J0ZXIuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0pTRGF0YVNvdXJjZS5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvTWFwLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9VdGlscy5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvYWdncmVnYXRpb25zLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9hbmFseXRpY3MuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL2Zha2VfOWJkMjAzYTEuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL3N0YWJsZVNvcnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MlxuXG4vKipcbiAqIElmIGBCdWZmZXIuX3VzZVR5cGVkQXJyYXlzYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKGNvbXBhdGlibGUgZG93biB0byBJRTYpXG4gKi9cbkJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgPSAoZnVuY3Rpb24gKCkge1xuICAvLyBEZXRlY3QgaWYgYnJvd3NlciBzdXBwb3J0cyBUeXBlZCBBcnJheXMuIFN1cHBvcnRlZCBicm93c2VycyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLFxuICAvLyBDaHJvbWUgNyssIFNhZmFyaSA1LjErLCBPcGVyYSAxMS42KywgaU9TIDQuMisuIElmIHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgYWRkaW5nXG4gIC8vIHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcywgdGhlbiB0aGF0J3MgdGhlIHNhbWUgYXMgbm8gYFVpbnQ4QXJyYXlgIHN1cHBvcnRcbiAgLy8gYmVjYXVzZSB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gYWRkIGFsbCB0aGUgbm9kZSBCdWZmZXIgQVBJIG1ldGhvZHMuIFRoaXMgaXMgYW4gaXNzdWVcbiAgLy8gaW4gRmlyZWZveCA0LTI5LiBOb3cgZml4ZWQ6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOFxuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiZcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAvLyBDaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybylcblxuICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0XG5cbiAgLy8gV29ya2Fyb3VuZDogbm9kZSdzIGJhc2U2NCBpbXBsZW1lbnRhdGlvbiBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgc3RyaW5nc1xuICAvLyB3aGlsZSBiYXNlNjQtanMgZG9lcyBub3QuXG4gIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcgJiYgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBzdWJqZWN0ID0gc3RyaW5ndHJpbShzdWJqZWN0KVxuICAgIHdoaWxlIChzdWJqZWN0Lmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICAgIHN1YmplY3QgPSBzdWJqZWN0ICsgJz0nXG4gICAgfVxuICB9XG5cbiAgLy8gRmluZCB0aGUgbGVuZ3RoXG4gIHZhciBsZW5ndGhcbiAgaWYgKHR5cGUgPT09ICdudW1iZXInKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0KVxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJylcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QubGVuZ3RoKSAvLyBhc3N1bWUgdGhhdCBvYmplY3QgaXMgYXJyYXktbGlrZVxuICBlbHNlXG4gICAgdGhyb3cgbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCBuZWVkcyB0byBiZSBhIG51bWJlciwgYXJyYXkgb3Igc3RyaW5nLicpXG5cbiAgdmFyIGJ1ZlxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIC8vIFByZWZlcnJlZDogUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBidWYgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIFRISVMgaW5zdGFuY2Ugb2YgQnVmZmVyIChjcmVhdGVkIGJ5IGBuZXdgKVxuICAgIGJ1ZiA9IHRoaXNcbiAgICBidWYubGVuZ3RoID0gbGVuZ3RoXG4gICAgYnVmLl9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkpXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgICBlbHNlXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3RbaV1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgIW5vWmVybykge1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgYnVmW2ldID0gMFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuLy8gU1RBVElDIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiAoYikge1xuICByZXR1cm4gISEoYiAhPT0gbnVsbCAmJiBiICE9PSB1bmRlZmluZWQgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gZnVuY3Rpb24gKHN0ciwgZW5jb2RpbmcpIHtcbiAgdmFyIHJldFxuICBzdHIgPSBzdHIgKyAnJ1xuICBzd2l0Y2ggKGVuY29kaW5nIHx8ICd1dGY4Jykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoIC8gMlxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdyYXcnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAqIDJcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGFzc2VydChpc0FycmF5KGxpc3QpLCAnVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdCwgW3RvdGFsTGVuZ3RoXSlcXG4nICtcbiAgICAgICdsaXN0IHNob3VsZCBiZSBhbiBBcnJheS4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB0b3RhbExlbmd0aCAhPT0gJ251bWJlcicpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBCVUZGRVIgSU5TVEFOQ0UgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gX2hleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgYXNzZXJ0KHN0ckxlbiAlIDIgPT09IDAsICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBhc3NlcnQoIWlzTmFOKGJ5dGUpLCAnSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPSBpICogMlxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBfdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX2FzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX2JpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIF9hc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gX2Jhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gX2hleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IF91dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gX2FzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IF9iaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gX2Jhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBfdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcbiAgc3RhcnQgPSBOdW1iZXIoc3RhcnQpIHx8IDBcbiAgZW5kID0gKGVuZCAhPT0gdW5kZWZpbmVkKVxuICAgID8gTnVtYmVyKGVuZClcbiAgICA6IGVuZCA9IHNlbGYubGVuZ3RoXG5cbiAgLy8gRmFzdHBhdGggZW1wdHkgc3RyaW5nc1xuICBpZiAoZW5kID09PSBzdGFydClcbiAgICByZXR1cm4gJydcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gX2hleFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IF91dGY4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gX2FzY2lpU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IF9iaW5hcnlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gX2Jhc2U2NFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBfdXRmMTZsZVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gKHRhcmdldCwgdGFyZ2V0X3N0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzXG5cbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKCF0YXJnZXRfc3RhcnQpIHRhcmdldF9zdGFydCA9IDBcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGFzc2VydCh0YXJnZXRfc3RhcnQgPj0gMCAmJiB0YXJnZXRfc3RhcnQgPCB0YXJnZXQubGVuZ3RoLFxuICAgICAgJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSBzb3VyY2UubGVuZ3RoLCAnc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aClcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCA8IGVuZCAtIHN0YXJ0KVxuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgKyBzdGFydFxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmIChsZW4gPCAxMDAgfHwgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRfc3RhcnQpXG4gIH1cbn1cblxuZnVuY3Rpb24gX2Jhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiBfdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciB0bXAgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYnVmW2ldIDw9IDB4N0YpIHtcbiAgICAgIHJlcyArPSBkZWNvZGVVdGY4Q2hhcih0bXApICsgU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gICAgICB0bXAgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB0bXAgKz0gJyUnICsgYnVmW2ldLnRvU3RyaW5nKDE2KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXMgKyBkZWNvZGVVdGY4Q2hhcih0bXApXG59XG5cbmZ1bmN0aW9uIF9hc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKylcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gX2JpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIF9hc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gX2hleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gX3V0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSsxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSBjbGFtcChzdGFydCwgbGVuLCAwKVxuICBlbmQgPSBjbGFtcChlbmQsIGxlbiwgbGVuKVxuXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgdmFsID0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICB9IGVsc2Uge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV1cbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZFVJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDJdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgICB2YWwgfD0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0ICsgM10gPDwgMjQgPj4+IDApXG4gIH0gZWxzZSB7XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMV0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMl0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAzXVxuICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0XSA8PCAyNCA+Pj4gMClcbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsXG4gICAgICAgICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICB2YXIgbmVnID0gdGhpc1tvZmZzZXRdICYgMHg4MFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQxNihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gX3JlYWRVSW50MzIoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMDAwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZmZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkRmxvYXQgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWREb3VibGUgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWREb3VibGUodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWREb3VibGUodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuXG5cbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbn1cblxuZnVuY3Rpb24gX3dyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAgICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZmZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2YsIC0weDgwKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB0aGlzLndyaXRlVUludDgodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB0aGlzLndyaXRlVUludDgoMHhmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmLCAtMHg4MDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQxNihidWYsIDB4ZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIF93cml0ZVVJbnQzMihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICBfd3JpdGVVSW50MzIoYnVmLCAweGZmZmZmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCxcbiAgICAgICAgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5jaGFyQ29kZUF0KDApXG4gIH1cblxuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiAhaXNOYU4odmFsdWUpLCAndmFsdWUgaXMgbm90IGEgbnVtYmVyJylcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgdGhpcy5sZW5ndGgsICdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSB0aGlzLmxlbmd0aCwgJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHRoaXNbaV0gPSB2YWx1ZVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG91dCA9IFtdXG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgb3V0W2ldID0gdG9IZXgodGhpc1tpXSlcbiAgICBpZiAoaSA9PT0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUykge1xuICAgICAgb3V0W2kgKyAxXSA9ICcuLi4nXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIG91dC5qb2luKCcgJykgKyAnPidcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpXG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgZ2V0L3NldCBtZXRob2RzIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX2dldCA9IGFyci5nZXRcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxuLy8gc2xpY2Uoc3RhcnQsIGVuZClcbmZ1bmN0aW9uIGNsYW1wIChpbmRleCwgbGVuLCBkZWZhdWx0VmFsdWUpIHtcbiAgaWYgKHR5cGVvZiBpbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgaW5kZXggPSB+fmluZGV4OyAgLy8gQ29lcmNlIHRvIGludGVnZXIuXG4gIGlmIChpbmRleCA+PSBsZW4pIHJldHVybiBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICBpbmRleCArPSBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICByZXR1cm4gMFxufVxuXG5mdW5jdGlvbiBjb2VyY2UgKGxlbmd0aCkge1xuICAvLyBDb2VyY2UgbGVuZ3RoIHRvIGEgbnVtYmVyIChwb3NzaWJseSBOYU4pLCByb3VuZCB1cFxuICAvLyBpbiBjYXNlIGl0J3MgZnJhY3Rpb25hbCAoZS5nLiAxMjMuNDU2KSB0aGVuIGRvIGFcbiAgLy8gZG91YmxlIG5lZ2F0ZSB0byBjb2VyY2UgYSBOYU4gdG8gMC4gRWFzeSwgcmlnaHQ/XG4gIGxlbmd0aCA9IH5+TWF0aC5jZWlsKCtsZW5ndGgpXG4gIHJldHVybiBsZW5ndGggPCAwID8gMCA6IGxlbmd0aFxufVxuXG5mdW5jdGlvbiBpc0FycmF5IChzdWJqZWN0KSB7XG4gIHJldHVybiAoQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoc3ViamVjdCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3ViamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSdcbiAgfSkoc3ViamVjdClcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3RilcbiAgICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpKVxuICAgIGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKylcbiAgICAgICAgYnl0ZUFycmF5LnB1c2gocGFyc2VJbnQoaFtqXSwgMTYpKVxuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShzdHIpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgcG9zXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuXG4vKlxuICogV2UgaGF2ZSB0byBtYWtlIHN1cmUgdGhhdCB0aGUgdmFsdWUgaXMgYSB2YWxpZCBpbnRlZ2VyLiBUaGlzIG1lYW5zIHRoYXQgaXRcbiAqIGlzIG5vbi1uZWdhdGl2ZS4gSXQgaGFzIG5vIGZyYWN0aW9uYWwgY29tcG9uZW50IGFuZCB0aGF0IGl0IGRvZXMgbm90XG4gKiBleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gdmVyaWZ1aW50ICh2YWx1ZSwgbWF4KSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA+PSAwLCAnc3BlY2lmaWVkIGEgbmVnYXRpdmUgdmFsdWUgZm9yIHdyaXRpbmcgYW4gdW5zaWduZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgaXMgbGFyZ2VyIHRoYW4gbWF4aW11bSB2YWx1ZSBmb3IgdHlwZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmc2ludCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmSUVFRTc1NCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG59XG5cbmZ1bmN0aW9uIGFzc2VydCAodGVzdCwgbWVzc2FnZSkge1xuICBpZiAoIXRlc3QpIHRocm93IG5ldyBFcnJvcihtZXNzYWdlIHx8ICdGYWlsZWQgYXNzZXJ0aW9uJylcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXHR2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMgfHxcblx0XHQgICAgY29kZSA9PT0gUExVU19VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0ggfHxcblx0XHQgICAgY29kZSA9PT0gU0xBU0hfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxucHJvY2Vzcy5uZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhblNldEltbWVkaWF0ZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnNldEltbWVkaWF0ZTtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB2YXIgcXVldWUgPSBbXTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIVxyXG4gKiBPYmplY3Qub2JzZXJ2ZSBwb2x5ZmlsbCAtIHYwLjIuNFxyXG4gKiBieSBNYXNzaW1vIEFydGl6enUgKE1heEFydDI1MDEpXHJcbiAqIFxyXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTWF4QXJ0MjUwMS9vYmplY3Qtb2JzZXJ2ZVxyXG4gKiBcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlXHJcbiAqIFNlZSBMSUNFTlNFIGZvciBkZXRhaWxzXHJcbiAqL1xyXG5cclxuLy8gU29tZSB0eXBlIGRlZmluaXRpb25zXHJcbi8qKlxyXG4gKiBUaGlzIHJlcHJlc2VudHMgdGhlIGRhdGEgcmVsYXRpdmUgdG8gYW4gb2JzZXJ2ZWQgb2JqZWN0XHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIE9iamVjdERhdGFcclxuICogQHByb3BlcnR5IHtNYXA8SGFuZGxlciwgSGFuZGxlckRhdGE+fSAgaGFuZGxlcnNcclxuICogQHByb3BlcnR5IHtTdHJpbmdbXX0gICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1xyXG4gKiBAcHJvcGVydHkgeypbXX0gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXNcclxuICogQHByb3BlcnR5IHtEZXNjcmlwdG9yW119ICAgICAgICAgICAgICAgZGVzY3JpcHRvcnNcclxuICogQHByb3BlcnR5IHtOb3RpZmllcn0gICAgICAgICAgICAgICAgICAgbm90aWZpZXJcclxuICogQHByb3BlcnR5IHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgZnJvemVuXHJcbiAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gICAgICAgICAgICAgICAgICAgIGV4dGVuc2libGVcclxuICogQHByb3BlcnR5IHtPYmplY3R9ICAgICAgICAgICAgICAgICAgICAgcHJvdG9cclxuICovXHJcbi8qKlxyXG4gKiBGdW5jdGlvbiBkZWZpbml0aW9uIG9mIGEgaGFuZGxlclxyXG4gKiBAY2FsbGJhY2sgSGFuZGxlclxyXG4gKiBAcGFyYW0ge0NoYW5nZVJlY29yZFtdfSAgICAgICAgICAgICAgICBjaGFuZ2VzXHJcbiovXHJcbi8qKlxyXG4gKiBUaGlzIHJlcHJlc2VudHMgdGhlIGRhdGEgcmVsYXRpdmUgdG8gYW4gb2JzZXJ2ZWQgb2JqZWN0IGFuZCBvbmUgb2YgaXRzXHJcbiAqIGhhbmRsZXJzXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIEhhbmRsZXJEYXRhXHJcbiAqIEBwcm9wZXJ0eSB7TWFwPE9iamVjdCwgT2JzZXJ2ZWREYXRhPn0gIG9ic2VydmVkXHJcbiAqIEBwcm9wZXJ0eSB7Q2hhbmdlUmVjb3JkW119ICAgICAgICAgICAgIGNoYW5nZVJlY29yZHNcclxuICovXHJcbi8qKlxyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBPYnNlcnZlZERhdGFcclxuICogQHByb3BlcnR5IHtTdHJpbmdbXX0gICAgICAgICAgICAgICAgICAgYWNjZXB0TGlzdFxyXG4gKiBAcHJvcGVydHkge09iamVjdERhdGF9ICAgICAgICAgICAgICAgICBkYXRhXHJcbiovXHJcbi8qKlxyXG4gKiBUeXBlIGRlZmluaXRpb24gZm9yIGEgY2hhbmdlLiBBbnkgb3RoZXIgcHJvcGVydHkgY2FuIGJlIGFkZGVkIHVzaW5nXHJcbiAqIHRoZSBub3RpZnkoKSBvciBwZXJmb3JtQ2hhbmdlKCkgbWV0aG9kcyBvZiB0aGUgbm90aWZpZXIuXHJcbiAqIEB0eXBlZGVmICB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIENoYW5nZVJlY29yZFxyXG4gKiBAcHJvcGVydHkge1N0cmluZ30gICAgICAgICAgICAgICAgICAgICB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICAgIG9iamVjdFxyXG4gKiBAcHJvcGVydHkge1N0cmluZ30gICAgICAgICAgICAgICAgICAgICBbbmFtZV1cclxuICogQHByb3BlcnR5IHsqfSAgICAgICAgICAgICAgICAgICAgICAgICAgW29sZFZhbHVlXVxyXG4gKiBAcHJvcGVydHkge051bWJlcn0gICAgICAgICAgICAgICAgICAgICBbaW5kZXhdXHJcbiAqL1xyXG4vKipcclxuICogVHlwZSBkZWZpbml0aW9uIGZvciBhIG5vdGlmaWVyICh3aGF0IE9iamVjdC5nZXROb3RpZmllciByZXR1cm5zKVxyXG4gKiBAdHlwZWRlZiAge09iamVjdH0gICAgICAgICAgICAgICAgICAgICBOb3RpZmllclxyXG4gKiBAcHJvcGVydHkge0Z1bmN0aW9ufSAgICAgICAgICAgICAgICAgICBub3RpZnlcclxuICogQHByb3BlcnR5IHtGdW5jdGlvbn0gICAgICAgICAgICAgICAgICAgcGVyZm9ybUNoYW5nZVxyXG4gKi9cclxuLyoqXHJcbiAqIEZ1bmN0aW9uIGNhbGxlZCB3aXRoIE5vdGlmaWVyLnBlcmZvcm1DaGFuZ2UuIEl0IG1heSBvcHRpb25hbGx5IHJldHVybiBhXHJcbiAqIENoYW5nZVJlY29yZCB0aGF0IGdldHMgYXV0b21hdGljYWxseSBub3RpZmllZCwgYnV0IGB0eXBlYCBhbmQgYG9iamVjdGBcclxuICogcHJvcGVydGllcyBhcmUgb3ZlcnJpZGRlbi5cclxuICogQGNhbGxiYWNrIFBlcmZvcm1lclxyXG4gKiBAcmV0dXJucyB7Q2hhbmdlUmVjb3JkfHVuZGVmaW5lZH1cclxuICovXHJcblxyXG5PYmplY3Qub2JzZXJ2ZSB8fCAoZnVuY3Rpb24oTywgQSwgcm9vdCkge1xyXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJlbGF0ZXMgb2JzZXJ2ZWQgb2JqZWN0cyBhbmQgdGhlaXIgZGF0YVxyXG4gICAgICAgICAqIEB0eXBlIHtNYXA8T2JqZWN0LCBPYmplY3REYXRhfVxyXG4gICAgICAgICAqL1xyXG4gICAgdmFyIG9ic2VydmVkLFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIExpc3Qgb2YgaGFuZGxlcnMgYW5kIHRoZWlyIGRhdGFcclxuICAgICAgICAgKiBAdHlwZSB7TWFwPEhhbmRsZXIsIE1hcDxPYmplY3QsIEhhbmRsZXJEYXRhPj59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaGFuZGxlcnMsXHJcblxyXG4gICAgICAgIGRlZmF1bHRBY2NlcHRMaXN0ID0gWyBcImFkZFwiLCBcInVwZGF0ZVwiLCBcImRlbGV0ZVwiLCBcInJlY29uZmlndXJlXCIsIFwic2V0UHJvdG90eXBlXCIsIFwicHJldmVudEV4dGVuc2lvbnNcIiBdO1xyXG5cclxuICAgIC8vIEZ1bmN0aW9ucyBmb3IgaW50ZXJuYWwgdXNhZ2VcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQ2hlY2tzIGlmIHRoZSBhcmd1bWVudCBpcyBhbiBBcnJheSBvYmplY3QuIFBvbHlmaWxscyBBcnJheS5pc0FycmF5LlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBpc0FycmF5XHJcbiAgICAgICAgICogQHBhcmFtIHs/Kn0gb2JqZWN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICB2YXIgaXNBcnJheSA9IEEuaXNBcnJheSB8fCAoZnVuY3Rpb24odG9TdHJpbmcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmplY3QpIHsgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiOyB9O1xyXG4gICAgICAgIH0pKE8ucHJvdG90eXBlLnRvU3RyaW5nKSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyB0aGUgaW5kZXggb2YgYW4gaXRlbSBpbiBhIGNvbGxlY3Rpb24sIG9yIC0xIGlmIG5vdCBmb3VuZC5cclxuICAgICAgICAgKiBVc2VzIHRoZSBnZW5lcmljIEFycmF5LmluZGV4T2Ygb3IgQXJyYXkucHJvdG90eXBlLmluZGV4T2YgaWYgYXZhaWxhYmxlLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBpbkFycmF5XHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXlcclxuICAgICAgICAgKiBAcGFyYW0geyp9IHBpdm90ICAgICAgICAgICBJdGVtIHRvIGxvb2sgZm9yXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IFtzdGFydD0wXSAgSW5kZXggdG8gc3RhcnQgZnJvbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5BcnJheSA9IEEucHJvdG90eXBlLmluZGV4T2YgPyBBLmluZGV4T2YgfHwgZnVuY3Rpb24oYXJyYXksIHBpdm90LCBzdGFydCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGFycmF5LCBwaXZvdCwgc3RhcnQpO1xyXG4gICAgICAgIH0gOiBmdW5jdGlvbihhcnJheSwgcGl2b3QsIHN0YXJ0KSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSBzdGFydCB8fCAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICBpZiAoYXJyYXlbaV0gPT09IHBpdm90KVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpO1xyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBNYXAsIG9yIGEgTWFwLWxpa2Ugb2JqZWN0IGlzIE1hcCBpcyBub3RcclxuICAgICAgICAgKiBzdXBwb3J0ZWQgb3IgZG9lc24ndCBzdXBwb3J0IGZvckVhY2goKVxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBjcmVhdGVNYXBcclxuICAgICAgICAgKiBAcmV0dXJucyB7TWFwfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNyZWF0ZU1hcCA9IHR5cGVvZiByb290Lk1hcCA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhTWFwLnByb3RvdHlwZS5mb3JFYWNoID8gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIC8vIExpZ2h0d2VpZ2h0IHNoaW0gb2YgTWFwLiBMYWNrcyBjbGVhcigpLCBlbnRyaWVzKCksIGtleXMoKSBhbmRcclxuICAgICAgICAgICAgLy8gdmFsdWVzKCkgKHRoZSBsYXN0IDMgbm90IHN1cHBvcnRlZCBieSBJRTExLCBzbyBjYW4ndCB1c2UgdGhlbSksXHJcbiAgICAgICAgICAgIC8vIGl0IGRvZXNuJ3QgaGFuZGxlIHRoZSBjb25zdHJ1Y3RvcidzIGFyZ3VtZW50IChsaWtlIElFMTEpIGFuZCBvZlxyXG4gICAgICAgICAgICAvLyBjb3Vyc2UgaXQgZG9lc24ndCBzdXBwb3J0IGZvci4uLm9mLlxyXG4gICAgICAgICAgICAvLyBDaHJvbWUgMzEtMzUgYW5kIEZpcmVmb3ggMTMtMjQgaGF2ZSBhIGJhc2ljIHN1cHBvcnQgb2YgTWFwLCBidXRcclxuICAgICAgICAgICAgLy8gdGhleSBsYWNrIGZvckVhY2goKSwgc28gdGhlaXIgbmF0aXZlIGltcGxlbWVudGF0aW9uIGlzIGJhZCBmb3JcclxuICAgICAgICAgICAgLy8gdGhpcyBwb2x5ZmlsbC4gKENocm9tZSAzNisgc3VwcG9ydHMgT2JqZWN0Lm9ic2VydmUuKVxyXG4gICAgICAgICAgICB2YXIga2V5cyA9IFtdLCB2YWx1ZXMgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzaXplOiAwLFxyXG4gICAgICAgICAgICAgICAgaGFzOiBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIGluQXJyYXkoa2V5cywga2V5KSA+IC0xOyB9LFxyXG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZhbHVlc1tpbkFycmF5KGtleXMsIGtleSldOyB9LFxyXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSBpbkFycmF5KGtleXMsIGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2l6ZSsrO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB2YWx1ZXNbaV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBcImRlbGV0ZVwiOiBmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IGluQXJyYXkoa2V5cywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaSA+IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNpemUtLTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZm9yRWFjaDogZnVuY3Rpb24oY2FsbGJhY2svKiwgdGhpc09iaiovKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKGFyZ3VtZW50c1sxXSwgdmFsdWVzW2ldLCBrZXlzW2ldLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IDogZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgTWFwKCk7IH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNpbXBsZSBzaGltIGZvciBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyB3aGVuIGlzIG5vdCBhdmFpbGFibGVcclxuICAgICAgICAgKiBNaXNzZXMgY2hlY2tzIG9uIG9iamVjdCwgZG9uJ3QgdXNlIGFzIGEgcmVwbGFjZW1lbnQgb2YgT2JqZWN0LmtleXMvZ2V0T3duUHJvcGVydHlOYW1lc1xyXG4gICAgICAgICAqIEBmdW5jdGlvbiBnZXRQcm9wc1xyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nW119XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0UHJvcHMgPSBPLmdldE93blByb3BlcnR5TmFtZXMgPyAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBmdW5jID0gTy5nZXRPd25Qcm9wZXJ0eU5hbWVzO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgYXJndW1lbnRzLmNhbGxlZTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gU3RyaWN0IG1vZGUgaXMgc3VwcG9ydGVkXHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSW4gc3RyaWN0IG1vZGUsIHdlIGNhbid0IGFjY2VzcyB0byBcImFyZ3VtZW50c1wiLCBcImNhbGxlclwiIGFuZFxyXG4gICAgICAgICAgICAgICAgLy8gXCJjYWxsZWVcIiBwcm9wZXJ0aWVzIG9mIGZ1bmN0aW9ucy4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXNcclxuICAgICAgICAgICAgICAgIC8vIHJldHVybnMgWyBcInByb3RvdHlwZVwiLCBcImxlbmd0aFwiLCBcIm5hbWVcIiBdIGluIEZpcmVmb3g7IGl0IHJldHVybnNcclxuICAgICAgICAgICAgICAgIC8vIFwiY2FsbGVyXCIgYW5kIFwiYXJndW1lbnRzXCIgdG9vIGluIENocm9tZSBhbmQgaW4gSW50ZXJuZXRcclxuICAgICAgICAgICAgICAgIC8vIEV4cGxvcmVyLCBzbyB0aG9zZSB2YWx1ZXMgbXVzdCBiZSBmaWx0ZXJlZC5cclxuICAgICAgICAgICAgICAgIHZhciBhdm9pZCA9IChmdW5jKGluQXJyYXkpLmpvaW4oXCIgXCIpICsgXCIgXCIpLnJlcGxhY2UoL3Byb3RvdHlwZSB8bGVuZ3RoIHxuYW1lIC9nLCBcIlwiKS5zbGljZSgwLCAtMSkuc3BsaXQoXCIgXCIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGF2b2lkLmxlbmd0aCkgZnVuYyA9IGZ1bmN0aW9uKG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9wcyA9IE8uZ2V0T3duUHJvcGVydHlOYW1lcyhvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBqOyBpIDwgYXZvaWQubGVuZ3RoOylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoaiA9IGluQXJyYXkocHJvcHMsIGF2b2lkW2krK10pKSA+IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnNwbGljZShqLCAxKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3BzO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZnVuYztcclxuICAgICAgICB9KSgpIDogZnVuY3Rpb24ob2JqZWN0KSB7XHJcbiAgICAgICAgICAgIC8vIFBvb3ItbW91dGggdmVyc2lvbiB3aXRoIGZvci4uLmluIChJRTgtKVxyXG4gICAgICAgICAgICB2YXIgcHJvcHMgPSBbXSwgcHJvcCwgaG9wO1xyXG4gICAgICAgICAgICBpZiAoXCJoYXNPd25Qcm9wZXJ0eVwiIGluIG9iamVjdCkge1xyXG4gICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIG9iamVjdClcclxuICAgICAgICAgICAgICAgICAgICBpZiAob2JqZWN0Lmhhc093blByb3BlcnR5KHByb3ApKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaG9wID0gTy5oYXNPd25Qcm9wZXJ0eTtcclxuICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiBvYmplY3QpXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhvcC5jYWxsKG9iamVjdCwgcHJvcCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BzLnB1c2gocHJvcCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEluc2VydGluZyBhIGNvbW1vbiBub24tZW51bWVyYWJsZSBwcm9wZXJ0eSBvZiBhcnJheXNcclxuICAgICAgICAgICAgaWYgKGlzQXJyYXkob2JqZWN0KSlcclxuICAgICAgICAgICAgICAgIHByb3BzLnB1c2goXCJsZW5ndGhcIik7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gcHJvcHM7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogUmV0dXJuIHRoZSBwcm90b3R5cGUgb2YgdGhlIG9iamVjdC4uLiBpZiBkZWZpbmVkLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBnZXRQcm90b3R5cGVcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRQcm90b3R5cGUgPSBPLmdldFByb3RvdHlwZU9mLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBSZXR1cm4gdGhlIGRlc2NyaXB0b3Igb2YgdGhlIG9iamVjdC4uLiBpZiBkZWZpbmVkLlxyXG4gICAgICAgICAqIElFOCBzdXBwb3J0cyBhICh1c2VsZXNzKSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIGZvciBET01cclxuICAgICAgICAgKiBub2RlcyBvbmx5LCBzbyBkZWZpbmVQcm9wZXJ0aWVzIGlzIGNoZWNrZWQgaW5zdGVhZC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gZ2V0RGVzY3JpcHRvclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcclxuICAgICAgICAgKiBAcmV0dXJucyB7RGVzY3JpcHRvcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXREZXNjcmlwdG9yID0gTy5kZWZpbmVQcm9wZXJ0aWVzICYmIE8uZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yLFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBTZXRzIHVwIHRoZSBuZXh0IGNoZWNrIGFuZCBkZWxpdmVyaW5nIGl0ZXJhdGlvbiwgdXNpbmdcclxuICAgICAgICAgKiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgb3IgYSAoY2xvc2UpIHBvbHlmaWxsLlxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBuZXh0RnJhbWVcclxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBmdW5jXHJcbiAgICAgICAgICogQHJldHVybnMge251bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBuZXh0RnJhbWUgPSByb290LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCByb290LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBpbml0aWFsID0gK25ldyBEYXRlLFxyXG4gICAgICAgICAgICAgICAgbGFzdCA9IGluaXRpYWw7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihmdW5jKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBmdW5jKChsYXN0ID0gK25ldyBEYXRlKSAtIGluaXRpYWwpO1xyXG4gICAgICAgICAgICAgICAgfSwgMTcpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pKCksXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFNldHMgdXAgdGhlIG9ic2VydmF0aW9uIG9mIGFuIG9iamVjdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBkb09ic2VydmVcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtIYW5kbGVyfSBoYW5kbGVyXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmdbXX0gW2FjY2VwdExpc3RdXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZG9PYnNlcnZlID0gZnVuY3Rpb24ob2JqZWN0LCBoYW5kbGVyLCBhY2NlcHRMaXN0KSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IG9ic2VydmVkLmdldChvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGRhdGEpXHJcbiAgICAgICAgICAgICAgICBzZXRIYW5kbGVyKG9iamVjdCwgZGF0YSwgaGFuZGxlciwgYWNjZXB0TGlzdCk7XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZGF0YSA9IGNyZWF0ZU9iamVjdERhdGEob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgIHNldEhhbmRsZXIob2JqZWN0LCBkYXRhLCBoYW5kbGVyLCBhY2NlcHRMaXN0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKG9ic2VydmVkLnNpemUgPT09IDEpXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gTGV0IHRoZSBvYnNlcnZhdGlvbiBiZWdpbiFcclxuICAgICAgICAgICAgICAgICAgICBuZXh0RnJhbWUocnVuR2xvYmFsTG9vcCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBDcmVhdGVzIHRoZSBpbml0aWFsIGRhdGEgZm9yIGFuIG9ic2VydmVkIG9iamVjdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBjcmVhdGVPYmplY3REYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNyZWF0ZU9iamVjdERhdGEgPSBmdW5jdGlvbihvYmplY3QsIGRhdGEpIHtcclxuICAgICAgICAgICAgdmFyIHByb3BzID0gZ2V0UHJvcHMob2JqZWN0KSxcclxuICAgICAgICAgICAgICAgIHZhbHVlcyA9IFtdLCBkZXNjcywgaSA9IDAsXHJcbiAgICAgICAgICAgICAgICBkYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXJzOiBjcmVhdGVNYXAoKSxcclxuICAgICAgICAgICAgICAgICAgICBmcm96ZW46IE8uaXNGcm96ZW4gPyBPLmlzRnJvemVuKG9iamVjdCkgOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBleHRlbnNpYmxlOiBPLmlzRXh0ZW5zaWJsZSA/IE8uaXNFeHRlbnNpYmxlKG9iamVjdCkgOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3RvOiBnZXRQcm90b3R5cGUgJiYgZ2V0UHJvdG90eXBlKG9iamVjdCksXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogcHJvcHMsXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgbm90aWZpZXI6IHJldHJpZXZlTm90aWZpZXIob2JqZWN0LCBkYXRhKVxyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGlmIChnZXREZXNjcmlwdG9yKSB7XHJcbiAgICAgICAgICAgICAgICBkZXNjcyA9IGRhdGEuZGVzY3JpcHRvcnMgPSBbXTtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChpIDwgcHJvcHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVzY3NbaV0gPSBnZXREZXNjcmlwdG9yKG9iamVjdCwgcHJvcHNbaV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlc1tpXSA9IG9iamVjdFtwcm9wc1tpKytdXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHdoaWxlIChpIDwgcHJvcHMubGVuZ3RoKVxyXG4gICAgICAgICAgICAgICAgdmFsdWVzW2ldID0gb2JqZWN0W3Byb3BzW2krK11dO1xyXG5cclxuICAgICAgICAgICAgb2JzZXJ2ZWQuc2V0KG9iamVjdCwgZGF0YSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBQZXJmb3JtcyBiYXNpYyBwcm9wZXJ0eSB2YWx1ZSBjaGFuZ2UgY2hlY2tzIG9uIGFuIG9ic2VydmVkIG9iamVjdFxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBwZXJmb3JtUHJvcGVydHlDaGVja3NcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IFtleGNlcHRdICBEb2Vzbid0IGRlbGl2ZXIgdGhlIGNoYW5nZXMgdG8gdGhlXHJcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVycyB0aGF0IGFjY2VwdCB0aGlzIHR5cGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBwZXJmb3JtUHJvcGVydHlDaGVja3MgPSAoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciB1cGRhdGVDaGVjayA9IGdldERlc2NyaXB0b3IgPyBmdW5jdGlvbihvYmplY3QsIGRhdGEsIGlkeCwgZXhjZXB0LCBkZXNjcikge1xyXG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGRhdGEucHJvcGVydGllc1tpZHhdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV0sXHJcbiAgICAgICAgICAgICAgICAgICAgb3ZhbHVlID0gZGF0YS52YWx1ZXNbaWR4XSxcclxuICAgICAgICAgICAgICAgICAgICBvZGVzYyA9IGRhdGEuZGVzY3JpcHRvcnNbaWR4XTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyICYmIChvdmFsdWUgPT09IHZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID8gb3ZhbHVlID09PSAwICYmIDEvb3ZhbHVlICE9PSAxL3ZhbHVlIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG92YWx1ZSA9PT0gb3ZhbHVlIHx8IHZhbHVlID09PSB2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzW2lkeF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChvZGVzYy5jb25maWd1cmFibGUgJiYgKCFkZXNjci5jb25maWd1cmFibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3Iud3JpdGFibGUgIT09IG9kZXNjLndyaXRhYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8IGRlc2NyLmVudW1lcmFibGUgIT09IG9kZXNjLmVudW1lcmFibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3IuZ2V0ICE9PSBvZGVzYy5nZXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgfHwgZGVzY3Iuc2V0ICE9PSBvZGVzYy5zZXQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYWRkQ2hhbmdlUmVjb3JkKG9iamVjdCwgZGF0YSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwicmVjb25maWd1cmVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZGVzY3JpcHRvcnNbaWR4XSA9IGRlc2NyO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IDogZnVuY3Rpb24ob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGRhdGEucHJvcGVydGllc1tpZHhdLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV0sXHJcbiAgICAgICAgICAgICAgICAgICAgb3ZhbHVlID0gZGF0YS52YWx1ZXNbaWR4XTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAob3ZhbHVlID09PSB2YWx1ZSA/IG92YWx1ZSA9PT0gMCAmJiAxL292YWx1ZSAhPT0gMS92YWx1ZSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgOiBvdmFsdWUgPT09IG92YWx1ZSB8fCB2YWx1ZSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudmFsdWVzW2lkeF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrcyBpZiBzb21lIHByb3BlcnR5IGhhcyBiZWVuIGRlbGV0ZWRcclxuICAgICAgICAgICAgdmFyIGRlbGV0aW9uQ2hlY2sgPSBnZXREZXNjcmlwdG9yID8gZnVuY3Rpb24ob2JqZWN0LCBwcm9wcywgcHJvcGxlbiwgZGF0YSwgZXhjZXB0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaSA9IHByb3BzLmxlbmd0aCwgZGVzY3I7XHJcbiAgICAgICAgICAgICAgICB3aGlsZSAocHJvcGxlbiAmJiBpLS0pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcHNbaV0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3IgPSBnZXREZXNjcmlwdG9yKG9iamVjdCwgcHJvcHNbaV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIGRlc2NyaXB0b3IsIHRoZSBwcm9wZXJ0eSBoYXMgcmVhbGx5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJlZW4gZGVsZXRlZDsgb3RoZXJ3aXNlLCBpdCdzIGJlZW4gcmVjb25maWd1cmVkIHNvXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoYXQncyBub3QgZW51bWVyYWJsZSBhbnltb3JlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXNjcikgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpLCBleGNlcHQsIGRlc2NyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcHJvcHNbaV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJkZWxldGVcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogZGF0YS52YWx1ZXNbaV1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3BlcnRpZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS52YWx1ZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5kZXNjcmlwdG9ycy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gOiBmdW5jdGlvbihvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpID0gcHJvcHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKHByb3BsZW4gJiYgaS0tKVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wc1tpXSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwcm9wc1tpXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IG9iamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBkYXRhLnZhbHVlc1tpXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnByb3BlcnRpZXMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnZhbHVlcy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BsZW4tLTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSwgb2JqZWN0LCBleGNlcHQpIHtcclxuICAgICAgICAgICAgICAgIGlmICghZGF0YS5oYW5kbGVycy5zaXplIHx8IGRhdGEuZnJvemVuKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIHByb3BzLCBwcm9wbGVuLCBrZXlzLFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlcyA9IGRhdGEudmFsdWVzLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlc2NzID0gZGF0YS5kZXNjcmlwdG9ycyxcclxuICAgICAgICAgICAgICAgICAgICBpID0gMCwgaWR4LFxyXG4gICAgICAgICAgICAgICAgICAgIGtleSwgdmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvdG8sIGRlc2NyO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBvYmplY3QgaXNuJ3QgZXh0ZW5zaWJsZSwgd2UgZG9uJ3QgbmVlZCB0byBjaGVjayBmb3IgbmV3XHJcbiAgICAgICAgICAgICAgICAvLyBvciBkZWxldGVkIHByb3BlcnRpZXNcclxuICAgICAgICAgICAgICAgIGlmIChkYXRhLmV4dGVuc2libGUpIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcHMgPSBkYXRhLnByb3BlcnRpZXMuc2xpY2UoKTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9wbGVuID0gcHJvcHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgICAgIGtleXMgPSBnZXRQcm9wcyhvYmplY3QpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGVzY3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBrZXlzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWR4ID0gaW5BcnJheShwcm9wcywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyID0gZ2V0RGVzY3JpcHRvcihvYmplY3QsIGtleSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhZGRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnB1c2gob2JqZWN0W2tleV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NzLnB1c2goZGVzY3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wc1tpZHhdID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCwgZGVzY3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0aW9uQ2hlY2sob2JqZWN0LCBwcm9wcywgcHJvcGxlbiwgZGF0YSwgZXhjZXB0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghTy5pc0V4dGVuc2libGUob2JqZWN0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5leHRlbnNpYmxlID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJwcmV2ZW50RXh0ZW5zaW9uc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuZnJvemVuID0gTy5pc0Zyb3plbihvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBrZXlzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpKytdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWR4ID0gaW5BcnJheShwcm9wcywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJhZGRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiBvYmplY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvcGVydGllcy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wc1tpZHhdID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wbGVuLS07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQ2hlY2sob2JqZWN0LCBkYXRhLCBpZHgsIGV4Y2VwdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRpb25DaGVjayhvYmplY3QsIHByb3BzLCBwcm9wbGVuLCBkYXRhLCBleGNlcHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFkYXRhLmZyb3plbikge1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGUgb2JqZWN0IGlzIG5vdCBleHRlbnNpYmxlLCBidXQgbm90IGZyb3plbiwgd2UganVzdCBoYXZlXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdG8gY2hlY2sgZm9yIHZhbHVlIGNoYW5nZXNcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IHByb3BzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDaGVjayhvYmplY3QsIGRhdGEsIGksIGV4Y2VwdCwgZ2V0RGVzY3JpcHRvcihvYmplY3QsIGtleSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKE8uaXNGcm96ZW4ob2JqZWN0KSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS5mcm96ZW4gPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChnZXRQcm90b3R5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBwcm90byA9IGdldFByb3RvdHlwZShvYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm90byAhPT0gZGF0YS5wcm90bykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRDaGFuZ2VSZWNvcmQob2JqZWN0LCBkYXRhLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInNldFByb3RvdHlwZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJfX3Byb3RvX19cIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDogb2JqZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IGRhdGEucHJvdG9cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHJvdG8gPSBwcm90bztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSkoKSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogU2V0cyB1cCB0aGUgbWFpbiBsb29wIGZvciBvYmplY3Qgb2JzZXJ2YXRpb24gYW5kIGNoYW5nZSBub3RpZmljYXRpb25cclxuICAgICAgICAgKiBJdCBzdG9wcyBpZiBubyBvYmplY3QgaXMgb2JzZXJ2ZWQuXHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHJ1bkdsb2JhbExvb3BcclxuICAgICAgICAgKi9cclxuICAgICAgICBydW5HbG9iYWxMb29wID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmIChvYnNlcnZlZC5zaXplKSB7XHJcbiAgICAgICAgICAgICAgICBvYnNlcnZlZC5mb3JFYWNoKHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyk7XHJcbiAgICAgICAgICAgICAgICBoYW5kbGVycy5mb3JFYWNoKGRlbGl2ZXJIYW5kbGVyUmVjb3Jkcyk7XHJcbiAgICAgICAgICAgICAgICBuZXh0RnJhbWUocnVuR2xvYmFsTG9vcCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBEZWxpdmVyIHRoZSBjaGFuZ2UgcmVjb3JkcyByZWxhdGl2ZSB0byBhIGNlcnRhaW4gaGFuZGxlciwgYW5kIHJlc2V0c1xyXG4gICAgICAgICAqIHRoZSByZWNvcmQgbGlzdC5cclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJEYXRhfSBoZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGRlbGl2ZXJIYW5kbGVyUmVjb3JkcyA9IGZ1bmN0aW9uKGhkYXRhLCBoYW5kbGVyKSB7XHJcbiAgICAgICAgICAgIGlmIChoZGF0YS5jaGFuZ2VSZWNvcmRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlcihoZGF0YS5jaGFuZ2VSZWNvcmRzKTtcclxuICAgICAgICAgICAgICAgIGhkYXRhLmNoYW5nZVJlY29yZHMgPSBbXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJldHVybnMgdGhlIG5vdGlmaWVyIGZvciBhbiBvYmplY3QgLSB3aGV0aGVyIGl0J3Mgb2JzZXJ2ZWQgb3Igbm90XHJcbiAgICAgICAgICogQGZ1bmN0aW9uIHJldHJpZXZlTm90aWZpZXJcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3REYXRhfSBbZGF0YV1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Tm90aWZpZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmV0cmlldmVOb3RpZmllciA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSkge1xyXG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpXHJcbiAgICAgICAgICAgICAgICBkYXRhID0gb2JzZXJ2ZWQuZ2V0KG9iamVjdCk7XHJcblxyXG4gICAgICAgICAgICAvKiogQHR5cGUge05vdGlmaWVyfSAqL1xyXG4gICAgICAgICAgICByZXR1cm4gZGF0YSAmJiBkYXRhLm5vdGlmaWVyIHx8IHtcclxuICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICogQG1ldGhvZCBub3RpZnlcclxuICAgICAgICAgICAgICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jbm90aWZpZXJwcm90b3R5cGUuX25vdGlmeVxyXG4gICAgICAgICAgICAgICAgICogQG1lbWJlcm9mIE5vdGlmaWVyXHJcbiAgICAgICAgICAgICAgICAgKiBAcGFyYW0ge0NoYW5nZVJlY29yZH0gY2hhbmdlUmVjb3JkXHJcbiAgICAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICAgIG5vdGlmeTogZnVuY3Rpb24oY2hhbmdlUmVjb3JkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlUmVjb3JkLnR5cGU7IC8vIEp1c3QgdG8gY2hlY2sgdGhlIHByb3BlcnR5IGlzIHRoZXJlLi4uXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGF0YSwgdGhlIG9iamVjdCBoYXMgYmVlbiB1bm9ic2VydmVkXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVjb3JkQ29weSA9IHsgb2JqZWN0OiBvYmplY3QgfSwgcHJvcDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIGNoYW5nZVJlY29yZClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wICE9PSBcIm9iamVjdFwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlY29yZENvcHlbcHJvcF0gPSBjaGFuZ2VSZWNvcmRbcHJvcF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIHJlY29yZENvcHkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICAgKiBAbWV0aG9kIHBlcmZvcm1DaGFuZ2VcclxuICAgICAgICAgICAgICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jbm90aWZpZXJwcm90b3R5cGVfLnBlcmZvcm1jaGFuZ2VcclxuICAgICAgICAgICAgICAgICAqIEBtZW1iZXJvZiBOb3RpZmllclxyXG4gICAgICAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGNoYW5nZVR5cGVcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7UGVyZm9ybWVyfSBmdW5jICAgICBUaGUgdGFzayBwZXJmb3JtZXJcclxuICAgICAgICAgICAgICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNPYmpdICAgICAgICBVc2VkIHRvIHNldCBgdGhpc2Agd2hlbiBjYWxsaW5nIGZ1bmNcclxuICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgcGVyZm9ybUNoYW5nZTogZnVuY3Rpb24oY2hhbmdlVHlwZSwgZnVuYy8qLCB0aGlzT2JqKi8pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoYW5nZVR5cGUgIT09IFwic3RyaW5nXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIG5vbi1zdHJpbmcgY2hhbmdlVHlwZVwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgcGVyZm9ybSBub24tZnVuY3Rpb25cIik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZXJlJ3Mgbm8gZGF0YSwgdGhlIG9iamVjdCBoYXMgYmVlbiB1bm9ic2VydmVkXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBvYnNlcnZlZC5nZXQob2JqZWN0KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCwgY2hhbmdlUmVjb3JkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBmdW5jLmNhbGwoYXJndW1lbnRzWzJdKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YSAmJiBwZXJmb3JtUHJvcGVydHlDaGVja3MoZGF0YSwgb2JqZWN0LCBjaGFuZ2VUeXBlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBkYXRhLCB0aGUgb2JqZWN0IGhhcyBiZWVuIHVub2JzZXJ2ZWRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiByZXN1bHQgJiYgdHlwZW9mIHJlc3VsdCA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmQgPSB7IG9iamVjdDogb2JqZWN0LCB0eXBlOiBjaGFuZ2VUeXBlIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiByZXN1bHQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvcCAhPT0gXCJvYmplY3RcIiAmJiBwcm9wICE9PSBcInR5cGVcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VSZWNvcmRbcHJvcF0gPSByZXN1bHRbcHJvcF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZENoYW5nZVJlY29yZChvYmplY3QsIGRhdGEsIGNoYW5nZVJlY29yZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFJlZ2lzdGVyIChvciByZWRlZmluZXMpIGFuIGhhbmRsZXIgaW4gdGhlIGNvbGxlY3Rpb24gZm9yIGEgZ2l2ZW5cclxuICAgICAgICAgKiBvYmplY3QgYW5kIGEgZ2l2ZW4gdHlwZSBhY2NlcHQgbGlzdC5cclxuICAgICAgICAgKiBAZnVuY3Rpb24gc2V0SGFuZGxlclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdERhdGF9IGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ1tdfSBhY2NlcHRMaXN0XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2V0SGFuZGxlciA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgaGFuZGxlciwgYWNjZXB0TGlzdCkge1xyXG4gICAgICAgICAgICB2YXIgaGRhdGEgPSBoYW5kbGVycy5nZXQoaGFuZGxlcik7XHJcbiAgICAgICAgICAgIGlmICghaGRhdGEpXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVycy5zZXQoaGFuZGxlciwgaGRhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb2JzZXJ2ZWQ6IGNyZWF0ZU1hcCgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVJlY29yZHM6IFtdXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaGRhdGEub2JzZXJ2ZWQuc2V0KG9iamVjdCwge1xyXG4gICAgICAgICAgICAgICAgYWNjZXB0TGlzdDogYWNjZXB0TGlzdC5zbGljZSgpLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgZGF0YS5oYW5kbGVycy5zZXQoaGFuZGxlciwgaGRhdGEpO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEFkZHMgYSBjaGFuZ2UgcmVjb3JkIGluIGEgZ2l2ZW4gT2JqZWN0RGF0YVxyXG4gICAgICAgICAqIEBmdW5jdGlvbiBhZGRDaGFuZ2VSZWNvcmRcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3REYXRhfSBkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtDaGFuZ2VSZWNvcmR9IGNoYW5nZVJlY29yZFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBbZXhjZXB0XVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZENoYW5nZVJlY29yZCA9IGZ1bmN0aW9uKG9iamVjdCwgZGF0YSwgY2hhbmdlUmVjb3JkLCBleGNlcHQpIHtcclxuICAgICAgICAgICAgZGF0YS5oYW5kbGVycy5mb3JFYWNoKGZ1bmN0aW9uKGhkYXRhKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgYWNjZXB0TGlzdCA9IGhkYXRhLm9ic2VydmVkLmdldChvYmplY3QpLmFjY2VwdExpc3Q7XHJcbiAgICAgICAgICAgICAgICAvLyBJZiBleGNlcHQgaXMgZGVmaW5lZCwgTm90aWZpZXIucGVyZm9ybUNoYW5nZSBoYXMgYmVlblxyXG4gICAgICAgICAgICAgICAgLy8gY2FsbGVkLCB3aXRoIGV4Y2VwdCBhcyB0aGUgdHlwZS5cclxuICAgICAgICAgICAgICAgIC8vIEFsbCB0aGUgaGFuZGxlcnMgdGhhdCBhY2NlcHRzIHRoYXQgdHlwZSBhcmUgc2tpcHBlZC5cclxuICAgICAgICAgICAgICAgIGlmICgodHlwZW9mIGV4Y2VwdCAhPT0gXCJzdHJpbmdcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCBpbkFycmF5KGFjY2VwdExpc3QsIGV4Y2VwdCkgPT09IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAmJiBpbkFycmF5KGFjY2VwdExpc3QsIGNoYW5nZVJlY29yZC50eXBlKSA+IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgIGhkYXRhLmNoYW5nZVJlY29yZHMucHVzaChjaGFuZ2VSZWNvcmQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG5cclxuICAgIG9ic2VydmVkID0gY3JlYXRlTWFwKCk7XHJcbiAgICBoYW5kbGVycyA9IGNyZWF0ZU1hcCgpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC5vYnNlcnZlXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9hcnYuZ2l0aHViLmlvL2VjbWFzY3JpcHQtb2JqZWN0LW9ic2VydmUvI09iamVjdC5vYnNlcnZlXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nW119IFthY2NlcHRMaXN0XVxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gICAgICAgICAgICAgICBUaGUgb2JzZXJ2ZWQgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIE8ub2JzZXJ2ZSA9IGZ1bmN0aW9uIG9ic2VydmUob2JqZWN0LCBoYW5kbGVyLCBhY2NlcHRMaXN0KSB7XHJcbiAgICAgICAgaWYgKCFvYmplY3QgfHwgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qub2JzZXJ2ZSBjYW5ub3Qgb2JzZXJ2ZSBub24tb2JqZWN0XCIpO1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCBkZWxpdmVyIHRvIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgaWYgKE8uaXNGcm96ZW4gJiYgTy5pc0Zyb3plbihoYW5kbGVyKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5vYnNlcnZlIGNhbm5vdCBkZWxpdmVyIHRvIGEgZnJvemVuIGZ1bmN0aW9uIG9iamVjdFwiKTtcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBhY2NlcHRMaXN0ID09PSBcInVuZGVmaW5lZFwiKVxyXG4gICAgICAgICAgICBhY2NlcHRMaXN0ID0gZGVmYXVsdEFjY2VwdExpc3Q7XHJcbiAgICAgICAgZWxzZSBpZiAoIWFjY2VwdExpc3QgfHwgdHlwZW9mIGFjY2VwdExpc3QgIT09IFwib2JqZWN0XCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGlyZCBhcmd1bWVudCB0byBPYmplY3Qub2JzZXJ2ZSBtdXN0IGJlIGFuIGFycmF5IG9mIHN0cmluZ3MuXCIpO1xyXG5cclxuICAgICAgICBkb09ic2VydmUob2JqZWN0LCBoYW5kbGVyLCBhY2NlcHRMaXN0KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZnVuY3Rpb24gT2JqZWN0LnVub2JzZXJ2ZVxyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNPYmplY3QudW5vYnNlcnZlXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XHJcbiAgICAgKiBAcGFyYW0ge0hhbmRsZXJ9IGhhbmRsZXJcclxuICAgICAqIEB0aHJvd3Mge1R5cGVFcnJvcn1cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9ICAgICAgICAgVGhlIGdpdmVuIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBPLnVub2JzZXJ2ZSA9IGZ1bmN0aW9uIHVub2JzZXJ2ZShvYmplY3QsIGhhbmRsZXIpIHtcclxuICAgICAgICBpZiAob2JqZWN0ID09PSBudWxsIHx8IHR5cGVvZiBvYmplY3QgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG9iamVjdCAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LnVub2JzZXJ2ZSBjYW5ub3QgdW5vYnNlcnZlIG5vbi1vYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LnVub2JzZXJ2ZSBjYW5ub3QgZGVsaXZlciB0byBub24tZnVuY3Rpb25cIik7XHJcblxyXG4gICAgICAgIHZhciBoZGF0YSA9IGhhbmRsZXJzLmdldChoYW5kbGVyKSwgb2RhdGE7XHJcblxyXG4gICAgICAgIGlmIChoZGF0YSAmJiAob2RhdGEgPSBoZGF0YS5vYnNlcnZlZC5nZXQob2JqZWN0KSkpIHtcclxuICAgICAgICAgICAgaGRhdGEub2JzZXJ2ZWQuZm9yRWFjaChmdW5jdGlvbihvZGF0YSwgb2JqZWN0KSB7XHJcbiAgICAgICAgICAgICAgICBwZXJmb3JtUHJvcGVydHlDaGVja3Mob2RhdGEuZGF0YSwgb2JqZWN0KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIG5leHRGcmFtZShmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGRlbGl2ZXJIYW5kbGVyUmVjb3JkcyhoZGF0YSwgaGFuZGxlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8gSW4gRmlyZWZveCAxMy0xOCwgc2l6ZSBpcyBhIGZ1bmN0aW9uLCBidXQgY3JlYXRlTWFwIHNob3VsZCBmYWxsXHJcbiAgICAgICAgICAgIC8vIGJhY2sgdG8gdGhlIHNoaW0gZm9yIHRob3NlIHZlcnNpb25zXHJcbiAgICAgICAgICAgIGlmIChoZGF0YS5vYnNlcnZlZC5zaXplID09PSAxICYmIGhkYXRhLm9ic2VydmVkLmhhcyhvYmplY3QpKVxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcnNbXCJkZWxldGVcIl0oaGFuZGxlcik7XHJcbiAgICAgICAgICAgIGVsc2UgaGRhdGEub2JzZXJ2ZWRbXCJkZWxldGVcIl0ob2JqZWN0KTtcclxuXHJcbiAgICAgICAgICAgIGlmIChvZGF0YS5kYXRhLmhhbmRsZXJzLnNpemUgPT09IDEpXHJcbiAgICAgICAgICAgICAgICBvYnNlcnZlZFtcImRlbGV0ZVwiXShvYmplY3QpO1xyXG4gICAgICAgICAgICBlbHNlIG9kYXRhLmRhdGEuaGFuZGxlcnNbXCJkZWxldGVcIl0oaGFuZGxlcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gb2JqZWN0O1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBmdW5jdGlvbiBPYmplY3QuZ2V0Tm90aWZpZXJcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jR2V0Tm90aWZpZXJcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcclxuICAgICAqIEB0aHJvd3Mge1R5cGVFcnJvcn1cclxuICAgICAqIEByZXR1cm5zIHtOb3RpZmllcn1cclxuICAgICAqL1xyXG4gICAgTy5nZXROb3RpZmllciA9IGZ1bmN0aW9uIGdldE5vdGlmaWVyKG9iamVjdCkge1xyXG4gICAgICAgIGlmIChvYmplY3QgPT09IG51bGwgfHwgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QuZ2V0Tm90aWZpZXIgY2Fubm90IGdldE5vdGlmaWVyIG5vbi1vYmplY3RcIik7XHJcblxyXG4gICAgICAgIGlmIChPLmlzRnJvemVuICYmIE8uaXNGcm96ZW4ob2JqZWN0KSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgICAgIHJldHVybiByZXRyaWV2ZU5vdGlmaWVyKG9iamVjdCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQGZ1bmN0aW9uIE9iamVjdC5kZWxpdmVyQ2hhbmdlUmVjb3Jkc1xyXG4gICAgICogQHNlZSBodHRwOi8vYXJ2LmdpdGh1Yi5pby9lY21hc2NyaXB0LW9iamVjdC1vYnNlcnZlLyNPYmplY3QuZGVsaXZlckNoYW5nZVJlY29yZHNcclxuICAgICAqIEBzZWUgaHR0cDovL2Fydi5naXRodWIuaW8vZWNtYXNjcmlwdC1vYmplY3Qtb2JzZXJ2ZS8jRGVsaXZlckNoYW5nZVJlY29yZHNcclxuICAgICAqIEBwYXJhbSB7SGFuZGxlcn0gaGFuZGxlclxyXG4gICAgICogQHRocm93cyB7VHlwZUVycm9yfVxyXG4gICAgICovXHJcbiAgICBPLmRlbGl2ZXJDaGFuZ2VSZWNvcmRzID0gZnVuY3Rpb24gZGVsaXZlckNoYW5nZVJlY29yZHMoaGFuZGxlcikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0LmRlbGl2ZXJDaGFuZ2VSZWNvcmRzIGNhbm5vdCBkZWxpdmVyIHRvIG5vbi1mdW5jdGlvblwiKTtcclxuXHJcbiAgICAgICAgdmFyIGhkYXRhID0gaGFuZGxlcnMuZ2V0KGhhbmRsZXIpO1xyXG4gICAgICAgIGlmIChoZGF0YSkge1xyXG4gICAgICAgICAgICBoZGF0YS5vYnNlcnZlZC5mb3JFYWNoKGZ1bmN0aW9uKG9kYXRhLCBvYmplY3QpIHtcclxuICAgICAgICAgICAgICAgIHBlcmZvcm1Qcm9wZXJ0eUNoZWNrcyhvZGF0YS5kYXRhLCBvYmplY3QpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgZGVsaXZlckhhbmRsZXJSZWNvcmRzKGhkYXRhLCBoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxufSkoT2JqZWN0LCBBcnJheSwgdGhpcyk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9vYmplY3Qub2JzZXJ2ZS9kaXN0L29iamVjdC1vYnNlcnZlLmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL29iamVjdC5vYnNlcnZlL2Rpc3RcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBkZXB0aFN0cmluZyA9ICcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICc7XG5cbiAgICBmdW5jdGlvbiBEYXRhTm9kZUJhc2Uoa2V5KSB7XG4gICAgICAgIHRoaXMubGFiZWwgPSBrZXk7XG4gICAgICAgIHRoaXMuZGF0YSA9IFsnJ107XG4gICAgICAgIHRoaXMucm93SW5kZXhlcyA9IFtdO1xuICAgICAgICB0aGlzLmhhc0NoaWxkcmVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGVwdGggPSAwO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDE7XG4gICAgICAgIHRoaXMuZXhwYW5kZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmlzTnVsbE9iamVjdCA9IGZhbHNlO1xuXG4gICAgRGF0YU5vZGVCYXNlLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFbeF07XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUucHJ1bmUgPSBmdW5jdGlvbiAoZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aCA9IGRlcHRoO1xuICAgICAgICB0aGlzLmRhdGFbMF0gPSB0aGlzLmNvbXB1dGVEZXB0aFN0cmluZygpO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmNvbXB1dGVEZXB0aFN0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHN0cmluZyA9IGRlcHRoU3RyaW5nLnN1YnN0cmluZygwLCAyICsgKHRoaXMuZGVwdGggKiAzKSkgKyB0aGlzLmxhYmVsO1xuICAgICAgICByZXR1cm4gc3RyaW5nO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmNvbXB1dGVIZWlnaHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmdldEFsbFJvd0luZGV4ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJvd0luZGV4ZXM7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuY29tcHV0ZUFnZ3JlZ2F0ZXMgPSBmdW5jdGlvbiAoYWdncmVnYXRvcikge1xuICAgICAgICB0aGlzLmFwcGx5QWdncmVnYXRlcyhhZ2dyZWdhdG9yKTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVCYXNlLnByb3RvdHlwZS5hcHBseUFnZ3JlZ2F0ZXMgPSBmdW5jdGlvbiAoYWdncmVnYXRvcikge1xuICAgICAgICB2YXIgaW5kZXhlcyA9IHRoaXMuZ2V0QWxsUm93SW5kZXhlcygpO1xuICAgICAgICBpZiAoaW5kZXhlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gbm8gZGF0YSB0byByb2xsdXAgb25cbiAgICAgICAgfVxuICAgICAgICB2YXIgYWdncmVnYXRlcyA9IGFnZ3JlZ2F0b3IuYWdncmVnYXRlcztcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICAgIGRhdGEubGVuZ3RoID0gYWdncmVnYXRlcy5sZW5ndGggKyAxO1xuXG4gICAgICAgIHZhciBzb3J0ZXIgPSBhZ2dyZWdhdG9yLnNvcnRlckluc3RhbmNlO1xuICAgICAgICBzb3J0ZXIuaW5kZXhlcyA9IGluZGV4ZXM7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhZ2dyZWdhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgYWdncmVnYXRlID0gYWdncmVnYXRlc1tpXTtcbiAgICAgICAgICAgIGRhdGFbaSArIDFdID0gYWdncmVnYXRlKHNvcnRlcik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmJ1aWxkVmlldyA9IGZ1bmN0aW9uIChhZ2dyZWdhdG9yKSB7XG4gICAgICAgIGFnZ3JlZ2F0b3Iudmlldy5wdXNoKHRoaXMpO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLnRvZ2dsZUV4cGFuc2lvblN0YXRlID0gZnVuY3Rpb24gKCkgeyAvKiBhZ2dyZWdhdG9yICovXG4gICAgICAgIC8vZG8gbm90aGluZyBieSBkZWZhdWx0XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhTm9kZUJhc2U7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFOb2RlQmFzZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIE1hcCA9IHJlcXVpcmUoJy4vTWFwJyk7XG52YXIgRGF0YU5vZGVCYXNlID0gcmVxdWlyZSgnLi9EYXRhTm9kZUJhc2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIEV4cGFuZGVkTWFwID0ge1xuICAgICAgICB0cnVlOiAn4pa+JyxcbiAgICAgICAgZmFsc2U6ICfilrgnXG4gICAgfTtcbiAgICB2YXIgZGVwdGhTdHJpbmcgPSAnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnO1xuXG4gICAgZnVuY3Rpb24gRGF0YU5vZGVHcm91cChrZXkpIHtcbiAgICAgICAgRGF0YU5vZGVCYXNlLmNhbGwodGhpcywga2V5KTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IG5ldyBNYXAoKTtcbiAgICB9XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGF0YU5vZGVCYXNlLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5wcnVuZSA9IGZ1bmN0aW9uIChkZXB0aCkge1xuICAgICAgICB0aGlzLmRlcHRoID0gZGVwdGg7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuLnZhbHVlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY2hpbGQucHJ1bmUodGhpcy5kZXB0aCArIDEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGF0YVswXSA9IHRoaXMuY29tcHV0ZURlcHRoU3RyaW5nKCk7XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVEZXB0aFN0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGljb24gPSBFeHBhbmRlZE1hcFt0aGlzLmV4cGFuZGVkICsgJyddO1xuICAgICAgICB2YXIgc3RyaW5nID0gZGVwdGhTdHJpbmcuc3Vic3RyaW5nKDAsIHRoaXMuZGVwdGggKiAzKSArIGljb24gKyAnICcgKyB0aGlzLmxhYmVsO1xuICAgICAgICByZXR1cm4gc3RyaW5nO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5nZXRBbGxSb3dJbmRleGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5yb3dJbmRleGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5yb3dJbmRleGVzID0gdGhpcy5jb21wdXRlQWxsUm93SW5kZXhlcygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnJvd0luZGV4ZXM7XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVBbGxSb3dJbmRleGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIHZhciBjaGlsZEluZGV4ZXMgPSBjaGlsZC5nZXRBbGxSb3dJbmRleGVzKCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHJlc3VsdCwgW3Jlc3VsdC5sZW5ndGgsIDBdLmNvbmNhdChjaGlsZEluZGV4ZXMpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS50b2dnbGVFeHBhbnNpb25TdGF0ZSA9IGZ1bmN0aW9uIChhZ2dyZWdhdG9yKSB7IC8qIGFnZ3JlZ2F0b3IgKi9cbiAgICAgICAgdGhpcy5leHBhbmRlZCA9ICF0aGlzLmV4cGFuZGVkO1xuICAgICAgICB0aGlzLmRhdGFbMF0gPSB0aGlzLmNvbXB1dGVEZXB0aFN0cmluZygpO1xuICAgICAgICBpZiAodGhpcy5leHBhbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5jb21wdXRlQWdncmVnYXRlcyhhZ2dyZWdhdG9yKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5jb21wdXRlQWdncmVnYXRlcyA9IGZ1bmN0aW9uIChhZ2dyZWdhdG9yKSB7XG4gICAgICAgIHRoaXMuYXBwbHlBZ2dyZWdhdGVzKGFnZ3JlZ2F0b3IpO1xuICAgICAgICBpZiAoIXRoaXMuZXhwYW5kZWQpIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gd2VyZSBub3QgYmVpbmcgdmlld2VkLCBkb24ndCBoYXZlIGNoaWxkIG5vZGVzIGRvIGNvbXB1dGF0aW9uO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbltpXS5jb21wdXRlQWdncmVnYXRlcyhhZ2dyZWdhdG9yKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5idWlsZFZpZXcgPSBmdW5jdGlvbiAoYWdncmVnYXRvcikge1xuICAgICAgICBhZ2dyZWdhdG9yLnZpZXcucHVzaCh0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuZXhwYW5kZWQpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgY2hpbGQuYnVpbGRWaWV3KGFnZ3JlZ2F0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVIZWlnaHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBoZWlnaHQgPSAxOyAvL0knbSAxIGhpZ2hcbiAgICAgICAgaWYgKCF0aGlzLmV4cGFuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLmhlaWdodCA9IDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBoZWlnaHQgKyB0aGlzLmNoaWxkcmVuW2ldLmNvbXB1dGVIZWlnaHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmhlaWdodDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFOb2RlR3JvdXA7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFOb2RlR3JvdXAuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBEYXRhTm9kZUJhc2UgPSByZXF1aXJlKCcuL0RhdGFOb2RlQmFzZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhTm9kZUxlYWYoa2V5KSB7XG4gICAgICAgIERhdGFOb2RlQmFzZS5jYWxsKHRoaXMsIGtleSk7XG4gICAgfVxuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGF0YU5vZGVCYXNlLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZUxlYWYucHJvdG90eXBlLnBydW5lID0gZnVuY3Rpb24gKGRlcHRoKSB7XG4gICAgICAgIHRoaXMuZGVwdGggPSBkZXB0aDtcbiAgICAgICAgdGhpcy5kYXRhWzBdID0gdGhpcy5jb21wdXRlRGVwdGhTdHJpbmcoKTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZS5jb21wdXRlSGVpZ2h0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gMTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZS5nZXRBbGxSb3dJbmRleGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yb3dJbmRleGVzO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUxlYWYucHJvdG90eXBlLmNvbXB1dGVBZ2dyZWdhdGVzID0gZnVuY3Rpb24gKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgdGhpcy5hcHBseUFnZ3JlZ2F0ZXMoYWdncmVnYXRvcik7XG4gICAgfTtcblxuICAgIERhdGFOb2RlTGVhZi5wcm90b3R5cGUuYnVpbGRWaWV3ID0gZnVuY3Rpb24gKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgYWdncmVnYXRvci52aWV3LnB1c2godGhpcyk7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhTm9kZUxlYWY7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFOb2RlTGVhZi5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIERhdGFOb2RlR3JvdXAgPSByZXF1aXJlKCcuL0RhdGFOb2RlR3JvdXAnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gRGF0YU5vZGVUcmVlKGtleSkge1xuICAgICAgICBEYXRhTm9kZUdyb3VwLmNhbGwodGhpcywga2V5KTtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAwO1xuICAgICAgICB0aGlzLmV4cGFuZGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhTm9kZUdyb3VwLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlLnBydW5lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gdGhpcy5jaGlsZHJlbi52YWx1ZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGNoaWxkLnBydW5lKDApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERhdGFOb2RlVHJlZS5wcm90b3R5cGUuYnVpbGRWaWV3ID0gZnVuY3Rpb24gKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY2hpbGQuYnVpbGRWaWV3KGFnZ3JlZ2F0b3IpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERhdGFOb2RlVHJlZS5wcm90b3R5cGUuY29tcHV0ZUhlaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGhlaWdodCA9IDA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaGVpZ2h0ID0gaGVpZ2h0ICsgdGhpcy5jaGlsZHJlbltpXS5jb21wdXRlSGVpZ2h0KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaGVpZ2h0O1xuICAgIH07XG5cblxuICAgIHJldHVybiBEYXRhTm9kZVRyZWU7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFOb2RlVHJlZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIERhdGFTb3VyY2VTb3J0ZXIgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VTb3J0ZXInKTtcbnZhciBEYXRhTm9kZVRyZWUgPSByZXF1aXJlKCcuL0RhdGFOb2RlVHJlZScpO1xudmFyIERhdGFOb2RlR3JvdXAgPSByZXF1aXJlKCcuL0RhdGFOb2RlR3JvdXAnKTtcbnZhciBEYXRhTm9kZUxlYWYgPSByZXF1aXJlKCcuL0RhdGFOb2RlTGVhZicpO1xudmFyIERhdGFOb2RlTGVhZiA9IHJlcXVpcmUoJy4vRGF0YU5vZGVMZWFmJyk7XG52YXIgQWdncmVnYXRpb25zID0gcmVxdWlyZSgnLi9hZ2dyZWdhdGlvbnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGhlYWRlcmlmeSA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgdmFyIHBpZWNlcyA9IHN0cmluZy5yZXBsYWNlKC9bXy1dL2csICcgJykucmVwbGFjZSgvW0EtWl0vZywgJyAkJicpLnNwbGl0KCcgJykubWFwKGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgICByZXR1cm4gKHMuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzLnNsaWNlKDEpKS50cmltKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBwaWVjZXMgPSBwaWVjZXMuZmlsdGVyKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZS5sZW5ndGggIT09IDA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcGllY2VzLmpvaW4oJyAnKS50cmltKCk7XG4gICAgfTtcblxuICAgIC8vP1t0LGMsYixhXVxuICAgIC8vIHQgaXMgYSBkYXRhU291cmNlLFxuICAgIC8vIGEgaXMgYSBkaWNpdGlvbmFyeSBvZiBhZ2dyZWdhdGVzLCAgY29sdW1uTmFtZTpmdW5jdGlvblxuICAgIC8vIGIgaXMgYSBkaWNpdGlvbmFyeSBvZiBncm91cGJ5cywgY29sdW1uTmFtZTpzb3VyY2VDb2x1bW5OYW1lXG4gICAgLy8gYyBpcyBhIGxpc3Qgb2YgY29uc3RyYWludHMsXG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlQWdncmVnYXRvcihkYXRhU291cmNlKSB7XG4gICAgICAgIHRoaXMudHJlZSA9IG5ldyBEYXRhTm9kZVRyZWUoJ3Jvb3QnKTtcbiAgICAgICAgdGhpcy5pbmRleGVzID0gW107XG4gICAgICAgIHRoaXMuZGF0YVNvdXJjZSA9IGRhdGFTb3VyY2U7XG4gICAgICAgIHRoaXMuYWdncmVnYXRlcyA9IFtdO1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5ncm91cEJ5cyA9IFtdO1xuICAgICAgICB0aGlzLnZpZXcgPSBbXTtcbiAgICAgICAgdGhpcy5zb3J0ZXJJbnN0YW5jZSA9IHt9O1xuICAgICAgICB0aGlzLnByZXNvcnRHcm91cHMgPSB0cnVlO1xuICAgICAgICB0aGlzLmxhc3RBZ2dyZWdhdGUgPSB7fTtcbiAgICAgICAgdGhpcy5zZXRBZ2dyZWdhdGVzKHt9KTtcbiAgICB9XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuaXNOdWxsT2JqZWN0ID0gZmFsc2U7XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuc2V0QWdncmVnYXRlcyA9IGZ1bmN0aW9uKGFnZ3JlZ2F0aW9ucykge1xuICAgICAgICB0aGlzLmxhc3RBZ2dyZWdhdGUgPSBhZ2dyZWdhdGlvbnM7XG4gICAgICAgIHZhciBwcm9wcyA9IFtdO1xuICAgICAgICB2YXIgaTtcbiAgICAgICAgdGhpcy5jbGVhckFnZ3JlZ2F0aW9ucygpO1xuICAgICAgICB0aGlzLmhlYWRlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gYWdncmVnYXRpb25zKSB7XG4gICAgICAgICAgICBwcm9wcy5wdXNoKFtrZXksIGFnZ3JlZ2F0aW9uc1trZXldXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvcHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB2YXIgZmllbGRzID0gW10uY29uY2F0KHRoaXMuZGF0YVNvdXJjZS5nZXRGaWVsZHMoKSk7XG4gICAgICAgICAgICBmaWVsZHMuc2hpZnQoKTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKFtmaWVsZHNbaV0sIEFnZ3JlZ2F0aW9ucy5maXJzdChpKV0pOyAvKiBqc2hpbnQgaWdub3JlOmxpbmUgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuaGFzR3JvdXBzKCkpIHtcbiAgICAgICAgICAgIHRoaXMuaGVhZGVycy5wdXNoKCdUcmVlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBhZ2cgPSBwcm9wc1tpXTtcbiAgICAgICAgICAgIHRoaXMuaGVhZGVycy5wdXNoKGhlYWRlcmlmeShhZ2dbMF0pKTtcbiAgICAgICAgICAgIHRoaXMuYWdncmVnYXRlcy5wdXNoKGFnZ1sxXSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLnNldEdyb3VwQnlzID0gZnVuY3Rpb24gKGNvbHVtbkluZGV4QXJyYXkpIHtcbiAgICAgICAgdGhpcy5ncm91cEJ5cy5sZW5ndGggPSAwO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbHVtbkluZGV4QXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuZ3JvdXBCeXMucHVzaChjb2x1bW5JbmRleEFycmF5W2ldKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNldEFnZ3JlZ2F0ZXModGhpcy5sYXN0QWdncmVnYXRlKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmhhc0dyb3VwcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3JvdXBCeXMubGVuZ3RoID4gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmhhc0FnZ3JlZ2F0ZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFnZ3JlZ2F0ZXMubGVuZ3RoID4gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmJ1aWxkR3JvdXBUcmVlKCk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5jbGVhckdyb3VwcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5ncm91cEJ5cy5sZW5ndGggPSAwO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuY2xlYXJBZ2dyZWdhdGlvbnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuYWdncmVnYXRlcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmhlYWRlcnMubGVuZ3RoID0gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmJ1aWxkR3JvdXBUcmVlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYywgciwgZywgdmFsdWUsIGNyZWF0ZUZ1bmM7XG4gICAgICAgIHZhciBjcmVhdGVCcmFuY2ggPSBmdW5jdGlvbiAoa2V5LCBtYXApIHtcbiAgICAgICAgICAgIHZhbHVlID0gbmV3IERhdGFOb2RlR3JvdXAoa2V5KTtcbiAgICAgICAgICAgIG1hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBjcmVhdGVMZWFmID0gZnVuY3Rpb24gKGtleSwgbWFwKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ldyBEYXRhTm9kZUxlYWYoa2V5KTtcbiAgICAgICAgICAgIG1hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBncm91cEJ5cyA9IHRoaXMuZ3JvdXBCeXM7XG4gICAgICAgIHZhciBzb3VyY2UgPSB0aGlzLmRhdGFTb3VyY2U7XG4gICAgICAgIHZhciByb3dDb3VudCA9IHNvdXJjZS5nZXRSb3dDb3VudCgpO1xuXG4gICAgICAgIC8vIGxldHMgc29ydCBvdXIgZGF0YSBmaXJzdC4uLi5cbiAgICAgICAgaWYgKHRoaXMucHJlc29ydEdyb3Vwcykge1xuICAgICAgICAgICAgZm9yIChjID0gMDsgYyA8IGdyb3VwQnlzLmxlbmd0aDsgYysrKSB7XG4gICAgICAgICAgICAgICAgZyA9IGdyb3VwQnlzW2dyb3VwQnlzLmxlbmd0aCAtIGMgLSAxXTtcbiAgICAgICAgICAgICAgICBzb3VyY2UgPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihzb3VyY2UpO1xuICAgICAgICAgICAgICAgIHNvdXJjZS5zb3J0T24oZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdHJlZSA9IHRoaXMudHJlZSA9IG5ldyBEYXRhTm9kZVRyZWUoJ3Jvb3QnKTtcbiAgICAgICAgdmFyIHBhdGggPSB0cmVlO1xuICAgICAgICB2YXIgbGVhZkRlcHRoID0gZ3JvdXBCeXMubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yIChyID0gMDsgciA8IHJvd0NvdW50OyByKyspIHtcbiAgICAgICAgICAgIGZvciAoYyA9IDA7IGMgPCBncm91cEJ5cy5sZW5ndGg7IGMrKykge1xuICAgICAgICAgICAgICAgIGcgPSBncm91cEJ5c1tjXTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNvdXJjZS5nZXRWYWx1ZShnLCByKTtcblxuICAgICAgICAgICAgICAgIC8vdGVzdCB0aGF0IEknbSBub3QgYSBsZWFmXG4gICAgICAgICAgICAgICAgY3JlYXRlRnVuYyA9IChjID09PSBsZWFmRGVwdGgpID8gY3JlYXRlTGVhZiA6IGNyZWF0ZUJyYW5jaDtcbiAgICAgICAgICAgICAgICBwYXRoID0gcGF0aC5jaGlsZHJlbi5nZXRJZkFic2VudCh2YWx1ZSwgY3JlYXRlRnVuYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXRoLnJvd0luZGV4ZXMucHVzaChyKTtcbiAgICAgICAgICAgIHBhdGggPSB0cmVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc29ydGVySW5zdGFuY2UgPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihzb3VyY2UpO1xuICAgICAgICB0cmVlLnBydW5lKCk7XG4gICAgICAgIHRoaXMudHJlZS5jb21wdXRlQWdncmVnYXRlcyh0aGlzKTtcbiAgICAgICAgdGhpcy5idWlsZFZpZXcoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmJ1aWxkVmlldyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy52aWV3Lmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMudHJlZS5jb21wdXRlSGVpZ2h0KCk7XG4gICAgICAgIHRoaXMudHJlZS5idWlsZFZpZXcodGhpcyk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgICAgIHZhciByb3cgPSB0aGlzLnZpZXdbeV07XG4gICAgICAgIGlmICghcm93KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcm93LmdldFZhbHVlKHgpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuZ2V0Q29sdW1uQ291bnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjb2xDb3VudCA9IHRoaXMuZ2V0SGVhZGVycygpLmxlbmd0aDsgLy8gMSBpcyBmb3IgdGhlIGhpZXJhcmNoeSBjb2x1bW5cbiAgICAgICAgcmV0dXJuIGNvbENvdW50O1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZpZXcubGVuZ3RoOyAvL2hlYWRlciBjb2x1bW5cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmNsaWNrID0gZnVuY3Rpb24gKHkpIHtcbiAgICAgICAgdmFyIGdyb3VwID0gdGhpcy52aWV3W3ldO1xuICAgICAgICBncm91cC50b2dnbGVFeHBhbnNpb25TdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5idWlsZFZpZXcoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldEhlYWRlcnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRlcnM7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5zZXRIZWFkZXJzID0gZnVuY3Rpb24gKGhlYWRlcnMpIHtcbiAgICAgICAgdGhpcy5kYXRhU291cmNlLnNldEhlYWRlcnMoaGVhZGVycyk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRGaWVsZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldEhlYWRlcnMoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldEdyYW5kVG90YWxzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdmlldyA9IHRoaXMudmlld1swXTtcbiAgICAgICAgdmFyIHJvd0NvdW50ID0gdGhpcy5nZXRSb3dDb3VudCgpO1xuICAgICAgICBpZiAoIXZpZXcgfHwgcm93Q291bnQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW3ZpZXcuZGF0YV07XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRSb3cgPSBmdW5jdGlvbiAoeSkge1xuICAgICAgICB2YXIgcm93SW5kZXhlcyA9IHRoaXMudmlld1t5XS5yb3dJbmRleGVzO1xuICAgICAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KHJvd0luZGV4ZXMubGVuZ3RoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93KHJvd0luZGV4ZXNbaV0pO1xuICAgICAgICAgICAgcmVzdWx0W2ldID0gb2JqZWN0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5zZXREYXRhID0gZnVuY3Rpb24gKGFycmF5T2ZVbmlmb3JtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc2V0RGF0YShhcnJheU9mVW5pZm9ybU9iamVjdHMpO1xuICAgICAgICB0aGlzLmFwcGx5KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlQWdncmVnYXRvcjtcblxufSkoKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlQWdncmVnYXRvci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gRGF0YVNvdXJjZURlY29yYXRvcihkYXRhU291cmNlKSB7XG4gICAgICAgIHRoaXMuZGF0YVNvdXJjZSA9IGRhdGFTb3VyY2U7XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IFtdO1xuICAgIH1cblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmlzTnVsbE9iamVjdCA9IGZhbHNlO1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUudHJhbnNwb3NlWSA9IGZ1bmN0aW9uICh5KSB7XG4gICAgICAgIGlmICh0aGlzLmluZGV4ZXMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbmRleGVzW3ldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB5O1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZGF0YVNvdXJjZS5nZXRWYWx1ZSh4LCB0aGlzLnRyYW5zcG9zZVkoeSkpO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmdldFJvdyA9IGZ1bmN0aW9uICh5KSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVNvdXJjZS5nZXRSb3codGhpcy50cmFuc3Bvc2VZKHkpKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuc2V0VmFsdWUgPSBmdW5jdGlvbiAoeCwgeSwgdmFsdWUpIHtcblxuICAgICAgICB0aGlzLmRhdGFTb3VyY2Uuc2V0VmFsdWUoeCwgdGhpcy50cmFuc3Bvc2VZKHkpLCB2YWx1ZSk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmdldENvbHVtbkNvdW50ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0Q29sdW1uQ291bnQoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0RmllbGRzID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0RmllbGRzKCk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLnNldEZpZWxkcyA9IGZ1bmN0aW9uIChmaWVsZHMpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLnNldEZpZWxkcyhmaWVsZHMpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRSb3dDb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhlcy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmluZGV4ZXMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93Q291bnQoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuc2V0SGVhZGVycyA9IGZ1bmN0aW9uIChoZWFkZXJzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2Uuc2V0SGVhZGVycyhoZWFkZXJzKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0SGVhZGVycyA9IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLmdldEhlYWRlcnMoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0R3JhbmRUb3RhbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vbm90aGluZyBoZXJlXG4gICAgICAgIHJldHVybjtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuaW5pdGlhbGl6ZUluZGV4VmVjdG9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcm93Q291bnQgPSB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgdmFyIGluZGV4VmVjdG9yID0gbmV3IEFycmF5KHJvd0NvdW50KTtcbiAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCByb3dDb3VudDsgcisrKSB7XG4gICAgICAgICAgICBpbmRleFZlY3RvcltyXSA9IHI7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pbmRleGVzID0gaW5kZXhWZWN0b3I7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLnNldERhdGEgPSBmdW5jdGlvbiAoYXJyYXlPZlVuaWZvcm1PYmplY3RzKSB7XG4gICAgICAgIHRoaXMuZGF0YVNvdXJjZS5zZXREYXRhKGFycmF5T2ZVbmlmb3JtT2JqZWN0cyk7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlRGVjb3JhdG9yO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlRGVjb3JhdG9yLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YVNvdXJjZURlY29yYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZURlY29yYXRvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlRmlsdGVyKGRhdGFTb3VyY2UpIHtcbiAgICAgICAgRGF0YVNvdXJjZURlY29yYXRvci5jYWxsKHRoaXMsIGRhdGFTb3VyY2UsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5maWx0ZXJzID0gW107XG4gICAgfVxuXG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlKTtcblxuICAgIERhdGFTb3VyY2VGaWx0ZXIucHJvdG90eXBlLmFkZEZpbHRlciA9IGZ1bmN0aW9uIChjb2x1bW5JbmRleCwgZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlci5jb2x1bW5JbmRleCA9IGNvbHVtbkluZGV4O1xuICAgICAgICB0aGlzLmZpbHRlcnMucHVzaChmaWx0ZXIpO1xuICAgIH07XG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUuc2V0RmlsdGVyID0gZnVuY3Rpb24gKGNvbHVtbkluZGV4LCBmaWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyLmNvbHVtbkluZGV4ID0gY29sdW1uSW5kZXg7XG4gICAgICAgIHRoaXMuZmlsdGVycy5wdXNoKGZpbHRlcik7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VGaWx0ZXIucHJvdG90eXBlLmNsZWFyRmlsdGVycyA9IGZ1bmN0aW9uICgpIHsgLyogZmlsdGVyICovXG4gICAgICAgIHRoaXMuZmlsdGVycy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmluZGV4ZXMubGVuZ3RoID0gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUuYXBwbHlGaWx0ZXJzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5maWx0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5pbmRleGVzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgICAgIGluZGV4ZXMubGVuZ3RoID0gMDtcbiAgICAgICAgdmFyIGNvdW50ID0gdGhpcy5kYXRhU291cmNlLmdldFJvd0NvdW50KCk7XG4gICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgY291bnQ7IHIrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbHlGaWx0ZXJzVG8ocikpIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2gocik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUuYXBwbHlGaWx0ZXJzVG8gPSBmdW5jdGlvbiAocikge1xuICAgICAgICB2YXIgZmlsdGVycyA9IHRoaXMuZmlsdGVycztcbiAgICAgICAgdmFyIGlzRmlsdGVyZWQgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBmID0gMDsgZiA8IGZpbHRlcnMubGVuZ3RoOyBmKyspIHtcbiAgICAgICAgICAgIHZhciBmaWx0ZXIgPSBmaWx0ZXJzW2ZdO1xuICAgICAgICAgICAgdmFyIHJvd09iamVjdCA9IHRoaXMuZGF0YVNvdXJjZS5nZXRSb3cocik7XG4gICAgICAgICAgICBpc0ZpbHRlcmVkID0gaXNGaWx0ZXJlZCAmJiBmaWx0ZXIodGhpcy5kYXRhU291cmNlLmdldFZhbHVlKGZpbHRlci5jb2x1bW5JbmRleCwgciksIHJvd09iamVjdCwgcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlzRmlsdGVyZWQ7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlRmlsdGVyO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlRmlsdGVyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YVNvdXJjZURlY29yYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZURlY29yYXRvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlR2xvYmFsRmlsdGVyKGRhdGFTb3VyY2UpIHtcbiAgICAgICAgRGF0YVNvdXJjZURlY29yYXRvci5jYWxsKHRoaXMsIGRhdGFTb3VyY2UsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5maWx0ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIERhdGFTb3VyY2VHbG9iYWxGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyLnByb3RvdHlwZS5zZXRGaWx0ZXIgPSBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMuZmlsdGVyID0gZmlsdGVyO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyLnByb3RvdHlwZS5jbGVhckZpbHRlcnMgPSBmdW5jdGlvbiAoKSB7IC8qIGZpbHRlciAqL1xuICAgICAgICB0aGlzLmZpbHRlciA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyLnByb3RvdHlwZS5hcHBseUZpbHRlcnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5maWx0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBpbmRleGVzID0gdGhpcy5pbmRleGVzO1xuICAgICAgICBpbmRleGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIHZhciBjb3VudCA9IHRoaXMuZGF0YVNvdXJjZS5nZXRSb3dDb3VudCgpO1xuICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IGNvdW50OyByKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGx5RmlsdGVyVG8ocikpIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzLnB1c2gocik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUdsb2JhbEZpbHRlci5wcm90b3R5cGUuYXBwbHlGaWx0ZXJUbyA9IGZ1bmN0aW9uIChyKSB7XG4gICAgICAgIHZhciBpc0ZpbHRlcmVkID0gZmFsc2U7XG4gICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmZpbHRlcjtcbiAgICAgICAgdmFyIGNvbENvdW50ID0gdGhpcy5nZXRDb2x1bW5Db3VudCgpO1xuICAgICAgICB2YXIgcm93T2JqZWN0ID0gdGhpcy5kYXRhU291cmNlLmdldFJvdyhyKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2xDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBpc0ZpbHRlcmVkID0gaXNGaWx0ZXJlZCB8fCBmaWx0ZXIodGhpcy5kYXRhU291cmNlLmdldFZhbHVlKGksIHIpLCByb3dPYmplY3QsIHIpO1xuICAgICAgICAgICAgaWYgKGlzRmlsdGVyZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlR2xvYmFsRmlsdGVyO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlR2xvYmFsRmlsdGVyLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzLmpzJyk7XG52YXIgRGF0YVNvdXJjZURlY29yYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZURlY29yYXRvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlU29ydGVyKGRhdGFTb3VyY2UpIHtcbiAgICAgICAgRGF0YVNvdXJjZURlY29yYXRvci5jYWxsKHRoaXMsIGRhdGFTb3VyY2UpO1xuICAgICAgICB0aGlzLmRlc2NlbmRpbmdTb3J0ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgRGF0YVNvdXJjZVNvcnRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlKTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXIucHJvdG90eXBlLnNvcnRPbiA9IGZ1bmN0aW9uIChjb2x1bW5JbmRleCwgc29ydFR5cGUpIHtcbiAgICAgICAgaWYgKHNvcnRUeXBlID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmluZGV4ZXMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmluaXRpYWxpemVJbmRleFZlY3RvcigpO1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIFV0aWxzLnN0YWJsZVNvcnQodGhpcy5pbmRleGVzLCBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmRhdGFTb3VyY2UuZ2V0VmFsdWUoY29sdW1uSW5kZXgsIGluZGV4KTtcbiAgICAgICAgfSwgc29ydFR5cGUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YVNvdXJjZVNvcnRlcjtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YVNvdXJjZVNvcnRlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIERhdGFTb3VyY2VEZWNvcmF0b3IgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VEZWNvcmF0b3InKTtcbnZhciBEYXRhU291cmNlU29ydGVyID0gcmVxdWlyZSgnLi9EYXRhU291cmNlU29ydGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUoZGF0YVNvdXJjZSkge1xuICAgICAgICBEYXRhU291cmNlRGVjb3JhdG9yLmNhbGwodGhpcywgZGF0YVNvdXJjZSk7XG4gICAgICAgIHRoaXMuc29ydHMgPSBbXTtcbiAgICAgICAgdGhpcy5sYXN0ID0gdGhpcy5kYXRhU291cmNlO1xuICAgIH1cblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLnByb3RvdHlwZS5zb3J0T24gPSBmdW5jdGlvbiAoY29sdW1uSW5kZXgsIHNvcnRUeXBlKSB7XG4gICAgICAgIHRoaXMuc29ydHMucHVzaChbY29sdW1uSW5kZXgsIHNvcnRUeXBlXSk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlLmFwcGx5U29ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzb3J0cyA9IHRoaXMuc29ydHM7XG4gICAgICAgIHZhciBlYWNoID0gdGhpcy5kYXRhU291cmNlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNvcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgc29ydCA9IHNvcnRzW2ldO1xuICAgICAgICAgICAgZWFjaCA9IG5ldyBEYXRhU291cmNlU29ydGVyKGVhY2gpO1xuICAgICAgICAgICAgZWFjaC5zb3J0T24oc29ydFswXSwgc29ydFsxXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sYXN0ID0gZWFjaDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZS5wcm90b3R5cGUuY2xlYXJTb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zb3J0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmxhc3QgPSB0aGlzLmRhdGFTb3VyY2U7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24gKHgsIHkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGFzdC5nZXRWYWx1ZSh4LCB5KTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZS5wcm90b3R5cGUuc2V0VmFsdWUgPSBmdW5jdGlvbiAoeCwgeSwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5sYXN0LnNldFZhbHVlKHgsIHksIHZhbHVlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGU7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBoZWFkZXJpZnkgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIHZhciBwaWVjZXMgPSBzdHJpbmcucmVwbGFjZSgvW18tXS9nLCAnICcpLnJlcGxhY2UoL1tBLVpdL2csICcgJCYnKS5zcGxpdCgnICcpLm1hcChmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgcmV0dXJuIHMuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzLnNsaWNlKDEpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHBpZWNlcy5qb2luKCcgJyk7XG4gICAgfTtcblxuICAgIHZhciBjb21wdXRlRmllbGROYW1lcyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgICAgaWYgKCFvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZmllbGRzID0gW10uY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iamVjdCkuZmlsdGVyKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZS5zdWJzdHIoMCwgMikgIT09ICdfXyc7XG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIGZpZWxkcztcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gSlNEYXRhU291cmNlKGRhdGEsIGZpZWxkcykge1xuICAgICAgICB0aGlzLmZpZWxkcyA9IGZpZWxkcyB8fCBjb21wdXRlRmllbGROYW1lcyhkYXRhWzBdKTtcbiAgICAgICAgdGhpcy5oZWFkZXJzID0gW107XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfVxuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5pc051bGxPYmplY3QgPSBmYWxzZTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgICAgICBpZiAoeCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiB5O1xuICAgICAgICB9XG4gICAgICAgIHZhciByb3cgPSB0aGlzLmRhdGFbeV07XG4gICAgICAgIGlmICghcm93KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdmFsdWUgPSByb3dbdGhpcy5maWVsZHNbeF1dO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Um93ID0gZnVuY3Rpb24gKHkpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhW3ldO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24gKHgsIHksIHZhbHVlKSB7XG5cbiAgICAgICAgdGhpcy5kYXRhW3ldW3RoaXMuZmllbGRzW3hdXSA9IHZhbHVlO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLmdldENvbHVtbkNvdW50ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmdldEhlYWRlcnMoKS5sZW5ndGg7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0RmllbGRzID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmZpZWxkcztcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRIZWFkZXJzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuaGVhZGVycyB8fCB0aGlzLmhlYWRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmhlYWRlcnMgPSB0aGlzLmdldERlZmF1bHRIZWFkZXJzKCkubWFwKGZ1bmN0aW9uIChlYWNoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcmlmeShlYWNoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRlcnM7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0RGVmYXVsdEhlYWRlcnMgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0RmllbGRzKCk7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuc2V0RmllbGRzID0gZnVuY3Rpb24gKGZpZWxkcykge1xuXG4gICAgICAgIHRoaXMuZmllbGRzID0gZmllbGRzO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLnNldEhlYWRlcnMgPSBmdW5jdGlvbiAoaGVhZGVycykge1xuXG4gICAgICAgIHRoaXMuaGVhZGVycyA9IGhlYWRlcnM7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0R3JhbmRUb3RhbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vbm90aGluZyBoZXJlXG4gICAgICAgIHJldHVybjtcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5zZXREYXRhID0gZnVuY3Rpb24gKGFycmF5T2ZVbmlmb3JtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmRhdGEgPSBhcnJheU9mVW5pZm9ybU9iamVjdHM7XG4gICAgfTtcblxuICAgIHJldHVybiBKU0RhdGFTb3VyY2U7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0pTRGF0YVNvdXJjZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIG9pZFByZWZpeCA9ICcufi4jJV8nOyAvL3RoaXMgc2hvdWxkIGJlIHNvbWV0aGluZyB3ZSBuZXZlciB3aWxsIHNlZSBhdCB0aGUgYmVnaW5pbmcgb2YgYSBzdHJpbmdcbiAgICB2YXIgY291bnRlciA9IDA7XG5cbiAgICB2YXIgaGFzaCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgdmFyIHR5cGVPZiA9IHR5cGVvZiBrZXk7XG4gICAgICAgIHN3aXRjaCAodHlwZU9mKSB7XG4gICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICByZXR1cm4gb2lkUHJlZml4ICsgdHlwZU9mICsgJ18nICsga2V5O1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIG9pZFByZWZpeCArIHR5cGVPZiArICdfJyArIGtleTtcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICByZXR1cm4gb2lkUHJlZml4ICsgdHlwZU9mICsgJ18nICsga2V5O1xuICAgICAgICBjYXNlICdzeW1ib2wnOlxuICAgICAgICAgICAgcmV0dXJuIG9pZFByZWZpeCArIHR5cGVPZiArICdfJyArIGtleTtcbiAgICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgICAgIHJldHVybiBvaWRQcmVmaXggKyAndW5kZWZpbmVkJztcbiAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgIC8qZXNsaW50LWRpc2FibGUgKi9cbiAgICAgICAgICAgIGlmIChrZXkuX19fZmluaGFzaCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXkuX19fZmluaGFzaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGtleS5fX19maW5oYXNoID0gb2lkUHJlZml4ICsgY291bnRlcisrO1xuICAgICAgICAgICAgcmV0dXJuIGtleS5fX19maW5oYXNoO1xuICAgICAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICAgICAgICBpZiAoa2V5Ll9fX2Zpbmhhc2gpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ga2V5Ll9fX2Zpbmhhc2g7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBrZXkuX19fZmluaGFzaCA9IG9pZFByZWZpeCArIGNvdW50ZXIrKztcbiAgICAgICAgICAgIHJldHVybiBrZXkuX19fZmluaGFzaDsgLyplc2xpbnQtZW5hYmxlICovXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0LmlzIHBvbHlmaWxsLCBjb3VydGVzeSBvZiBAV2ViUmVmbGVjdGlvblxuICAgIHZhciBpcyA9IE9iamVjdC5pcyB8fFxuICAgIGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhID09PSBiID8gYSAhPT0gMCB8fCAxIC8gYSA9PSAxIC8gYiA6IGEgIT0gYSAmJiBiICE9IGI7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICB9O1xuXG4gICAgLy8gTW9yZSByZWxpYWJsZSBpbmRleE9mLCBjb3VydGVzeSBvZiBAV2ViUmVmbGVjdGlvblxuICAgIHZhciBiZXR0ZXJJbmRleE9mID0gZnVuY3Rpb24gKGFyciwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9IHZhbHVlIHx8IHZhbHVlID09PSAwKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSBhcnIubGVuZ3RoOyBpLS0gJiYgIWlzKGFycltpXSwgdmFsdWUpOykgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpID0gW10uaW5kZXhPZi5jYWxsKGFyciwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBNYXBweSgpIHtcbiAgICAgICAgdGhpcy5rZXlzID0gW107XG4gICAgICAgIHRoaXMuZGF0YSA9IHt9O1xuICAgICAgICB0aGlzLnZhbHVlcyA9IFtdO1xuICAgIH1cblxuICAgIE1hcHB5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICB2YXIgaGFzaENvZGUgPSBoYXNoKGtleSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFbaGFzaENvZGVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5cy5wdXNoKGtleSk7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRhdGFbaGFzaENvZGVdID0gdmFsdWU7XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHZhciBoYXNoQ29kZSA9IGhhc2goa2V5KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVtoYXNoQ29kZV07XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5nZXRJZkFic2VudCA9IGZ1bmN0aW9uIChrZXksIGlmQWJzZW50RnVuYykge1xuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdmFsdWUgPSBpZkFic2VudEZ1bmMoa2V5LCB0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5rZXlzLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgTWFwcHkucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmtleXMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5kYXRhID0ge307XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHZhciBoYXNoQ29kZSA9IGhhc2goa2V5KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVtoYXNoQ29kZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBpbmRleCA9IGJldHRlckluZGV4T2YodGhpcy5rZXlzLCBrZXkpO1xuICAgICAgICB0aGlzLmtleXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdGhpcy52YWx1ZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuZGF0YVtoYXNoQ29kZV07XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICAgICAgdmFyIGtleXMgPSB0aGlzLmtleXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgZnVuYyh2YWx1ZSwga2V5LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICAgICAgdmFyIGtleXMgPSB0aGlzLmtleXM7XG4gICAgICAgIHZhciBuZXdNYXAgPSBuZXcgTWFwcHkoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICB2YXIgdHJhbnNmb3JtZWQgPSBmdW5jKHZhbHVlLCBrZXksIHRoaXMpO1xuICAgICAgICAgICAgbmV3TWFwLnNldChrZXksIHRyYW5zZm9ybWVkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3TWFwO1xuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGtleXMgPSB0aGlzLmtleXM7XG4gICAgICAgIHZhciBuZXdNYXAgPSBuZXcgTWFwcHkoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBuZXdNYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdNYXA7XG4gICAgfTtcblxuICAgIHJldHVybiBNYXBweTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvTWFwLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RhYmxlU29ydCA9IHJlcXVpcmUoJy4vc3RhYmxlU29ydC5qcycpO1xudmFyIE1hcCA9IHJlcXVpcmUoJy4vTWFwLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHN0YWJsZVNvcnQ6IHN0YWJsZVNvcnQsXG4gICAgICAgIE1hcDogTWFwXG4gICAgfTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvVXRpbHMuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIHJldHVybiB7XG5cbiAgICAgICAgY291bnQ6IGZ1bmN0aW9uICgpIHsgLyogY29sdW1JbmRleCAqL1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcm93cztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgc3VtOiBmdW5jdGlvbiAoY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciBzdW0gPSAwO1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHJvd3M7IHIrKykge1xuICAgICAgICAgICAgICAgICAgICBzdW0gPSBzdW0gKyBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWluOiBmdW5jdGlvbiAoY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciBtaW4gPSAwO1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHJvd3M7IHIrKykge1xuICAgICAgICAgICAgICAgICAgICBtaW4gPSBNYXRoLm1pbihtaW4sIGdyb3VwLmdldFZhbHVlKGNvbHVtSW5kZXgsIHIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1pbjtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cblxuICAgICAgICBtYXg6IGZ1bmN0aW9uIChjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1heCA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1heCA9IE1hdGgubWF4KG1heCwgZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWF4O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBhdmc6IGZ1bmN0aW9uIChjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1bSA9IHN1bSArIGdyb3VwLmdldFZhbHVlKGNvbHVtSW5kZXgsIHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gc3VtIC8gcm93cztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgZmlyc3Q6IGZ1bmN0aW9uIChjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdyb3VwLmdldFZhbHVlKGNvbHVtSW5kZXgsIDApO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBsYXN0OiBmdW5jdGlvbiAoY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcm93cyAtIDEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBzdGRkZXY6IGZ1bmN0aW9uIChjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHI7XG4gICAgICAgICAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAociA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc3VtID0gc3VtICsgZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBtZWFuID0gc3VtIC8gcm93cztcbiAgICAgICAgICAgICAgICB2YXIgdmFyaWFuY2UgPSAwO1xuICAgICAgICAgICAgICAgIGZvciAociA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRldiA9IChncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKSAtIG1lYW4pO1xuICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZSA9IHZhcmlhbmNlICsgKGRldiAqIGRldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBzdGRkZXYgPSBNYXRoLnNxcnQodmFyaWFuY2UgLyByb3dzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RkZGV2O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2FnZ3JlZ2F0aW9ucy5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIEpTRGF0YVNvdXJjZSA9IHJlcXVpcmUoJy4vSlNEYXRhU291cmNlJyk7XG52YXIgRGF0YVNvdXJjZVNvcnRlciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZVNvcnRlcicpO1xudmFyIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUnKTtcbnZhciBEYXRhU291cmNlRmlsdGVyID0gcmVxdWlyZSgnLi9EYXRhU291cmNlRmlsdGVyJyk7XG52YXIgRGF0YVNvdXJjZUdsb2JhbEZpbHRlciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZUdsb2JhbEZpbHRlcicpO1xudmFyIERhdGFTb3VyY2VBZ2dyZWdhdG9yID0gcmVxdWlyZSgnLi9EYXRhU291cmNlQWdncmVnYXRvcicpO1xudmFyIGFnZ3JlZ2F0aW9ucyA9IHJlcXVpcmUoJy4vYWdncmVnYXRpb25zJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIEpTRGF0YVNvdXJjZTogSlNEYXRhU291cmNlLFxuICAgICAgICBEYXRhU291cmNlU29ydGVyOiBEYXRhU291cmNlU29ydGVyLFxuICAgICAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlOiBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLFxuICAgICAgICBEYXRhU291cmNlRmlsdGVyOiBEYXRhU291cmNlRmlsdGVyLFxuICAgICAgICBEYXRhU291cmNlR2xvYmFsRmlsdGVyOiBEYXRhU291cmNlR2xvYmFsRmlsdGVyLFxuICAgICAgICBEYXRhU291cmNlQWdncmVnYXRvcjogRGF0YVNvdXJjZUFnZ3JlZ2F0b3IsXG4gICAgICAgIGFnZ3JlZ2F0aW9uczogYWdncmVnYXRpb25zXG4gICAgfTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvYW5hbHl0aWNzLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyogZXNsaW50LWVudiBub2RlLCBicm93c2VyICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBub29wID0gZnVuY3Rpb24gKCkge307XG5cbnZhciBvbyA9IHJlcXVpcmUoJ29iamVjdC5vYnNlcnZlJyk7XG52YXIgYW5hbHl0aWNzID0gcmVxdWlyZSgnLi9hbmFseXRpY3MuanMnKTtcblxubm9vcChvbyk7XG5cbmlmICghd2luZG93LmZpbikge1xuICAgIHdpbmRvdy5maW4gPSB7fTtcbn1cbmlmICghd2luZG93LmZpbi5hbmFseXRpY3MpIHtcbiAgICB3aW5kb3cuZmluLmFuYWx5dGljcyA9IGFuYWx5dGljcztcbn1cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvZmFrZV85YmQyMDNhMS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHN0YWJpbGl6ZSA9IGZ1bmN0aW9uIChjb21wYXJhdG9yLCBkZXNjZW5kaW5nKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChhcnIxLCBhcnIyKSB7XG4gICAgICAgIHZhciB4ID0gYXJyMVswXTtcbiAgICAgICAgdmFyIHkgPSBhcnIyWzBdO1xuICAgICAgICBpZiAoeCA9PT0geSkge1xuICAgICAgICAgICAgeCA9IGRlc2NlbmRpbmcgPyBhcnIyWzFdIDogYXJyMVsxXTtcbiAgICAgICAgICAgIHkgPSBkZXNjZW5kaW5nID8gYXJyMVsxXSA6IGFycjJbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoeSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh4ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3IoeCwgeSk7XG4gICAgfTtcbn07XG5cblxudmFyIGFzY2VuZGluZ051bWJlcnMgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIHJldHVybiB4IC0geTtcbn07XG5cbnZhciBkZXNjZW5kaW5nTnVtYmVycyA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgcmV0dXJuIHkgLSB4O1xufTtcblxudmFyIGFzY2VuZGluZ0FsbE90aGVycyA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgcmV0dXJuIHggPCB5ID8gLTEgOiAxO1xufTtcblxudmFyIGRlc2NlbmRpbmdBbGxPdGhlcnMgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIHJldHVybiB5IDwgeCA/IC0xIDogMTtcbn07XG5cbnZhciBhc2NlbmRpbmcgPSBmdW5jdGlvbiAodHlwZU9mRGF0YSkge1xuICAgIGlmICh0eXBlT2ZEYXRhID09PSAnbnVtYmVyJykge1xuICAgICAgICByZXR1cm4gc3RhYmlsaXplKGFzY2VuZGluZ051bWJlcnMsIGZhbHNlKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YWJpbGl6ZShhc2NlbmRpbmdBbGxPdGhlcnMsIGZhbHNlKTtcbn07XG5cbnZhciBkZXNjZW5kaW5nID0gZnVuY3Rpb24gKHR5cGVPZkRhdGEpIHtcbiAgICBpZiAodHlwZU9mRGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHN0YWJpbGl6ZShkZXNjZW5kaW5nTnVtYmVycywgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBzdGFiaWxpemUoZGVzY2VuZGluZ0FsbE90aGVycywgdHJ1ZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBzb3J0KGluZGV4VmVjdG9yLCBkYXRhU291cmNlLCBzb3J0VHlwZSkge1xuXG4gICAgICAgIHZhciBjb21wYXJlLCBpO1xuXG4gICAgICAgIGlmIChpbmRleFZlY3Rvci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjsgLy9ub3RoaW5nIHRvIGRvO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNvcnRUeXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNvcnRUeXBlID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzb3J0VHlwZSA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuOyAvLyBub3RoaW5nIHRvIHNvcnQgaGVyZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0eXBlT2ZEYXRhID0gdHlwZW9mIGRhdGFTb3VyY2UoMCk7XG5cbiAgICAgICAgY29tcGFyZSA9IChzb3J0VHlwZSA9PT0gMSkgPyBhc2NlbmRpbmcodHlwZU9mRGF0YSkgOiBkZXNjZW5kaW5nKHR5cGVPZkRhdGEpO1xuXG4gICAgICAgIC8vc3RhcnQgdGhlIGFjdHVhbGx5IHNvcnRpbmcuLi4uLlxuICAgICAgICB2YXIgdG1wID0gbmV3IEFycmF5KGluZGV4VmVjdG9yLmxlbmd0aCk7XG5cbiAgICAgICAgLy9sZXRzIGFkZCB0aGUgaW5kZXggZm9yIHN0YWJpbGl0eVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaW5kZXhWZWN0b3IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRtcFtpXSA9IFtkYXRhU291cmNlKGkpLCBpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRtcC5zb3J0KGNvbXBhcmUpO1xuXG4gICAgICAgIC8vY29weSB0aGUgc29ydGVkIHZhbHVlcyBpbnRvIG91ciBpbmRleCB2ZWN0b3JcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGluZGV4VmVjdG9yLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpbmRleFZlY3RvcltpXSA9IHRtcFtpXVsxXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzb3J0O1xufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc3RhYmxlU29ydC5qc1wiLFwiL1wiKSJdfQ==
