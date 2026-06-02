/* @ts-self-types="./polymarket_wasm.d.ts" */

/**
 * Build and validate an order for the Polymarket CLOB.
 *
 * Returns a BuiltOrder with the order payload ready for signing,
 * or an error if validation fails.
 * @param {any} params_js
 * @returns {any}
 */
export function build_order(params_js) {
  const ret = wasm.build_order(addHeapObject(params_js))
  return takeObject(ret)
}

/**
 * Derive wallet address from private key (hex)
 * @param {string} private_key_hex
 * @returns {any}
 */
export function derive_address(private_key_hex) {
  const ptr0 = passStringToWasm0(private_key_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ret = wasm.derive_address(ptr0, len0)
  return takeObject(ret)
}

/**
 * Compute HMAC-SHA256 of a message with a base64-encoded secret.
 * Returns base64-encoded signature.
 * @param {string} secret_b64
 * @param {string} message
 * @returns {any}
 */
export function hmac_sha256(secret_b64, message) {
  const ptr0 = passStringToWasm0(secret_b64, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ptr1 = passStringToWasm0(message, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len1 = WASM_VECTOR_LEN
  const ret = wasm.hmac_sha256(ptr0, len0, ptr1, len1)
  return takeObject(ret)
}

/**
 * Compute keccak256 hash of input bytes (hex encoded).
 * Useful for EIP-712 type hashing.
 * @param {string} input_hex
 * @returns {any}
 */
export function keccak256_hex(input_hex) {
  const ptr0 = passStringToWasm0(input_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ret = wasm.keccak256_hex(ptr0, len0)
  return takeObject(ret)
}

/**
 * Generate L1 EIP-712 authentication headers for API key derivation.
 *
 * Parameters:
 * - private_key_hex: Wallet private key (hex, with or without 0x)
 * - timestamp: Unix timestamp as string
 * - nonce: Nonce value as string
 * @param {string} private_key_hex
 * @param {string} timestamp
 * @param {string} nonce
 * @returns {any}
 */
export function sign_l1_auth(private_key_hex, timestamp, nonce) {
  const ptr0 = passStringToWasm0(private_key_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ptr1 = passStringToWasm0(timestamp, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len1 = WASM_VECTOR_LEN
  const ptr2 = passStringToWasm0(nonce, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len2 = WASM_VECTOR_LEN
  const ret = wasm.sign_l1_auth(ptr0, len0, ptr1, len1, ptr2, len2)
  return takeObject(ret)
}

/**
 * Generate L2 HMAC-SHA256 authentication headers for trading operations.
 *
 * Parameters:
 * - api_key: API key string
 * - secret: Base64-encoded HMAC secret
 * - passphrase: API passphrase
 * - timestamp: Unix timestamp as string
 * - method: HTTP method (GET, POST, DELETE)
 * - path: Request path (e.g., "/order")
 * - body: Request body (empty string for GET/DELETE)
 * @param {string} api_key
 * @param {string} secret
 * @param {string} passphrase
 * @param {string} timestamp
 * @param {string} method
 * @param {string} path
 * @param {string} body
 * @param {string} address
 * @returns {any}
 */
export function sign_l2_auth(api_key, secret, passphrase, timestamp, method, path, body, address) {
  const ptr0 = passStringToWasm0(api_key, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ptr1 = passStringToWasm0(secret, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len1 = WASM_VECTOR_LEN
  const ptr2 = passStringToWasm0(passphrase, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len2 = WASM_VECTOR_LEN
  const ptr3 = passStringToWasm0(timestamp, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len3 = WASM_VECTOR_LEN
  const ptr4 = passStringToWasm0(method, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len4 = WASM_VECTOR_LEN
  const ptr5 = passStringToWasm0(path, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len5 = WASM_VECTOR_LEN
  const ptr6 = passStringToWasm0(body, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len6 = WASM_VECTOR_LEN
  const ptr7 = passStringToWasm0(address, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len7 = WASM_VECTOR_LEN
  const ret = wasm.sign_l2_auth(
    ptr0,
    len0,
    ptr1,
    len1,
    ptr2,
    len2,
    ptr3,
    len3,
    ptr4,
    len4,
    ptr5,
    len5,
    ptr6,
    len6,
    ptr7,
    len7,
  )
  return takeObject(ret)
}

/**
 * Sign an order with EIP-712 (for CLOB submission).
 * Takes the built order payload and private key, returns signed order.
 * @param {any} order_js
 * @param {string} private_key_hex
 * @returns {any}
 */
export function sign_order(order_js, private_key_hex) {
  const ptr0 = passStringToWasm0(private_key_hex, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ret = wasm.sign_order(addHeapObject(order_js), ptr0, len0)
  return takeObject(ret)
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_960c155d3d49e4c2: function (arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1))
      return addHeapObject(ret)
    },
    __wbg_Number_32bf70a599af1d4b: function (arg0) {
      const ret = Number(getObject(arg0))
      return ret
    },
    __wbg_String_8564e559799eccda: function (arg0, arg1) {
      const ret = String(getObject(arg1))
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2)
      const len1 = WASM_VECTOR_LEN
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true)
    },
    __wbg___wbindgen_boolean_get_6ea149f0a8dcc5ff: function (arg0) {
      const v = getObject(arg0)
      const ret = typeof v === 'boolean' ? v : undefined
      return isLikeNone(ret) ? 0xffffff : ret ? 1 : 0
    },
    __wbg___wbindgen_debug_string_ab4b34d23d6778bd: function (arg0, arg1) {
      const ret = debugString(getObject(arg1))
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2)
      const len1 = WASM_VECTOR_LEN
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true)
    },
    __wbg___wbindgen_in_a5d8b22e52b24dd1: function (arg0, arg1) {
      const ret = getObject(arg0) in getObject(arg1)
      return ret
    },
    __wbg___wbindgen_is_function_3baa9db1a987f47d: function (arg0) {
      const ret = typeof getObject(arg0) === 'function'
      return ret
    },
    __wbg___wbindgen_is_object_63322ec0cd6ea4ef: function (arg0) {
      const val = getObject(arg0)
      const ret = typeof val === 'object' && val !== null
      return ret
    },
    __wbg___wbindgen_is_string_6df3bf7ef1164ed3: function (arg0) {
      const ret = typeof getObject(arg0) === 'string'
      return ret
    },
    __wbg___wbindgen_is_undefined_29a43b4d42920abd: function (arg0) {
      const ret = getObject(arg0) === undefined
      return ret
    },
    __wbg___wbindgen_jsval_loose_eq_cac3565e89b4134c: function (arg0, arg1) {
      const ret = getObject(arg0) == getObject(arg1)
      return ret
    },
    __wbg___wbindgen_number_get_c7f42aed0525c451: function (arg0, arg1) {
      const obj = getObject(arg1)
      const ret = typeof obj === 'number' ? obj : undefined
      getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true)
    },
    __wbg___wbindgen_string_get_7ed5322991caaec5: function (arg0, arg1) {
      const obj = getObject(arg1)
      const ret = typeof obj === 'string' ? obj : undefined
      var ptr1 = isLikeNone(ret)
        ? 0
        : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2)
      var len1 = WASM_VECTOR_LEN
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true)
    },
    __wbg___wbindgen_throw_6b64449b9b9ed33c: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1))
    },
    __wbg_call_a24592a6f349a97e: function () {
      return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).call(getObject(arg1), getObject(arg2))
        return addHeapObject(ret)
      }, arguments)
    },
    __wbg_crypto_38df2bab126b63dc: function (arg0) {
      const ret = getObject(arg0).crypto
      return addHeapObject(ret)
    },
    __wbg_getRandomValues_c44a50d8cfdaebeb: function () {
      return handleError(function (arg0, arg1) {
        getObject(arg0).getRandomValues(getObject(arg1))
      }, arguments)
    },
    __wbg_get_with_ref_key_6412cf3094599694: function (arg0, arg1) {
      const ret = getObject(arg0)[getObject(arg1)]
      return addHeapObject(ret)
    },
    __wbg_instanceof_ArrayBuffer_7c8433c6ed14ffe3: function (arg0) {
      let result
      try {
        result = getObject(arg0) instanceof ArrayBuffer
      } catch (_) {
        result = false
      }
      const ret = result
      return ret
    },
    __wbg_instanceof_Uint8Array_152ba1f289edcf3f: function (arg0) {
      let result
      try {
        result = getObject(arg0) instanceof Uint8Array
      } catch (_) {
        result = false
      }
      const ret = result
      return ret
    },
    __wbg_isSafeInteger_4fc213d1989d6d2a: function (arg0) {
      const ret = Number.isSafeInteger(getObject(arg0))
      return ret
    },
    __wbg_length_9f1775224cf1d815: function (arg0) {
      const ret = getObject(arg0).length
      return ret
    },
    __wbg_msCrypto_bd5a034af96bcba6: function (arg0) {
      const ret = getObject(arg0).msCrypto
      return addHeapObject(ret)
    },
    __wbg_new_0c7403db6e782f19: function (arg0) {
      const ret = new Uint8Array(getObject(arg0))
      return addHeapObject(ret)
    },
    __wbg_new_34d45cc8e36aaead: function () {
      const ret = new Map()
      return addHeapObject(ret)
    },
    __wbg_new_682678e2f47e32bc: function () {
      const ret = new Array()
      return addHeapObject(ret)
    },
    __wbg_new_aa8d0fa9762c29bd: function () {
      const ret = new Object()
      return addHeapObject(ret)
    },
    __wbg_new_with_length_8c854e41ea4dae9b: function (arg0) {
      const ret = new Uint8Array(arg0 >>> 0)
      return addHeapObject(ret)
    },
    __wbg_node_84ea875411254db1: function (arg0) {
      const ret = getObject(arg0).node
      return addHeapObject(ret)
    },
    __wbg_process_44c7a14e11e9f69e: function (arg0) {
      const ret = getObject(arg0).process
      return addHeapObject(ret)
    },
    __wbg_prototypesetcall_a6b02eb00b0f4ce2: function (arg0, arg1, arg2) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2))
    },
    __wbg_randomFillSync_6c25eac9869eb53c: function () {
      return handleError(function (arg0, arg1) {
        getObject(arg0).randomFillSync(takeObject(arg1))
      }, arguments)
    },
    __wbg_require_b4edbdcf3e2a1ef0: function () {
      return handleError(function () {
        const ret = module.require
        return addHeapObject(ret)
      }, arguments)
    },
    __wbg_set_3bf1de9fab0cd644: function (arg0, arg1, arg2) {
      getObject(arg0)[arg1 >>> 0] = takeObject(arg2)
    },
    __wbg_set_6be42768c690e380: function (arg0, arg1, arg2) {
      getObject(arg0)[takeObject(arg1)] = takeObject(arg2)
    },
    __wbg_set_fde2cec06c23692b: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).set(getObject(arg1), getObject(arg2))
      return addHeapObject(ret)
    },
    __wbg_static_accessor_GLOBAL_8cfadc87a297ca02: function () {
      const ret = typeof global === 'undefined' ? null : global
      return isLikeNone(ret) ? 0 : addHeapObject(ret)
    },
    __wbg_static_accessor_GLOBAL_THIS_602256ae5c8f42cf: function () {
      const ret = typeof globalThis === 'undefined' ? null : globalThis
      return isLikeNone(ret) ? 0 : addHeapObject(ret)
    },
    __wbg_static_accessor_SELF_e445c1c7484aecc3: function () {
      const ret = typeof self === 'undefined' ? null : self
      return isLikeNone(ret) ? 0 : addHeapObject(ret)
    },
    __wbg_static_accessor_WINDOW_f20e8576ef1e0f17: function () {
      const ret = typeof window === 'undefined' ? null : window
      return isLikeNone(ret) ? 0 : addHeapObject(ret)
    },
    __wbg_subarray_f8ca46a25b1f5e0d: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0)
      return addHeapObject(ret)
    },
    __wbg_versions_276b2795b1c6a219: function (arg0) {
      const ret = getObject(arg0).versions
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000001: function (arg0) {
      // Cast intrinsic for `F64 -> Externref`.
      const ret = arg0
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000002: function (arg0) {
      // Cast intrinsic for `I64 -> Externref`.
      const ret = arg0
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000003: function (arg0, arg1) {
      // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
      const ret = getArrayU8FromWasm0(arg0, arg1)
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000004: function (arg0, arg1) {
      // Cast intrinsic for `Ref(String) -> Externref`.
      const ret = getStringFromWasm0(arg0, arg1)
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000005: function (arg0) {
      // Cast intrinsic for `U64 -> Externref`.
      const ret = BigInt.asUintN(64, arg0)
      return addHeapObject(ret)
    },
    __wbindgen_object_clone_ref: function (arg0) {
      const ret = getObject(arg0)
      return addHeapObject(ret)
    },
    __wbindgen_object_drop_ref: function (arg0) {
      takeObject(arg0)
    },
  }
  return {
    __proto__: null,
    './polymarket_wasm_bg.js': import0,
  }
}

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1)
  const idx = heap_next
  heap_next = heap[idx]

  heap[idx] = obj
  return idx
}

function debugString(val) {
  // primitive types
  const type = typeof val
  if (type == 'number' || type == 'boolean' || val == null) {
    return `${val}`
  }
  if (type == 'string') {
    return `"${val}"`
  }
  if (type == 'symbol') {
    const description = val.description
    if (description == null) {
      return 'Symbol'
    } else {
      return `Symbol(${description})`
    }
  }
  if (type == 'function') {
    const name = val.name
    if (typeof name == 'string' && name.length > 0) {
      return `Function(${name})`
    } else {
      return 'Function'
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length
    let debug = '['
    if (length > 0) {
      debug += debugString(val[0])
    }
    for (let i = 1; i < length; i++) {
      debug += ', ' + debugString(val[i])
    }
    debug += ']'
    return debug
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val))
  let className
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1]
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val)
  }
  if (className == 'Object') {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return 'Object(' + JSON.stringify(val) + ')'
    } catch (_) {
      return 'Object'
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className
}

function dropObject(idx) {
  if (idx < 1028) return
  heap[idx] = heap_next
  heap_next = idx
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len)
}

let cachedDataViewMemory0 = null
function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer)
  }
  return cachedDataViewMemory0
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0
  return decodeText(ptr, len)
}

let cachedUint8ArrayMemory0 = null
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer)
  }
  return cachedUint8ArrayMemory0
}

function getObject(idx) {
  return heap[idx]
}

function handleError(f, args) {
  try {
    return f.apply(this, args)
  } catch (e) {
    wasm.__wbindgen_export3(addHeapObject(e))
  }
}

let heap = new Array(1024).fill(undefined)
heap.push(undefined, null, true, false)

let heap_next = heap.length

function isLikeNone(x) {
  return x === undefined || x === null
}

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg)
    const ptr = malloc(buf.length, 1) >>> 0
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf)
    WASM_VECTOR_LEN = buf.length
    return ptr
  }

  let len = arg.length
  let ptr = malloc(len, 1) >>> 0

  const mem = getUint8ArrayMemory0()

  let offset = 0

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset)
    if (code > 0x7f) break
    mem[ptr + offset] = code
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset)
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len)
    const ret = cachedTextEncoder.encodeInto(arg, view)

    offset += ret.written
    ptr = realloc(ptr, len, offset, 1) >>> 0
  }

  WASM_VECTOR_LEN = offset
  return ptr
}

function takeObject(idx) {
  const ret = getObject(idx)
  dropObject(idx)
  return ret
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
cachedTextDecoder.decode()
const MAX_SAFARI_DECODE_BYTES = 2146435072
let numBytesDecoded = 0
function decodeText(ptr, len) {
  numBytesDecoded += len
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
    cachedTextDecoder.decode()
    numBytesDecoded = len
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len))
}

const cachedTextEncoder = new TextEncoder()

if (!('encodeInto' in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg)
    view.set(buf)
    return {
      read: arg.length,
      written: buf.length,
    }
  }
}

let WASM_VECTOR_LEN = 0

let wasmModule, wasm
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports
  wasmModule = module
  cachedDataViewMemory0 = null
  cachedUint8ArrayMemory0 = null
  return wasm
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports)
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type)

        if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e,
          )
        } else {
          throw e
        }
      }
    }

    const bytes = await module.arrayBuffer()
    return await WebAssembly.instantiate(bytes, imports)
  } else {
    const instance = await WebAssembly.instantiate(module, imports)

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module }
    } else {
      return instance
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case 'basic':
      case 'cors':
      case 'default':
        return true
    }
    return false
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ;({ module } = module)
    } else {
      console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
    }
  }

  const imports = __wbg_get_imports()
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module)
  }
  const instance = new WebAssembly.Instance(module, imports)
  return __wbg_finalize_init(instance, module)
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ;({ module_or_path } = module_or_path)
    } else {
      console.warn(
        'using deprecated parameters for the initialization function; pass a single object instead',
      )
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL('polymarket_wasm_bg.wasm', import.meta.url)
  }
  const imports = __wbg_get_imports()

  if (
    typeof module_or_path === 'string' ||
    (typeof Request === 'function' && module_or_path instanceof Request) ||
    (typeof URL === 'function' && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path)
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports)

  return __wbg_finalize_init(instance, module)
}

export { initSync, __wbg_init as default }
