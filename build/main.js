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
        var aggregates = aggregator.aggregates;
        var data = this.data;
        data.length = aggregates.length + 1;
        var indexes = this.getAllRowIndexes();
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

    return DataNodeBase;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeBase.js","/")
},{"buffer":1,"oMfpAn":4}],6:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeGroup.js","/")
},{"./DataNodeBase":5,"./Map":15,"buffer":1,"oMfpAn":4}],7:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeLeaf.js","/")
},{"./DataNodeBase":5,"buffer":1,"oMfpAn":4}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataNodeGroup = require('./DataNodeGroup');

module.exports = (function() {

    function DataNodeTree(key) {
        DataNodeGroup.call(this, key);
        this.height = 0;
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataNodeTree.js","/")
},{"./DataNodeGroup":6,"buffer":1,"oMfpAn":4}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var DataSourceSorter = require('./DataSourceSorter');
var DataNodeTree = require('./DataNodeTree');
var DataNodeGroup = require('./DataNodeGroup');
var DataNodeLeaf = require('./DataNodeLeaf');

module.exports = (function() {

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
    }

    DataSourceAggregator.prototype.addAggregate = function(columnName, func) {
        this.headers.push(columnName);
        this.aggregates.push(func);
    };

    DataSourceAggregator.prototype.addGroupBy = function(columnIndex) {
        this.groupBys.push(columnIndex);
    };

    DataSourceAggregator.prototype.hasGroups = function() {
        return this.groupBys.length > 0;
    };

    DataSourceAggregator.prototype.apply = function() {
        this.buildGroupTree();
    };

    DataSourceAggregator.prototype.clearAggregations = function() {
        this.aggregates.length = 0;
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

        // lets sort our data first....
        for (c = 0; c < groupBys.length; c++) {
            g = groupBys[groupBys.length - c - 1];
            source = new DataSourceSorter(source);
            source.sortOn(g);
        }

        var rowCount = source.getRowCount();
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
        return ['tree'].concat(this.dataSource.getHeaders());

    };

    DataSourceAggregator.prototype.getFields = function() {
        return this.getHeaders();
    };

    DataSourceAggregator.prototype.getGrandTotals = function() {
        var view = this.view[0];
        if (!view) {
            return [];
        }
        return view.data;
    };
    return DataSourceAggregator;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceAggregator.js","/")
},{"./DataNodeGroup":6,"./DataNodeLeaf":7,"./DataNodeTree":8,"./DataSourceSorter":12,"buffer":1,"oMfpAn":4}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = (function() {

    function DataSourceDecorator(dataSource) {
        this.dataSource = dataSource;
        this.indexes = [];
    }

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

    DataSourceDecorator.prototype.getRowCount = function() {
        if (this.indexes.length !== 0) {
            return this.indexes.length;
        }
        return this.dataSource.getRowCount();
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

    return DataSourceDecorator;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceDecorator.js","/")
},{"buffer":1,"oMfpAn":4}],11:[function(require,module,exports){
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

    DataSourceFilter.prototype.clearFilters = function() { /* filter */
        this.filters.length = 0;
        this.indexes.length = 0;
    };

    DataSourceFilter.prototype.applyFilters = function() {
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceFilter.js","/")
},{"./DataSourceDecorator":10,"buffer":1,"oMfpAn":4}],12:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceSorter.js","/")
},{"./DataSourceDecorator":10,"./Utils.js":16,"buffer":1,"oMfpAn":4}],13:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/DataSourceSorterComposite.js","/")
},{"./DataSourceDecorator":10,"./DataSourceSorter":12,"buffer":1,"oMfpAn":4}],14:[function(require,module,exports){
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

        return this.fields.length;
    };

    JSDataSource.prototype.getRowCount = function() {

        return this.data.length;
    };

    JSDataSource.prototype.getFields = function() {

        return this.fields;
    };

    JSDataSource.prototype.getHeaders = function() {

        return this.getFields();
    };

    JSDataSource.prototype.setFields = function(fields) {

        this.fields = fields;
    };

    JSDataSource.prototype.getGrandTotals = function() {
        //nothing here
        return;
    };
    return JSDataSource;

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/JSDataSource.js","/")
},{"buffer":1,"oMfpAn":4}],15:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Map.js","/")
},{"buffer":1,"oMfpAn":4}],16:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Utils.js","/")
},{"./Map.js":15,"./stableSort.js":20,"buffer":1,"oMfpAn":4}],17:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/aggregations.js","/")
},{"buffer":1,"oMfpAn":4}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var JSDataSource = require('./JSDataSource');
var DataSourceSorter = require('./DataSourceSorter');
var DataSourceSorterComposite = require('./DataSourceSorterComposite');
var DataSourceFilter = require('./DataSourceFilter');
var DataSourceAggregator = require('./DataSourceAggregator');
var aggregations = require('./aggregations');

module.exports = (function() {

    return {
        JSDataSource: JSDataSource,
        DataSourceSorter: DataSourceSorter,
        DataSourceSorterComposite: DataSourceSorterComposite,
        DataSourceFilter: DataSourceFilter,
        DataSourceAggregator: DataSourceAggregator,
        aggregations: aggregations
    };

})();
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/analytics.js","/")
},{"./DataSourceAggregator":9,"./DataSourceFilter":11,"./DataSourceSorter":12,"./DataSourceSorterComposite":13,"./JSDataSource":14,"./aggregations":17,"buffer":1,"oMfpAn":4}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/* eslint-env node, browser */
'use strict';

var analytics = require('./analytics.js');

if (!window.fin) {
    window.fin = {};
}
if (!window.fin.analytics) {
    window.fin.analytics = analytics;
}
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_27afe17c.js","/")
},{"./analytics.js":18,"buffer":1,"oMfpAn":4}],20:[function(require,module,exports){
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
}).call(this,require("oMfpAn"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/stableSort.js","/")
},{"buffer":1,"oMfpAn":4}]},{},[19])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YU5vZGVCYXNlLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhTm9kZUdyb3VwLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9EYXRhTm9kZUxlYWYuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFOb2RlVHJlZS5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvRGF0YVNvdXJjZUFnZ3JlZ2F0b3IuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VEZWNvcmF0b3IuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VGaWx0ZXIuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VTb3J0ZXIuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0RhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL0pTRGF0YVNvdXJjZS5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvTWFwLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9VdGlscy5qcyIsIi9Vc2Vycy9zdGV2ZXdpcnRzL1Byb2plY3RzL2ZpbmFuYWx5dGljcy9zcmMvanMvYWdncmVnYXRpb25zLmpzIiwiL1VzZXJzL3N0ZXZld2lydHMvUHJvamVjdHMvZmluYW5hbHl0aWNzL3NyYy9qcy9hbmFseXRpY3MuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL2Zha2VfMjdhZmUxN2MuanMiLCIvVXNlcnMvc3RldmV3aXJ0cy9Qcm9qZWN0cy9maW5hbmFseXRpY3Mvc3JjL2pzL3N0YWJsZVNvcnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdFtpXVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ciArICcnXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0LCBbdG90YWxMZW5ndGhdKVxcbicgK1xuICAgICAgJ2xpc3Qgc2hvdWxkIGJlIGFuIEFycmF5LicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHRvdGFsTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBfaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9IGkgKiAyXG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIF91dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBCdWZmZXIuX2NoYXJzV3JpdHRlbiA9XG4gICAgYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBfYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gX2FzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIF91dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gQnVmZmVyLl9jaGFyc1dyaXR0ZW4gPVxuICAgIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kICE9PSB1bmRlZmluZWQpXG4gICAgPyBOdW1iZXIoZW5kKVxuICAgIDogZW5kID0gc2VsZi5sZW5ndGhcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBfaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gX3V0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBfYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gX2JpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBfYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IF91dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBfYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIF91dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gX2FzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKVxuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBfYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gX2FzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBfaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiBfdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpKzFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gX3JlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF9yZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiBfcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IF9yZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSBfcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gX3JlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3JlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIF9yZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiBfcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiBfd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICBfd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgX3dyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBfd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIF93cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgX3dyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIF93cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgX3dyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gX3dyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIF93cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLmNoYXJDb2RlQXQoMClcbiAgfVxuXG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICFpc05hTih2YWx1ZSksICd2YWx1ZSBpcyBub3QgYSBudW1iZXInKVxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgdGhpc1tpXSA9IHZhbHVlXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSlcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKVxuICAgICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpXG4gICAgZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKVxuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBwb3NcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qc1wiLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlclwiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbnZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiLy4uLy4uL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWJcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG5leHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTRcIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4vLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanNcIixcIi8uLi8uLi9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBkZXB0aFN0cmluZyA9ICcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICc7XG5cbiAgICBmdW5jdGlvbiBEYXRhTm9kZUJhc2Uoa2V5KSB7XG4gICAgICAgIHRoaXMubGFiZWwgPSBrZXk7XG4gICAgICAgIHRoaXMuZGF0YSA9IFsnJ107XG4gICAgICAgIHRoaXMucm93SW5kZXhlcyA9IFtdO1xuICAgICAgICB0aGlzLmhhc0NoaWxkcmVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGVwdGggPSAwO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDE7XG4gICAgICAgIHRoaXMuZXhwYW5kZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oeCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhW3hdO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLnBydW5lID0gZnVuY3Rpb24oZGVwdGgpIHtcbiAgICAgICAgdGhpcy5kZXB0aCA9IGRlcHRoO1xuICAgICAgICB0aGlzLmRhdGFbMF0gPSB0aGlzLmNvbXB1dGVEZXB0aFN0cmluZygpO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmNvbXB1dGVEZXB0aFN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RyaW5nID0gZGVwdGhTdHJpbmcuc3Vic3RyaW5nKDAsIDIgKyAodGhpcy5kZXB0aCAqIDMpKSArIHRoaXMubGFiZWw7XG4gICAgICAgIHJldHVybiBzdHJpbmc7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuY29tcHV0ZUhlaWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gMTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVCYXNlLnByb3RvdHlwZS5nZXRBbGxSb3dJbmRleGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJvd0luZGV4ZXM7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuY29tcHV0ZUFnZ3JlZ2F0ZXMgPSBmdW5jdGlvbihhZ2dyZWdhdG9yKSB7XG4gICAgICAgIHRoaXMuYXBwbHlBZ2dyZWdhdGVzKGFnZ3JlZ2F0b3IpO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUJhc2UucHJvdG90eXBlLmFwcGx5QWdncmVnYXRlcyA9IGZ1bmN0aW9uKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgdmFyIGFnZ3JlZ2F0ZXMgPSBhZ2dyZWdhdG9yLmFnZ3JlZ2F0ZXM7XG4gICAgICAgIHZhciBkYXRhID0gdGhpcy5kYXRhO1xuICAgICAgICBkYXRhLmxlbmd0aCA9IGFnZ3JlZ2F0ZXMubGVuZ3RoICsgMTtcbiAgICAgICAgdmFyIGluZGV4ZXMgPSB0aGlzLmdldEFsbFJvd0luZGV4ZXMoKTtcbiAgICAgICAgdmFyIHNvcnRlciA9IGFnZ3JlZ2F0b3Iuc29ydGVySW5zdGFuY2U7XG4gICAgICAgIHNvcnRlci5pbmRleGVzID0gaW5kZXhlcztcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFnZ3JlZ2F0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBhZ2dyZWdhdGUgPSBhZ2dyZWdhdGVzW2ldO1xuICAgICAgICAgICAgZGF0YVtpICsgMV0gPSBhZ2dyZWdhdGUoc29ydGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfTtcblxuICAgIERhdGFOb2RlQmFzZS5wcm90b3R5cGUuYnVpbGRWaWV3ID0gZnVuY3Rpb24oYWdncmVnYXRvcikge1xuICAgICAgICBhZ2dyZWdhdG9yLnZpZXcucHVzaCh0aGlzKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFOb2RlQmFzZTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YU5vZGVCYXNlLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTWFwID0gcmVxdWlyZSgnLi9NYXAnKTtcbnZhciBEYXRhTm9kZUJhc2UgPSByZXF1aXJlKCcuL0RhdGFOb2RlQmFzZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBFeHBhbmRlZE1hcCA9IHtcbiAgICAgICAgdHJ1ZTogJ+KWvicsXG4gICAgICAgIGZhbHNlOiAn4pa4J1xuICAgIH07XG4gICAgdmFyIGRlcHRoU3RyaW5nID0gJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJztcblxuICAgIGZ1bmN0aW9uIERhdGFOb2RlR3JvdXAoa2V5KSB7XG4gICAgICAgIERhdGFOb2RlQmFzZS5jYWxsKHRoaXMsIGtleSk7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBuZXcgTWFwKCk7XG4gICAgfVxuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFOb2RlQmFzZS5wcm90b3R5cGUpO1xuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUucHJ1bmUgPSBmdW5jdGlvbihkZXB0aCkge1xuICAgICAgICB0aGlzLmRlcHRoID0gZGVwdGg7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuLnZhbHVlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY2hpbGQucHJ1bmUodGhpcy5kZXB0aCArIDEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGF0YVswXSA9IHRoaXMuY29tcHV0ZURlcHRoU3RyaW5nKCk7XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVEZXB0aFN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaWNvbiA9IEV4cGFuZGVkTWFwW3RoaXMuZXhwYW5kZWQgKyAnJ107XG4gICAgICAgIHZhciBzdHJpbmcgPSBkZXB0aFN0cmluZy5zdWJzdHJpbmcoMCwgdGhpcy5kZXB0aCAqIDMpICsgaWNvbiArICcgJyArIHRoaXMubGFiZWw7XG4gICAgICAgIHJldHVybiBzdHJpbmc7XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmdldEFsbFJvd0luZGV4ZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMucm93SW5kZXhlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMucm93SW5kZXhlcyA9IHRoaXMuY29tcHV0ZUFsbFJvd0luZGV4ZXMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yb3dJbmRleGVzO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS5jb21wdXRlQWxsUm93SW5kZXhlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIHZhciBjaGlsZEluZGV4ZXMgPSBjaGlsZC5nZXRBbGxSb3dJbmRleGVzKCk7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHJlc3VsdCwgW3Jlc3VsdC5sZW5ndGgsIDBdLmNvbmNhdChjaGlsZEluZGV4ZXMpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUdyb3VwLnByb3RvdHlwZS50b2dnbGVFeHBhbnNpb25TdGF0ZSA9IGZ1bmN0aW9uKGFnZ3JlZ2F0b3IpIHsgLyogYWdncmVnYXRvciAqL1xuICAgICAgICB0aGlzLmV4cGFuZGVkID0gIXRoaXMuZXhwYW5kZWQ7XG4gICAgICAgIHRoaXMuZGF0YVswXSA9IHRoaXMuY29tcHV0ZURlcHRoU3RyaW5nKCk7XG4gICAgICAgIGlmICh0aGlzLmV4cGFuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLmNvbXB1dGVBZ2dyZWdhdGVzKGFnZ3JlZ2F0b3IpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVBZ2dyZWdhdGVzID0gZnVuY3Rpb24oYWdncmVnYXRvcikge1xuICAgICAgICB0aGlzLmFwcGx5QWdncmVnYXRlcyhhZ2dyZWdhdG9yKTtcbiAgICAgICAgaWYgKCF0aGlzLmV4cGFuZGVkKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIHdlcmUgbm90IGJlaW5nIHZpZXdlZCwgZG9uJ3QgaGF2ZSBjaGlsZCBub2RlcyBkbyBjb21wdXRhdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5baV0uY29tcHV0ZUFnZ3JlZ2F0ZXMoYWdncmVnYXRvcik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YU5vZGVHcm91cC5wcm90b3R5cGUuYnVpbGRWaWV3ID0gZnVuY3Rpb24oYWdncmVnYXRvcikge1xuICAgICAgICBhZ2dyZWdhdG9yLnZpZXcucHVzaCh0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuZXhwYW5kZWQpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgY2hpbGQuYnVpbGRWaWV3KGFnZ3JlZ2F0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIERhdGFOb2RlR3JvdXAucHJvdG90eXBlLmNvbXB1dGVIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhlaWdodCA9IDE7IC8vSSdtIDEgaGlnaFxuICAgICAgICBpZiAoIXRoaXMuZXhwYW5kZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaGVpZ2h0ID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IGhlaWdodCArIHRoaXMuY2hpbGRyZW5baV0uY29tcHV0ZUhlaWdodCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaGVpZ2h0O1xuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YU5vZGVHcm91cDtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YU5vZGVHcm91cC5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIERhdGFOb2RlQmFzZSA9IHJlcXVpcmUoJy4vRGF0YU5vZGVCYXNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgZnVuY3Rpb24gRGF0YU5vZGVMZWFmKGtleSkge1xuICAgICAgICBEYXRhTm9kZUJhc2UuY2FsbCh0aGlzLCBrZXkpO1xuICAgIH1cblxuICAgIERhdGFOb2RlTGVhZi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFOb2RlQmFzZS5wcm90b3R5cGUpO1xuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZS5wcnVuZSA9IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgICAgIHRoaXMuZGVwdGggPSBkZXB0aDtcbiAgICAgICAgdGhpcy5kYXRhWzBdID0gdGhpcy5jb21wdXRlRGVwdGhTdHJpbmcoKTtcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZS5jb21wdXRlSGVpZ2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgIH07XG5cbiAgICBEYXRhTm9kZUxlYWYucHJvdG90eXBlLmdldEFsbFJvd0luZGV4ZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm93SW5kZXhlcztcbiAgICB9O1xuXG4gICAgRGF0YU5vZGVMZWFmLnByb3RvdHlwZS5jb21wdXRlQWdncmVnYXRlcyA9IGZ1bmN0aW9uKGFnZ3JlZ2F0b3IpIHtcbiAgICAgICAgdGhpcy5hcHBseUFnZ3JlZ2F0ZXMoYWdncmVnYXRvcik7XG4gICAgfTtcblxuICAgIERhdGFOb2RlTGVhZi5wcm90b3R5cGUuYnVpbGRWaWV3ID0gZnVuY3Rpb24oYWdncmVnYXRvcikge1xuICAgICAgICBhZ2dyZWdhdG9yLnZpZXcucHVzaCh0aGlzKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFOb2RlTGVhZjtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YU5vZGVMZWFmLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YU5vZGVHcm91cCA9IHJlcXVpcmUoJy4vRGF0YU5vZGVHcm91cCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFOb2RlVHJlZShrZXkpIHtcbiAgICAgICAgRGF0YU5vZGVHcm91cC5jYWxsKHRoaXMsIGtleSk7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gMDtcbiAgICB9XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhTm9kZUdyb3VwLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlLnBydW5lID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuLnZhbHVlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY2hpbGQucHJ1bmUoMCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRGF0YU5vZGVUcmVlLnByb3RvdHlwZS5idWlsZFZpZXcgPSBmdW5jdGlvbihhZ2dyZWdhdG9yKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGNoaWxkLmJ1aWxkVmlldyhhZ2dyZWdhdG9yKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhTm9kZVRyZWUucHJvdG90eXBlLmNvbXB1dGVIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhlaWdodCA9IDA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaGVpZ2h0ID0gaGVpZ2h0ICsgdGhpcy5jaGlsZHJlbltpXS5jb21wdXRlSGVpZ2h0KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaGVpZ2h0O1xuICAgIH07XG5cblxuICAgIHJldHVybiBEYXRhTm9kZVRyZWU7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFOb2RlVHJlZS5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIERhdGFTb3VyY2VTb3J0ZXIgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VTb3J0ZXInKTtcbnZhciBEYXRhTm9kZVRyZWUgPSByZXF1aXJlKCcuL0RhdGFOb2RlVHJlZScpO1xudmFyIERhdGFOb2RlR3JvdXAgPSByZXF1aXJlKCcuL0RhdGFOb2RlR3JvdXAnKTtcbnZhciBEYXRhTm9kZUxlYWYgPSByZXF1aXJlKCcuL0RhdGFOb2RlTGVhZicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIC8vP1t0LGMsYixhXVxuICAgIC8vIHQgaXMgYSBkYXRhU291cmNlLFxuICAgIC8vIGEgaXMgYSBkaWNpdGlvbmFyeSBvZiBhZ2dyZWdhdGVzLCAgY29sdW1uTmFtZTpmdW5jdGlvblxuICAgIC8vIGIgaXMgYSBkaWNpdGlvbmFyeSBvZiBncm91cGJ5cywgY29sdW1uTmFtZTpzb3VyY2VDb2x1bW5OYW1lXG4gICAgLy8gYyBpcyBhIGxpc3Qgb2YgY29uc3RyYWludHMsXG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlQWdncmVnYXRvcihkYXRhU291cmNlKSB7XG4gICAgICAgIHRoaXMudHJlZSA9IG5ldyBEYXRhTm9kZVRyZWUoJ3Jvb3QnKTtcbiAgICAgICAgdGhpcy5pbmRleGVzID0gW107XG4gICAgICAgIHRoaXMuZGF0YVNvdXJjZSA9IGRhdGFTb3VyY2U7XG4gICAgICAgIHRoaXMuYWdncmVnYXRlcyA9IFtdO1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5ncm91cEJ5cyA9IFtdO1xuICAgICAgICB0aGlzLnZpZXcgPSBbXTtcbiAgICAgICAgdGhpcy5zb3J0ZXJJbnN0YW5jZSA9IHt9O1xuICAgIH1cblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5hZGRBZ2dyZWdhdGUgPSBmdW5jdGlvbihjb2x1bW5OYW1lLCBmdW5jKSB7XG4gICAgICAgIHRoaXMuaGVhZGVycy5wdXNoKGNvbHVtbk5hbWUpO1xuICAgICAgICB0aGlzLmFnZ3JlZ2F0ZXMucHVzaChmdW5jKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmFkZEdyb3VwQnkgPSBmdW5jdGlvbihjb2x1bW5JbmRleCkge1xuICAgICAgICB0aGlzLmdyb3VwQnlzLnB1c2goY29sdW1uSW5kZXgpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuaGFzR3JvdXBzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdyb3VwQnlzLmxlbmd0aCA+IDA7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5hcHBseSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmJ1aWxkR3JvdXBUcmVlKCk7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5jbGVhckFnZ3JlZ2F0aW9ucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmFnZ3JlZ2F0ZXMubGVuZ3RoID0gMDtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmJ1aWxkR3JvdXBUcmVlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjLCByLCBnLCB2YWx1ZSwgY3JlYXRlRnVuYztcbiAgICAgICAgdmFyIGNyZWF0ZUJyYW5jaCA9IGZ1bmN0aW9uKGtleSwgbWFwKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ldyBEYXRhTm9kZUdyb3VwKGtleSk7XG4gICAgICAgICAgICBtYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgY3JlYXRlTGVhZiA9IGZ1bmN0aW9uKGtleSwgbWFwKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ldyBEYXRhTm9kZUxlYWYoa2V5KTtcbiAgICAgICAgICAgIG1hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBncm91cEJ5cyA9IHRoaXMuZ3JvdXBCeXM7XG4gICAgICAgIHZhciBzb3VyY2UgPSB0aGlzLmRhdGFTb3VyY2U7XG5cbiAgICAgICAgLy8gbGV0cyBzb3J0IG91ciBkYXRhIGZpcnN0Li4uLlxuICAgICAgICBmb3IgKGMgPSAwOyBjIDwgZ3JvdXBCeXMubGVuZ3RoOyBjKyspIHtcbiAgICAgICAgICAgIGcgPSBncm91cEJ5c1tncm91cEJ5cy5sZW5ndGggLSBjIC0gMV07XG4gICAgICAgICAgICBzb3VyY2UgPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihzb3VyY2UpO1xuICAgICAgICAgICAgc291cmNlLnNvcnRPbihnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByb3dDb3VudCA9IHNvdXJjZS5nZXRSb3dDb3VudCgpO1xuICAgICAgICB2YXIgdHJlZSA9IHRoaXMudHJlZSA9IG5ldyBEYXRhTm9kZVRyZWUoJ3Jvb3QnKTtcbiAgICAgICAgdmFyIHBhdGggPSB0cmVlO1xuICAgICAgICB2YXIgbGVhZkRlcHRoID0gZ3JvdXBCeXMubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yIChyID0gMDsgciA8IHJvd0NvdW50OyByKyspIHtcbiAgICAgICAgICAgIGZvciAoYyA9IDA7IGMgPCBncm91cEJ5cy5sZW5ndGg7IGMrKykge1xuICAgICAgICAgICAgICAgIGcgPSBncm91cEJ5c1tjXTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNvdXJjZS5nZXRWYWx1ZShnLCByKTtcblxuICAgICAgICAgICAgICAgIC8vdGVzdCB0aGF0IEknbSBub3QgYSBsZWFmXG4gICAgICAgICAgICAgICAgY3JlYXRlRnVuYyA9IChjID09PSBsZWFmRGVwdGgpID8gY3JlYXRlTGVhZiA6IGNyZWF0ZUJyYW5jaDtcbiAgICAgICAgICAgICAgICBwYXRoID0gcGF0aC5jaGlsZHJlbi5nZXRJZkFic2VudCh2YWx1ZSwgY3JlYXRlRnVuYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXRoLnJvd0luZGV4ZXMucHVzaChyKTtcbiAgICAgICAgICAgIHBhdGggPSB0cmVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc29ydGVySW5zdGFuY2UgPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihzb3VyY2UpO1xuICAgICAgICB0cmVlLnBydW5lKCk7XG4gICAgICAgIHRoaXMudHJlZS5jb21wdXRlQWdncmVnYXRlcyh0aGlzKTtcbiAgICAgICAgdGhpcy5idWlsZFZpZXcoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmJ1aWxkVmlldyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnZpZXcubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy50cmVlLmNvbXB1dGVIZWlnaHQoKTtcbiAgICAgICAgdGhpcy50cmVlLmJ1aWxkVmlldyh0aGlzKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICByZXR1cm4gdGhpcy52aWV3W3kgLSAxXS5nZXRWYWx1ZSh4KTsgLy9oZWFkZXIgcm93XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFnZ3JlZ2F0ZXMubGVuZ3RoICsgMTsgLy8gMSBpcyBmb3IgdGhlIGhpZXJhcmNoeSBjb2x1bW5cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmdldFJvd0NvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZpZXcubGVuZ3RoOyAvL2hlYWRlciBjb2x1bW5cbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IucHJvdG90eXBlLmNsaWNrID0gZnVuY3Rpb24oeSkge1xuICAgICAgICB2YXIgZ3JvdXAgPSB0aGlzLnZpZXdbeV07XG4gICAgICAgIGdyb3VwLnRvZ2dsZUV4cGFuc2lvblN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLmJ1aWxkVmlldygpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuZ2V0SGVhZGVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gWyd0cmVlJ10uY29uY2F0KHRoaXMuZGF0YVNvdXJjZS5nZXRIZWFkZXJzKCkpO1xuXG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VBZ2dyZWdhdG9yLnByb3RvdHlwZS5nZXRGaWVsZHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SGVhZGVycygpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlQWdncmVnYXRvci5wcm90b3R5cGUuZ2V0R3JhbmRUb3RhbHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHZpZXcgPSB0aGlzLnZpZXdbMF07XG4gICAgICAgIGlmICghdmlldykge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2aWV3LmRhdGE7XG4gICAgfTtcbiAgICByZXR1cm4gRGF0YVNvdXJjZUFnZ3JlZ2F0b3I7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFTb3VyY2VBZ2dyZWdhdG9yLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VEZWNvcmF0b3IoZGF0YVNvdXJjZSkge1xuICAgICAgICB0aGlzLmRhdGFTb3VyY2UgPSBkYXRhU291cmNlO1xuICAgICAgICB0aGlzLmluZGV4ZXMgPSBbXTtcbiAgICB9XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS50cmFuc3Bvc2VZID0gZnVuY3Rpb24oeSkge1xuICAgICAgICBpZiAodGhpcy5pbmRleGVzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5kZXhlc1t5XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZGF0YVNvdXJjZS5nZXRWYWx1ZSh4LCB0aGlzLnRyYW5zcG9zZVkoeSkpO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmdldFJvdyA9IGZ1bmN0aW9uKHkpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhU291cmNlLmdldFJvdyh0aGlzLnRyYW5zcG9zZVkoeSkpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHksIHZhbHVlKSB7XG5cbiAgICAgICAgdGhpcy5kYXRhU291cmNlLnNldFZhbHVlKHgsIHRoaXMudHJhbnNwb3NlWSh5KSwgdmFsdWUpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRDb2x1bW5Db3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0Q29sdW1uQ291bnQoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0RmllbGRzID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVNvdXJjZS5nZXRGaWVsZHMoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0Um93Q291bnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXhlcy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmluZGV4ZXMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93Q291bnQoKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUuZ2V0SGVhZGVycyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFTb3VyY2UuZ2V0SGVhZGVycygpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZS5nZXRHcmFuZFRvdGFscyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAvL25vdGhpbmcgaGVyZVxuICAgICAgICByZXR1cm47XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlLmluaXRpYWxpemVJbmRleFZlY3RvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcm93Q291bnQgPSB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgdmFyIGluZGV4VmVjdG9yID0gbmV3IEFycmF5KHJvd0NvdW50KTtcbiAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCByb3dDb3VudDsgcisrKSB7XG4gICAgICAgICAgICBpbmRleFZlY3RvcltyXSA9IHI7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pbmRleGVzID0gaW5kZXhWZWN0b3I7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlRGVjb3JhdG9yO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlRGVjb3JhdG9yLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGF0YVNvdXJjZURlY29yYXRvciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZURlY29yYXRvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VGaWx0ZXIoZGF0YVNvdXJjZSkge1xuICAgICAgICBEYXRhU291cmNlRGVjb3JhdG9yLmNhbGwodGhpcywgZGF0YVNvdXJjZSwgZmFsc2UpO1xuICAgICAgICB0aGlzLmZpbHRlcnMgPSBbXTtcbiAgICB9XG5cbiAgICBEYXRhU291cmNlRmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGF0YVNvdXJjZURlY29yYXRvci5wcm90b3R5cGUpO1xuXG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUuYWRkRmlsdGVyID0gZnVuY3Rpb24oY29sdW1uSW5kZXgsIGZpbHRlcikge1xuICAgICAgICBmaWx0ZXIuY29sdW1uSW5kZXggPSBjb2x1bW5JbmRleDtcbiAgICAgICAgdGhpcy5maWx0ZXJzLnB1c2goZmlsdGVyKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZUZpbHRlci5wcm90b3R5cGUuY2xlYXJGaWx0ZXJzID0gZnVuY3Rpb24oKSB7IC8qIGZpbHRlciAqL1xuICAgICAgICB0aGlzLmZpbHRlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5pbmRleGVzLmxlbmd0aCA9IDA7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VGaWx0ZXIucHJvdG90eXBlLmFwcGx5RmlsdGVycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaW5kZXhlcyA9IHRoaXMuaW5kZXhlcztcbiAgICAgICAgaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgICAgICB2YXIgY291bnQgPSB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCBjb3VudDsgcisrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hcHBseUZpbHRlcnNUbyhyKSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMucHVzaChyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBEYXRhU291cmNlRmlsdGVyLnByb3RvdHlwZS5hcHBseUZpbHRlcnNUbyA9IGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgdmFyIGZpbHRlcnMgPSB0aGlzLmZpbHRlcnM7XG4gICAgICAgIHZhciBpc0ZpbHRlcmVkID0gdHJ1ZTtcbiAgICAgICAgZm9yICh2YXIgZiA9IDA7IGYgPCBmaWx0ZXJzLmxlbmd0aDsgZisrKSB7XG4gICAgICAgICAgICB2YXIgZmlsdGVyID0gZmlsdGVyc1tmXTtcbiAgICAgICAgICAgIHZhciByb3dPYmplY3QgPSB0aGlzLmRhdGFTb3VyY2UuZ2V0Um93KHIpO1xuICAgICAgICAgICAgaXNGaWx0ZXJlZCA9IGlzRmlsdGVyZWQgJiYgZmlsdGVyKHRoaXMuZGF0YVNvdXJjZS5nZXRWYWx1ZShmaWx0ZXIuY29sdW1uSW5kZXgsIHIpLCByb3dPYmplY3QsIHIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpc0ZpbHRlcmVkO1xuICAgIH07XG5cbiAgICByZXR1cm4gRGF0YVNvdXJjZUZpbHRlcjtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvRGF0YVNvdXJjZUZpbHRlci5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi9VdGlscy5qcycpO1xudmFyIERhdGFTb3VyY2VEZWNvcmF0b3IgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VEZWNvcmF0b3InKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICBmdW5jdGlvbiBEYXRhU291cmNlU29ydGVyKGRhdGFTb3VyY2UpIHtcbiAgICAgICAgRGF0YVNvdXJjZURlY29yYXRvci5jYWxsKHRoaXMsIGRhdGFTb3VyY2UpO1xuICAgICAgICB0aGlzLmRlc2NlbmRpbmdTb3J0ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgRGF0YVNvdXJjZVNvcnRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERhdGFTb3VyY2VEZWNvcmF0b3IucHJvdG90eXBlKTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXIucHJvdG90eXBlLnNvcnRPbiA9IGZ1bmN0aW9uKGNvbHVtbkluZGV4LCBzb3J0VHlwZSkge1xuICAgICAgICBpZiAoc29ydFR5cGUgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuaW5kZXhlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUluZGV4VmVjdG9yKCk7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgVXRpbHMuc3RhYmxlU29ydCh0aGlzLmluZGV4ZXMsIGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi5kYXRhU291cmNlLmdldFZhbHVlKGNvbHVtbkluZGV4LCBpbmRleCk7XG4gICAgICAgIH0sIHNvcnRUeXBlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERhdGFTb3VyY2VTb3J0ZXI7XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL0RhdGFTb3VyY2VTb3J0ZXIuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBEYXRhU291cmNlRGVjb3JhdG9yID0gcmVxdWlyZSgnLi9EYXRhU291cmNlRGVjb3JhdG9yJyk7XG52YXIgRGF0YVNvdXJjZVNvcnRlciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZVNvcnRlcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUoZGF0YVNvdXJjZSkge1xuICAgICAgICBEYXRhU291cmNlRGVjb3JhdG9yLmNhbGwodGhpcywgZGF0YVNvdXJjZSk7XG4gICAgICAgIHRoaXMuc29ydHMgPSBbXTtcbiAgICAgICAgdGhpcy5sYXN0ID0gdGhpcy5kYXRhU291cmNlO1xuICAgIH1cblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEYXRhU291cmNlRGVjb3JhdG9yLnByb3RvdHlwZSk7XG5cbiAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLnByb3RvdHlwZS5zb3J0T24gPSBmdW5jdGlvbihjb2x1bW5JbmRleCwgc29ydFR5cGUpIHtcbiAgICAgICAgdGhpcy5zb3J0cy5wdXNoKFtjb2x1bW5JbmRleCwgc29ydFR5cGVdKTtcbiAgICB9O1xuXG4gICAgRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZS5wcm90b3R5cGUuYXBwbHlTb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ydHMgPSB0aGlzLnNvcnRzO1xuICAgICAgICB2YXIgZWFjaCA9IHRoaXMuZGF0YVNvdXJjZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzb3J0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHNvcnQgPSBzb3J0c1tpXTtcbiAgICAgICAgICAgIGVhY2ggPSBuZXcgRGF0YVNvdXJjZVNvcnRlcihlYWNoKTtcbiAgICAgICAgICAgIGVhY2guc29ydE9uKHNvcnRbMF0sIHNvcnRbMV0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubGFzdCA9IGVhY2g7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlLmNsZWFyU29ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zb3J0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmxhc3QgPSB0aGlzLmRhdGFTb3VyY2U7XG4gICAgfTtcblxuICAgIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXN0LmdldFZhbHVlKHgsIHkpO1xuICAgIH07XG5cbiAgICBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHgsIHksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMubGFzdC5zZXRWYWx1ZSh4LCB5LCB2YWx1ZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBEYXRhU291cmNlU29ydGVyQ29tcG9zaXRlO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9EYXRhU291cmNlU29ydGVyQ29tcG9zaXRlLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIHZhciBjb21wdXRlRmllbGROYW1lcyA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgICB2YXIgZmllbGRzID0gW10uY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iamVjdCkuZmlsdGVyKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlLnN1YnN0cigwLCAyKSAhPT0gJ19fJztcbiAgICAgICAgfSkpO1xuICAgICAgICByZXR1cm4gZmllbGRzO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBKU0RhdGFTb3VyY2UoZGF0YSwgZmllbGRzKSB7XG4gICAgICAgIHRoaXMuZmllbGRzID0gZmllbGRzIHx8IGNvbXB1dGVGaWVsZE5hbWVzKGRhdGFbMF0pO1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIH1cblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIGlmICh4ID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIHk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbHVlID0gdGhpcy5kYXRhW3ldW3RoaXMuZmllbGRzW3hdXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLmdldFJvdyA9IGZ1bmN0aW9uKHkpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5kYXRhW3ldO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24oeCwgeSwgdmFsdWUpIHtcblxuICAgICAgICB0aGlzLmRhdGFbeV1bdGhpcy5maWVsZHNbeF1dID0gdmFsdWU7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0Q29sdW1uQ291bnQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5maWVsZHMubGVuZ3RoO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLmdldFJvd0NvdW50ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgfTtcblxuICAgIEpTRGF0YVNvdXJjZS5wcm90b3R5cGUuZ2V0RmllbGRzID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZmllbGRzO1xuICAgIH07XG5cbiAgICBKU0RhdGFTb3VyY2UucHJvdG90eXBlLmdldEhlYWRlcnMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcy5nZXRGaWVsZHMoKTtcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5zZXRGaWVsZHMgPSBmdW5jdGlvbihmaWVsZHMpIHtcblxuICAgICAgICB0aGlzLmZpZWxkcyA9IGZpZWxkcztcbiAgICB9O1xuXG4gICAgSlNEYXRhU291cmNlLnByb3RvdHlwZS5nZXRHcmFuZFRvdGFscyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAvL25vdGhpbmcgaGVyZVxuICAgICAgICByZXR1cm47XG4gICAgfTtcbiAgICByZXR1cm4gSlNEYXRhU291cmNlO1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9KU0RhdGFTb3VyY2UuanNcIixcIi9cIikiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsLEJ1ZmZlcixfX2FyZ3VtZW50MCxfX2FyZ3VtZW50MSxfX2FyZ3VtZW50MixfX2FyZ3VtZW50MyxfX2ZpbGVuYW1lLF9fZGlybmFtZSl7XG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIG9pZFByZWZpeCA9ICcufi4jJV8nOyAvL3RoaXMgc2hvdWxkIGJlIHNvbWV0aGluZyB3ZSBuZXZlciB3aWxsIHNlZSBhdCB0aGUgYmVnaW5pbmcgb2YgYSBzdHJpbmdcbiAgICB2YXIgY291bnRlciA9IDA7XG5cbiAgICB2YXIgaGFzaCA9IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICB2YXIgdHlwZU9mID0gdHlwZW9mIGtleTtcbiAgICAgICAgc3dpdGNoICh0eXBlT2YpIHtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgIHJldHVybiBvaWRQcmVmaXggKyB0eXBlT2YgKyAnXycgKyBrZXk7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICByZXR1cm4gb2lkUHJlZml4ICsgdHlwZU9mICsgJ18nICsga2V5O1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgIHJldHVybiBvaWRQcmVmaXggKyB0eXBlT2YgKyAnXycgKyBrZXk7XG4gICAgICAgIGNhc2UgJ3N5bWJvbCc6XG4gICAgICAgICAgICByZXR1cm4gb2lkUHJlZml4ICsgdHlwZU9mICsgJ18nICsga2V5O1xuICAgICAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgICAgICAgcmV0dXJuIG9pZFByZWZpeCArICd1bmRlZmluZWQnO1xuICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgLyplc2xpbnQtZGlzYWJsZSAqL1xuICAgICAgICAgICAgaWYgKGtleS5fX19maW5oYXNoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleS5fX19maW5oYXNoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAga2V5Ll9fX2Zpbmhhc2ggPSBvaWRQcmVmaXggKyBjb3VudGVyKys7XG4gICAgICAgICAgICByZXR1cm4ga2V5Ll9fX2Zpbmhhc2g7XG4gICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgICAgIGlmIChrZXkuX19fZmluaGFzaCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXkuX19fZmluaGFzaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGtleS5fX19maW5oYXNoID0gb2lkUHJlZml4ICsgY291bnRlcisrO1xuICAgICAgICAgICAgcmV0dXJuIGtleS5fX19maW5oYXNoOyAvKmVzbGludC1lbmFibGUgKi9cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QuaXMgcG9seWZpbGwsIGNvdXJ0ZXN5IG9mIEBXZWJSZWZsZWN0aW9uXG4gICAgdmFyIGlzID0gT2JqZWN0LmlzIHx8XG4gICAgZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gYSA9PT0gYiA/IGEgIT09IDAgfHwgMSAvIGEgPT0gMSAvIGIgOiBhICE9IGEgJiYgYiAhPSBiOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgfTtcblxuICAgIC8vIE1vcmUgcmVsaWFibGUgaW5kZXhPZiwgY291cnRlc3kgb2YgQFdlYlJlZmxlY3Rpb25cbiAgICB2YXIgYmV0dGVySW5kZXhPZiA9IGZ1bmN0aW9uKGFyciwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9IHZhbHVlIHx8IHZhbHVlID09PSAwKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSBhcnIubGVuZ3RoOyBpLS0gJiYgIWlzKGFycltpXSwgdmFsdWUpOykgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpID0gW10uaW5kZXhPZi5jYWxsKGFyciwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBNYXBweSgpIHtcbiAgICAgICAgdGhpcy5rZXlzID0gW107XG4gICAgICAgIHRoaXMuZGF0YSA9IHt9O1xuICAgICAgICB0aGlzLnZhbHVlcyA9IFtdO1xuICAgIH1cblxuICAgIE1hcHB5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICAgIHZhciBoYXNoQ29kZSA9IGhhc2goa2V5KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVtoYXNoQ29kZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5rZXlzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIHRoaXMudmFsdWVzLnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGF0YVtoYXNoQ29kZV0gPSB2YWx1ZTtcbiAgICB9O1xuXG4gICAgTWFwcHkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICB2YXIgaGFzaENvZGUgPSBoYXNoKGtleSk7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFbaGFzaENvZGVdO1xuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUuZ2V0SWZBYnNlbnQgPSBmdW5jdGlvbihrZXksIGlmQWJzZW50RnVuYykge1xuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdmFsdWUgPSBpZkFic2VudEZ1bmMoa2V5LCB0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmtleXMubGVuZ3RoO1xuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5rZXlzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuZGF0YSA9IHt9O1xuICAgIH07XG5cbiAgICBNYXBweS5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHZhciBoYXNoQ29kZSA9IGhhc2goa2V5KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVtoYXNoQ29kZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBpbmRleCA9IGJldHRlckluZGV4T2YodGhpcy5rZXlzLCBrZXkpO1xuICAgICAgICB0aGlzLmtleXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgdGhpcy52YWx1ZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgZGVsZXRlIHRoaXMuZGF0YVtoYXNoQ29kZV07XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oZnVuYykge1xuICAgICAgICB2YXIga2V5cyA9IHRoaXMua2V5cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBmdW5jKHZhbHVlLCBrZXksIHRoaXMpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIE1hcHB5LnByb3RvdHlwZS5tYXAgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgICAgIHZhciBrZXlzID0gdGhpcy5rZXlzO1xuICAgICAgICB2YXIgbmV3TWFwID0gbmV3IE1hcHB5KCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgdmFyIHRyYW5zZm9ybWVkID0gZnVuYyh2YWx1ZSwga2V5LCB0aGlzKTtcbiAgICAgICAgICAgIG5ld01hcC5zZXQoa2V5LCB0cmFuc2Zvcm1lZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld01hcDtcbiAgICB9O1xuXG4gICAgTWFwcHkucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGtleXMgPSB0aGlzLmtleXM7XG4gICAgICAgIHZhciBuZXdNYXAgPSBuZXcgTWFwcHkoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBuZXdNYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdNYXA7XG4gICAgfTtcblxuICAgIHJldHVybiBNYXBweTtcblxufSkoKTtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwib01mcEFuXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcixhcmd1bWVudHNbM10sYXJndW1lbnRzWzRdLGFyZ3VtZW50c1s1XSxhcmd1bWVudHNbNl0sXCIvTWFwLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RhYmxlU29ydCA9IHJlcXVpcmUoJy4vc3RhYmxlU29ydC5qcycpO1xudmFyIE1hcCA9IHJlcXVpcmUoJy4vTWFwLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3RhYmxlU29ydDogc3RhYmxlU29ydCxcbiAgICAgICAgTWFwOiBNYXBcbiAgICB9O1xuXG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9VdGlscy5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICByZXR1cm4ge1xuXG4gICAgICAgIGNvdW50OiBmdW5jdGlvbigpIHsgLyogY29sdW1JbmRleCAqL1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiByb3dzO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBzdW06IGZ1bmN0aW9uKGNvbHVtSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihncm91cCkge1xuICAgICAgICAgICAgICAgIHZhciBzdW0gPSAwO1xuICAgICAgICAgICAgICAgIHZhciByb3dzID0gZ3JvdXAuZ2V0Um93Q291bnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IHJvd3M7IHIrKykge1xuICAgICAgICAgICAgICAgICAgICBzdW0gPSBzdW0gKyBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgbWluOiBmdW5jdGlvbihjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICAgICAgICAgICAgICB2YXIgbWluID0gMDtcbiAgICAgICAgICAgICAgICB2YXIgcm93cyA9IGdyb3VwLmdldFJvd0NvdW50KCk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWluID0gTWF0aC5taW4obWluLCBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtaW47XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG5cbiAgICAgICAgbWF4OiBmdW5jdGlvbihjb2x1bUluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICAgICAgICAgICAgICB2YXIgbWF4ID0gMDtcbiAgICAgICAgICAgICAgICB2YXIgcm93cyA9IGdyb3VwLmdldFJvd0NvdW50KCk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gTWF0aC5tYXgobWF4LCBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtYXg7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG4gICAgICAgIGF2ZzogZnVuY3Rpb24oY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHIgPSAwOyByIDwgcm93czsgcisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1bSA9IHN1bSArIGdyb3VwLmdldFZhbHVlKGNvbHVtSW5kZXgsIHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gc3VtIC8gcm93cztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgZmlyc3Q6IGZ1bmN0aW9uKGNvbHVtSW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihncm91cCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCAwKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgbGFzdDogZnVuY3Rpb24oY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIHJldHVybiBncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByb3dzIC0gMSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuXG4gICAgICAgIHN0ZGRldjogZnVuY3Rpb24oY29sdW1JbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHI7XG4gICAgICAgICAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIHJvd3MgPSBncm91cC5nZXRSb3dDb3VudCgpO1xuICAgICAgICAgICAgICAgIGZvciAociA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc3VtID0gc3VtICsgZ3JvdXAuZ2V0VmFsdWUoY29sdW1JbmRleCwgcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBtZWFuID0gc3VtIC8gcm93cztcbiAgICAgICAgICAgICAgICB2YXIgdmFyaWFuY2UgPSAwO1xuICAgICAgICAgICAgICAgIGZvciAociA9IDA7IHIgPCByb3dzOyByKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRldiA9IChncm91cC5nZXRWYWx1ZShjb2x1bUluZGV4LCByKSAtIG1lYW4pO1xuICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZSA9IHZhcmlhbmNlICsgKGRldiAqIGRldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBzdGRkZXYgPSBNYXRoLnNxcnQodmFyaWFuY2UgLyByb3dzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RkZGV2O1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2FnZ3JlZ2F0aW9ucy5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIEpTRGF0YVNvdXJjZSA9IHJlcXVpcmUoJy4vSlNEYXRhU291cmNlJyk7XG52YXIgRGF0YVNvdXJjZVNvcnRlciA9IHJlcXVpcmUoJy4vRGF0YVNvdXJjZVNvcnRlcicpO1xudmFyIERhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VTb3J0ZXJDb21wb3NpdGUnKTtcbnZhciBEYXRhU291cmNlRmlsdGVyID0gcmVxdWlyZSgnLi9EYXRhU291cmNlRmlsdGVyJyk7XG52YXIgRGF0YVNvdXJjZUFnZ3JlZ2F0b3IgPSByZXF1aXJlKCcuL0RhdGFTb3VyY2VBZ2dyZWdhdG9yJyk7XG52YXIgYWdncmVnYXRpb25zID0gcmVxdWlyZSgnLi9hZ2dyZWdhdGlvbnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBKU0RhdGFTb3VyY2U6IEpTRGF0YVNvdXJjZSxcbiAgICAgICAgRGF0YVNvdXJjZVNvcnRlcjogRGF0YVNvdXJjZVNvcnRlcixcbiAgICAgICAgRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZTogRGF0YVNvdXJjZVNvcnRlckNvbXBvc2l0ZSxcbiAgICAgICAgRGF0YVNvdXJjZUZpbHRlcjogRGF0YVNvdXJjZUZpbHRlcixcbiAgICAgICAgRGF0YVNvdXJjZUFnZ3JlZ2F0b3I6IERhdGFTb3VyY2VBZ2dyZWdhdG9yLFxuICAgICAgICBhZ2dyZWdhdGlvbnM6IGFnZ3JlZ2F0aW9uc1xuICAgIH07XG5cbn0pKCk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIm9NZnBBblwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30scmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIsYXJndW1lbnRzWzNdLGFyZ3VtZW50c1s0XSxhcmd1bWVudHNbNV0sYXJndW1lbnRzWzZdLFwiL2FuYWx5dGljcy5qc1wiLFwiL1wiKSIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwsQnVmZmVyLF9fYXJndW1lbnQwLF9fYXJndW1lbnQxLF9fYXJndW1lbnQyLF9fYXJndW1lbnQzLF9fZmlsZW5hbWUsX19kaXJuYW1lKXtcbi8qIGVzbGludC1lbnYgbm9kZSwgYnJvd3NlciAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYW5hbHl0aWNzID0gcmVxdWlyZSgnLi9hbmFseXRpY3MuanMnKTtcblxuaWYgKCF3aW5kb3cuZmluKSB7XG4gICAgd2luZG93LmZpbiA9IHt9O1xufVxuaWYgKCF3aW5kb3cuZmluLmFuYWx5dGljcykge1xuICAgIHdpbmRvdy5maW4uYW5hbHl0aWNzID0gYW5hbHl0aWNzO1xufVxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9mYWtlXzI3YWZlMTdjLmpzXCIsXCIvXCIpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIsX19hcmd1bWVudDAsX19hcmd1bWVudDEsX19hcmd1bWVudDIsX19hcmd1bWVudDMsX19maWxlbmFtZSxfX2Rpcm5hbWUpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RhYmlsaXplID0gZnVuY3Rpb24oY29tcGFyYXRvciwgZGVzY2VuZGluZykge1xuICAgIHJldHVybiBmdW5jdGlvbihhcnIxLCBhcnIyKSB7XG4gICAgICAgIHZhciB4ID0gYXJyMVswXTtcbiAgICAgICAgdmFyIHkgPSBhcnIyWzBdO1xuICAgICAgICBpZiAoeCA9PT0geSkge1xuICAgICAgICAgICAgeCA9IGRlc2NlbmRpbmcgPyBhcnIyWzFdIDogYXJyMVsxXTtcbiAgICAgICAgICAgIHkgPSBkZXNjZW5kaW5nID8gYXJyMVsxXSA6IGFycjJbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoeSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh4ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBhcmF0b3IoeCwgeSk7XG4gICAgfTtcbn07XG5cblxudmFyIGFzY2VuZGluZ051bWJlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHggLSB5O1xufTtcblxudmFyIGRlc2NlbmRpbmdOdW1iZXJzID0gZnVuY3Rpb24oeCwgeSkge1xuICAgIHJldHVybiB5IC0geDtcbn07XG5cbnZhciBhc2NlbmRpbmdBbGxPdGhlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHggPCB5ID8gLTEgOiAxO1xufTtcblxudmFyIGRlc2NlbmRpbmdBbGxPdGhlcnMgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgcmV0dXJuIHkgPCB4ID8gLTEgOiAxO1xufTtcblxudmFyIGFzY2VuZGluZyA9IGZ1bmN0aW9uKHR5cGVPZkRhdGEpIHtcbiAgICBpZiAodHlwZU9mRGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHN0YWJpbGl6ZShhc2NlbmRpbmdOdW1iZXJzLCBmYWxzZSk7XG4gICAgfVxuICAgIHJldHVybiBzdGFiaWxpemUoYXNjZW5kaW5nQWxsT3RoZXJzLCBmYWxzZSk7XG59O1xuXG52YXIgZGVzY2VuZGluZyA9IGZ1bmN0aW9uKHR5cGVPZkRhdGEpIHtcbiAgICBpZiAodHlwZU9mRGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHN0YWJpbGl6ZShkZXNjZW5kaW5nTnVtYmVycywgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBzdGFiaWxpemUoZGVzY2VuZGluZ0FsbE90aGVycywgdHJ1ZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcblxuICAgIGZ1bmN0aW9uIHNvcnQoaW5kZXhWZWN0b3IsIGRhdGFTb3VyY2UsIHNvcnRUeXBlKSB7XG5cbiAgICAgICAgdmFyIGNvbXBhcmUsIGk7XG5cbiAgICAgICAgaWYgKGluZGV4VmVjdG9yLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuOyAvL25vdGhpbmcgdG8gZG87XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydFR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc29ydFR5cGUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNvcnRUeXBlID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIG5vdGhpbmcgdG8gc29ydCBoZXJlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHR5cGVPZkRhdGEgPSB0eXBlb2YgZGF0YVNvdXJjZSgwKTtcblxuICAgICAgICBjb21wYXJlID0gKHNvcnRUeXBlID09PSAxKSA/IGFzY2VuZGluZyh0eXBlT2ZEYXRhKSA6IGRlc2NlbmRpbmcodHlwZU9mRGF0YSk7XG5cbiAgICAgICAgLy9zdGFydCB0aGUgYWN0dWFsbHkgc29ydGluZy4uLi4uXG4gICAgICAgIHZhciB0bXAgPSBuZXcgQXJyYXkoaW5kZXhWZWN0b3IubGVuZ3RoKTtcblxuICAgICAgICAvL2xldHMgYWRkIHRoZSBpbmRleCBmb3Igc3RhYmlsaXR5XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbmRleFZlY3Rvci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdG1wW2ldID0gW2RhdGFTb3VyY2UoaSksIGldO1xuICAgICAgICB9XG5cbiAgICAgICAgdG1wLnNvcnQoY29tcGFyZSk7XG5cbiAgICAgICAgLy9jb3B5IHRoZSBzb3J0ZWQgdmFsdWVzIGludG8gb3VyIGluZGV4IHZlY3RvclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgaW5kZXhWZWN0b3IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGluZGV4VmVjdG9yW2ldID0gdG1wW2ldWzFdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNvcnQ7XG59KSgpO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJvTWZwQW5cIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9LHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyLGFyZ3VtZW50c1szXSxhcmd1bWVudHNbNF0sYXJndW1lbnRzWzVdLGFyZ3VtZW50c1s2XSxcIi9zdGFibGVTb3J0LmpzXCIsXCIvXCIpIl19
