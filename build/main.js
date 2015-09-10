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
'use strict';

var Utils = require('./Utils.js');

module.exports = (function() {

    function DataSorter(data) {
        this.data = data;
        this.indexes = [];
        this.initializeIndexVector();
    }

    DataSorter.prototype.getValue = function(x, y) {

        var value = this.data.getValue(x, this.indexes[y]);
        return value;
    };

    DataSorter.prototype.getRow = function(y) {

        return this.data[this.indexes[y]];
    };

    DataSorter.prototype.setValue = function(x, y, value) {

        this.data.setValue(x, this.indexes[y], value);
    };

    DataSorter.prototype.getColumnCount = function() {

        return this.data.getColumnCount();
    };

    DataSorter.prototype.getRowCount = function() {

        return this.data.getRowCount();
    };

    DataSorter.prototype.sortOn = function(columnIndex) {
        this.initializeIndexVector();
        var self = this;
        Utils.stableSort(this.indexes, function(index) {
            return self.data.getValue(columnIndex, index);
        });
    };

    DataSorter.prototype.initializeIndexVector = function() {
        var rowCount = this.getRowCount();
        var indexVector = new Array(rowCount);
        for (var r = 0; r < rowCount; r++) {
            indexVector[r] = r;
        }
        this.indexes = indexVector;
    };

    return DataSorter;

})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSorter.js","/")
},{"./Utils.js":7,"buffer":1,"oMfpAn":4}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var computeFieldNames = function(object) {
        var fields = [].concat(Object.getOwnPropertyNames(object).filter(function(e) {
            return e.substr(0, 2) !== '__';
        }));
        return fields;
    };

    function JSDataSource(data, fields) {

        this.fields = fields || computeFieldNames(data[0]);
        this.data = data;

    }

    JSDataSource.prototype.getValue = function(x, y) {

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

        return this.fields.length;
    };

    JSDataSource.prototype.getRowCount = function() {

        return this.data.length;
    };

    JSDataSource.prototype.getFields = function() {

        return this.fields;
    };

    JSDataSource.prototype.setFields = function(fields) {

        this.fields = fields;
    };

    return JSDataSource;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/JSDataSource.js","/")
},{"buffer":1,"oMfpAn":4}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var timSort = require('./timsort.js');
var quickSort = require('./quicksort.js');
var stableQuickSort = require('./stableQuickSort.js');
var mergeSort = require('./mergesort.js');
var stableSort = require('./stableSort.js');

module.exports = (function() {

    var flashSort = function(indexVector, a) {
        var n = a.length;

        var i = 0,
            j = 0,
            k = 0,
            t;
        var m = ~~ (n * 0.125); /*jshint ignore:line */
        var anmin = a[indexVector[0]];
        var nmax = 0;
        var nmove = 0;

        var l = new Array(m);
        for (i = 0; i < m; i++) {
            l[i] = 0;
        }

        for (i = 1; i < n; ++i) {
            var ai = a[indexVector[i]];
            if (ai < anmin) {
                anmin = ai;
            }
            if (ai > a[indexVector[nmax]]) {
                nmax = i;
            }
        }

        var anmax = a[indexVector[nmax]];
        if (anmin === anmax) {
            return a;
        }
        var c1 = (m - 1) / (anmax - anmin);

        for (i = 0; i < n; ++i) {
            ++l[~~(c1 * (a[indexVector[i]] - anmin))]; /*jshint ignore:line */
        }

        for (k = 1; k < m; ++k) {
            l[k] += l[k - 1];
        }

        var hold = anmax;
        var hi = indexVector[nmax];
        indexVector[nmax] = indexVector[0];
        indexVector[0] = hi;

        var flash, fi;
        j = 0;
        k = m - 1;
        i = n - 1;

        while (nmove < i) {
            while (j > (l[k] - 1)) {
                k = ~~ (c1 * (a[indexVector[++j]] - anmin)); /*jshint ignore:line */
            }
            // line below added 07/03/2013, ES
            if (k < 0) {
                break;
            }

            fi = indexVector[j];
            flash = a[fi];

            while (j !== l[k]) {
                k = ~~ (c1 * (flash - anmin)); /*jshint ignore:line */
                t = --l[k];

                hold = a[indexVector[t]];
                hi = indexVector[t];
                indexVector[t] = fi;
                flash = hold;
                fi = hi;
                ++nmove;
            }
        }

        for (j = 1; j < n; ++j) {
            hold = a[indexVector[j]];
            hi = indexVector[j];
            i = j - 1;
            while (i >= 0 && a[indexVector[i]] > hold) {
                indexVector[i + 1] = indexVector[i--];
            }
            indexVector[i + 1] = hi;
        }

        return a;
    };


    //not stable
    //indexVector is an integer vector for indirection into arr
    //arr is a function that takes an index and returns the item
    var dualPivotQuickSort = function(indexVector, arr, fromIndex, toIndex) {
        if (fromIndex === undefined && toIndex === undefined) {
            dualPivotQuickSort(indexVector, arr, 0, indexVector.length);
        } else {
            rangeCheck(indexVector.length, fromIndex, toIndex);
            dpqsort(indexVector, arr, fromIndex, toIndex - 1, 3);
        }
        return arr;
    };

    function rangeCheck(length, fromIndex, toIndex) {
        if (fromIndex > toIndex) {
            console.error('fromIndex(' + fromIndex + ') > toIndex(' + toIndex + ')');
        }
        if (fromIndex < 0) {
            console.error(fromIndex);
        }
        if (toIndex > length) {
            console.error(toIndex);
        }
    }

    function swap(indexVector, arr, i, j) {
        var temp = indexVector[i];
        indexVector[i] = indexVector[j];
        indexVector[j] = temp;
    }

    function dpqsort(indexVector, arr, left, right, div) {
        var len = right - left;

        if (len < 27) { // insertion sort for tiny array
            for (var i = left + 1; i <= right; i++) {
                for (var j = i; j > left && arr(indexVector[j]) < arr(indexVector[j - 1]); j--) {
                    swap(indexVector, arr, j, j - 1);
                }
            }
            return;
        }
        var third = Math.floor(len / div); //TODO: check if we need to round up or down or just nearest

        // 'medians'
        var m1 = left + third;
        var m2 = right - third;

        if (m1 <= left) {
            m1 = left + 1;
        }
        if (m2 >= right) {
            m2 = right - 1;
        }
        if (arr(indexVector[m1]) < arr(indexVector[m2])) {
            swap(indexVector, arr, m1, left);
            swap(indexVector, arr, m2, right);
        } else {
            swap(indexVector, arr, m1, right);
            swap(indexVector, arr, m2, left);
        }
        // pivots
        var pivot1 = arr(indexVector[left]);
        var pivot2 = arr(indexVector[right]);

        // pointers
        var less = left + 1;
        var great = right - 1;

        // sorting
        for (var k = less; k <= great; k++) {
            if (arr(indexVector[k]) < pivot1) {
                swap(indexVector, arr, k, less++);
            } else if (arr(indexVector[k]) > pivot2) {
                while (k < great && arr(indexVector[great]) > pivot2) {
                    great--;
                }
                swap(indexVector, arr, k, great--);

                if (arr(indexVector[k]) < pivot1) {
                    swap(indexVector, arr, k, less++);
                }
            }
        }
        // swaps
        var dist = great - less;

        if (dist < 13) {
            div++;
        }
        swap(indexVector, arr, less - 1, left);
        swap(indexVector, arr, great + 1, right);

        // subarrays
        dpqsort(indexVector, arr, left, less - 2, div);
        dpqsort(indexVector, arr, great + 2, right, div);

        // equal elements
        if (dist > len - 13 && pivot1 !== pivot2) {
            for (k = less; k <= great; k++) {
                if (arr(indexVector[k]) === pivot1) {
                    swap(indexVector, arr, k, less++);
                } else if (arr(indexVector[k]) === pivot2) {
                    swap(indexVector, arr, k, great--);

                    if (arr(indexVector[k]) === pivot1) {
                        swap(indexVector, arr, k, less++);
                    }
                }
            }
        }
        // subarray
        if (pivot1 < pivot2) {
            dpqsort(indexVector, arr, less, great, div);
        }
    }

    return {
        flashSort: flashSort,
        dualPivotQuickSort: dualPivotQuickSort,
        timSort: timSort,
        quickSort: quickSort,
        stableQuickSort: stableQuickSort,
        mergeSort: mergeSort,
        stableSort: stableSort
    };

})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Utils.js","/")
},{"./mergesort.js":10,"./quicksort.js":11,"./stableQuickSort.js":13,"./stableSort.js":14,"./timsort.js":15,"buffer":1,"oMfpAn":4}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var JSDataSource = require('./JSDataSource');
var DataSorter = require('./DataSorter');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSorter: DataSorter
    };

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/analytics.js","/")
},{"./DataSorter":5,"./JSDataSource":6,"buffer":1,"oMfpAn":4}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');
var sampleData = require('./sampledata.js');
var sorts = require('./Utils.js');

if (!window.fin) {
    window.fin = {};
}

window.fin.analytics = analytics;
window.fin.sampleData = sampleData;
window.sorts = sorts;

window.d = new analytics.JSDataSource(sampleData);
window.s1 = new analytics.DataSorter(window.d);
window.s2 = new analytics.DataSorter(window.s1);

var now = Date.now();
window.s1.sortOn(0);
window.s2.sortOn(2);
console.log(Date.now() - now);
// var count = s2.getRowCount();
// for (var i = 0; i < count; i++) {
//     console.log(s2.getValue(2, i) + '		' + s2.getValue(0, i));
// }

// window.a = [5,4,3,0,3,8,2,9,8,0];

// window.b = ['q','w','e','r','t','y','u','i','o','p'];

// sorts.timsort([0,1,2,3,4,5,6,7,8,9], window.a);
// sorts.timsort([0,1,2,3,4,5,6,7,8,9], window.b);
// console.log(window.a, window.b);

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_23c66666.js","/")
},{"./Utils.js":7,"./analytics.js":8,"./sampledata.js":12,"buffer":1,"oMfpAn":4}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    function merge(dataSource, left, right) {
        var result = [];
        while (left.length > 0 && right.length > 0) {
            if (dataSource(left[0]) < dataSource(right[0])) {
                result.push(left.shift());
            } else {
                result.push(right.shift());
            }
        }
        return result.concat(left).concat(right);
    }

    function mergesort(indexVector, dataSource) {
        if (indexVector.length <= 1) {
            return indexVector;
        }
        var middle = Math.floor(indexVector.length / 2);
        var left = indexVector.slice(0, middle);
        var right = indexVector.slice(middle);
        return merge(dataSource, mergesort(left, dataSource), mergesort(right, dataSource));
    }

    function sort(indexVector, arr) {
        var indexes = mergesort(indexVector, arr);
        for (var i = 0; i < indexVector.length; i++) {
            indexVector[i] = indexes[i];
        }
    }

    return sort;
})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/mergesort.js","/")
},{"buffer":1,"oMfpAn":4}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var quicksort = function(indexVector, array, compare) {

        var less = compare || function(a, b) {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            };


        function swap(indexVector, items, firstIndex, secondIndex){
            var temp = indexVector[firstIndex];
            indexVector[firstIndex] = indexVector[secondIndex];
            indexVector[secondIndex] = temp;
        }

        function testLess(indexVector, a, b){

            var value = less(a, b);
            // if(value === 0){

            //     return a.__sortPosition - b.__sortPosition;
            // }

            return value;
        }

        function partition(indexVector, items, left, right) {

            var pivot   = items(indexVector[Math.floor((right + left) / 2)]),
                i       = left,
                j       = right;


            while (i <= j) {

                while (testLess(indexVector, items(indexVector[i]), pivot) < 0) {
                    i++;
                }

                while (testLess(indexVector, pivot, items(indexVector[j])) < 0) {
                    j--;
                }

                if (i <= j) {
                    swap(items, i, j);
                    i++;
                    j--;
                }
            }

            return i;
        }

        function sort(indexVector, items, left, right) {

            var index;

            if (indexVector.length > 1) {

                left = typeof left != "number" ? 0 : left;
                right = typeof right != "number" ? indexVector.length - 1 : right;

                index = partition(indexVector, items, left, right);

                if (left < index - 1) {
                    sort(indexVector, items, left, index - 1);
                }

                if (index<  right) {
                    sort(indexVector, items, index, right);
                }
            }

            return items;
        }

        //addPositions(indexVector, array);
        return sort(indexVector, array);
    };

    return quicksort;
})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/quicksort.js","/")
},{"buffer":1,"oMfpAn":4}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var numRows = 100000;

    var firstNames = ['Olivia', 'Sophia', 'Ava', 'Isabella', 'Boy', 'Liam', 'Noah', 'Ethan', 'Mason', 'Logan', 'Moe', 'Larry', 'Curly', 'Shemp', 'Groucho', 'Harpo', 'Chico', 'Zeppo', 'Stanley', 'Hardy'];
    var lastNames = ['Wirts', 'Oneil', 'Smith', 'Barbarosa', 'Soprano', 'Gotti', 'Columbo', 'Luciano', 'Doerre', 'DePena'];
    var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    var days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];
    var states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

    var randomFunc = Math.random;
    //var randomFunc = rnd;

    var randomPerson = function() {
        var firstName = Math.round((firstNames.length - 1) * randomFunc());
        //var lastName = 'a' + randomFunc() + 'b';
        var lastName = Math.round((lastNames.length - 1) * randomFunc());
        var pets = Math.round(10 * randomFunc());
        var birthyear = 1900 + Math.round(randomFunc() * 114);
        var birthmonth = Math.round(randomFunc() * 11);
        var birthday = Math.round(randomFunc() * 29);
        var birthstate = Math.round(randomFunc() * 49);
        var residencestate = Math.round(randomFunc() * 49);
        var travel = randomFunc() * 1000;
        var income = randomFunc() * 100000;
        var employed = Math.round(randomFunc());
        var person = {
            last_name: lastNames[lastName], //jshint ignore:line
            first_name: firstNames[firstName], //jshint ignore:line
            pets: pets,
            birthDate: birthyear + '-' + months[birthmonth] + '-' + days[birthday],
            birthState: states[birthstate],
            residenceState: states[residencestate],
            employed: employed === 1,
            income: income,
            travel: travel
        };
        return person;
    };

    var data = [];
    for (var i = 0; i < numRows; i++) {
        var person = randomPerson();
        person.order = i;
        data.push(person);
    }

    return data;

})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/sampledata.js","/")
},{"buffer":1,"oMfpAn":4}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var SortTypes = {
    ASCENDING:"ascending",
    DESCENDING:"descending",
    NONE:"none"
}

var compare = function(indexVector, dataSource, first, last, type) {
    //return;
    var x = dataSource(indexVector[first]), y = dataSource(indexVector[last]);

    if (typeof(x) === "number") {

        // Numbers are compared by subtraction
        if (type === SortTypes.ASCENDING) {
            if (y === null) return -1;
            return x-y;
        } else {
            if (y === null) return 1;
            return y-x;
        }
    } else {

        // Anything not a number gets compared using the relational operators
        if (type === SortTypes.ASCENDING) {
            if (y === null) return -1;
            return x<y?-1:1;
        } else {
            if (y === null) return 1;
            return y<x?-1:1;
        }
    }
    return 0;
}

module.exports = (function() {

    function stableQuickSort(indexVector, dataSource, oneZeroOrMinusOneType) {
        var type;
        if (oneZeroOrMinusOneType === undefined) {
            oneZeroOrMinusOneType = 1;
        }
        switch(oneZeroOrMinusOneType) {
            case -1:
                type = SortTypes.DESCENDING;
                break;
            case 0:
                type = SortTypes.NONE;
                break;
            case 1:
                type = SortTypes.ASCENDING;
                break;
        }
        if (type === SortTypes.NONE) {
            for (var i = 0; i < indexVector.length; i++) {
                indexVector[i] = i;
            }
            return;
        }
        quicksort(indexVector, dataSource, 1, indexVector.length - 1, type);
    }

    function swap(indexVector, x, y) {
        var tmp = indexVector[x];
        indexVector[x] = indexVector[y];
        indexVector[y] = tmp;
        if (tmp === undefined || indexVector[x] === undefined) {
            console.log('halt');
        }

    }

    function quicksort(indexVector, dataSource, first, last, type) {
        // In place quickstort, stable.  We cant use the inbuilt Array.sort() since its a hybrid sort
        // potentially and may not be stable (non quicksort) on small sizes.
        // if (1 === 1) {
        //     return;
        // }
        while (first < last)
        {
            var right   = last;
            var left    = first;
            var pivot = (first+last)>>1;

            if (pivot < 0 || pivot >= last) {
                break;
            }

            while(right >= left) {

                while (left <= right && compare(indexVector, dataSource, left, pivot, type) <= 0) {
                    ++left;
                }

                while (left <= right && compare(indexVector, dataSource, right, pivot, type) > 0) {
                    --right;
                }

                if (left > right) {
                    break;
                }

                swap(indexVector, left,right);

                if (pivot === right) {
                    pivot = left;
                }

                left++;
                right--;

            }

            swap(indexVector, pivot, right);
            right--;

            // Use recursion to sort the smallest partition, this increases performance.
            if (Math.abs(right-first) > Math.abs(last-left)) {
                if (left < last) quicksort(indexVector, dataSource, left, last, type);
                last = right;
            }
            else  {
                if (first < right) quicksort(indexVector, dataSource, first, right, type);
                first = left;
            }
        }
    }

    return stableQuickSort;

})();



}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/stableQuickSort.js","/")
},{"buffer":1,"oMfpAn":4}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var stabilize  = function(comparator) {
    return function(arr1, arr2) {
        var x = arr1[0];
        var y = arr2[0];
        if (x === y) {
            x = arr1[1];
            y = arr2[1];
        } else {
            if (y === null) {return -1;}
            if (x === null) {return 1;}
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
    if (typeOfData === "number") {
        return stabilize(ascendingNumbers);
    }
    return stabilize(ascendingAllOthers);
};

var descending = function(typeOfData) {
    if (typeOfData === "number") {
        return stabilize(descendingNumbers);
    }
    return stabilize(descendingAllOthers);
};

module.exports = (function() {

    function sort(indexVector, dataSource, sortType) {

        var compare;

        sortType = sortType || 1;

        if (indexVector.length === 0) {
            return; //nothing to do;
        }

        //check if we need to reset the indexes for a no sort
        if (sortType === 0) {
            for (var i = 0; i < 0; i++) {
                indexVector[i] = i;
            }
            return;
        }

        var typeOfData = typeof dataSource(0);

        compare = (sortType === -1) ? ascending(typeOfData) : descending(typeOfData);

        //start the actually sorting.....
        var tmp = new Array(indexVector.length);

        //lets add the index for stability
        for (var i = 0; i < indexVector.length; i++) {
            tmp[i] = [dataSource(i), i];
        }

        tmp.sort(compare);

        //copy the sorted values into our index vector
        for (var i = 0; i < indexVector.length; i++) {
            indexVector[i] = tmp[i][1];
        }
    }

    return sort;
})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/stableSort.js","/")
},{"buffer":1,"oMfpAn":4}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    var timsort = function(indexVector, array, comp) {

        var globalA = array;
        var MIN_MERGE = 32;
        var MIN_GALLOP = 7
        var runBase = [];
        var runLen = [];
        var stackSize = 0;
        var compare = comp || function(a, b) {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            };

        sort(indexVector, array, 0, indexVector.length, compare);

         function sort (indexVector, a, lo, hi, compare) {

                if (typeof compare != "function") {
                    throw new Error("Compare is not a function.");
                    return;
                }

                stackSize = 0;
                runBase=[];
                runLen=[];

                rangeCheck(indexVector.length, lo, hi);
                var nRemaining = hi - lo;
                if (nRemaining < 2) return; // Arrays of size 0 and 1 are always sorted


                if (nRemaining < MIN_MERGE) {
                    var initRunLen = countRunAndMakeAscending(indexVector, a, lo, hi, compare);
                    binarySort(indexVector, a, lo, hi, lo + initRunLen, compare);
                    return;
                }


                var ts = [];
                var minRun = minRunLength(indexVector, nRemaining);
                do {
                    // Identify next run
                    var runLenVar = countRunAndMakeAscending(indexVector, a, lo, hi, compare);

                    // If run is short, extend to min(minRun, nRemaining)
                    if (runLenVar < minRun) {
                        var force = nRemaining <= minRun ? nRemaining : minRun;
                        binarySort(indexVector, a, lo, lo + force, lo + runLenVar, compare);
                        runLenVar = force;
                    }

                    // Push run onto pending-run stack, and maybe merge
                    pushRun(indexVector, lo, runLenVar);
                    mergeCollapse(indexVector);

                    // Advance to find next run
                    lo += runLenVar;
                    nRemaining -= runLenVar;
                } while (nRemaining != 0);

                // Merge all remaining runs to complete sort
                mergeForceCollapse(indexVector);
            }

        function binarySort(indexVector, a, lo, hi, start, compare) {
            if (start == lo) start++;
            for (; start < hi; start++) {
                var pivot = indexVector[start];

                var left = lo;
                var right = start;
               while (left < right) {
                    var mid = (left + right) >>> 1;
                    if (compare(a(pivot), a(indexVector[mid])) < 0)
                        right = mid;
                    else
                        left = mid + 1;
                }

                 var n = start - left;

                switch (n) {
                    case 2:
                        (indexVector[left + 2]) = (indexVector[left + 1]);
                    case 1:
                        (indexVector[left + 1]) = (indexVector[left]);
                        break;
                    default:
                        arraycopy(indexVector, a, left, a, left + 1, n);
                }
                indexVector[left] = pivot;
            }
        }

        function countRunAndMakeAscending(indexVector, a, lo, hi, compare) {
            var runHi = lo + 1;


            if (compare(a(indexVector[runHi++]), a(indexVector[lo])) < 0) { // Descending
                while (runHi < hi && compare(a(indexVector[runHi]), a(indexVector[runHi - 1])) < 0) {
                    runHi++;
                }
                reverseRange(indexVector, a, lo, runHi);
            } else { // Ascending
                while (runHi < hi && compare(a(indexVector[runHi]), a(indexVector[runHi - 1])) >= 0) {
                    runHi++;
                }
            }

            return runHi - lo;
        }

        function reverseRange(indexVector, a, lo, hi) {
            hi--;
            while (lo < hi) {
                var t = indexVector[lo];
                indexVector[lo++] = indexVector[hi];
                indexVector[hi--] = t;
            }
        }

        function minRunLength(indexVector, n) {
            var r = 0;
            return n + 1;
        }

        function pushRun(indexVector, runBaseArg, runLenArg) {
            runBase[stackSize] = runBaseArg;
            runLen[stackSize] = runLenArg;
            stackSize++;
        }

        function mergeCollapse(indexVector) {
            while (stackSize > 1) {
                var n = stackSize - 2;
                if (n > 0 && runLen[n - 1] <= runLen[n] + runLen[n + 1]) {
                    if (runLen[n - 1] < runLen[n + 1]) n--;
                    mergeAt(indexVector, n);
                } else if (runLen[n] <= runLen[n + 1]) {
                    mergeAt(indexVector, n);
                } else {
                    break; // Invariant is established
                }
            }
        }

        function mergeForceCollapse(indexVector) {
            while (stackSize > 1) {
                var n = stackSize - 2;
                if (n > 0 && runLen[n - 1] < runLen[n + 1]) n--;
                mergeAt(indexVector, n);
            }
        }

        function mergeAt(indexVector, i) {

            var base1 = runBase[i];
            var len1 = runLen[i];
            var base2 = runBase[i + 1];
            var len2 = runLen[i + 1];

            runLen[i] = len1 + len2;
            if (i == stackSize - 3) {
                runBase[i + 1] = runBase[i + 2];
                runLen[i + 1] = runLen[i + 2];
            }
            stackSize--;

            var k = gallopRight(indexVector, globalA(indexVector[base2]), globalA, base1, len1, 0, compare);
            base1 += k;
            len1 -= k;
            if (len1 == 0) return;

            len2 = gallopLeft(indexVector, globalA(indexVector[base1 + len1 - 1]), globalA, base2, len2, len2 - 1, compare);

            if (len2 == 0) return;

            if (len1 <= len2)
                mergeLo(indexVector, base1, len1, base2, len2);
            else
                mergeHi(indexVector, base1, len1, base2, len2);
        }

        function gallopLeft(indexVector, key, a, base, len, hint, compare) {
            var lastOfs = 0;
            var ofs = 1;
            if (compare(key, a(indexVector[base + hint])) > 0) {
                // Gallop right until a(indexVector[base+hint+lastOfs] < key <= a(indexVector[base+hint+ofs]
                var maxOfs = len - hint;
                while (ofs < maxOfs && compare(key, a(indexVector[base + hint + ofs])) > 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to base
                lastOfs += hint;
                ofs += hint;
            } else { // key <= a(indexVector[base + hint]
                // Gallop left until a(indexVector[base+hint-ofs] < key <= a(indexVector[base+hint-lastOfs]
                var maxOfs = hint + 1;
                while (ofs < maxOfs && compare(key, a(indexVector[base + hint - ofs])) <= 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to base
                var tmp = lastOfs;
                lastOfs = hint - ofs;
                ofs = hint - tmp;
            }
            lastOfs++;
            while (lastOfs < ofs) {
                var m = lastOfs + ((ofs - lastOfs) >>> 1);

                if (compare(key, a(indexVector[base + m])) > 0)
                    lastOfs = m + 1; // a[base + m] < key
                else
                    ofs = m; // key <= a[base + m]
            }
            return ofs;
        }

        function gallopRight(indexVector, key, a, base, len, hint, compare) {

            var ofs = 1;
            var lastOfs = 0;
            if (compare(key, a[base + hint]) < 0) {
                // Gallop left until a[b+hint - ofs] <= key < a[b+hint - lastOfs]
                var maxOfs = hint + 1;
                while (ofs < maxOfs && compare(key, a[base + hint - ofs]) < 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to b
                var tmp = lastOfs;
                lastOfs = hint - ofs;
                ofs = hint - tmp;
            } else { // a[b + hint] <= key
                // Gallop right until a[b+hint + lastOfs] <= key < a[b+hint + ofs]
                var maxOfs = len - hint;
                while (ofs < maxOfs && compare(key, a[base + hint + ofs]) >= 0) {
                    lastOfs = ofs;
                    ofs = (ofs << 1) + 1;
                    if (ofs <= 0) // int overflow
                        ofs = maxOfs;
                }
                if (ofs > maxOfs) ofs = maxOfs;

                // Make offsets relative to b
                lastOfs += hint;
                ofs += hint;
            }

            /*
             * Now a[b + lastOfs] <= key < a[b + ofs], so key belongs somewhere to the right of lastOfs but no farther right than ofs.
             * Do a binary search, with invariant a[b + lastOfs - 1] <= key < a[b + ofs].
             */
            lastOfs++;
            while (lastOfs < ofs) {
                var m = lastOfs + ((ofs - lastOfs) >>> 1);

                if (compare(key, a[base + m]) < 0)
                    ofs = m; // key < a[b + m]
                else
                    lastOfs = m + 1; // a[b + m] <= key
            }
            return ofs;
        }

        function mergeLo(indexVector, base1, len1, base2, len2) {

            // Copy first run into temp array
            var a = globalA; // For performance
            var tmp = a.slice(base1, base1 + len1);

            var cursor1 = 0; // Indexes into tmp array
            var cursor2 = base2; // Indexes int a
            var dest = base1; // Indexes int a

            // Move first element of second run and deal with degenerate cases
            a[dest++] = a[cursor2++];
            if (--len2 == 0) {
                arraycopy(tmp, cursor1, a, dest, len1);
                return;
            }
            if (len1 == 1) {
                arraycopy(a, cursor2, a, dest, len2);
                a[dest + len2] = tmp[cursor1]; // Last elt of run 1 to end of merge
                return;
            }

            var c = compare; // Use local variable for performance

            var minGallop = MIN_GALLOP; // "    " "     " "
            outer: while (true) {
                var count1 = 0; // Number of times in a row that first run won
                var count2 = 0; // Number of times in a row that second run won

                /*
                 * Do the straightforward thing until (if ever) one run starts winning consistently.
                 */
                do {
                    if (compare(a[cursor2], tmp[cursor1]) < 0) {
                        a[dest++] = a[cursor2++];
                        count2++;
                        count1 = 0;
                        if (--len2 == 0) break outer;
                    } else {
                        a[dest++] = tmp[cursor1++];
                        count1++;
                        count2 = 0;
                        if (--len1 == 1) break outer;
                    }
                } while ((count1 | count2) < minGallop);

                /*
                 * One run is winning so consistently that galloping may be a huge win. So try that, and continue galloping until (if
                 * ever) neither run appears to be winning consistently anymore.
                 */
                do {
                    count1 = gallopRight(a[cursor2], tmp, cursor1, len1, 0, c);
                    if (count1 != 0) {
                        arraycopy(tmp, cursor1, a, dest, count1);
                        dest += count1;
                        cursor1 += count1;
                        len1 -= count1;
                        if (len1 <= 1) // len1 == 1 || len1 == 0
                            break outer;
                    }
                    a[dest++] = a[cursor2++];
                    if (--len2 == 0) break outer;

                    count2 = gallopLeft(tmp[cursor1], a, cursor2, len2, 0, c);
                    if (count2 != 0) {
                        arraycopy(a, cursor2, a, dest, count2);
                        dest += count2;
                        cursor2 += count2;
                        len2 -= count2;
                        if (len2 == 0) break outer;
                    }
                    a[dest++] = tmp[cursor1++];
                    if (--len1 == 1) break outer;
                    minGallop--;
                } while (count1 >= MIN_GALLOP | count2 >= MIN_GALLOP);
                if (minGallop < 0) minGallop = 0;
                minGallop += 2; // Penalize for leaving gallop mode
            } // End of "outer" loop
            globalA.minGallop = minGallop < 1 ? 1 : minGallop; // Write back to field

            if (len1 == 1) {
                arraycopy(a, cursor2, a, dest, len2);
                a[dest + len2] = tmp[cursor1]; // Last elt of run 1 to end of merge
            } else if (len1 == 0) {
                throw new Error("IllegalArgumentException. Comparison method violates its general contract!");
            } else {
                arraycopy(tmp, cursor1, a, dest, len1);
            }
        }

        function mergeHi(indexVector, base1, len1, base2, len2) {

            // Copy second run into temp array
            var a = globalA; // For performance
            var tmp = indexVector.slice(base2, base2 + len2);

            var cursor1 = base1 + len1 - 1; // Indexes into a
            var cursor2 = len2 - 1; // Indexes into tmp array
            var dest = base2 + len2 - 1; // Indexes into a

            // Move last element of first run and deal with degenerate cases
            indexVector[dest--] = indexVector[cursor1--];
            if (--len1 == 0) {
                arraycopy(indexVector, tmp, 0, a, dest - (len2 - 1), len2);
                return;
            }
            if (len2 == 1) {
                dest -= len1;
                cursor1 -= len1;
                arraycopy(indexVector, a, cursor1 + 1, a, dest + 1, len1);
                a[dest] = tmp[cursor2];
                return;
            }

            var c = compare; // Use local variable for performance

            var minGallop = MIN_GALLOP; // "    " "     " "
            outer: while (true) {
                var count1 = 0; // Number of times in a row that first run won
                var count2 = 0; // Number of times in a row that second run won

                /*
                 * Do the straightforward thing until (if ever) one run appears to win consistently.
                 */
                do {
                    if (compare(tmp[cursor2], a[cursor1]) < 0) {
                        a[dest--] = a[cursor1--];
                        count1++;
                        count2 = 0;
                        if (--len1 == 0) break outer;
                    } else {
                        a[dest--] = tmp[cursor2--];
                        count2++;
                        count1 = 0;
                        if (--len2 == 1) break outer;
                    }
                } while ((count1 | count2) < minGallop);

                /*
                 * One run is winning so consistently that galloping may be a huge win. So try that, and continue galloping until (if
                 * ever) neither run appears to be winning consistently anymore.
                 */
                do {
                    count1 = len1 - gallopRight(indexVector, tmp[cursor2], a, base1, len1, len1 - 1, c);
                    if (count1 != 0) {
                        dest -= count1;
                        cursor1 -= count1;
                        len1 -= count1;
                        arraycopy(indexVector, a, cursor1 + 1, a, dest + 1, count1);
                        if (len1 == 0) break outer;
                    }
                    a[dest--] = tmp[cursor2--];
                    if (--len2 == 1) break outer;

                    count2 = len2 - gallopLeft(indexVector, a[cursor1], tmp, 0, len2, len2 - 1, c);
                    if (count2 != 0) {
                        dest -= count2;
                        cursor2 -= count2;
                        len2 -= count2;
                        arraycopy(indexVector, tmp, cursor2 + 1, a, dest + 1, count2);
                        if (len2 <= 1) // len2 == 1 || len2 == 0
                            break outer;
                    }
                    a[dest--] = a[cursor1--];
                    if (--len1 == 0) break outer;
                    minGallop--;
                } while (count1 >= MIN_GALLOP | count2 >= MIN_GALLOP);
                if (minGallop < 0) minGallop = 0;
                minGallop += 2; // Penalize for leaving gallop mode
            } // End of "outer" loop
            globalA.minGallop = minGallop < 1 ? 1 : minGallop; // Write back to field

            if (len2 == 1) {
                dest -= len1;
                cursor1 -= len1;
                arraycopy(indexVector, a, cursor1 + 1, a, dest + 1, len1);
                a[dest] = tmp[cursor2]; // Move first elt of run2 to front of merge
            } else if (len2 == 0) {
                throw new Error("IllegalArgumentException. Comparison method violates its general contract!");
            } else {
                arraycopy(indexVector, tmp, 0, a, dest - (len2 - 1), len2);
            }
        }

        function rangeCheck(indexVector, arrayLen, fromIndex, toIndex) {
            if (fromIndex > toIndex) throw new Error("IllegalArgument fromIndex(" + fromIndex + ") > toIndex(" + toIndex + ")");
            if (fromIndex < 0) throw new Error("ArrayIndexOutOfBounds " + fromIndex);
            if (toIndex > arrayLen) throw new Error("ArrayIndexOutOfBounds " + toIndex);
        }
    }


        function arraycopy(indexVector, s, spos, d, dpos, len) {
            var a = indexVector.slice(spos, spos + len);
            while (len--) {
                indexVector[dpos + len] = a[len];
            }
        }

    return timsort;

})();

}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/timsort.js","/")
},{"buffer":1,"oMfpAn":4}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YVNvcnRlci5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvSlNEYXRhU291cmNlLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9VdGlscy5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvYW5hbHl0aWNzLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9mYWtlXzIzYzY2NjY2LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9tZXJnZXNvcnQuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL3F1aWNrc29ydC5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvc2FtcGxlZGF0YS5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvc3RhYmxlUXVpY2tTb3J0LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9zdGFibGVTb3J0LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy90aW1zb3J0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2bENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MlxuXG4vKipcbiAqIElmIGBCdWZmZXIuX3VzZVR5cGVkQXJyYXlzYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKGNvbXBhdGlibGUgZG93biB0byBJRTYpXG4gKi9cbkJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgPSAoZnVuY3Rpb24gKCkge1xuICAvLyBEZXRlY3QgaWYgYnJvd3NlciBzdXBwb3J0cyBUeXBlZCBBcnJheXMuIFN1cHBvcnRlZCBicm93c2VycyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLFxuICAvLyBDaHJvbWUgNyssIFNhZmFyaSA1LjErLCBPcGVyYSAxMS42KywgaU9TIDQuMisuIElmIHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgYWRkaW5nXG4gIC8vIHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcywgdGhlbiB0aGF0J3MgdGhlIHNhbWUgYXMgbm8gYFVpbnQ4QXJyYXlgIHN1cHBvcnRcbiAgLy8gYmVjYXVzZSB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gYWRkIGFsbCB0aGUgbm9kZSBCdWZmZXIgQVBJIG1ldGhvZHMuIFRoaXMgaXMgYW4gaXNzdWVcbiAgLy8gaW4gRmlyZWZveCA0LTI5LiBOb3cgZml4ZWQ6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOFxuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiZcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAvLyBDaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybylcblxuICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0XG5cbiAgLy8gV29ya2Fyb3VuZDogbm9kZSdzIGJhc2U2NCBpbXBsZW1lbnRhdGlvbiBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgc3RyaW5nc1xuICAvLyB3aGlsZSBiYXNlNjQtanMgZG9lcyBub3QuXG4gIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcgJiYgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBzdWJqZWN0ID0gc3RyaW5ndHJpbShzdWJqZWN0KVxuICAgIHdoaWxlIChzdWJqZWN0Lmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICAgIHN1YmplY3QgPSBzdWJqZWN0ICsgJz0nXG4gICAgfVxuICB9XG5cbiAgLy8gRmluZCB0aGUgbGVuZ3RoXG4gIHZhciBsZW5ndGhcbiAgaWYgKHR5cGUgPT09ICdudW1iZXInKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0KVxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJylcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QubGVuZ3RoKSAvLyBhc3N1bWUgdGhhdCBvYmplY3QgaXMgYXJyYXktbGlrZVxuICBlbHNlXG4gICAgdGhyb3cgbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCBuZWVkcyB0byBiZSBhIG51bWJlciwgYXJyYXkgb3Igc3RyaW5nLicpXG5cbiAgdmFyIGJ1ZlxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIC8vIFByZWZlcnJlZDogUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBidWYgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIFRISVMgaW5zdGFuY2Ugb2YgQnVmZmVyIChjcmVhdGVkIGJ5IGBuZXdgKVxuICAgIGJ1ZiA9IHRoaXNcbiAgICBidWYubGVuZ3RoID0gbGVuZ3RoXG4gICAgYnVmLl9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkpXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgICBlbHNlXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3RbaV1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgIW5vWmVybykge1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgYnVmW2ldID0gMFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuLy8gU1RBVElDIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiAoYikge1xuICByZXR1cm4gISEoYiAhPT0gbnVsbCAmJiBiICE9PSB1bmRlZmluZWQgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gZnVuY3Rpb24gKHN0ciwgZW5jb2RpbmcpIHtcbiAgdmFyIHJldFxuICBzdHIgPSBzdHIgKyAnJ1xuICBzd2l0Y2ggKGVuY29kaW5nIHx8ICd1dGY4Jykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoIC8gMlxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdyYXcnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAqIDJcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGFzc2VydChpc0FycmF5KGxpc3QpLCAnVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdCwgW3RvdGFsTGVuZ3RoXSlcXG4nICtcbiAgICAgICdsaXN0IHNob3VsZCBiZSBhbiBBcnJheS4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB0b3RhbExlbmd0aCAhPT0gJ251bWJlcicpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBCVUZGRVIgSU5TVEFOQ0UgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gX2hleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgYXNzZXJ0KHN0ckxlbiAlIDIgPT09IDAsICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBhc3NlcnQoIWlzTmFOKGJ5dGUpLCAnSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPSBpICogMlxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBfdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX2FzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gX2JpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIF9hc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gX2Jhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IEJ1ZmZlci5fY2hhcnNXcml0dGVuID1cbiAgICBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gX2hleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IF91dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gX2FzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IF9iaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gX2Jhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBfdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcbiAgc3RhcnQgPSBOdW1iZXIoc3RhcnQpIHx8IDBcbiAgZW5kID0gKGVuZCAhPT0gdW5kZWZpbmVkKVxuICAgID8gTnVtYmVyKGVuZClcbiAgICA6IGVuZCA9IHNlbGYubGVuZ3RoXG5cbiAgLy8gRmFzdHBhdGggZW1wdHkgc3RyaW5nc1xuICBpZiAoZW5kID09PSBzdGFydClcbiAgICByZXR1cm4gJydcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gX2hleFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IF91dGY4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gX2FzY2lpU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IF9iaW5hcnlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gX2Jhc2U2NFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBfdXRmMTZsZVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gKHRhcmdldCwgdGFyZ2V0X3N0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzXG5cbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKCF0YXJnZXRfc3RhcnQpIHRhcmdldF9zdGFydCA9IDBcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGFzc2VydCh0YXJnZXRfc3RhcnQgPj0gMCAmJiB0YXJnZXRfc3RhcnQgPCB0YXJnZXQubGVuZ3RoLFxuICAgICAgJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSBzb3VyY2UubGVuZ3RoLCAnc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aClcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCA8IGVuZCAtIHN0YXJ0KVxuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgKyBzdGFydFxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmIChsZW4gPCAxMDAgfHwgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRfc3RhcnQpXG4gIH1cbn1cblxuZnVuY3Rpb24gX2Jhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiBfdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciB0bXAgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYnVmW2ldIDw9IDB4N0YpIHtcbiAgICAgIHJlcyArPSBkZWNvZGVVdGY4Q2hhcih0bXApICsgU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gICAgICB0bXAgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB0bXAgKz0gJyUnICsgYnVmW2ldLnRvU3RyaW5nKDE2KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXMgKyBkZWNvZGVVdGY4Q2hhcih0bXApXG59XG5cbmZ1bmN0aW9uIF9hc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKylcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gX2JpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIF9hc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gX2hleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gX3V0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSsxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSBjbGFtcChzdGFydCwgbGVuLCAwKVxuICBlbmQgPSBjbGFtcChlbmQsIGxlbiwgbGVuKVxuXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgdmFsID0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICB9IGVsc2Uge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV1cbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZFVJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDJdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgICB2YWwgfD0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0ICsgM10gPDwgMjQgPj4+IDApXG4gIH0gZWxzZSB7XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMV0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMl0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAzXVxuICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0XSA8PCAyNCA+Pj4gMClcbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkVUludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsXG4gICAgICAgICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICB2YXIgbmVnID0gdGhpc1tvZmZzZXRdICYgMHg4MFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQxNihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gX3JlYWRVSW50MzIoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMDAwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZmZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkRmxvYXQgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWREb3VibGUgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWREb3VibGUodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWREb3VibGUodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuXG5cbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbn1cblxuZnVuY3Rpb24gX3dyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAgICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZmZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2YsIC0weDgwKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB0aGlzLndyaXRlVUludDgodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB0aGlzLndyaXRlVUludDgoMHhmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmLCAtMHg4MDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQxNihidWYsIDB4ZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIF93cml0ZVVJbnQzMihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICBfd3JpdGVVSW50MzIoYnVmLCAweGZmZmZmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCxcbiAgICAgICAgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsdWUgPSB2YWx1ZS5jaGFyQ29kZUF0KDApXG4gIH1cblxuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiAhaXNOYU4odmFsdWUpLCAndmFsdWUgaXMgbm90IGEgbnVtYmVyJylcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgdGhpcy5sZW5ndGgsICdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSB0aGlzLmxlbmd0aCwgJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHRoaXNbaV0gPSB2YWx1ZVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG91dCA9IFtdXG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgb3V0W2ldID0gdG9IZXgodGhpc1tpXSlcbiAgICBpZiAoaSA9PT0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUykge1xuICAgICAgb3V0W2kgKyAxXSA9ICcuLi4nXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIG91dC5qb2luKCcgJykgKyAnPidcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpXG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgZ2V0L3NldCBtZXRob2RzIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX2dldCA9IGFyci5nZXRcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxuLy8gc2xpY2Uoc3RhcnQsIGVuZClcbmZ1bmN0aW9uIGNsYW1wIChpbmRleCwgbGVuLCBkZWZhdWx0VmFsdWUpIHtcbiAgaWYgKHR5cGVvZiBpbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgaW5kZXggPSB+fmluZGV4OyAgLy8gQ29lcmNlIHRvIGludGVnZXIuXG4gIGlmIChpbmRleCA+PSBsZW4pIHJldHVybiBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICBpbmRleCArPSBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICByZXR1cm4gMFxufVxuXG5mdW5jdGlvbiBjb2VyY2UgKGxlbmd0aCkge1xuICAvLyBDb2VyY2UgbGVuZ3RoIHRvIGEgbnVtYmVyIChwb3NzaWJseSBOYU4pLCByb3VuZCB1cFxuICAvLyBpbiBjYXNlIGl0J3MgZnJhY3Rpb25hbCAoZS5nLiAxMjMuNDU2KSB0aGVuIGRvIGFcbiAgLy8gZG91YmxlIG5lZ2F0ZSB0byBjb2VyY2UgYSBOYU4gdG8gMC4gRWFzeSwgcmlnaHQ/XG4gIGxlbmd0aCA9IH5+TWF0aC5jZWlsKCtsZW5ndGgpXG4gIHJldHVybiBsZW5ndGggPCAwID8gMCA6IGxlbmd0aFxufVxuXG5mdW5jdGlvbiBpc0FycmF5IChzdWJqZWN0KSB7XG4gIHJldHVybiAoQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoc3ViamVjdCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3ViamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSdcbiAgfSkoc3ViamVjdClcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3RilcbiAgICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpKVxuICAgIGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKylcbiAgICAgICAgYnl0ZUFycmF5LnB1c2gocGFyc2VJbnQoaFtqXSwgMTYpKVxuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShzdHIpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgcG9zXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuXG4vKlxuICogV2UgaGF2ZSB0byBtYWtlIHN1cmUgdGhhdCB0aGUgdmFsdWUgaXMgYSB2YWxpZCBpbnRlZ2VyLiBUaGlzIG1lYW5zIHRoYXQgaXRcbiAqIGlzIG5vbi1uZWdhdGl2ZS4gSXQgaGFzIG5vIGZyYWN0aW9uYWwgY29tcG9uZW50IGFuZCB0aGF0IGl0IGRvZXMgbm90XG4gKiBleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gdmVyaWZ1aW50ICh2YWx1ZSwgbWF4KSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA+PSAwLCAnc3BlY2lmaWVkIGEgbmVnYXRpdmUgdmFsdWUgZm9yIHdyaXRpbmcgYW4gdW5zaWduZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgaXMgbGFyZ2VyIHRoYW4gbWF4aW11bSB2YWx1ZSBmb3IgdHlwZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmc2ludCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmSUVFRTc1NCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG59XG5cbmZ1bmN0aW9uIGFzc2VydCAodGVzdCwgbWVzc2FnZSkge1xuICBpZiAoIXRlc3QpIHRocm93IG5ldyBFcnJvcihtZXNzYWdlIHx8ICdGYWlsZWQgYXNzZXJ0aW9uJylcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG52YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXHR2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMgfHxcblx0XHQgICAgY29kZSA9PT0gUExVU19VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0ggfHxcblx0XHQgICAgY29kZSA9PT0gU0xBU0hfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0XCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxucHJvY2Vzcy5uZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhblNldEltbWVkaWF0ZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnNldEltbWVkaWF0ZTtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB2YXIgcXVldWUgPSBbXTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzXCIsXCIvLi4vLi4vbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzc1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi9VdGlscy5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3J0ZXIoZGF0YSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICB0aGlzLmluZGV4ZXMgPSBbXTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplSW5kZXhWZWN0b3IoKTtcbiAgICB9XG5cbiAgICBEYXRhU29ydGVyLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHkpIHtcblxuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmRhdGEuZ2V0VmFsdWUoeCwgdGhpcy5pbmRleGVzW3ldKTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBEYXRhU29ydGVyLnByb3RvdHlwZS5nZXRSb3cgPSBmdW5jdGlvbih5KSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVt0aGlzLmluZGV4ZXNbeV1dO1xuICAgIH07XG5cbiAgICBEYXRhU29ydGVyLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHksIHZhbHVlKSB7XG5cbiAgICAgICAgdGhpcy5kYXRhLnNldFZhbHVlKHgsIHRoaXMuaW5kZXhlc1t5XSwgdmFsdWUpO1xuICAgIH07XG5cbiAgICBEYXRhU29ydGVyLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEuZ2V0Q29sdW1uQ291bnQoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvcnRlci5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLmdldFJvd0NvdW50KCk7XG4gICAgfTtcblxuICAgIERhdGFTb3J0ZXIucHJvdG90eXBlLnNvcnRPbiA9IGZ1bmN0aW9uKGNvbHVtbkluZGV4KSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUluZGV4VmVjdG9yKCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgVXRpbHMuc3RhYmxlU29ydCh0aGlzLmluZGV4ZXMsIGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5kYXRhLmdldFZhbHVlKGNvbHVtbkluZGV4LCBpbmRleCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBEYXRhU29ydGVyLnByb3RvdHlwZS5pbml0aWFsaXplSW5kZXhWZWN0b3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJvd0NvdW50ID0gdGhpcy5nZXRSb3dDb3VudCgpO1xuICAgICAgICB2YXIgaW5kZXhWZWN0b3IgPSBuZXcgQXJyYXkocm93Q291bnQpO1xuICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHJvd0NvdW50OyByKyspIHtcbiAgICAgICAgICAgIGluZGV4VmVjdG9yW3JdID0gcjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmluZGV4ZXMgPSBpbmRleFZlY3RvcjtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFTb3J0ZXI7XG5cbn0pKCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YVNvcnRlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgY29tcHV0ZUZpZWxkTmFtZXMgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgICAgdmFyIGZpZWxkcyA9IFtdLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmplY3QpLmZpbHRlcihmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICByZXR1cm4gZS5zdWJzdHIoMCwgMikgIT09ICdfXyc7XG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIGZpZWxkcztcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gSlNEYXRhU291cmNlKGRhdGEsIGZpZWxkcykge1xuXG4gICAgICAgIHRoaXMuZmllbGRzID0gZmllbGRzIHx8IGNvbXB1dGVGaWVsZE5hbWVzKGRhdGFbMF0pO1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuXG4gICAgfVxuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHkpIHtcblxuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmRhdGFbeV1bdGhpcy5maWVsZHNbeF1dO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Um93ID0gZnVuY3Rpb24oeSkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFbeV07XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuc2V0VmFsdWUgPSBmdW5jdGlvbih4LCB5LCB2YWx1ZSkge1xuXG4gICAgICAgIHRoaXMuZGF0YVt5XVt0aGlzLmZpZWxkc1t4XV0gPSB2YWx1ZTtcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmZpZWxkcy5sZW5ndGg7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRGaWVsZHMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5maWVsZHM7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuc2V0RmllbGRzID0gZnVuY3Rpb24oZmllbGRzKSB7XG5cbiAgICAgICAgdGhpcy5maWVsZHMgPSBmaWVsZHM7XG4gICAgfTtcblxuICAgIHJldHVybiBKU0RhdGFTb3VyY2U7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0pTRGF0YVNvdXJjZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHRpbVNvcnQgPSByZXF1aXJlKCcuL3RpbXNvcnQuanMnKTtcbnZhciBxdWlja1NvcnQgPSByZXF1aXJlKCcuL3F1aWNrc29ydC5qcycpO1xudmFyIHN0YWJsZVF1aWNrU29ydCA9IHJlcXVpcmUoJy4vc3RhYmxlUXVpY2tTb3J0LmpzJyk7XG52YXIgbWVyZ2VTb3J0ID0gcmVxdWlyZSgnLi9tZXJnZXNvcnQuanMnKTtcbnZhciBzdGFibGVTb3J0ID0gcmVxdWlyZSgnLi9zdGFibGVTb3J0LmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGZsYXNoU29ydCA9IGZ1bmN0aW9uKGluZGV4VmVjdG9yLCBhKSB7XG4gICAgICAgIHZhciBuID0gYS5sZW5ndGg7XG5cbiAgICAgICAgdmFyIGkgPSAwLFxuICAgICAgICAgICAgaiA9IDAsXG4gICAgICAgICAgICBrID0gMCxcbiAgICAgICAgICAgIHQ7XG4gICAgICAgIHZhciBtID0gfn4gKG4gKiAwLjEyNSk7IC8qanNoaW50IGlnbm9yZTpsaW5lICovXG4gICAgICAgIHZhciBhbm1pbiA9IGFbaW5kZXhWZWN0b3JbMF1dO1xuICAgICAgICB2YXIgbm1heCA9IDA7XG4gICAgICAgIHZhciBubW92ZSA9IDA7XG5cbiAgICAgICAgdmFyIGwgPSBuZXcgQXJyYXkobSk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBtOyBpKyspIHtcbiAgICAgICAgICAgIGxbaV0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMTsgaSA8IG47ICsraSkge1xuICAgICAgICAgICAgdmFyIGFpID0gYVtpbmRleFZlY3RvcltpXV07XG4gICAgICAgICAgICBpZiAoYWkgPCBhbm1pbikge1xuICAgICAgICAgICAgICAgIGFubWluID0gYWk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYWkgPiBhW2luZGV4VmVjdG9yW25tYXhdXSkge1xuICAgICAgICAgICAgICAgIG5tYXggPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFubWF4ID0gYVtpbmRleFZlY3RvcltubWF4XV07XG4gICAgICAgIGlmIChhbm1pbiA9PT0gYW5tYXgpIHtcbiAgICAgICAgICAgIHJldHVybiBhO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjMSA9IChtIC0gMSkgLyAoYW5tYXggLSBhbm1pbik7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG47ICsraSkge1xuICAgICAgICAgICAgKytsW35+KGMxICogKGFbaW5kZXhWZWN0b3JbaV1dIC0gYW5taW4pKV07IC8qanNoaW50IGlnbm9yZTpsaW5lICovXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGsgPSAxOyBrIDwgbTsgKytrKSB7XG4gICAgICAgICAgICBsW2tdICs9IGxbayAtIDFdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGhvbGQgPSBhbm1heDtcbiAgICAgICAgdmFyIGhpID0gaW5kZXhWZWN0b3Jbbm1heF07XG4gICAgICAgIGluZGV4VmVjdG9yW25tYXhdID0gaW5kZXhWZWN0b3JbMF07XG4gICAgICAgIGluZGV4VmVjdG9yWzBdID0gaGk7XG5cbiAgICAgICAgdmFyIGZsYXNoLCBmaTtcbiAgICAgICAgaiA9IDA7XG4gICAgICAgIGsgPSBtIC0gMTtcbiAgICAgICAgaSA9IG4gLSAxO1xuXG4gICAgICAgIHdoaWxlIChubW92ZSA8IGkpIHtcbiAgICAgICAgICAgIHdoaWxlIChqID4gKGxba10gLSAxKSkge1xuICAgICAgICAgICAgICAgIGsgPSB+fiAoYzEgKiAoYVtpbmRleFZlY3RvclsrK2pdXSAtIGFubWluKSk7IC8qanNoaW50IGlnbm9yZTpsaW5lICovXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsaW5lIGJlbG93IGFkZGVkIDA3LzAzLzIwMTMsIEVTXG4gICAgICAgICAgICBpZiAoayA8IDApIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmkgPSBpbmRleFZlY3RvcltqXTtcbiAgICAgICAgICAgIGZsYXNoID0gYVtmaV07XG5cbiAgICAgICAgICAgIHdoaWxlIChqICE9PSBsW2tdKSB7XG4gICAgICAgICAgICAgICAgayA9IH5+IChjMSAqIChmbGFzaCAtIGFubWluKSk7IC8qanNoaW50IGlnbm9yZTpsaW5lICovXG4gICAgICAgICAgICAgICAgdCA9IC0tbFtrXTtcblxuICAgICAgICAgICAgICAgIGhvbGQgPSBhW2luZGV4VmVjdG9yW3RdXTtcbiAgICAgICAgICAgICAgICBoaSA9IGluZGV4VmVjdG9yW3RdO1xuICAgICAgICAgICAgICAgIGluZGV4VmVjdG9yW3RdID0gZmk7XG4gICAgICAgICAgICAgICAgZmxhc2ggPSBob2xkO1xuICAgICAgICAgICAgICAgIGZpID0gaGk7XG4gICAgICAgICAgICAgICAgKytubW92ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaiA9IDE7IGogPCBuOyArK2opIHtcbiAgICAgICAgICAgIGhvbGQgPSBhW2luZGV4VmVjdG9yW2pdXTtcbiAgICAgICAgICAgIGhpID0gaW5kZXhWZWN0b3Jbal07XG4gICAgICAgICAgICBpID0gaiAtIDE7XG4gICAgICAgICAgICB3aGlsZSAoaSA+PSAwICYmIGFbaW5kZXhWZWN0b3JbaV1dID4gaG9sZCkge1xuICAgICAgICAgICAgICAgIGluZGV4VmVjdG9yW2kgKyAxXSA9IGluZGV4VmVjdG9yW2ktLV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbmRleFZlY3RvcltpICsgMV0gPSBoaTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhO1xuICAgIH07XG5cblxuICAgIC8vbm90IHN0YWJsZVxuICAgIC8vaW5kZXhWZWN0b3IgaXMgYW4gaW50ZWdlciB2ZWN0b3IgZm9yIGluZGlyZWN0aW9uIGludG8gYXJyXG4gICAgLy9hcnIgaXMgYSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIGluZGV4IGFuZCByZXR1cm5zIHRoZSBpdGVtXG4gICAgdmFyIGR1YWxQaXZvdFF1aWNrU29ydCA9IGZ1bmN0aW9uKGluZGV4VmVjdG9yLCBhcnIsIGZyb21JbmRleCwgdG9JbmRleCkge1xuICAgICAgICBpZiAoZnJvbUluZGV4ID09PSB1bmRlZmluZWQgJiYgdG9JbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkdWFsUGl2b3RRdWlja1NvcnQoaW5kZXhWZWN0b3IsIGFyciwgMCwgaW5kZXhWZWN0b3IubGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJhbmdlQ2hlY2soaW5kZXhWZWN0b3IubGVuZ3RoLCBmcm9tSW5kZXgsIHRvSW5kZXgpO1xuICAgICAgICAgICAgZHBxc29ydChpbmRleFZlY3RvciwgYXJyLCBmcm9tSW5kZXgsIHRvSW5kZXggLSAxLCAzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiByYW5nZUNoZWNrKGxlbmd0aCwgZnJvbUluZGV4LCB0b0luZGV4KSB7XG4gICAgICAgIGlmIChmcm9tSW5kZXggPiB0b0luZGV4KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdmcm9tSW5kZXgoJyArIGZyb21JbmRleCArICcpID4gdG9JbmRleCgnICsgdG9JbmRleCArICcpJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZyb21JbmRleCA8IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZnJvbUluZGV4KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9JbmRleCA+IGxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcih0b0luZGV4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN3YXAoaW5kZXhWZWN0b3IsIGFyciwgaSwgaikge1xuICAgICAgICB2YXIgdGVtcCA9IGluZGV4VmVjdG9yW2ldO1xuICAgICAgICBpbmRleFZlY3RvcltpXSA9IGluZGV4VmVjdG9yW2pdO1xuICAgICAgICBpbmRleFZlY3RvcltqXSA9IHRlbXA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZHBxc29ydChpbmRleFZlY3RvciwgYXJyLCBsZWZ0LCByaWdodCwgZGl2KSB7XG4gICAgICAgIHZhciBsZW4gPSByaWdodCAtIGxlZnQ7XG5cbiAgICAgICAgaWYgKGxlbiA8IDI3KSB7IC8vIGluc2VydGlvbiBzb3J0IGZvciB0aW55IGFycmF5XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gbGVmdCArIDE7IGkgPD0gcmlnaHQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSBpOyBqID4gbGVmdCAmJiBhcnIoaW5kZXhWZWN0b3Jbal0pIDwgYXJyKGluZGV4VmVjdG9yW2ogLSAxXSk7IGotLSkge1xuICAgICAgICAgICAgICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBhcnIsIGosIGogLSAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHRoaXJkID0gTWF0aC5mbG9vcihsZW4gLyBkaXYpOyAvL1RPRE86IGNoZWNrIGlmIHdlIG5lZWQgdG8gcm91bmQgdXAgb3IgZG93biBvciBqdXN0IG5lYXJlc3RcblxuICAgICAgICAvLyAnbWVkaWFucydcbiAgICAgICAgdmFyIG0xID0gbGVmdCArIHRoaXJkO1xuICAgICAgICB2YXIgbTIgPSByaWdodCAtIHRoaXJkO1xuXG4gICAgICAgIGlmIChtMSA8PSBsZWZ0KSB7XG4gICAgICAgICAgICBtMSA9IGxlZnQgKyAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtMiA+PSByaWdodCkge1xuICAgICAgICAgICAgbTIgPSByaWdodCAtIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFycihpbmRleFZlY3RvclttMV0pIDwgYXJyKGluZGV4VmVjdG9yW20yXSkpIHtcbiAgICAgICAgICAgIHN3YXAoaW5kZXhWZWN0b3IsIGFyciwgbTEsIGxlZnQpO1xuICAgICAgICAgICAgc3dhcChpbmRleFZlY3RvciwgYXJyLCBtMiwgcmlnaHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3dhcChpbmRleFZlY3RvciwgYXJyLCBtMSwgcmlnaHQpO1xuICAgICAgICAgICAgc3dhcChpbmRleFZlY3RvciwgYXJyLCBtMiwgbGVmdCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcGl2b3RzXG4gICAgICAgIHZhciBwaXZvdDEgPSBhcnIoaW5kZXhWZWN0b3JbbGVmdF0pO1xuICAgICAgICB2YXIgcGl2b3QyID0gYXJyKGluZGV4VmVjdG9yW3JpZ2h0XSk7XG5cbiAgICAgICAgLy8gcG9pbnRlcnNcbiAgICAgICAgdmFyIGxlc3MgPSBsZWZ0ICsgMTtcbiAgICAgICAgdmFyIGdyZWF0ID0gcmlnaHQgLSAxO1xuXG4gICAgICAgIC8vIHNvcnRpbmdcbiAgICAgICAgZm9yICh2YXIgayA9IGxlc3M7IGsgPD0gZ3JlYXQ7IGsrKykge1xuICAgICAgICAgICAgaWYgKGFycihpbmRleFZlY3RvcltrXSkgPCBwaXZvdDEpIHtcbiAgICAgICAgICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBhcnIsIGssIGxlc3MrKyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFycihpbmRleFZlY3RvcltrXSkgPiBwaXZvdDIpIHtcbiAgICAgICAgICAgICAgICB3aGlsZSAoayA8IGdyZWF0ICYmIGFycihpbmRleFZlY3RvcltncmVhdF0pID4gcGl2b3QyKSB7XG4gICAgICAgICAgICAgICAgICAgIGdyZWF0LS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN3YXAoaW5kZXhWZWN0b3IsIGFyciwgaywgZ3JlYXQtLSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJyKGluZGV4VmVjdG9yW2tdKSA8IHBpdm90MSkge1xuICAgICAgICAgICAgICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBhcnIsIGssIGxlc3MrKyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHN3YXBzXG4gICAgICAgIHZhciBkaXN0ID0gZ3JlYXQgLSBsZXNzO1xuXG4gICAgICAgIGlmIChkaXN0IDwgMTMpIHtcbiAgICAgICAgICAgIGRpdisrO1xuICAgICAgICB9XG4gICAgICAgIHN3YXAoaW5kZXhWZWN0b3IsIGFyciwgbGVzcyAtIDEsIGxlZnQpO1xuICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBhcnIsIGdyZWF0ICsgMSwgcmlnaHQpO1xuXG4gICAgICAgIC8vIHN1YmFycmF5c1xuICAgICAgICBkcHFzb3J0KGluZGV4VmVjdG9yLCBhcnIsIGxlZnQsIGxlc3MgLSAyLCBkaXYpO1xuICAgICAgICBkcHFzb3J0KGluZGV4VmVjdG9yLCBhcnIsIGdyZWF0ICsgMiwgcmlnaHQsIGRpdik7XG5cbiAgICAgICAgLy8gZXF1YWwgZWxlbWVudHNcbiAgICAgICAgaWYgKGRpc3QgPiBsZW4gLSAxMyAmJiBwaXZvdDEgIT09IHBpdm90Mikge1xuICAgICAgICAgICAgZm9yIChrID0gbGVzczsgayA8PSBncmVhdDsgaysrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFycihpbmRleFZlY3RvcltrXSkgPT09IHBpdm90MSkge1xuICAgICAgICAgICAgICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBhcnIsIGssIGxlc3MrKyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhcnIoaW5kZXhWZWN0b3Jba10pID09PSBwaXZvdDIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3dhcChpbmRleFZlY3RvciwgYXJyLCBrLCBncmVhdC0tKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJyKGluZGV4VmVjdG9yW2tdKSA9PT0gcGl2b3QxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBhcnIsIGssIGxlc3MrKyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3ViYXJyYXlcbiAgICAgICAgaWYgKHBpdm90MSA8IHBpdm90Mikge1xuICAgICAgICAgICAgZHBxc29ydChpbmRleFZlY3RvciwgYXJyLCBsZXNzLCBncmVhdCwgZGl2KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGZsYXNoU29ydDogZmxhc2hTb3J0LFxuICAgICAgICBkdWFsUGl2b3RRdWlja1NvcnQ6IGR1YWxQaXZvdFF1aWNrU29ydCxcbiAgICAgICAgdGltU29ydDogdGltU29ydCxcbiAgICAgICAgcXVpY2tTb3J0OiBxdWlja1NvcnQsXG4gICAgICAgIHN0YWJsZVF1aWNrU29ydDogc3RhYmxlUXVpY2tTb3J0LFxuICAgICAgICBtZXJnZVNvcnQ6IG1lcmdlU29ydCxcbiAgICAgICAgc3RhYmxlU29ydDogc3RhYmxlU29ydFxuICAgIH07XG5cbn0pKCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvVXRpbHMuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBKU0RhdGFTb3VyY2UgPSByZXF1aXJlKCcuL0pTRGF0YVNvdXJjZScpO1xudmFyIERhdGFTb3J0ZXIgPSByZXF1aXJlKCcuL0RhdGFTb3J0ZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBKU0RhdGFTb3VyY2U6IEpTRGF0YVNvdXJjZSxcbiAgICAgICAgRGF0YVNvcnRlcjogRGF0YVNvcnRlclxuICAgIH07XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2FuYWx5dGljcy5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIGVzbGludC1lbnYgbm9kZSwgYnJvd3NlciAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYW5hbHl0aWNzID0gcmVxdWlyZSgnLi9hbmFseXRpY3MuanMnKTtcbnZhciBzYW1wbGVEYXRhID0gcmVxdWlyZSgnLi9zYW1wbGVkYXRhLmpzJyk7XG52YXIgc29ydHMgPSByZXF1aXJlKCcuL1V0aWxzLmpzJyk7XG5cbmlmICghd2luZG93LmZpbikge1xuICAgIHdpbmRvdy5maW4gPSB7fTtcbn1cblxud2luZG93LmZpbi5hbmFseXRpY3MgPSBhbmFseXRpY3M7XG53aW5kb3cuZmluLnNhbXBsZURhdGEgPSBzYW1wbGVEYXRhO1xud2luZG93LnNvcnRzID0gc29ydHM7XG5cbndpbmRvdy5kID0gbmV3IGFuYWx5dGljcy5KU0RhdGFTb3VyY2Uoc2FtcGxlRGF0YSk7XG53aW5kb3cuczEgPSBuZXcgYW5hbHl0aWNzLkRhdGFTb3J0ZXIod2luZG93LmQpO1xud2luZG93LnMyID0gbmV3IGFuYWx5dGljcy5EYXRhU29ydGVyKHdpbmRvdy5zMSk7XG5cbnZhciBub3cgPSBEYXRlLm5vdygpO1xud2luZG93LnMxLnNvcnRPbigwKTtcbndpbmRvdy5zMi5zb3J0T24oMik7XG5jb25zb2xlLmxvZyhEYXRlLm5vdygpIC0gbm93KTtcbi8vIHZhciBjb3VudCA9IHMyLmdldFJvd0NvdW50KCk7XG4vLyBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbi8vICAgICBjb25zb2xlLmxvZyhzMi5nZXRWYWx1ZSgyLCBpKSArICdcdFx0JyArIHMyLmdldFZhbHVlKDAsIGkpKTtcbi8vIH1cblxuLy8gd2luZG93LmEgPSBbNSw0LDMsMCwzLDgsMiw5LDgsMF07XG5cbi8vIHdpbmRvdy5iID0gWydxJywndycsJ2UnLCdyJywndCcsJ3knLCd1JywnaScsJ28nLCdwJ107XG5cbi8vIHNvcnRzLnRpbXNvcnQoWzAsMSwyLDMsNCw1LDYsNyw4LDldLCB3aW5kb3cuYSk7XG4vLyBzb3J0cy50aW1zb3J0KFswLDEsMiwzLDQsNSw2LDcsOCw5XSwgd2luZG93LmIpO1xuLy8gY29uc29sZS5sb2cod2luZG93LmEsIHdpbmRvdy5iKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9mYWtlXzIzYzY2NjY2LmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIG1lcmdlKGRhdGFTb3VyY2UsIGxlZnQsIHJpZ2h0KSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgd2hpbGUgKGxlZnQubGVuZ3RoID4gMCAmJiByaWdodC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBpZiAoZGF0YVNvdXJjZShsZWZ0WzBdKSA8IGRhdGFTb3VyY2UocmlnaHRbMF0pKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobGVmdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gocmlnaHQuc2hpZnQoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdC5jb25jYXQobGVmdCkuY29uY2F0KHJpZ2h0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtZXJnZXNvcnQoaW5kZXhWZWN0b3IsIGRhdGFTb3VyY2UpIHtcbiAgICAgICAgaWYgKGluZGV4VmVjdG9yLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gaW5kZXhWZWN0b3I7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG1pZGRsZSA9IE1hdGguZmxvb3IoaW5kZXhWZWN0b3IubGVuZ3RoIC8gMik7XG4gICAgICAgIHZhciBsZWZ0ID0gaW5kZXhWZWN0b3Iuc2xpY2UoMCwgbWlkZGxlKTtcbiAgICAgICAgdmFyIHJpZ2h0ID0gaW5kZXhWZWN0b3Iuc2xpY2UobWlkZGxlKTtcbiAgICAgICAgcmV0dXJuIG1lcmdlKGRhdGFTb3VyY2UsIG1lcmdlc29ydChsZWZ0LCBkYXRhU291cmNlKSwgbWVyZ2Vzb3J0KHJpZ2h0LCBkYXRhU291cmNlKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc29ydChpbmRleFZlY3RvciwgYXJyKSB7XG4gICAgICAgIHZhciBpbmRleGVzID0gbWVyZ2Vzb3J0KGluZGV4VmVjdG9yLCBhcnIpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluZGV4VmVjdG9yLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpbmRleFZlY3RvcltpXSA9IGluZGV4ZXNbaV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc29ydDtcbn0pKCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvbWVyZ2Vzb3J0LmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBxdWlja3NvcnQgPSBmdW5jdGlvbihpbmRleFZlY3RvciwgYXJyYXksIGNvbXBhcmUpIHtcblxuICAgICAgICB2YXIgbGVzcyA9IGNvbXBhcmUgfHwgZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChhID4gYikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9O1xuXG5cbiAgICAgICAgZnVuY3Rpb24gc3dhcChpbmRleFZlY3RvciwgaXRlbXMsIGZpcnN0SW5kZXgsIHNlY29uZEluZGV4KXtcbiAgICAgICAgICAgIHZhciB0ZW1wID0gaW5kZXhWZWN0b3JbZmlyc3RJbmRleF07XG4gICAgICAgICAgICBpbmRleFZlY3RvcltmaXJzdEluZGV4XSA9IGluZGV4VmVjdG9yW3NlY29uZEluZGV4XTtcbiAgICAgICAgICAgIGluZGV4VmVjdG9yW3NlY29uZEluZGV4XSA9IHRlbXA7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiB0ZXN0TGVzcyhpbmRleFZlY3RvciwgYSwgYil7XG5cbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGxlc3MoYSwgYik7XG4gICAgICAgICAgICAvLyBpZih2YWx1ZSA9PT0gMCl7XG5cbiAgICAgICAgICAgIC8vICAgICByZXR1cm4gYS5fX3NvcnRQb3NpdGlvbiAtIGIuX19zb3J0UG9zaXRpb247XG4gICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHBhcnRpdGlvbihpbmRleFZlY3RvciwgaXRlbXMsIGxlZnQsIHJpZ2h0KSB7XG5cbiAgICAgICAgICAgIHZhciBwaXZvdCAgID0gaXRlbXMoaW5kZXhWZWN0b3JbTWF0aC5mbG9vcigocmlnaHQgKyBsZWZ0KSAvIDIpXSksXG4gICAgICAgICAgICAgICAgaSAgICAgICA9IGxlZnQsXG4gICAgICAgICAgICAgICAgaiAgICAgICA9IHJpZ2h0O1xuXG5cbiAgICAgICAgICAgIHdoaWxlIChpIDw9IGopIHtcblxuICAgICAgICAgICAgICAgIHdoaWxlICh0ZXN0TGVzcyhpbmRleFZlY3RvciwgaXRlbXMoaW5kZXhWZWN0b3JbaV0pLCBwaXZvdCkgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAodGVzdExlc3MoaW5kZXhWZWN0b3IsIHBpdm90LCBpdGVtcyhpbmRleFZlY3RvcltqXSkpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICBqLS07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGkgPD0gaikge1xuICAgICAgICAgICAgICAgICAgICBzd2FwKGl0ZW1zLCBpLCBqKTtcbiAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICBqLS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNvcnQoaW5kZXhWZWN0b3IsIGl0ZW1zLCBsZWZ0LCByaWdodCkge1xuXG4gICAgICAgICAgICB2YXIgaW5kZXg7XG5cbiAgICAgICAgICAgIGlmIChpbmRleFZlY3Rvci5sZW5ndGggPiAxKSB7XG5cbiAgICAgICAgICAgICAgICBsZWZ0ID0gdHlwZW9mIGxlZnQgIT0gXCJudW1iZXJcIiA/IDAgOiBsZWZ0O1xuICAgICAgICAgICAgICAgIHJpZ2h0ID0gdHlwZW9mIHJpZ2h0ICE9IFwibnVtYmVyXCIgPyBpbmRleFZlY3Rvci5sZW5ndGggLSAxIDogcmlnaHQ7XG5cbiAgICAgICAgICAgICAgICBpbmRleCA9IHBhcnRpdGlvbihpbmRleFZlY3RvciwgaXRlbXMsIGxlZnQsIHJpZ2h0KTtcblxuICAgICAgICAgICAgICAgIGlmIChsZWZ0IDwgaW5kZXggLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHNvcnQoaW5kZXhWZWN0b3IsIGl0ZW1zLCBsZWZ0LCBpbmRleCAtIDEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpbmRleDwgIHJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvcnQoaW5kZXhWZWN0b3IsIGl0ZW1zLCBpbmRleCwgcmlnaHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGl0ZW1zO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9hZGRQb3NpdGlvbnMoaW5kZXhWZWN0b3IsIGFycmF5KTtcbiAgICAgICAgcmV0dXJuIHNvcnQoaW5kZXhWZWN0b3IsIGFycmF5KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHF1aWNrc29ydDtcbn0pKCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvcXVpY2tzb3J0LmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBudW1Sb3dzID0gMTAwMDAwO1xuXG4gICAgdmFyIGZpcnN0TmFtZXMgPSBbJ09saXZpYScsICdTb3BoaWEnLCAnQXZhJywgJ0lzYWJlbGxhJywgJ0JveScsICdMaWFtJywgJ05vYWgnLCAnRXRoYW4nLCAnTWFzb24nLCAnTG9nYW4nLCAnTW9lJywgJ0xhcnJ5JywgJ0N1cmx5JywgJ1NoZW1wJywgJ0dyb3VjaG8nLCAnSGFycG8nLCAnQ2hpY28nLCAnWmVwcG8nLCAnU3RhbmxleScsICdIYXJkeSddO1xuICAgIHZhciBsYXN0TmFtZXMgPSBbJ1dpcnRzJywgJ09uZWlsJywgJ1NtaXRoJywgJ0JhcmJhcm9zYScsICdTb3ByYW5vJywgJ0dvdHRpJywgJ0NvbHVtYm8nLCAnTHVjaWFubycsICdEb2VycmUnLCAnRGVQZW5hJ107XG4gICAgdmFyIG1vbnRocyA9IFsnMDEnLCAnMDInLCAnMDMnLCAnMDQnLCAnMDUnLCAnMDYnLCAnMDcnLCAnMDgnLCAnMDknLCAnMTAnLCAnMTEnLCAnMTInXTtcbiAgICB2YXIgZGF5cyA9IFsnMDEnLCAnMDInLCAnMDMnLCAnMDQnLCAnMDUnLCAnMDYnLCAnMDcnLCAnMDgnLCAnMDknLCAnMTAnLCAnMTEnLCAnMTInLCAnMTMnLCAnMTQnLCAnMTUnLCAnMTYnLCAnMTcnLCAnMTgnLCAnMTknLCAnMjAnLCAnMjEnLCAnMjInLCAnMjMnLCAnMjQnLCAnMjUnLCAnMjYnLCAnMjcnLCAnMjgnLCAnMjknLCAnMzAnXTtcbiAgICB2YXIgc3RhdGVzID0gWydBbGFiYW1hJywgJ0FsYXNrYScsICdBcml6b25hJywgJ0Fya2Fuc2FzJywgJ0NhbGlmb3JuaWEnLCAnQ29sb3JhZG8nLCAnQ29ubmVjdGljdXQnLCAnRGVsYXdhcmUnLCAnRmxvcmlkYScsICdHZW9yZ2lhJywgJ0hhd2FpaScsICdJZGFobycsICdJbGxpbm9pcycsICdJbmRpYW5hJywgJ0lvd2EnLCAnS2Fuc2FzJywgJ0tlbnR1Y2t5JywgJ0xvdWlzaWFuYScsICdNYWluZScsICdNYXJ5bGFuZCcsICdNYXNzYWNodXNldHRzJywgJ01pY2hpZ2FuJywgJ01pbm5lc290YScsICdNaXNzaXNzaXBwaScsICdNaXNzb3VyaScsICdNb250YW5hJywgJ05lYnJhc2thJywgJ05ldmFkYScsICdOZXcgSGFtcHNoaXJlJywgJ05ldyBKZXJzZXknLCAnTmV3IE1leGljbycsICdOZXcgWW9yaycsICdOb3J0aCBDYXJvbGluYScsICdOb3J0aCBEYWtvdGEnLCAnT2hpbycsICdPa2xhaG9tYScsICdPcmVnb24nLCAnUGVubnN5bHZhbmlhJywgJ1Job2RlIElzbGFuZCcsICdTb3V0aCBDYXJvbGluYScsICdTb3V0aCBEYWtvdGEnLCAnVGVubmVzc2VlJywgJ1RleGFzJywgJ1V0YWgnLCAnVmVybW9udCcsICdWaXJnaW5pYScsICdXYXNoaW5ndG9uJywgJ1dlc3QgVmlyZ2luaWEnLCAnV2lzY29uc2luJywgJ1d5b21pbmcnXTtcblxuICAgIHZhciByYW5kb21GdW5jID0gTWF0aC5yYW5kb207XG4gICAgLy92YXIgcmFuZG9tRnVuYyA9IHJuZDtcblxuICAgIHZhciByYW5kb21QZXJzb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZpcnN0TmFtZSA9IE1hdGgucm91bmQoKGZpcnN0TmFtZXMubGVuZ3RoIC0gMSkgKiByYW5kb21GdW5jKCkpO1xuICAgICAgICAvL3ZhciBsYXN0TmFtZSA9ICdhJyArIHJhbmRvbUZ1bmMoKSArICdiJztcbiAgICAgICAgdmFyIGxhc3ROYW1lID0gTWF0aC5yb3VuZCgobGFzdE5hbWVzLmxlbmd0aCAtIDEpICogcmFuZG9tRnVuYygpKTtcbiAgICAgICAgdmFyIHBldHMgPSBNYXRoLnJvdW5kKDEwICogcmFuZG9tRnVuYygpKTtcbiAgICAgICAgdmFyIGJpcnRoeWVhciA9IDE5MDAgKyBNYXRoLnJvdW5kKHJhbmRvbUZ1bmMoKSAqIDExNCk7XG4gICAgICAgIHZhciBiaXJ0aG1vbnRoID0gTWF0aC5yb3VuZChyYW5kb21GdW5jKCkgKiAxMSk7XG4gICAgICAgIHZhciBiaXJ0aGRheSA9IE1hdGgucm91bmQocmFuZG9tRnVuYygpICogMjkpO1xuICAgICAgICB2YXIgYmlydGhzdGF0ZSA9IE1hdGgucm91bmQocmFuZG9tRnVuYygpICogNDkpO1xuICAgICAgICB2YXIgcmVzaWRlbmNlc3RhdGUgPSBNYXRoLnJvdW5kKHJhbmRvbUZ1bmMoKSAqIDQ5KTtcbiAgICAgICAgdmFyIHRyYXZlbCA9IHJhbmRvbUZ1bmMoKSAqIDEwMDA7XG4gICAgICAgIHZhciBpbmNvbWUgPSByYW5kb21GdW5jKCkgKiAxMDAwMDA7XG4gICAgICAgIHZhciBlbXBsb3llZCA9IE1hdGgucm91bmQocmFuZG9tRnVuYygpKTtcbiAgICAgICAgdmFyIHBlcnNvbiA9IHtcbiAgICAgICAgICAgIGxhc3RfbmFtZTogbGFzdE5hbWVzW2xhc3ROYW1lXSwgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIGZpcnN0X25hbWU6IGZpcnN0TmFtZXNbZmlyc3ROYW1lXSwgLy9qc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgICAgIHBldHM6IHBldHMsXG4gICAgICAgICAgICBiaXJ0aERhdGU6IGJpcnRoeWVhciArICctJyArIG1vbnRoc1tiaXJ0aG1vbnRoXSArICctJyArIGRheXNbYmlydGhkYXldLFxuICAgICAgICAgICAgYmlydGhTdGF0ZTogc3RhdGVzW2JpcnRoc3RhdGVdLFxuICAgICAgICAgICAgcmVzaWRlbmNlU3RhdGU6IHN0YXRlc1tyZXNpZGVuY2VzdGF0ZV0sXG4gICAgICAgICAgICBlbXBsb3llZDogZW1wbG95ZWQgPT09IDEsXG4gICAgICAgICAgICBpbmNvbWU6IGluY29tZSxcbiAgICAgICAgICAgIHRyYXZlbDogdHJhdmVsXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBwZXJzb247XG4gICAgfTtcblxuICAgIHZhciBkYXRhID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW1Sb3dzOyBpKyspIHtcbiAgICAgICAgdmFyIHBlcnNvbiA9IHJhbmRvbVBlcnNvbigpO1xuICAgICAgICBwZXJzb24ub3JkZXIgPSBpO1xuICAgICAgICBkYXRhLnB1c2gocGVyc29uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcblxufSkoKTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zYW1wbGVkYXRhLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgU29ydFR5cGVzID0ge1xuICAgIEFTQ0VORElORzpcImFzY2VuZGluZ1wiLFxuICAgIERFU0NFTkRJTkc6XCJkZXNjZW5kaW5nXCIsXG4gICAgTk9ORTpcIm5vbmVcIlxufVxuXG52YXIgY29tcGFyZSA9IGZ1bmN0aW9uKGluZGV4VmVjdG9yLCBkYXRhU291cmNlLCBmaXJzdCwgbGFzdCwgdHlwZSkge1xuICAgIC8vcmV0dXJuO1xuICAgIHZhciB4ID0gZGF0YVNvdXJjZShpbmRleFZlY3RvcltmaXJzdF0pLCB5ID0gZGF0YVNvdXJjZShpbmRleFZlY3RvcltsYXN0XSk7XG5cbiAgICBpZiAodHlwZW9mKHgpID09PSBcIm51bWJlclwiKSB7XG5cbiAgICAgICAgLy8gTnVtYmVycyBhcmUgY29tcGFyZWQgYnkgc3VidHJhY3Rpb25cbiAgICAgICAgaWYgKHR5cGUgPT09IFNvcnRUeXBlcy5BU0NFTkRJTkcpIHtcbiAgICAgICAgICAgIGlmICh5ID09PSBudWxsKSByZXR1cm4gLTE7XG4gICAgICAgICAgICByZXR1cm4geC15O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHkgPT09IG51bGwpIHJldHVybiAxO1xuICAgICAgICAgICAgcmV0dXJuIHkteDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgLy8gQW55dGhpbmcgbm90IGEgbnVtYmVyIGdldHMgY29tcGFyZWQgdXNpbmcgdGhlIHJlbGF0aW9uYWwgb3BlcmF0b3JzXG4gICAgICAgIGlmICh0eXBlID09PSBTb3J0VHlwZXMuQVNDRU5ESU5HKSB7XG4gICAgICAgICAgICBpZiAoeSA9PT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgICAgICAgICAgcmV0dXJuIHg8eT8tMToxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHkgPT09IG51bGwpIHJldHVybiAxO1xuICAgICAgICAgICAgcmV0dXJuIHk8eD8tMToxO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIHN0YWJsZVF1aWNrU29ydChpbmRleFZlY3RvciwgZGF0YVNvdXJjZSwgb25lWmVyb09yTWludXNPbmVUeXBlKSB7XG4gICAgICAgIHZhciB0eXBlO1xuICAgICAgICBpZiAob25lWmVyb09yTWludXNPbmVUeXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9uZVplcm9Pck1pbnVzT25lVHlwZSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoKG9uZVplcm9Pck1pbnVzT25lVHlwZSkge1xuICAgICAgICAgICAgY2FzZSAtMTpcbiAgICAgICAgICAgICAgICB0eXBlID0gU29ydFR5cGVzLkRFU0NFTkRJTkc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgdHlwZSA9IFNvcnRUeXBlcy5OT05FO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIHR5cGUgPSBTb3J0VHlwZXMuQVNDRU5ESU5HO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlID09PSBTb3J0VHlwZXMuTk9ORSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbmRleFZlY3Rvci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGluZGV4VmVjdG9yW2ldID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBxdWlja3NvcnQoaW5kZXhWZWN0b3IsIGRhdGFTb3VyY2UsIDEsIGluZGV4VmVjdG9yLmxlbmd0aCAtIDEsIHR5cGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN3YXAoaW5kZXhWZWN0b3IsIHgsIHkpIHtcbiAgICAgICAgdmFyIHRtcCA9IGluZGV4VmVjdG9yW3hdO1xuICAgICAgICBpbmRleFZlY3Rvclt4XSA9IGluZGV4VmVjdG9yW3ldO1xuICAgICAgICBpbmRleFZlY3Rvclt5XSA9IHRtcDtcbiAgICAgICAgaWYgKHRtcCA9PT0gdW5kZWZpbmVkIHx8IGluZGV4VmVjdG9yW3hdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdoYWx0Jyk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHF1aWNrc29ydChpbmRleFZlY3RvciwgZGF0YVNvdXJjZSwgZmlyc3QsIGxhc3QsIHR5cGUpIHtcbiAgICAgICAgLy8gSW4gcGxhY2UgcXVpY2tzdG9ydCwgc3RhYmxlLiAgV2UgY2FudCB1c2UgdGhlIGluYnVpbHQgQXJyYXkuc29ydCgpIHNpbmNlIGl0cyBhIGh5YnJpZCBzb3J0XG4gICAgICAgIC8vIHBvdGVudGlhbGx5IGFuZCBtYXkgbm90IGJlIHN0YWJsZSAobm9uIHF1aWNrc29ydCkgb24gc21hbGwgc2l6ZXMuXG4gICAgICAgIC8vIGlmICgxID09PSAxKSB7XG4gICAgICAgIC8vICAgICByZXR1cm47XG4gICAgICAgIC8vIH1cbiAgICAgICAgd2hpbGUgKGZpcnN0IDwgbGFzdClcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHJpZ2h0ICAgPSBsYXN0O1xuICAgICAgICAgICAgdmFyIGxlZnQgICAgPSBmaXJzdDtcbiAgICAgICAgICAgIHZhciBwaXZvdCA9IChmaXJzdCtsYXN0KT4+MTtcblxuICAgICAgICAgICAgaWYgKHBpdm90IDwgMCB8fCBwaXZvdCA+PSBsYXN0KSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdoaWxlKHJpZ2h0ID49IGxlZnQpIHtcblxuICAgICAgICAgICAgICAgIHdoaWxlIChsZWZ0IDw9IHJpZ2h0ICYmIGNvbXBhcmUoaW5kZXhWZWN0b3IsIGRhdGFTb3VyY2UsIGxlZnQsIHBpdm90LCB0eXBlKSA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICsrbGVmdDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAobGVmdCA8PSByaWdodCAmJiBjb21wYXJlKGluZGV4VmVjdG9yLCBkYXRhU291cmNlLCByaWdodCwgcGl2b3QsIHR5cGUpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAtLXJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsZWZ0ID4gcmlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc3dhcChpbmRleFZlY3RvciwgbGVmdCxyaWdodCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocGl2b3QgPT09IHJpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHBpdm90ID0gbGVmdDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZWZ0Kys7XG4gICAgICAgICAgICAgICAgcmlnaHQtLTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzd2FwKGluZGV4VmVjdG9yLCBwaXZvdCwgcmlnaHQpO1xuICAgICAgICAgICAgcmlnaHQtLTtcblxuICAgICAgICAgICAgLy8gVXNlIHJlY3Vyc2lvbiB0byBzb3J0IHRoZSBzbWFsbGVzdCBwYXJ0aXRpb24sIHRoaXMgaW5jcmVhc2VzIHBlcmZvcm1hbmNlLlxuICAgICAgICAgICAgaWYgKE1hdGguYWJzKHJpZ2h0LWZpcnN0KSA+IE1hdGguYWJzKGxhc3QtbGVmdCkpIHtcbiAgICAgICAgICAgICAgICBpZiAobGVmdCA8IGxhc3QpIHF1aWNrc29ydChpbmRleFZlY3RvciwgZGF0YVNvdXJjZSwgbGVmdCwgbGFzdCwgdHlwZSk7XG4gICAgICAgICAgICAgICAgbGFzdCA9IHJpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSAge1xuICAgICAgICAgICAgICAgIGlmIChmaXJzdCA8IHJpZ2h0KSBxdWlja3NvcnQoaW5kZXhWZWN0b3IsIGRhdGFTb3VyY2UsIGZpcnN0LCByaWdodCwgdHlwZSk7XG4gICAgICAgICAgICAgICAgZmlyc3QgPSBsZWZ0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YWJsZVF1aWNrU29ydDtcblxufSkoKTtcblxuXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc3RhYmxlUXVpY2tTb3J0LmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RhYmlsaXplICA9IGZ1bmN0aW9uKGNvbXBhcmF0b3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oYXJyMSwgYXJyMikge1xuICAgICAgICB2YXIgeCA9IGFycjFbMF07XG4gICAgICAgIHZhciB5ID0gYXJyMlswXTtcbiAgICAgICAgaWYgKHggPT09IHkpIHtcbiAgICAgICAgICAgIHggPSBhcnIxWzFdO1xuICAgICAgICAgICAgeSA9IGFycjJbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoeSA9PT0gbnVsbCkge3JldHVybiAtMTt9XG4gICAgICAgICAgICBpZiAoeCA9PT0gbnVsbCkge3JldHVybiAxO31cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcGFyYXRvcih4LCB5KTtcbiAgICB9O1xufTtcblxuXG52YXIgYXNjZW5kaW5nTnVtYmVycyA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4geCAtIHk7XG59O1xuXG52YXIgZGVzY2VuZGluZ051bWJlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHkgLSB4O1xufTtcblxudmFyIGFzY2VuZGluZ0FsbE90aGVycyA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4geCA8IHkgPyAtMSA6IDE7XG59O1xuXG52YXIgZGVzY2VuZGluZ0FsbE90aGVycyA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4geSA8IHggPyAtMSA6IDE7XG59O1xuXG52YXIgYXNjZW5kaW5nID0gZnVuY3Rpb24odHlwZU9mRGF0YSkge1xuICAgIGlmICh0eXBlT2ZEYXRhID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHJldHVybiBzdGFiaWxpemUoYXNjZW5kaW5nTnVtYmVycyk7XG4gICAgfVxuICAgIHJldHVybiBzdGFiaWxpemUoYXNjZW5kaW5nQWxsT3RoZXJzKTtcbn07XG5cbnZhciBkZXNjZW5kaW5nID0gZnVuY3Rpb24odHlwZU9mRGF0YSkge1xuICAgIGlmICh0eXBlT2ZEYXRhID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHJldHVybiBzdGFiaWxpemUoZGVzY2VuZGluZ051bWJlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhYmlsaXplKGRlc2NlbmRpbmdBbGxPdGhlcnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICBmdW5jdGlvbiBzb3J0KGluZGV4VmVjdG9yLCBkYXRhU291cmNlLCBzb3J0VHlwZSkge1xuXG4gICAgICAgIHZhciBjb21wYXJlO1xuXG4gICAgICAgIHNvcnRUeXBlID0gc29ydFR5cGUgfHwgMTtcblxuICAgICAgICBpZiAoaW5kZXhWZWN0b3IubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vbm90aGluZyB0byBkbztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vY2hlY2sgaWYgd2UgbmVlZCB0byByZXNldCB0aGUgaW5kZXhlcyBmb3IgYSBubyBzb3J0XG4gICAgICAgIGlmIChzb3J0VHlwZSA9PT0gMCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAwOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbmRleFZlY3RvcltpXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdHlwZU9mRGF0YSA9IHR5cGVvZiBkYXRhU291cmNlKDApO1xuXG4gICAgICAgIGNvbXBhcmUgPSAoc29ydFR5cGUgPT09IC0xKSA/IGFzY2VuZGluZyh0eXBlT2ZEYXRhKSA6IGRlc2NlbmRpbmcodHlwZU9mRGF0YSk7XG5cbiAgICAgICAgLy9zdGFydCB0aGUgYWN0dWFsbHkgc29ydGluZy4uLi4uXG4gICAgICAgIHZhciB0bXAgPSBuZXcgQXJyYXkoaW5kZXhWZWN0b3IubGVuZ3RoKTtcblxuICAgICAgICAvL2xldHMgYWRkIHRoZSBpbmRleCBmb3Igc3RhYmlsaXR5XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5kZXhWZWN0b3IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRtcFtpXSA9IFtkYXRhU291cmNlKGkpLCBpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRtcC5zb3J0KGNvbXBhcmUpO1xuXG4gICAgICAgIC8vY29weSB0aGUgc29ydGVkIHZhbHVlcyBpbnRvIG91ciBpbmRleCB2ZWN0b3JcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbmRleFZlY3Rvci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaW5kZXhWZWN0b3JbaV0gPSB0bXBbaV1bMV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc29ydDtcbn0pKCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvc3RhYmxlU29ydC5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgdGltc29ydCA9IGZ1bmN0aW9uKGluZGV4VmVjdG9yLCBhcnJheSwgY29tcCkge1xuXG4gICAgICAgIHZhciBnbG9iYWxBID0gYXJyYXk7XG4gICAgICAgIHZhciBNSU5fTUVSR0UgPSAzMjtcbiAgICAgICAgdmFyIE1JTl9HQUxMT1AgPSA3XG4gICAgICAgIHZhciBydW5CYXNlID0gW107XG4gICAgICAgIHZhciBydW5MZW4gPSBbXTtcbiAgICAgICAgdmFyIHN0YWNrU2l6ZSA9IDA7XG4gICAgICAgIHZhciBjb21wYXJlID0gY29tcCB8fCBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGEgPCBiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgc29ydChpbmRleFZlY3RvciwgYXJyYXksIDAsIGluZGV4VmVjdG9yLmxlbmd0aCwgY29tcGFyZSk7XG5cbiAgICAgICAgIGZ1bmN0aW9uIHNvcnQgKGluZGV4VmVjdG9yLCBhLCBsbywgaGksIGNvbXBhcmUpIHtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29tcGFyZSAhPSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ29tcGFyZSBpcyBub3QgYSBmdW5jdGlvbi5cIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzdGFja1NpemUgPSAwO1xuICAgICAgICAgICAgICAgIHJ1bkJhc2U9W107XG4gICAgICAgICAgICAgICAgcnVuTGVuPVtdO1xuXG4gICAgICAgICAgICAgICAgcmFuZ2VDaGVjayhpbmRleFZlY3Rvci5sZW5ndGgsIGxvLCBoaSk7XG4gICAgICAgICAgICAgICAgdmFyIG5SZW1haW5pbmcgPSBoaSAtIGxvO1xuICAgICAgICAgICAgICAgIGlmIChuUmVtYWluaW5nIDwgMikgcmV0dXJuOyAvLyBBcnJheXMgb2Ygc2l6ZSAwIGFuZCAxIGFyZSBhbHdheXMgc29ydGVkXG5cblxuICAgICAgICAgICAgICAgIGlmIChuUmVtYWluaW5nIDwgTUlOX01FUkdFKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbml0UnVuTGVuID0gY291bnRSdW5BbmRNYWtlQXNjZW5kaW5nKGluZGV4VmVjdG9yLCBhLCBsbywgaGksIGNvbXBhcmUpO1xuICAgICAgICAgICAgICAgICAgICBiaW5hcnlTb3J0KGluZGV4VmVjdG9yLCBhLCBsbywgaGksIGxvICsgaW5pdFJ1bkxlbiwgY29tcGFyZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgIHZhciB0cyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBtaW5SdW4gPSBtaW5SdW5MZW5ndGgoaW5kZXhWZWN0b3IsIG5SZW1haW5pbmcpO1xuICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSWRlbnRpZnkgbmV4dCBydW5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ1bkxlblZhciA9IGNvdW50UnVuQW5kTWFrZUFzY2VuZGluZyhpbmRleFZlY3RvciwgYSwgbG8sIGhpLCBjb21wYXJlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJZiBydW4gaXMgc2hvcnQsIGV4dGVuZCB0byBtaW4obWluUnVuLCBuUmVtYWluaW5nKVxuICAgICAgICAgICAgICAgICAgICBpZiAocnVuTGVuVmFyIDwgbWluUnVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZm9yY2UgPSBuUmVtYWluaW5nIDw9IG1pblJ1biA/IG5SZW1haW5pbmcgOiBtaW5SdW47XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5hcnlTb3J0KGluZGV4VmVjdG9yLCBhLCBsbywgbG8gKyBmb3JjZSwgbG8gKyBydW5MZW5WYXIsIGNvbXBhcmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcnVuTGVuVmFyID0gZm9yY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBQdXNoIHJ1biBvbnRvIHBlbmRpbmctcnVuIHN0YWNrLCBhbmQgbWF5YmUgbWVyZ2VcbiAgICAgICAgICAgICAgICAgICAgcHVzaFJ1bihpbmRleFZlY3RvciwgbG8sIHJ1bkxlblZhcik7XG4gICAgICAgICAgICAgICAgICAgIG1lcmdlQ29sbGFwc2UoaW5kZXhWZWN0b3IpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkdmFuY2UgdG8gZmluZCBuZXh0IHJ1blxuICAgICAgICAgICAgICAgICAgICBsbyArPSBydW5MZW5WYXI7XG4gICAgICAgICAgICAgICAgICAgIG5SZW1haW5pbmcgLT0gcnVuTGVuVmFyO1xuICAgICAgICAgICAgICAgIH0gd2hpbGUgKG5SZW1haW5pbmcgIT0gMCk7XG5cbiAgICAgICAgICAgICAgICAvLyBNZXJnZSBhbGwgcmVtYWluaW5nIHJ1bnMgdG8gY29tcGxldGUgc29ydFxuICAgICAgICAgICAgICAgIG1lcmdlRm9yY2VDb2xsYXBzZShpbmRleFZlY3Rvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYmluYXJ5U29ydChpbmRleFZlY3RvciwgYSwgbG8sIGhpLCBzdGFydCwgY29tcGFyZSkge1xuICAgICAgICAgICAgaWYgKHN0YXJ0ID09IGxvKSBzdGFydCsrO1xuICAgICAgICAgICAgZm9yICg7IHN0YXJ0IDwgaGk7IHN0YXJ0KyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcGl2b3QgPSBpbmRleFZlY3RvcltzdGFydF07XG5cbiAgICAgICAgICAgICAgICB2YXIgbGVmdCA9IGxvO1xuICAgICAgICAgICAgICAgIHZhciByaWdodCA9IHN0YXJ0O1xuICAgICAgICAgICAgICAgd2hpbGUgKGxlZnQgPCByaWdodCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWlkID0gKGxlZnQgKyByaWdodCkgPj4+IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wYXJlKGEocGl2b3QpLCBhKGluZGV4VmVjdG9yW21pZF0pKSA8IDApXG4gICAgICAgICAgICAgICAgICAgICAgICByaWdodCA9IG1pZDtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGVmdCA9IG1pZCArIDE7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgIHZhciBuID0gc3RhcnQgLSBsZWZ0O1xuXG4gICAgICAgICAgICAgICAgc3dpdGNoIChuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgICAgIChpbmRleFZlY3RvcltsZWZ0ICsgMl0pID0gKGluZGV4VmVjdG9yW2xlZnQgKyAxXSk7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgICAgIChpbmRleFZlY3RvcltsZWZ0ICsgMV0pID0gKGluZGV4VmVjdG9yW2xlZnRdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXljb3B5KGluZGV4VmVjdG9yLCBhLCBsZWZ0LCBhLCBsZWZ0ICsgMSwgbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGluZGV4VmVjdG9yW2xlZnRdID0gcGl2b3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjb3VudFJ1bkFuZE1ha2VBc2NlbmRpbmcoaW5kZXhWZWN0b3IsIGEsIGxvLCBoaSwgY29tcGFyZSkge1xuICAgICAgICAgICAgdmFyIHJ1bkhpID0gbG8gKyAxO1xuXG5cbiAgICAgICAgICAgIGlmIChjb21wYXJlKGEoaW5kZXhWZWN0b3JbcnVuSGkrK10pLCBhKGluZGV4VmVjdG9yW2xvXSkpIDwgMCkgeyAvLyBEZXNjZW5kaW5nXG4gICAgICAgICAgICAgICAgd2hpbGUgKHJ1bkhpIDwgaGkgJiYgY29tcGFyZShhKGluZGV4VmVjdG9yW3J1bkhpXSksIGEoaW5kZXhWZWN0b3JbcnVuSGkgLSAxXSkpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICBydW5IaSsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXZlcnNlUmFuZ2UoaW5kZXhWZWN0b3IsIGEsIGxvLCBydW5IaSk7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBBc2NlbmRpbmdcbiAgICAgICAgICAgICAgICB3aGlsZSAocnVuSGkgPCBoaSAmJiBjb21wYXJlKGEoaW5kZXhWZWN0b3JbcnVuSGldKSwgYShpbmRleFZlY3RvcltydW5IaSAtIDFdKSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICBydW5IaSsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJ1bkhpIC0gbG87XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiByZXZlcnNlUmFuZ2UoaW5kZXhWZWN0b3IsIGEsIGxvLCBoaSkge1xuICAgICAgICAgICAgaGktLTtcbiAgICAgICAgICAgIHdoaWxlIChsbyA8IGhpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHQgPSBpbmRleFZlY3Rvcltsb107XG4gICAgICAgICAgICAgICAgaW5kZXhWZWN0b3JbbG8rK10gPSBpbmRleFZlY3RvcltoaV07XG4gICAgICAgICAgICAgICAgaW5kZXhWZWN0b3JbaGktLV0gPSB0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbWluUnVuTGVuZ3RoKGluZGV4VmVjdG9yLCBuKSB7XG4gICAgICAgICAgICB2YXIgciA9IDA7XG4gICAgICAgICAgICByZXR1cm4gbiArIDE7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwdXNoUnVuKGluZGV4VmVjdG9yLCBydW5CYXNlQXJnLCBydW5MZW5BcmcpIHtcbiAgICAgICAgICAgIHJ1bkJhc2Vbc3RhY2tTaXplXSA9IHJ1bkJhc2VBcmc7XG4gICAgICAgICAgICBydW5MZW5bc3RhY2tTaXplXSA9IHJ1bkxlbkFyZztcbiAgICAgICAgICAgIHN0YWNrU2l6ZSsrO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbWVyZ2VDb2xsYXBzZShpbmRleFZlY3Rvcikge1xuICAgICAgICAgICAgd2hpbGUgKHN0YWNrU2l6ZSA+IDEpIHtcbiAgICAgICAgICAgICAgICB2YXIgbiA9IHN0YWNrU2l6ZSAtIDI7XG4gICAgICAgICAgICAgICAgaWYgKG4gPiAwICYmIHJ1bkxlbltuIC0gMV0gPD0gcnVuTGVuW25dICsgcnVuTGVuW24gKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocnVuTGVuW24gLSAxXSA8IHJ1bkxlbltuICsgMV0pIG4tLTtcbiAgICAgICAgICAgICAgICAgICAgbWVyZ2VBdChpbmRleFZlY3Rvciwgbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChydW5MZW5bbl0gPD0gcnVuTGVuW24gKyAxXSkge1xuICAgICAgICAgICAgICAgICAgICBtZXJnZUF0KGluZGV4VmVjdG9yLCBuKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBicmVhazsgLy8gSW52YXJpYW50IGlzIGVzdGFibGlzaGVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbWVyZ2VGb3JjZUNvbGxhcHNlKGluZGV4VmVjdG9yKSB7XG4gICAgICAgICAgICB3aGlsZSAoc3RhY2tTaXplID4gMSkge1xuICAgICAgICAgICAgICAgIHZhciBuID0gc3RhY2tTaXplIC0gMjtcbiAgICAgICAgICAgICAgICBpZiAobiA+IDAgJiYgcnVuTGVuW24gLSAxXSA8IHJ1bkxlbltuICsgMV0pIG4tLTtcbiAgICAgICAgICAgICAgICBtZXJnZUF0KGluZGV4VmVjdG9yLCBuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIG1lcmdlQXQoaW5kZXhWZWN0b3IsIGkpIHtcblxuICAgICAgICAgICAgdmFyIGJhc2UxID0gcnVuQmFzZVtpXTtcbiAgICAgICAgICAgIHZhciBsZW4xID0gcnVuTGVuW2ldO1xuICAgICAgICAgICAgdmFyIGJhc2UyID0gcnVuQmFzZVtpICsgMV07XG4gICAgICAgICAgICB2YXIgbGVuMiA9IHJ1bkxlbltpICsgMV07XG5cbiAgICAgICAgICAgIHJ1bkxlbltpXSA9IGxlbjEgKyBsZW4yO1xuICAgICAgICAgICAgaWYgKGkgPT0gc3RhY2tTaXplIC0gMykge1xuICAgICAgICAgICAgICAgIHJ1bkJhc2VbaSArIDFdID0gcnVuQmFzZVtpICsgMl07XG4gICAgICAgICAgICAgICAgcnVuTGVuW2kgKyAxXSA9IHJ1bkxlbltpICsgMl07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGFja1NpemUtLTtcblxuICAgICAgICAgICAgdmFyIGsgPSBnYWxsb3BSaWdodChpbmRleFZlY3RvciwgZ2xvYmFsQShpbmRleFZlY3RvcltiYXNlMl0pLCBnbG9iYWxBLCBiYXNlMSwgbGVuMSwgMCwgY29tcGFyZSk7XG4gICAgICAgICAgICBiYXNlMSArPSBrO1xuICAgICAgICAgICAgbGVuMSAtPSBrO1xuICAgICAgICAgICAgaWYgKGxlbjEgPT0gMCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBsZW4yID0gZ2FsbG9wTGVmdChpbmRleFZlY3RvciwgZ2xvYmFsQShpbmRleFZlY3RvcltiYXNlMSArIGxlbjEgLSAxXSksIGdsb2JhbEEsIGJhc2UyLCBsZW4yLCBsZW4yIC0gMSwgY29tcGFyZSk7XG5cbiAgICAgICAgICAgIGlmIChsZW4yID09IDApIHJldHVybjtcblxuICAgICAgICAgICAgaWYgKGxlbjEgPD0gbGVuMilcbiAgICAgICAgICAgICAgICBtZXJnZUxvKGluZGV4VmVjdG9yLCBiYXNlMSwgbGVuMSwgYmFzZTIsIGxlbjIpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIG1lcmdlSGkoaW5kZXhWZWN0b3IsIGJhc2UxLCBsZW4xLCBiYXNlMiwgbGVuMik7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnYWxsb3BMZWZ0KGluZGV4VmVjdG9yLCBrZXksIGEsIGJhc2UsIGxlbiwgaGludCwgY29tcGFyZSkge1xuICAgICAgICAgICAgdmFyIGxhc3RPZnMgPSAwO1xuICAgICAgICAgICAgdmFyIG9mcyA9IDE7XG4gICAgICAgICAgICBpZiAoY29tcGFyZShrZXksIGEoaW5kZXhWZWN0b3JbYmFzZSArIGhpbnRdKSkgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gR2FsbG9wIHJpZ2h0IHVudGlsIGEoaW5kZXhWZWN0b3JbYmFzZStoaW50K2xhc3RPZnNdIDwga2V5IDw9IGEoaW5kZXhWZWN0b3JbYmFzZStoaW50K29mc11cbiAgICAgICAgICAgICAgICB2YXIgbWF4T2ZzID0gbGVuIC0gaGludDtcbiAgICAgICAgICAgICAgICB3aGlsZSAob2ZzIDwgbWF4T2ZzICYmIGNvbXBhcmUoa2V5LCBhKGluZGV4VmVjdG9yW2Jhc2UgKyBoaW50ICsgb2ZzXSkpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBsYXN0T2ZzID0gb2ZzO1xuICAgICAgICAgICAgICAgICAgICBvZnMgPSAob2ZzIDw8IDEpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9mcyA8PSAwKSAvLyBpbnQgb3ZlcmZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mcyA9IG1heE9mcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9mcyA+IG1heE9mcykgb2ZzID0gbWF4T2ZzO1xuXG4gICAgICAgICAgICAgICAgLy8gTWFrZSBvZmZzZXRzIHJlbGF0aXZlIHRvIGJhc2VcbiAgICAgICAgICAgICAgICBsYXN0T2ZzICs9IGhpbnQ7XG4gICAgICAgICAgICAgICAgb2ZzICs9IGhpbnQ7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBrZXkgPD0gYShpbmRleFZlY3RvcltiYXNlICsgaGludF1cbiAgICAgICAgICAgICAgICAvLyBHYWxsb3AgbGVmdCB1bnRpbCBhKGluZGV4VmVjdG9yW2Jhc2UraGludC1vZnNdIDwga2V5IDw9IGEoaW5kZXhWZWN0b3JbYmFzZStoaW50LWxhc3RPZnNdXG4gICAgICAgICAgICAgICAgdmFyIG1heE9mcyA9IGhpbnQgKyAxO1xuICAgICAgICAgICAgICAgIHdoaWxlIChvZnMgPCBtYXhPZnMgJiYgY29tcGFyZShrZXksIGEoaW5kZXhWZWN0b3JbYmFzZSArIGhpbnQgLSBvZnNdKSkgPD0gMCkge1xuICAgICAgICAgICAgICAgICAgICBsYXN0T2ZzID0gb2ZzO1xuICAgICAgICAgICAgICAgICAgICBvZnMgPSAob2ZzIDw8IDEpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9mcyA8PSAwKSAvLyBpbnQgb3ZlcmZsb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mcyA9IG1heE9mcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9mcyA+IG1heE9mcykgb2ZzID0gbWF4T2ZzO1xuXG4gICAgICAgICAgICAgICAgLy8gTWFrZSBvZmZzZXRzIHJlbGF0aXZlIHRvIGJhc2VcbiAgICAgICAgICAgICAgICB2YXIgdG1wID0gbGFzdE9mcztcbiAgICAgICAgICAgICAgICBsYXN0T2ZzID0gaGludCAtIG9mcztcbiAgICAgICAgICAgICAgICBvZnMgPSBoaW50IC0gdG1wO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdE9mcysrO1xuICAgICAgICAgICAgd2hpbGUgKGxhc3RPZnMgPCBvZnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgbSA9IGxhc3RPZnMgKyAoKG9mcyAtIGxhc3RPZnMpID4+PiAxKTtcblxuICAgICAgICAgICAgICAgIGlmIChjb21wYXJlKGtleSwgYShpbmRleFZlY3RvcltiYXNlICsgbV0pKSA+IDApXG4gICAgICAgICAgICAgICAgICAgIGxhc3RPZnMgPSBtICsgMTsgLy8gYVtiYXNlICsgbV0gPCBrZXlcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIG9mcyA9IG07IC8vIGtleSA8PSBhW2Jhc2UgKyBtXVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9mcztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdhbGxvcFJpZ2h0KGluZGV4VmVjdG9yLCBrZXksIGEsIGJhc2UsIGxlbiwgaGludCwgY29tcGFyZSkge1xuXG4gICAgICAgICAgICB2YXIgb2ZzID0gMTtcbiAgICAgICAgICAgIHZhciBsYXN0T2ZzID0gMDtcbiAgICAgICAgICAgIGlmIChjb21wYXJlKGtleSwgYVtiYXNlICsgaGludF0pIDwgMCkge1xuICAgICAgICAgICAgICAgIC8vIEdhbGxvcCBsZWZ0IHVudGlsIGFbYitoaW50IC0gb2ZzXSA8PSBrZXkgPCBhW2IraGludCAtIGxhc3RPZnNdXG4gICAgICAgICAgICAgICAgdmFyIG1heE9mcyA9IGhpbnQgKyAxO1xuICAgICAgICAgICAgICAgIHdoaWxlIChvZnMgPCBtYXhPZnMgJiYgY29tcGFyZShrZXksIGFbYmFzZSArIGhpbnQgLSBvZnNdKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGFzdE9mcyA9IG9mcztcbiAgICAgICAgICAgICAgICAgICAgb2ZzID0gKG9mcyA8PCAxKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvZnMgPD0gMCkgLy8gaW50IG92ZXJmbG93XG4gICAgICAgICAgICAgICAgICAgICAgICBvZnMgPSBtYXhPZnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvZnMgPiBtYXhPZnMpIG9mcyA9IG1heE9mcztcblxuICAgICAgICAgICAgICAgIC8vIE1ha2Ugb2Zmc2V0cyByZWxhdGl2ZSB0byBiXG4gICAgICAgICAgICAgICAgdmFyIHRtcCA9IGxhc3RPZnM7XG4gICAgICAgICAgICAgICAgbGFzdE9mcyA9IGhpbnQgLSBvZnM7XG4gICAgICAgICAgICAgICAgb2ZzID0gaGludCAtIHRtcDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIGFbYiArIGhpbnRdIDw9IGtleVxuICAgICAgICAgICAgICAgIC8vIEdhbGxvcCByaWdodCB1bnRpbCBhW2IraGludCArIGxhc3RPZnNdIDw9IGtleSA8IGFbYitoaW50ICsgb2ZzXVxuICAgICAgICAgICAgICAgIHZhciBtYXhPZnMgPSBsZW4gLSBoaW50O1xuICAgICAgICAgICAgICAgIHdoaWxlIChvZnMgPCBtYXhPZnMgJiYgY29tcGFyZShrZXksIGFbYmFzZSArIGhpbnQgKyBvZnNdKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RPZnMgPSBvZnM7XG4gICAgICAgICAgICAgICAgICAgIG9mcyA9IChvZnMgPDwgMSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2ZzIDw9IDApIC8vIGludCBvdmVyZmxvd1xuICAgICAgICAgICAgICAgICAgICAgICAgb2ZzID0gbWF4T2ZzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob2ZzID4gbWF4T2ZzKSBvZnMgPSBtYXhPZnM7XG5cbiAgICAgICAgICAgICAgICAvLyBNYWtlIG9mZnNldHMgcmVsYXRpdmUgdG8gYlxuICAgICAgICAgICAgICAgIGxhc3RPZnMgKz0gaGludDtcbiAgICAgICAgICAgICAgICBvZnMgKz0gaGludDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAqIE5vdyBhW2IgKyBsYXN0T2ZzXSA8PSBrZXkgPCBhW2IgKyBvZnNdLCBzbyBrZXkgYmVsb25ncyBzb21ld2hlcmUgdG8gdGhlIHJpZ2h0IG9mIGxhc3RPZnMgYnV0IG5vIGZhcnRoZXIgcmlnaHQgdGhhbiBvZnMuXG4gICAgICAgICAgICAgKiBEbyBhIGJpbmFyeSBzZWFyY2gsIHdpdGggaW52YXJpYW50IGFbYiArIGxhc3RPZnMgLSAxXSA8PSBrZXkgPCBhW2IgKyBvZnNdLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBsYXN0T2ZzKys7XG4gICAgICAgICAgICB3aGlsZSAobGFzdE9mcyA8IG9mcykge1xuICAgICAgICAgICAgICAgIHZhciBtID0gbGFzdE9mcyArICgob2ZzIC0gbGFzdE9mcykgPj4+IDEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvbXBhcmUoa2V5LCBhW2Jhc2UgKyBtXSkgPCAwKVxuICAgICAgICAgICAgICAgICAgICBvZnMgPSBtOyAvLyBrZXkgPCBhW2IgKyBtXVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgbGFzdE9mcyA9IG0gKyAxOyAvLyBhW2IgKyBtXSA8PSBrZXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvZnM7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBtZXJnZUxvKGluZGV4VmVjdG9yLCBiYXNlMSwgbGVuMSwgYmFzZTIsIGxlbjIpIHtcblxuICAgICAgICAgICAgLy8gQ29weSBmaXJzdCBydW4gaW50byB0ZW1wIGFycmF5XG4gICAgICAgICAgICB2YXIgYSA9IGdsb2JhbEE7IC8vIEZvciBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgdmFyIHRtcCA9IGEuc2xpY2UoYmFzZTEsIGJhc2UxICsgbGVuMSk7XG5cbiAgICAgICAgICAgIHZhciBjdXJzb3IxID0gMDsgLy8gSW5kZXhlcyBpbnRvIHRtcCBhcnJheVxuICAgICAgICAgICAgdmFyIGN1cnNvcjIgPSBiYXNlMjsgLy8gSW5kZXhlcyBpbnQgYVxuICAgICAgICAgICAgdmFyIGRlc3QgPSBiYXNlMTsgLy8gSW5kZXhlcyBpbnQgYVxuXG4gICAgICAgICAgICAvLyBNb3ZlIGZpcnN0IGVsZW1lbnQgb2Ygc2Vjb25kIHJ1biBhbmQgZGVhbCB3aXRoIGRlZ2VuZXJhdGUgY2FzZXNcbiAgICAgICAgICAgIGFbZGVzdCsrXSA9IGFbY3Vyc29yMisrXTtcbiAgICAgICAgICAgIGlmICgtLWxlbjIgPT0gMCkge1xuICAgICAgICAgICAgICAgIGFycmF5Y29weSh0bXAsIGN1cnNvcjEsIGEsIGRlc3QsIGxlbjEpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsZW4xID09IDEpIHtcbiAgICAgICAgICAgICAgICBhcnJheWNvcHkoYSwgY3Vyc29yMiwgYSwgZGVzdCwgbGVuMik7XG4gICAgICAgICAgICAgICAgYVtkZXN0ICsgbGVuMl0gPSB0bXBbY3Vyc29yMV07IC8vIExhc3QgZWx0IG9mIHJ1biAxIHRvIGVuZCBvZiBtZXJnZVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGMgPSBjb21wYXJlOyAvLyBVc2UgbG9jYWwgdmFyaWFibGUgZm9yIHBlcmZvcm1hbmNlXG5cbiAgICAgICAgICAgIHZhciBtaW5HYWxsb3AgPSBNSU5fR0FMTE9QOyAvLyBcIiAgICBcIiBcIiAgICAgXCIgXCJcbiAgICAgICAgICAgIG91dGVyOiB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgICAgIHZhciBjb3VudDEgPSAwOyAvLyBOdW1iZXIgb2YgdGltZXMgaW4gYSByb3cgdGhhdCBmaXJzdCBydW4gd29uXG4gICAgICAgICAgICAgICAgdmFyIGNvdW50MiA9IDA7IC8vIE51bWJlciBvZiB0aW1lcyBpbiBhIHJvdyB0aGF0IHNlY29uZCBydW4gd29uXG5cbiAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAqIERvIHRoZSBzdHJhaWdodGZvcndhcmQgdGhpbmcgdW50aWwgKGlmIGV2ZXIpIG9uZSBydW4gc3RhcnRzIHdpbm5pbmcgY29uc2lzdGVudGx5LlxuICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBhcmUoYVtjdXJzb3IyXSwgdG1wW2N1cnNvcjFdKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFbZGVzdCsrXSA9IGFbY3Vyc29yMisrXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50MisrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQxID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgtLWxlbjIgPT0gMCkgYnJlYWsgb3V0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhW2Rlc3QrK10gPSB0bXBbY3Vyc29yMSsrXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50MSsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY291bnQyID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgtLWxlbjEgPT0gMSkgYnJlYWsgb3V0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IHdoaWxlICgoY291bnQxIHwgY291bnQyKSA8IG1pbkdhbGxvcCk7XG5cbiAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAqIE9uZSBydW4gaXMgd2lubmluZyBzbyBjb25zaXN0ZW50bHkgdGhhdCBnYWxsb3BpbmcgbWF5IGJlIGEgaHVnZSB3aW4uIFNvIHRyeSB0aGF0LCBhbmQgY29udGludWUgZ2FsbG9waW5nIHVudGlsIChpZlxuICAgICAgICAgICAgICAgICAqIGV2ZXIpIG5laXRoZXIgcnVuIGFwcGVhcnMgdG8gYmUgd2lubmluZyBjb25zaXN0ZW50bHkgYW55bW9yZS5cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50MSA9IGdhbGxvcFJpZ2h0KGFbY3Vyc29yMl0sIHRtcCwgY3Vyc29yMSwgbGVuMSwgMCwgYyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb3VudDEgIT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXljb3B5KHRtcCwgY3Vyc29yMSwgYSwgZGVzdCwgY291bnQxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3QgKz0gY291bnQxO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yMSArPSBjb3VudDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZW4xIC09IGNvdW50MTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZW4xIDw9IDEpIC8vIGxlbjEgPT0gMSB8fCBsZW4xID09IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhayBvdXRlcjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhW2Rlc3QrK10gPSBhW2N1cnNvcjIrK107XG4gICAgICAgICAgICAgICAgICAgIGlmICgtLWxlbjIgPT0gMCkgYnJlYWsgb3V0ZXI7XG5cbiAgICAgICAgICAgICAgICAgICAgY291bnQyID0gZ2FsbG9wTGVmdCh0bXBbY3Vyc29yMV0sIGEsIGN1cnNvcjIsIGxlbjIsIDAsIGMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY291bnQyICE9IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5Y29weShhLCBjdXJzb3IyLCBhLCBkZXN0LCBjb3VudDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVzdCArPSBjb3VudDI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJzb3IyICs9IGNvdW50MjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlbjIgLT0gY291bnQyO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbjIgPT0gMCkgYnJlYWsgb3V0ZXI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYVtkZXN0KytdID0gdG1wW2N1cnNvcjErK107XG4gICAgICAgICAgICAgICAgICAgIGlmICgtLWxlbjEgPT0gMSkgYnJlYWsgb3V0ZXI7XG4gICAgICAgICAgICAgICAgICAgIG1pbkdhbGxvcC0tO1xuICAgICAgICAgICAgICAgIH0gd2hpbGUgKGNvdW50MSA+PSBNSU5fR0FMTE9QIHwgY291bnQyID49IE1JTl9HQUxMT1ApO1xuICAgICAgICAgICAgICAgIGlmIChtaW5HYWxsb3AgPCAwKSBtaW5HYWxsb3AgPSAwO1xuICAgICAgICAgICAgICAgIG1pbkdhbGxvcCArPSAyOyAvLyBQZW5hbGl6ZSBmb3IgbGVhdmluZyBnYWxsb3AgbW9kZVxuICAgICAgICAgICAgfSAvLyBFbmQgb2YgXCJvdXRlclwiIGxvb3BcbiAgICAgICAgICAgIGdsb2JhbEEubWluR2FsbG9wID0gbWluR2FsbG9wIDwgMSA/IDEgOiBtaW5HYWxsb3A7IC8vIFdyaXRlIGJhY2sgdG8gZmllbGRcblxuICAgICAgICAgICAgaWYgKGxlbjEgPT0gMSkge1xuICAgICAgICAgICAgICAgIGFycmF5Y29weShhLCBjdXJzb3IyLCBhLCBkZXN0LCBsZW4yKTtcbiAgICAgICAgICAgICAgICBhW2Rlc3QgKyBsZW4yXSA9IHRtcFtjdXJzb3IxXTsgLy8gTGFzdCBlbHQgb2YgcnVuIDEgdG8gZW5kIG9mIG1lcmdlXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxlbjEgPT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIklsbGVnYWxBcmd1bWVudEV4Y2VwdGlvbi4gQ29tcGFyaXNvbiBtZXRob2QgdmlvbGF0ZXMgaXRzIGdlbmVyYWwgY29udHJhY3QhXCIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcnJheWNvcHkodG1wLCBjdXJzb3IxLCBhLCBkZXN0LCBsZW4xKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIG1lcmdlSGkoaW5kZXhWZWN0b3IsIGJhc2UxLCBsZW4xLCBiYXNlMiwgbGVuMikge1xuXG4gICAgICAgICAgICAvLyBDb3B5IHNlY29uZCBydW4gaW50byB0ZW1wIGFycmF5XG4gICAgICAgICAgICB2YXIgYSA9IGdsb2JhbEE7IC8vIEZvciBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgdmFyIHRtcCA9IGluZGV4VmVjdG9yLnNsaWNlKGJhc2UyLCBiYXNlMiArIGxlbjIpO1xuXG4gICAgICAgICAgICB2YXIgY3Vyc29yMSA9IGJhc2UxICsgbGVuMSAtIDE7IC8vIEluZGV4ZXMgaW50byBhXG4gICAgICAgICAgICB2YXIgY3Vyc29yMiA9IGxlbjIgLSAxOyAvLyBJbmRleGVzIGludG8gdG1wIGFycmF5XG4gICAgICAgICAgICB2YXIgZGVzdCA9IGJhc2UyICsgbGVuMiAtIDE7IC8vIEluZGV4ZXMgaW50byBhXG5cbiAgICAgICAgICAgIC8vIE1vdmUgbGFzdCBlbGVtZW50IG9mIGZpcnN0IHJ1biBhbmQgZGVhbCB3aXRoIGRlZ2VuZXJhdGUgY2FzZXNcbiAgICAgICAgICAgIGluZGV4VmVjdG9yW2Rlc3QtLV0gPSBpbmRleFZlY3RvcltjdXJzb3IxLS1dO1xuICAgICAgICAgICAgaWYgKC0tbGVuMSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgYXJyYXljb3B5KGluZGV4VmVjdG9yLCB0bXAsIDAsIGEsIGRlc3QgLSAobGVuMiAtIDEpLCBsZW4yKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGVuMiA9PSAxKSB7XG4gICAgICAgICAgICAgICAgZGVzdCAtPSBsZW4xO1xuICAgICAgICAgICAgICAgIGN1cnNvcjEgLT0gbGVuMTtcbiAgICAgICAgICAgICAgICBhcnJheWNvcHkoaW5kZXhWZWN0b3IsIGEsIGN1cnNvcjEgKyAxLCBhLCBkZXN0ICsgMSwgbGVuMSk7XG4gICAgICAgICAgICAgICAgYVtkZXN0XSA9IHRtcFtjdXJzb3IyXTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjID0gY29tcGFyZTsgLy8gVXNlIGxvY2FsIHZhcmlhYmxlIGZvciBwZXJmb3JtYW5jZVxuXG4gICAgICAgICAgICB2YXIgbWluR2FsbG9wID0gTUlOX0dBTExPUDsgLy8gXCIgICAgXCIgXCIgICAgIFwiIFwiXG4gICAgICAgICAgICBvdXRlcjogd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgY291bnQxID0gMDsgLy8gTnVtYmVyIG9mIHRpbWVzIGluIGEgcm93IHRoYXQgZmlyc3QgcnVuIHdvblxuICAgICAgICAgICAgICAgIHZhciBjb3VudDIgPSAwOyAvLyBOdW1iZXIgb2YgdGltZXMgaW4gYSByb3cgdGhhdCBzZWNvbmQgcnVuIHdvblxuXG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgKiBEbyB0aGUgc3RyYWlnaHRmb3J3YXJkIHRoaW5nIHVudGlsIChpZiBldmVyKSBvbmUgcnVuIGFwcGVhcnMgdG8gd2luIGNvbnNpc3RlbnRseS5cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wYXJlKHRtcFtjdXJzb3IyXSwgYVtjdXJzb3IxXSkgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhW2Rlc3QtLV0gPSBhW2N1cnNvcjEtLV07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDErKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50MiA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoLS1sZW4xID09IDApIGJyZWFrIG91dGVyO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYVtkZXN0LS1dID0gdG1wW2N1cnNvcjItLV07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDIrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50MSA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoLS1sZW4yID09IDEpIGJyZWFrIG91dGVyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSB3aGlsZSAoKGNvdW50MSB8IGNvdW50MikgPCBtaW5HYWxsb3ApO1xuXG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgKiBPbmUgcnVuIGlzIHdpbm5pbmcgc28gY29uc2lzdGVudGx5IHRoYXQgZ2FsbG9waW5nIG1heSBiZSBhIGh1Z2Ugd2luLiBTbyB0cnkgdGhhdCwgYW5kIGNvbnRpbnVlIGdhbGxvcGluZyB1bnRpbCAoaWZcbiAgICAgICAgICAgICAgICAgKiBldmVyKSBuZWl0aGVyIHJ1biBhcHBlYXJzIHRvIGJlIHdpbm5pbmcgY29uc2lzdGVudGx5IGFueW1vcmUuXG4gICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICBjb3VudDEgPSBsZW4xIC0gZ2FsbG9wUmlnaHQoaW5kZXhWZWN0b3IsIHRtcFtjdXJzb3IyXSwgYSwgYmFzZTEsIGxlbjEsIGxlbjEgLSAxLCBjKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50MSAhPSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXN0IC09IGNvdW50MTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnNvcjEgLT0gY291bnQxO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGVuMSAtPSBjb3VudDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJheWNvcHkoaW5kZXhWZWN0b3IsIGEsIGN1cnNvcjEgKyAxLCBhLCBkZXN0ICsgMSwgY291bnQxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZW4xID09IDApIGJyZWFrIG91dGVyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFbZGVzdC0tXSA9IHRtcFtjdXJzb3IyLS1dO1xuICAgICAgICAgICAgICAgICAgICBpZiAoLS1sZW4yID09IDEpIGJyZWFrIG91dGVyO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvdW50MiA9IGxlbjIgLSBnYWxsb3BMZWZ0KGluZGV4VmVjdG9yLCBhW2N1cnNvcjFdLCB0bXAsIDAsIGxlbjIsIGxlbjIgLSAxLCBjKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50MiAhPSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXN0IC09IGNvdW50MjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnNvcjIgLT0gY291bnQyO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGVuMiAtPSBjb3VudDI7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJheWNvcHkoaW5kZXhWZWN0b3IsIHRtcCwgY3Vyc29yMiArIDEsIGEsIGRlc3QgKyAxLCBjb3VudDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbjIgPD0gMSkgLy8gbGVuMiA9PSAxIHx8IGxlbjIgPT0gMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrIG91dGVyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFbZGVzdC0tXSA9IGFbY3Vyc29yMS0tXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKC0tbGVuMSA9PSAwKSBicmVhayBvdXRlcjtcbiAgICAgICAgICAgICAgICAgICAgbWluR2FsbG9wLS07XG4gICAgICAgICAgICAgICAgfSB3aGlsZSAoY291bnQxID49IE1JTl9HQUxMT1AgfCBjb3VudDIgPj0gTUlOX0dBTExPUCk7XG4gICAgICAgICAgICAgICAgaWYgKG1pbkdhbGxvcCA8IDApIG1pbkdhbGxvcCA9IDA7XG4gICAgICAgICAgICAgICAgbWluR2FsbG9wICs9IDI7IC8vIFBlbmFsaXplIGZvciBsZWF2aW5nIGdhbGxvcCBtb2RlXG4gICAgICAgICAgICB9IC8vIEVuZCBvZiBcIm91dGVyXCIgbG9vcFxuICAgICAgICAgICAgZ2xvYmFsQS5taW5HYWxsb3AgPSBtaW5HYWxsb3AgPCAxID8gMSA6IG1pbkdhbGxvcDsgLy8gV3JpdGUgYmFjayB0byBmaWVsZFxuXG4gICAgICAgICAgICBpZiAobGVuMiA9PSAxKSB7XG4gICAgICAgICAgICAgICAgZGVzdCAtPSBsZW4xO1xuICAgICAgICAgICAgICAgIGN1cnNvcjEgLT0gbGVuMTtcbiAgICAgICAgICAgICAgICBhcnJheWNvcHkoaW5kZXhWZWN0b3IsIGEsIGN1cnNvcjEgKyAxLCBhLCBkZXN0ICsgMSwgbGVuMSk7XG4gICAgICAgICAgICAgICAgYVtkZXN0XSA9IHRtcFtjdXJzb3IyXTsgLy8gTW92ZSBmaXJzdCBlbHQgb2YgcnVuMiB0byBmcm9udCBvZiBtZXJnZVxuICAgICAgICAgICAgfSBlbHNlIGlmIChsZW4yID09IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbGxlZ2FsQXJndW1lbnRFeGNlcHRpb24uIENvbXBhcmlzb24gbWV0aG9kIHZpb2xhdGVzIGl0cyBnZW5lcmFsIGNvbnRyYWN0IVwiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXJyYXljb3B5KGluZGV4VmVjdG9yLCB0bXAsIDAsIGEsIGRlc3QgLSAobGVuMiAtIDEpLCBsZW4yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJhbmdlQ2hlY2soaW5kZXhWZWN0b3IsIGFycmF5TGVuLCBmcm9tSW5kZXgsIHRvSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChmcm9tSW5kZXggPiB0b0luZGV4KSB0aHJvdyBuZXcgRXJyb3IoXCJJbGxlZ2FsQXJndW1lbnQgZnJvbUluZGV4KFwiICsgZnJvbUluZGV4ICsgXCIpID4gdG9JbmRleChcIiArIHRvSW5kZXggKyBcIilcIik7XG4gICAgICAgICAgICBpZiAoZnJvbUluZGV4IDwgMCkgdGhyb3cgbmV3IEVycm9yKFwiQXJyYXlJbmRleE91dE9mQm91bmRzIFwiICsgZnJvbUluZGV4KTtcbiAgICAgICAgICAgIGlmICh0b0luZGV4ID4gYXJyYXlMZW4pIHRocm93IG5ldyBFcnJvcihcIkFycmF5SW5kZXhPdXRPZkJvdW5kcyBcIiArIHRvSW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAgICAgZnVuY3Rpb24gYXJyYXljb3B5KGluZGV4VmVjdG9yLCBzLCBzcG9zLCBkLCBkcG9zLCBsZW4pIHtcbiAgICAgICAgICAgIHZhciBhID0gaW5kZXhWZWN0b3Iuc2xpY2Uoc3Bvcywgc3BvcyArIGxlbik7XG4gICAgICAgICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgICAgICAgICBpbmRleFZlY3RvcltkcG9zICsgbGVuXSA9IGFbbGVuXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgcmV0dXJuIHRpbXNvcnQ7XG5cbn0pKCk7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvdGltc29ydC5qc1wiLFwiL1wiKSJdfQ==
