// This code implements the `-sMODULARIZE` settings by taking the generated
// JS program code (INNER_JS_CODE) and wrapping it in a factory function.

// Single threaded MINIMAL_RUNTIME programs do not need access to
// document.currentScript, so a simple export declaration is enough.
var createAudioEngine = (() => {
  // When MODULARIZE this JS may be executed later,
  // after document.currentScript is gone, so we save it.
  // In EXPORT_ES6 mode we can just use 'import.meta.url'.
  var _scriptName = globalThis.document?.currentScript?.src;
  return async function(moduleArg = {}) {
    var moduleRtn;

// include: shell.js
// include: minimum_runtime_check.js
(function() {
  // "30.0.0" -> 300000
  function humanReadableVersionToPacked(str) {
    str = str.split('-')[0]; // Remove any trailing part from e.g. "12.53.3-alpha"
    var vers = str.split('.').slice(0, 3);
    while(vers.length < 3) vers.push('00');
    vers = vers.map((n, i, arr) => n.padStart(2, '0'));
    return vers.join('');
  }
  // 300000 -> "30.0.0"
  var packedVersionToHumanReadable = n => [n / 10000 | 0, (n / 100 | 0) % 100, n % 100].join('.');

  var TARGET_NOT_SUPPORTED = 2147483647;

  // Note: We use a typeof check here instead of optional chaining using
  // globalThis because older browsers might not have globalThis defined.
  var currentNodeVersion = typeof process !== 'undefined' && process.versions?.node ? humanReadableVersionToPacked(process.versions.node) : TARGET_NOT_SUPPORTED;
  if (currentNodeVersion < TARGET_NOT_SUPPORTED) {
    throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
  }
  if (currentNodeVersion < 2147483647) {
    throw new Error(`This emscripten-generated code requires node v${ packedVersionToHumanReadable(2147483647) } (detected v${packedVersionToHumanReadable(currentNodeVersion)})`);
  }

  var userAgent = typeof navigator !== 'undefined' && navigator.userAgent;
  if (!userAgent) {
    return;
  }

  var currentSafariVersion = userAgent.includes("Safari/") && !userAgent.includes("Chrome/") && userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/) ? humanReadableVersionToPacked(userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentSafariVersion < 150000) {
    throw new Error(`This emscripten-generated code requires Safari v${ packedVersionToHumanReadable(150000) } (detected v${currentSafariVersion})`);
  }

  var currentFirefoxVersion = userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentFirefoxVersion < 79) {
    throw new Error(`This emscripten-generated code requires Firefox v79 (detected v${currentFirefoxVersion})`);
  }

  var currentChromeVersion = userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentChromeVersion < 85) {
    throw new Error(`This emscripten-generated code requires Chrome v85 (detected v${currentChromeVersion})`);
  }
})();

// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = moduleArg;

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;
var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)


var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_SHELL) {

  readBinary = (f) => {
    if (globalThis.readbuffer) {
      return new Uint8Array(readbuffer(f));
    }
    let data = read(f, 'binary');
    assert(typeof data == 'object');
    return data;
  };

  readAsync = async (f) => readBinary(f);

  globalThis.clearTimeout ??= (id) => {};

  // spidermonkey lacks setTimeout but we use it above in readAsync.
  globalThis.setTimeout ??= (f) => f();

  // v8 uses `arguments_` whereas spidermonkey uses `scriptArgs`
  arguments_ = globalThis.arguments || globalThis.scriptArgs;

  if (globalThis.quit) {
    quit_ = (status, toThrow) => {
      // Unlike node which has process.exitCode, d8 has no such mechanism. So we
      // have no way to set the exit code and then let the program exit with
      // that code when it naturally stops running (say, when all setTimeouts
      // have completed). For that reason, we must call `quit` - the only way to
      // set the exit code - but quit also halts immediately.  To increase
      // consistency with node (and the web) we schedule the actual quit call
      // using a setTimeout to give the current stack and any exception handlers
      // a chance to run.  This enables features such as addOnPostRun (which
      // expected to be able to run code after main returns).
      setTimeout(() => {
        if (!(toThrow instanceof ExitStatus)) {
          let toLog = toThrow;
          if (toThrow && typeof toThrow == 'object' && toThrow.stack) {
            toLog = [toThrow, toThrow.stack];
          }
          err(`exiting due to exception: ${toLog}`);
        }
        quit(status);
      });
      throw toThrow;
    };
  }

  if (typeof print != 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    globalThis.console ??= /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (globalThis.printErr ?? print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL('.', _scriptName).href; // includes trailing slash
  } catch {
    // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
    // infer anything from them.
  }

  if (!(globalThis.window || globalThis.WorkerGlobalScope)) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  {
// include: web_or_worker_shell_read.js
if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = async (url) => {
    assert(!isFileURI(url), "readAsync does not work with file:// URLs");
    var response = await fetch(url, { credentials: 'same-origin' });
    if (response.ok) {
      return response.arrayBuffer();
    }
    throw new Error(response.status + ' : ' + response.url);
  };
// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = console.log.bind(console);
var err = console.error.bind(console);

var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message

assert(!ENVIRONMENT_IS_NODE, 'node environment detected but not enabled at build time.  Add `node` to `-sENVIRONMENT` to enable.');

// end include: shell.js

// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;

if (!globalThis.WebAssembly) {
  err('no native wasm support detected');
}

// Wasm globals

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');

// include: runtime_common.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)>>2)] = 0x02135467;
  HEAPU32[(((max)+(4))>>2)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAPU32[((0)>>2)] = 1668509029;
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = HEAPU32[((max)>>2)];
  var cookie2 = HEAPU32[(((max)+(4))>>2)];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)>>2)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
var runtimeDebug = true; // Switch to false at runtime to disable logging at the right times

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  if (!runtimeDebug && typeof runtimeDebug != 'undefined') return;
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) abort('Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)');
})();

function consumedModuleProp(prop) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      set() {
        abort(`Attempt to set \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`);

      }
    });
  }
}

function makeInvalidEarlyAccess(name) {
  return () => assert(false, `call to '${name}' via reference taken before Wasm module initialization`);

}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_preloadFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

function missingLibrarySymbol(sym) {

  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      },
    });
  }
}

// end include: runtime_debug.js
// include: binaryDecode.js
// Prevent Closure from minifying the binaryDecode() function, or otherwise
// Closure may analyze through the WASM_BINARY_DATA placeholder string into this
// function, leading into incorrect results.
/** @noinline */
function binaryDecode(bin) {
  for (var i = 0, l = bin.length, o = new Uint8Array(l), c; i < l; ++i) {
    c = bin.charCodeAt(i);
    o[i] = ~c >> 8 & c; // Recover the null byte in a manner that is compatible with https://crbug.com/453961758
  }
  return o;
}
// end include: binaryDecode.js
var readyPromiseResolve, readyPromiseReject;

// Memory management
var
/** @type {!Int8Array} */
  HEAP8,
/** @type {!Uint8Array} */
  HEAPU8,
/** @type {!Int16Array} */
  HEAP16,
/** @type {!Uint16Array} */
  HEAPU16,
/** @type {!Int32Array} */
  HEAP32,
/** @type {!Uint32Array} */
  HEAPU32,
/** @type {!Float32Array} */
  HEAPF32,
/** @type {!Float64Array} */
  HEAPF64;

// BigInt64Array type is not correctly defined in closure
var
/** not-@type {!BigInt64Array} */
  HEAP64,
/* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */
  HEAPU64;

var runtimeInitialized = false;



function updateMemoryViews() {
  var b = wasmMemory.buffer;
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  HEAP32 = new Int32Array(b);
  HEAPU32 = new Uint32Array(b);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(globalThis.Int32Array && globalThis.Float64Array && Int32Array.prototype.subarray && Int32Array.prototype.set,
       'JS engine does not provide full typed array support');

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  consumedModuleProp('preRun');
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
  // End ATPRERUNS hooks
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  // No ATINITS hooks

  wasmExports['__wasm_call_ctors']();

  // No ATPOSTCTORS hooks
}

function postRun() {
  checkStackCookie();
   // PThreads reuse the runtime from the main thread.

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  consumedModuleProp('postRun');

  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
  // End ATPOSTRUNS hooks
}

/** @param {string|number=} what */
function abort(what) {
  Module['onAbort']?.(what);

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  readyPromiseReject?.(e);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// show errors on likely calls to FS when it was not included
var FS = {
  error() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM');
  },
  init() { FS.error() },
  createDataFile() { FS.error() },
  createPreloadedFile() { FS.error() },
  createLazyFile() { FS.error() },
  open() { FS.error() },
  mkdev() { FS.error() },
  registerDevice() { FS.error() },
  analyzePath() { FS.error() },

  ErrnoError() { FS.error() },
};


function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

var wasmBinaryFile;

function findWasmBinary() {
  return binaryDecode(' asm   ¯@`  `` ` `} ` ` ` `}`}}}}}}```~~`|` ` `\r `~~ `\n ` |``~`}}}`}`}`} `}}`}}`} `}}}}`}}}}` }`~`~~``}} `} `|| `}}`}`}}`}}`}}`}} `|||`|`|||`||`||`|`|`|~~|`| `||`~|`|}``~`~`|~`~~ `}}}} `~~|`Áenv__cxa_throw env_embind_register_class env_embind_register_void env_embind_register_bool env_embind_register_integer env_embind_register_bigint env_embind_register_float env_embind_register_std_string env_embind_register_std_wstring env_embind_register_emval env_embind_register_memory_view env"_embind_register_class_constructor env_embind_register_class_function envemscripten_get_now wasi_snapshot_preview1fd_close wasi_snapshot_preview1fd_write wasi_snapshot_preview1fd_seek env	_abort_js  envemscripten_resize_heap Ã	Á	    \n\n\n\n\n  \n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n \n\n\n\n\n\n\n\n\n\n\n\n\n\n \n\n\n\n\n\n\n\n \n\n\n\n\n\n \n\n \n\n\n\n\n\n \n\n \n\n\n\n\n\n   	  \n\n\n\n\n\n\n\n\n\n\n\n\n\n  \n\n\n\n\n\n\n\n\n\n    \n\n\n\n\n \n\n\n\n\n\n ! "\n\n\n\n\n\n\n\n\n  ##$$%&\'(\'  \n\n))) \n\n\n\n)\n\n\n\n\n\n \n\n*\n\n\n\n\n\n+   \n\n\n\n\n\n\n\n\n\n\n\n ,"-./0/11/234\'//5\n44/ ,2  /6.3417 5/\n\n./\n"89::\r;\n\n \n\n\n<<= >"\n"\n\n\n\n\n \n\n\n \n\n\n\n\n ?"?\n\nprrAA A ¹memory __wasm_call_ctors \r__getTypeName __indirect_function_table free Üstrerror ¾malloc Úfflush emscripten_stack_get_end êemscripten_stack_get_base éemscripten_stack_init çemscripten_stack_get_free è_emscripten_stack_restore Ñ	_emscripten_stack_alloc Ò	emscripten_stack_get_current Ó		Í Aq^¦&,789:=>?@BCDMRSTUVW[XYZÈ	¿	ÚàèðöüìÎÐÑÓÔÕÖØÙÏÚ¡	ê¡ñôòùý¥é±³´²¹úýþü ¹ºÒÓíî¢	¥	£	¤	©	¦	¬	¾	¼	³	§	½	»	´	¨	¶	Ã	Ä	Æ	Ç	À	Á	Ì	Í	Ï	\n×	Á	" çèõÓÅáóµ\r   (¼    A (  6A   6  Ý Aà A¹  Aø AØ AA  A A¿ AAAÿ  A A¸ AAAÿ  A A¶ AA Aÿ A¨ A¾ AA~Aÿÿ A´ Aµ AA Aÿÿ AÀ AÍ AAxAÿÿÿÿ AÌ AÄ AA A AØ AÃ AAxAÿÿÿÿ Aä Aº AA A Að A° ABBÿÿÿÿÿÿÿÿÿ  Aü A§ AB B A Aë A A AÀ A A AÕ  AÔ AAÈ  A AAá  Aè AAð  A  A´ A AÅ  AÜ A A  A AAã  A¬ AA  AÔ AA±  Aü AAÙ  A¤ AAö  AÌ AA¯  Aô AAÍ  AÜ A AÜ  A AA»  A¬ AA  AÔ AAü  Aü AA¤  A¤ AA  A AAá  AÄ A	A¿  Aì AA  A AAô  C A A 6¤ A A 6¨  A A (  6¨ A A¤ 6   A¬ ¡ ¢# Ak! $    6 (! C D,G8  Aj  A<j  Aø j  AjC   AC  AC  @ÀA ²ñ  A ²8à Aèj  A¨j  Aèj  AÐj  A j  C  ?8Ð  AÔ j  A6à  Aè jC   AC  @@C  @ÀA ²ñ  A°<j  A ²8Ð< C  ?8Ô< AØ<j  C  C8À> A : Ä> A 6È> A 6Ì> A 6Ð> A : Ô> AØ>j!A! A  ü  AØÂ j!A! A  ü  AØÆ j!A! A  ü  AØÊ j!	A!\n 	A  \nü  AØÎ j!A! A  ü  AØÒ j!\rA! \rA  ü  AØÖ j!A! A  ü  AØÚ j!A! A  ü  Aj$  # Ak! $    6 (! C D,G8  Aj   A 6 A 6 A :  C  ?8 A ²8  A : $ C  ?8( A ²8, A : 0 C  ?84 Aj$  F# Ak! $    6 (! ¡  C  À@8 Aj$  <# Ak! $    6 (! ú  Aj$  l# Ak! $    6 (! ¢  Aè j¢  AÐj£  C>8Ü C333?8à Aj$  Q# Ak! $    6 (! A 6  A 6 A 6 ¤  Aj$  <# Ak! $    6 (! ¥  Aj$  Q# Ak! $    6 (! A 6  A 6 A 6 à  Aj$  <# Ak! $    6 (! â  Aj$  ´# Ak! $    6 (! A	  Aj   Aj   A j£  A,j£  A8j£  AÄ j£  C D,G8P A 6T A 6X A 6\\ A 6` A : d Aj$  Q# Ak! $    6 (! A 6  A 6 A 6 ä  Aj$  <# Ak! $    6 (! æ  Aj$  {# Ak! $    6 (!   Aà j  AÀjç  D    å@9Ø C   Á8à C  ÈB8ä Aj$  # Ak! $    6  8 (!  *8  Aj *  A<j *  A<jCÍÌÌ=  A<jAAq   Aø j *À  Aj *ò  Aèj *§  AèjA ¨  AèjC ÀÚE©  A¨j *§  A¨jA¨  A¨jC  ðA©  AÐj *§  AÐjA ¨  AÐjC ÀÚE©  A j *§  A jA¨  A jC  ðA©  Aè j *ò  A°<j *À  AØ<j *ª  «  Aj$ _# A k! $    6  8 (!  *»9 A6 A6  Ajþ  A j$ [# Ak! $    6  6 (!@@ (\r  A ü  Aü  Aj$ A# Ak! $    6  8 ( *ý  Aj$ w# A k! $    6  8 (!  *»9 A6 A6  Aj£  A ²   C   A¢  A j$ K# Ak!   6 (!@ *À>A ²^AqE\r   * C  pB *À>ü 6È>	\n}}\n}}# AÀ k! $    6<  68  64  60 (<!  (86,  (46(@ - Ä>AqE\r  (È>A JAqE\r   (0 (Ì>j6Ì>@@ (Ì> (È>NAqE\r (È>!  (Ì> k6Ì>  (Ð>Aj6Ð> Aj @@ - Ô>AqE\r  A<j  A 6Ð> A : Ô>@ (Ð>Ao\r  A<j   Aj AØ>j­  AØÂ j­  (0 @ *àA ²^AqE\r  AØ>j­  (0 AØÖ j­ ®  AØÂ j­  (0 AØÚ j­ ®  Aø j AØ>j­  AØÂ j­  (0Å  *à! C  ? 8$  *à8  A 6@@ ( (0HAqE\r AØÖ j (¯ * ! *$!	 AØ>j (¯ *  *   	!\n AØ>j (¯  \n8  AØÚ j (¯ * ! *$! AØÂ j (¯ *  *   !\r AØÂ j (¯  \r8   (Aj6  Aj AØ>j­  AØÂ j­  (0ó  A<j AØÆ j­  AØÊ j­  (0  Aèj AØÆ j­  AØÊ j­  (0°  A¨j AØÆ j­  AØÊ j­  (0° @@ (à A NAqE\r  A 6@@ ( (0HAqE\r AØ>j (¯ *  AØÆ j (¯ * ! AØÎ j (¯  8  AØÂ j (¯ *  AØÊ j (¯ * ! AØÒ j (¯  8   (Aj6  Aèj AØÎ j­  AØÒ j­  (0  AÐj AØÎ j­  AØÒ j­  (0°  A j AØÎ j­  AØÒ j­  (0°  A 6@@ ( (0HAqE\r *Ð ! AØÎ j (¯ !   * 8  *Ð ! AØÒ j (¯ !   * 8   (Aj6  AØÎ j­ ! (0At!A !@ E\r    ü  AØÒ j­ ! (0At!A !@ E\r    ü  A 6@@ ( (0HAqE\r AØ>j (¯ *  AØÆ j (¯ *  AØÎ j (¯ * ! (, (Atj 8  AØÂ j (¯ *  AØÊ j (¯ *  AØÒ j (¯ * ! (( (Atj 8   (Aj6  Aè j (, (( (0ó @ *Ð<A ²^AqE\r  (, (0 AØÖ j­ ®  (( (0 AØÚ j­ ®  A°<j (, (( (0Å  *Ð<! C  ? 8  *Ð<8 A 6@@ ( (0HAqE\r AØÖ j (¯ * ! *! (, (Atj*  *  ! (, (Atj 8  AØÚ j (¯ * !  *!! (( (Atj*  *   !!" (( (Atj "8   (Aj6  A 6 @@ (  (0HAqE\r *Ô<!# (, ( Atj!$ $ # $* 8  *Ô<!% (( ( Atj!& & % &* 8   ( Aj6   AØ<j (, (( (0±  AÀ j$ # Ak!   6 (d# Ak! $    6  6  6  (6  ( ( ( Atj (² ! Aj$  ,# Ak!   6  6 ( (Atj# AÀ k! $    6<  68  64  60 (<!  (86(  (46, A(j! (0! Aj A ³   Aj´   µ  AÀ j$ # AÀ k! $    6<  68  64  60 (<!  (86(  (46, A(j! (0! Aj A ³   Aj´   ¶  AÀ j$ g# A k! $    6  6  6 (! (! (! Aj   ê  (! A j$  Z# Ak!   6  6  6  6  (!  (6   (6 A 6  ( 6 \\# Ak! $    6  6 (! A :    (6 Aj (û  Aj$  à}# A0k! $    6,  6( (,!  ((ü 6$  ((ý 6   ( þ 6  ( ÿ 6@@ ((-  AqE\r  (  ($  A 6@@ ( (IAqE\r  ($ ( 6  (  ( 6 A 6@@ ( (IAqE\r  ( ( (Atj*  ! ( (Atj 8   (Aj6   (Aj6    A0j$ Ñ# AÀ k! $    6<  68 (<!  (8ü 64  (8ý 60  (0þ 6,  (0ÿ 6(@@ (8-  AqE\r  (0 (4   (8  (0! Aj ´  Aà j Aj  (0 AÀj  A 6@ ( (,IAqE\r (0 ( ! (0 ( ! ((!  C  ¿C  ? È   (Aj6  AÀ j$ P# Ak! $    6  6  6 (Aj ( (  Aj$ D# Ak! $    6  6 (Aj (  Aj$ D# Ak! $    6  8 (Aj *¡  Aj$ e# Ak! $    6  8 (! A ²8 C  ?8   Aj Aj » * 8à Aj$ Q# Ak! $    6  6  6 ( ( (¼ ! Aj$  ­# Ak! $    6  6  6  (! (!@@ Aj   AqE\r  (! ( ! (!@@ Aj   AqE\r  ( !	 (!	 	! !\n Aj$  \nk# Ak! $    6  8 (Aj! A ²8 C  ?8   Aj Aj » * ô  Aj$ P# Ak! $    6  6  6 (A<j ( (  Aj$ _# Ak! $    6  6 (! A<j ( @ - Ä>AqE\r  A: Ô> Aj$ _}# Ak! $    6  8 (A<j! *C   A! C   A Á   Aj$ G}# Ak! $    8  8 * *® ! Aj$  E# Ak! $    6  8 (Aèj *©  Aj$ E# Ak! $    6  8 (A¨j *©  Aj$ »# A0k! $    6,  6(  6$  6  (,!  ((6  ($ ( l6 AjÅ  Aj ( ( (AtjÆ   ($6  ( 6 AÔ j AjÇ  AjÈ  A0j$ <# Ak! $    6 (! £  Aj$  ]# Ak! $    6  6  6 ( ( ( ( (É Ê  Aj$ B# Ak! $    6  6 ( (Ë  Aj$ <# Ak! $    6 (! Ì  Aj$  E# Ak! $    6  6 ( ( ! Aj$  Ç# A0k! $    6,  6(  6$  6  (,!  ( 6@@ (  MAqE\r @@ (  KAqE\r   ((   6 (( ( (    ( ($ (  k  ((! ($! ( ! Aj      (6  (      (    (( ($ (  A0j$ # Ak! $    6  6 (!  (6@@ ( (IAqE\r   (ä   (Aj6   (å 6  (6 (Alj! Aj$  L# Ak! $    6 (! Aj   Aj  Aj$  »# Ak! $    6  6 (!@ (A NAqE\r  ( AÔ jÎ HAqE\r  ( (à GAqE\r   (6à   AÔ j (Ï 6 Aèj (Ð  (( ((  Aj$ ,# Ak!   6 (! ( ( kAm/# Ak!   6  6 ((  (Alj<# Ak! $    6 (( Ñ ! Aj$  # Ak!   6 (E# Ak! $    6  8 (AÐj *©  Aj$ E# Ak! $    6  8 (A j *©  Aj$ Z}# Ak! $    6  8 (! *C   A! C   A Á 8Ð  Aj$ k# Ak! $    6  8 (Aè j! A ²8 C  ?8   Aj Aj » * ô  Aj$ e# Ak! $    6  8 (! A ²8 C  ?8   Aj Aj » * 8Ð< Aj$ g# Ak! $    6  8 (! C  ?8 C   A8   Aj Aj » * 8Ô< Aj$ # Ak! $    6A!   q:  (!   - q: Ä>@@ - AqE\r  A 6Ì> A 6Ð> Aj  A<j  A<j  Aj$ W# Ak! $    6 (! A<jA Aq   A<j  Aj  Aj$ L# Ak! $    6 (! A<j  A<jAAq   Aj$ K# Ak! $    6  8 (!  *8À> «  Aj$  A° Ý B# Ak! $    6 (! A ß  Aj$  íz# A°	k!   $     Aj6   A 6   A 6   6   6  A 6   ¡ ¢   (£   (  (¤   (  (¤   (  (  (¥   (     Aj6¤    (¤6¬	  A 6¨	  (¬	!  (¨	§ A !   6  A 6    )7È  (È!  (Ì!   6ä  Aé 6à   6Ü   6Ø  (ä!  (à!  (Ø!    (Ü6Ô   6Ð    )Ð7¸   A¸j¨    6ü  A 6ø    )ø7è  (è!  (ì!	   6  A 6   	6ü   6ø  (!\n  (!  (ø!    (ü6ô   6ð    )ð7°   A°j©    6ô  A 6ð    )ð7¨  (¨!\r  (¬!   \n6Ä  A 6À   6¼   \r6¸  (Ä!  (À!  (¸!    (¼6´   6°    )°7¨   A¨jª    6ì  A 6è    )è7  (!  (!   6¤  Að 6    6   6  (¤!  ( !  (!    (6   6    )7    A j«    6ä  A 6à    )à7¨  (¨!  (¬!   6Ä  A 6À   6¼   6¸  (Ä!  (À!  (¸!    (¼6´   6°    )°7   Aj¨    6Ü  A 6Ø    )Ø7  (!  (!   6¤  AÉ 6    6   6  (¤!  ( !  (!     (6    6    )7   Aj¨    6Ô  A 6Ð    )Ð7è  (è!!  (ì!"   6  AÄ 6   "6ü   !6ø  (!#  (!$  (ø!%    (ü6ô   %6ð    )ð7 $  Aj¨    6Ì  A 6È    )È7  (!&  (!\'   #6¤  A¢ 6    \'6   &6  (¤!(  ( !)  (!*    (6   *6    )7 )  Ajª    6Ä  A 6À    )À7è  (è!+  (ì!,   (6  A 6   ,6ü   +6ø  (!-  (!.  (ø!/    (ü6ô   /6ð    )ð7x .  Aø j«    6¼  A 6¸    )¸7È  (È!0  (Ì!1   -6ä  A 6à   16Ü   06Ø  (ä!2  (à!3  (Ø!4    (Ü6Ô   46Ð    )Ð7p 3  Að j¨    6´  A 6°    )°7¨  (¨!5  (¬!6   26Ä  A¦ 6À   66¼   56¸  (Ä!7  (À!8  (¸!9    (¼6´   96°    )°7h 8  Aè j¨    6¬  A 6¨    )¨7  (!:  (!;   76¤  AÇ 6    ;6   :6  (¤!<  ( !=  (!>    (6   >6    )7` =  Aà j¨    6¤  A 6     ) 7¨  (¨!?  (¬!@   <6Ä  AØ 6À   @6¼   ?6¸  (Ä!A  (À!B  (¸!C    (¼6´   C6°    )°7X B  AØ j¬    6  A 6    )7È  (È!D  (Ì!E   A6ä  AÏ 6à   E6Ü   D6Ø  (ä!F  (à!G  (Ø!H    (Ü6Ô   H6Ð    )Ð7P G  AÐ j«    6  A 6    )7è  (è!I  (ì!J   F6  A¶ 6   J6ü   I6ø  (!K  (!L  (ø!M    (ü6ô   M6ð    )ð7H L  AÈ j¨    6  A 6    )7È  (È!N  (Ì!O   K6ä  AØ 6à   O6Ü   N6Ø  (ä!P  (à!Q  (Ø!R    (Ü6Ô   R6Ð    )Ð7@ Q  AÀ j¨    6  A 6    )7¨  (¨!S  (¬!T   P6Ä  A« 6À   T6¼   S6¸  (Ä!U  (À!V  (¸!W    (¼6´   W6°    )°78 V  A8j¨    6ü  A 6ø    )ø7  (!X  (!Y   U6¤  A· 6    Y6   X6  (¤!Z  ( ![  (!\\    (6   \\6    )70 [  A0j¨    6ô  A 6ð    )ð7è  (è!]  (ì!^   Z6  Aµ 6   ^6ü   ]6ø  (!_  (!`  (ø!a    (ü6ô   a6ð    )ð7( `  A(j¨    6ì  A 6è    )è7È  (È!b  (Ì!c   _6ä  AÇ 6à   c6Ü   b6Ø  (ä!d  (à!e  (Ø!f    (Ü6Ô   f6Ð    )Ð7  e  A j¨    6ä  A 6à    )à7¨  (¨!g  (¬!h   d6Ä  Aã 6À   h6¼   g6¸  (Ä!i  (À!j  (¸!k    (¼6´   k6°    )°7 j  Aj¨    6Ü  A 6Ø    )Ø7È  (È!l  (Ì!m   i6ä  Aÿ 6à   m6Ü   l6Ø  (ä!n  (à!o  (Ø!p    (Ü6Ô   p6Ð    )Ð7 o  Aj­    6Ô  A 6Ð    )Ð7	  (	!q  (	!r   n6¤	  A· 6 	   r6	   q6	  (¤	!s  ( 	!t  (	!u    (	6	   u6	    )	7 t  Aj®    6Ì  A 6È    )È7è  (è!v  (ì!w   s6	  AÏ 6	   w6ü   v6ø  (	!x  (ø!y    (ü6ô   y6ð    )ð7À x  AÀj®   A°	j$ c# Ak! $    6  6 (!  (6  A 6 (     Aj$  <# Ak! $    6 (! á  Aj$  # Ak!   6 (<# Ak! $    6 (! ã  Aj$  \'# Ak!   6 (! A 6 <# Ak! $    6 (! å  Aj$  # Ak!   6 (# Ak!   6 (?# Ak! $    6 (! A ²è  Aj$  f# Ak! $    6  8 (! é  A ²8 A 6  *8   * 8 Aj$  9# Ak!   6 (! A ²8   * 8 A 6 O# Ak! $   6  6  6   ( ( (ë  Aj$ Â# A0k! $   6,  6(  6$ (,! ((! Aj  ì  (! ( ! ($í !	 Aj Aj   	î   (, (ï 6  ($ (ð 6   Aj Ajñ  A0j$ C# Ak! $   6  6   ( (ò  Aj$ 9# Ak! $    6 (ô ! Aj$  V# Ak! $   6  6  6  6    ( ( ( ó  Aj$ E# Ak! $    6  6 ( (ö ! Aj$  E# Ak! $    6  6 ( (÷ ! Aj$  D# Ak! $   6  6   ( (õ  Aj$ a# Ak! $   6  6  (í 6  (í 6    Aj õ  Aj$ # A k! $   6  6  6  ( (kAu6 ( ( (ø   ( (Atj6   Aj Ajù  A j$ 9# Ak! $    6 (Ñ ! Aj$  H# Ak!   6  6  6 (!  (( 6   (( 6 E# Ak! $    6  6 ( (ð ! Aj$  R# Ak! $    6  6 ( ( (Ñ kAuAtj! Aj$  u# Ak!   6  6  6  (6 @ ( A KAqE\r  (! (! ( AkAtAj!@ E\r    ü\n   (D# Ak! $   6  6   ( (ú  Aj$ H# Ak!   6  6  6 (!  (( 6   (( 6 [# Ak!   6  6 (!  (( 6   ((6  ((6  ((6 # Ak!   6 (Aj# Ak!   6 ((# Ak!   6 ((# Ak!   6 ((G# Ak! $    6  6 (!  (  Aj$  ?# Ak!   6  6 (! (  (Atj(  (Atj?# Ak!   6  6 (! (  (Atj(  (AtjÃ# A k! $    6  6 (!  (( ( 6  ((A t (A t 6 A 6@@ ( (IAqE\r  (  ( (  (Ê   (Aj6  A j$ G# Ak!   6  6@@ ( (IAqE\r  (! (! G# Ak!   6  6@@ ( (IAqE\r  (! (! E# Ak! $    6  6 ( ( ! Aj$  E# Ak! $    6  6 ( ( ! Aj$  Õ}# A0k! $    6,  6( (,!  ((ü 6$  ((ý 6   ( þ 6  ( ÿ 6@@ ((-  AqE\r  (  ($  A 6@ ( (IAqE\r  ($ ( 6  (  ( 6 A 6@@ ( (IAqE\r  ( ( (Atj*  ! ( (Atj 8   (Aj6   (Aj6  A0j$ G# Ak! $    6  6 (!  (  Aj$  ý}# A k! $    6  6 (!@@ ( Aq\r   (   A 6@@ ( (IAqE\r  ( 8 A 6@@ ( (IAqE\r *!  (  (Atj!   * 8   (Aj6   (Aj6  A j$ %# Ak!   6 ((A JAq# Ak!   6 (*# Ak! $    6  8 (!  (A t6 A 6 @@ (  (IAqE\r  (   * (Ë   ( Aj6   Aj$ }# Ak! $    6 (!@@  Aq\r   *8  (Aj6@@  AqE\r     *8   * 8 *! Aj$  .# Ak!   6 (!  * * 8 9# Ak!   6  6  6 (*  (* ]Aq,# Ak!   6 (! ( ( kAu,# Ak!   6 (! ( ( kAuN# Ak! $    6  6 (! Aj   (! Aj$  g# A k! $    6  6  6 (! (! (! Aj     (! A j$  # A k! $    6  6  6  6 (! (! Aj      ( ( ( 6 Aj  A j$ O# Ak! $   6  6  6   ( ( (   Aj$ _# Ak! $    6  6 (!   6  (¡   (¢  Aj$ |# Ak! $    6 (!@ ( A GAqE\r  £  ¤   (   ¥  A 6 A 6 A 6  Aj$ Á# A k! $    6  6 (!  ¦ 6@ ( (KAqE\r §     6@@ ( (AvOAqE\r   (6  (At6  Aj Ajª ( 6 (! A j$  # Ak! $    6  6 (!@ ( ¦ KAqE\r §   (!   ¨   ( 6   ( 6  (  (Atj6 A ©  Aj$ ,# Ak!   6  6 ( (kAuQ# Ak! $    6  6  (« 6 ( (¬  Aj$ ~# Ak! $    6  6  6 (!  (6   ((6  (( (Atj6 (  (­  Aj$  # A k! $    6  6  6  6 (! (! Aj  ®   ( ( ( (í ¯ 6 ( (ð ! A j$  # Ak! $    6 (!  6 (! (  6@ ( (GAqE\r  (  ( ( ( kAu¢  (! Aj$  Â# A0k! $   6,  6(  6$ (,! ((! Aj  ®  (! ( ! ($í !	 Aj Aj   	È   (, (É 6  ($ (ð 6   Aj AjÊ  A0j$ # Ak! $    6  6 (!  (6@@ ( (GAqE\r (A|j!  6  Ñ Ä    (6 Aj$ e# Ak! $    6  6 (!  Ð  (Atj Ð   Atj°  Aj$ X# Ak! $    6 (!   6  ( ¡   (¢  Aj$ a# Ak! $    6 (!  Ð   Atj Ð   Atj°  Aj$ M# Ak! $    6  6  6 ( ( (Ó  Aj$ \\# Ak! $    6  (Ö 6 × 6 Aj AjØ ( ! Aj$   A Ù  P# Ak! $   6  6   ( (Ú 6    (6 Aj$ e# Ak! $    6  6 (!  Ð   Atj Ð  (Atj°  Aj$ E# Ak! $    6  6 ( (ã ! Aj$  # Ak!   6 (<# Ak!   6  6 (! (!  (  Atj6 q# Ak! $    6  6 (!  Ð   Atj Ð   Atj (Atj°  Aj$ C# Ak! $   6  6   ( (²  Aj$ ÿ# AÀ k! $    6<  68  64  60  (06, (<! Aj  A,j A0j³  Aj  (6  )7  Aj ´ @@ (8 (4GAqE\r (< (0Ñ  (8µ   (8Aj68  (0Aj60  Aj¶  (0! Aj·  AÀ j$  k# Ak! $    6  6  6 (! Ð  Ð   Atj ( (±  Aj$ ,# Ak!   6  6  6  6 a# Ak! $   6  6  (¸ 6  (¸ 6    Aj ¹  Aj$ S# Ak!   6  6  6  6  (!  (6   (6  ( 6 ]# A k! $    6  (6  ) 7  (6  )7    ¼  A j$ I# Ak! $    6  6  6 ( (½  Aj$ !# Ak!   6 (A: V# Ak! $    6 (!  6@ - Aq\r  ¾  (! Aj$  9# Ak! $    6 (º ! Aj$  H# Ak!   6  6  6 (!  (( 6   (( 6 9# Ak! $    6 (» ! Aj$  # Ak!   6 (;# Ak!   6 (!  (6  ) 7  A :  E# Ak! $    6  6 ( (¿ ! Aj$  z# Ak! $    6 (! ( ! (( ! Aj À  (( ! Aj À   ( (Á  Aj$ 4# Ak!   6  6 (!  (* 8  1# Ak!   6  6 (!  (6  x# Ak! $   6  6   6@@ Aj AjÂ AqE\r ( AjÃ Ä  AjÅ   Aj$ O# Ak! $    6  6 (Æ  (Æ GAq! Aj$  7# Ak!   6  (( 6 (A|j!  6 <# Ak! $    6  6 (Ç  Aj$ -# Ak!   6 (!  ( A|j6  # Ak!   6 (( # Ak!   6V# Ak! $   6  6  6  6    ( ( ( Ë  Aj$ E# Ak! $    6  6 ( (Í ! Aj$  D# Ak! $   6  6   ( (Ì  Aj$ # A k! $   6  6  6  ( (kAu6 ( ( (Î   ( (Atj6   Aj AjÏ  A j$ H# Ak!   6  6  6 (!  (( 6   (( 6 E# Ak! $    6  6 ( (Ñ ! Aj$  u# Ak!   6  6  6  (6 @ ( A KAqE\r  (! (! ( AkAtAj!@ E\r    ü\n   (D# Ak! $   6  6   ( (Ð  Aj$ H# Ak!   6  6  6 (!  (( 6   (( 6 E# Ak! $    6  6 ( (Ò ! Aj$  R# Ak! $    6  6 ( ( (» kAuAtj! Aj$  J# Ak! $    6  6  6 ( (AÔ  Aj$ # Ak! $    6  6  6  (At6 @@ (Õ AqE\r  ( (  (  ( (   Aj$ "# Ak!   6 (AKAq7# Ak! $    6Ü Av! Aj$  	 Ý E# Ak! $    6  6 ( (Û ! Aj$  K# Ak! $    6A  !  (à  A A   g# Ak! $    6  6 (!@ ( Ö KAqE\r á   (Aâ ! Aj$  p# Ak! $    6  6 (! (!@@ Aj  Þ AqE\r  (! (! ! Aj$  	 ß 	 Aÿÿÿÿ9# Ak!   6  6  6 ((  (( IAq AV# Ak! $    6  6 (!  (  A Aj6  Aj$  ,A  !   Å   A° A   # Ak! $    6  6  (At6 @@ (Õ AqE\r   (  ( 6  (  6 (! Aj$  p# Ak! $    6  6 (! (!@@ Aj  Þ AqE\r  (! (! ! Aj$  y# A k! $    6  6 (! Aj Aæ   (ç  (è   (Aj6 Ajé  A j$ °# A k! $    6  6 (!  Î Ajê ! Î ! Aj   ë   (ç  (è   (Aj6  Ajì  (! Ají  A j$  ~# Ak! $    6  6  6 (!  (6   ((6  (( (Alj6 (  (î  Aj$  # Ak!   6 (I# Ak! $    6  6  6 ( (ï  Aj$ # Ak! $    6 (!  6 (! (  6@ ( (GAqE\r  (  ( ( ( kAmð  (! Aj$  Á# A k! $    6  6 (!  ø 6@ ( (KAqE\r ù    ó 6@@ ( (AvOAqE\r   (6  (At6  Aj Ajª ( 6 (! A j$  ß# A k! $    6  6  6  6 (!  6 A 6  (6@@ (\r  A 6  (! (! Aj  ú   (6   (6 (  (Alj!  6  6  (  (Alj6 (!	 A j$  	# Ak! $    6  6 (! û  ((! ( ( kAm!  A  kAlj6  ( ç  (ç  (ç ü  (! ( 6  ( 6  (Ajý  Aj (Ajý  Aj (Ajý  ((! ( 6   Î þ  Aj$ r# Ak! $    6 (!  6 ÿ @ ( A GAqE\r  ( (     (! Aj$  q# Ak! $    6  6 (!  ñ  Î Alj ñ  Î Alj (Aljò  Aj$ E# Ak! $    6  6 ( (õ ! Aj$  e# Ak! $    6  6 (!  ñ  (Alj ñ  Î Aljò  Aj$ <# Ak! $    6 (( ç ! Aj$  k# Ak! $    6  6  6 (! ñ  ñ  ó Alj ( (ô  Aj$ ,# Ak!   6 (! ( ( kAm,# Ak!   6  6  6  6 H# Ak! $    6  6 (!  (ö  Aj$  [# Ak! $    6  6 (!  (÷  Aj (Aj) 7  Aj$  # Ak!   6  6 (! A 6  A 6 A 6  (( 6   ((6  ((6 (A 6 (A 6 (A 6  \\# Ak! $    6  ( 6 × 6 Aj AjØ ( ! Aj$   A Ù  P# Ak! $   6  6   ( ( 6    (6 Aj$ a# Ak! $    6 (!  ñ  Î Alj ñ  ó Aljò  Aj$ # AÀ k! $    6<  68  64  60  (06, (<! Aj  A,j A0j  Aj  (6  )7  Aj    (86@@ ( (4GAqE\r (< (0ç  (è   (Aj6  (0Aj60  Aj  (< (8 (4  Aj  AÀ j$ P# Ak!   6  6  (( 6 (( ! ( 6  (! ( 6 e# Ak! $    6  6 (!  ñ  ó Alj ñ  (Aljò  Aj$ ># Ak! $    6 (!  (  Aj$ ,# Ak!   6 (! ( ( kAmM# Ak! $    6  6  6 ( ( (  Aj$ 7# Ak! $    6Ü An! Aj$  g# Ak! $    6  6 (!@ (  KAqE\r á   (A ! Aj$  # Ak! $    6  6  (Al6 @@ (Õ AqE\r   (  ( 6  (  6 (! Aj$  S# Ak!   6  6  6  6  (!  (6   (6  ( 6 ]# A k! $    6  (6  ) 7  (6  )7      A j$ !# Ak!   6 (A: n# Ak! $    6  6  6@@ ( (GAqE\r ( (   (Aj6  Aj$ V# Ak! $    6 (!  6@ - Aq\r    (! Aj$  ;# Ak!   6 (!  (6  ) 7  A :  <# Ak! $    6  6 (  Aj$ z# Ak! $    6 (! ( ! (( ! Aj   (( ! Aj    ( (  Aj$ 6# Ak! $    6 (È  Aj$ 1# Ak!   6  6 (!  (6  x# Ak! $   6  6   6@@ Aj Aj AqE\r ( Aj   Aj   Aj$ O# Ak! $    6  6 (  ( GAq! Aj$  7# Ak!   6  (( 6 (Alj!  6 -# Ak!   6 (!  ( Alj6  # Ak!   6 (( A# Ak! $    6  6 ( (  Aj$ J# Ak! $    6  6  6 ( (A  Aj$ y# Ak! $    6  6 (!@@ ( (GAqE\r (! (Alj!  6  ç    Aj$ # Ak! $    6  6  6  (Al6 @@ (Õ AqE\r  ( (  (  ( (   Aj$ 1# Ak!   6  6 (!  (6  y# Ak! $    6 (!@ ( ( A GAqE\r  ( £  ( ¤  (  ( (  (  ¥  Aj$  9# Ak! $    6 (¯ ! Aj$   A  A S# Ak! $    6 (!@ A FAq\r  °  AØÞ   Aj$ 	 ± 	 ² 	 ³  A # Ak!   6A # Ak!   6A # Ak!   6A \'AØÞ  !   A      l# Ak! $    6 A¡ 6  AjÛ  AjÜ  (Ý  ( (  Aj$ Ã# A k! $  ( ! (!   6  6  6 A¢ 6 ! (! Ajá ! Ajâ ! (ã !	 (!\n Ajä !A !A !\r     	 \n   \rAq \rAq  A j$ Ã# A k! $  ( ! (!   6  6  6 A£ 6 ! (! Ajé ! Ajê ! (ë !	 (!\n Ajì !A !A !\r     	 \n   \rAq \rAq  A j$ Ã# A k! $  ( ! (!   6  6  6 A¤ 6 ! (! Ajñ ! Ajò ! (ó !	 (!\n Ajô !A !A !\r     	 \n   \rAq \rAq  A j$ Ã# A k! $  ( ! (!   6  6  6 A¥ 6 ! (! Aj÷ ! Ajø ! (ù !	 (!\n Ajú !A !A !\r     	 \n   \rAq \rAq  A j$ Ã# A k! $  ( ! (!   6  6  6 A¦ 6 ! (! Ajý ! Ajþ ! (ÿ !	 (!\n Aj !A !A !\r     	 \n   \rAq \rAq  A j$ Ã# A k! $  ( ! (!   6  6  6 A§ 6 ! (! Aj ! Aj ! ( !	 (!\n Aj !A !A !\r     	 \n   \rAq \rAq  A j$ Ã# A k! $  ( ! (!   6  6  6 A¨ 6 ! (! Aj ! Aj ! ( !	 (!\n Aj !A !A !\r     	 \n   \rAq \rAq  A j$ # Ak!   6A¼ Ú# Ak! $    6 (! AØ<j´  A°<jµ  Aè j¶  AÔ j·  A j¸  AÐj¸  Aèj¹  A¨j¸  Aèj¸  Aj¶  Aø jµ  A<jº  Ajº  Aj$  	 A¼ 	 AÔ 	 Aô <# Ak! $    6 (! »  Aj$  <# Ak! $    6 (! ¼  Aj$  c# Ak! $    6 (! Aðj½  A j½  AÐ j½  ½  Aj$  L# Ak! $    6 (! Aj ¾  Aj¿  Aj$  <# Ak! $    6 (! À  Aj$  V# Ak! $    6 (! AÐjÌ  Aè jÁ  Á  Aj$  ?# Ak! $    6 (! AjÂ  Aj$  I# Ak! $    6 (! Aà jÃ  Ã  Aj$  <# Ak! $    6 (! Å  Aj$  c# Ak! $    6 (! A0jÌ  A$jÌ  AjÌ  AjÌ  Aj$  1# Ak!   6  6 (!  (6  y# Ak! $    6 (!@ ( ( A GAqE\r  ( Ç  ( û  (  ( (  ( ó   Aj$ K# Ak! $    6 (! AjÌ  AjÌ  Aj$  # Ak! $    6 (! AÄ jÌ  A8jÌ  A,jÌ  A jÌ  AjÂ  AjÂ    Aj$  L# Ak! $    6 (! Aj É  AjÊ  Aj$  ?# Ak! $    6 (! AjÄ  Aj$  <# Ak! $    6 (! Ì  Aj$  <# Ak! $    6 (! Æ  Aj$   # Ak! $    6 (!  6@@  (FAqE\r  (!  ( (  @ (A GAqE\r  (!  ( (   (! Aj$  X# Ak! $    6 (!  Î 6  ( È   (ð  Aj$ # Ak! $    6  6 (!  (6@@ ( (GAqE\r (Alj!  6  ç     (6 Aj$ 1# Ak!   6  6 (!  (6  y# Ak! $    6 (!@ ( ( A GAqE\r  ( Ë  ( Ì  (  ( (  ( Í Î  Aj$ X# Ak! $    6 (!  Ï 6  ( Ð   (Ñ  Aj$ a# Ak! $    6 (!  Ò  Ï Alj Ò  Í AljÓ  Aj$ ,# Ak!   6 (! ( ( kAmM# Ak! $    6  6  6 ( ( (Ô  Aj$ ,# Ak!   6 (! ( ( kAm# Ak! $    6  6 (!  (6@@ ( (GAqE\r (Atj!  6  Õ Ö    (6 Aj$ e# Ak! $    6  6 (!  Ò  (Alj Ò  Ï AljÓ  Aj$ <# Ak! $    6 (( Õ ! Aj$  k# Ak! $    6  6  6 (! Ò  Ò  Í Alj ( (Ø  Aj$ J# Ak! $    6  6  6 ( (AÙ  Aj$ # Ak!   6 (<# Ak! $    6  6 (×  Aj$ 6# Ak! $    6 (Ì  Aj$ ,# Ak!   6  6  6  6 # Ak! $    6  6  6  (Al6 @@ (Õ AqE\r  ( (  (  ( (   Aj$ D# Ak! $    6 (  Þ ! Aj$  # Ak!   6A4# Ak! $    6ß ! Aj$  # Ak!   6A  # Ak!   6 (	 A £# Ak! $    6  6  8 (å ! (! (! ( !  Auj!@@ AqE\r  (  j( !	 !	 	!\n  *æ  \n   Aj$ # Ak!   6A4# Ak! $    6ç ! Aj$  # Ak!   6A° c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  # Ak!   6 (# Ak!   8 *	 A¤ Ç# A k! $    6  6  6  6  6 (å ! (! (! ( !	  Auj!\n@@ AqE\r  \n(  	j( ! 	! ! \n (í  (í  (î     A j$ # Ak!   6A4# Ak! $    6ï ! Aj$  # Ak!   6AÔ c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  # Ak!   6 (# Ak!   6 (	 AÀ µ# Ak! $    6  6  6  6  (å ! (! (! ( !  Auj!	@@ AqE\r  	(  j( !\n !\n \n! 	 (í  ( í     Aj$ # Ak!   6A4# Ak! $    6õ ! Aj$  # Ak!   6Að c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  	 Aà £# Ak! $    6  6  6 (å ! (! (! ( !  Auj!@@ AqE\r  (  j( !	 !	 	!\n  (î  \n   Aj$ # Ak!   6A4# Ak! $    6û ! Aj$  # Ak!   6A c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  	 Aø Ç# A k! $    6  6  6  6  6 (å ! (! (! ( !	  Auj!\n@@ AqE\r  \n(  	j( ! 	! ! \n (í  (í  (í     A j$ # Ak!   6A4# Ak! $    6 ! Aj$  # Ak!   6A¤ c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  	 A ¬# Ak! $    6  6  Aq:  (å ! (! (! ( !  Auj!@@ AqE\r  (  j( !	 !	 	!\n  - Aq Aq \n   Aj$ # Ak!   6A4# Ak! $    6 ! Aj$  # Ak!   6A¸ c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  "# Ak!   Aq:  - Aq	 A¬ # Ak! $    6  6 (å ! (! (! ( !  Auj!@@ AqE\r  (  j( ! !     Aj$ # Ak!   6A4# Ak! $    6 ! Aj$  # Ak!   6AÈ c# Ak! $    6A ! (! ( !  (6  6   6 (! Aj$  	 AÀ   Ü v# A k! $    6  6  6 (!  (6 Aj!  ( (Atj6  Aj Aj  A j$ ®# Ak! $    6  6  6 (!  (6 @@ (  (IAqE\r   ( (   ( Aj6    ( ( 6   ( 6 ( Atj! Aj$  # A k! $    6  6  6 (! Aj A¢   (Õ  ( (£   (Aj6 Aj¤  A j$ ³# A k! $    6  6  6 (!  Ï Aj¥ ! Ï !    ¦   (Õ  ( (£   (Aj6  §  (! ¨  A j$  # Ak! $    6  6 (!@ (A NAqE\r  ( AjÏ HAqE\r   (6 A 6 A :  A : $ C  ?8( Aj$ =# Ak!   6 (! A 6 A:  A : $ C  ?8(}}# Ak!   6 (!@@@ - AqE\r  - $AqE\r@ * A ²_AqE\r  A :  A: $ *  * ! C  ? 8,Ð	}# A0k! $    6,  6(  6$  6  (,!@@@ Aj Aq\r  (A HAq\r  ( AjÏ NAqE\r ((! ( At!A !@ E\r    ü  ($!	 ( At!\nA !@ \nE\r  	  \nü   Aj ( 6  ( ³ *4ü6@@ (AKAqE\r  (Ak!A !  6 A 6@ ( ( HAqE\r A 6@ - AqE\r @ ( (OAqE\r @@ - 0AqE\r  A 6 A :  A : $@ - AqE\r  ( (IAqE\r   ( ( *  *8@ ( (OAqE\r  - 0Aq\r   ( (k³C   D8 *!\r C  ? \r *8@ - $AqE\r   *( *8 *,!  *( 8(@ *(A ²_AqE\r  A ²8( A :  A : $  (Aj6 *! (( (Atj 8  *! ($ (Atj 8   (Aj6  A0j$ ,# Ak!   6 (! (  (FAq/# Ak!   6  6 ((  (Alj/# Ak!   6  6 ((  (AtjX# Ak! $    6  8 (! A ²8  Aj Aj * 8  Aj$ E# Ak! $    6  6 ( ( ! Aj$  p# Ak! $    6  6 (! (!@@ Aj   AqE\r  (! (! ! Aj$  X# Ak! $    6  8 (! A ²8  Aj Aj * 8 Aj$ +# Ak!   6  8 ( *8 1# Ak!   6  Aq:  ( - Aq: 0f# Ak! $    6  8 (! CÍÌÌ=8 C  ?8   Aj Aj » * 84 Aj$ ~# Ak! $    6  6  6 (!  (6   ((6  (( (Alj6 (  (©  Aj$  U# Ak! $    6  6  6  6  ( ( ( ª  Aj$ # Ak! $    6 (!  6 (! (  6@ ( (GAqE\r  (  ( ( ( kAmÑ  (! Aj$  Á# A k! $    6  6 (!  ² 6@ ( (KAqE\r ³    Í 6@@ ( (AvOAqE\r   (6  (At6  Aj Ajª ( 6 (! A j$  ß# A k! $    6  6  6  6 (!  6 A 6  (6@@ (\r  A 6  (! (! Aj  ´   (6   (6 (  (Alj!  6  6  (  (Alj6 (!	 A j$  	# Ak! $    6  6 (! Ì  ((! ( ( kAm!  A  kAlj6  ( Õ  (Õ  (Õ µ  (! ( 6  ( 6  (Aj¶  Aj (Aj¶  Aj (Aj¶  ((! ( 6   Ï ·  Aj$ r# Ak! $    6 (!  6 ¸ @ ( A GAqE\r  ( (  ¹ Î  (! Aj$  q# Ak! $    6  6 (!  Ò  Ï Alj Ò  Ï Alj (AljÓ  Aj$ Q# Ak! $    6  6  6 ( ( (« ! Aj$  Z# Ak! $    6  6  6 (!  ((  (( ¬  Aj$  # Ak! $    6  6  6 (! A 6  A 6 A 6 ä   ( (É 6   ( ( ( ­  Aj$  ´# A k! $    6  6  6  6 (! Aj   (! Aj ® @ (A KAqE\r   (   ( ( (  Aj¯  Aj°  A j$ I# Ak! $    6  6  (6   (±  Aj$ !# Ak!   6 (A: V# Ak! $    6 (!  6@ - Aq\r    (! Aj$  8# Ak!  6   6 (!  (6  A :  \\# Ak! $    6  (º 6 × 6 Aj AjØ ( ! Aj$   A Ù  P# Ak! $   6  6   ( (» 6    (6 Aj$ ~# Ak! $    6  6  6  6  ( Õ ! (Õ ! ( (kAmAl!@ E\r    ü\n   Aj$ P# Ak!   6  6  (( 6 (( ! ( 6  (! ( 6 e# Ak! $    6  6 (!  Ò  Í Alj Ò  (AljÓ  Aj$ ># Ak! $    6 (!  (½  Aj$ ,# Ak!   6 (! ( ( kAm7# Ak! $    6Ü An! Aj$  g# Ak! $    6  6 (!@ ( º KAqE\r á   (A¼ ! Aj$  # Ak! $    6  6  (Al6 @@ (Õ AqE\r   (  ( 6  (  6 (! Aj$  A# Ak! $    6  6 ( (¾  Aj$ y# Ak! $    6  6 (!@@ ( (GAqE\r (! (Atj!  6  Õ Ö   Aj$  A¸ ¡ q# A k! $    6  8 (!  6  AjÁ   *»9  A6 A6  Â  A j$ u# A0k! $    6,  6( (,!  ((( 6 (! Aj Ã  Aj Ä  AjÅ  A0j$  # Ak!   6  6H# Ak! $   6   6 (!  AjÉ  Aj$  A# Ak! $    6  6 ( (Ê  Aj$ # AÀ k! $    6<  68  64  60 (<!  (86(  (46, A(j! (0! Aj A ³   Aj´   Æ  AÀ j$ ø# AÐ k! $    6L  6H (L!@@ (H-  AqE\r @Ç AqE\r  (Hý  (Hü   (Hü !  )7@  ) 78 (Hý !  )70  ) 7(  )@7   )87  )07  )(7 Aj Aj È  AÐ j$  A Aqõ}# A k! $   6   á 6   â 6 A 6@@ ( (IAqE\r    ( 6   ( 6 A 6@@ ( (IAqE\r ( ( (Atj* ã ! ( (Atj 8   (Aj6   (Aj6  A j$ x# Ak! $    6  6 (!  6 A 6@ (Ë AqE\r   (Ì   6 (! Aj$  # A k! $    6  6 (!@@  (FAqE\r @ ( FAqE\r  (( (FAqE\r   Ajß 6 (!  ( ( (   (!  ( (   A 6 ((!  ß  ( (   ((!  ( (   (A 6  ß 6 (!  (ß  ( (   (!	 	 	( (   (ß !\n ( \n6@@ ( FAqE\r  (!  (ß  ( (   (!  ( (    ((6 (ß !\r ( \r6@@ (( (FAqE\r  ((!  ß  ( (   ((!  ( (   (! ( 6  ß 6 Aj (Ajà  A j$ # Ak!   6AAqa# Ak! $    6  6 (! Í  AÌ Aj6  Aj (( 6  Aj$  .# Ak!   6 (! Að Aj6  <# Ak! $    6 (! Ï  Aj$  # Ak!   6 (D# Ak! $    6 (! Î  A  Aj$ K# Ak! $    6 (!A !  AjÒ  Aj$  a# Ak! $    6  6 (! Í  AÌ Aj6  Aj (( 6  Aj$  I# Ak! $    6  6 (! ( AjÒ  Aj$ # Ak!   6S# Ak! $    6 (!@ A FAq\r   ( (   Aj$ J}# Ak! $    6  6 (Aj (× ! Aj$  G}# Ak! $    6  6 ( (Û ! Aj$  # A k!   6  6 (!  (6 A 6 ((! ((!  6  6@@ ( (FAqE\r   Aj6 A 6 (# Ak!   6A # Ak!   6 G}# Ak! $    6  6 ( (Ü ! Aj$  J}# Ak! $    6  6 ( (* Ý ! Aj$  d}# Ak! $    6  8 (( ! * *Þ  *CÍÌÌ= *! Aj$  ;}# Ak! $    8 *Ã ! Aj$  # Ak!   6 (P# Ak!   6  6  (( 6 (( ! ( 6  (! ( 6 # Ak!   6 ((# Ak!   6 ((G}# Ak! $    6  8 ( Ajä ! Aj$  w}# Ak! $    6  6 (!@ (A FAqE\r å   (!  ( ( (  ! Aj$  3A  !   A 6   æ   A¸ A©   J# Ak! $    6 (! ç  A¤ Aj6  Aj$  .# Ak!   6 (! Aè Aj6  	 ¿  A¹ ¡ ¦# A k!   6  8  8  8  8  8  8 (!  *8   *8  *8  *8  *8  *8 A ²8 A ²8 A ²8  A ²8$ }# Ak! $    6  8 (! * Co: *! C  ¿ ì 8 *Co: *! C  ¿ ì 8 A ²8  A ²8$ Aj$ ;}# Ak! $    8 * ! Aj$  ®}# A k! $    6  6  6  6  8 (!  * *C  ?C  ?8  * *C  ?C  ?8 A 6 @@ (  (HAqE\r  ( ( Atj*  A j * *î ! ( ( Atj 8   ( ( Atj*  A$j * *î ! ( ( Atj 8   ( Aj6   A j$ µ}}# A0k! $    6,  8(  6$  8   8 (,!  *(ï 8@@ * ($* ^AqE\r  *! *!  8 *! ($* !	 *!\nC  ? \n *  	! ($ 8  ($! C½758   Aj * ð C   A8 A ²8@@ * *^AqE\r  * !\rC  ? \r! C  ?  * *8@ * *]AqE\r  *!C  ? ! C  ?  * *8 *C   A! C   A Á 8 *( *! A0j$  # Ak!   8 *;}# Ak! $    8 * ! Aj$  }}}# A k! $    6  8  8  8  8 (! ñ  AÐ jñ  A jñ  Aðjñ  AÀj! *C  ?! C   AC  ÈBC   Á C   ÂC  @@A¶    Aèj!	 *C  ?!\n 	C   @C  BC   Á \nC   ÂC  @A¶    Aj! *C  ?! C  ?C  HBC   Á C   ÂC   @A¶    A¸j!\rA! \rA  ü  A¸j!A! A  ü  A¸j!A! A  ü  A¸j!A! A  ü  A¸j!A! A  ü  A¸j!A! A  ü  A ²8¸  *8¼  *8À  *8Ä A j$  ¹# A k! $    6  8 (!  *»9 A6 A6 C  ÈBô  A ó   Ajõ  AÐ jC  ÈBô  AÐ jAó  AÐ j Ajõ  A jC @Eô  A jA ó  A j Ajõ  AðjC @Eô  AðjAó  Aðj Ajõ  AÀj *ë  Aèj *ë  Aj *ë  A j$ ¢	}}}}}}}# AÐ k! $    6L  6H  6D  6@ (L! A 6<@@ (< (@HAqE\r (H (<Atj* !  A  ù 88 (D (<Atj* !  A ù 84 AÐ j! (H (<Atj* !	  A  	ù 80 AÐ j!\n (D (<Atj* !  \nA ù 8, A j! *0!\r  A  \rù 8( A j! *,!  A ù 8$ Aðj! *0!  A  ù 8  Aðj! *,!  A ù 8 *8! A¸j (<¯  8  *4! A¸j (<¯  8  *(! A¸j (<¯  8  *$! A¸j (<¯  8  * ! A¸j (<¯  8  *! A¸j (<¯  8   (<Aj6<  AÀj A¸j­  A¸j­  (@ *¸í  Aèj A¸j­  A¸j­  (@ *¸í  Aj A¸j­  A¸j­  (@ *¸í  *¸ *¼C   A! C   A Á 8 *¸ *ÀC   A! C   A Á 8 *¸ *ÄC   A! C   A Á 8  *¸C  A8 *C   A! C   A Á 8 A 6@@ ( (@HAqE\r A¸j (¯ * ! *! A¸j (¯ *  *   A¸j (¯ *  * *!  (H (Atj  8  A¸j (¯ * !! *!" A¸j (¯ *  * ! " A¸j (¯ *  * *!# (D (Atj #8   (Aj6  AÐ j$ ,# Ak!   6  8 ( *8¸	 é  Aº ¡ Ù# AÐ k! $    6L (L! A 6\\ A 6`  A jø 6H  A jù 6D A ²8@ (H (D AÀ jú   A,jø 6<  A,jù 68 A ²84 (< (8 A4jú   A8jø 60  A8jù 6, A ²8( (0 (, A(jú   AÄ jø 6$  AÄ jù 6  A ²8 ($ (  Ajú   Aj6  (û 6  (ü 6@@ Aj Ajý AsAqE\r  Ajþ 6  (ø 6  (ù 6 A ²8  ( ( ú  Ajÿ   AÐ j$ R# Ak! $    6 (!   (   6 (! Aj$  R# Ak! $    6 (!   (  6 (! Aj$  e# A k! $    6  6  6  (6  (6 (! ( (   A j$ R# Ak! $    6 (!   (   6 (! Aj$  R# Ak! $    6 (!   (  6 (! Aj$  O# Ak! $    6  6 (  ( FAq! Aj$  # Ak!   6 (( -# Ak!   6 (!  ( Aj6  ¥}# Að k! $    6l  6h  6d (l!@@@ (dE\r  (hA FAqE\r  (dAjAkAn6T  (TAl6X Aj (T   Aj6`  (`û 6\\  (`ü 6X@@ AÜ j AØ jý AsAqE\r  AÜ jþ 6T (T! A ²8P A AÐ j  AÜ jÿ   Aj (X   Aj6L  (Lû 6H  (Lü 6D@@ AÈ j AÄ jý AsAqE\r  AÈ jþ 6@ (@! A ²8< A A<j  AÈ jÿ   A j! A ²88 A A8j  A,j! A ²84 A A4j  A8j!	 A ²80 	A A0j  AÄ j!\n A ²8, \nA A,j  A 6(@@ (( (TIAqE\r  Aj (( ø 6$  Aj (( ù 6  A ²8 ($ (  Ajú   ((Al6  (d (k6 AÄ  AjØ ( 6 A 6@@ ( (IAqE\r (h ( (jAtj* ! Aj ((  (  8   (Aj6   Aj ((  A Aq   Aj ((     ((Aj6(  A: d ÷  Að j$ # Ak! $    6  6 (!  Ï 6@@ ( (IAqE\r   ( (k @ ( (KAqE\r   (  (Alj  Aj$ §# Ak! $    6  6  6 (!   6 @@ (  (IAqE\r   ( ( k ( @ (  (KAqE\r   (  (Atj  Aj$ /# Ak!   6  6 ((  (Atj<# Ak! $    6 (( Ñ ! Aj$  }}# A k!   6  6 A6 A 6@@ ( (IAqE\r ( (AtAtj* ! ( (Atj 8   (Aj6  ( (AtjA ²8  A6@@ ( (IAqE\r (! (! A kAtAjAtj* ! ( ( (jAtj 8   (Aj6 È# A k! $    6  6 (!@@ ( (kAm (OAqE\r   (    Ï  (j¥ ! Ï ! Aj   ¦  (! Aj ¡   Aj§  Aj¨  A j$ _# Ak! $    6  6 (!  Ï 6  (Ð   (Ñ  Aj$ # Ak!   6 (O# Ak! $    6  6 (! Aj §  (! Aj$  # Ak!   6 (( Ñ# A k! $    6  6  6 (!@@ ( (kAu (OAqE\r   ( (¨     (j !  !    ©  (! (!   ª   «  ¬  A j$ o# A k! $    6  6  6  (6 Aj Ajµ ! (!  (  ¶ 6 A j$ # Ak!   6 (O# Ak! $    6  6 (! Aj »  (! Aj$  ö}}# A k! $    6  6  6  6 (!@@ - dAq\r  ( ( (Atj (  A 6  (X (Tn6@ ( (HAqE\r  (`A FAq:   ( (k6| (`! A k6x  Aü j Aø jØ ( 6 A 6t@@ (t (IAqE\r ( ( (tjAtj* ! A j (` (tj  8   (tAj6t   Aj (\\  6p@ - AqE\r   A jø 6l  A jù 6h (p! (l (h   (pAj!	 (pA j!\n A ²8d 	 \n Aä j   (pA Aq   (p   AÄ jø 6`  AÄ jù 6\\ A ²8X (` (\\ AØ jú   (\\6T A6P@@ (P (TIAqE\r  ( (Tj6T@ (T (XOAqE\r  (X!  (T k6T  Aj (T   Aj (P   AÄ j    (PAj6P   AÄ jø 6L  AÄ jù 6H  A,jø 6D  (L (H (D 6@  (p AjA    A,j    A,j    A,j   A 6<@@ (< (IAqE\r A,j (` (<j *  A8j (` (<j * ! ( ( (<jAtj 8   (<Aj6<   ( (`j6`@ (`AFAqE\r   A jø 68  A jù 64 A ²80 (8 (4 A0jú  A 6` A6,@@ (,AIAqE\r A8j (, * !\r A,j (, !  \r * 8   (,Aj6,   A,jø 6$  A$jA 6(  A,jø 6  AjA 6   A8jø 6  (( (  ( 6  A8jø 6  AjA 6  A8jù 6 A ²8 ( ( Ajú @@ (\\A KAqE\r  (\\Ak! (XAk!  6\\  ( (j6  A j$ {# A k! $    6  6  6  (6  (6 (! (! (! Aj     (! A j$  M# Ak! $    6  6  6 ( ( (  Aj$ è}}}}}# A0k!   6,  6(  6$  6  A6 A 6@@ ( (IAqE\r (( (Atj* ! ($ (Atj* ! (  (Atj!  *   8   (Aj6  A 6@@ ( (IAqE\r (( ( (jAtj* ! ($ ( (jAtj* !	 (  (Atj!\n \n \n*  	 8   (Aj6  A 6@@ ( (IAqE\r (( (Atj* ! ($ ( (jAtj* ! (  ( (jAtj!\r \r \r*   8   (Aj6  A 6@@ ( (IAqE\r (( ( (jAtj* ! ($ (Atj* ! (  ( (jAtj!  *   8   (Aj6  ((*! ($*! ( !  *  8# A0k! $    6(  6$  6   ((6  ($6  ( 6 (! (! (! Aj      AjAj( 6, (,! A0j$  }}}}# A k!   6  6 A6 A6@@ ( (IAqE\r ( (Atj* ! (! (! A kAtAtj 8  ( ( (jAtj* ! (! (! A kAtAjAtj 8   (Aj6  (A ²8 A6@@ ( (IAqE\r (!	 (!\n 	A \nkAtAtj* ! ( (AtAtj 8  (! (!\r A \rkAtAjAtj* ! ( (AtAjAtj 8   (Aj6 \\# Ak! $    6  6  (( 6 (! Aj   (! Aj$  g# A k! $   6  6  6  (6  (6 (!   ( ( ¼  A j$ W# Ak! $    6  6  6  ( ( (kAu ( Ê  Aj$ m# A k! $   6  6  6  (6  (6  (6   ( ( (Ì  A j$ ># Ak!   6  6 (! (!  (  Atj6  # Ak! $    6  6 (!   6@@ ( (IAqE\r   ( (k @ ( (KAqE\r   (  (Atj  Aj$ È# A k! $    6  6 (!@@ ( (kAu (OAqE\r   (     (j !  ! Aj   ©  (! Aj Ï   Aj«  Aj¬  A j$ }}# A0k! $    6,  6(  6$  6  (,!@@ ( AFAqE\r   (( ($  Aè j (( ($  ($! Aj   ($! Aj   A 6@@ ( ($IAqE\r (( (AtAtj* ! (!	 Aj 	  8  (( (AtAjAtj* !\n (! Aj   \n8   (Aj6   Aj  ($  Aè j Aj  ($  AjÌ  AjÌ  A0j$ Ê# A k! $    6  6 (!  6 A 6  A 6 A 6 ä  Aj   (! Aj ® @ (A KAqE\r   (   (  Aj¯  Aj°  (! A j$  ³# A k! $    6  6 (! (! Aj     (6  (6@@ ( (GAqE\r  (Ñ Ð  (Aj!  6  6  Aj  A j$ }# A k! $    6  6  6  6 (!@ AÐj  (AtIAqE\r  AÐj (At  A 6@@ ( (HAqE\r ( (Atj* ! AÐj (  8  ( (Atj* ! AÐj ( (j  8   (Aj6   ( ( (  Aè j ( ( (  A 6@@ ( (HAqE\r AÐj ( * ! *à!	 ( (Atj*  *Ü  	!\n ( (Atj \n8  AÐj ( (j * ! *à! ( (Atj*  *Ü  !\r ( (Atj \r8   (Aj6  A j$ ³# A k! $    6  6 (! (! Aj  ¢   (6  (6@@ ( (GAqE\r  (Õ ¢  (Aj!  6  6  Aj¤  A j$ # A k! $    6  6 (! Aj! (! Aj  £ @@ ( (GAqE\r ( (Õ ¢   (Aj6  Aj¤  A j$ =# Ak! $    6  6 (¥  Aj$ [# Ak!   6  6  6 (!  (( 6   ((  (Alj6  (6 1# Ak!   6 (! ( ! ( 6  9# Ak! $    6 (¦ ! Aj$  <# Ak! $    6 (! £  Aj$  1# Ak!   6  6 (!  (6  ¿# A k! $    6  6  6 (! (! Aj     (6  (6 @@ (  (GAqE\r  ( Ñ  (µ  ( Aj!  6   6  Aj  A j$ ß# A k! $    6  6  6  6 (!  6 A 6  (6@@ (\r  A 6  (! (! Aj  ¨   (6   (6 (  (Atj!  6  6  (  (Atj6 (!	 A j$  	ª# A k! $    6  6  6 (! Aj! (! Aj  ­ @@ ( (GAqE\r ( (Ñ  (µ   (Aj6  Aj®  A j$ # Ak! $    6  6 (! ¤  ((! ( ( kAu!  A  kAtj6  ( Ñ  (Ñ  (Ñ ¯  (! ( 6  ( 6  (Aj°  Aj (Aj°  Aj (Aj°  ((! ( 6    ©  Aj$ r# Ak! $    6 (!  6 ± @ ( A GAqE\r  ( (  ² ¥  (! Aj$  [# Ak!   6  6  6 (!  (( 6   ((  (Atj6  (6 1# Ak!   6 (! ( ! ( 6  ~# Ak! $    6  6  6  6  ( Ñ ! (Ñ ! ( (kAuAt!@ E\r    ü\n   Aj$ P# Ak!   6  6  (( 6 (( ! ( 6  (! ( 6 ># Ak! $    6 (!  (³  Aj$ ,# Ak!   6 (! ( ( kAuA# Ak! $    6  6 ( (´  Aj$ y# Ak! $    6  6 (!@@ ( (GAqE\r (! (A|j!  6  Ñ Ä   Aj$ O# Ak! $    6  6 (¸  (¸ kAu! Aj$  s# A k! $    6  6  6  (6 (« ! (!  (  · 6 (! A j$  }# Ak! $    6  6  6 @@ (A JAqE\r ( * ! Aj¹  8  Ajº   (Aj6   (6 (! Aj$  # Ak!   6 (( # Ak!   6 (( -# Ak!   6 (!  ( Aj6  1# Ak!   6  6 (!  (6  æ# AÀ k! $   6<  68  64  (<6(  (86$ ((! ($! A,j  ½  (,! (0! (4í !	 Aj Aj   	î   (<6 (!\n  ( \n¾ 6  (4 ( ð 6   Aj Aj¿  AÀ j$ W# Ak! $   6  6  (6  (6    ( ( À  Aj$ ]# Ak! $    6  6  (6  (!  (  Â 6 (! Aj$  D# Ak! $   6  6   ( (Á  Aj$ x# A k! $   6  6  (6  (Ã 6  (6  (Ã 6   Aj Ajõ  A j$ H# Ak!   6  6  6 (!  (( 6   (( 6 ]# Ak! $    6  6  (6  (!  (  È 6 (! Aj$  C# Ak! $    6  (6 (Ä ! Aj$  9# Ak! $    6 AjÅ ! Aj$  9# Ak! $    6 (Æ ! Aj$  F# Ak! $    6  (( 6 (Ç ! Aj$  ?# Ak! $    6 Aj¸ Ñ ! Aj$  ]# Ak! $    6  6  (6  (!  (  É 6 (! Aj$  b# Ak! $    6  6 ( AjÅ kAu!  Aj  6 (! Aj$  W# Ak! $    6  6  6 ( («  (Ë ! Aj$  p}# Ak!   6  6  6@@ (A JAqE\r (* ! ( 8   (Aj6  (Aj6  (þ# AÀ k! $   6<  68  64  (<6(  (86$ ((! ($! A,j  ½  (,! (0!  (46 (Ã !	 Aj Aj   	î   (<6 (!\n  ( \n¾ 6  (46 ( !  ( È 6   Aj AjÍ  AÀ j$ D# Ak! $   6  6   ( (Î  Aj$ K# Ak!   6  6  6 (!  (( 6  Aj (( 6  # A k! $    6  6 (! Aj! (! Aj  ­ @@ ( (GAqE\r ( (Ñ Ð   (Aj6  Aj®  A j$ =# Ak! $    6  6 (Ñ  Aj$ 9# Ak! $    6 (Ò ! Aj$  (# Ak!   6 (! A ²8  	 ö  A» A·   ># Ak! $    6 (! A Ö  Aj$  H# Ak! $    6  6 (!  (¹  Aj$  H# Ak! $    6  6 (!  (Ø  Aj$  L# Ak! $    6  6 ( (A®  (! Aj$  /# Ak!  6   6 ((  (FAq## Ak!   6  6 (6# Ak!   6 (( -  !A!  t uA FAq# A k!   6 (! ( !  Aj6   -  :  - !A!@@  t uA NAqE\r   - Aÿq6  - Aÿq6 Aÿ 6 AÀ 6 A 6@ ( (q!A !@ E\r  (AK!@ AqE\r   (Av6  (Aj6  (Av6  ( (q6@@ (Aj!  6 A NAqE\r  ( -  Aÿq6 @ ( AÀqAGAqE\r   ( Aj6   (At6  ( A?q (r6   (6 (»# Ak!   6  6 (!  (6@@ (AOAqE\r  A6 @ (AOAqE\r   ( Aj6 @ (AOAqE\r   ( Aj6  ( !A k!Aÿ t ( ( Alvr! ( !  Aj6   :  @@ ( Aj!  6  A NAqE\r ( ( AlvA?qAr!	 ( !\n  \nAj6  \n 	:    (! ( !  Aj6   :  $# Ak!   6 (( A :  H# Ak! $    6 (! Ajà  à  Aj$  <# Ak! $    6 (! â  Aj$  # Ak! $    6  6 (!  (( 6@@  (Ù AqE\r A !  (( 6   ( ç ! ! Aj$  <# Ak! $    6 (! ¢  Aj$  c# Ak! $    6  (6  ( 6@ ( Aq\r  (  Aj$ E# Ak! $    6  (6 (   Aj$ 1# Ak!   6  6 (!  (6  ># Ak! $    6 (! ( Ü  Aj$  \\# Ak! $   6   6  (( 6  (6  ( (  ! Aj$  K# Ak! $    6  6 ( (á A FAq! Aj$  L# Ak! $    6 (!  (6  Aj½ ! Aj$  M# Ak! $    6  6 (!  (A té 6  Aj$  # Ak!   6 A6  (6@ (AOAqE\r   (Aj6@ (AOAqE\r   (Aj6@ (AOAqE\r   (Aj6 (# Ak!   6 (( 	 ï I}# Ak!   8  8@@ * *]AqE\r  *! *!  C   4\n · G# Ak! $    6 (! A¸    Aj$  G# Ak! $    6 (! A¹    Aj$  0 A¼ Aº   A» A A ô B# Ak! $    6A¼ A¼    Aj$ j# Ak! $    6  6 (!  ( 6  (6 @ (A GAqE\r   (ö  Aj$ X# Ak! $    6  6 (!@ A FAq\r  ¿  A0  Aj$ % AÀ ø A½ A A ô <# Ak! $    6 (! Õ  Aj$  7# Ak! $    6AÀ ú  Aj$ <# Ak! $    6 (! û  Aj$  # Ak!   6 ( A¾ A A ô 7# Ak! $    6AÄ þ  Aj$ =# Ak! $    6 (! A õ  Aj$  O# Ak! $    6  6 (!  (6  (  Aj$  ># Ak! $    6 (! (   Aj$  # Ak! $    6 (!@  Aq\r  A6@@ (Aj!  6 A NAqE\r@  AqE\r  @@  AsAqE\rð   Aj$ <# Ak! $    6 (! A ×  Aj$ E# Ak! $    6 (! AØ Ajå  Aj$  H# Ak! $    6 (!  ( 6 (ä  Aj$  H# Ak! $    6 Ajì  Axj ! Aj$  p# Ak! $    6@ ( Aq\r @ (© AFAqE\r  (!@ A FAq\r    Aj$ \\# Ak! $    6  6 (!  (( 6   ( 6 (ã  Aj$  &# Ak!   6 (AØ FAq@# Ak! $    6 (AA¬ Aj! Aj$  £# Ak! $    6  (AjA|q6  (Aj 6  ( 6  ( A Ø  (! (  6 (Aj ! Aj å  (! Aj$  # Ak!   6 (# Ak!   6 (_# Ak! $    6  6 (! (! Aj    ( 6  Aj$  1# Ak!   6  6 (!  (6  Ì# A k! $    6@@@ Aj A FAq\r  Aj AqE\r AjAØ Ajå   (6  ( Aj6  ( 6  (6  (6 (! Aj   (! A j$  # Ak!   6 (( 6# Ak!   6 (( -  !A!  t uA FAqp# Ak! $    6 A 6@@  Aj 6 (E\r  (ë  (j6  (! Aj$  O# Ak! $   6   6 (!  (6  (À  Aj$ 8# Ak!   6 (! ( !  Aj6  -  AÿqF# Ak! $    6  (( 6 ( ! Aj$  o# Ak! $    6 A 6@@ AjÛ AsAqE\r  (Al AjÜ j6  (! Aj$  # A k! $    6  6@@  AjÜ 6  ( AjÜ   6@ (E\r   (6@@ (\r  A 6 (! A j$  # Ak! $    6 (! A 6@@ ( (HAqE\r  (¤ A¹     (Aj6  A 6 Aj$ @# Ak! $    6 (AA  Aq! Aj$  ^# Ak! $    6  6  6 (! (!  Aj A¶ Aq! Aj$  \' AÈ A  A¿ A A ô H# Ak! $    6  6 (!  (  Aj$  7# Ak! $    6AÈ   Aj$ H# Ak! $    6  6 (!  (Á  Aj$  # Ak!   6 (c# Ak!   6  6  ( (k6 @@ ( E\r  ( A H! AA Aq6 A 6 (# Ak!   6 (D# Ak! $    6 (!   £  Aj$  ># Ak! $    6 (! ( Ü  Aj$  /# Ak!   6  6 ((  (AtjA# Ak! $    6 (A¹    Aj$ E# Ak! $    6  6 ( (§ ! Aj$  S# Ak! $    6  6 (!  (AÀ    Aj$  # Ak!   6@# Ak! $    6 (AAª Ak! Aj$  Q# Ak! $    6  6  6 ( ( (« ! Aj$  # A k!   6  6  6 (! (!  (6 Aj! AK@@@@@@   (! ( !   k6   6 (!	 ( !\n  \n 	k6   \n6 (! ( !   k6   6 (!\r ( !   \rk6   6 (! ( !   k6   6 (Q# Ak! $    6  6  6 ( ( (­ ! Aj$  # A k!   6  6  6 (! (!  (6 Aj! AK@@@@@@   (! ( !   j6   6 (!	 ( !\n  \n 	j6   \n6 (! ( !   j6   6 (!\r ( !   \rj6   6 (! ( !   j6   6 (M# Ak! $    6  6  6 ( ( (¯  Aj$ # Ak!   6  6  6 (! (!  (6  A}j! AK@@@@     ( 6   ( 6   ( 6 # Ak!   6 (@# Ak! $    6 (² !A k! Aj$  &# Ak!   6 (! gA  :~# Ak!   7 )! z§! B Q!AÀ   Aq9~# Ak!   7 )! )! )!  B  }:~# Ak!   7 )! y§! B Q!AÀ   Aqe# Ak! $    6  6  6  6  ( ( ( (  ( · Aq! Aj$  ²H# A k! $    6  6  6  6  6 (! (! (!  (6 (¸ !	 Aj!\n \nAK@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ \n  	Aj! AK  	Aj! AK \r\r 	Aj!\r \rAK \r 	Aj! AK  	Aj! AK %%$$&$ ( ! (! ( !  F!    6  Aq\r ( ! (! ( !  F!    6  Aq\r ( ! (! ( !  F!    6  Aq\r  6   Aq: ,  6   Aq: *  6   Aq: ( ( ! (! ( !  F!    6  Aq\r ( !  (!! ( !" "  F!#  ! " #6  #Aq\r ( !$ (!% ( !& & $F!\'  % & \'6  \'Aq\r  6   Aq: "  "6   #Aq:    &6   \'Aq:  ( !( (!) ( !* * (F!+  ) * +6  +Aq\r ( !, (!- ( !. . ,F!/  - . /6  /Aq\r ( !0 (!1 ( !2 2 0F!3  1 2 36  3Aq\r  *6   +Aq:   .6   /Aq:   26   3Aq:  ( !4 (!5 ( !6 6 4F!7  5 6 76  7Aq\r ( !8 (!9 ( !: : 8F!;  9 : ;6  ;Aq\r ( !< (!= ( !> > <F!?  = > ?6  ?Aq\r  66   7Aq:   :6   ;Aq:   >6   ?Aq: \n ( !@ (!A ( !B B @F!C  A B C6  CAq\r ( !D (!E ( !F F DF!G  E F G6  GAq\r ( !H (!I ( !J J HF!K  I J K6  KAq\r  B6   CAq:   F6   GAq:   J6   KAq:  - Aq!L A j$  LX# Ak!   6@@ (AFAqE\r A !@@ (AFAqE\r A! (! ! H# Ak! $    6  6 (!  (º  Aj$  H# Ak! $    6  6 (!  (»  Aj$  H# Ak! $    6  6 (!  (¼  Aj$  1# Ak!   6  6 (!  (6  u# Ak! $    6  6@@ (\r  A 6  (¾ 6  ( ¨   ( 6 (! Aj$  <# Ak! $    6 (( Ú ! Aj$  k# Ak! $    6 (! A,jþ  Ajß  Ajà  A¹    Aj$  l# Ak! $   6   6@@  Aj 6 (E\r ( (Ý   (Þ  Aj$ H# Ak! $    6  6 (!  (Â  Aj$  H# Ak! $    6  6 (!  (Ã  Aj$  H# Ak! $    6  6 (!  (Ä  Aj$  1# Ak!   6  6 (!  (6  ! Ô ó ÷ ü   AÌ ¡ I}# Ak!   8  8@@ * *]AqE\r  *! *! e# A k! $    6  6  8  8  6 ( ( * * (É  A j$ ±}# A k! $    6  6  8  8  6 A 6@@ ( (HAqE\r ( (Atj*  *î  *Ç ! ( (Atj 8   (Aj6  A j$ O# Ak!   6  6  6 (! (! (At!@ E\r    ü\n  M# Ak! $    6  8  6 ( * (Ì  Aj$ z}# Ak!   6  8  6 A 6 @@ (  (IAqE\r *! ( ( Atj!   * 8   ( Aj6  # Ak!   6# Ak!   8 *s}# Ak! $    8  8@@ * *^AqE\r  *CÍÌL=!C   A Á !A ²! ! Aj$  U# A k! $    6  9  9 (!  + +¢üÒ  A j$ ò}# A0k! $    6,  8( (,! *(! *! B 7 AjÔ Õ ! Aj Aj Ö í ! A j Aj ×   ) 7@@   AjØ AqE\r @ (A LAqE\r   *(Ó   *(8  (6 Ù  A0j$ O# Ak! $    6  6 (!  (6  *Ó  Aj$ C}# Ak!   6  8 (! *!  8   8 A 60# Ak!   6 (! A ²8  A ²8 	 ß i# A k! $   6  8  () 7  *ï 8  )7    A  AjÞ  A j$ i# A k! $   6  8  () 7  *ï 8  )7    A AjÞ  A j$ }# A k! $    8  8@@@ *Ú AqE\r  *Ú Aq\r  * *Û Aq:   * *ï 8 * Ü _!A! Aq! !@ \r  *! Ý !	  *ï 8  *ï 8  	 Aj Aj * _!  Aq:  - Aq!\n A j$  \n5# Ak!   6 (!  * *  (²8<# Ak! $    8 *à Aq! Aj$  ,# Ak!   8  8 * *[Aq# Ak!   6 (* # Ak!   6 (*A}# Ak!  6  6 (* !  (j 8    ) 7  C   .# Ak!   8 *¼AÿÿÿÿqAüHAq	 Æ  AÍ ¡ q# Ak! $    6 (! A 6  A 6 A 6 ä   ä  å  æ ­  Aj$  # Ak!   6 (( ,# Ak!   6 (! (  (Atj# Ak!   6 ((O# Ak! $    6  6 (¸  (¸ FAq! Aj$  5# Ak! $    6 (Í  Aj$ # Ak! $    6 (! £  D    å@9 DV-Â¿9 C  ?8  C  ÈB8$ A ²8( A ²8, A 60  * ê   *$ë  Aj$  T# Ak! $    6  8 (!  *8    * ì 8( Aj$ T# Ak! $    6  8 (!  *8$   *$ì 8, Aj$ s}# Ak! $    6  8 (!@@ *Co:]AqE\r A ²! + *»£ ¶! ! Aj$  8# Ak! $    6 (A ²î  Aj$ «}# A k! $    6  8  (6  (ø 6  (ù 6@@ Aj Ajç AsAqE\r  Aj¹ 6 *! ( 8  Ajº   A j$ |# Ak! $    6  6 (!  (+ 9 +! D	Jp/¸À £9  * ê   *$ë   ((  í  Aj$ ©}# A k! $    6  6  8 (!@@ (0AFAqE\r   * *8  *ï 8@@ *  ( * ^AqE\r  *(! *,!  8  * *  ( *  *8 *!  (  8 @@ (0AFAqE\r   *Î 8  *8 *! A j$  # Ak! $    6 (! Aj£  Aj£  A$j£  A0j£  D    å@9@ C  úD8H A 6L ò  Aj$  }|# Ak! $    6 (!  *H»D-DTû!	@¢ +@£Á ¶8  D       @¶8 *! * !  »!D      ð?!       » £¶8 Aj$ +# Ak!   6  6 ( (6LJ# Ak! $    6  8 (!  *8H ò  Aj$ ¡# Ak! $    6  6 (!  (+ 9@ ò  Aj ((  Aj ((  A$j ((  A0j ((  ö  Aj$ # AÀ k! $    6< (<!  Aj6   Aj6$  A$j6(  A0j6,  A j60 A64  A0j68  (8÷ 6  (8ø 6@@ ( (GAqE\r  (( 6  (ø 6  (ù 6 A ²8 ( ( Ajú   (Aj6  AÀ j$ # Ak!   6 (( ,# Ak!   6 (! (  (AtjÍ}# A0k! $    6(  6$  8  ((! * ! * * !   Aj ($ *   Aj ($ *  *8 * ! *!  Aj ($ *   8 * !	 *!\n * 	 \n! Aj ($  8  * ! *!\r  Aj ($ *   \r8 * ! *! *  ! Aj ($  8 @@ (LAFAqE\r  *! *!   *  *8,@@ (L\r  *! *! ! * * !   A$j ($ *   A0j ($ *  *8 * ! *!  A$j ($ *   8 * ! *! *  ! A$j ($  8  * ! *!  A0j ($ *   8 * ! *! *  ! A0j ($  8 @@ (L\r  *!  *!    8, *,!! A0j$  !ô|# A0k! $    6, (,! Aj!A!  6   A j6$A!  6(  )$7  Ajã  Aj!  6  Aj6  6  )7   ã  BâòÀ 7( A 60 Aè£64D       @! D      ð? £¶88 û  A0j$  |}# Ak! $    6 (!  *4»D-DTû!	@¢ +(£Á ¶8  *8»!D      ð?!   £¶8 *! * !     »   » £¶8 Aj$ +# Ak!   6  6 ( (60J# Ak! $    6  8 (!  *84 û  Aj$ {# Ak! $    6  6 (!  (+ 9( Aj ((  Aj ((  ÿ  û  Aj$ 8# Ak! $    6 (A ²  Aj$ ï# A0k! $    6,  8( (,!  Aj6  Aj6  Aj6 A6   Aj6$  ($÷ 6  ($ø 6@@ ( (GAqE\r  (( 6  (ø 6  (ù 6  ( (  A(jú   (Aj6  A0j$ §# AÀ k! $    6< (<!  Aj6(  Aj6,  A(j60 A64  A0j68  (8÷ 6$  (8ø 6 @@ ($ ( GAqE\r  ($( 6  (6  (ø 6  (ù 6@@ Aj Ajç AsAqE\r  Aj¹ 6 (è  Ajº    ($Aj6$  AÀ j$ \n}}# A0k! $    6(  6$  8  ((!  Aj ($ 6  Aj ($ 6  * *  (*  *  * (* 8 *! * !  (*   8 *! * ! *  !	 ( 	8  *!\n * !  (*  \n 8 *! * !\r *  \r! ( 8  (0! AK@@@@@    *8,  *8,  *8,  *8, *,! A0j$   AÐ  L# Ak! $    6 (! A  AÈ Aj6  Aj$  # A k! $    6  6 (! A¸ Aj6   (6  6 (!  6  Aj¯  (  ( °  A j$  _# Ak! $    6  6 (!  (   (! A t6 Aj$  Þ# A k! $    6  6  ( 6  ( 6@@@ ( (GAqE\r  (( 6 (!   ( ( (  6@ (A GAqE\r   (6  (Aj6  A 6 (! A j$  1# Ak!   6  6 (!  (6  WA - ä Aq! A !@  Aÿq AÿqFAqE\r AÁ A A ô A!A  : ä AØ 9# Ak! $    6 (¦ ! Aj$  9# Ak! $    6 (§ ! Aj$  j# Ak! $    6  6 (!  ( 6  (6 @ (A GAqE\r   (  Aj$ <# Ak! $    6 (!   Aj$  =# Ak! $    6 (! A   Aj$  F# Ak! $    6  6 ( AsAq! Aj$  # Ak!   6 (( %# Ak!   6 (( A GAq# Ak! $    6  6  :  (!@ A  AsAqE\r   ! (! - ! ( (!   Aq    Aj$ r# Ak! $    6  6 (!@ A  AsAqE\r   !  ( ( (   Aj$ # Ak!   6 (* # Ak!   6 (*# Ak!   6 (( # Ak! $    6 (! AjAÂ    D    å@9H A ²8P C  ?8T C  ?8X C  ÈB8\\   Aj$  }# Ak! $    6 (!  *PC  HÃÏ 8  * ! C  ? 8 *T! C  ? 8 Aj *Xê  Aj *\\ë  Aj$ J# Ak! $    6  8 (!  *8P   Aj$ J# Ak! $    6  8 (!  *8T   Aj$ J# Ak! $    6  8 (!  *8X   Aj$ J# Ak! $    6  8 (!  *8\\   Aj$ e# Ak! $    6  6 (!  (+ 9H Aj (ï      Aj$ 8# Ak! $    6 (Ají  Aj$ ¯}# A k! $    6  6  8 (!  Aj ( *ð 8@@ * * ]AqE\r C  ?! * * *C  ?Á !  8 * *! A j$  K# Ak! $    6  8 (!  *8à ¡  Aj$ |# Ak! $    6 (! C   Á  C  @  C   @  C  HC  Aà j!  *à  C  zD  Co:   *ä  Aô6 *»!D      ð? ¡!D      $@!    ¢D      D@£¥ ¶8  *àC  ÈÂÏ  *8 AÀj *Ñ  Aj$ K# Ak! $    6  8 (!  *8ä ¡  Aj$ t# Ak! $    6  6 (!  (+ 9Ø  (  Aà j (  ¡  ¤  Aj$ `# Ak! $    6 (!   Aà j  AÀj +ØDü©ñÒMbP?Ð  Aj$ 7# Ak! $    6AØ ¨  Aj$ 9# Ak! $    6 (­ ! Aj$  B# Ak! $    6 (!  (® ! Aj$  <# Ak! $    6 (! ©  Aj$  D# Ak! $    6 (! ª  «  Aj$  s# Ak! $    6 (! A 6@@ ( (HAqE\r  (¬   (Aj6  A 6 Aj$ ># Ak! $    6 (! ( Ü  Aj$  /# Ak!   6  6 ((  (Atj# Ak!   6 (( /# Ak!   6  6 ((  (Atj]# Ak! $    6  6 (! ¶ ! Aj Ú   (·  Aj$ F# Ak! $    6  6 ( ( Aj¸  Aj$ <# Ak! $    6 (! ²  Aj$  # Ak!   6 (D# Ak! $    6 (! ±  A  Aj$ @# Ak! $    6  6 (µ ! Aj$  D# Ak! $    6A !  (í  Aj$  # Ak!   6 (A# Ak! $    6  6 ( (º  Aj$ # Ak! $    6  6  6 ( (Å  (Æ  (Æ  (Ç  (Æ  (Æ  (È  Aj$ # Ak!   6 b# Ak! $    6  6 (!  (»   (Aj¼   (½  Aj$ # Ak!   6  6h# Ak! $    6  6 (!@ ( (JAqE\r   ( (AmjAjAxq¾  Aj$ ^# Ak! $    6  6 (! (!  Aj6  ®  (( 6  Aj$ # Ak! $    6  6 (!@ ( (GAqE\r @@ (A JAqE\r   (¿  À   (6 Aj$ C# Ak! $    6  6 ( (AÁ  Aj$ C# Ak! $    6 (! ( Ü  A 6  Aj$ Z# Ak! $    6  6  6 (!  (  ( (lÂ 6  Aj$ Z# Ak! $    6  6 (!  (6   (6  Ã ! Aj$  u# Ak! $    6  6@@ (\r  A 6  (Ä 6  ( ¨   ( 6 (! Aj$  E# Ak! $    6 (! (  (Ý ! Aj$  # Ak!   6  69# Ak! $    6 (Ê ! Aj$  # Ak! $    6  6  6@@ ( (FAqE\r   ( (kAu° ± At6  ( ( ( ( AAqÉ  Aj$ %# Ak!   6  6  6Ü	# AÀ k! $    6<  68  64  60  : / A6( A6$@@  (8 (<kAm6  ( ! AK@@@@@@    (4! (8A|j!  68@  (  (<( Ë AqE\r  A<j A8jÌ  (<!	 (<Aj!\n (8A|j!  68 	 \n  (4Í  (<! (<Aj!\r (<Aj! (8A|j!  68  \r   (4Î  (<! (<Aj! (<Aj! (<Aj! (8A|j!  68      (4Ï @ ( AHAqE\r @@ - /AqE\r  (< (8 (4Ð  (< (8 (4Ñ @ (0\r  (< (8 (8 (4Ò   (0Aj60  ( Am6@@ ( AJAqE\r  (< (< (Atj (8A|j (4Í  (<Aj (< (AkAtj (8Axj (4Í  (<Aj (< (AjAtj (8Atj (4Í  (< (AkAtj (< (Atj (< (AjAtj (4Í   (< (Atj6 A<j AjÓ  (< (Atj (< (8A|j (4Í @ - /Aq\r  (4 (<A|j(  (<( Ë Aq\r   (< (8 (4Ô 6<@@A AqE\r  (<! (8! (4! Aj   Õ  (<! (8! (4! Aj   Ö   (6@ - AqE\r   (< ( (4× Aq: @ (Aj (8 (4× AqE\r @ - AqE\r   (68@ - AqE\r  (Aj!  6  6< (< ( (4 (0 - /AqÉ  A : / (Aj!  6  6<  AÀ j$ 9# Ak! $    6 (ì ! Aj$  9# Ak!   6  6  6 (( ((HAqG# Ak! $    6  6 ((  (( Ø  Aj$ þ# A k! $    6  6  6  6@@ ( ((  (( Ë Aq\r @ ( ((  (( Ë Aq\r  A Aq:  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ  AAq: @ ( ((  (( Ë AqE\r  Aj AjÌ  AAq:  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ  AAq:  - Aq! A j$  ý# A k! $    6  6  6  6  6 ( ( ( (Í @ ( ((  (( Ë AqE\r  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ  A j$ ¼# A k! $    6  6  6  6  6  6 ( ( ( ( (Î @ ( ((  (( Ë AqE\r  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ @ ( ((  (( Ë AqE\r  Aj AjÌ  A j$ \n# A k! $    6  6  6@@ ( (FAqE\r   (6  (Aj6@ ( (GAqE\r  (6  (A|j6@ ( ((  (( Ë AqE\r   AjÙ ( 6  (6  (6@ AjÙ ( ! ( 6   (6 ( (G!A ! Aq! !@ E\r  (!	 (!\n (A|j!  6 	 \n ( Ë ! Aq\r  (! ( 6   (Aj6  A j$ Î# A k! $    6  6  6@@ ( (FAqE\r   (A|j6  (Aj6@ ( (GAqE\r  (A|j6@ ( ((  (( Ë AqE\r   AjÙ ( 6  (6   (6@ Ù ( ! ( 6   ( 6 (! (! ( A|j!  6    ( Ë Aq\r  (! ( 6   (Aj6  A j$ ¿# A k! $    6  6  6  6@@ ( (FAqE\r   ( (Ú 6 ( (Å   ( ( ( (Û 6 ( (Å   (6 (! A j$  G# Ak! $    6  6 ((  (( Ø  Aj$ ³	# A k! $    6  6  6  (6  (6  AjÙ ( 6@@ ( ( (A|j( Ë AqE\r @  (Aj6 ( ( (( Ë AsAq\r @ (Aj!  6  (I!A ! Aq! !@ E\r  ( ( (( Ë As!@ AqE\r @ ( (IAqE\r @  (A|j6 ( ( (( Ë Aq\r @@ ( (IAqE\r Aj AjÌ @  (Aj6 ( ( (( Ë AsAq\r @  (A|j6 ( ( (( Ë Aq\r    (A|j6@ ( (GAqE\r  AjÙ ( !	 ( 	6  (!\n ( \n6  (! A j$  °\r# AÀ k! $   6<  68  64  (<60  (86,  A<jÙ ( 6(@@ (4 (( (8A|j( Ë AqE\r @  (<Aj6< (4 (( (<( Ë AsAq\r @ (<Aj!  6<  (8I!A ! Aq! !	@ E\r  (4 (( (<( Ë As!	@ 	AqE\r @ (< (8IAqE\r @  (8A|j68 (4 (( (8( Ë Aq\r   (< (8O: \'@ - \'Aq\r  A<j A8jÌ   (<Aj6<  (8A|j6  B 7 B 7@@ (  (<kAuAÿ NAqE\r@ )B QAqE\r  (< (4 A(j AjÜ @ )B QAqE\r  (  (4 A(j AjÝ  (< (  Aj AjÞ  )B Q!\nAÀ A  \nAq!  (< Atj6< )B Q!AÀ A  Aq!\r  ( A  \rkAtj6   (4! A<j A j  A(j Aj Ajß  A<j A j Aj Ajà   (<A|j6@ (0 (GAqE\r  AjÙ ( ! (0 6  ((! ( 6    Aj A\'já  AÀ j$ ¬	# A k! $   6  6  6  (6  (6  AjÙ ( 6@  (Aj6 ( ((  (Ë Aq\r @@ ( (A|jFAqE\r @ ( (I!A ! Aq! !@ E\r  (!	 (A|j!\n  \n6 	 \n(  (Ë As!@ AqE\r @  (A|j6 ( ((  (Ë AsAq\r   ( (OAq: @@ ( (IAqE\r Aj AjÌ @  (Aj6 ( ((  (Ë Aq\r @  (A|j6 ( ((  (Ë AsAq\r    (A|j6 @ ( ( GAqE\r  Ù ( ! ( 6  (! (  6     Ajá  A j$ Ú# A0k! $    6(  6$  6  ($ ((kAm! AK@@@@@@@    AAq: / ( ! ($A|j!  6$@  (  ((( Ë AqE\r  A(j A$jÌ  AAq: / ((! ((Aj! ($A|j!	  	6$   	 ( Í  AAq: / ((!\n ((Aj! ((Aj! ($A|j!\r  \r6$ \n   \r ( Î  AAq: / ((! ((Aj! ((Aj! ((Aj! ($A|j!  6$      ( Ï  AAq: /  ((Aj6 (( ((Aj ( ( Í  A6 A 6  (Aj6@@ ( ($GAqE\r@ (  ((  (( Ë AqE\r   AjÙ ( 6  (6  (6@ AjÙ ( ! ( 6   (6 ( ((G!A ! Aq! !@ E\r  ( ! (! (A|j!  6   ( Ë ! Aq\r  (! ( 6  (Aj!  6@ AFAqE\r  (Aj!  6   ($FAq: /  (6  (Aj6  AAq: / - /Aq! A0j$  A# Ak! $    6  6 ( (â  Aj$ <# Ak! $    6ã  (( ! Aj$  ## Ak!   6  6 (»# A k! $    6  6  6  6@@ ( (FAqE\r   ( (Ú 6 ( ( (ä   ( (kAu6  (6@@ ( (GAqE\r@ ( ((  (( Ë AqE\r  Aj AjÌ  ( ( ( (å   (Aj6  ( ( (æ   (6 (! A j$  Î~# A k! $    6  6  6  6  (6 A 6@@ (AÀ HAqE\r  ( ((  (( Ë As:  - Aq­ (­! (!   ) 7   (Aj6  (Aj6  A j$ Ë~# A k! $    6  6  6  6  (6 A 6@@ (AÀ HAqE\r  ( ((  (( Ë :  - Aq­ (­! (!   ) 7   (Aj6  (A|j6  A j$ ~# A k! $    6  6  6  6@ () B R!A ! Aq! !@ E\r  () B R!@ AqE\r   () ³ 6 () ´ !	 ( 	7   () ³ 6 () ´ !\n ( \n7   ( (Atj6 (! (!  A  kAtj6  Aj ê  A j$ å~~# AÀ k! $    6<  68  64  60  6,  6(  (8(  (<( kAuAj6$@@ (,) B QAqE\r  (() B QAqE\r   ($Am6   ($ ( k6@@ (,) B QAqE\r   ($AÀ k6  AÀ 6 AÀ 6   ($AÀ k6@ (,) B QAqE\r   (<( 6 A 6@@ ( ( HAqE\r  (4 ((  (0( Ë As:  - Aq­ (­! (,!   ) 7   (Aj6  (Aj6 @ (() B QAqE\r   (8( 6 A 6@@ ( (HAqE\r  (4 ((  (0( Ë :  - Aq­ (­!	 ((!\n \n 	 \n) 7   (A|j6  (Aj6  (<(  (8(  (, ((Þ @@ (,) B QAqE\r  ( !A ! ! (<!\r \r \r(  Atj6 @@ (() B QAqE\r  (!A ! ! (8!  ( A  kAtj6  AÀ j$ ï~~# A k! $    6  6  6  6@@ () B RAqE\r @@ () B RAqE\r () µ ! A? k6 (­!B B}! (!   ) 7   ((  (Atj6@ ( (( GAqE\r  (!	 Aj 	Ì  (!\n \n \n( A|j6   (( Aj! ( 6 @ () B RAqE\r @@ () B RAqE\r () µ ! A? k6 (­!\rB \rB}! (!   ) 7  (( ! (!  A  kAtj6 @ (  (( GAqE\r  (!  Ì  (!  ( Aj6   A j$ D# Ak! $   6  6   ( (ë  Aj$ P# Ak!   6  6  (( 6 (( ! ( 6  (! ( 6  ¼# A k! $    6  6  6  (6  ( (kAu6@ (AJAqE\r   (AkAm6@@ (A NAqE\r ( ( ( ( (Atjå   (Aj6  A j$ # A k! $    6  6  6  6  ( (kAu6@@@ (AHAq\r  (AkAm (HAqE\r  (AtAj6  ( (Atj6@ (Aj (HAqE\r  ( ((  ((Ë AqE\r   (Aj6  (Aj6@ ( ((  (( Ë AqE\r   AjÙ ( 6@@ AjÙ ( ! ( 6   (6@ (AkAm (HAqE\r   (AtAj6  ( (Atj6@ (Aj (HAqE\r  ( ((  ((Ë AqE\r   (Aj6  (Aj6 ( ((  (Ë AsAq\r  (! ( 6  A j$ ¾# A k! $    6  6  6  (6  (6  ( (kAu6@@ (AJAqE\r ( ( ( (ç   (A|j6  (Aj6  ( ( (È  A j$ # A k! $    6  6  6  6  (6@ (AJAqE\r   AjÙ ( 6  ( ( (è 6  (A|j6@@ ( (FAqE\r  (! ( 6  AjÙ ( ! ( 6   (Aj6 (! ( 6  ( ( ( ( (kAué  A j$ # A k! $    6  6  6  (6  (6 A 6 (Aj!  ( Atj6  (AtAj6@ (Aj (HAqE\r  ( ((  ((Ë AqE\r   (Aj6  (Aj6 AjÙ ( ! ( 6   (6@ ( (AkAmJAqE\r  (! A j$   Ç# A k! $    6  6  6  6@ (AJAqE\r   (AkAm6  ( (Atj6 (! (( ! (A|j!  6@   ( Ë AqE\r   AjÙ ( 6@@ AjÙ ( ! ( 6   (6@ (\r   (AkAm6  ( (Atj6 ( ((  (Ë Aq\r  (!	 ( 	6  A j$ G# Ak! $    6  6 ((  (( Ø  Aj$ K# Ak!   6  6  6 (!  (( 6   (-  Aq:  # Ak!   6 (û	# Ak! $    6  6 (! î  AÌ Aj6  A6 Ajø  Ajï  Ajï  Aj!A ! (! A tA Aqð   ñ  Aj!A ! (!	 A 	tAAqð   ñ  (!\n A \nt6 Aj$  .# Ak!   6 (! A´ Aj6  \'# Ak!   6 (! A 6   	|}|}# Ak! $    6x  6tA!   q: s (x!  6|  (t6    - sq:  Aj (tó  - ! D       @D       À AqD-DTû!	@¢ ( ·£9h@@ ( ALAqE\r  A 6d@@ (d ( HAqE\r  (d· +h¢9X +X! û ¶! ¸ ¶!	 AÐ j  	ô  Aj (dõ  )P7   (dAj6d  A 6L@@ (L ( AmHAqE\r  (L· +h¢9@ +@!\n \nû ¶! \n¸ ¶! A8j  ô  Aj (Lõ  )87   (LAj6L   ( Am64@@ (4 ( AmHAqE\r  Aj (4 ( Amkõ ) 7(@@ - AqE\r  A(j !\r A(j !\r \r!@@ - AqE\r  A(j ! A(j ! ! A j  ô  Aj (4õ  ) 7   (4Aj64  Aj ( Amõ C  ¿ö  Aj ( Amõ A ²÷   ( Am6@@ ( ( HAqE\r  ( Am ( ( Amkk6 Aj (õ ! Aj ø  Aj (õ  )7   (Aj6   ( ·ü6 A6  ( 6 A 6 @@ (  Ajù HAqE\r@@ ( (oE\r@@ (AFAqE\r  A6@@ (AFAqE\r  A6  (Aj6@ ( (JAqE\r   (6  (!  ( m6 (! Aj ( Atj 6  (! Aj ( Atj 6  ( Aj6   (|! Aj$  j# Ak! $    6  6 (!  ( 6  (6 @ (A GAqE\r   (ò  Aj$ Y# Ak! $    6  6 (!@ A FAq\r    A  Aj$ M# Ak! $    6  6 (!  (At 6  Aj$  B# Ak!   6  8  8 (!  *8   *8 /# Ak!   6  6 ((  (Atj+# Ak!   6  8 ( *8 +# Ak!   6  8 ( *8J# Ak! $   6   (  ( ô  Aj$ # Ak!   6A `# Ak! $    6 (! Ajû  Ajû  Ajú  ü  Aj$  =# Ak! $    6 (! A ñ  Aj$  # Ak!   6 (D# Ak! $    6 (! ú  A  Aj$ ¼}# A k! $    6  6  6  :  (!@@ (AFAqE\r  (! ( ) 7  Aj! Aj ÿ @@ - AqE\r  Ajÿ  ( (  (²! C  ? 8 A 6@@ ( (HAqE\r *!	 ( (Atj 	   (Aj6  Ajÿ  ( (  Aj  A j$ # Ak!   6 (( j# Ak! $    6  6  6 (! (! (! Aj!A!        Aj$ G# Ak!   6  8 (!  * * 8   * *8 í# A k! ! $    6  6  :  (!@@ (AFAqE\r   (AtAj6@ ( (IAqE\r  (AjApq!  k! ! $    (  (! Aj ê   Aj   (  Ajæ  A j$ ¿}# A k! $    6  6  6 (! A 6@@ ( (HAqE\r ( (Atj* ! Aj A ²ô  ( (Atj )7   (Aj6   ( (A Aqþ  A j$ # Ak!   6 (Ý# Ak! ! $    6  6 (!@@ (AFAqE\r   (AtAj6@ ( (IAqE\r  (AjApq!  k! ! $    (  (!  ê      (  æ  Aj$ Ó}# A k! $    6  6  6 (!  (6  (Au6@@ ( (HAqE\r ( ( (kAtj! Aj ø  ( (Atj )7   (Aj6   ( (AAqþ  A 6 @@ (  (HAqE\r ( ( Atj ! ( ( Atj 8  ( ( Atj ! ( (  (jAtj 8   ( Aj6   A j$ # Ak!   6 @# Ak! $    6 (! Aj  Aj$  ># Ak! $    6 (! ( Ü  Aj$  L# Ak! $    6 (!  (6  Aj ! Aj$  u# Ak! $    6  6@@ (\r  A 6  ( 6  ( ¨   ( 6 (! Aj$  <# Ak! $    6 (( Ú ! Aj$  é# AÐ k! $    6L  6H  6D  6@  6<  68 (L! (8!  Aj68  ) 70  (D6,  (D (0 (4lAtj6(@@ (@AFAqE\r  (0ALAqE\r  A 6$@@ ($ (0HAqE\r  (H (@ (<l ($lAtj (D ($ (4lAtj (@ (0l (< (8   ($Aj6$   )07 (D!	 (@!\n  )7    	 \n @@ (4AFAqE\r @ (H! (D!  Aj6D  ) 7  (@ (<l!\r  (H \rAtj6H (D ((IAq\r @  (H (D (@ (0l (< (8  (@ (<l!  (H Atj6H (4!  (D Atj6D (D ((IAq\r   )07 (,! (@!  )7  Aj    AÐ j$ # AÀ k! ! $    6<  68  64 (<! ( Aj! AK@@@@@@    (8 (4 (   (8 (4 (  ( AtAjApq!  k!	 	! $   	60 A 6,@ (, (HAqE\r  (,6( A 6$@@ ($ ( HAqE\r (8 ((Atj!\n (0 ($Atj \n) 7   ( ((j6(  ($Aj6$   (,6  A 6@@ ( ( HAqE\r A 6 (0! (8 ( Atj ) 7  A6@@ ( ( HAqE\r  (4 ( l (j6@ ( ( NAqE\r  ( !  ( k6 (0 (Atj!\r Aj (õ ! Aj \r   (8 ( Atj Aj   (Aj6   ( ( j6   (Aj6   (,Aj6,  AÀ j$ ¡# A0k! $    6,  6(  6$  6  (,!  (( ( Atj6  Aj 6  ( 6@@ (Aj!  6 A NAqE\r  () 7 (! Aj   ($!  ( Atj6 ((!	  	 Aj  (!\n  \nAj6 \n ) 7  ((!  Aj6(  Aj   A0j$ ¿}# Ak! $    6|  6x  6t  6p (|!  (pAt6l  (pAl6h  (tAt6d  (tAl6`  Aj 6\\  (\\6X  (\\6T  (p6P@@ (PAj!  6P A NAqE\r (x! (p!A!	   	tj!\n (\\! AÈ j \n   (x (l 	tj! (X!\r AÀ j  \r  (x (h 	tj! (T! A8j     )H70 A0j A8j   )H7( A(j A8j   (x) 7  A j AÀ j  (x AÀ j  (x!  (l 	tj ) 7  (x (l 	tj A0j  (t!  (\\  	tj6\\ (d!  (X  	tj6X (`!  (T  	tj6T (x A0j @@ - AqE\r  A j  A(j ! A j  A(j ! Aj  ô  (x (pAtj )7  A j  A(j ! A j  A(j ! Aj  ô  (x (hAtj )7  A j  A(j ! A j  A(j ! Aj  ô  (x (pAtj )7  A j  A(j ! A j  A(j !   ô  (x (hAtj ) 7   (xAj6x  Aj$ ³}}}}# AÀ k! $   6<  68 (<! A,j   *,! *0! (8! A$j   *$! *(!	  !\n  	!  	!  !\r \n !  \r!  \\Aq! ! !@ E\r   \\Aq! ! ! E\r  Aj    	æ  *! * ! ! ! !  8  8  )7   Aj  AÀ j$ f# Ak! $    6  6 (!  (  * 8   (  *8 Aj$  # Ak!   6 (( }# A k! $    6  6 (! ( ! ( ! Aj  ô  Aj  Aj   )7  A j$  L# Ak! $   6  6   () 7    (  Aj$ p}# Ak! $    6  6 (! ( !  *  8  ( !  * 8 Aj$  }# Ak! $   6 (! * ! *! Aj    *! *!   8    8  * !  *!	   8    	8 Aj$ 4# Ak!   6 (!  * 8   *8 X}# Ak!  8  8 *! *!   8    8  * !  *!   8    8Z# Ak! $    6  6 (!@ A FAq\r   ( (   Aj$  â   Aè ¡ # Ak!   8 *³# Aàk!   $   AjAü    AjAjAã    AjAjA    AjAjA    AjAjAê    AjAjA©    AjAjA»    AjAjAÿ    AjA jA¸    AjA$jAÚ    AjA(jA    AjA,jAñ    AjA0jAÿ    AjA4jAÊ    AjA8jA    AjA<jA    AjAÀ jA­    AjAÄ jA    AjAÈ jAÐ    AjAÌ jAó    AjAÐ jA«    AjAÔ jA    AjAØ jA±    AjAÜ jAÖ    AjAà jAÛ    AjAä jAÉ    AjAè jA®    AjAì jAº    AjAð jA»    AjAô jAâ    AjAø jAá    AjAü jAë    AjAjA¾    AjAjA    AjAjAÇ    AjAjAü    AjAjA¥    AjAjAÁ    AjAjAú    AjAjA£    AjA jA    AjA¤jAñ    AjA¨jA    AjA¬jAÕ    AjA°jAò    AjA´jAÌ    AjA¸jA    AjA¼jAÞ    AjAÀjA²    AjAÄjAÂ    AjAÈjA    AjAÌjA    AjAÐjA    AjAÔjAÉ    AjAØjA    AjAÜjA¾    AjAàjAÜ    AjAäjAê    AjAèjA¡    AjAìjA¨    AjAðjAæ    AjAôjAÚ    AjAøjAà    AjAüjA­    AjAjAÄ    AjAjAÑ    AjAjAä    AjAjAØ    AjAjA¤    AjAjA    AjAjA    AjAjAô    AjA jA®    AjA¤jA¯    AjA¨jA¢    AjA¬jA¾    AjA°jA    AjA´jA±    AjA¸jAô    AjA¼jA    AjAÀjA¢    AjAÄjAê    AjAÈjA      Aj6Ø  AÓ 6ÜAì     )Ø7 Aì      Aj! AÌj!@ A|j!    FAq! ! E\r AÏ A A ô   Aàj$ T# Ak! $    6 (! ¡   ¢  £ ¤  Aj$  7# Ak! $    6Aì ¥  Aj$ b# Ak! $    6 (! ´  Ajµ  ¶  A 6 C  ?8 Aj$  # Ak!   6 (( ,# Ak!   6 (! (  (Atj{# A k! $    6  6  6 (!@@ ( (GAqE\r (! Aj  ·   (Aj6  A j$ <# Ak! $    6 (! ¦  Aj$  I# Ak! $    6 (!  (ð  ñ  Aj$  y# Ak!   6  6@@ ( (Akq\r  ( (Akq!@@ ( (IAqE\r  (! ( (p! ! S# Ak!   6 (AK!A ! Aq! !@ E\r  ( (AkqA GAs! Aqk# Ak! $    6@@ (AIAqE\r  (! (Ak² !A  k!A t! ! Aj$  @# Ak! $    6  6 ( ! Aj$  O# Ak! $    6  6  6 ( (è Aq! Aj$  ?# Ak! $    6 (± ² ! Aj$  /# Ak!   6  6 ((  (Atj# Ak!   6 ((9# Ak! $    6 (³ ! Aj$  # Ak!   6 (Aj# Ak!   6 (Aj# Ak!   6 (( # Ak!   6 (F# Ak! $    6 (! A 6  Aj¸  Aj$  \'# Ak!   6 (! A 6  <# Ak! $    6 (! ¹  Aj$  C# Ak! $   6  6   ( (¼  Aj$ C# Ak! $    6 (! A 6  º  Aj$  # Ak!   6 (<# Ak! $    6 (! »  Aj$  # Ak!   6 (H# Ak! $   6  6   ( ( (½  Aj$ â# AÀ k! $   6<  68  64 (<!  ¾  (8ª 60  ¬ 6, A : +@@ (,E\r   (0 (,§ 6    ( ­ ( 6$@ ($A GAqE\r   ($( 6$@ ($A G!A ! Aq! !	@ E\r  ($®  (0F!\nA! \nAq! !\r@ \r  ($®  (,§  ( F!\r \r!	@ 	AqE\r @ ($®  (0FAqE\r  ¿  ($¯ °  (8« AqE\r   ($( 6$ (0! (4! Aj   À @@ Á ( Aj³ (,³ Â * ^Aq\r  (,\r (,!A!   t  ¨ sr6   Á ( j³ Â *  ü6  Aj Ajª ( Ã   ¬ 6,  (0 (,§ 6    ( ­ ( 6@@ (A FAqE\r   AjÄ 6 (( ! AjÅ  6  AjÆ Ä ! ( 6  (!  ( ­  6 @ AjÅ ( A GAqE\r  AjÆ Ä !  AjÅ ( ®  (,§ ­  6  (( ! AjÅ  6  AjÆ ! ( 6   AjÇ 6$ Á !  ( Aj6  A: + AjÈ  ($! Aj É    Aj A+jÊ  AÀ j$ # Ak!   6 (# Ak!   6 (ý# A k! $   6  6  6  (Ë 6 A Aq:  (AÌ ! (! Aj A AqÍ     AjÎ   Ï ! A 6    AjÐ  (  Å ° Ñ  (Ò   Ó A:  AAq: @ - Aq\r   È  A j$ # Ak!   6 (Aj# Ak!   6 (AjA# Ak! $    6  6 ( (Ô  Aj$ 9# Ak! $    6 (³ ! Aj$  # Ak!   6 (( # Ak!   6 (( 4# Ak!   6 (!  ( 6 A 6  (=# Ak! $    6 (! A Õ  Aj$  1# Ak!   6  6 (!  (6  K# Ak!   6  6  6 (!  (( 6   (-  Aq:  # Ak!   6 (E# Ak! $    6  6 ( (Ö ! Aj$  H# Ak!   6  6  Aq:  (!  (6   - Aq:  Z# Ak!   6  6  6 (!  (6  Aj! (!  - :   ( 6  # Ak!   6 (( Q# Ak! $    6  6  6 ( ( (× ! Aj$  # Ak!   6 (I# Ak! $    6  6  6 ( (¦  Aj$ # Ak!   6 (Ajæ# Ak! $    6  6 (!@@ (AFAqE\r  A6@ ( (AkqE\r   (ï 6  ¬ 6@@ ( (KAqE\r   (Ü @ ( (IAqE\r @@ (¨ AqE\r  Á ( ³ Â *  ü© ! Á ( ³ Â *  üï !  6   Aj ª ( 6@ ( (IAqE\r   (Ü  Aj$ m# Ak! $    6  6 (!  ( 6  (6 @ (A GAqE\r  Aj (é  Aj$ g# Ak! $    6  6 (!@ ( Ø KAqE\r á   (AÙ ! Aj$  X# Ak! $    6  6  6 (! (( ! A  Ú  Aj$  7# Ak! $    6Ü An! Aj$  # Ak! $    6  6  (Al6 @@ (Õ AqE\r   (  ( 6  (  6 (! Aj$  Y# Ak! $    6  6  6 (!  (Û   (6 Aj$  1# Ak!   6  6 (!  (6  ö	# A0k! $    6,  6( (,!  Ý Þ 6$@@ ((A KAqE\r  ($ ((ß !A !  à  ((! Ý á  6 @ ((A KAqE\r  A 6 @@ (  ((IAqE\r  ( ­ A 6   ( Aj6    AjÄ 6  (( 6@ (A GAqE\r   (®  ((§ 6 (!  (­  6   (6  (6  (( 6@@ (A GAqE\r  (®  ((§ 6@@ ( (FAqE\r   (6@@  (­ ( A FAqE\r  (!  (­  6   (6  (6  (6 (( ! ( 6   (­ ( ( !	 ( 	6  (!\n  (­ (  \n6   (( 6  A0j$ # Ak!   6 (Aj# Ak!   6 (E# Ak! $    6  6 ( (ã ! Aj$  m# Ak! $    6  6 (!  ( 6  (6 @ (A GAqE\r  Aj (â  Aj$ # Ak!   6 (V# Ak! $    6  6 (! Þ  ( á ( ä  Aj$ g# Ak! $    6  6 (!@ ( ç KAqE\r á   (Aè ! Aj$  M# Ak! $    6  6  6 ( ( (å  Aj$ J# Ak! $    6  6  6 ( (Aæ  Aj$ # Ak! $    6  6  6  (At6 @@ (Õ AqE\r  ( (  (  ( (   Aj$ 7# Ak! $    6Ü Av! Aj$  # Ak! $    6  6  (At6 @@ (Õ AqE\r   (  ( 6  (  6 (! Aj$  # Ak! $    6  6 (!@ - AqE\r  (  (° Ñ ê  (ë @ (A GAqE\r  (  (Aì  Aj$ <# Ak! $    6  6 (¥  Aj$ 6# Ak! $    6 (í  Aj$ M# Ak! $    6  6  6 ( ( (î  Aj$ # Ak!   6 (J# Ak! $    6  6  6 ( (Aï  Aj$ # Ak! $    6  6  6  (Al6 @@ (Õ AqE\r  ( (  (  ( (   Aj$ ·# A k! $    6  6  (Ë 6@@ (A GAqE\r  (( 6  (¯ 6 ( (° Ñ ê  (ë  ( (Aì   (6  A j$ =# Ak! $    6 (! A ò  Aj$  j# Ak! $    6  6 (!  ( 6 A 6 @ (A GAqE\r  Aj (â  Aj$     A  A    |D      ð?    ¢"D      à?¢"¡"D      ð? ¡ ¡    DË ú>¢DwQÁlÁV¿ ¢DLUUUUU¥? ¢  ¢" ¢  DÔ8¾éú¨½¢DÄ±´½î!> ¢D­RO~¾ ¢ ¢   ¢¡  |||# A°k"$  A}jAm"A  A J"Ahl j!@ AtAÐ j( "	 Aj"\njA H\r  	 j!  \nk!A !@@@ A N\r D        ! At(à ·! AÀj Atj 9  Aj! Aj" G\r  Ahj!\rA ! 	A  	A J! AH!@@@ E\r D        !  \nj!A !D        !@   Atj+  AÀj  kAtj+ ¢  ! Aj" G\r   Atj 9   F! Aj! E\r A/ k!A0 k! AtAà j! 	!@@  Atj+ !A ! !@ AH\r @ Aàj Atj D      p>¢ü·"D      pÁ¢  ü6   AtjAxj+   ! Aj! Aj" G\r   \r¶ !  D      À?¢ D       À¢ " ü"·¡!@@@@@ \rAH"\r  Aàj AtjA|j" ( "  u" tk"6   u!  j! \r\r Aàj AtjA|j( Au! AH\rA! D      à?f\r A !A !A !A!@ AH\r @ Aàj Atj"\n( !@@@@ E\r Aÿÿÿ! E\rA! \n  k6 A!A !A !A! Aj" G\r @ \r Aÿÿÿ!@@ \rAj Aÿÿÿ! Aàj AtjA|j" (  q6  Aj! AG\r D      ð? ¡!A! \r  D      ð? \r¶ ¡!@ D        b\r A ! !@  	L\r @ Aàj Aj"Atj(  r!  	J\r  E\r @ \rAhj!\r Aàj Aj"Atj( E\r A!@ "Aj! Aàj 	 kAtj( E\r   j!@ AÀj  j"Atj  Aj"Atj( ·9 A !D        !@ AH\r @   Atj+  AÀj  kAtj+ ¢  ! Aj" G\r   Atj 9   H\r  !@@ A k¶ "D      pAfE\r  Aàj Atj D      p>¢ü"·D      pÁ¢  ü6  Aj! !\r ü! Aàj Atj 6 D      ð? \r¶ !@ A H\r  !@  "Atj  Aàj Atj( ·¢9  Aj! D      p>¢! \r A ! !@ 	  	 H!  k!\n  Atj! A !D        !@ At"+°µ    j+ ¢  !  G! Aj! \r  A j \nAtj 9  Aj!  G! Aj! \r @@@@@  D        !@ A L\r  !@ A j Atj"Axj" + " + " "9     ¡ 9  AK! Aj! \r  AF\r  !@ A j Atj"Axj" + " + " "9     ¡ 9  AK! Aj! \r D        !@  A j Atj+  ! AK! Aj! \r  + ! \r  9  +¨!  9  9D        !@ A H\r @ "Aj!  A j Atj+  ! \r     9 D        !@ A H\r  !@ "Aj!  A j Atj+  ! \r     9  +  ¡!A!@ AH\r @  A j Atj+  !  G! Aj! \r     9  9  +¨!  9  9 A°j$  Aqº\n~|# A0k"$ @@@@  ½"B §"Aÿÿÿÿq"AúÔ½K\r  Aÿÿ?qAûÃ$F\r@ Aü²K\r @ B S\r    D  @Tû!ù¿ " D1cba´Ð½ "9     ¡D1cba´Ð½ 9A!   D  @Tû!ù? " D1cba´Ð= "9     ¡D1cba´Ð= 9A!@ B S\r    D  @Tû!	À " D1cba´à½ "9     ¡D1cba´à½ 9A!   D  @Tû!	@ " D1cba´à= "9     ¡D1cba´à= 9A~!@ A»ñK\r @ A¼û×K\r  Aü²ËF\r@ B S\r    D  0|ÙÀ " DÊ§é½ "9     ¡DÊ§é½ 9A!   D  0|Ù@ " DÊ§é= "9     ¡DÊ§é= 9A}! AûÃäF\r@ B S\r    D  @Tû!À " D1cba´ð½ "9     ¡D1cba´ð½ 9A!   D  @Tû!@ " D1cba´ð= "9     ¡D1cba´ð= 9A|! AúÃäK\r  DÈÉm0_ä?¢D      8C D      8Ã "ü!@@   D  @Tû!ù¿¢ " D1cba´Ð=¢"¡"	D-DTû!é¿cE\r  Aj! D      ð¿ "D1cba´Ð=¢!   D  @Tû!ù¿¢ ! 	D-DTû!é?dE\r  Aj! D      ð? "D1cba´Ð=¢!   D  @Tû!ù¿¢ !   ¡" 9 @ Av"\n  ½B4§AÿqkAH\r    D  `a´Ð=¢" ¡"	 Dsp.£;¢  	¡  ¡¡"¡" 9 @ \n  ½B4§AÿqkA2N\r  	!  	 D   .£;¢" ¡" DÁI %{9¢ 	 ¡  ¡¡"¡" 9     ¡ ¡9@ AÀÿI\r      ¡" 9    9A ! AjAr! BÿÿÿÿÿÿÿB°Á ¿!  Aj!A!\n@   ü·"9    ¡D      pA¢!  \nAq!A !\n ! \r    9 A!@ "\nAj! Aj \nAtj+ D        a\r  Aj  AvAêwj \nAjAø ! + ! @ BU\r    9   +9A  k!   9   +9 A0j$  |    ¢"  ¢¢ D|ÕÏZ:Ùå=¢Dë+æåZ¾ ¢  D}þ±WãÇ>¢DÕaÁ *¿ ¢D¦ø?  !   ¢!@ \r    ¢DIUUUUUÅ¿ ¢       D      à?¢  ¢¡¢ ¡ DIUUUUUÅ?¢ ¡ó|# Ak"$ @@  ½B §Aÿÿÿÿq"AûÃ¤ÿK\r D      ð?! AÁòI\r  D        ÷ !@ AÀÿI\r     ¡!   ù ! +!  + !@@@@ Aq     ÷ !   Aú !   ÷ !   Aú ! Aj$        ý ¢# Ak"  9 +   D       ü    D       pü |~|~@@@   Aÿq"D      < "kD      @  kO\r  !@  O\r   D      ð? A ! D      @ I\r D        !  ½"BxQ\r@ D      ð I\r   D      ð? @ BU\r A þ A ÿ   A +ðµ ¢A +øµ " " ¡"A +¶ ¢ A +¶ ¢    "   ¢" ¢  A +¨¶ ¢A + ¶  ¢   A +¶ ¢A +¶  ¢ ½"§AtAðq"+à¶      !  )è¶  B-|!@ \r       ¿"  ¢  ! 	   ½B4§Í|@ BB R\r  Bø@|¿"  ¢  D       ¢@ Bð?|¿"  ¢"  " D      ð?cE\r  D       ¢ D          D      ð? "    ¡   D      ð? ¡   D      ð¿ "   D        a!   D       ¢ # Ak" B7  + # Ak  9       # Ak"  8 *   C   p    C    ÷}|~@@   Aÿq"C  °B I\r C    !  C  ÿ[\r@ C   I\r     @  Cr±B^E\r A    C´ñÏÂ]E\r A  A +É A +É   »¢" A +É " " ¡¡"¢A +É    ¢¢A + É  ¢D      ð?   ½"B/ §AqAt)àÆ |¿¢¶!    ¼Av    A û@  \r A !@A (ø E\r A (ø  !@A ( E\r A (   r!@£ ( " E\r @@@  (LA N\r A!   E!@  (  (F\r     r!@ \r      (8" \r ¤  @@  (LA N\r A!   E!@@@  (  (F\r   A A   ($    (\r A! E\r@  ("  ("F\r     k¬A  ((  A !  A 6  B 7  B 7 \r       ò~@ E\r    :     j"Aj :   AI\r    :    :  A}j :   A~j :   AI\r    :  A|j :   A	I\r   A   kAq"j" AÿqAl"6    kA|q"j"A|j 6  A	I\r   6  6 Axj 6  Atj 6  AI\r   6  6  6  6 Apj 6  Alj 6  Ahj 6  Adj 6   AqAr"k"A I\r  ­B~!  j!@  7  7  7  7  A j! A`j"AK\r      (<  ¡ # A k"$    ("6  (!  6  6   k"6  j! Aj!A!@@@@@  (< AjA Aj Ö E\r  !@  ("F\r@ AJ\r  ! AA   ("K"	j" (   A  	k"j6  AA 	j" (  k6   k! !  (<   	k" Aj Ö E\r  AG\r    (,"6   6     (0j6 !A !  A 6  B 7    ( A r6  AF\r   (k! A j$     (<ö  Ö   @    ü\n    @ AI\r         j!@@   sAq\r @@  Aq\r   !@ \r   !  !@  -  :   Aj! Aj"AqE\r  I\r  A|q!@ AÀ I\r   A@j"K\r @  ( 6   (6  (6  (6  (6  (6  (6  (6  ( 6   ($6$  ((6(  (,6,  (060  (464  (868  (<6< AÀ j! AÀ j" M\r   O\r@  ( 6  Aj! Aj" I\r @ AO\r   !@ AO\r   ! A|j!  !@  -  :    - :   - :   - :  Aj! Aj" M\r @  O\r @  -  :   Aj! Aj" G\r   ~@  ½"B4§Aÿq"AÿF\r @ \r @@  D        b\r A !  D      ðC¢  !  ( A@j!  6     Axj6  BÿÿÿÿÿÿÿBð?¿!    A*   A  \n           ¡"   £¶}@@@  ¼"AÿÿÿJ\r @  C    \\\r C  ¿    @ AJ\r     C      C   L¼!Aè~! AÿÿÿûK\rA!C    !  AüF\r  Aö«j"Avj²"C > AÿÿÿqAóÔùj¾C  ¿"     C   ?"¼A`q¾"C `Þ>    C   @"   "  "Cîé>Cªª*?  C&x>CÎÌ>    " C `Þ> CÛ\'T5   CÙê¸!        "   K# Ak"$     Aÿq Aj Ö ! )! Aj$ B  é A G!@@@  AqE\r  E\r  Aÿq!@  -   F\r Aj"A G!  Aj" AqE\r \r  E\r@  -   AÿqF\r  AI\r  AÿqAl!@A  (  s"k rAxqAxG\r  Aj!  A|j"AK\r  E\r Aÿq!@@  -   G\r     Aj!  Aj"\r A  A¼  AÀ  A¼  ¡~|~|# Ak"$   ¦ ! ¦ "Aÿq"AÂwj! ½!  ½!@@@ ApjApI\r A !	 Aÿ~K\r@ § E\r D      ð?!\n Bø?Q\r B"P\r@@ B"BpV\r  BpT\r    !\n Bðÿ Q\rD          ¢ Bðÿ T B Ss!\n@ § E\r     ¢!\n@ BU\r  \n \n ¨ AF!\n BU\rD      ð? \n£© !\nA !	@ BU\r @ ¨ "	\r    !\nAA  	AF!	 Aÿq!  ½Bÿÿÿÿÿÿÿÿÿ !@ Aÿ~K\r D      ð?!\n Bø?Q\r@ A½K\r    Bø?VD      ð? !\n@ AÿK Bø?VF\r A ÿ !\nA þ !\n \r   D      0C¢½Bÿÿÿÿÿÿÿÿÿ Bà||! B@¿"\n  Ajª "½B@¿" ¢  \n¡  ¢  +   ¡ ¢  	« !\n Aj$  \n	   ½B4§   BB|BTU~A !@  B4§Aÿq"AÿI\r A! A³K\r A !BA³ k­"B|  B R\r AA   P! # Ak"  9 +Ã~||   B°ÕÚ@|"B4¹"A +°É ¢ B-§Aÿ qAt"+Ê     Bx}" B|Bp¿" +ðÉ "¢D      ð¿ "  ¿ ¡ ¢" " A +¨É ¢ +Ê  "   "¡    A +¸É "¢"	  ¢" ¢   ¢"    "¡     	¢"¢   A +èÉ ¢A +àÉ  ¢ A +ØÉ ¢A +ÐÉ   ¢ A +ÈÉ ¢A +ÀÉ   ¢ "    "¡ 9  ß|~@  ¦ Aÿq"D      <¦ "kD      @¦  kI\r @  O\r   D      ð? "     D      @¦ I!A ! \r @  ½BU\r  þ  ÿ    A +ðµ ¢A +øµ " " ¡"A +¶ ¢ A +¶ ¢     "   ¢" ¢  A +¨¶ ¢A + ¶  ¢   A +¶ ¢A +¶  ¢ ½"§AtAðq"+à¶      !  )è¶   ­|B-|!@ \r     ¬  ¿"  ¢  î|@ BB R\r  Bø@|¿"  ¢  D       ¢@ Bð?|"¿"  ¢"  "  D      ð?cE\r D       © D       ¢­  B¿  D      ð¿D      ð?  D        c" "    ¡     ¡    ¡"   D        a!   D       ¢ # Ak  9Ç}| ¼"¯ !@@@@@  ¼"AxjAxI\r A ! \r E\rC  ?! AüF\r At"E\r@@ At"AxK\r  AxI\r    AøF\rC       AøI A Hs@ ¯ E\r     !@ AJ\r    ° AF! AJ\rC  ? ± A !@ AJ\r @ ° "\r     AA  AF!  ¼Aÿÿÿÿq! AÿÿÿK\r   C   K¼AÿÿÿÿqA¤j!@ ²  »¢"½Bàÿÿ BÀ¯À T\r @ DqÕÑÿÿÿ_@dE\r    D     ÀbÀeE\r     ³ !    AtAjAIMA !@  AvAÿq"Aÿ I\r A! AK\r A !AA kt"Aj  q\r AA   q! # Ak"  8 *|A +ðë     A´|j"A|qk¾» AvAðq" +ðé ¢D      ð¿ "¢A +øë    ¢" ¢¢A +ì  ¢A +ì   ¢A +ì  ¢  +øé  Au·    o|~A +èÈ     A +àÈ " " ¡¡" ¢A +ðÈ      ¢¢A +øÈ   ¢D      ð?   ½" ­|B/ §AqAt)àÆ |¿¢¶ AÄ ]A A¤ 6¤  ! A A A k6ü A A 6ø A   6Ü A A (ä 6 ® @@ AH\r   D      à¢! @ AÿO\r  Axj!  D      à¢!  Aý AýIApj! AxJ\r   D      `¢! @ A¸pM\r  AÉj!  D      `¢!  Aðh AðhKAj!   Aÿj­B4¿¢   A ê|# Ak"$ @@  ½B §Aÿÿÿÿq"AûÃ¤ÿK\r  AÀòI\r  D        A ú ! @ AÀÿI\r     ¡!    ù ! +!  + !@@@@ Aq     Aú !    ÷ !    Aú !    ÷ !  Aj$    A  B Y -  !@  -  "E\r   AÿqG\r @ - !  - "E\r Aj!  Aj!   AÿqF\r   Aÿqk-@  ¿ Aj"Ú "\r A      EAª !@  AK\r @@  \r A !   At/ ì " E\r  AÔî j!      ½   !@@  AqE\r @  -  \r     k  !@ Aj"AqE\r -  \r @ "Aj!A ( "k rAxqAxF\r @ "Aj! -  \r    k®~|@@  ½"Bÿÿÿÿ Bðåò?T"E\r D-DTû!é?  ¡D\\3&¦<   BU"¡ ! D        !        ¢"¢"DcUUUUUÕ?¢    ¢"    DsS`ÛËuó¾¢D¦7 ~? ¢DeòòØDC? ¢D(VÉ"mm? ¢D7Öôd? ¢DzþÁ?       DÔz¿tp*û>¢Dé§ð2¸? ¢Dh÷&0? ¢DàþÈÛW? ¢Dnéã&? ¢DþA³º¡«? ¢ ¢  ¢   " !@ \r A Atk·"     ¢   £¡ "  ¡"  Aq@ E\r D      ð¿ £" ½Bp¿"  ½Bp¿"  ¡¡¢  ¢D      ð?  ¢  ! # Ak"$ @@  ½B §Aÿÿÿÿq"AûÃ¤ÿK\r  AòI\r  D        A À ! @ AÀÿI\r     ¡!    ù ! +  + AqÀ !  Aj$   À}@@@@@@  ¼"Aÿÿÿÿq"AÄðÖI\r  AüK\r@ A N\r C  ¿ AäÅI\r  C    AäÅõI\r A«üK\r @ A H\r   Cq1¿!A!CÑ÷7!  Cq1?!A!CÑ÷·!  C;ª¸?C   ?  ü "²"CÑ÷7!   Cq1¿!   "  ! AI\rA !    C   ?""  C0Ï:Ch½C  ?"C  @@  "C  À@   !@ \r             !@@@ Aj    C   ?C   ¿@  C  ¾]E\r    C   ?C   À   "   C  ? At"Aüj¾!@ A9I\r    C  ?"   C       AFC  ¿Aü k¾!@@ AK\r C  ?    !     C  ?!    !   ¸}@@  "¼"AÕ¾²øI\r @ AI\r C     C  ?!C  ?C   @  Â C   @!@ AùôI\r   Â " C   @! AI\r  C   ÀÂ " C   @!    ¼A H\\    (H"Aj r6H@  ( "AqE\r    A r6 A  B 7    (,"6   6     (0j6A   A  ¢ "  k  æ@@ ("\r A ! Ä \r (!@   ("kM\r      ($  @@ (PA H\r  E\r  !@@   j"Aj-  A\nF\r Aj"E\r      ($  " I\r  k! (!  !A !      ( j6  j! g  l!@@ (LAJ\r     Æ !   !    Æ !  E\r   @   G\r  A     n# AÐk"$   6Ì A jA A(ü   (Ì6È@@A   AÈj AÐ j A j  É A N\r A!@@  (LA N\r A!   E!    ( "A_q6 @@@@  (0\r   AÐ 60  A 6  B 7  (,!   6,A !  (\rA!  Ä \r    AÈj AÐ j A j  É ! A q!@ E\r   A A   ($    A 60   6,  A 6  (!  B 7 A !    ( " r6 A  A q! \r     AÐj$  ~# AÀ k"$   6< A)j! A\'j!	 A(j!\nA !A !@@@@@A !\r@ ! \r AÿÿÿÿsJ\r \r j! !\r@@@@@@ -  "E\r @@@@ Aÿq"\r  \r! A%G\r \r!@@ - A%F\r  ! \rAj!\r - ! Aj"! A%F\r  \r k"\r Aÿÿÿÿs"J\r\n@  E\r     \rÊ  \r\r  6< Aj!\rA!@ , APj"A	K\r  - A$G\r  Aj!\rA! !  \r6<A !@@ \r,  "A`j"AM\r  \r!A ! \r!A t"AÑqE\r @  \rAj"6<  r! \r, "A`j"A O\r !\rA t"AÑq\r @@ A*G\r @@ , APj"\rA	K\r  - A$G\r @@  \r   \rAtjA\n6 A !  \rAtj( ! Aj!A! \r Aj!@  \r   6<A !A !  ( "\rAj6  \r( !A !  6< AJ\rA  k! AÀ r! A<jË "A H\r (<!A !\rA!@@ -  A.F\r A !@ - A*G\r @@ , APj"A	K\r  - A$G\r @@  \r   AtjA\n6 A !  Atj( ! Aj! \r Aj!@  \r A !  ( "Aj6  ( !  6< AJ!  Aj6<A! A<jË ! (<!@ \r!A! ",  "\rAjAFI\r Aj! A:l \rjAÿü j-  "\rAjAÿqAI\r   6<@@ \rAF\r  \rE\r\r@ A H\r @  \r   Atj \r6 \r   Atj) 70  E\r	 A0j \r  Ì  AJ\rA !\r  E\r	  -  A q\r Aÿÿ{q"  AÀ q!A !Að ! \n!@@@@@@@@@@@@@@@@@ -  "À"\rASq \r AqAF \r "\rA¨j!	\n  \n!@ \rA¿j  \rAÓ F\rA !Að ! )0!A !\r@@@@@@@   (0 6  (0 6  (0 ¬7  (0 ;  (0 :   (0 6  (0 ¬7  A AK! Ar!Aø !\rA !Að ! )0" \n \rA qÍ ! P\r AqE\r \rAvAð j!A!A !Að ! )0" \nÎ ! AqE\r   k"\r  \rJ!@ )0"BU\r  B  }"70A!Að !@ AqE\r A!Añ !Aò Að  Aq"!  \nÏ !  A Hq\r Aÿÿ{q  !@ B R\r  \r  \n! \n!A !  \n k Pj"\r  \rJ!\r - 0!\r (0"\rA  \r!   Aÿÿÿÿ AÿÿÿÿIÅ "\rj!@ AL\r  ! \r!\r ! \r! -  \r )0"PE\rA !\r	@ E\r  (0!A !\r  A  A  Ð  A 6  >  Aj60 Aj!A!A !\r@@ ( "E\r Aj Ø "A H\r   \rkK\r Aj!  \rj"\r I\r A=! \rA H\r\r  A   \r Ð @ \r\r A !\rA ! (0!@ ( "E\r Aj Ø " j" \rK\r   Aj Ê  Aj!  \rI\r   A   \r AÀ sÐ   \r  \rJ!\r	  A Hq\r\nA=!   +0    \r   "\rA N\r \r- ! \rAj!\r   \r\n E\rA!\r@@  \rAtj( "E\r  \rAtj   Ì A! \rAj"\rA\nG\r @ \rA\nI\r A!@  \rAtj( \rA! \rAj"\rA\nF\r A!  \r: \'A! 	! \n! ! \n!   k"  J" AÿÿÿÿsJ\rA=!   j"  J"\r K\r  A  \r  Ð     Ê   A0 \r  AsÐ   A0  A Ð     Ê   A  \r  AÀ sÐ  (<!A !A=!õ  6 A! AÀ j$   @  -  A q\r     Æ {A !@  ( ",  APj"A	M\r A @A!@ AÌ³æ K\r A  A\nl"j  AÿÿÿÿsK!   Aj"6  , ! ! ! APj"A\nI\r  ¾ @@@@@@@@@@@@@@@@@@@ Awj 	\n\r  ( "Aj6    ( 6   ( "Aj6    4 7   ( "Aj6    5 7   ( "Aj6    4 7   ( "Aj6    5 7   ( AjAxq"Aj6    ) 7   ( "Aj6    2 7   ( "Aj6    3 7   ( "Aj6    0  7   ( "Aj6    1  7   ( AjAxq"Aj6    ) 7   ( "Aj6    5 7   ( AjAxq"Aj6    ) 7   ( AjAxq"Aj6    ) 7   ( "Aj6    4 7   ( "Aj6    5 7   ( AjAxq"Aj6    + 9       5 @  P\r @ Aj"  §Aq-   r:    B" B R\r  . @  P\r @ Aj"  §AqA0r:    B" B R\r  {~@  BT\r @ Aj"  " B\n" B\n~}§A0r:   BÿÿÿÿV\r @  P\r   §!@ Aj"  A\nn"A\nlkA0r:   A	K! ! \r  # Ak"$ @  L\r  AÀq\r     k"A AI" @ \r @   AÊ  A~j"AÿK\r     Ê  Aj$      AÓ AÔ È Ã~~|# A°k"$ A ! A 6,@@ Ô "BU\r A!	Aú !\n "Ô !@ AqE\r A!	Aý !\nA Aû  Aq"	!\n 	E!@@ Bøÿ Bøÿ R\r   A   	Aj" Aÿÿ{qÐ    \n 	Ê   AÆ Aß  A q"Aª Aê    bAÊ   A    AÀ sÐ     J!\r Aj!@@@@  A,j "  "D        a\r   (,"Aj6, A r"Aá G\r A r"Aá F\rA  A H! (,!  Acj"6,A  A H! D      °A¢! A0jA A  A Hj"!@  ü"6  Aj!  ¸¡D    eÍÍA¢"D        b\r @@ AN\r  ! ! ! ! !@ A AI!@ A|j" I\r  ­!B !@  5   |" BëÜ"BëÜ~}>  A|j" O\r  BëÜT\r  A|j" > @@ " M\r A|j"( E\r   (, k"6, ! A J\r @ AJ\r  AjA	nAj! Aæ F!@A  k"A	 A	I!\r@@  I\r A A ( !AëÜ \rv!A \rtAs!A ! !@  ( " \rv j6   q l! Aj" I\r A A ( ! E\r   6  Aj!  (, \rj"6,   j" " Atj   kAu J! A H\r A !@  O\r   kAuA	l!A\n! ( "A\nI\r @ Aj!  A\nl"O\r @ A   Aæ Fk A G Aç Fqk"  kAuA	lAwjN\r  A0jA`A¤b A Hj AÈ j"A	m"Atj!\rA\n!@  A	lk"AJ\r @ A\nl! Aj"AG\r  \rAj!@@ \r( "  n" lk"\r   F\r@@ Aq\r D      @C! AëÜG\r \r M\r \rA|j-  AqE\rD     @C!D      à?D      ð?D      ø?  FD      ø?  Av"F  I!@ \r  \n-  A-G\r  ! ! \r  k"6     a\r  \r  j"6 @ AëÜI\r @ \rA 6 @ \rA|j"\r O\r  A|j"A 6  \r \r( Aj"6  AÿëÜK\r   kAuA	l!A\n! ( "A\nI\r @ Aj!  A\nl"O\r  \rAj"   K!@@ " M"\r A|j"( E\r @@ Aç F\r  Aq! AsA A " J A{Jq"\r j!AA~ \r j! Aq"\r Aw!@ \r  A|j( "\rE\r A\n!A ! \rA\np\r @ "Aj! \r A\nl"pE\r  As!  kAuA	l!@ A_qAÆ G\r A !   jAwj"A  A J"  H!A !   j jAwj"A  A J"  H!A!\r AýÿÿÿAþÿÿÿ  r"J\r  A GjAj!@@ A_q"AÆ G\r   AÿÿÿÿsJ\r A  A J!@   Au"s k­ Ï "kAJ\r @ Aj"A0:    kAH\r  A~j" :  A!\r AjA-A+ A H:    k" AÿÿÿÿsJ\rA!\r  j" 	AÿÿÿÿsJ\r  A    	j" Ð    \n 	Ê   A0   AsÐ @@@@ AÆ G\r  AjA	r!    K"!@ 5  Ï !@@  F\r   AjM\r@ Aj"A0:    AjK\r   G\r  Aj"A0:       kÊ  Aj" M\r @ E\r   A AÊ   O\r AH\r@@ 5  Ï " AjM\r @ Aj"A0:    AjK\r     A	 A	HÊ  Awj! Aj" O\r A	J! ! \r @ A H\r   Aj  K!\r AjA	r! !@@ 5  Ï " G\r  Aj"A0:  @@  F\r   AjM\r@ Aj"A0:    AjK\r    AÊ  Aj!  rE\r   A AÊ      k"   JÊ   k! Aj" \rO\r AJ\r   A0 AjAA Ð      kÊ  !  A0 A	jA	A Ð   A    AÀ sÐ     J!\r \n AtAuA	qj!@ AK\r A k!D      0@!@ D      0@¢! Aj"\r @ -  A-G\r    ¡ !    ¡!@ (," Au"s k­ Ï " G\r  Aj"A0:   (,! 	Ar! A q! A~j" Aj:   AjA-A+ A H:   AH AqEq! Aj!@ " ü"A j-   r:    ·¡D      0@¢!@ Aj" AjkAG\r  D        a q\r  A.:  Aj! D        b\r A!\r Aýÿÿÿ   k"j"kJ\r   A    Aj  Ajk" A~j H  "j" Ð     Ê   A0   AsÐ    Aj Ê   A0  kA A Ð     Ê   A    AÀ sÐ     J!\r A°j$  \r.  ( AjAxq"Aj6    )  )ë 9    ½³# Ak"$   : @@  ("\r @  Ä E\r A!  (!@  (" F\r   (P Aÿq"F\r    Aj6  :  @   AjA  ($  AF\r A! - ! Aj$   @  \r A õ   6 A¬A!@@  E\r  Aÿ M\r@@´ (`( \r  AqA¿F\rõ A6 @ AÿK\r    A?qAr:    AvAÀr:  A@@ A°I\r  A@qAÀG\r   A?qAr:    AvAàr:     AvA?qAr: A@ A|jAÿÿ?K\r    A?qAr:    AvAðr:     AvA?qAr:    AvA?qAr: Aõ A6 A!    :  A @  \r A    A × 	   ø&# Ak"$ @@@@@  AôK\r @A (à "A  AjAøq  AI"Av"v" AqE\r @@  AsAq j"At"A j" ( "(" G\r A  A~ wq6à   A (ð I\r  ( G\r   6   6 Aj!   Ar6  j" (Ar6 A (è "M\r@  E\r @@   tA t" A   krqh"At"A j" ( " ("G\r A  A~ wq"6à  A (ð I\r (  G\r  6  6   Ar6   j"  k"Ar6   j 6 @ E\r  AxqA j!A (ô !@@ A Avt"q\r A   r6à  ! ("A (ð I\r  6  6  6  6  Aj! A  6ô A  6è A (ä "	E\r 	hAt( "(Axq k! !@@@ (" \r  (" E\r  (Axq k"   I"!    !  !  A (ð "\nI\r (!@@ ("  F\r  (" \nI\r ( G\r  ( G\r   6   6@@@ ("E\r  Aj! ("E\r Aj!@ ! " Aj!  ("\r   Aj!  ("\r   \nI\r A 6 A ! @ E\r @@  ("At"( G\r  A j  6   \rA  	A~ wq6ä   \nI\r@@ ( G\r    6   6  E\r   \nI\r   6@ ("E\r   \nI\r   6   6 ("E\r   \nI\r   6   6@@ AK\r    j" Ar6   j"   (Ar6  Ar6  j" Ar6  j 6 @ E\r  AxqA j!A (ô ! @@A Avt" q\r A   r6à  ! (" \nI\r   6   6   6   6A  6ô A  6è  Aj! A!  A¿K\r   Aj"Axq!A (ä "E\r A!@  AôÿÿK\r  A& Avg" kvAq  AtkA>j!A  k!@@@@ At( "\r A ! A !A !  A A Avk AFt!A !@@ (Axq k" O\r  ! ! \r A ! ! !    ("   AvAqj("F   !  At! ! \r @   r\r A !A t" A   kr q" E\r  hAt( !   E\r@  (Axq k" I!@  ("\r   (!   !    ! !  \r  E\r  A (è  kO\r  A (ð "I\r (!@@ ("  F\r  (" I\r ( G\r  ( G\r   6   6@@@ ("E\r  Aj! ("E\r Aj!@ ! " Aj!  ("\r   Aj!  ("\r   I\r A 6 A ! @ E\r @@  ("At"( G\r  A j  6   \rA  A~ wq"6ä   I\r@@ ( G\r    6   6  E\r   I\r   6@ ("E\r   I\r   6   6 ("E\r   I\r   6   6@@ AK\r    j" Ar6   j"   (Ar6  Ar6  j" Ar6  j 6 @ AÿK\r  AøqA j! @@A (à "A Avt"q\r A   r6à   !  (" I\r   6  6   6  6A! @ AÿÿÿK\r  A& Avg" kvAq  AtrA>s!    6 B 7  AtA j!@@@ A  t"q\r A   r6ä   6   6 A A  Avk  AFt!  ( !@ "(Axq F\r  Av!  At!   Aqj"("\r  Aj"  I\r   6   6  6  6  I\r ("  I\r   6  6 A 6  6   6 Aj! @A (è "  I\r A (ô !@@   k"AI\r   j" Ar6   j 6   Ar6   Ar6   j"   (Ar6A !A !A  6è A  6ô  Aj! @A (ì " M\r A   k"6ì A A (ø "  j"6ø   Ar6   Ar6  Aj! @@A (¸ E\r A (À !A B7Ä A B 7¼ A  AjApqAØªÕªs6¸ A A 6Ì A A 6 A !A !   A/j"j"A  k"q" M\rA ! @A ( "E\r A ( " j" M\r  K\r@@@A -  Aq\r @@@@@A (ø "E\r A  ! @@   ( "I\r     (jI\r  (" \r A ã "AF\r !@A (¼ " Aj" qE\r   k  jA   kqj!  M\r@A ( " E\r A ( " j" M\r   K\r ã "  G\r  k q"ã "  (   (jF\r !   AF\r@  A0jI\r   !  kA (À "jA  kq"ã AF\r  j!  ! AG\rA A ( Ar6  ã !A ã !  AF\r  AF\r   O\r   k" A(jM\rA A (  j" 6 @  A ( M\r A   6 @@@@A (ø "E\r A  ! @   ( "  ("jF\r  (" \r @@A (ð " E\r    O\rA  6ð A ! A  6¤ A  6  A A6 A A (¸ 6 A A 6¬ @  At" A j"6   6   Aj" A G\r A  AXj" Ax kAq"k"6ì A   j"6ø   Ar6   jA(6A A (È 6ü   O\r   I\r   (Aq\r     j6A  Ax kAq" j"6ø A A (ì  j"  k" 6ì    Ar6  jA(6A A (È 6ü @ A (ð O\r A  6ð   j!A  ! @@@  ( " F\r  (" \r   - AqE\rA  ! @@@   ( "I\r     (j"I\r  (!  A  AXj" Ax kAq"k"6ì A   j"6ø   Ar6   jA(6A A (È 6ü   A\' kAqjAQj"    AjI"A6 A )¨ 7 A )  7A  Aj6¨ A  6¤ A  6  A A 6¬  Aj! @  A6  Aj!  Aj!   I\r   F\r   (A~q6   k"Ar6  6 @@ AÿK\r  AøqA j! @@A (à "A Avt"q\r A   r6à   !  ("A (ð I\r   6  6A!A!A! @ AÿÿÿK\r  A& Avg" kvAq  AtrA>s!    6 B 7  AtA j!@@@A (ä "A  t"q\r A   r6ä   6   6 A A  Avk  AFt!  ( !@ "(Axq F\r  Av!  At!   Aqj"("\r  Aj" A (ð I\r   6   6A!A! ! !  A (ð "I\r ("  I\r   6  6   6A ! A!A!  j 6   j  6 A (ì "  M\r A    k"6ì A A (ø "  j"6ø   Ar6   Ar6  Aj! õ A06 A ! Ù     6     ( j6   Û !  Aj$   \n  Ax  kAqj" Ar6 Ax kAqj"  j"k! @@@ A (ø G\r A  6ø A A (ì   j"6ì   Ar6@ A (ô G\r A  6ô A A (è   j"6è   Ar6  j 6 @ ("AqAG\r  (!@@ AÿK\r @ (" AøqA j"F\r  A (ð I\r ( G\r@  G\r A A (à A~ Avwq6à @  F\r  A (ð I\r ( G\r  6  6 (!@@  F\r  ("A (ð I\r ( G\r ( G\r  6  6@@@ ("E\r  Aj! ("E\r Aj!@ !	 "Aj! ("\r  Aj! ("\r  	A (ð I\r 	A 6 A ! E\r @@  ("At"( G\r  A j 6  \rA A (ä A~ wq6ä  A (ð I\r@@ ( G\r   6  6 E\r A (ð "I\r  6@ ("E\r   I\r  6  6 ("E\r   I\r  6  6 Axq"  j!   j"(!  A~q6   Ar6   j  6 @  AÿK\r   AøqA j!@@A (à "A  Avt" q\r A    r6à  !  (" A (ð I\r  6   6  6   6A!@  AÿÿÿK\r   A&  Avg"kvAq AtrA>s!  6 B 7 AtA j!@@@A (ä "A t"q\r A   r6ä   6   6  A A Avk AFt! ( !@ "(Axq  F\r Av! At!  Aqj"("\r  Aj"A (ð I\r  6   6  6  6 A (ð " I\r ("  I\r  6  6 A 6  6  6 AjÙ  Ä\n@@  E\r   Axj"A (ð "I\r  A|j( "AqAF\r  Axq" j!@ Aq\r  AqE\r  ( "k" I\r   j! @ A (ô F\r  (!@ AÿK\r @ (" AøqA j"F\r   I\r ( G\r@  G\r A A (à A~ Avwq6à @  F\r   I\r ( G\r  6  6 (!@@  F\r  (" I\r ( G\r ( G\r  6  6@@@ ("E\r  Aj! ("E\r Aj!@ ! "Aj! ("\r  Aj! ("\r   I\r A 6 A ! E\r@@  ("At"( G\r  A j 6  \rA A (ä A~ wq6ä   I\r@@ ( G\r   6  6 E\r  I\r  6@ ("E\r   I\r  6  6 ("E\r  I\r  6  6 ("AqAG\r A   6è   A~q6   Ar6   6   O\r ("AqE\r@@ Aq\r @ A (ø G\r A  6ø A A (ì   j" 6ì    Ar6 A (ô G\rA A 6è A A 6ô @ A (ô "	G\r A  6ô A A (è   j" 6è    Ar6   j  6  (!@@ AÿK\r @ (" AøqA j"F\r   I\r ( G\r@  G\r A A (à A~ Avwq6à @  F\r   I\r ( G\r  6  6 (!\n@@  F\r  (" I\r ( G\r ( G\r  6  6@@@ ("E\r  Aj! ("E\r Aj!@ ! "Aj! ("\r  Aj! ("\r   I\r A 6 A ! \nE\r @@  ("At"( G\r  A j 6  \rA A (ä A~ wq6ä  \n I\r@@ \n( G\r  \n 6 \n 6 E\r  I\r  \n6@ ("E\r   I\r  6  6 ("E\r   I\r  6  6  Axq  j" Ar6   j  6   	G\rA   6è   A~q6   Ar6   j  6 @  AÿK\r   AøqA j!@@A (à "A  Avt" q\r A    r6à  !  ("  I\r  6   6  6   6A!@  AÿÿÿK\r   A&  Avg"kvAq AtrA>s!  6 B 7 AtA j!@@@@A (ä "A t"q\r A   r6ä   6 A! A!  A A Avk AFt! ( !@ "(Axq  F\r Av! At!  Aqj"("\r  Aj"  I\r   6 A! A! ! ! !  I\r (" I\r  6  6A !A! A!  j 6   6   j 6 A A ( Aj"A 6 Ù  @  \r  Ú @ A@I\r õ A06 A @  AxjA AjAxq AIÞ "E\r  Aj@ Ú "\r A    A|Ax  A|j( "Aq Axqj"   I   Ü  		@@  A (ð "I\r   ("Aq"AF\r  Axq"E\r    j"("AqE\r @ \r A ! AI\r@  AjI\r   !  kA (À AtM\rA !@  I\r @  k"AI\r     AqrAr6   j" Ar6  (Ar6  á   A !@ A (ø G\r A (ì  j" M\r    AqrAr6   j"  k"Ar6A  6ì A  6ø   @ A (ô G\r A !A (è  j" I\r@@  k"AI\r     AqrAr6   j" Ar6   j" 6   (A~q6   Aq rAr6   j" (Ar6A !A !A  6ô A  6è   A ! Aq\r Axq j" I\r (!@@ AÿK\r @ (" AøqA j"	F\r   I\r ( G\r@  G\r A A (à A~ Avwq6à @  	F\r   I\r ( G\r  6  6 (!\n@@  F\r  (" I\r ( G\r ( G\r  6  6@@@ ("E\r  Aj! ("E\r Aj!@ !	 "Aj! ("\r  Aj! ("\r  	 I\r 	A 6 A ! \nE\r @@  ("At"( G\r  A j 6  \rA A (ä A~ wq6ä  \n I\r@@ \n( G\r  \n 6 \n 6 E\r  I\r  \n6@ ("E\r   I\r  6  6 ("E\r   I\r  6  6@  k"AK\r    Aq rAr6   j" (Ar6      AqrAr6   j" Ar6   j" (Ar6  á   Ù   ±A!@@  A  AK" Ajq\r  ! @ " At!   I\r @ A@  kI\r õ A06 A @A AjAxq AI"  jAjÚ "\r A  Axj!@@  Aj q\r  !  A|j"( "Axq   jAjA   kqAxj"A     kAKj"  k"k!@ Aq\r  ( !   6    j6      (AqrAr6   j" (Ar6   ( AqrAr6   j" (Ar6  á @  ("AqE\r  Axq" AjM\r     AqrAr6   j"  k"Ar6   j" (Ar6  á   Ajx@@@ AG\r  Ú !A! Aq\r Av"E\r iAK\r@ A@ kM\r A0 A AK ß !@ \r A0   6 A ! ø	   j!@@@@  ("AqE\r A (ð ! AqE\r    ( "k" A (ð "I\r  j!@  A (ô F\r   (!@ AÿK\r @  (" AøqA j"F\r   I\r (  G\r@  G\r A A (à A~ Avwq6à @  F\r   I\r (  G\r  6  6  (!@@   F\r   (" I\r (  G\r (  G\r  6  6@@@  ("E\r   Aj!  ("E\r  Aj!@ ! "Aj! ("\r  Aj! ("\r   I\r A 6 A ! E\r@@    ("At"( G\r  A j 6  \rA A (ä A~ wq6ä   I\r@@ (  G\r   6  6 E\r  I\r  6@  ("E\r   I\r  6  6  ("E\r  I\r  6  6 ("AqAG\r A  6è   A~q6   Ar6  6   I\r@@ ("Aq\r @ A (ø G\r A   6ø A A (ì  j"6ì    Ar6  A (ô G\rA A 6è A A 6ô @ A (ô "	G\r A   6ô A A (è  j"6è    Ar6   j 6  (!@@ AÿK\r @ (" AøqA j"F\r   I\r ( G\r@  G\r A A (à A~ Avwq6à @  F\r   I\r ( G\r  6  6 (!\n@@  F\r  (" I\r ( G\r ( G\r  6  6@@@ ("E\r  Aj! ("E\r Aj!@ ! "Aj! ("\r  Aj! ("\r   I\r A 6 A ! \nE\r @@  ("At"( G\r  A j 6  \rA A (ä A~ wq6ä  \n I\r@@ \n( G\r  \n 6 \n 6 E\r  I\r  \n6@ ("E\r   I\r  6  6 ("E\r   I\r  6  6   Axq j"Ar6   j 6    	G\rA  6è   A~q6   Ar6   j 6 @ AÿK\r  AøqA j!@@A (à "A Avt"q\r A   r6à  ! (" I\r   6   6   6   6A!@ AÿÿÿK\r  A& Avg"kvAq AtrA>s!   6  B 7 AtA j!@@@A (ä "A t"q\r A   r6ä    6    6 A A Avk AFt! ( !@ "(Axq F\r Av! At!  Aqj"("\r  Aj" I\r   6    6    6    6  I\r (" I\r   6   6  A 6   6   6Ù   ? Atd~@@  ­B|BøÿÿÿA ( " ­|"BÿÿÿÿV\r â  §"O\r  \rõ A06 AA  6   S~@@ AÀ qE\r   A@j­!B ! E\r  AÀ  k­  ­"!  !   7    7S~@@ AÀ qE\r   A@j­!B ! E\r  AÀ  k­  ­"!  !   7    7Ì}}  "  "!@  "  "	"\n \n[\r   [\r @ C  [" C  ["r"\rAG\r C        \\!C        \\!C  ?C      !C  ?C      ! !@@@ "C  [\r  C  \\\rC        \\!C        \\!C  ?C     C  [ !C  ?C     C  [ ! \r\r @ C  [\r  C  [\r  C  [\r  	C  \\\rC        \\!C        \\!C        \\!C        \\!    C  !    C  !\n   8   \n8   A $ A AjApq$  # # k #  # ©~# A k"$  Bÿÿÿÿÿÿ?!@@ B0Bÿÿ"§"AÿjAýK\r   B< B! Aj­!@@  Bÿÿÿÿÿÿÿÿ" BT\r  B|!  BR\r  B |!B   BÿÿÿÿÿÿÿV"!  ­ |!@   P\r  BÿÿR\r   B< BB! Bÿ!@ AþM\r Bÿ!B ! @Aø Aø  P"" k"Að L\r B ! B !  BÀ  !A !@  F\r  Aj   A kä  ) )B R!     å  ) "B< )B! @@ Bÿÿÿÿÿÿÿÿ ­"BT\r   B|!  BR\r   B  |!   B    BÿÿÿÿÿÿÿV"!  ­! A j$  B4 B  ¿\n   ¿    ì A  AÝ Ô# Ak"$    6@@  AÓK\r Aà A   Ajð ( !   ñ      AÒn"AÒl"k6A  Aà  Ajð "(  j!  A  kAu!@A!@@@ "A/F\r   At(à "n" I\r Aj!    lG\r  A/I\rAÓ!@   n" I\r    lF\r   A\nj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   A$j"n" I\r    lF\r   A(j"n" I\r    lF\r   A*j"n" I\r    lF\r   A.j"n" I\r    lF\r   A4j"n" I\r    lF\r   A:j"n" I\r    lF\r   A<j"n" I\r    lF\r   AÂ j"n" I\r    lF\r   AÆ j"n" I\r    lF\r   AÈ j"n" I\r    lF\r   AÎ j"n" I\r    lF\r   AÒ j"n" I\r    lF\r   AØ j"n" I\r    lF\r   Aà j"n" I\r    lF\r   Aä j"n" I\r    lF\r   Aæ j"n" I\r    lF\r   Aê j"n" I\r    lF\r   Aì j"n" I\r    lF\r   Að j"n" I\r    lF\r   Aø j"n" I\r    lF\r   Aþ j"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   Aj"n" I\r    lF\r   A¢j"n" I\r    lF\r   A¦j"n" I\r    lF\r   A¨j"n" I\r    lF\r   A¬j"n" I\r    lF\r   A²j"n" I\r    lF\r   A´j"n" I\r    lF\r   Aºj"n" I\r    lF\r   A¾j"n" I\r    lF\r   AÀj"n" I\r    lF\r   AÄj"n" I\r    lF\r   AÆj"n" I\r    lF\r   AÐj"n" I\r AÒj!    lG\r A  Aj"   A0F" "At(     j"AÒlj!   Aj$        ò  @  A|I\r A ó  A# Ak"$  A :      Aj Ajô ! Aj$  +# Ak"$    6 A           õ   ö     ÷ # Ak"$ @@ E\r ø !   6 Aj ù   Asj    (ú  û "! (Aj   !   Aj$       ü    Av    ý     ÿ      þ \n    kAu      \r  (  ( I          (  Atj6 T# Ak"$ A !@  Aq\r    p\r  Aj   à ! A  (  ! Aj$   @   " \r    >  A  AK!@@ Ú "\r " E\r      	   \n    \n   Ü \n    \n     @    "\r   L A AK!  A  AK! @@    "\r "E\r     $      jAjA   kq"  K \n    \n   Ü       Aë A      Aè Aj6   V ¿ "A\rj "A 6  6  6   !@ Aj"E\r    ü\n     6      Aj(    " AØ Aj6   Aj     A     {@@ (L"A H\r  E\r Aÿÿÿÿq´ (G\r@  Aÿq" (PF\r  (" (F\r   Aj6   :     Õ     @ AÌ j" E\r   @@  Aÿq" (PF\r  (" (F\r   Aj6   :    Õ !@  AqE\r        ( "Aÿÿÿÿ 6    ( !  A 6  \r   A ]# Ak"$   6A (  "   Ñ @    ¿ jAj-  A\nF\r A\n  Ù  W# Ak"$ Aÿ AAA (  "Ç   6    Ñ A\n  Ù     (  AÐ     AÐ jÚ AÐ j Aá A   \n   Ð      ¢ A    ¢ A    ¢ A    ¢ A     A ª 9 @ \r   ( (F@   G\r A  «  « » E   (# AÐ k"$ A!@@   A ª \r A ! E\r A ! Aà A A ­ "E\r  ( "E\r AjA A8ü  A: K A6    6  6 A6D  Aj A ( (  @ (,"AG\r   ($6  AF! AÐ j$   Aî 6 Aç6 AÍ 6 Að    # Ak"$  Aj  ®  (" A ª ! (!@@ E\r       ( ¯ !      ° "\r        ± ! Aj$  /   ( "Axj( "6    j6    A|j( 6Ì# AÀ k"$ A !@@ A H\r  A  A  kF! A~F\r  B 7  6  6   6  6 B 7 B 7$ B 7, A 6< B74  Aj  AA  ( (   A  (AF! AÀ j$  º# AÀ k"$ A !@ A H\r    k"  H\r  B 7  6  6  6 B 7 B 7$ B 7, A 6< B74   6  Aj  AA  ( (    A  (! AÀ j$  ê# AÀ k"$   6  6   6  6A ! AjA A\'ü  A 6< A: ;  Aj AA  ( (  @@@ ((  (A  ($AFA  ( AFA  (,AF!@ (AF\r  (,\r ( AG\r ($AG\r (! AÀ j$  w@ ($"\r   6  6 A6$  (86@@ ( (8G\r  ( G\r  (AG\r  6 A: 6 A6  Aj6$% @   (A ª E\r     ² F @   (A ª E\r     ²   ("      ( (  YA!@@  - Aq\r A ! E\r Aà AÀ A ­ "E\r - AqA G!    ª ! ÿ# AÀ k"$ @@ Aì A ª E\r  A 6 A!@    µ E\r A! ( "E\r  ( 6 @ E\r A ! Aà Að A ­ "E\r@ ( "E\r   ( 6  ("  ("AsqAq\r As qAà q\rA!  ( (A ª \r@  (Aà A ª E\r  ("E\r Aà A  A ­ E!  ("E\r A !@ Aà Að A ­ "E\r   - AqE\r  (· !A !@ Aà AÔ A ­ "E\r   - AqE\r  (¸ !A ! Aà A A ­ " E\r ("E\rA ! Aà A A ­ "E\r ( ! AjA A8ü   A G: ; A6   6  6 A64  Aj A ( (  @ ("AG\r   (A  6  AF!A ! AÀ j$  Ê@@@ \r A A ! Aà Að A ­ "E\r (  (Asq\r@  ( (A ª E\r A  - AqE\r  ("E\r@ Aà Að A ­ " E\r  (!A ! Aà AÔ A ­ " E\r    (¸ ! jA !@ E\r  Aà AÔ A ­ "E\r  (  (Asq\r A !  ( (A ª E\r   ( (A ª !   A: 5@  (G\r  A: 4@@ ("\r  A6$  6  6 AG\r (0AF\r@  G\r @ ("AG\r   6 ! (0AG\r AF\r  ($Aj6$ A: 6  @  (G\r  (AF\r   6 @   ( ª E\r     º @@   (  ª E\r @@  (F\r   (G\r AG\r A6   6 @ (,AF\r  A ;4  ("    A   ( (  @ - 5AG\r  A6, - 4E\r A6,  6  ((Aj6( ($AG\r (AG\r A: 6  ("       ( (  ¤ @   ( ª E\r     º @   (  ª E\r @@  (F\r   (G\r AG\r A6   6  6   ((Aj6(@ ($AG\r  (AG\r  A: 6 A6,L @   ( ª E\r      ¹   ("        ( (  \' @   ( ª E\r      ¹       ¿   A  AÛ     " AÀ Aj6      ¿   A  Aû    Â " AÔ Aj6      ¿   A  A $   AØ Aj6   AjÉ   ¿ 7@   E\r   ( Ê "AjË AJ\r        Atj    ( Aj"6     È   A \r   AjÎ    (    È   A    \n   $ #   kApq"$   # £ AÑ¨D   N10emscripten3valE intensity specDensity category vendorCategory userCategory subCategory library inKey -+   0X0x -0X+0X 0X-0x+0x 0x __next_prime overflow text artist isOst unsigned short unsigned int instrument accent project float ambisonicFormat efforts usageRights loudness process setNoiseLowPass setReverbLowPass setNoiseHighPass setReverbHighPass notes %s:%d: %s papr editor vector director originator composor Unknown error mixer rmsPower setMasterLimiter rightsOwner musicPublisher recEngineer ambisonicChnOrder actorGender characterGender producer unsigned char musicSup /emsdk/emscripten/system/lib/libcxxabi/src/private_typeinfo.cpp isLoop tempo originatorStudio recStudio setMasterDistortion setKickDistortion std::exception emotion timingRestriction direction projection impulseLocation session musicVersion isUnion nan ambisonicNorm bool std::bad_function_call isFinal maxPeak bad_array_new_length setKickLength unsigned long long unsigned long std::wstring std::string std::u16string std::u32string setLooping channelConfig micConfig timeSig inf orderRef cue state zeroCrossRate cueRelease genre subGenre prepare effortType contentType micType AudioEngine setNoiseVolume setReverbVolume fxName actorName characterName fxChainName songTitle selectKickSample loadKickSample selectNoiseSample loadNoiseSample characterRole double loudnessRange language characterAge bad_alloc was thrown in -fno-exceptions mode billingCode isSource micDistance void isLicensed fxUsed isDesigned catId creatorId sourceId isrcId std::bad_alloc recordingLoc isDiegetic isCinematic userData setMasterOTT setKickOTT selectIR loadIR NAN setBPM INF catching a class without an object? emscripten::memory_view<short> emscripten::memory_view<unsigned short> emscripten::memory_view<int> emscripten::memory_view<unsigned int> emscripten::memory_view<float> emscripten::memory_view<uint8_t> emscripten::memory_view<int8_t> emscripten::memory_view<uint16_t> emscripten::memory_view<int16_t> emscripten::memory_view<uint64_t> emscripten::memory_view<int64_t> emscripten::memory_view<uint32_t> emscripten::memory_view<int32_t> emscripten::memory_view<char> emscripten::memory_view<unsigned char> emscripten::memory_view<signed char> emscripten::memory_view<long> emscripten::memory_view<unsigned long> emscripten::memory_view<double> . (null) overflow_error was thrown in -fno-exceptions mode with message "%s" Pure virtual function called! libc++abi:   ¨D 	 NSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE  ¨D Ü	 NSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEEE  ¨D $\n NSt3__212basic_stringIDsNS_11char_traitsIDsEENS_9allocatorIDsEEEE   ¨D p\n NSt3__212basic_stringIDiNS_11char_traitsIDiEENS_9allocatorIDiEEEE   ¨D ¼\n N10emscripten11memory_viewIcEE  ¨D ä\n N10emscripten11memory_viewIaEE  ¨D  N10emscripten11memory_viewIhEE  ¨D 4 N10emscripten11memory_viewIsEE  ¨D \\ N10emscripten11memory_viewItEE  ¨D  N10emscripten11memory_viewIiEE  ¨D ¬ N10emscripten11memory_viewIjEE  ¨D Ô N10emscripten11memory_viewIlEE  ¨D ü N10emscripten11memory_viewImEE  ¨D $ N10emscripten11memory_viewIxEE  ¨D L N10emscripten11memory_viewIyEE  ¨D t N10emscripten11memory_viewIfEE  ¨D  N10emscripten11memory_viewIdEE  ¨D Ä 11AudioEngine   ,E ä     ¼ P11AudioEngine  ,E \r    ¼ PK11AudioEngine pp v vp Ô pp  àC Ô D vppf            àC Ô dD dD @D vppiii      àC Ô dD dD vppii   àC Ô @D vppi        àC Ô dD dD dD vppiii  àC Ô øC vppi    àC Ô vpp     ø\r *   +   ,   -   .   /   0   1   2   ÐD  D NSt3__210__function6__funcIZN10Distortion7prepareEfE3$_0FffEEE  ¨D L NSt3__210__function6__baseIFffEEE       D 3   4   5   5   5   5   5   5   5   ¨D ¤ ZN10Distortion7prepareEfE3$_0         Ü C   D   E   ÐD è  N4juce3dsp3FFT10EngineImplINS0_11FFTFallbackEEE ¨D   N4juce3dsp3FFT6EngineE       F   G   5       h H   I   J   K   L   ÐD t  N4juce3dsp11FFTFallbackE    ¨D  N4juce3dsp3FFT8InstanceE         M   N   5   5   5               ù¢ DNn ü) ÑW\' Ý4õ bÛÀ < AC cQþ »Þ« ·aÅ :n$ ÒMB Ià 	ê. Ñ ëþ )± è>§ õ5 D». é ´&p A~_ Ö9 S9 ô9 _ (ù½ ø; Þÿ  /ï \nZ mm Ï~6 	Ë\' FO· f? -ê_ º\'u åëÇ ={ñ ÷9 R ûkê ±_ ] 0V {üF ð«k  ¼Ï 6ô ã© ^a æ e  _ @h Øÿ \'sM 1 ÊV É¨s {â` kÀ ÄG ÍgÃ 	èÜ Y* vÄ ¦ D¯Ý WÑ ¥> ÿ 3~? Â2è OÞ »}2 &=Ã kï ø^ 5: òÊ ñ |! j$| Õnú 0-w ;C µÆ Ã ­ÄÂ ,MA  ] }F ãq- Æ 3b  ´Ò| ´§ 7UÕ ×>ö £ Mvü d* p×« c|ø z°W ç ÀIV ;ÖÙ §8 $#Ë Öw ZT#  ¹ ñ\n Îß 1ÿ fj Wa ¬ûG ~Ø "e· 2è æ¿` ïÄÍ l6	 ]?Ô Þ× X;Þ Þ Ò"( (è âXM ÆÊ2 ã à}Ë ÀP ó§ à[ .4 b H õ[ ­° éò HJC gÓ ªÝØ ®_B jaÎ \n(¤ Ó´ ¦ò \\w £Â a< sx ¯Z o×½ -¦c ô¿Ë ï &Ág UÊE ÊÙ6 (¨Ò Âa Éw & F ÄYÄ ÈÅD M²  ó ÔC­ )Iå ýÕ  ¾ü Ì pÎî >õ ìñ ³çÃ Çø(  Áq> .	³ Eó  « { .µ GÂ {2/ Um r§ kç 1Ë yJ Ayâ ôß è âæ 1 ík __6 »ý H´ g¤l qrB ]2 ¸ ¼å	 1% ÷t9 0 \r Kh ,îX Gª tç ½Ö$ ÷}¦ nHr ï ¦ ´ö ÑSQ Ï\nò  3 õK~ ²ch Ý>_ @]  UR) 7dÀ mØ 2H2 [Lu NqÔ ETn 	Á *õi fÕ \' ]P ´;Û êvÅ ù Ik} \'º i) ÆÌ¬ ­T âj Ù ,rP ¤¾ w ó0p  ü\' êq¨ fÂI dà= Ý £? Cý \r 1AÞ 9 Ýp ·ç ß; 7+ \\  Z  èØ l¯ ÛÿK 8 Yv b¥ aË» Ç¹ @½ Òò Iu\' ë¶ö Û"» \nª &/ dv 	;3  Q:ª £Â ¯í® \\& mÂM -z ÀV ? 	ðö +@ m1 9´   ØÃ[ õÄ Æ­K NÊ¥ §7Í æ©6 « ÝBh cÞ vï hR üÛ7 ®¡« ß1  ®¡ ûÚ dMf í· )e0 WV¿ Gÿ: jù¹ u¾ó (ß «0 fö Ë ú" Ùä =³¤ W 6Í	 NBé ¾¤ 3#µ ðª Oe¨ ÒÁ¥ ? [xÍ #ùv { r Æ¦S onâ ïë  JX ÄÚ· ªfº vÏÏ Ñ ±ñ- Á Ã­w HÚ ÷]  Æô ¬ð/ Ýì ?\\¼ ÐÞm Ç *Û¶ £%:  ¯ ­S ¶W )-´ K~ Ú§ vª {Y¡ * Ü·- úåý Ûþ ¾ý ävl ©ü >p n ýÿ (> ag3 * M½ê ³ç¯ mn g9 1¿[ ×H 0ß Ç-C %a5 ÉpÎ 0Ë¸ ¿lý ¤ ¢ lä ZÝ  !oG bÒ ¹\\ paI kVà R PU7 Õ· 3ñÄ n_ ]0ä .© ²Ã ¡26 ·¤ ê±Ô ÷! iä \'ÿw  @- OÍ   ¥ ³¢Ó /]\n ´ùB ÚË }¾Ð ÛÁ «½ Ê¢ j\\ .U \' U ð á d A ¾Þ Úý* k%¶ {4 óþ ¹¿ hjO J*¨ OÄZ -ø¼ ×Z ôÇ \rM  :¦ ¤W_ ?± 8 Ì  qÝ ÉÞ¶ ¿`õ Me k °¬ ²ÀÐ QUH û rÃ £; À@5 Ü{ àEÌ N)ú ÖÊÈ èóA |dÞ dØ Ù¾1 ¤Ã wXÔ iãÅ ðÚ º:< FF Uu_ Ò½õ nÆ ¬.] Dí >B aÄ )ýé çÖó "|Ê o5 àÅ ÿ× njâ °ýÆ Á |]t k­² Ín >r{ Æj ÷Ï© )sß µÉº · Q â²\r tº$ å}` tØ \r,  ~f ) zv ýý¾ VEï Ù~6 ìÙ º¹ Äü 1¨\' ñnÃ Å6 Ø¨V ´¨µ ÏÌ - oW4 ,V Îã Ö ¹ k^ª >* _Ì ýJ áôû ;m â, éÔ ü´© ïîÑ .5É /9a 8!D ÙÈ ü\n ûJj /Ø S´ N T"Ì *UÜ ÀÆÖ  p¸ id &Z` ?Rî  ôµ üËõ 4¼- 4¼î è]Ì Ý^` g 3ï É¸ aX áW¼ QÆ Ø> ÝqH -Ý ¯¡ !,F Yó× Ùz TÀ Oú Vü åy® "6 8­" gÜ Uèª &8 Êç Q\r¤ 3± ©× iH e²ð § L ùÑ6 !³ {J Ï! @Ü ÜGU át: gëB þß ^Ô_ {g¤ º¬z Uö¢ +# AºU Yn !* 9G ãæ åÔ Iû@ ÿVé Ê ÅY ú+ ÓÁÅ ÅÏ ÛZ® GÅ Cb !; ,y a *L{ , C¿ & x< ¨Ää åÛ{ Ä:Â &ôê ÷g \r¿ e£+ =± ½| ¤QÜ \'Ýc iáÝ  ¨) hÎ( 	í´ D  NÊ pc ~|# ¹2 §õ Vç !ñ µ* o~M ¥Q µù« ßÖ Ýa 6 Ä: ¢¡ rím 9z ¸© k2\\ F\'[  4í Ò w üôU YM àq            @û!ù?    -Dt>   Fø<   `QÌx;   ð9   @ %z8   "ã6    ói5þ+eGg@      8C  úþB.v¿:;¼÷½½ýÿÿÿÿß?<TUUUUÅ?+ÏUU¥?Ð¤g?      ÈBï9úþB.æ?$Äÿ½¿Î?µô×k¬?ÌPFÒ«²?:Nà×U?              ð?n¿O;<53û©=öï?]ÜØ`q¼aw>ìï?Ñfz^¼nèãï?ög5RÒ<tÓ°Ùï?úù#Î¼ÞöÝ)kÐï?aÈæaN÷`<ÈuEÇï?Ó3[ä£<óÆÊ>¾ï?m{]¦<ùlXµï?üïýµ<÷Gr+¬ï?Ñ/p=¾><¢ÑÓ2ì£ï?n4j¼Óþ¯fï?½/*RV¼Q[Ðï?UêNïP¼Ì1lÀ½ï?ôÕ¹#É¼à-©®ï?¯U\\éãÓ<Q¥Èzï?H¥ê¼{Q}<¸rï?=2ÞUð¼ê8ùjï?¿S?<uËoë[cï?&ëvÙ¼Ô\\à[ï?`/:>÷ì<ª¹h1Tï?8Ëç¼Ùü"PMï?Ã¦DAo<Öb;Fï?}ä°z<Ü}I?ï?¨¨ãý<8bunz8ï?}Htò^<?¦²OÎ1ï?òç+G<Ý|âeE+ï?^q?{¸¼cõáß$ï?1«	má÷<áÞõï?ú¿o!=¼ÙÚÐï?´\nr7<ä¦ï?ËÎn<V/>©¯ï?¶«°MuM<·1\nþï?Lt¬âB<1ØLüpï?JøÓ]9Ý<ÿd²üî?[;£¼ñ_Åöî?hPKÌíJ¼Ë©:7§ñî?-Qø¼fØm®ìî?Ò6>èÑq¼÷å4Ûçî?Î³¼å¨Ã-ãî?mL*§H<"4L¦Þî?i(z`¼¬EÚî?[H§X¼*.÷!\nÖî?Ig,|¼¨PÙõÑî?¬Â`ícC<-a`Îî?ïd;	f<W íAÊî?y¡ÚáÌn<Ð<Áµ¢Æî?0?ÿ<ÞÓ×ð*Ãî?°¯z»Îv<\'*6ÕÚ¿î?wàTë½<\rÝý²¼î?£q 4¼§,v²¹î?I£ÜÌÞ¼BfÏ¢Ú¶î?_8½ÆÞx¼OV+´î?ö\\{ìF¼]Ê¤±î?×ý5<Ú\'µ6G¯î?/·{<ýÇÔ­î?	Tâác<)THÝ«î?êÆPÇ4<·FY&©î?5Àd+æ2<H!­o§î?vaJä¼	Üv¹á¥î?¨Mï;Å3¼U:°~¤î?®é+xS¼ ÃÌ4F£î?XXVxÝÎ¼%"U8¢î?d~ªW<s©LÔU¡î?("^¿ï³¼Í;f î?¹4­j¼¿Úu î?î©m¸ïgc¼/e<²î?QàT=Ü¼Qù}î?Ï>Z~dx¼t_ìèuî?°}ÀJî¼t¥Hî?æU2¼ÉgBVëî?ÓÔ	^Ë<?]ÞOi î?¥M¹Ü2{¼ës¡î?kÀgTýì<2Á0í¡î?UlÖ«áëe<bNÏ6ó¢î?BÏ³/Å¡¼>T\'¤î?47;ñ¶i¼ÎL¥î?ÿ:^¼­Ç#F§î?nWrØPÔ¼íDÙ¨î? [g­<fÙÇªî?´êðÁ/·<Û *Bå¬î?ÿçÅ`¶e¼Dµ2¯î?D_óYö{<6w®±î?=§	¼Æÿ[´î?)l¸©]¼åÅÍ°7·î?Y¹|ù#l¼RÈËDºî?ªùô"CC¼PNÞ½î?Kf×lÊ¼ºÊpñÀî?\'Î+ü¯q<ð£Äî?»s\ná5Òm<##ãcÈî?c"b"Å¼eå]{fÌî?Õ1âã<3-JìÐî?»¼ÓÑ»¼]%>²Õî?Ò1î1Ì<X³0Ùî?³Zsni<¿ýyUkÞî?´Íß¼zóÓ¿kãî?3Ëw<­ÓZèî?úÙÑJ{¼f¶)îî?º®ÜVÙÃU¼ûO¸¢óî?@ö¦=¤¼:Yårùî?4­8ôÖh¼G^ûòvÿî?5Xkâî¼J¡0°ï?ÍÝ_\n×ÿt<ÒÁKï?¬úû½¼	×[Âï?³¯0®ns<RÝï?ý\\2ã<zÐÿ_« ï?¬Y	Ñà<KÑW.ñ\'ï?gN8¯Íc<µçm/ï?hl,kg<iïÜ 7ï?ÒµÌ¼úÃ]U?ï?oúÿ?]­¼|J-Gï?I©u8®\r¼ò\rOï?§=¦£t<¤ûÜXï?"@ ¼Éã`ï?¬ÁÕPZ<2Ûæiï?Kk¬Y:<`´ó!sï?>´!Õ¼_{3|ï?É\rG;¹*¼)¡õFï?Ó:`¶t<ö?ç.ï?qrQìÅ<LÇûQï?ðÓ÷¼Ú¤¢¯¤ï?}t#â®¼ñg-H¯ï? ªA¼Ã<\'Zaîºï?2ë©Ã+<ºk7+Åï?îÑ1©d<@En[vÐï?íã;äº7¼¾­ýÛï?ÍM;w<ØÁçï?Ì`AÁS<ñq+Âóï?      ð?tÓ°Ùï?ùlXµï?Q[Ðï?{Q}<¸rï?ª¹h1Tï?8bunz8ï?áÞõï?·1\nþï?Ë©:7§ñî?"4L¦Þî?-a`Îî?\'*6ÕÚ¿î?OV+´î?)THÝ«î?U:°~¤î?Í;f î?t_ìèuî?ës¡î?ÎL¥î?Û *Bå¬î?åÅÍ°7·î?ð£Äî?]%>²Õî?­ÓZèî?G^ûòvÿî?RÝï?iïÜ 7ï?¤ûÜXï?_{3|ï?Ú¤¢¯¤ï?@En[vÐï?      èB#Køj¬?óÄúPÎ¿Î?ÖRÿB.æ?      8Cþ+eGG@#Køj¼>óÄúPÎ¿.?ÖRÿB.? 8úþB.æ?0gÇWó.=      à¿`UUUUUå¿     à?NUYé?z¤)UUUå¿éEH[Iò¿Ã?&+ ð?      ö?         È¹ò,Ö¿V7($´ú<     ö?         X¿½ÑÕ¿ ÷àØ¥½     `ö?         XEwvÕ¿mP¶Õ¤b#½     @ö?         ø-­Õ¿Õg°äæ¼      ö?         xw_¾Ô¿à>)i½      ö?         `ÂaÔ¿ÌLH/Ø=     àõ?         ¨0Ô¿:íóBÜ<     Àõ?         HiUL¦Ó¿`QÆ± =      õ?         ÝGÓ¿ÅÔMY%=     õ?          áºâèÒ¿Ø+·{&=     `õ?         ÞZÒ¿?°Ï¶Ê=     `õ?         ÞZÒ¿?°Ï¶Ê=     @õ?         xÏûA)Ò¿vÚS($Z½      õ?         iÁÈÑ¿Tçh¼¯½      õ?         ¨««\\gÑ¿ð¨3Æ=     àô?         H®ùÑ¿fZýÄ¨&½     Àô?         sâ$£Ð¿ô~îk½      ô?         Ð´%@Ð¿-ô¸6ð¼      ô?         Ð´%@Ð¿-ô¸6ð¼     ô?         @^m¹Ï¿<«*W\r=     `ô?         `ÜË­ðÎ¿$¯·&+=     @ô?         ð*n\'Î¿ÿ?TO/½      ô?         ÀOk!\\Í¿hÊ»º!=      ô?          Ç÷Ì¿4hOy\'=      ô?          Ç÷Ì¿4hOy\'=     àó?         -tÂË¿·1°N=     Àó?         ÀNÉóÊ¿fÍ?cNº<      ó?         °â¼#Ê¿êÁFÜd%½      ó?         °â¼#Ê¿êÁFÜd%½     ó?         PôZRÉ¿ãÔÁÙÑ*½     `ó?         Ð e È¿	úÛ¿½+=     @ó?         à«Ç¿XJSrÛ+=     @ó?         à«Ç¿XJSrÛ+=      ó?         ÐçÖÆ¿fâ²£jä½      ó?         §p0ÿÅ¿9PC½      ó?         §p0ÿÅ¿9PC½     àò?         °¡ãå&Å¿[Þ ½     Àò?         Ël+MÄ¿<x5aÁ=     Àò?         Ël+MÄ¿<x5aÁ=      ò?          üqÃ¿:T\'Mxñ<     ò?         ðøRÂ¿Äq0$½     `ò?         `/Õ*·Á¿£¤.½     `ò?         `/Õ*·Á¿£¤.½     @ò?         Ð|~×À¿ô[èi\n=     @ò?         Ð|~×À¿ô[èi\n=      ò?         àÛ1ì¿¿ò3£\\Tu%½      ò?          +n\'¾¿< ð*,4*=      ò?          +n\'¾¿< ð*,4*=     àñ?         À[T^¼¿¾_XW½     Àñ?         àJ:mº¿Èª[è59%=     Àñ?         àJ:mº¿Èª[è59%=      ñ?          1ÖEÃ¸¿hV/M)|=      ñ?          1ÖEÃ¸¿hV/M)|=     ñ?         `åÒð¶¿Ús3É7&½     `ñ?          ?µ¿W^Æa[=     `ñ?          ?µ¿W^Æa[=     @ñ?         à×A³¿ßùÌÚ^,=     @ñ?         à×A³¿ßùÌÚ^,=      ñ?         £î6e±¿	£v^|=      ñ?         À0\n¯¿6Y-=      ñ?         À0\n¯¿6Y-=     àð?         qÝB«¿LpÖåz=     àð?         qÝB«¿LpÖåz=     Àð?         À2öXt§¿î¡ò4Fü,½     Àð?         À2öXt§¿î¡ò4Fü,½      ð?         Àþ¹£¿ªþ&õ·õ<      ð?         Àþ¹£¿ªþ&õ·õ<     ð?          x¿ä	~|&)½     ð?          x¿ä	~|&)½     `ð?         Õ¹¿9¦úT(½     @ð?          ü°¨À¿¦Óö|ß¼     @ð?          ü°¨À¿¦Óö|ß¼      ð?          k*à¿ä@Ú\r?â½      ð?          k*à¿ä@Ú\r?â½      ð?                              ð?                             Àï?          u?è+kÇ½     ï?         XV ?Ò÷â[Ü#½     @ï?          É(%I?4Z2º *½      ï?         @ç]A ?S×ñ\\À=     Àî?          .Ô®f¤?(ý½us,½     î?         Àª¨?}&ZÐy½     @î?         ÀÝÍsË¬?(ØGòh½      î?         ÀÀ1ê®?{;ÉO>½     àí?         `FÑ;±?\rV]2%½      í?         àÑ§õ½³?×NÛ¥^È,=     `í?          MZéµ?]<i,½     @í?         Àê\nÓ ·?2í©ì<      í?         @Y]^3¹?ÚG½:\\#=     Àì?         `­Èj»?åh÷+½      ì?         @¼X¼?Ó¬ZÆÑF&=     `ì?          \n9Ç¾?àEæ¯hÀ-½     @ì?         àÛ9è¿?ý\n¡OÖ4%½      ì?         à\'Á?ò-Îxï!=     àë?         ð#~+ªÁ?48D§,=      ë?         aÑÂ?¡´Ël=     ë?         °üeÃ?rK#¨/Æ<     @ë?         °3=Ä?x¶ýTy%=      ë?         °¡äå\'Å?Ç}iåè3&=     àê?         ¾NWÆ?x.<,Ï=     Àê?         puðÆ?á!å%½      ê?         PDÇ?Cpf½     `ê?          9ë¯¾È?Ñ,éªT=½     @ê?          ÷ÜZZÉ?oÿ X(ò=      ê?         à<íÊ?i!VPCr(½     àé?         Ð[WØ1Ë?ªá¬N5½     Àé?         à;8ÐË?¶TYÄK-½      é?         ðÆûoÌ?Ò+Årìñ¼     `é?         Ô°=±Í?5°÷*ÿ*½     @é?         çÿSÎ?0ôA`\'Â<      é?          Ýä­õÎ?»e!Ê¼      é?         °³lÏ?0ßÊìË=     Àè?         XM`8qÐ?NíÛø<      è?         `ag-ÄÐ?éê<\'=     è?         è\'Ñ?ð¥c!,½     `è?         ø¬Ë\\kÑ?¥÷Í+=     @è?         hZc¿Ñ?·½GQí¦,=      è?         ¸mEÒ?êºFºÞ\n=     àç?         Ü|ð¾Ò?ôPJú*=     Àç?         `ÓáñÓ?¸<!Ózâ(½      ç?         ¾vgkÓ?Èwñ°Ín=     ç?         03wRÂÓ?\\½¶T;=     `ç?         èÕ#´Ô?àì6ä=     @ç?         ÈqÂqÔ?uÖg	Î\'/½      ç?         0àÉÔ?¤Ø\n .½      ç?          8®"Õ?YÇdp¾.=     àæ?         ÐÈS÷{Õ?ï@]îí­=     Àæ?         `Yß½ÕÕ?Üe¤*\n½¾óøyìaö?0[ÆþÞ¿=¯Jíqõ?¤üÔ2hÛ¿°ðð9ô?{·\nA×¿¸°Éó?{ÏméÓ¿¥d\ró?1¶òóÐ¿ {"^ò?ðz;|É¿?4JJ»ñ?<¯ãùÂ¿ºåðX#ñ?\\x¿Ë`¹¿§ A?ð?Î_G¶oª¿      ð?        ¬Gý`î?=õ$Ê8³? j³¤ì?º8T©vÄ?æüjW6 ë?ÒäÄJÎ?-ª¡cÑÂé?eÆðEÔ?íAxæè?ø,Ø?bHSõÜgç?Ì{±N¤àÜ?nIÉvÒ?zÆu i×¿Ýº§l\nÇÞ?Èö¾HGç¿+¸*eG÷?           N ë§~ uú ¹,ý·z¼ Ì¢ =I×  *_·úXÙýÊ½áÍÜ@x }gaì å\nÔ Ì>Ov¯  D ® ®` úw!ë+ `A ©£nN                                                        *                    \'9H                                  8R`S  Ê        »Ûë+;PSuccess Illegal byte sequence Domain error Result not representable Not a tty Permission denied Operation not permitted No such file or directory No such process File exists Value too large for defined data type No space left on device Out of memory Resource busy Interrupted system call Resource temporarily unavailable Invalid seek Cross-device link Read-only file system Directory not empty Connection reset by peer Operation timed out Connection refused Host is down Host is unreachable Address in use Broken pipe I/O error No such device or address Block device required No such device Not a directory Is a directory Text file busy Exec format error Invalid argument Argument list too long Symbolic link loop Filename too long Too many open files in system No file descriptors available Bad file descriptor No child process Bad address File too large Too many links No locks available Resource deadlock would occur State not recoverable Owner died Operation canceled Function not implemented No message of desired type Identifier removed Device not a stream No data available Device timeout Out of streams resources Link has been severed Protocol error Bad message File descriptor in bad state Not a socket Destination address required Message too large Protocol wrong type for socket Protocol not available Protocol not supported Socket type not supported Not supported Protocol family not supported Address family not supported by protocol Address not available Network is down Network unreachable Connection reset by network Connection aborted No buffer space available Socket is connected Socket not connected Cannot send after socket shutdown Operation already in progress Operation in progress Stale file handle Remote I/O error Quota exceeded No medium found Wrong medium type Multihop attempted Required key not available Key has expired Key has been revoked Key was rejected by service             	             \n\n\n  	  	                               \r \r   	   	                                               	                                                  	                                                   	                                              	                                                      	                                                   	         0123456789ABCDEF G     ¸@ )   W   X   ÐD Ä@ |E NSt3__217bad_function_callE                    \r                  %   )   +   /   5   ;   =   C   G   I   O   S   Y   a   e   g   k   m   q                        £   §   ­   ³   µ   ¿   Á   Å   Ç   Ó         \r                  %   )   +   /   5   ;   =   C   G   I   O   S   Y   a   e   g   k   m   q   y                           £   §   ©   ­   ³   µ   »   ¿   Á   Å   Ç   Ñ   ÐD lB <F N10__cxxabiv116__shim_type_infoE    ÐD B `B N10__cxxabiv117__class_type_infoE   ÐD ÌB `B N10__cxxabiv117__pbase_type_infoE   ÐD üB ÀB N10__cxxabiv119__pointer_type_infoE ÐD ,C `B N10__cxxabiv120__function_type_infoE    ÐD `C ÀB N10__cxxabiv129__pointer_to_member_type_infoE       ¬C Y   Z   [   \\   ]   ÐD ¸C `B N10__cxxabiv123__fundamental_type_infoE C èC v   C ôC Dn  C  D b   C D c   C D h   C $D a   C 0D s   C <D t   C HD i   C TD j   C `D l   C lD m   C xD x   C D y   C D f   C D d       B Y   ^   [   \\   _   `   a   b       ðD Y   c   [   \\   _   d   e   f   ÐD üD B N10__cxxabiv120__si_class_type_infoE        ðB Y   g   [   \\   h       E    i   j       °E    k   l       |E    m   n   ¨D E St9exception    ÐD  E |E St9bad_alloc    ÐD ¼E E St20bad_array_new_length        ìE    o   p   ÐD øE |E St11logic_error     F    q   p   ÐD (F ìE St12length_error    ¨D DF St9type_info  AØÀ                          P                       Q   R   ØH                           ÿÿÿÿ\n                                                               hF                U                       Q   V   àL                            ÿÿÿÿÿÿÿÿ                                                             G àN  target_features+bulk-memory+bulk-memory-opt+call-indirect-overlong+\nmultivalue+mutable-globals+nontrapping-fptoint+reference-types+sign-ext');
}

function getBinarySync(file) {
  return file;
}

async function getWasmBinary(binaryFile) {

  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(binaryFile)) {
      err(`warning: Loading from a file URI (${binaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  var imports = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    assignWasmExports(wasmExports);

    updateMemoryViews();

    return wasmExports;
  }

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result['instance']);
  }

  var info = getWasmImports();

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {
    return new Promise((resolve, reject) => {
      try {
        Module['instantiateWasm'](info, (inst, mod) => {
          resolve(receiveInstance(inst, mod));
        });
      } catch(e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`);
        reject(e);
      }
    });
  }

  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js

// Begin JS library code


  class ExitStatus {
      name = 'ExitStatus';
      constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }
    }

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);

  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);

  /** @noinline */
  var base64Decode = (b64) => {
  
      assert(b64.length % 4 == 0);
      var b1, b2, i = 0, j = 0, bLength = b64.length;
      var output = new Uint8Array((bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '='));
      for (; i < bLength; i += 4, j += 3) {
        b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
        b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
        output[j] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
        output[j+1] = b1 << 4 | b2 >> 2;
        output[j+2] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
      }
      return output;
    };


  
    /**
   * @param {number} ptr
   * @param {string} type
   */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[ptr];
      case 'i8': return HEAP8[ptr];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP64[((ptr)>>3)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = true;

  var ptrToString = (ptr) => {
      assert(typeof ptr === 'number', `ptrToString expects a number, got ${typeof ptr}`);
      // Convert to 32-bit unsigned value
      ptr >>>= 0;
      return '0x' + ptr.toString(16).padStart(8, '0');
    };

  
    /**
   * @param {number} ptr
   * @param {number} value
   * @param {string} type
   */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[ptr] = value; break;
      case 'i8': HEAP8[ptr] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': HEAP64[((ptr)>>3)] = BigInt(value); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  var stackRestore = (val) => __emscripten_stack_restore(val);

  var stackSave = () => _emscripten_stack_get_current();

  var warnOnce = (text) => {
      warnOnce.shown ||= {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        err(text);
      }
    };

  

  class ExceptionInfo {
      // excPtr - Thrown object pointer to wrap. Metadata pointer is calculated from it.
      constructor(excPtr) {
        this.excPtr = excPtr;
        this.ptr = excPtr - 24;
      }
  
      set_type(type) {
        HEAPU32[(((this.ptr)+(4))>>2)] = type;
      }
  
      get_type() {
        return HEAPU32[(((this.ptr)+(4))>>2)];
      }
  
      set_destructor(destructor) {
        HEAPU32[(((this.ptr)+(8))>>2)] = destructor;
      }
  
      get_destructor() {
        return HEAPU32[(((this.ptr)+(8))>>2)];
      }
  
      set_caught(caught) {
        caught = caught ? 1 : 0;
        HEAP8[(this.ptr)+(12)] = caught;
      }
  
      get_caught() {
        return HEAP8[(this.ptr)+(12)] != 0;
      }
  
      set_rethrown(rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[(this.ptr)+(13)] = rethrown;
      }
  
      get_rethrown() {
        return HEAP8[(this.ptr)+(13)] != 0;
      }
  
      // Initialize native structure fields. Should be called once after allocated.
      init(type, destructor) {
        this.set_adjusted_ptr(0);
        this.set_type(type);
        this.set_destructor(destructor);
      }
  
      set_adjusted_ptr(adjustedPtr) {
        HEAPU32[(((this.ptr)+(16))>>2)] = adjustedPtr;
      }
  
      get_adjusted_ptr() {
        return HEAPU32[(((this.ptr)+(16))>>2)];
      }
    }
  
  var exceptionLast = 0;
  
  var uncaughtExceptionCount = 0;
  var ___cxa_throw = (ptr, type, destructor) => {
      var info = new ExceptionInfo(ptr);
      // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      assert(false, 'Exception thrown, but exception catching is not enabled. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.');
    };

  var __abort_js = () =>
      abort('native code called abort()');

  var AsciiToString = (ptr) => {
      var str = '';
      while (1) {
        var ch = HEAPU8[ptr++];
        if (!ch) return str;
        str += String.fromCharCode(ch);
      }
    };
  
  var awaitingDependencies = {
  };
  
  var registeredTypes = {
  };
  
  var typeDependencies = {
  };
  
  var BindingError =  class BindingError extends Error { constructor(message) { super(message); this.name = 'BindingError'; }};
  var throwBindingError = (message) => { throw new BindingError(message); };
  /** @param {Object=} options */
  function sharedRegisterType(rawType, registeredInstance, options = {}) {
      var name = registeredInstance.name;
      if (!rawType) {
        throwBindingError(`type "${name}" must have a positive integer typeid pointer`);
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError(`Cannot register type '${name}' twice`);
        }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach((cb) => cb());
      }
    }
  /** @param {Object=} options */
  function registerType(rawType, registeredInstance, options = {}) {
      return sharedRegisterType(rawType, registeredInstance, options);
    }
  
  var integerReadValueFromPointer = (name, width, signed) => {
      // integers are quite common, so generate very specialized functions
      switch (width) {
        case 1: return signed ?
          (pointer) => HEAP8[pointer] :
          (pointer) => HEAPU8[pointer];
        case 2: return signed ?
          (pointer) => HEAP16[((pointer)>>1)] :
          (pointer) => HEAPU16[((pointer)>>1)]
        case 4: return signed ?
          (pointer) => HEAP32[((pointer)>>2)] :
          (pointer) => HEAPU32[((pointer)>>2)]
        case 8: return signed ?
          (pointer) => HEAP64[((pointer)>>3)] :
          (pointer) => HEAPU64[((pointer)>>3)]
        default:
          throw new TypeError(`invalid integer width (${width}): ${name}`);
      }
    };
  
  var embindRepr = (v) => {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    };
  
  var assertIntegerRange = (typeName, value, minRange, maxRange) => {
      if (value < minRange || value > maxRange) {
        throw new TypeError(`Passing a number "${embindRepr(value)}" from JS side to C/C++ side to an argument of type "${typeName}", which is outside the valid range [${minRange}, ${maxRange}]!`);
      }
    };
  /** @suppress {globalThis} */
  var __embind_register_bigint = (primitiveType, name, size, minRange, maxRange) => {
      name = AsciiToString(name);
  
      const isUnsignedType = minRange === 0n;
  
      let fromWireType = (value) => value;
      if (isUnsignedType) {
        // uint64 get converted to int64 in ABI, fix them up like we do for 32-bit integers.
        const bitSize = size * 8;
        fromWireType = (value) => {
          return BigInt.asUintN(bitSize, value);
        }
        maxRange = fromWireType(maxRange);
      }
  
      registerType(primitiveType, {
        name,
        fromWireType: fromWireType,
        toWireType: (destructors, value) => {
          if (typeof value == "number") {
            value = BigInt(value);
          }
          else if (typeof value != "bigint") {
            throw new TypeError(`Cannot convert "${embindRepr(value)}" to ${this.name}`);
          }
          assertIntegerRange(name, value, minRange, maxRange);
          return value;
        },
        readValueFromPointer: integerReadValueFromPointer(name, size, !isUnsignedType),
        destructorFunction: null, // This type does not need a destructor
      });
    };

  
  /** @suppress {globalThis} */
  var __embind_register_bool = (rawType, name, trueValue, falseValue) => {
      name = AsciiToString(name);
      registerType(rawType, {
        name,
        fromWireType: function(wt) {
          // ambiguous emscripten ABI: sometimes return values are
          // true or false, and sometimes integers (0 or 1)
          return !!wt;
        },
        toWireType: function(destructors, o) {
          return o ? trueValue : falseValue;
        },
        readValueFromPointer: function(pointer) {
          return this.fromWireType(HEAPU8[pointer]);
        },
        destructorFunction: null, // This type does not need a destructor
      });
    };

  
  
  var shallowCopyInternalPointer = (o) => {
      return {
        count: o.count,
        deleteScheduled: o.deleteScheduled,
        preservePointerOnDelete: o.preservePointerOnDelete,
        ptr: o.ptr,
        ptrType: o.ptrType,
        smartPtr: o.smartPtr,
        smartPtrType: o.smartPtrType,
      };
    };
  
  var throwInstanceAlreadyDeleted = (obj) => {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    };
  
  var finalizationRegistry = false;
  
  var detachFinalizer = (handle) => {};
  
  var runDestructor = ($$) => {
      if ($$.smartPtr) {
        $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
        $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    };
  var releaseClassHandle = ($$) => {
      $$.count.value -= 1;
      var toDelete = 0 === $$.count.value;
      if (toDelete) {
        runDestructor($$);
      }
    };
  
  var downcastPointer = (ptr, ptrClass, desiredClass) => {
      if (ptrClass === desiredClass) {
        return ptr;
      }
      if (undefined === desiredClass.baseClass) {
        return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
        return null;
      }
      return desiredClass.downcast(rv);
    };
  
  var registeredPointers = {
  };
  
  var registeredInstances = {
  };
  
  var getBasestPointer = (class_, ptr) => {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    };
  var getInheritedInstance = (class_, ptr) => {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    };
  
  var InternalError =  class InternalError extends Error { constructor(message) { super(message); this.name = 'InternalError'; }};
  var throwInternalError = (message) => { throw new InternalError(message); };
  
  var makeClassHandle = (prototype, record) => {
      if (!record.ptrType || !record.ptr) {
        throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
        throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return attachFinalizer(Object.create(prototype, {
        $$: {
          value: record,
          writable: true,
        },
      }));
    };
  /** @suppress {globalThis} */
  function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
        this.destructor(ptr);
        return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
        // JS object has been neutered, time to repopulate it
        if (0 === registeredInstance.$$.count.value) {
          registeredInstance.$$.ptr = rawPointer;
          registeredInstance.$$.smartPtr = ptr;
          return registeredInstance['clone']();
        } else {
          // else, just increment reference count on existing object
          // it already has a reference to the smart pointer
          var rv = registeredInstance['clone']();
          this.destructor(ptr);
          return rv;
        }
      }
  
      function makeDefaultHandle() {
        if (this.isSmartPointer) {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this.pointeeType,
            ptr: rawPointer,
            smartPtrType: this,
            smartPtr: ptr,
          });
        } else {
          return makeClassHandle(this.registeredClass.instancePrototype, {
            ptrType: this,
            ptr,
          });
        }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
        return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
        toType = registeredPointerRecord.constPointerType;
      } else {
        toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
        return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp,
          smartPtrType: this,
          smartPtr: ptr,
        });
      } else {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
          ptrType: toType,
          ptr: dp,
        });
      }
    }
  var attachFinalizer = (handle) => {
      if (!globalThis.FinalizationRegistry) {
        attachFinalizer = (handle) => handle;
        return handle;
      }
      // If the running environment has a FinalizationRegistry (see
      // https://github.com/tc39/proposal-weakrefs), then attach finalizers
      // for class handles.  We check for the presence of FinalizationRegistry
      // at run-time, not build-time.
      finalizationRegistry = new FinalizationRegistry((info) => {
        console.warn(info.leakWarning);
        releaseClassHandle(info.$$);
      });
      attachFinalizer = (handle) => {
        var $$ = handle.$$;
        var hasSmartPtr = !!$$.smartPtr;
        if (hasSmartPtr) {
          // We should not call the destructor on raw pointers in case other code expects the pointee to live
          var info = { $$: $$ };
          // Create a warning as an Error instance in advance so that we can store
          // the current stacktrace and point to it when / if a leak is detected.
          // This is more useful than the empty stacktrace of `FinalizationRegistry`
          // callback.
          var cls = $$.ptrType.registeredClass;
          var err = new Error(`Embind found a leaked C++ instance ${cls.name} <${ptrToString($$.ptr)}>.\n` +
          "We'll free it automatically in this case, but this functionality is not reliable across various environments.\n" +
          "Make sure to invoke .delete() manually once you're done with the instance instead.\n" +
          "Originally allocated"); // `.stack` will add "at ..." after this sentence
          if ('captureStackTrace' in Error) {
            Error.captureStackTrace(err, RegisteredPointer_fromWireType);
          }
          info.leakWarning = err.stack.replace(/^Error: /, '');
          finalizationRegistry.register(handle, info, handle);
        }
        return handle;
      };
      detachFinalizer = (handle) => finalizationRegistry.unregister(handle);
      return attachFinalizer(handle);
    };
  
  
  
  
  var deletionQueue = [];
  var flushPendingDeletes = () => {
      while (deletionQueue.length) {
        var obj = deletionQueue.pop();
        obj.$$.deleteScheduled = false;
        obj['delete']();
      }
    };
  
  var delayFunction;
  var init_ClassHandle = () => {
      let proto = ClassHandle.prototype;
  
      Object.assign(proto, {
        "isAliasOf"(other) {
          if (!(this instanceof ClassHandle)) {
            return false;
          }
          if (!(other instanceof ClassHandle)) {
            return false;
          }
  
          var leftClass = this.$$.ptrType.registeredClass;
          var left = this.$$.ptr;
          other.$$ = /** @type {Object} */ (other.$$);
          var rightClass = other.$$.ptrType.registeredClass;
          var right = other.$$.ptr;
  
          while (leftClass.baseClass) {
            left = leftClass.upcast(left);
            leftClass = leftClass.baseClass;
          }
  
          while (rightClass.baseClass) {
            right = rightClass.upcast(right);
            rightClass = rightClass.baseClass;
          }
  
          return leftClass === rightClass && left === right;
        },
  
        "clone"() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
  
          if (this.$$.preservePointerOnDelete) {
            this.$$.count.value += 1;
            return this;
          } else {
            var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
              $$: {
                value: shallowCopyInternalPointer(this.$$),
              }
            }));
  
            clone.$$.count.value += 1;
            clone.$$.deleteScheduled = false;
            return clone;
          }
        },
  
        "delete"() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
  
          if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
            throwBindingError('Object already scheduled for deletion');
          }
  
          detachFinalizer(this);
          releaseClassHandle(this.$$);
  
          if (!this.$$.preservePointerOnDelete) {
            this.$$.smartPtr = undefined;
            this.$$.ptr = undefined;
          }
        },
  
        "isDeleted"() {
          return !this.$$.ptr;
        },
  
        "deleteLater"() {
          if (!this.$$.ptr) {
            throwInstanceAlreadyDeleted(this);
          }
          if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
            throwBindingError('Object already scheduled for deletion');
          }
          deletionQueue.push(this);
          if (deletionQueue.length === 1 && delayFunction) {
            delayFunction(flushPendingDeletes);
          }
          this.$$.deleteScheduled = true;
          return this;
        },
      });
  
      // Support `using ...` from https://github.com/tc39/proposal-explicit-resource-management.
      const symbolDispose = Symbol.dispose;
      if (symbolDispose) {
        proto[symbolDispose] = proto['delete'];
      }
    };
  /** @constructor */
  function ClassHandle() {
    }
  
  var createNamedFunction = (name, func) => Object.defineProperty(func, 'name', { value: name });
  
  
  var ensureOverloadTable = (proto, methodName, humanName) => {
      if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];
        // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
        proto[methodName] = function(...args) {
          // TODO This check can be removed in -O3 level "unsafe" optimizations.
          if (!proto[methodName].overloadTable.hasOwnProperty(args.length)) {
            throwBindingError(`Function '${humanName}' called with an invalid number of arguments (${args.length}) - expects one of (${proto[methodName].overloadTable})!`);
          }
          return proto[methodName].overloadTable[args.length].apply(this, args);
        };
        // Move the previous function into the overload table.
        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    };
  
  /** @param {number=} numArguments */
  var exposePublicSymbol = (name, value, numArguments) => {
      if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
          throwBindingError(`Cannot register public name '${name}' twice`);
        }
  
        // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
        // that routes between the two.
        ensureOverloadTable(Module, name, name);
        if (Module[name].overloadTable.hasOwnProperty(numArguments)) {
          throwBindingError(`Cannot register multiple overloads of a function with the same number of arguments (${numArguments})!`);
        }
        // Add the new function into the overload table.
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        Module[name].argCount = numArguments;
      }
    };
  
  var char_0 = 48;
  
  var char_9 = 57;
  var makeLegalFunctionName = (name) => {
      assert(typeof name === 'string');
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
        return `_${name}`;
      }
      return name;
    };
  
  
  /** @constructor */
  function RegisteredClass(name,
                               constructor,
                               instancePrototype,
                               rawDestructor,
                               baseClass,
                               getActualType,
                               upcast,
                               downcast) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  var upcastPointer = (ptr, ptrClass, desiredClass) => {
      while (ptrClass !== desiredClass) {
        if (!ptrClass.upcast) {
          throwBindingError(`Expected null or instance of ${desiredClass.name}, got an instance of ${ptrClass.name}`);
        }
        ptr = ptrClass.upcast(ptr);
        ptrClass = ptrClass.baseClass;
      }
      return ptr;
    };
  
  /** @suppress {globalThis} */
  function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError(`null is not a valid ${this.name}`);
        }
        return 0;
      }
  
      if (!handle.$$) {
        throwBindingError(`Cannot pass "${embindRepr(handle)}" as a ${this.name}`);
      }
      if (!handle.$$.ptr) {
        throwBindingError(`Cannot pass deleted object as a pointer of type ${this.name}`);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  /** @suppress {globalThis} */
  function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
        if (this.isReference) {
          throwBindingError(`null is not a valid ${this.name}`);
        }
  
        if (this.isSmartPointer) {
          ptr = this.rawConstructor();
          if (destructors !== null) {
            destructors.push(this.rawDestructor, ptr);
          }
          return ptr;
        } else {
          return 0;
        }
      }
  
      if (!handle || !handle.$$) {
        throwBindingError(`Cannot pass "${embindRepr(handle)}" as a ${this.name}`);
      }
      if (!handle.$$.ptr) {
        throwBindingError(`Cannot pass deleted object as a pointer of type ${this.name}`);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
        throwBindingError(`Cannot convert argument of type ${(handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name)} to parameter type ${this.name}`);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
        // TODO: this is not strictly true
        // We could support BY_EMVAL conversions from raw pointers to smart pointers
        // because the smart pointer can hold a reference to the handle
        if (undefined === handle.$$.smartPtr) {
          throwBindingError('Passing raw pointer to smart pointer is illegal');
        }
  
        switch (this.sharingPolicy) {
          case 0: // NONE
            // no upcasting
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              throwBindingError(`Cannot convert argument of type ${(handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name)} to parameter type ${this.name}`);
            }
            break;
  
          case 1: // INTRUSIVE
            ptr = handle.$$.smartPtr;
            break;
  
          case 2: // BY_EMVAL
            if (handle.$$.smartPtrType === this) {
              ptr = handle.$$.smartPtr;
            } else {
              var clonedHandle = handle['clone']();
              ptr = this.rawShare(
                ptr,
                Emval.toHandle(() => clonedHandle['delete']())
              );
              if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
              }
            }
            break;
  
          default:
            throwBindingError('Unsupported sharing policy');
        }
      }
      return ptr;
    }
  
  
  
  /** @suppress {globalThis} */
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
        if (this.isReference) {
          throwBindingError(`null is not a valid ${this.name}`);
        }
        return 0;
      }
  
      if (!handle.$$) {
        throwBindingError(`Cannot pass "${embindRepr(handle)}" as a ${this.name}`);
      }
      if (!handle.$$.ptr) {
        throwBindingError(`Cannot pass deleted object as a pointer of type ${this.name}`);
      }
      if (handle.$$.ptrType.isConst) {
        throwBindingError(`Cannot convert argument of type ${handle.$$.ptrType.name} to parameter type ${this.name}`);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  /** @suppress {globalThis} */
  function readPointer(pointer) {
      return this.fromWireType(HEAPU32[((pointer)>>2)]);
    }
  
  var init_RegisteredPointer = () => {
      Object.assign(RegisteredPointer.prototype, {
        getPointee(ptr) {
          if (this.rawGetPointee) {
            ptr = this.rawGetPointee(ptr);
          }
          return ptr;
        },
        destructor(ptr) {
          this.rawDestructor?.(ptr);
        },
        readValueFromPointer: readPointer,
        fromWireType: RegisteredPointer_fromWireType,
      });
    };
  /** @constructor
    @param {*=} pointeeType,
    @param {*=} sharingPolicy,
    @param {*=} rawGetPointee,
    @param {*=} rawConstructor,
    @param {*=} rawShare,
    @param {*=} rawDestructor,
     */
  function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
        if (isConst) {
          this.toWireType = constNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        } else {
          this.toWireType = nonConstNoSmartPtrRawPointerToWireType;
          this.destructorFunction = null;
        }
      } else {
        this.toWireType = genericPointerToWireType;
        // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
        // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
        // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
        //       craftInvokerFunction altogether.
      }
    }
  
  /** @param {number=} numArguments */
  var replacePublicSymbol = (name, value, numArguments) => {
      if (!Module.hasOwnProperty(name)) {
        throwInternalError('Replacing nonexistent public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value;
      } else {
        Module[name] = value;
        Module[name].argCount = numArguments;
      }
    };
  
  
  
  var wasmTableMirror = [];
  
  
  var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        /** @suppress {checkTypes} */
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      /** @suppress {checkTypes} */
      assert(wasmTable.get(funcPtr) == func, 'JavaScript-side Wasm function table mirror is out of date!');
      return func;
    };
  var embind__requireFunction = (signature, rawFunction, isAsync = false) => {
      assert(!isAsync, 'Async bindings are only supported with JSPI.');
  
      signature = AsciiToString(signature);
  
      function makeDynCaller() {
        var rtn = getWasmTableEntry(rawFunction);
        return rtn;
      }
  
      var fp = makeDynCaller();
      if (typeof fp != 'function') {
          throwBindingError(`unknown function pointer with signature ${signature}: ${rawFunction}`);
      }
      return fp;
    };
  
  
  
  class UnboundTypeError extends Error {}
  
  
  
  var getTypeName = (type) => {
      var ptr = ___getTypeName(type);
      var rv = AsciiToString(ptr);
      _free(ptr);
      return rv;
    };
  var throwUnboundTypeError = (message, types) => {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
        if (seen[type]) {
          return;
        }
        if (registeredTypes[type]) {
          return;
        }
        if (typeDependencies[type]) {
          typeDependencies[type].forEach(visit);
          return;
        }
        unboundTypes.push(type);
        seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(`${message}: ` + unboundTypes.map(getTypeName).join([', ']));
    };
  
  
  
  
  var whenDependentTypesAreResolved = (myTypes, dependentTypes, getTypeConverters) => {
      myTypes.forEach((type) => typeDependencies[type] = dependentTypes);
  
      function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);
        if (myTypeConverters.length !== myTypes.length) {
          throwInternalError('Mismatched type converter count');
        }
        for (var i = 0; i < myTypes.length; ++i) {
          registerType(myTypes[i], myTypeConverters[i]);
        }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      for (let [i, dt] of dependentTypes.entries()) {
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i] = registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt);
          if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt] = [];
          }
          awaitingDependencies[dt].push(() => {
            typeConverters[i] = registeredTypes[dt];
            ++registered;
            if (registered === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      }
      if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    };
  var __embind_register_class = (rawType,
                             rawPointerType,
                             rawConstPointerType,
                             baseClassRawType,
                             getActualTypeSignature,
                             getActualType,
                             upcastSignature,
                             upcast,
                             downcastSignature,
                             downcast,
                             name,
                             destructorSignature,
                             rawDestructor) => {
      name = AsciiToString(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      upcast &&= embind__requireFunction(upcastSignature, upcast);
      downcast &&= embind__requireFunction(downcastSignature, downcast);
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
        // this code cannot run if baseClassRawType is zero
        throwUnboundTypeError(`Cannot construct ${name} due to unbound types`, [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
        [rawType, rawPointerType, rawConstPointerType],
        baseClassRawType ? [baseClassRawType] : [],
        (base) => {
          base = base[0];
  
          var baseClass;
          var basePrototype;
          if (baseClassRawType) {
            baseClass = base.registeredClass;
            basePrototype = baseClass.instancePrototype;
          } else {
            basePrototype = ClassHandle.prototype;
          }
  
          var constructor = createNamedFunction(name, function(...args) {
            if (Object.getPrototypeOf(this) !== instancePrototype) {
              throw new BindingError(`Use 'new' to construct ${name}`);
            }
            if (undefined === registeredClass.constructor_body) {
              throw new BindingError(`${name} has no accessible constructor`);
            }
            var body = registeredClass.constructor_body[args.length];
            if (undefined === body) {
              throw new BindingError(`Tried to invoke ctor of ${name} with invalid number of parameters (${args.length}) - expected (${Object.keys(registeredClass.constructor_body).toString()}) parameters instead!`);
            }
            return body.apply(this, args);
          });
  
          var instancePrototype = Object.create(basePrototype, {
            constructor: { value: constructor },
          });
  
          constructor.prototype = instancePrototype;
  
          var registeredClass = new RegisteredClass(name,
                                                    constructor,
                                                    instancePrototype,
                                                    rawDestructor,
                                                    baseClass,
                                                    getActualType,
                                                    upcast,
                                                    downcast);
  
          if (registeredClass.baseClass) {
            // Keep track of class hierarchy. Used to allow sub-classes to inherit class functions.
            registeredClass.baseClass.__derivedClasses ??= [];
  
            registeredClass.baseClass.__derivedClasses.push(registeredClass);
          }
  
          var referenceConverter = new RegisteredPointer(name,
                                                         registeredClass,
                                                         true,
                                                         false,
                                                         false);
  
          var pointerConverter = new RegisteredPointer(name + '*',
                                                       registeredClass,
                                                       false,
                                                       false,
                                                       false);
  
          var constPointerConverter = new RegisteredPointer(name + ' const*',
                                                            registeredClass,
                                                            false,
                                                            true,
                                                            false);
  
          registeredPointers[rawType] = {
            pointerType: pointerConverter,
            constPointerType: constPointerConverter
          };
  
          replacePublicSymbol(legalFunctionName, constructor);
  
          return [referenceConverter, pointerConverter, constPointerConverter];
        }
      );
    };

  var heap32VectorToArray = (count, firstElement) => {
      var array = [];
      for (var i = 0; i < count; i++) {
        // TODO(https://github.com/emscripten-core/emscripten/issues/17310):
        // Find a way to hoist the `>> 2` or `>> 3` out of this loop.
        array.push(HEAPU32[(((firstElement)+(i * 4))>>2)]);
      }
      return array;
    };
  
  
  
  
  var runDestructors = (destructors) => {
      while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr);
      }
    };
  
  
  function usesDestructorStack(argTypes) {
      // Skip return value at index 0 - it's not deleted here.
      for (var i = 1; i < argTypes.length; ++i) {
        // The type does not define a destructor function - must use dynamic stack
        if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
          return true;
        }
      }
      return false;
    }
  
  
  function checkArgCount(numArgs, minArgs, maxArgs, humanName, throwBindingError) {
      if (numArgs < minArgs || numArgs > maxArgs) {
        var argCountMessage = minArgs == maxArgs ? minArgs : `${minArgs} to ${maxArgs}`;
        throwBindingError(`function ${humanName} called with ${numArgs} arguments, expected ${argCountMessage}`);
      }
    }
  function createJsInvoker(argTypes, isClassMethodFunc, returns, isAsync) {
      var needsDestructorStack = usesDestructorStack(argTypes);
      var argCount = argTypes.length - 2;
      var argsList = [];
      var argsListWired = ['fn'];
      if (isClassMethodFunc) {
        argsListWired.push('thisWired');
      }
      for (var i = 0; i < argCount; ++i) {
        argsList.push(`arg${i}`)
        argsListWired.push(`arg${i}Wired`)
      }
      argsList = argsList.join(',')
      argsListWired = argsListWired.join(',')
  
      var invokerFnBody = `return function (${argsList}) {\n`;
  
      invokerFnBody += "checkArgCount(arguments.length, minArgs, maxArgs, humanName, throwBindingError);\n";
  
      if (needsDestructorStack) {
        invokerFnBody += "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["humanName", "throwBindingError", "invoker", "fn", "runDestructors", "fromRetWire", "toClassParamWire"];
  
      if (isClassMethodFunc) {
        invokerFnBody += `var thisWired = toClassParamWire(${dtorStack}, this);\n`;
      }
  
      for (var i = 0; i < argCount; ++i) {
        var argName = `toArg${i}Wire`;
        invokerFnBody += `var arg${i}Wired = ${argName}(${dtorStack}, arg${i});\n`;
        args1.push(argName);
      }
  
      invokerFnBody += (returns || isAsync ? "var rv = ":"") + `invoker(${argsListWired});\n`;
  
      var returnVal = returns ? "rv" : "";
  
      if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n";
      } else {
        for (var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
          var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
          if (argTypes[i].destructorFunction !== null) {
            invokerFnBody += `${paramName}_dtor(${paramName});\n`;
            args1.push(`${paramName}_dtor`);
          }
        }
      }
  
      if (returns) {
        invokerFnBody += "var ret = fromRetWire(rv);\n" +
                         "return ret;\n";
      } else {
      }
  
      invokerFnBody += "}\n";
  
      args1.push('checkArgCount', 'minArgs', 'maxArgs');
      invokerFnBody = `if (arguments.length !== ${args1.length}){ throw new Error(humanName + "Expected ${args1.length} closure arguments " + arguments.length + " given."); }\n${invokerFnBody}`;
      return new Function(args1, invokerFnBody);
    }
  
  function getRequiredArgCount(argTypes) {
      var requiredArgCount = argTypes.length - 2;
      for (var i = argTypes.length - 1; i >= 2; --i) {
        if (!argTypes[i].optional) {
          break;
        }
        requiredArgCount--;
      }
      return requiredArgCount;
    }
  
  function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc, /** boolean= */ isAsync) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      // isAsync: Optional. If true, returns an async function. Async bindings are only supported with JSPI.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      assert(!isAsync, 'Async bindings are only supported with JSPI.');
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
      // TODO: This omits argument count check - enable only at -O3 or similar.
      //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
      //       return FUNCTION_TABLE[fn];
      //    }
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = usesDestructorStack(argTypes);
  
      var returns = !argTypes[0].isVoid;
  
      var expectedArgCount = argCount - 2;
      var minArgs = getRequiredArgCount(argTypes);
      // Build the arguments that will be passed into the closure around the invoker
      // function.
      var retType = argTypes[0];
      var instType = argTypes[1];
      var closureArgs = [humanName, throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, retType.fromWireType.bind(retType), instType?.toWireType.bind(instType)];
      for (var i = 2; i < argCount; ++i) {
        var argType = argTypes[i];
        closureArgs.push(argType.toWireType.bind(argType));
      }
      if (!needsDestructorStack) {
        // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
        for (var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) {
          if (argTypes[i].destructorFunction !== null) {
            closureArgs.push(argTypes[i].destructorFunction);
          }
        }
      }
      closureArgs.push(checkArgCount, minArgs, expectedArgCount);
  
      let invokerFactory = createJsInvoker(argTypes, isClassMethodFunc, returns, isAsync);
      var invokerFn = invokerFactory(...closureArgs);
      return createNamedFunction(humanName, invokerFn);
    }
  var __embind_register_class_constructor = (
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) => {
      assert(argCount > 0);
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
      var args = [rawConstructor];
      var destructors = [];
  
      whenDependentTypesAreResolved([], [rawClassType], (classType) => {
        classType = classType[0];
        var humanName = `constructor ${classType.name}`;
  
        if (undefined === classType.registeredClass.constructor_body) {
          classType.registeredClass.constructor_body = [];
        }
        if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
          throw new BindingError(`Cannot register multiple constructors with identical number of parameters (${argCount-1}) for class '${classType.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);
        }
        classType.registeredClass.constructor_body[argCount - 1] = () => {
          throwUnboundTypeError(`Cannot construct ${classType.name} due to unbound types`, rawArgTypes);
        };
  
        whenDependentTypesAreResolved([], rawArgTypes, (argTypes) => {
          // Insert empty slot for context type (argTypes[1]).
          argTypes.splice(1, 0, null);
          classType.registeredClass.constructor_body[argCount - 1] = craftInvokerFunction(humanName, argTypes, null, invoker, rawConstructor);
          return [];
        });
        return [];
      });
    };

  
  
  
  
  
  
  var getFunctionName = (signature) => {
      signature = signature.trim();
      const argsIndex = signature.indexOf("(");
      if (argsIndex === -1) return signature;
      assert(signature.endsWith(")"), "Parentheses for argument names should match.");
      return signature.slice(0, argsIndex);
    };
  var __embind_register_class_function = (rawClassType,
                                      methodName,
                                      argCount,
                                      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
                                      invokerSignature,
                                      rawInvoker,
                                      context,
                                      isPureVirtual,
                                      isAsync,
                                      isNonnullReturn) => {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = AsciiToString(methodName);
      methodName = getFunctionName(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker, isAsync);
  
      whenDependentTypesAreResolved([], [rawClassType], (classType) => {
        classType = classType[0];
        var humanName = `${classType.name}.${methodName}`;
  
        if (methodName.startsWith("@@")) {
          methodName = Symbol[methodName.substring(2)];
        }
  
        if (isPureVirtual) {
          classType.registeredClass.pureVirtualFunctions.push(methodName);
        }
  
        function unboundTypesHandler() {
          throwUnboundTypeError(`Cannot call ${humanName} due to unbound types`, rawArgTypes);
        }
  
        var proto = classType.registeredClass.instancePrototype;
        var method = proto[methodName];
        if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
          // This is the first overload to be registered, OR we are replacing a
          // function in the base class with a function in the derived class.
          unboundTypesHandler.argCount = argCount - 2;
          unboundTypesHandler.className = classType.name;
          proto[methodName] = unboundTypesHandler;
        } else {
          // There was an existing function with the same name registered. Set up
          // a function overload routing table.
          ensureOverloadTable(proto, methodName, humanName);
          proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
        }
  
        whenDependentTypesAreResolved([], rawArgTypes, (argTypes) => {
          var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context, isAsync);
  
          // Replace the initial unbound-handler-stub function with the
          // appropriate member function, now that all types are resolved. If
          // multiple overloads are registered for this function, the function
          // goes into an overload table.
          if (undefined === proto[methodName].overloadTable) {
            // Set argCount in case an overload is registered later
            memberFunction.argCount = argCount - 2;
            proto[methodName] = memberFunction;
          } else {
            proto[methodName].overloadTable[argCount - 2] = memberFunction;
          }
  
          return [];
        });
        return [];
      });
    };

  
  var emval_freelist = [];
  
  var emval_handles = [0,1,,1,null,1,true,1,false,1];
  var __emval_decref = (handle) => {
      if (handle > 9 && 0 === --emval_handles[handle + 1]) {
        assert(emval_handles[handle] !== undefined, `Decref for unallocated handle.`);
        emval_handles[handle] = undefined;
        emval_freelist.push(handle);
      }
    };
  
  
  
  var Emval = {
  toValue:(handle) => {
        if (!handle) {
            throwBindingError(`Cannot use deleted val. handle = ${handle}`);
        }
        // handle 2 is supposed to be `undefined`.
        assert(handle === 2 || emval_handles[handle] !== undefined && handle % 2 === 0, `invalid handle: ${handle}`);
        return emval_handles[handle];
      },
  toHandle:(value) => {
        switch (value) {
          case undefined: return 2;
          case null: return 4;
          case true: return 6;
          case false: return 8;
          default:{
            const handle = emval_freelist.pop() || emval_handles.length;
            emval_handles[handle] = value;
            emval_handles[handle + 1] = 1;
            return handle;
          }
        }
      },
  };
  
  var EmValType = {
      name: 'emscripten::val',
      fromWireType: (handle) => {
        var rv = Emval.toValue(handle);
        __emval_decref(handle);
        return rv;
      },
      toWireType: (destructors, value) => Emval.toHandle(value),
      readValueFromPointer: readPointer,
      destructorFunction: null, // This type does not need a destructor
  
      // TODO: do we need a deleteObject here?  write a test where
      // emval is passed into JS via an interface
    };
  var __embind_register_emval = (rawType) => registerType(rawType, EmValType);

  var floatReadValueFromPointer = (name, width) => {
      switch (width) {
        case 4: return function(pointer) {
          return this.fromWireType(HEAPF32[((pointer)>>2)]);
        };
        case 8: return function(pointer) {
          return this.fromWireType(HEAPF64[((pointer)>>3)]);
        };
        default:
          throw new TypeError(`invalid float width (${width}): ${name}`);
      }
    };
  
  
  
  var __embind_register_float = (rawType, name, size) => {
      name = AsciiToString(name);
      registerType(rawType, {
        name,
        fromWireType: (value) => value,
        toWireType: (destructors, value) => {
          if (typeof value != "number" && typeof value != "boolean") {
            throw new TypeError(`Cannot convert ${embindRepr(value)} to ${this.name}`);
          }
          // The VM will perform JS to Wasm value conversion, according to the spec:
          // https://www.w3.org/TR/wasm-js-api-1/#towebassemblyvalue
          return value;
        },
        readValueFromPointer: floatReadValueFromPointer(name, size),
        destructorFunction: null, // This type does not need a destructor
      });
    };

  
  
  
  
  /** @suppress {globalThis} */
  var __embind_register_integer = (primitiveType, name, size, minRange, maxRange) => {
      name = AsciiToString(name);
  
      const isUnsignedType = minRange === 0;
  
      let fromWireType = (value) => value;
      if (isUnsignedType) {
        var bitshift = 32 - 8*size;
        fromWireType = (value) => (value << bitshift) >>> bitshift;
        maxRange = fromWireType(maxRange);
      }
  
      registerType(primitiveType, {
        name,
        fromWireType: fromWireType,
        toWireType: (destructors, value) => {
          if (typeof value != "number" && typeof value != "boolean") {
            throw new TypeError(`Cannot convert "${embindRepr(value)}" to ${name}`);
          }
          assertIntegerRange(name, value, minRange, maxRange);
          // The VM will perform JS to Wasm value conversion, according to the spec:
          // https://www.w3.org/TR/wasm-js-api-1/#towebassemblyvalue
          return value;
        },
        readValueFromPointer: integerReadValueFromPointer(name, size, minRange !== 0),
        destructorFunction: null, // This type does not need a destructor
      });
    };

  
  var __embind_register_memory_view = (rawType, dataTypeIndex, name) => {
      var typeMapping = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
        BigInt64Array,
        BigUint64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
        var size = HEAPU32[((handle)>>2)];
        var data = HEAPU32[(((handle)+(4))>>2)];
        return new TA(HEAP8.buffer, data, size);
      }
  
      name = AsciiToString(name);
      registerType(rawType, {
        name,
        fromWireType: decodeMemoryView,
        readValueFromPointer: decodeMemoryView,
      }, {
        ignoreDuplicateRegistrations: true,
      });
    };

  
  
  
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.codePointAt(i);
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce('Invalid Unicode code point ' + ptrToString(u) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
          // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
          // We need to manually skip over the second code unit for correct iteration.
          i++;
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  
  
  var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();
  
  var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
      var maxIdx = idx + maxBytesToRead;
      if (ignoreNul) return maxIdx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.
      // As a tiny code save trick, compare idx against maxIdx using a negation,
      // so that maxBytesToRead=undefined/NaN means Infinity.
      while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
      return idx;
    };
  
  
    /**
   * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
   * array that contains uint8 values, returns a copy of that string as a
   * Javascript String object.
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number=} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  
      var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  
      // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte ' + ptrToString(u0) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
    /**
   * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
   * emscripten HEAP, returns a copy of that string as a Javascript String object.
   *
   * @param {number} ptr
   * @param {number=} maxBytesToRead - An optional length that specifies the
   *   maximum number of bytes to read. You can omit this parameter to scan the
   *   string until the first 0 byte. If maxBytesToRead is passed, and the string
   *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
   *   string will cut short at that byte index.
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`);
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : '';
    };
  var __embind_register_std_string = (rawType, name) => {
      name = AsciiToString(name);
      var stdStringIsUTF8 = true;
  
      registerType(rawType, {
        name,
        // For some method names we use string keys here since they are part of
        // the public/external API and/or used by the runtime-generated code.
        fromWireType(value) {
          var length = HEAPU32[((value)>>2)];
          var payload = value + 4;
  
          var str;
          if (stdStringIsUTF8) {
            str = UTF8ToString(payload, length, true);
          } else {
            str = '';
            for (var i = 0; i < length; ++i) {
              str += String.fromCharCode(HEAPU8[payload + i]);
            }
          }
  
          _free(value);
  
          return str;
        },
        toWireType(destructors, value) {
          if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
          }
  
          var length;
          var valueIsOfTypeString = (typeof value == 'string');
  
          // We accept `string` or array views with single byte elements
          if (!(valueIsOfTypeString || (ArrayBuffer.isView(value) && value.BYTES_PER_ELEMENT == 1))) {
            throwBindingError('Cannot pass non-string to std::string');
          }
          if (stdStringIsUTF8 && valueIsOfTypeString) {
            length = lengthBytesUTF8(value);
          } else {
            length = value.length;
          }
  
          // assumes POINTER_SIZE alignment
          var base = _malloc(4 + length + 1);
          var ptr = base + 4;
          HEAPU32[((base)>>2)] = length;
          if (valueIsOfTypeString) {
            if (stdStringIsUTF8) {
              stringToUTF8(value, ptr, length + 1);
            } else {
              for (var i = 0; i < length; ++i) {
                var charCode = value.charCodeAt(i);
                if (charCode > 255) {
                  _free(base);
                  throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                }
                HEAPU8[ptr + i] = charCode;
              }
            }
          } else {
            HEAPU8.set(value, ptr);
          }
  
          if (destructors !== null) {
            destructors.push(_free, base);
          }
          return base;
        },
        readValueFromPointer: readPointer,
        destructorFunction(ptr) {
          _free(ptr);
        },
      });
    };

  
  
  
  var UTF16Decoder = globalThis.TextDecoder ? new TextDecoder('utf-16le') : undefined;;
  
  var UTF16ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
      var idx = ((ptr)>>1);
      var endIdx = findStringEnd(HEAPU16, idx, maxBytesToRead / 2, ignoreNul);
  
      // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
      if (endIdx - idx > 16 && UTF16Decoder)
        return UTF16Decoder.decode(HEAPU16.subarray(idx, endIdx));
  
      // Fallback: decode without UTF16Decoder
      var str = '';
  
      // If maxBytesToRead is not passed explicitly, it will be undefined, and the
      // for-loop's condition will always evaluate to true. The loop is then
      // terminated on the first null char.
      for (var i = idx; i < endIdx; ++i) {
        var codeUnit = HEAPU16[i];
        // fromCharCode constructs a character from a UTF-16 code unit, so we can
        // pass the UTF16 string right through.
        str += String.fromCharCode(codeUnit);
      }
  
      return str;
    };
  
  var stringToUTF16 = (str, outPtr, maxBytesToWrite) => {
      assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
      maxBytesToWrite ??= 0x7FFFFFFF;
      if (maxBytesToWrite < 2) return 0;
      maxBytesToWrite -= 2; // Null terminator.
      var startPtr = outPtr;
      var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
      for (var i = 0; i < numCharsToWrite; ++i) {
        // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
        var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
        HEAP16[((outPtr)>>1)] = codeUnit;
        outPtr += 2;
      }
      // Null-terminate the pointer to the HEAP.
      HEAP16[((outPtr)>>1)] = 0;
      return outPtr - startPtr;
    };
  
  var lengthBytesUTF16 = (str) => str.length*2;
  
  var UTF32ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
      var str = '';
      var startIdx = ((ptr)>>2);
      // If maxBytesToRead is not passed explicitly, it will be undefined, and this
      // will always evaluate to true. This saves on code size.
      for (var i = 0; !(i >= maxBytesToRead / 4); i++) {
        var utf32 = HEAPU32[startIdx + i];
        if (!utf32 && !ignoreNul) break;
        str += String.fromCodePoint(utf32);
      }
      return str;
    };
  
  var stringToUTF32 = (str, outPtr, maxBytesToWrite) => {
      assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
      maxBytesToWrite ??= 0x7FFFFFFF;
      if (maxBytesToWrite < 4) return 0;
      var startPtr = outPtr;
      var endPtr = startPtr + maxBytesToWrite - 4;
      for (var i = 0; i < str.length; ++i) {
        var codePoint = str.codePointAt(i);
        // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
        // We need to manually skip over the second code unit for correct iteration.
        if (codePoint > 0xFFFF) {
          i++;
        }
        HEAP32[((outPtr)>>2)] = codePoint;
        outPtr += 4;
        if (outPtr + 4 > endPtr) break;
      }
      // Null-terminate the pointer to the HEAP.
      HEAP32[((outPtr)>>2)] = 0;
      return outPtr - startPtr;
    };
  
  var lengthBytesUTF32 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var codePoint = str.codePointAt(i);
        // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
        // We need to manually skip over the second code unit for correct iteration.
        if (codePoint > 0xFFFF) {
          i++;
        }
        len += 4;
      }
  
      return len;
    };
  var __embind_register_std_wstring = (rawType, charSize, name) => {
      name = AsciiToString(name);
      var decodeString, encodeString, lengthBytesUTF;
      if (charSize === 2) {
        decodeString = UTF16ToString;
        encodeString = stringToUTF16;
        lengthBytesUTF = lengthBytesUTF16;
      } else {
        assert(charSize === 4, 'only 2-byte and 4-byte strings are currently supported');
        decodeString = UTF32ToString;
        encodeString = stringToUTF32;
        lengthBytesUTF = lengthBytesUTF32;
      }
      registerType(rawType, {
        name,
        fromWireType: (value) => {
          // Code mostly taken from _embind_register_std_string fromWireType
          var length = HEAPU32[((value)>>2)];
          var str = decodeString(value + 4, length * charSize, true);
  
          _free(value);
  
          return str;
        },
        toWireType: (destructors, value) => {
          if (!(typeof value == 'string')) {
            throwBindingError(`Cannot pass non-string to C++ string type ${name}`);
          }
  
          // assumes POINTER_SIZE alignment
          var length = lengthBytesUTF(value);
          var ptr = _malloc(4 + length + charSize);
          HEAPU32[((ptr)>>2)] = length / charSize;
  
          encodeString(value, ptr + 4, length + charSize);
  
          if (destructors !== null) {
            destructors.push(_free, ptr);
          }
          return ptr;
        },
        readValueFromPointer: readPointer,
        destructorFunction(ptr) {
          _free(ptr);
        }
      });
    };

  
  var __embind_register_void = (rawType, name) => {
      name = AsciiToString(name);
      registerType(rawType, {
        isVoid: true, // void return values can be optimized out sometimes
        name,
        fromWireType: () => undefined,
        // TODO: assert if anything else is given?
        toWireType: (destructors, o) => undefined,
      });
    };

  var _emscripten_get_now = () => performance.now();

  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var alignMemory = (size, alignment) => {
      assert(alignment, "alignment argument is required");
      return Math.ceil(size / alignment) * alignment;
    };
  
  var growMemory = (size) => {
      var oldHeapSize = wasmMemory.buffer.byteLength;
      var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${oldHeapSize} bytes to ${size} bytes, but got error: ${e}`);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    };
  var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = HEAPU8.length;
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0;
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
        return false;
      }
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = growMemory(newSize);
        if (replacement) {
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  var SYSCALLS = {
  varargs:undefined,
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  };
  var _fd_close = (fd) => {
      abort('fd_close called without SYSCALLS_REQUIRE_FILESYSTEM');
    };

  var INT53_MAX = 9007199254740992;
  
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
  
  
      return 70;
    ;
  }

  var printCharBuffers = [null,[],[]];
  
  var printChar = (stream, curr) => {
      var buffer = printCharBuffers[stream];
      assert(buffer);
      if (curr === 0 || curr === 10) {
        (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
        buffer.length = 0;
      } else {
        buffer.push(curr);
      }
    };
  
  var flush_NO_FILESYSTEM = () => {
      // flush anything remaining in the buffers during shutdown
      _fflush(0);
      if (printCharBuffers[1].length) printChar(1, 10);
      if (printCharBuffers[2].length) printChar(2, 10);
    };
  
  
  var _fd_write = (fd, iov, iovcnt, pnum) => {
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        for (var j = 0; j < len; j++) {
          printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    };

  var getCFunc = (ident) => {
      var func = Module['_' + ident]; // closure exported function
      assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
      return func;
    };
  
  var writeArrayToMemory = (array, buffer) => {
      assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
      HEAP8.set(array, buffer);
    };
  
  
  
  var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
  var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    };
  
  
  
  
  
    /**
   * @param {string|null=} returnType
   * @param {Array=} argTypes
   * @param {Array=} args
   * @param {Object=} opts
   */
  var ccall = (ident, returnType, argTypes, args, opts) => {
      // For fast lookup of conversion functions
      var toC = {
        'string': (str) => {
          var ret = 0;
          if (str !== null && str !== undefined && str !== 0) { // null string
            ret = stringToUTF8OnStack(str);
          }
          return ret;
        },
        'array': (arr) => {
          var ret = stackAlloc(arr.length);
          writeArrayToMemory(arr, ret);
          return ret;
        }
      };
  
      function convertReturnValue(ret) {
        if (returnType === 'string') {
          return UTF8ToString(ret);
        }
        if (returnType === 'boolean') return Boolean(ret);
        return ret;
      }
  
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      assert(returnType !== 'array', 'Return type should not be "array".');
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func(...cArgs);
      function onDone(ret) {
        if (stack !== 0) stackRestore(stack);
        return convertReturnValue(ret);
      }
  
      ret = onDone(ret);
      return ret;
    };

  
    /**
   * @param {string=} returnType
   * @param {Array=} argTypes
   * @param {Object=} opts
   */
  var cwrap = (ident, returnType, argTypes, opts) => {
      return (...args) => ccall(ident, returnType, argTypes, args, opts);
    };

    // Precreate a reverse lookup table from chars
    // "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" back to
    // bytes to make decoding fast.
    for (var base64ReverseLookup = new Uint8Array(123/*'z'+1*/), i = 25; i >= 0; --i) {
      base64ReverseLookup[48+i] = 52+i; // '0-9'
      base64ReverseLookup[65+i] = i; // 'A-Z'
      base64ReverseLookup[97+i] = 26+i; // 'a-z'
    }
    base64ReverseLookup[43] = 62; // '+'
    base64ReverseLookup[47] = 63; // '/'
  ;
init_ClassHandle();
init_RegisteredPointer();
assert(emval_handles.length === 5 * 2);
// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{

  // Begin ATMODULES hooks
  if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
if (Module['print']) out = Module['print'];
if (Module['printErr']) err = Module['printErr'];
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];

Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

  // End ATMODULES hooks

  checkIncomingModuleAPI();

  if (Module['arguments']) arguments_ = Module['arguments'];
  if (Module['thisProgram']) thisProgram = Module['thisProgram'];

  // Assertions on removed incoming Module JS APIs.
  assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['read'] == 'undefined', 'Module.read option was removed');
  assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
  assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
  assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
  assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
  assert(typeof Module['ENVIRONMENT'] == 'undefined', 'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
  assert(typeof Module['STACK_SIZE'] == 'undefined', 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(typeof Module['wasmMemory'] == 'undefined', 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
  assert(typeof Module['INITIAL_MEMORY'] == 'undefined', 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

  if (Module['preInit']) {
    if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
    while (Module['preInit'].length > 0) {
      Module['preInit'].shift()();
    }
  }
  consumedModuleProp('preInit');
}

// Begin runtime exports
  Module['ccall'] = ccall;
  Module['cwrap'] = cwrap;
  var missingLibrarySymbols = [
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'convertU32PairToI53',
  'getTempRet0',
  'setTempRet0',
  'zeroMemory',
  'exitJS',
  'withStackSave',
  'strError',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'readEmAsmArgs',
  'jstoi_q',
  'getExecutableName',
  'autoResumeAudioContext',
  'getDynCaller',
  'dynCall',
  'handleException',
  'keepRuntimeAlive',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'asyncLoad',
  'asmjsMangle',
  'mmapAlloc',
  'HandleAllocator',
  'getUniqueRunDependency',
  'addRunDependency',
  'removeRunDependency',
  'addOnInit',
  'addOnPostCtor',
  'addOnPreMain',
  'addOnExit',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'convertJsFunctionToWasm',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'addFunction',
  'removeFunction',
  'intArrayFromString',
  'intArrayToString',
  'stringToAscii',
  'stringToNewUTF8',
  'registerKeyEventCallback',
  'maybeCStringToJsString',
  'findEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'jsStackTrace',
  'getCallstack',
  'convertPCtoSourceLocation',
  'getEnvStrings',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'initRandomFill',
  'randomFill',
  'safeSetTimeout',
  'setImmediateWrapped',
  'safeRequestAnimationFrame',
  'clearImmediateWrapped',
  'registerPostMainLoop',
  'registerPreMainLoop',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'findMatchingCatch',
  'Browser_asyncPrepareDataCounter',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_createPreloadedFile',
  'FS_preloadFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_stdin_getChar',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'toTypedArrayIndex',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'webgl_enable_EXT_polygon_offset_clamp',
  'webgl_enable_EXT_clip_control',
  'webgl_enable_WEBGL_polygon_mode',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'demangle',
  'stackTrace',
  'getNativeTypeSize',
  'getFunctionArgsName',
  'requireRegisteredType',
  'createJsInvokerSignature',
  'getEnumValueType',
  'PureVirtualError',
  'registerInheritedInstance',
  'unregisterInheritedInstance',
  'getInheritedInstanceCount',
  'getLiveInheritedInstances',
  'enumReadValueFromPointer',
  'installIndexedIterator',
  'setDelayFunction',
  'validateThis',
  'count_emval_handles',
  'getStringOrSymbol',
  'emval_returnValue',
  'emval_lookupTypes',
  'emval_addMethodCaller',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

  var unexportedSymbols = [
  'run',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmExports',
  'HEAPF64',
  'HEAP8',
  'HEAPU8',
  'HEAP16',
  'HEAPU16',
  'HEAP32',
  'HEAPU32',
  'HEAP64',
  'HEAPU64',
  'writeStackCookie',
  'checkStackCookie',
  'INT53_MAX',
  'INT53_MIN',
  'bigintToI53Checked',
  'stackSave',
  'stackRestore',
  'stackAlloc',
  'createNamedFunction',
  'ptrToString',
  'getHeapMax',
  'growMemory',
  'ENV',
  'ERRNO_CODES',
  'DNS',
  'Protocols',
  'Sockets',
  'timers',
  'warnOnce',
  'readEmAsmArgsArray',
  'alignMemory',
  'wasmTable',
  'wasmMemory',
  'noExitRuntime',
  'addOnPreRun',
  'addOnPostRun',
  'freeTableIndexes',
  'functionsInTableMap',
  'setValue',
  'getValue',
  'PATH',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'UTF8ToString',
  'stringToUTF8Array',
  'stringToUTF8',
  'lengthBytesUTF8',
  'AsciiToString',
  'UTF16Decoder',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'stringToUTF8OnStack',
  'writeArrayToMemory',
  'JSEvents',
  'specialHTMLTargets',
  'findCanvasEventTarget',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'UNWIND_CACHE',
  'ExitStatus',
  'flush_NO_FILESYSTEM',
  'emSetImmediate',
  'emClearImmediate_deps',
  'emClearImmediate',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'ExceptionInfo',
  'Browser',
  'requestFullscreen',
  'requestFullScreen',
  'setCanvasSize',
  'getUserMedia',
  'createContext',
  'getPreloadedImageData__data',
  'wget',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'base64Decode',
  'SYSCALLS',
  'preloadPlugins',
  'FS_stdin_getChar_buffer',
  'FS_unlink',
  'FS_createPath',
  'FS_createDevice',
  'FS_readFile',
  'FS',
  'FS_root',
  'FS_mounts',
  'FS_devices',
  'FS_streams',
  'FS_nextInode',
  'FS_nameTable',
  'FS_currentPath',
  'FS_initialized',
  'FS_ignorePermissions',
  'FS_filesystems',
  'FS_syncFSRequests',
  'FS_readFiles',
  'FS_lookupPath',
  'FS_getPath',
  'FS_hashName',
  'FS_hashAddNode',
  'FS_hashRemoveNode',
  'FS_lookupNode',
  'FS_createNode',
  'FS_destroyNode',
  'FS_isRoot',
  'FS_isMountpoint',
  'FS_isFile',
  'FS_isDir',
  'FS_isLink',
  'FS_isChrdev',
  'FS_isBlkdev',
  'FS_isFIFO',
  'FS_isSocket',
  'FS_flagsToPermissionString',
  'FS_nodePermissions',
  'FS_mayLookup',
  'FS_mayCreate',
  'FS_mayDelete',
  'FS_mayOpen',
  'FS_checkOpExists',
  'FS_nextfd',
  'FS_getStreamChecked',
  'FS_getStream',
  'FS_createStream',
  'FS_closeStream',
  'FS_dupStream',
  'FS_doSetAttr',
  'FS_chrdev_stream_ops',
  'FS_major',
  'FS_minor',
  'FS_makedev',
  'FS_registerDevice',
  'FS_getDevice',
  'FS_getMounts',
  'FS_syncfs',
  'FS_mount',
  'FS_unmount',
  'FS_lookup',
  'FS_mknod',
  'FS_statfs',
  'FS_statfsStream',
  'FS_statfsNode',
  'FS_create',
  'FS_mkdir',
  'FS_mkdev',
  'FS_symlink',
  'FS_rename',
  'FS_rmdir',
  'FS_readdir',
  'FS_readlink',
  'FS_stat',
  'FS_fstat',
  'FS_lstat',
  'FS_doChmod',
  'FS_chmod',
  'FS_lchmod',
  'FS_fchmod',
  'FS_doChown',
  'FS_chown',
  'FS_lchown',
  'FS_fchown',
  'FS_doTruncate',
  'FS_truncate',
  'FS_ftruncate',
  'FS_utime',
  'FS_open',
  'FS_close',
  'FS_isClosed',
  'FS_llseek',
  'FS_read',
  'FS_write',
  'FS_mmap',
  'FS_msync',
  'FS_ioctl',
  'FS_writeFile',
  'FS_cwd',
  'FS_chdir',
  'FS_createDefaultDirectories',
  'FS_createDefaultDevices',
  'FS_createSpecialDirectories',
  'FS_createStandardStreams',
  'FS_staticInit',
  'FS_init',
  'FS_quit',
  'FS_findObject',
  'FS_analyzePath',
  'FS_createFile',
  'FS_createDataFile',
  'FS_forceLoadFile',
  'FS_createLazyFile',
  'FS_absolutePath',
  'FS_createFolder',
  'FS_createLink',
  'FS_joinPath',
  'FS_mmapAlloc',
  'FS_standardizePath',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'print',
  'printErr',
  'jstoi_s',
  'InternalError',
  'BindingError',
  'throwInternalError',
  'throwBindingError',
  'registeredTypes',
  'awaitingDependencies',
  'typeDependencies',
  'tupleRegistrations',
  'structRegistrations',
  'sharedRegisterType',
  'whenDependentTypesAreResolved',
  'getTypeName',
  'getFunctionName',
  'heap32VectorToArray',
  'usesDestructorStack',
  'checkArgCount',
  'getRequiredArgCount',
  'createJsInvoker',
  'UnboundTypeError',
  'EmValType',
  'EmValOptionalType',
  'throwUnboundTypeError',
  'ensureOverloadTable',
  'exposePublicSymbol',
  'replacePublicSymbol',
  'embindRepr',
  'registeredInstances',
  'getBasestPointer',
  'getInheritedInstance',
  'registeredPointers',
  'registerType',
  'integerReadValueFromPointer',
  'floatReadValueFromPointer',
  'assertIntegerRange',
  'readPointer',
  'runDestructors',
  'craftInvokerFunction',
  'embind__requireFunction',
  'genericPointerToWireType',
  'constNoSmartPtrRawPointerToWireType',
  'nonConstNoSmartPtrRawPointerToWireType',
  'init_RegisteredPointer',
  'RegisteredPointer',
  'RegisteredPointer_fromWireType',
  'runDestructor',
  'releaseClassHandle',
  'finalizationRegistry',
  'detachFinalizer_deps',
  'detachFinalizer',
  'attachFinalizer',
  'makeClassHandle',
  'init_ClassHandle',
  'ClassHandle',
  'throwInstanceAlreadyDeleted',
  'deletionQueue',
  'flushPendingDeletes',
  'delayFunction',
  'RegisteredClass',
  'shallowCopyInternalPointer',
  'downcastPointer',
  'upcastPointer',
  'char_0',
  'char_9',
  'makeLegalFunctionName',
  'emval_freelist',
  'emval_handles',
  'emval_symbols',
  'Emval',
  'emval_methodCallers',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);

  // End runtime exports
  // Begin JS library exports
  // End JS library exports

// end include: postlibrary.js

function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
}

// Imports from the Wasm binary.
var ___getTypeName = makeInvalidEarlyAccess('___getTypeName');
var _free = Module['_free'] = makeInvalidEarlyAccess('_free');
var _strerror = makeInvalidEarlyAccess('_strerror');
var _malloc = Module['_malloc'] = makeInvalidEarlyAccess('_malloc');
var _fflush = makeInvalidEarlyAccess('_fflush');
var _emscripten_stack_get_end = makeInvalidEarlyAccess('_emscripten_stack_get_end');
var _emscripten_stack_get_base = makeInvalidEarlyAccess('_emscripten_stack_get_base');
var _emscripten_stack_init = makeInvalidEarlyAccess('_emscripten_stack_init');
var _emscripten_stack_get_free = makeInvalidEarlyAccess('_emscripten_stack_get_free');
var __emscripten_stack_restore = makeInvalidEarlyAccess('__emscripten_stack_restore');
var __emscripten_stack_alloc = makeInvalidEarlyAccess('__emscripten_stack_alloc');
var _emscripten_stack_get_current = makeInvalidEarlyAccess('_emscripten_stack_get_current');
var memory = makeInvalidEarlyAccess('memory');
var __indirect_function_table = makeInvalidEarlyAccess('__indirect_function_table');
var wasmMemory = makeInvalidEarlyAccess('wasmMemory');
var wasmTable = makeInvalidEarlyAccess('wasmTable');

function assignWasmExports(wasmExports) {
  assert(typeof wasmExports['__getTypeName'] != 'undefined', 'missing Wasm export: __getTypeName');
  assert(typeof wasmExports['free'] != 'undefined', 'missing Wasm export: free');
  assert(typeof wasmExports['strerror'] != 'undefined', 'missing Wasm export: strerror');
  assert(typeof wasmExports['malloc'] != 'undefined', 'missing Wasm export: malloc');
  assert(typeof wasmExports['fflush'] != 'undefined', 'missing Wasm export: fflush');
  assert(typeof wasmExports['emscripten_stack_get_end'] != 'undefined', 'missing Wasm export: emscripten_stack_get_end');
  assert(typeof wasmExports['emscripten_stack_get_base'] != 'undefined', 'missing Wasm export: emscripten_stack_get_base');
  assert(typeof wasmExports['emscripten_stack_init'] != 'undefined', 'missing Wasm export: emscripten_stack_init');
  assert(typeof wasmExports['emscripten_stack_get_free'] != 'undefined', 'missing Wasm export: emscripten_stack_get_free');
  assert(typeof wasmExports['_emscripten_stack_restore'] != 'undefined', 'missing Wasm export: _emscripten_stack_restore');
  assert(typeof wasmExports['_emscripten_stack_alloc'] != 'undefined', 'missing Wasm export: _emscripten_stack_alloc');
  assert(typeof wasmExports['emscripten_stack_get_current'] != 'undefined', 'missing Wasm export: emscripten_stack_get_current');
  assert(typeof wasmExports['memory'] != 'undefined', 'missing Wasm export: memory');
  assert(typeof wasmExports['__indirect_function_table'] != 'undefined', 'missing Wasm export: __indirect_function_table');
  ___getTypeName = createExportWrapper('__getTypeName', 1);
  _free = Module['_free'] = createExportWrapper('free', 1);
  _strerror = createExportWrapper('strerror', 1);
  _malloc = Module['_malloc'] = createExportWrapper('malloc', 1);
  _fflush = createExportWrapper('fflush', 1);
  _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'];
  _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'];
  _emscripten_stack_init = wasmExports['emscripten_stack_init'];
  _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'];
  __emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
  __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
  _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'];
  memory = wasmMemory = wasmExports['memory'];
  __indirect_function_table = wasmTable = wasmExports['__indirect_function_table'];
}

var wasmImports = {
  /** @export */
  __cxa_throw: ___cxa_throw,
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  _embind_register_bigint: __embind_register_bigint,
  /** @export */
  _embind_register_bool: __embind_register_bool,
  /** @export */
  _embind_register_class: __embind_register_class,
  /** @export */
  _embind_register_class_constructor: __embind_register_class_constructor,
  /** @export */
  _embind_register_class_function: __embind_register_class_function,
  /** @export */
  _embind_register_emval: __embind_register_emval,
  /** @export */
  _embind_register_float: __embind_register_float,
  /** @export */
  _embind_register_integer: __embind_register_integer,
  /** @export */
  _embind_register_memory_view: __embind_register_memory_view,
  /** @export */
  _embind_register_std_string: __embind_register_std_string,
  /** @export */
  _embind_register_std_wstring: __embind_register_std_wstring,
  /** @export */
  _embind_register_void: __embind_register_void,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write
};


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

var calledRun;

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {

  stackCheckInit();

  preRun();

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    assert(!calledRun);
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    readyPromiseResolve?.(Module);
    Module['onRuntimeInitialized']?.();
    consumedModuleProp('onRuntimeInitialized');

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(() => {
      setTimeout(() => Module['setStatus'](''), 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    flush_NO_FILESYSTEM();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)');
  }
}

var wasmExports;

// In modularize mode the generated code is within a factory function so we
// can use await here (since it's not top-level-await).
wasmExports = await (createWasm());

run();

// end include: postamble.js

// include: postamble_modularize.js
// In MODULARIZE mode we wrap the generated code in a factory function
// and return either the Module itself, or a promise of the module.
//
// We assign to the `moduleRtn` global here and configure closure to see
// this as an extern so it won't get minified.

if (runtimeInitialized)  {
  moduleRtn = Module;
} else {
  // Set up the promise that indicates the Module is initialized
  moduleRtn = new Promise((resolve, reject) => {
    readyPromiseResolve = resolve;
    readyPromiseReject = reject;
  });
}

// Assertion for attempting to access module properties on the incoming
// moduleArg.  In the past we used this object as the prototype of the module
// and assigned properties to it, but now we return a distinct object.  This
// keeps the instance private until it is ready (i.e the promise has been
// resolved).
for (const prop of Object.keys(Module)) {
  if (!(prop in moduleArg)) {
    Object.defineProperty(moduleArg, prop, {
      configurable: true,
      get() {
        abort(`Access to module property ('${prop}') is no longer possible via the module constructor argument; Instead, use the result of the module constructor.`)
      }
    });
  }
}
// end include: postamble_modularize.js



    return moduleRtn;
  };
})();

// Export using a UMD style export, or ES6 exports if selected
if (typeof exports === 'object' && typeof module === 'object') {
  module.exports = createAudioEngine;
  // This default export looks redundant, but it allows TS to import this
  // commonjs style module.
  module.exports.default = createAudioEngine;
} else if (typeof define === 'function' && define['amd'])
  define([], () => createAudioEngine);

