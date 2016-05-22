// xql.js <https://github.com/exjs/xql>
(function(_xql) {
"use strict";

/**
 * Root namespace.
 *
 * @namespace
 * @alias xql
 */
const xql = _xql;

const VERSION = "1.2.0";

// ============================================================================
// [internal]
// ============================================================================

// Always returns false, used internally for browser support.
function returnFalse() { return false; }

// Global shorthands.
const isArray  = Array.isArray;
const isBuffer = typeof Buffer === "function" ? Buffer.isBuffer : returnFalse;
const hasOwn   = Object.prototype.hasOwnProperty;
const slice    = Array.prototype.slice;

// Empty object/array used as an replacement for null/undefined in some cases.
const EmptyObject = {};
const emptyArray = [];

// Global regular expressions.
const reNewLine      = /\n/g;                // Check for new line characters.
const reGraveQuotes  = /`/g;                 // Check for grave (`) quotes.
const reDoubleQuotes = /\"/g;                // Check for double (") quotes.
const reBrackets     = /\[\]/g;              // Check for [] brackets.
const reDotNull      = /[\.\x00]/g;          // Check for '.' or '\0' characters.
const reInt          = /^-?\d+$/;            // Check for a well-formatted int with optional '-' sign.
const reUpperCase    = /^[A-Z_][A-Z_0-9]*$/; // Check for an UPPERCASE_ONLY string.
// Checks if a string is a well formatted integer or floating point number, also
// accepts scientific notation "E[+-]?xxx".
const reNumber = /^(NaN|-?Infinity|^-?((\d+\.?|\d*\.\d+)([eE][-+]?\d+)?))$/;

// Map of identifiers that are not escaped.
const IdentifierMap = {
  "*"       : true
};

// Map of strings which can be implicitly casted to `TRUE` or `FALSE`.
const BoolMap = {
  "0"       : false,
  "f"       : false,
  "false"   : false,
  "n"       : false,
  "no"      : false,
  "off"     : false,

  "1"       : true,
  "t"       : true,
  "true"    : true,
  "y"       : true,
  "yes"     : true,
  "on"      : true
};
Object.keys(BoolMap).forEach(function(key) {
  BoolMap[key.toUpperCase()] = BoolMap[key];
});

const TypeMap = {
  "bool"    : "boolean",
  "boolean" : "boolean",

  "bigint"  : "integer",
  "int"     : "integer",
  "integer" : "integer",
  "smallint": "integer",

  "real"    : "number",
  "float"   : "number",
  "number"  : "number",
  "numeric" : "number",

  "char"    : "string",
  "varchar" : "string",
  "string"  : "string",
  "text"    : "string",

  "array"   : "array",
  "json"    : "json",
  "object"  : "json",
  "raw"     : "raw",

  "values"  : "values"
};
Object.keys(TypeMap).forEach(function(key) {
  TypeMap[key.toUpperCase()] = TypeMap[key];
});

/**
 * Operator and function flags.
 *
 * @alias xql.OpFlags
 */
const OpFlags = {
  kUnary       : 0x00000001, // Operator is unary (has one child node - `value`).
  kBinary      : 0x00000002, // Operator is binary (has two child nodes - `left` and `right`).
  kFunction    : 0x00000004, // Operator is a function.
  kAggregate   : 0x00000008, // Operator is an aggregation function.
  kVoid        : 0x00000010, // Operator has no return value.
  kInPlaceNot  : 0x00000020, // Operator allows in place NOT (a NOT OP b).
  kLeftValues  : 0x00000040, // Operator expects left  values as (a, b[, ...]).
  kRightValues : 0x00000080, // Operator expects right values as (a, b[, ...]).
};
xql.OpFlags = OpFlags;

/**
 * Operator and function information.
 *
 * @alias xml.OpInfo
 */
const OpInfo = new class OpInfo {
  constructor() {
    this._map = {};
    this._dialects = {};
  }

  get(name) {
    var map = this._map;
    return hasOwn.call(map, name) ? map[name] : null;
  }

  add(func) {
    this._map[func.name] = func;
  }

  alias(a, b) {
    this._map[a] = this._map[b];
  }

  not(a, b) {
    var aInfo = this._map[a];
    var bInfo = this._map[b];

    aInfo.not = bInfo;
    bInfo.not = aInfo;
  }

  all() {
    return this._map;
  }

  forEach(cb, thisArg) {
    var map = this._map;
    for (var k in map) {
      cb.call(thisArg, k, map[k]);
    }
  }
};
xql.OpInfo = OpInfo;

/**
 * Identifier's quote style.
 *
 * @alias xql.QuoteStyle
 */
const QuoteStyle = {
  /** Double quotes, for example "identifier". */
  kDouble       : 0,
  /** Grave quotes, for example `identifier`. */
  kGrave        : 1,
  /** Brackets, for example [identifier]. */
  kBrackets     : 2
};
xql.QuoteStyle = QuoteStyle;

/**
 * Node flags.
 *
 * @alias xql.NodeFlags
 */
const NodeFlags = {
  kImmutable    : 0x00000001,
  kNot          : 0x00000002,
  kAscending    : 0x00000010,
  kDescending   : 0x00000020,
  kNullsFirst   : 0x00000040,
  kNullsLast    : 0x00000080,
  kAll          : 0x00000100,
  kDistinct     : 0x00000200
};
xql.NodeFlags = NodeFlags;

// Sort directions.
const SortDirection = {
  ""            : 0,
  "0"           : 0,

  "1"           : NodeFlags.kAscending,
  "-1"          : NodeFlags.kDescending,

  "ASC"         : NodeFlags.kAscending,
  "DESC"        : NodeFlags.kDescending
};

// Sort nulls.
const SortNulls = {
  "NULLS FIRST" : NodeFlags.kNullsFirst,
  "NULLS LAST"  : NodeFlags.kNullsLast
};

// ============================================================================
// [xql.error]
// ============================================================================

/**
 * Error classes.
 *
 * @namespace
 * @alias xql.error
 */
const xql$error = xql.error = {};

/**
 * Error thrown if data is wrong.
 * @param message Error mesasge.
 *
 * @alias xql.error.ValueError
 */
class ValueError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValueError";
    this.message = message;
  }
}
xql$error.ValueError = ValueError;

/**
 * Error thrown if query is wrong.
 * @param message Error mesasge.
 *
 * @alias xql.error.CompileError
 */
class CompileError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompileError";
    this.message = message;
  }
}
xql$error.CompileError = CompileError;

function throwTypeError(message) { throw new TypeError(message); }
function throwValueError(message) { throw new ValueError(message); }
function throwCompileError(message) { throw new CompileError(message); }

// ============================================================================
// [xql.misc]
// ============================================================================

/**
 * Miscellaneous namespace.
 *
 * @namespace
 * @alias xql.misc
 */
const xql$misc = xql.misc = {};

/**
 * Version information in a "major.minor.patch" form.
 *
 * Note: Version information has been put into the `xql.misc` namespace to
 * prevent a possible clashing with SQL builder's interface exported in the
 * root namespace.
 *
 * @alias xql.misc.VERSION
 */
xql$misc.VERSION = VERSION;

/**
 * Get a type of the `value` as a string. This function extends a javascript
 * `typeof` operator with "array", "buffer", "null" and "undefined". It's used
 * for debugging and error handling purposes to enhance error messages.
 *
 * @param {*} value
 * @return {string}
 *
 * @function xql.misc.typeOf
 */
function typeOf(value) {
  if (value == null)
    return value === null ? "null" : "undefined";

  if (typeof value !== "object")
    return typeof value;

  if (isArray(value))
    return "array";

  if (isBuffer(value))
    return "buffer";

  if (value instanceof Node)
    return value._type || "Node";

  return "object";
}
xql$misc.typeOf = typeOf;

function parseVersion(s) {
  var parts = s.split(".");
  var re = /^[0-9]+$/g;

  var major = 0;
  var minor = 0;
  var patch = 0;

  for (var i = 0, len = Math.min(parts.length, 3); i < len; i++) {
    var part = parts[i];
    if (!re.test(part))
      break;

    var n = parseInt(part);
    switch (i) {
      case 0: major = n; break;
      case 1: minor = n; break;
      case 2: patch = n; break;
    }
  }

  return {
    major: major,
    minor: minor,
    patch: patch
  }
}

function blobToHex(blob) {
  return blob.toString("hex");
}

function indent(s, indentation) {
  return (s && indentation) ? indentation + s.replace(reNewLine, "\n" + indentation) : s;
}
xql$misc.indent = indent;

function alias(classobj, spec) {
  var p = classobj.prototype;
  for (var member in spec) {
    var from = spec[member];
    p[member] = p[from];
  }
  return classobj;
}

// ============================================================================
// [xql.dialect]
// ============================================================================

/**
 * Database dialects namespace.
 *
 * @namespace
 * @alias xql.dialect
 */
const xql$dialect = xql.dialect = {};

/**
 * Hash table that maps a dialect string into a `Context` class.
 *
 * @private
 */
const xql$dialect$map = {};

/**
 * Checks whether the `dialect` exists in the global registry.
 *
 * @param {string} dialect A name of the dialect (always lowercase).
 * @return {boolean}
 *
 * @function xql.dialect.get
 */
function xql$dialect$has(dialect) {
  return hasOwn.call(xql$dialect$map, dialect);
}
xql$dialect.has = xql$dialect$has;

/**
 * Adds a new dialect to the global registry.
 *
 * @param {string} dialect A name of the dialect (always lowercase).
 * @param {function} classobj A `Context` class object (non-instantiated).
 *
 * @function xql.dialect.add
 */
function xql$dialect$add(dialect, classobj) {
  xql$dialect$map[dialect] = classobj;
}
xql$dialect.add = xql$dialect$add;

/**
 * Constructs a new `Context` for a given options.
 *
 * @param {object} options Context options.
 * @param {string} options.dialect Database dialect (must be registered).
 * @return {Context} Instantiated `Context`.
 *
 * @function xql.dialect.newContext
 */
function $xql$dialect$newContext(options) {
  if (typeof options !== "object" || options === null)
    throwTypeError("xql.dialect.newContext() - Options must be Object");

  var dialect = options.dialect;
  if (typeof dialect !== "string")
    throwTypeError("xql.dialect.newContext() - Options must have a dialect key");

  if (!hasOwn.call(xql$dialect$map, dialect))
    throwTypeError("xql.dialect.newContext() - Unknown dialect '" + dialect + "'");

  var classobj = xql$dialect$map[dialect];
  return new classobj(options);
}
xql$dialect.newContext = $xql$dialect$newContext;

// ============================================================================
// [xql.dialect.Context]
// ============================================================================

function fnBrackets(s) {
  return s.charCodeAt(0) === 91 ? "[[" : "]]";
}

/**
 * Database dialect context that provides an interface that query builders can
 * use to build a dialect-specific queries. The context itself provides some
 * dialect-agnostic functionality that is shared between multiple dialect
 * implementations.
 *
 * It's essential to call `_update()` in your own constructor when extending
 * `Context` to implement your own database dialect.
 *
 * @param {string} dialect Database dialect the context is using.
 * @param {object} options Context options.
 *
 * @alias xql.dialect.Context
 */
class Context {
  constructor(dialect, options) {
    this.dialect = dialect;

    // Context configuration.
    this.pretty = options.pretty ? true : false;
    this.indentation = options.indentation || 2;

    // Dialect version (no version specified is the default).
    this.version = options.version ? parseVersion(options.version) : {
      major: 0,
      minor: 0,
      patch: 0
    };

    // Dialect features (these are modified by a dialect-specific `Context`).
    this.features = {
      quoteStyle       : QuoteStyle.kDouble, // The default SQL quotes are "".
      nativeBoolean    : false,              // Supports `BOOLEAN`.
      nativeArray      : false,              // Supports `ARRAY`.
      nullsFirstLast   : false,              // Supports `NULLS FIRST` & `NULLS LAST`.
      nullsSortBottom  : false,              // NULLs are sorted last by default.
      returning        : false,              // If `RETURNING` or `OUTPUT` is supported.
      returningAsOutput: false,              // Use `OUTPUT` instead of `RETURNING`.
      specialNumbers   : false               // No special numbers by default.
    };

    // Functions that depend on `this.pretty` option.
    this.indent = null;
    this.concat = null;

    // Computed properties based on configuration and dialect features. These
    // require `_update()` to be called after one or more property is changed.
    this._DB_POS_INF   = "";   // Positive infinity value or keyword.
    this._DB_NEG_INF   = "";   // Negative infinity value or keyword.
    this._DB_NAN       = "";   // NaN value or keyword.

    this._DB_TRUE      = "";   // Dialect-specific TRUE value.
    this._DB_FALSE     = "";   // Dialect-specific FALSE value.

    this._NL           = "";   // Space character, either " " or "\n" (pretty).
    this._COMMA        = "";   // Comma separator, either ", " or ",\n" (pretty).
    this._INDENT       = "";   // Indentation string.
    this._CONCAT_STR   = "";   // Concatenation string, equals to `space + _INDENT`.

    this._IDENT_BEFORE = "";   // Escape character inserted before identifiers.
    this._IDENT_AFTER  = "";   // Escape character inserted after identifiers.
    this._IDENT_CHECK  = null; // Regular expression that checks if the identifier
                               // needs escaping or contains or contains ill chars.
  }

  /**
   * Set the version of the dialect to the given `version`.
   *
   * @param {string} version Version string as "major.minor.patch". The string
   * can omit any version part if not used, gratefully accepting "major.minor"
   * and/or "major" only. If any version part that is omitted will be set to 0.
   *
   * @return {this}
   */
  setVersion(version) {
    this.version = parseVersion(version);
    this._update();

    return this;
  }

  /**
   * Compiles the given query `q`.
   *
   * @param {string|Node} q Query to compile, can be either string or `xql.Node`.
   * @return {string} Compiled query string.
   *
   * @throws {TypeError} If the query `q` is an object that is not compatible
   *   with `xql.Node`.
   */
  compile(q) {
    if (typeof q === "string")
      return q;

    if (typeof q.compileQuery === "function")
      return q.compileQuery(this);

    throw new TypeError("xql.Context.compile() - Invalid argument");
  }

  /**
   * Escapes a single or multiple SQL identifier(s).
   *
   * @param {string|string[]} ident Idenfifier or array of identifiers to escape.
   * @return {string} Escaped identifier(s).
   */
  escapeIdentifier(ident) {
    var input = "";
    var output = "";

    var i = 0;
    var len = 1;

    if (isArray(ident)) {
      len = ident.length;
      if (len > 0)
        input = ident[0];
    }
    else {
      input = ident;
    }

    var re = this._IDENT_CHECK;
    for (;;) {
      // Apply escaping to all parts of the identifier (if any).
      for (;;) {
        // Ignore undefined/null parts of the input.
        if (input == null) break;

        var m = input.search(re);
        var p = input;

        // Multiple arguments are joined by using ".".
        if (output) output += ".";

        if (m !== -1) {
          var c = input.charCodeAt(m);

          // `.` === 46.
          if (c === 46) {
            // Dot separator, that's fine
            p = input.substr(0, m);
          }
          else {
            // NULL character in identifier is not allowed.
            if (c === 0)
              throwCompileError("Identifier can't contain NULL character");

            // Character that needs escaping. In this case we repeat the
            // search by using simpler regular expression and then pass
            // the whole string to a function that will properly escape
            // it (as this function is very generic and can handle all
            // dialects easily).
            m = input.search(reDotNull);
            if (m !== -1) {
              c = input.charCodeAt(m);
              if (c === 46)
                p = input.substr(0, m);
              else
                throwCompileError("Identifier can't contain NULL character");
            }
            p = this.escapeIdentifierImpl(p);
          }
        }

        if (hasOwn.call(IdentifierMap, p))
          output += p;
        else
          output += this._IDENT_BEFORE + p + this._IDENT_AFTER;

        if (m === -1) break;
        input = input.substr(m + 1);
      }

      if (++i >= len) break;
      input = ident[i];
    }

    // Return an empty identifier (allowed) in case the output is an empty string.
    return output ? output : this._IDENT_BEFORE + this._IDENT_AFTER;
  }

  /**
   * Escapes a single identifier.
   *
   * Please do not use this function directly. It's called by `escapeIdentifier`
   * to escape an identifier (or part of it) in a dialect-specific way.
   *
   * @param {string} ident Identifier to escape, which should be already
   *   checked (for example it shouldn't contain NULL characters).
   * @return {string} Escaped identifier.
   */
  escapeIdentifierImpl(ident) {
    // NOTE: This function is only called when `ident` contains one or more
    // characters to escape. It doesn't have to be super fast as it involes
    // regexp search & replace anyway. This is the main reason it's generally
    // not reimplemented by a dialect-specific implementation as it won't
    // bring any performance gain.
    var qs = this.features.quoteStyle;

    if (qs == QuoteStyle.kDouble  ) return ident.replace(reDoubleQuotes, "\"\"");
    if (qs == QuoteStyle.kGrave   ) return ident.replace(reGraveQuotes, "``");
    if (qs == QuoteStyle.kBrackets) return ident.replace(reBrackets, fnBrackets);

    throwCompileError("Cannot escape identifier: Invalid 'features.quoteStyle' set");
  }

  /**
   * Escapes `value` so it can be inserted into a SQL query.
   *
   * The `value` can be any JS type that can be implicitly or explicitly
   * converted to SQL. The `explicitType` parameter can be used to force
   * the type explicitly in case of ambiguity.
   *
   * @param {*} value A value to escape.
   * @param {string=} explicitType SQL type override
   * @return {string} Escaped `value` as string.
   */
  escapeValue(value, explicitType) {
    // Explicitly Defined Type (`explicitType` is set)
    // -----------------------------------------------

    if (explicitType) {
      if (value instanceof Node)
        return value.compileNode(this);

      var type = TypeMap[explicitType];
      if (!type)
        throwValueError("Unknown explicit type '" + explicitType + "'");

      switch (type) {
        case "boolean":
          if (value == null) return "NULL";

          if (typeof value === "boolean")
            return value === true ? this._DB_TRUE : this._DB_FALSE;

          if (typeof value === "string" && hasOwn.call(BoolMap, value))
            return BoolMap[value] === true ? this._DB_TRUE : this._DB_FALSE;

          if (typeof value === "number") {
            if (value === 0) return this._DB_FALSE;
            if (value === 1) return this._DB_TRUE;
            throwValueError("Couldn't convert 'number(" + value + ")' to 'boolean'");
          }

          // Will throw.
          break;

        case "integer":
          if (value == null) return "NULL";

          if (typeof value === "number") {
            if (!isFinite(value) || Math.floor(value) !== value)
              throwValueError("Couldn't convert 'number(" + value + ")' to 'integer'");
            return value.toString();
          }

          if (typeof value === "string") {
            if (!reInt.test(value))
              throwValueError("Couldn't convert ill formatted 'string' to 'integer'");
            return value;
          }

          // Will throw.
          break;

        case "number":
          if (value == null) return "NULL";

          if (typeof value === "number")
            return this.escapeNumber(value);

          if (typeof value === "string") {
            if (!reNumber.test(value))
              throwValueError("Couldn't convert ill formatted 'string' to 'number'");
            return value;
          }

          // Will throw
          break;

        case "string":
          if (value == null) return "NULL";

          if (typeof value === "string")
            return this.escapeString(value);

          if (typeof value === "number" || typeof value === "boolean")
            return this.escapeString(value.toString());

          if (typeof value === "object")
            return this.escapeString(JSON.stringify(value));

          // Will throw.
          break;

        case "array":
          if (value == null) return "NULL";

          if (Array.isArray(value))
            return this.escapeArray(value, false);

          // Will throw.
          break;

        case "values":
          if (value == null) return "NULL";

          if (Array.isArray(value))
            return this.escapeValues(value, false);

          // Will throw.
          break;

        case "json":
          // `undefined` maps to native DB `NULL` type while `null` maps to
          // JSON `null` type. This is the only way to distinguish between
          // these. `undefined` is disallowed by JSON anyway.
          if (value === undefined) return "NULL";
          return this.escapeJson(value);

        case "raw":
          return value;
      }

      throwValueError("Couldn't convert '" + typeOf(value) + "' to '" + explicitType + "'");
    }

    // Implicitly Defined Type (deduced from `value`)
    // ----------------------------------------------

    // Check - `string`, `number` and `boolean`.
    //
    // These types are expected in most cases so they are checked first. All
    // other types require more processing to escape them properly anyway.
    if (typeof value === "string") return this.escapeString(value);
    if (typeof value === "number") return this.escapeNumber(value);
    if (typeof value === "boolean") return value === true ? this._DB_TRUE : this._DB_FALSE;

    // Check - `undefined` and `null`.
    //
    // Undefined implicitly converts to `NULL`.
    if (value == null) return "NULL";

    // Sanity.
    //
    // At this point the only expected type of value is `object`.
    if (typeof value !== "object")
      throwValueError("Unexpected implicit value type '" + (typeof value) + "'");

    // Node.
    //
    // All xql objects extend `Node`.
    if (value instanceof Node)
      return value.compileNode(this);

    // Check - Buffer (BLOB / BINARY).
    if (isBuffer(value))
      return this.escapeBuffer(value);

    // Check - Array (ARRAY).
    if (isArray(value))
      return this.escapeArray(value, false);

    return this.escapeString(JSON.stringify(value));
  }

  /**
   * Escapes a number `value` into a SQL number.
   *
   * @param {number} value Number to escape.
   * @return {string} Escaped `value` as string.
   */
  escapeNumber(value) {
    if (!isFinite(value)) {
      var out = (value ===  Infinity) ? this._DB_POS_INF :
                (value === -Infinity) ? this._DB_NEG_INF : this._DB_NAN;

      if (out === "")
        throwValueError("Couldn't process a special number (Infinity/NaN)");
      return out;
    }

    return value.toString();
  }

  /**
   * Escapes a number `value` into a SQL string.
   *
   * @param {string} value A string to escape.
   * @return {string} Escaped `value` as string.
   *
   * @abstract
   */
  escapeString(value) {
    throwTypeError("Abstract method called");
  }

  /**
   * Escapes a buffer/blob `value` into a SQL buffer representation.
   *
   * @param {Buffer} value Buffer to escape.
   * @return {string} Escaped `value` as buffer.
   */
  escapeBuffer(value) {
    return "x'" + blobToHex(value) + "'";
  }

  /**
   * Escapes an array into SQL `VALUES` representation.
   *
   * @param {array} value Array to escape.
   * @return {string} Escaped `value` as SQL `VALUES`.
   */
  escapeValues(value) {
    var out = "";

    for (var i = 0, len = value.length; i < len; i++) {
      var element = value[i];
      if (out) out += ", ";

      if (isArray(element))
        out += this.escapeArray(element, false);
      else
        out += this.escapeValue(element);
    }

    return "(" + out + ")";
  }

  /**
   * Escapes an array into a SQL ARRAY representation.
   *
   * By default it converts the array into a JSON-based string representation
   * to ensure compatibility with engines that don't support arrays natively.
   * However, some engines like PostgreSQL support arrays and will use proper
   * ARRAY escaping.
   *
   * @param {array} value Array to escape.
   * @param {boolean} nested Whether the array is nested in another array.
   *   Some dialects (like pgsql) need this information to properly escape the
   *   array.
   * @return {string} Escaped `value` as SQL-ARRAY or compatible.
   */
  escapeArray(value, nested) {
    return this.escapeString(JSON.stringify(value));
  }

  /**
   * Escapes a value into a SQL JSON representation.
   *
   * By default it converts the array into a JSON-based string representation
   * to ensure compatibility with engines that don't support JSON natively or
   * that have support for JSON by using string literals like PostgreSQL does.
   *
   * @param {*} value Value to escape.
   * @return {string} Escaped `value` as SQL-JSON.
   */
  escapeJson(value) {
    return this.escapeString(JSON.stringify(value));
  }

  /**
   * Escapes a value (or compiles it if it's an expression) and surrounds it
   * with parentheses if it's an expression.
   *
   * The purpose of this function is to simplify generation of some expressions
   * where omitting sparentheses could cause SQL error due to operator precedence
   * or ambiguity.
   */
  escapeOrWrap(value) {
    const out = this.escapeValue(value);

    if (value instanceof Node && !(value instanceof Value) && !(value instanceof Identifier))
      return "(" + out + ")";
    else
      return out;
  }

  /**
   * Substitutes `?` sequences or Postgres specific `$N` sequences in the `query`
   * string with `bindings` and returns a new string. The function automatically
   * detects the format of `query` string and checks if it's consistent (i.e. it
   * throws if `?` is used together with `$1`).
   *
   * This function knows how to recognize escaped identifiers and strings in the
   * query and skips content of these. For example for a given string `'?' ?`
   * only the second `?` would be considered and substituted.
   *
   * NOTE: Although the function understands SQL syntax, the function expects
   * well formed SQL query. The purpose is to substitute query parameters and
   * not performing expensive validation (that will be done by the server anyway).
   *
   * @param {string} query Query string to substitute (template).
   * @param {array=} bindings Array of values to bind to `query`.
   * @return {string}
   *
   * @abstract
   */
  substitute(query, bindings) {
    throwTypeError("Abstract method called");
  }

  _compileUnaryOp(node) {
    var type = node._type;
    var out = this.escapeValue(node._value);

    switch (type) {
      case "NOT":
        out = "NOT (" + out + ")";
        break;

      case "-":
        out = "-(" + out + ")";
        break;

      default:
        if (type)
          out = type + " " + out;
        break;
    }

    var as = node._as;
    if (as)
      out += " AS " + this.escapeIdentifier(as);

    return out;
  }

  _compileBinaryOp(node) {
    var type = node._type;
    var out = "";

    var keyword = "";

    var leftNode = node._left;
    var rightNode = node._right;

    var left = "";
    var right = "";

    if (!type)
      throwCompileError("BinaryOp.compileNode() - No operator specified");

    var opInfo = OpInfo.get(type);
    if (opInfo) {
      const flags = opInfo.flags;

      if (flags & OpFlags.kLeftValues) left = this.escapeValues(leftNode);
      if (flags & OpFlags.kRightValues) right = this.escapeValues(rightNode);

      // Check if the right operand is `NULL` and convert the operator to `IS`
      // or `IS NOT` if necessary to be more conforming with SQL standard.
      if (right === "NULL") {
        if (opInfo.name === "=")
          opInfo = OpInfo.get("IS");
      }

      keyword = opInfo.nameFmt;
    }
    else {
      keyword = " " + type + " ";
    }


    if (!left) left = this.escapeValue(leftNode);
    if (!right) right = this.escapeValue(rightNode);

    if (leftNode instanceof Binary) left = "(" + left + ")";
    if (rightNode instanceof Binary) right = "(" + right + ")";

    out = left + keyword + right;

    var as = node._as;
    if (as)
      out += " AS " + this.escapeIdentifier(as);

    return out;
  }

  /**
   * Compiles a function (xql.node.Func).
   *
   * @param {xql.node.Func} node Function node.
   * @return {string} Compiled function.
   *
   * @private
   */
  _compileFunc(node) {
    const name = node._type;
    const info = OpInfo.get(name);

    // Check if the function is known and if it has specialized compiler.
    if (info !== null && info.compile !== null)
      return info.compile(this, node);
    else
      return this._compileFuncImpl(name, node._as, node._flags, node._values);
  }

  _compileFuncImpl(name, as, flags, args) {
    var out = "";

    for (var i = 0, len = args.length; i < len; i++) {
      const value = args[i];
      const escaped = this.escapeValue(value);

      if (out)
        out += ", ";
      out += escaped;
    }

    // Compile `DISTINCT` if specified.
    if (flags & NodeFlags.kDistinct)
      out = "DISTINCT " + out;

    // Form the function including an alias.
    out = name + "(" + out + ")";
    if (as)
      out += " AS " + this.escapeIdentifier(as);
    return out;
  }

  _compileAs(exp, as) {
    return as ? "(" + exp +") AS " + this.escapeIdentifier(as) : exp;
  }

  /**
   * Compiles SELECT.
   *
   * @param {xql.node.SelectQuery} node Select node.
   * @return {string} Compiled SELECT.
   *
   * @private
   */
  _compileSelect(node) {
    var out = "SELECT";

    const space = this._NL;
    const flags = node._flags;

    const offset = node._offset;
    const limit = node._limit;
    const hasLimit = offset !== 0 || limit !== 0;

    // Compile `SELECT [ALL|DISTINCT]`
    //
    // Use `*` if  fields are not used.
    if (flags & NodeFlags.kDistinct)
      out += " DISTINCT";

    // Compile `[*|fields]`
    //
    // Note, `*` is only used if there are no columns specified.
    const cols = node._fieldsOrReturning;
    out += this.concat(cols && cols.length ? this._compileFields(cols) : "*");

    // Compile `FROM table[, table[, ...]]` or `FROM table JOIN table [, JOIN ...]`.
    const from = node._fromOrUsing;
    if (from)
      out += space + "FROM" + this.concat(this._compileFromOrUsing(from));

    // Compile `WHERE ...`.
    const where = node._where;
    if (where && where._values.length)
      out += space + "WHERE" + this.concat(this._compileWhereOrHaving(where));

    // Compile `GROUP BY ...`.
    const groupBy = node._groupBy;
    if (groupBy && groupBy.length)
      out += space + "GROUP BY" + this.concat(this._compileGroupBy(groupBy));

    // Compile `HAVING ...`.
    const having = node._having;
    if (having && having._values.length)
      out += space + "HAVING" + this.concat(this._compileWhereOrHaving(having));

    // TODO: Compile `WINDOW ...`.

    // Compile `ORDER BY ...`.
    const orderBy = node._orderBy;
    if (orderBy && orderBy.length)
      out += space + "ORDER BY" + this.concat(this._compileOrderBy(orderBy));

    // Compile `OFFSET ...` / `LIMIT ...`.
    if (hasLimit)
      out += space + this._compileOffsetLimit(offset, limit);

    // TODO: Compile `FETCH ...`.
    // TODO: Compile `FOR ...`.

    return out;
  }

  /**
   * Compiles INSERT.
   *
   * @param {xql.node.InsertQuery} node Insert node.
   * @return {string} Compiled INSERT.
   *
   * @private
   */
  _compileInsert(node) {
    var out = "";
    var t = "";

    var k;
    var i, len;

    const NL = this._NL;

    const table = node._table;
    const columns = node._columns;
    const returning = node._fieldsOrReturning || emptyArray;
    const typeMapping = node._typeMapping || EmptyObject;

    const features = this.features;
    const hasReturning = features.returning && returning.length !== 0;

    // Compile `INSERT INTO table (...)`.
    if (!table)
      throwCompileError("InsertQuery.compileNode() - Table not defined");

    if (typeof table === "string")
      t = this.escapeIdentifier(table);
    else
      t = table.compileNode(this);

    for (k in columns) {
      if (out) out += ", ";
      out += this.escapeIdentifier(k);
    }
    out = "INSERT INTO" + this.concat(t + " (" + out + ")");

    // Compile `VALUES (...)[, (...)]`.
    const objects = node._values;
    const prefix = (this.pretty ? this._CONCAT_STR : " ") + "(";

    out += NL + "VALUES";
    for (i = 0, len = objects.length; i < len; i++) {
      const object = objects[i];

      t = "";
      for (k in columns) {
        if (t) t += ", ";
        if (hasOwn.call(object, k))
          t += this.escapeValue(object[k], typeMapping[k]);
        else
          t += "DEFAULT";
      }

      if (i !== 0) out += ",";
      out += prefix + t + ")";
    }

    // Compile `RETURNING ...`.
    if (hasReturning)
      out += NL + "RETURNING" + this.concat(this._compileReturning(returning));

    return out;
  }

  /**
   * Compiles UPDATE.
   *
   * @param {xql.node.UpdateQuery} node Update node.
   * @return {string} Compiled UPDATE.
   *
   * @private
   */
  _compileUpdate(node) {
    var out = "";
    var t = "";

    const NL = this._NL;
    const COMMA = this._COMMA;

    const table = node._table;
    const returning = node._fieldsOrReturning || emptyArray;

    const features = this.features;
    const hasReturning = features.returning && returning.length !== 0;

    // Compile `UPDATE ...`
    if (!table)
      throwCompileError("UpdateQuery.compileNode() - Table not defined");

    if (typeof table === "string")
      t = this.escapeIdentifier(table);
    else
      t = table.compileNode(this);
    out = "UPDATE" + this.concat(t);

    // Compile `SET ...`
    const objects = node._values;

    if (!objects)
      throwCompileError("UpdateQuery.compileNode() - No data to update provided");

    if (objects.length !== 1)
      throwCompileError("UpdateQuery.compileNode() - Can only update one record (" + objects.length + " provided)");

    const values = objects[0];
    const typeMapping = node._typeMapping || EmptyObject;

    t = "";
    for (var k in values) {
      var value = values[k];
      var compiled;

      if (!(value instanceof Node))
        compiled = this.escapeValue(value, typeMapping[k]);
      else
        compiled = value.compileNode(this);

      if (t) t += COMMA;
      t += this.escapeIdentifier(k) + " = " + compiled;
    }
    out += NL + "SET" + this.concat(t);

    // Compile `FROM table[, table[, ...]]` or `FROM table JOIN table [, JOIN ...]`.
    const from = node._fromOrUsing;
    if (from)
      out += NL + "FROM"  + this.concat(this._compileFromOrUsing(from));

    // Compile `WHERE ...`.
    const where = node._where;
    if (where && where._values.length)
      out += NL + "WHERE" + this.concat(this._compileWhereOrHaving(where));

    // Compile `OFFSET ...` / `LIMIT ...`.
    const offset = node._offset;
    const limit = node._limit;

    if (offset || limit)
      out += NL + this._compileOffsetLimit(offset, limit);

    // Compile `RETURNING ...`.
    if (hasReturning)
      out += NL + "RETURNING" + this.concat(this._compileReturning(returning));

    return out;
  }

  /**
   * Compiles DELETE.
   *
   * @param {xql.node.DeleteQuery} node Delete node.
   * @return {string} Compiled DELETE.
   *
   * @private
   */
  _compileDelete(node) {
    var out = "";
    var t = "";

    const NL = this._NL;

    const table = node._table;
    const returning = node._fieldsOrReturning || emptyArray;

    const features = this.features;
    const hasReturning = features.returning && returning.length !== 0;

    // Compile `DELETE FROM ...`
    if (!table)
      throwCompileError("DeleteQuery.compileNode() - Table not defined");

    if (typeof table === "string")
      t = this.escapeIdentifier(table);
    else
      t = table.compileNode(this);

    out += "DELETE FROM" + this.concat(t);

    // Compile `USING table[, table[, ...]]` or `USING table JOIN table [, JOIN ...]`.
    const using = node._fromOrUsing;
    if (using)
      out += NL + "USING" + this.concat(this._compileFromOrUsing(using));

    // Compile `WHERE ...`
    const where = node._where;
    if (where && where._values.length)
      out += NL + "WHERE" + this.concat(this._compileWhereOrHaving(where));

    // Compile `OFFSET ...` / `LIMIT ...`.
    const offset = node._offset;
    const limit = node._limit;

    if (offset || limit)
      out += NL + this._compileOffsetLimit(offset, limit);

    // Compile `RETURNING ...`.
    if (hasReturning)
      out += NL + "RETURNING" + this.concat(this._compileReturning(returning));

    return out;
  }

  /**
   * Compiles compound query (UNION, INTERSECT, EXCEPT).
   *
   * @param {xql.node.CompoundQuery} node Compound node.
   * @return {string} Compiled compound query.
   *
   * @private
   */
  _compileCompound(node) {
    var out = "";

    const space = this._NL;

    const flags = node._flags;
    var combineOp = node._type;

    if (flags & NodeFlags.kAll)
      combineOp += " ALL";

    const values = node._values;
    const separator = space + combineOp + space;

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var compiled = this.escapeValue(value);

      if (out)
        out += separator;

      // TODO: This is not nice, introduce something better than this.
      const mustWrap = !(value instanceof Query) || (value instanceof CompoundQuery);
      if (mustWrap)
        compiled = this._wrapQuery(compiled);

      out += compiled;
    }

    // Compile `ORDER BY ...`.
    const orderBy = node._orderBy;
    if (orderBy && orderBy.length)
      out += space + "ORDER BY" + this.concat(this._compileOrderBy(orderBy));

    // Compile `OFFSET ...` / `LIMIT ...`.
    const offset = node._offset;
    const limit = node._limit;

    if (offset || limit)
      out += space + this._compileOffsetLimit(offset, limit);

    return out;
  }

  _compileJoin(node) {
    var out = "";

    var type = node._type;
    var keyword = "";

    switch (type) {
      case ""     : // ... Fall through ...
      case "CROSS": keyword = " CROSS JOIN "      ; break;
      case "INNER": keyword = " INNER JOIN "      ; break;
      case "LEFT" : keyword = " LEFT OUTER JOIN " ; break;
      case "RIGHT": keyword = " RIGHT OUTER JOIN "; break;
      case "FULL" : keyword = " FULL OUTER JOIN " ; break;

      // In case that the `JOIN` is backend specific.
      default:
        keyword = " " + type + " JOIN ";
        break;
    }

    var lo = node._left;
    var ro = node._right;

    var left = typeof lo === "string" ? this.escapeIdentifier(lo) : lo.compileNode(this);
    var right = typeof ro === "string" ? this.escapeIdentifier(ro) : ro.compileNode(this);

    out = left + keyword + right;

    // Compile `USING (...)` clause.
    var condition = node._condition;
    if (isArray(condition)) {
      var t = "";

      for (var i = 0, len = condition.length; i < len; i++) {
        var identifier = condition[i];

        if (t)
          t += ", ";

        if (typeof identifier === "string")
          t += this.escapeIdentifier(identifier);
        else
          t += identifier.compileNode(this);
      }

      if (t)
        out += " USING (" + t + ")";
    }
    // Compile `ON ...` clause.
    else if (condition instanceof Node) {
      out += " ON " + condition.compileNode(this);
    }

    var as = node._as;
    if (as)
      out += " AS " + this.escapeIdentifier(as);

    return out;
  }

  _compileSort(node) {
    var out;

    const value = node._value;
    const flags = node._flags;

    // Value of type:
    //   - `number` - describes column order,
    //   - `string` - describes column name.
    //   - `Node`   - SQL expression/column.
    if (typeof value === "number")
      out = this.escapeNumber(value);
    else if (typeof value === "string")
      out = this.escapeIdentifier(value);
    else if (value instanceof Node)
      out = value.compileNode(this);
    else
      throwCompileError("Sort.compileNode() - Invalid value type " + typeof value);

    const sortOrder = (flags & NodeFlags.kAscending ) ? " ASC"  :
                      (flags & NodeFlags.kDescending) ? " DESC" : "";

    if ((flags & (NodeFlags.kNullsFirst | NodeFlags.kNullsLast)) === 0)
      return out + sortOrder;

    const features = this.features;
    const nullsFirst = flags & NodeFlags.kNullsFirst ? true : false;

    if (features.nullsFirstLast)
      return out + sortOrder + (nullsFirst ? " NULLS FIRST" : " NULLS LAST");

    // Unsupported `NULLS FIRST` and `NULLS LAST`. The best we can do is to omit
    // it completely if the DB sorts the records the requested way by default.
    const nullsFirstByDB = features.nullsSortBottom
      ? (flags & NodeFlags.kDescending) !== 0
      : (flags & NodeFlags.kDescending) === 0;

    if (nullsFirst === nullsFirstByDB)
      return out + sortOrder;

    // Okay, we want the opposite of what DB does, one more expression
    // that precedes the current one is needed: `<column> IS [NOT] NULL`.
    if (nullsFirst)
      return "(" + out + " IS NOT NULL)" + this._COMMA + out + sortOrder;
    else
      return "(" + out + " IS NULL)"     + this._COMMA + out + sortOrder;
  }

  _compileGroupBy(groupBy) {
    var out = "";
    var COMMA = this._COMMA;

    for (var i = 0, len = groupBy.length; i < len; i++) {
      var group = groupBy[i];
      if (out) out += COMMA;

      // Group can be in a form of `string` or `Node`.
      if (typeof group === "string")
        out += this.escapeIdentifier(group);
      else
        out += group.compileNode(this);
    }

    return out;
  }

  _compileOrderBy(orderBy) {
    var out = "";
    var COMMA = this._COMMA;

    for (var i = 0, len = orderBy.length; i < len; i++) {
      var sort = orderBy[i];
      if (out) out += COMMA;
      out += sort.compileNode(this);
    }

    return out;
  }

  _compileFields(list) {
    var out = "";
    var COMMA = this._COMMA;

    for (var i = 0, len = list.length; i < len; i++) {
      var column = list[i];
      if (out) out += COMMA;

      // Compile column identifier or expression.
      if (typeof column === "string") {
        out += this.escapeIdentifier(column);
      }
      else {
        var compiled = column.compileNode(this);
        if (column.mustWrap())
          out += this._wrapQuery(compiled);
        else
          out += compiled;
      }
    }

    return out;
  }

  _compileReturning(list) {
    return this._compileFields(list);
  }

  _compileFromOrUsing(node) {
    if (typeof node === "string")
      return this.escapeIdentifier(node);
    else
      return node.compileNode(this);
  }

  _compileWhereOrHaving(condition) {
    var out = "";

    var list = condition._values;
    var i, len = list.length;

    if (len === 1)
      return list[0].compileNode(this);

    for (i = 0; i < len; i++) {
      var expression = list[i];
      var compiled = expression.compileNode(this);

      if (out)
        out += " " + condition._type + " ";

      if (expression.mustWrap())
        out += "(" + compiled + ")";
      else
        out += compiled;
    }

    return out;
  }

  _compileOffsetLimit(offset, limit) {
    var out = "";

    if (limit)
      out += "LIMIT " + limit;

    if (offset) {
      if (out) out += " ";
      out += "OFFSET " + offset;
    }

    return out;
  }

  _wrapQuery(str) {
    if (this.pretty)
      return "(" + indent(str + ")", " ").substr(1);
    else
      return "(" + str + ")";
  }

  /**
   * Called whenever some property is changed to update all computed properties.
   *
   * @private
   */
  _update() {
    const compact = !this.pretty;
    const features = this.features;

    this._DB_TRUE    = features.nativeBoolean ? "TRUE"  : "1";
    this._DB_FALSE   = features.nativeBoolean ? "FALSE" : "0";

    this._NL         = compact ? " "  : "\n";
    this._COMMA      = compact ? ", " : ",\n";
    this._INDENT     = compact ? ""   : " ".repeat(this.indentation);
    this._CONCAT_STR = compact ? " "  : this._NL + this._INDENT;

    this.indent    = compact ? this._indent$none : this._indent$pretty;
    this.concat    = compact ? this._concat$none : this._concat$pretty;

    var qs = this.features.quoteStyle;

    if (qs === QuoteStyle.kDouble) {
      this._IDENT_CHECK  = /[\.\"\x00]/g;
      this._IDENT_BEFORE = "\"";
      this._IDENT_AFTER  = "\"";
    }

    if (qs === QuoteStyle.kGrave) {
      this._IDENT_CHECK  = /[\.\`\x00]/g;
      this._IDENT_BEFORE = "`";
      this._IDENT_AFTER  = "`";
    }

    if (qs === QuoteStyle.kBrackets) {
      this._IDENT_CHECK  = /[\.\[\]\x00]/g;
      this._IDENT_BEFORE = "[";
      this._IDENT_AFTER  = "]";
    }
  }

  /**
   * Indents a given string `s` by the Context's indentation settings if pretty
   * print is enabled, otherwise does nothing.
   *
   * @param {string} s String to indent.
   * @return {string} Indented string if indentation is enabled or unchanged `s`.
   *
   * @function
   * @alias xql.dialect.Context.prototype.indent
   */
  _indent$none(s) {
    return s;
  }

  _indent$pretty(s) {
    var INDENT = this._INDENT;
    return INDENT + s.replace(reNewLine, "\n" + INDENT);
  }

  /**
   * TODO: Change the name
   *
   * Called before a string `s` is concatenated into a SQL expression in a way
   * that may require a new line if pretty printing is enabled. It returns the
   * original string prefixed with a space or a line break and possibly indented.
   *
   * @param {string} s Input string to process.
   * @return {string} Possibly modified string.
   *
   * @function
   * @alias xql.dialect.Context.prototype.concat
   */
  _concat$none(s) {
    return " " + s;
  }

  _concat$pretty(s) {
    var _CONCAT_STR = this._CONCAT_STR;
    return _CONCAT_STR + s.replace(reNewLine, _CONCAT_STR);
  }
}
xql$dialect.Context = Context;

// ============================================================================
// [xql.dialect.pgsql]
// ============================================================================

(function() {

const reEscapeChars = /[\x00-\x1F\'\\]/g;
const reSubstituteChars = /[\"\$\'\?]/g;

function fnEscapeString(s) {
  var c = s.charCodeAt(0);
  switch (c) {
    case  0: throwCompileError("String can't contain NULL character");
    case  8: return "\\b";
    case  9: return "\\t";
    case 10: return "\\n";
    case 12: return "\\f";
    case 13: return "\\r";
    case 39: return "\\'";
    case 92: return "\\\\";
    default: return "\\x" + (c >> 4).toString(16) + (c & 15).toString(16);
  }
}

/**
 * PostgreSQL compiler.
 *
 * @private
 */
class PGSQLContext extends Context {
  constructor(options) {
    super("pgsql", options);

    // Setup Postgres features.
    Object.assign(this.features, {
      nativeBoolean  : true,
      nativeArray    : true,
      nullsFirstLast : true,
      nullsSortBottom: true,
      returning      : true,
      specialNumbers : true
    });

    // Setup Postgres specific.
    this._DB_POS_INF = "'Infinity'";
    this._DB_NEG_INF = "'-Infinity'";
    this._DB_NAN     = "'NaN'";

    this._update();
  }

  /** @override */
  escapeString(value) {
    var oldLength = value.length;
    value = value.replace(reEscapeChars, fnEscapeString);

    if (value.length !== oldLength) {
      // We have to tell Postgres explicitly that the string is escaped by a
      // C-style escaping sequence(s).
      return "E'" + value + "'";
    }
    else {
      // String doesn't contain any character that has to be escaped. We can
      // use simply '...'.
      return "'" + value + "'";
    }
  }

  /** @override */
  escapeBuffer(value) {
    return "E'\\x" + blobToHex(value) + "'";
  }

  /** @override */
  escapeArray(value, nested) {
    var out = "";
    var i = 0, len = value.length;

    if (len === 0)
      return "'{}'";

    do {
      var element = value[i];
      if (out) out += ", ";

      if (isArray(element))
        out += this.escapeArray(element, true);
      else
        out += this.escapeValue(element);
    } while (++i < len);

    if (nested)
      return "[" + out + "]";
    else
      return "ARRAY[" + out + "]";
  }

  /** @override */
  substitute(query, bindings) {
    var input = "";
    var output = "";

    if (typeof query === "string")
      input = query;
    else if (query instanceof Node)
      input = query.compileNode(this);
    else
      input = query.toString();

    var i = input.search(reSubstituteChars);
    if (i === -1)
      return input;

    var len = input.length;
    var iStart = 0;

    // Substitution mode:
    //   0  - Not set.
    //   36 - `$`.
    //   63 - `?`.
    var mode = 0;

    // Bindings index, incremented if query contains `?` or parsed if `$`.
    var bIndex = 0;
    // Count of bindings available.
    var bLength = bindings.length;

    while (i < len) {
      var c = input.charCodeAt(i);
      i++;

      // Check if the character is one of the following:
      //   " - 34
      //   $ - 36
      //   ' - 39
      if (c <= 39) {
        // Parse `"` - `"..."` section. Skip until the closing `"`.
        //
        // The only possible escaping sequence here is `""`.
        if (c === 34) {
          for (;;) {
            // Stop at the end of the string.
            if (i === len)
              break;

            c = input.charCodeAt(i);
            i++;

            // Skip anything that is not `"`.
            //
            // `"` === 34
            if (c !== 34)
              continue;

            // Stop at the end of the string.
            if (i === len)
              break;

            // Only continue if this is an escape sequence `""`.
            //
            // `"` === 34
            c = input.charCodeAt(i);
            if (c !== 34)
              break;

            i++;
          }
        }

        // Parse `'` - `'...'` section; skip until the closing `'`.
        //
        // There are several possibilities of escaping.
        //
        //   a) If the string starts with `E` prefix, it is using C-like escaping
        //      sequence `\?` where `\` is an escape prefix and `?` is the
        //      character.
        //
        //   b) If the string doesn't start with `E` prefix it is using SQL
        //      escaping, which escapes `''` to `'`.
        else if (c === 39) {
          // 'E' === 69.
          // 'e' === 101.
          //
          // We have to check `i - 2`, because `i` has been incremented already.
          // The expression `(x & ~32)` makes ASCII character `x` lowercased.
          if (i >= 2 && (input.charCodeAt(i - 2) & ~32) === 69) {
            // TODO: Add support for binary in form `E'\x`

            // a) String is escaped by using C-like (vendor-specific) escaping.
            for (;;) {
              // Stop at the end of the string.
              if (i >= len)
                break;

              c = input.charCodeAt(i);
              i++;

              // Break if matching `'` has been found.
              //
              // `'` === 39
              if (c === 39)
                break;

              // Continue if the character is not an escaping sequence `\\`.
              //
              // `\\` === 92.
              if (c !== 92)
                continue;

              // Next character is ignored.
              i++;
            }
          }
          else {
            // b) String is escaped by using plain SQL escaping.
            for (;;) {
              // Stop at the end of the string.
              if (i === len)
                break;

              c = input.charCodeAt(i);
              i++;

              // Skip anything that is not `'`.
              //
              // `'` === 39
              if (c !== 39)
                continue;

              // Stop at the end of the string.
              if (i === len)
                break;

              // Only continue if this is an escape sequence `''`.
              //
              // `'` === 39
              c = input.charCodeAt(i);
              if (c !== 39)
                break;

              i++;
            }
          }
        }

        // Parse `$`.
        else if (c === 36) {
          if (mode !== c) {
            if (mode !== 0) {
              throwCompileError("Substitute() - Mixed substitution marks, " +
                "initial '" + String.fromCharCode(mode) + "'" +
                "is followed by '" + String.fromCharCode(c) + "'");
            }
            mode = c;
          }

          // Flush accumulated input.
          output += input.substring(iStart, i - 1);

          bIndex = 0;
          iStart = i;

          // Parse the number `[0-9]+` directly to `bIndex`.
          while (i < len) {
            c = input.charCodeAt(i);
            // `0` === 48
            // `9` === 57
            if (c < 48 || c > 57)
              break;

            bIndex = bIndex * 10 + (c - 48);
            if (bIndex > bLength)
              throwCompileError("Substitute() - Index '" + bIndex + "' of range (" + bLength + ")");
            i++;
          }

          if (bIndex === 0)
            throwCompileError("Substitute() - Index can't be zero");
          bIndex--;

          if (iStart === i)
            throwCompileError("Substitute() - Missing number after '$' mark");

          // Substitute.
          output += this.escapeValue(bindings[bIndex]);
          iStart = i;
        }
      }
      // Check if the character is a question mark (63).
      else if (c === 63) {
        // Basically a duplicate from `$`.
        if (mode !== c) {
          if (mode !== 0) {
            throwCompileError("Substitute() - Mixed substitution marks, " +
              "initial '" + String.fromCharCode(mode) + "'" +
              "is followed by '" + String.fromCharCode(c) + "'");
          }
          mode = c;
        }

        if (bIndex >= bLength)
          throwCompileError("Substitute() - Index '" + bIndex + "' out of range (" + bLength + ")");

        // Flush accumulated input.
        output += input.substring(iStart, i - 1);

        // Substitute.
        output += this.escapeValue(bindings[bIndex]);

        // Advance.
        iStart = i;
        bIndex++;
      }
    }

    // Don't call substring() if nothing have changed.
    if (iStart === 0)
      return input;

    // Flush the remaining input (if any).
    if (iStart !== len)
      output += input.substring(iStart);

    return output;
  }
}
xql$dialect.add("pgsql", PGSQLContext);

})();

// ============================================================================
// [xql.dialect.mysql]
// ============================================================================

(function() {

const reEscapeChars = /[\x00\b\t\n\r\x1A\'\\]/g;

function fnEscapeString(s) {
  var c = s.charCodeAt(0);
  switch (c) {
    case  0: return "\\0";
    case  8: return "\\b";
    case  9: return "\\t";
    case 10: return "\\n";
    case 13: return "\\r";
    case 26: return "\\Z";
    case 39: return "''";
    case 92: return "\\\\";
  }
}

/**
 * MySQL/MariaDB compiler.
 *
 * @private
 */
class MySQLContext extends Context {
  constructor(options) {
    super("mysql", options);

    Object.assign(this.features, {
      quoteStyle    : QuoteStyle.kGrave,
      nativeBoolean : true
    });

    this._update();
  }

  /** @override */
  escapeString(value) {
    return "'" + value.replace(reEscapeChars, fnEscapeString) + "'";
  }

  /** @override */
  _compileOffsetLimit(offset, limit) {
    // Compile either `LIMIT <limit>` or `LIMIT <offset>, <limit>`.
    const limitStr = limit ? String(limit) : "18446744073709551615";
    if (offset === 0)
      return "LIMIT " + limitStr;
    else
      return "LIMIT " + offset + ", " + limitStr;
  }
}
xql$dialect.add("mysql", MySQLContext);

})();

// ============================================================================
// [xql.dialect.sqlite]
// ============================================================================

(function() {

/**
 * SQLite compiler.
 *
 * @private
 */
class SQLiteContext extends Context {
  constructor(options) {
    super("sqlite", options);

    this._update();
  }

  /** @override */
  escapeString(value) {
    var out = "";

    var i = 0;
    var m = 0;
    var len = value.length;

    if (!len)
      return "''";

    var c = value.charCodeAt(0);
    while (i < len) {
      if (c < 32) {
        // Blob part.
        if (i === 0)
          out += "''"; // Edge case, always form TEXT, not BLOB.
        out += "||x'";

        do {
          out += (c >> 4).toString(16) + (c & 15).toString(16);
          if (++i >= len)
            break;
          c = value.charCodeAt(i);
        } while (c < 32);
        out += "'";
      }
      else {
        // Text part.
        out += out ? "||'" : "'";
        if (c === 39)
          out += "'";
        m = i;

        for (;;) {
          if (++i >= len)
            break;

          c = value.charCodeAt(i);
          if (c > 39) continue;
          if (c < 32) break;

          if (c === 39) {
            out += value.substring(m, i + 1);
            m = i;
          }
        }

        out += value.substring(m, i) + "'";
      }
    }

    return out;
  }

  /** @override */
  _compileOffsetLimit(offset, limit) {
    // Compile `LIMIT <limit> OFFSET <offset>`.
    const limitStr = limit ? String(limit) : "-1";
    const offsetStr = String(offset);

    if (offset === 0)
      return "LIMIT " + limitStr;
    else
      return "LIMIT " + limitStr + " OFFSET " + offsetStr;
  }
}
xql$dialect.add("sqlite", SQLiteContext);

})();

// ============================================================================
// [xql.node]
// ============================================================================

/**
 * SQL nodes namespace.
 *
 * @namespace
 * @alias xql.node
 */
const xql$node = xql.node = {};

/**
 * SQL node - basic building block that implements the SQL's expression tree.
 *
 * `Node` doesn't have any functionality and basically only initializes `_type`,
 * `_flags` and `_as` members. Classes that inherit `Node` can omit calling
 * `Node`'s constructor for performance reasons, but if you do so, please
 * always initialize members in a `[_type, _flags, _as]` order.
 *
 * @param {string} type Type of the node.
 * @param {as} as Node alias as specified by SQL's `AS` keyword.
 *
 * @alias xql.node.Node
 */
class Node {
  constructor(type, as) {
    this._type = type || "";
    this._flags = 0;
    this._as = as || "";
  }

  /**
   * Returns whether the returned expression must be wrapped in parentheses if
   * not alone.
   *
   * @param {Context} ctx Context.
   * @return {boolean} Whether the expression must be wrapped.
   */
  mustWrap(ctx) {
    throwTypeError("Abstract method called");
  }

  /**
   * Returns whether the compiled node can be executed, i.e. the `Node` provides
   * `compileQuery()`, which returns a valid SQL statement containing semicolon.
   *
   * @note There is not a base class for nodes which can execute, this getter
   * uses reflection and dynamically checks if `compileQuery` is provided and
   * returns `true` on success.
   *
   * @return {boolean} Whether the result of `compileQuery()` query can be executed.
   */
  canExecute() {
    return this.compileQuery !== Node.prototype.compileQuery;
  }

  /**
   * Compiles the whole by using `compileNode()` and adds a semicolon ';' at the
   * end.
   *
   * @note This function is abstract by default and only added by nodes which can
   * be executed. Use `Node.canExecute()` method to check whether the node can
   * actually be executed, i.e. compiles into a valid SQL that can be executed.
   *
   * @param {Context} ctx Context.
   * @return {string} SQL query.
   */
  compileQuery(ctx) {
    throwTypeError("Abstract method called");
  }

  /**
   * Compiles the node into a valid SQL string.
   *
   * @note This function is reimplemented by each `Node` and provides a foundation
   * to compile building blocks of the query independently. The string returned
   * doesn't have to be functional alone, however, it will function if combined
   * with the rest of the expression tree.
   *
   * @param {Context} ctx Context.
   * @return {string} SQL string.
   */
  compileNode(ctx) {
    throwTypeError("Abstract method called");
  }

  /**
   * Gets the type of the node.
   *
   * @return {string} Type of the node.
   */
  getType() {
    return this._type;
  }

  /**
   * Sets the type of the node.
   *
   * @note The type of the node should be always set when the Node is created.
   * This setter is provided for some edge use-cases, use at your own risk.
   *
   * @param {string} type Type of the node.
   * @return {this}.
   */
  setType(type) {
    this._type = type;
    return this;
  }

  /**
   * Gets whether the node contains the given `flag`.
   *
   * @return {boolean} Whether the flag is enabled or disabled.
   */
  getFlag(flag) {
    return (this._flags & flag) !== 0;
  }

  /**
   * Sets a node `flag`.
   *
   * @param {number} flag Flag to set.
   * @return {this}
   */
  setFlag(flag) {
    this._flags |= flag;
    return this;
  }

  /**
   * Clears a node `flag`.
   *
   * @param {number} flag Flag to clear.
   * @return {this}
   */
  clearFlag(flag) {
    this._flags &= ~flag;
    return this;
  }

  /**
   * Replaces the `flagToClear` flag with `flagToSet` flag.
   *
   * @param {number} flagToClear Flag to clear.
   * @param {number} flagToSet Flag to set.
   * @return {this}
   */
  replaceFlag(flagToClear, flagToSet) {
    this._flags = (this._flags & ~flagToClear) | flagToSet;
    return this;
  }

  /**
   * Gets the alias of the node or expression, which compiles as `AS ...`.
   *
   * @return {string} SQL alias.
   */
  getAlias() {
    return this._as;
  }

  /**
   * Sets the alias of the node or expression, which compiles as `AS ...`.
   *
   * @note Not all SQL nodes support aliases. It's mostly for SELECT columns.
   *
   * @param {string} as SQL alias.
   * @return {this}
   */
  setAlias(as) {
    this._as = as;
    return this;
  }

  /**
   * The same as calling `setAlias(as)`.
   *
   * @param {string} as SQL alias.
   * @return {this}
   */
  AS(as) {
    this._as = as;
    return this;
  }

  EQ(b) { return BINARY_OP(this, "=", b); }
  NE(b) { return BINARY_OP(this, "<>", b); }
  LT(b) { return BINARY_OP(this, "<", b); }
  LE(b) { return BINARY_OP(this, "<=", b); }
  GT(b) { return BINARY_OP(this, ">", b); }
  GE(b) { return BINARY_OP(this, ">=", b); }

  // Returns a new Node which contains `this IN b` expression.
  IN(b) {
    const len = arguments.length;
    if (len > 1) {
      b = slice.call(arguments, 0);
    }
    else if (len === 1) {
      if (!isArray(b))
        b = [b];
    }
    else {
      b = [];
    }

    return BINARY_OP(this, "IN", b);
  }

  // Returns a new Node which contains `this BETWEEN a AND b` expression
  BETWEEN(a, b) {
    return xql.BETWEEN(this, a, b);
  }
}
xql$node.Node = Node;

/**
 * SQL RAW expression.
 *
 * @param {string} expression Expression string.
 * @param {array=} bindings Bindings array used by the expression.
 *
 * @alias xql.node.Raw
 */
class Raw extends Node {
  constructor(expression, bindings) {
    super("RAW", "");
    this._value = expression || "";
    this._bindings = bindings || null;
  }

  /** @override */
  mustWrap(ctx) {
    return false;
  }

  /** @override */
  compileQuery(ctx) {
    return this.compileNode(ctx) + ";";
  }

  /** @override */
  compileNode(ctx) {
    var out = this._value;

    var bindings = this._bindings;
    if (bindings)
      out = ctx.substitute(out, bindings);

    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);

    return out;
  }

  /**
   * Gets the raw expression.
   *
   * @return {string}.
   */
  getExpression() {
    return this._value;
  }

  /**
   * Sets the raw expression to `expression`.
   *
   * @param {string} expression Raw expression.
   * @return {this}.
   */
  setExpression(expression) {
    this._value = expression;
    return this;
  }

  /**
   * Gets the raw expression's bindings or `null` if no bindings are provided.
   *
   * @return {?array}
   */
  getBindings() {
    return this._bindings;
  }

  /**
   * Sets the raw expression's bindings.
   *
   * @param {?array} bindings The raw expression's bindings, `null` to disable.
   * @return {this}
   */
  setBindings(bindings) {
    this._bindings = bindings || null;
    return this;
  }
}
xql$node.Raw = Raw;

/**
 * SQL unary node.
 *
 * @alias xql.node.UnaryOp
 */
class Unary extends Node {
  constructor(type, value) {
    super(type, "");
    this._value = value;
  }

  /** @override */
  mustWrap(ctx) {
    return false;
  }

  /**
   * Gets the unary (child) value.
   *
   * @return {*}
   */
  getValue() {
    return this._value;
  }

  /**
   * Sets the unary (child) value to `value`.
   *
   * @param {*} value A new (child) value.
   * @return {this}
   */
  setValue(value) {
    this._value = value;
    return this;
  }
}
xql$node.Unary = Unary;

/**
 * SQL unary operator.
 *
 * @alias xql.node.UnaryOp
 */
class UnaryOp extends Unary {
  /** @override */
  compileNode(ctx) {
    return ctx._compileUnaryOp(this);
  }
}
xql$node.UnaryOp = UnaryOp;

/**
 * SQL binary node.
 *
 * @alias xql.node.Binary
 */
class Binary extends Node {
  constructor(left, type, right, as) {
    super(type, as);
    this._left = left;
    this._right = right;
  }

  /**
   * Gets the left node or value.
   *
   * @return {*}
   */
  getLeft() {
    return this._left;
  }

  /**
   * Sets the left node or value.
   *
   * @param {*} value Left node or value.
   * @return {this}
   */
  setLeft(value) {
    this._left = value;
    return this;
  }

  /**
   * Adds a `value` to the left node, which must be array or compatible.
   *
   * @param {*} value Value to add.
   * @return {this}
   */
  addLeft(value) {
    var left = this._left;
    if (!left || typeof left.push !== "function")
      throwCompileError("Binary.addLeft() - Left operand is not array or compatible");

    left.push(value);
    return this;
  }

  /**
   * Gets the right node or value.
   *
   * @return {*}
   */
  getRight() {
    return this._right;
  }

  /**
   * Sets the right node or value.
   *
   * @param {*} value Right node or value.
   * @return {this}
   */
  setRight(right) {
    this._right = right;
    return this;
  }

  /**
   * Adds a `value` to the right node, which must be array or compatible.
   *
   * @param {*} value Value to add.
   * @return {this}
   */
  addRight(value) {
    var right = this._right;
    if (!right || typeof right.push !== "function")
      throwCompileError("Binary.addRight() - Right operand is not array or compatible");

    right.push(value);
    return this;
  }
}
xql$node.Binary = Binary;

/**
 * SQL binary operator.
 *
 * @alias xql.node.BinaryOp
 */
class BinaryOp extends Binary {
  constructor(left, type, right, as) {
    super(left, type, right, as);
  }

  /** @override */
  mustWrap(ctx) {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileBinaryOp(this);
  }
}
xql$node.BinaryOp = BinaryOp;

/**
 * A node that can have children (base for `Logical` and `Func`).
 *
 * @alias xql.node.NodeArray
 */
class NodeArray extends Node {
  constructor(type, values) {
    super(type, "");
    this._values = values || [];
  }

  /**
   * Append nodes or other data to the node.
   *
   * @note Behaves same as `Array.push()`.
   *
   * @param {...*} va Variable arguments.
   * @return {this}
   */
  push() {
    var values = this._values;
    for (var i = 0, len = arguments.length; i < len; i++)
      values.push(arguments[i]);
    return this;
  }

  concat(array) {
    var values = this._values;
    for (var i = 0, len = array.length; i < len; i++)
      values.push(array[i]);
    return this;
  }
}
xql$node.NodeArray = NodeArray;

/**
 * SQL logical expression.
 *
 * @alias xql.node.Logical
 */
class Logical extends NodeArray {
  mustWrap(ctx) {
    return this._values.length > 1;
  }

  /** @override */
  compileNode(ctx) {
    var type = this._type;
    var out = "";

    var values = this._values;
    var separator = " " + type + " ";

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = ctx.escapeValue(value);

      if (out)
        out += separator;

      if (value.mustWrap(ctx))
        out += "(" + escaped + ")";
      else
        out += escaped;
    }

    return out;
  }
}
xql$node.Logical = Logical;

/**
 * Node that holds conditional expressions stored in a JS object, where each
 * key represents table column and each value is the condition's expression.
 *
 * This node has been introduced as a low-overhead node that just holds the
 * passed object. All expressions are implicitly joined by logical `AND` or
 * `OR` operator.
 *
 * @alias xql.node.ConditionMap
 */
class ConditionMap extends Unary {
  /** @override */
  compileNode(ctx) {
    var out = "";

    var separator = " " + this._type + " ";
    var columns = this._value;

    for (var k in columns) {
      var value = columns[k];
      var compiled = ctx.escapeValue(value);

      if (out)
        out += separator;
      out += ctx.escapeIdentifier(k);

      if (compiled === "NULL")
        out += " IS ";
      else
        out += " = ";

      if (value instanceof Node && value.mustWrap())
        out += "(" + compiled + ")";
      else
        out += compiled;
    }

    return out;
  }
}
xql$node.ConditionMap = ConditionMap;

/**
 * SQL identifier.
 *
 * @alias xql.node.Identifier
 */
class Identifier extends Node {
  constructor(value, as) {
    super("IDENTIFIER", as);
    this._value = value;
  }

  /** @override */
  mustWrap() {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    var out = ctx.escapeIdentifier(this._value);
    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);
    return out;
  }

  /**
   * Gets the name of the identifier.
   *
   * @note The identifier itself is stored in the node as `_value`, which makes
   * the interface similar to all other nodes.
   *
   * @return {string} Identifier's name.
   */
  getName() {
    return this._value;
  }

  /**
   * Sets the name of the identifier.
   *
   * @param {string} name The new name of the identifier.
   * @return {this}
   */
  setName(name) {
    this._value = name;
    return this;
  }
}
xql$node.Identifier = Identifier;

/**
 * SQL function or aggregate expression.
 *
 * @alias xql.node.Func
 */
class Func extends NodeArray {
  constructor(type, args) {
    super(type, "");

    this._flags |= NodeFlags.kAll;
    this._values = args || [];
  }

  /** @override */
  mustWrap() {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileFunc(this);
  }

  getArguments() {
    return this._values;
  }

  setArguments(args) {
    this._values = args || [];
    return this;
  }

  /**
   * Sets the `ALL` option of the aggregate (and clears the `DISTINCT` option).
   *
   * @return {this}
   */
  ALL() {
    return this.replaceFlag(NodeFlags.kDistinct, NodeFlags.kAll);
  }

  /**
   * Sets the `DISTINCT` option of the aggregate (and clears the `ALL` option).
   *
   * @return {this}
   */
  DISTINCT() {
    return this.replaceFlag(NodeFlags.kAll, NodeFlags.kDistinct);
  }
}
xql$node.Func = Func;

/**
 * SQL case.
 *
 * @alias xql.node.Case
 */
class Case extends NodeArray {
  constructor() {
    super("CASE");
    this._else = null;
  }

  /** @override */
  mustWrap() {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    var out = "CASE";
    var as = this._as;

    var whens = this._values;
    var else_ = this._else;

    for (var i = 0; i < whens.length; i++)
      out += " " + whens[i].compileNode(ctx);

    if (else_ !== null)
      out += " ELSE " + ctx.escapeValue(else_);

    out += " END";
    if (as)
      out = out + " AS " + ctx.escapeIdentifier(as);
    return out;
  }

  WHEN(expression, body) {
    this._values.push(new When(expression, body));
    return this;
  }

  ELSE(body) {
    this._else = body;
    return this;
  }
}
xql$node.Case = Case;

/**
 * SQL when.
 *
 * @alias xql.node.When
 */
class When extends Binary {
  constructor(expression, body) {
    super(expression, "WHEN", body);
  }

  /** @override */
  mustWrap() {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    return "WHEN " + ctx.escapeValue(this._left) + " THEN " + ctx.escapeValue(this._right);
  }
}
xql$node.When = When;

/**
 * SQL value.
 *
 * Used in cases where it's difficult to automatically determine how the value
 * should be escaped (which can result in invalid query if determined wrong).
 *
 * `Value` node shouldn't be in general used for all types, only types where
 * the mapping is ambiguous and can't be automatically deduced. For example
 * PostgreSQL uses different syntax for `JSON` and `ARRAY`. In such case `xql`
 * has no knowledge which format to use and will choose ARRAY over JSON.
 *
 * Value is an alternative to schema. If schema is provided it's unnecessary
 * to wrap values to `Value` nodes.
 *
 * @param {string}  type  Type of the value.
 * @param {*}       value Data of the value.
 * @param {string=} as    SQL's AS clause, if given.
 *
 * @alias xql.node.Value
 */
class Value extends Node {
  constructor(type, value, as) {
    super(type, as);
    this._value = value;
  }

  /** @override */
  mustWrap() {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    var out = ctx.escapeValue(this._value, this._type);
    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);
    return out;
  }

  /**
   * Gets the associated value.
   *
   * @return {*}
   */
  getValue() {
    return this._value;
  }

  /**
   * Sets the associated value.
   *
   * @param {*} value A new value to associate with.
   * @return {this}
   */
  setValue(value) {
    this._value = value;
    return this;
  }
}
xql$node.Value = Value;

/**
 * SQL sort expression.
 *
 * @alias xql.node.Sort
 */
class Sort extends Identifier {
  constructor(column, order, nulls) {
    var flags = 0;

    if (order && hasOwn.call(SortDirection, order))
      flags |= SortDirection[order];

    if (nulls && hasOwn.call(SortNulls, nulls))
      flags |= SortNulls[nulls];

    super("SORT", "");
    this._flags = flags;
    this._value = column;
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileSort(this);
  }

  /**
   * Gets the sorting order.
   *
   * @return {string} Either an empty string (if not set) or "ASC" or "DESC".
   */
  getSortOrder() {
    var flags = this._flags;
    if (flags & NodeFlags.kDescending)
      return "DESC";
    else if (flags & NodeFlags.kAscending)
      return "ASC";
    else
      return "";
  }

  /**
   * Sets the sorting order.
   *
   * @param {string} order Sorting order, must be "", "ASC", or "DESC".
   * @return {this}
   * @throws {CompileError} If `order` contains an invalid value.
   */
  setSortOrder(order) {
    var flags = this._flags & ~(NodeFlags.kAscending | NodeFlags.kDescending);
    if (hasOwn.call(SortDirection, order))
      this._flags = flags | SortDirection[order];
    else
      throwCompileError("Sort.setSortOrder() - Invalid argument '" + order + "'");
    return this;
  }

  /**
   * Gets the sorting nulls option.
   *
   * @return {string} Either an empty string (if not set) or "NULLS FIRST" or
   *   "NULLS LAST".
   */
  getNullsOrder() {
    var flags = this._flags;
    if (flags & NodeFlags.kNullsFirst)
      return "NULLS FIRST";
    else if (flags & NodeFlags.kNullsLast)
      return "NULLS LAST";
    else
      return "";
  }

  /**
   * Sets the sorting nulls option.
   *
   * @param {string} order Sorting nulls option, must be "", "NULLS FIRST", or
   *   "NULLS LAST".
   * @return {this}
   * @throws {CompileError} If `order` contains an invalid value.
   */
  setNullsOrder(order) {
    var flags = this._flags & ~(NodeFlags.kNullsFirst | NodeFlags.kNullsLast);
    if (hasOwn.call(SortNulls, order))
      this._flags = flags | SortNulls[order];
    else
      throwCompileError("Sort.setSortOrder() - Invalid argument '" + order + "'");
    return this;
  }

  /**
   * Returns whether the sorting order is set to "ASC".
   *
   * @return {boolean} Whether the sorting order is "ASC". Returns false if the
   *   order has not been set (xql distinguish between not set, ASC, and DESC).
   */
  isAscending() {
    return (this._flags & NodeFlags.kAscending) !== 0;
  }

  /**
   * Returns whether the sorting order is set to "DESC".
   *
   * @return {boolean} Whether the sorting order is "DESC". Returns false if the
   *   order has not been set (xql distinguish between not set, ASC, and DESC).
   */
  isDescending() {
    return (this._flags & NodeFlags.kDescending) !== 0;
  }

  /**
   * Returns whether the sorting nulls option is set to "NULLS FIRST".
   *
   * @return {boolean} Whether the sorting nulls is "NULLS FIRST". Returns
   *   false if the sorting nulls option is not "NULLS FIRST" or is not set.
   */
  hasNullsFirst() {
    return (this._flags & NodeFlags.kNullsFirst) !== 0;
  }

  /**
   * Returns whether the sorting nulls option is set to "NULLS LAST".
   *
   * @return {boolean} Whether the sorting nulls is "NULLS LAST". Returns
   *   false if the sorting nulls option is not "NULLS LAST" or is not set.
   */
  hasNullsLast() {
    return (this._flags & NodeFlags.kNullsLast) !== 0;
  }

  /**
   * Sets the sorting order to ascending (ASC).
   *
   * The same as calling `setSortOrder("ASC")`.
   *
   * @return {this}
   */
  ASC() {
    return this.replaceFlag(NodeFlags.kDescending, NodeFlags.kAscending);
  }

  /**
   * Sets the sorting order to descending (DESC).
   *
   * The same as calling `setSortOrder("DESC")`.
   *
   * @return {this}
   */
  DESC() {
    return this.replaceFlag(NodeFlags.kAscending, NodeFlags.kDescending);
  }

  /**
   * Specify `NULLS FIRST` clause.
   *
   * The same as calling `setNullsOrder("NULLS FIRST")`.
   *
   * @return {this}
   */
  NULLS_FIRST() {
    return this.replaceFlag(NodeFlags.kNullsLast, NodeFlags.kNullsFirst);
  }

  /**
   * Specify `NULLS LAST` clause.
   *
   * The same as calling `setNullsOrder("NULLS LAST")`.
   *
   * @return {this}
   */
  NULLS_LAST() {
    return this.replaceFlag(NodeFlags.kNullsFirst, NodeFlags.kNullsLast);
  }
}
xql$node.Sort = Sort;

/**
 * SQL join expression.
 *
 * @alias xql.node.Join
 */
class Join extends Binary {
  constructor(left, type, right, condition) {
    super(left, type, right, "");
    this._condition = condition;
  }

  /** @override */
  mustWrap(ctx) {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileJoin(this);
  }

  /**
   * Gets the join condition.
   *
   * @return {Node|array}
   */
  getCondition() {
    return this._condition;
  }

  /**
   * Sets the join condition.
   *
   * @param {Node|array} condition A single node or array of nodes that form the
   *   condition.
   * @return {this}
   */
  setCondition(condition) {
    this._condition = condition;
    return this;
  }
}
xql$node.Join = Join;

/**
 * SQL query.
 *
 * Query is a base class that provides basic blocks for implementing:
 *   - `SELECT` - See `SelectQuery`.
 *   - `INSERT` - See `InsertQuery`.
 *   - `UPDATE` - See `UpdateQuery`.
 *   - `DELETE` - See `DeleteQuery`.
 *   - `EXCEPT`, `INTERSECT`, and `UNION` - See `CompoundQuery`.
 *
 * The following features are implemented by the `Query`:
 *   - `TABLE`- Specifies a single database table.
 *   - `SELECT` or `RETURNING`- Specifies select or returning expression columns.
 *   - `WHERE` - Specifies `WHERE` clause.
 *
 * @param {string} type Type of the query.
 *
 * @alias xql.node.Query
 */
class Query extends Node {
  constructor(type) {
    super(type, "");

    this._values = null;
    this._columns = null;

    // Used by:
    //   - `SELECT` - `SELECT ...`.
    //   - `INSERT` - `RETURNING ...`.
    //   - `UPDATE` - `RETURNING ...`.
    //   - `DELETE` - `RETURNING ...`.
    this._fieldsOrReturning = null;

    // Used by:
    //   - `INSERT` - `INSERT INTO ...`.
    //   - `UPDATE` - `UPDATE ...`.
    //   - `DELETE` - `DELETE FROM ...`.
    this._table = null;

    // Used by:
    //   - `SELECT` - `FROM ...`
    //   - `UPDATE` - `FROM ...`.
    //   - `DELETE` - `USING ...`.
    //
    // Contains the `FROM` or `USING` expression. The `_fromOrUsing` can be a
    // string describing a table name or `Node` that is describing a table name
    // with optional alias, `JOIN` expression, `VALUES` expression or `SELECT`
    // expression.
    this._fromOrUsing = null;

    // Used by:
    //   - `SELECT`
    //   - `UPDATE`
    //   - `DELETE`
    this._where = null;

    // Used by:
    //   - `SELECT`
    //   - `EXCEPT`, `INTERSECT`, `UNION` - See `CompoundQuery`.
    this._orderBy = null;

    // Used by:
    //   - `SELECT`
    //   - `UPDATE`
    //   - `DELETE`
    //
    // Contains `OFFSET ...` and `LIMIT ...` parameters. There are some DB engines
    // (like SQLite), which allow to specify `OFFSET` / `LIMIT` in `UPDATE` and
    // `DELETE` This is the main reason that these members are part of Query and
    // not SelectQuery.
    this._offset = 0;
    this._limit = 0;

    // Optional type mapping having keys (columns) and their value types.
    //
    // Type mapping is sometimes important when it comes to type ambiguity. For
    // example when using PostgreSQL there is ambiguity when escaping `Array`.
    // It can be escaped by using PostgreSQL `ARRAY[] or {}` or as JSON `[]`.
    this._typeMapping = null;
  }

  /** @override */
  mustWrap() {
    return true;
  }

  /** @override */
  compileQuery(ctx) {
    return this.compileNode(ctx) + ";";
  }

  getTypeMapping() {
    return this._typeMapping;
  }

  setTypeMapping(typeMapping) {
    this._typeMapping = typeMapping;
    return this;
  }

  _setFromOrIntoTable(table, keyword) {
    if (this._table)
      throwCompileError(keyword + "() - already specified ('" + table + "')");

    this._table = table;
    return this;
  }

  _addFieldsOrReturning(defs) {
    var fields = this._fieldsOrReturning;
    var i, len;

    // Handle multiple parameters.
    if (arguments.length > 1) {
      if (fields === null) {
        this._fieldsOrReturning = slice.call(arguments, 0);
        return this;
      }

      for (i = 0, len = arguments.length; i < len; i++)
        fields.push(arguments[i]);
      return this;
    }

    // Handle a single parameter of type `Object` or `Array`.
    if (typeof defs === "object") {
      // If the `defs` is array it should contain one or multiple columns. In
      // case that `_fieldsOrReturning` is `null` the given array `col` is used
      // instead of creating a copy of it.
      if (isArray(defs)) {
        if (fields === null) {
          this._fieldsOrReturning = defs;
          return this;
        }

        for (i = 0, len = defs.length; i < len; i++)
          fields.push(defs[i]);
        return this;
      }

      // If the `col` is not `Node` it is a dictionary where keys are columns
      // and values are either:
      //   1. `true` - describing the column of same name.
      //   2. `string` - describing unaliased name.
      //   3. `Node` - expression of that column.
      if (!(defs instanceof Node)) {
        if (fields === null)
          this._fieldsOrReturning = fields = [];

        for (var k in defs) {
          var def = defs[k];

          if (def === true) {
            fields.push(k);
            continue;
          }

          if (typeof def === "string")
            def = COL(def);

          fields.push(def.AS(k));
        }

        return this;
      }

      // ... Fall through ...
    }

    if (fields === null)
      this._fieldsOrReturning = [defs];
    else
      fields.push(defs);

    return this;
  }

  _addFromOrUsing(args) {
    var len = args.length;
    if (len < 1) return this;

    var arg = args[0];
    var left = this._fromOrUsing;

    if (left !== null)
      this._fromOrUsing = left = new Join(left, "", arg);
    else
      this._fromOrUsing = left = arg;

    if (len <= 1)
      return this;

    // Implicit `CROSS JOIN` syntax.
    var i = 1;
    do {
      arg = args[i];
      left = new Join(left, "", arg);
    } while (++i < len);

    this._fromOrUsing = left;
    return this;
  }

  // \function Query._join(type, with_, condition)
  _join(type, with_, condition) {
    var left = this._fromOrUsing;

    // Well this shouldn't be `null`.
    if (left === null)
      throwCompileError("Query._join() - There is no table in query to join with");

    this._fromOrUsing = new Join(left, type, with_, condition);
    return this;
  }

  // Add `WHERE` condition of specified `type`.
  _addWhere(type, a, op, b, nArgs) {
    var node;
    var where = this._where;
    var aIsArray = false;

    // Accept 1, 2 or 3 arguments.
    if (nArgs >= 2) {
      if (typeof a === "string")
        a = COL(a);
      if (nArgs === 2)
        node = BINARY_OP(a, "=", op);
      else
        node = BINARY_OP(a, op, b);
    }
    else if (nArgs !== 1) {
      throwCompileError("Query." + (type === "OR" ? "OR_" : "") + "WHERE() - Invalid argument");
    }
    else {
      aIsArray = isArray(a);
      if (!aIsArray)
        node = (a instanceof Node) ? a : new ConditionMap("AND", a);
    }

    // If no `WHERE` has been added yet, create one.
    if (where === null) {
      where = new Logical(type);
      this._where = where;
    }
    // If the current expression operator is not the same as `type`, wrap the
    // current expression inside a new node.
    else if (where._type !== type) {
      where = new Logical(type);
      where.push(this._where);
      this._where = where;
    }

    if (aIsArray)
      where.concat(a);
    else
      where.push(node);

    return this;
  }

  /**
   * Add values to the query.
   *
   * @param {object|object[]} data Values as object or an array of objects.
   * @return {this}
   */
  VALUES(data) {
    var values = this._values;
    var columns = this._columns;

    var dataIsArray = isArray(data);
    if (dataIsArray && data.length === 0)
      return this;

    if (values === null) {
      this._values = values = [];
      this._columns = columns = {};
    }

    var object, k;
    if (dataIsArray) {
      // Array of objects.
      for (var i = 0, len = data.length; i < len; i++) {
        object = data[i];
        values.push(object);

        for (k in object)
          columns[k] = true;
      }
    }
    else {
      object = data;
      values.push(object);

      for (k in object)
        columns[k] = true;
    }

    return this;
  }

  /**
   * Adds a `WHERE` expression to the query (implicit `AND`).
   *
   * This function has multiple overloads:
   *
   * 1. `where(node:xql.Node)`
   *   Node that contains an expression.
   *
   * 2. `where(keys:object)`
   *   Object that contain key/value pairs that will be checked for equality,
   *   implicit `AND` will be added to the query between all keys specified.
   *   Objects without keys are ignored.
   *
   * 3. `where(a:string, b:*)`
   *   Adds one `WHERE` clause in the form `a = b`.
   *
   * 4. `where(a:string, op:string, b:*)`
   *   Adds one `WHERE` clause in the form `a op b`.
   *
   * @param {...*} va Variable arguments.
   * @return {this}
   */
  WHERE(a, op, b) {
    return this._addWhere("AND", a, op, b, arguments.length);
  }

  /**
   * Adds a `WHERE` expression to the query (implicit `OR`).
   *
   * This function is similar to `WHERE`, however, instead of forming a logical
   * `AND` it forms a logical `OR`. See {@link WHERE} for more details.
   *
   * @param {...*} va Variable arguments.
   * @return {this}
   */
  OR_WHERE(a, op, b) {
    return this._addWhere("OR", a, op, b, arguments.length);
  }

  /**
   * Adds an `ORDER BY` clause to the query.
   *
   * The first parameter `column` can specify a single column or multiple
   * columns: `ORDER_BY(["name"])` and `ORDER_BY("name")` are equivalent.
   *
   * @param {array|string|Identifier} column A single column or an array of
   *   columns.
   * @param {string=} order Sorting order.
   *   Can contain either "" (default), "ASC", or "DESC".
   * @param {string=} nulls Sorting nulls option.
   *   Can contain either "" (default), "NULLS FIRST", or "NULLS LAST".
   * @return {this}
   */
  ORDER_BY(column, order, nulls) {
    var orderBy = this._orderBy;

    if (orderBy === null)
      orderBy = this._orderBy = [];

    if (isArray(column)) {
      var columns = column;
      var len = columns.length;

      if (!len)
        return this;

      for (var i = 0; i < len; i++) {
        column = columns[i];
        orderBy.push(new Sort(column, order, nulls));
      }
    }
    else {
      orderBy.push(new Sort(column, order, nulls));
    }

    return this;
  }

  /**
   * Sets the `OFFSET` clause.
   *
   * @param {?number} offset SQL query offset.
   * @return {this}
   */
  OFFSET(offset) {
    this._offset = offset;
    return this;
  }

  /**
   * Sets the `LIMIT` clause.
   *
   * @param {?number} offset SQL query limit.
   * @return {this}
   */
  LIMIT(limit) {
    this._limit = limit;
    return this;
  }
}
xql$node.Query = Query;

/**
 * SQL select.
 *
 * @alias xql.node.SelectQuery
 */
class SelectQuery extends Query {
  constructor() {
    super("SELECT");

    this._flags |= NodeFlags.kAll;

    // `GROUP BY` clause.
    this._groupBy = null;

    // `HAVING` clause.
    this._having = null;
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileSelect(this);
  }

  // Add `HAVING` condition of specified `type`.
  _addHaving(type, a, op, b, nArgs) {
    var node;
    var having = this._having;
    var aIsArray = false;

    // Accept 1, 2 or 3 arguments.
    if (nArgs >= 2) {
      if (typeof a === "string")
        a = COL(a);
      if (nArgs === 2)
        node = BINARY_OP(a, "=", op);
      else
        node = BINARY_OP(a, op, b);
    }
    else if (nArgs !== 1) {
      throwCompileError((type === "OR" ? "OR_" : "") + "HAVING - Invalid argument");
    }
    else {
      aIsArray = isArray(a);
      if (!aIsArray)
        node = (a instanceof Node) ? a : new ConditionMap("AND", a);
    }

    // If no `HAVING` has been added yet, create one.
    if (having === null) {
      having = new Logical(type);
      this._having = having;
    }
    // If the current expression operator is not the same as `type`, wrap the
    // current expression inside a new `Node`.
    else if (having._type !== type) {
      having = new Logical(type);
      having.push(this._having);
      this._having = having;
    }

    if (aIsArray)
      having.concat(a);
    else
      having.push(node);

    return this;
  }

  /**
   * Sets the `ALL` option and optionally add fields to the query.
   *
   * It accepts the same arguments as `SELECT()` so it can be used in a similar
   * way.
   *
   * @param {...*} va Variable arguments.
   * @return {this}
   */
  ALL() {
    this.replaceFlag(NodeFlags.kDistinct, NodeFlags.kAll);
    if (arguments.length)
      this.FIELD.apply(this, arguments);
    return this;
  }

  /**
   * Sets the `DISTINCT` option and optionally add fields to the query.
   *
   * It accepts the same arguments as `SELECT()` so it can be used in a similar
   * way. The following expressions are equivalent:
   *
   *   - `SELECT(["a", "b", "c"]).DISTINCT()`
   *   - `SELECT().DISTINCT(["a", "b", "c"])`
   *   - `SELECT().DISTINCT().FIELD(["a", "b", "c"])`
   *
   * @param {...*} va Variable arguments.
   * @return {this}
   */
  DISTINCT() {
    this.replaceFlag(NodeFlags.kAll, NodeFlags.kDistinct);
    if (arguments.length)
      this.FIELD.apply(this, arguments);
    return this;
  }

  /**
   * Specifies the `FROM` table (or list of tables).
   *
   * The function has the following signatures:
   *
   *   1. `FROM(table:string)` - Specifies a single table.
   *   2. `FROM(table1, table2, ...)` - Specifies multiply tables that forms
   *      an implicit CROSS JOIN.
   *   3. `FROM([array])` - Like the second form, but the tables are specified
   *      by the array passed in the first argument.
   *
   * @param {...*} va Variable arguments
   */
  FROM() {
    var arg;
    if (arguments.length === 1 && isArray((arg = arguments[0])))
      return this._addFromOrUsing(arg);
    else
      return this._addFromOrUsing(slice.call(arguments, 0));
  }

  /**
   * Adds a `CROSS JOIN` expression to the query.
   *
   * @param {string} with_ Specifies the table to join with.
   * @param {*} condition Specifies join condition.
   * @return {this}
   */
  CROSS_JOIN(with_, condition) {
    return this._join("CROSS", with_, condition);
  }

  /**
   * Adds an `INNER JOIN` expression to the query.
   *
   * @param {string} with_ Specifies the table to join with.
   * @param {*} condition Specifies join condition.
   * @return {this}
   */
  INNER_JOIN(with_, condition) {
    return this._join("INNER", with_, condition);
  }

  /**
   * Adds a `LEFT OUTER JOIN` expression to the query.
   *
   * @param {string} with_ Specifies the table to join with.
   * @param {*} condition Specifies join condition.
   * @return {this}
   */
  LEFT_JOIN(with_, condition) {
    return this._join("LEFT", with_, condition);
  }

  /**
   * Adds a `RIGHT OUTER` join expression to the query.
   *
   * @param {string} with_ Specifies the table to join with.
   * @param {*} condition Specifies join condition.
   * @return {this}
   */
  RIGHT_JOIN(with_, condition) {
    return this._join("RIGHT", with_, condition);
  }

  /**
   * Adds a `FULL OUTER JOIN` expression to the query.
   *
   * @param {string} with_ Specifies the table to join with.
   * @param {*} condition Specifies join condition.
   * @return {this}
   */
  FULL_JOIN(with_, condition) {
    return this._join("FULL", with_, condition);
  }

  // \function SelectQuery.GROUP_BY(...)
  GROUP_BY(arg) {
    var groupBy = this._groupBy;
    var i, len;

    if (arguments.length > 1) {
      if (groupBy === null) {
        this._groupBy = slice.call(arguments, 0);
      }
      else {
        for (i = 0, len = arguments.length; i < len; i++)
          groupBy.push(arguments[i]);
      }
    }
    else if (isArray(arg)) {
      // Optimization: If `_groupBy` is `null` the given array `arg` is referenced.
      if (groupBy === null) {
        this._groupBy = arg;
      }
      else {
        for (i = 0, len = arg.length; i < len; i++)
          groupBy.push(arg[i]);
      }
    }
    else {
      if (groupBy === null)
        this._groupBy = [arg];
      else
        groupBy.push(arg);
    }

    return this;
  }

  // \function SelectQuery.FIELD(...)

  // \function SelectQuery.HAVING(...)
  HAVING(a, op, b) {
    return this._addHaving("AND", a, op, b, arguments.length);
  }

  // \function SelectQuery.OR_HAVING(...)
  OR_HAVING(a, op, b) {
    return this._addHaving("OR", a, op, b, arguments.length);
  }
}
xql$node.SelectQuery = alias(SelectQuery, {
  FIELD: "_addFieldsOrReturning"
});

/**
 * SQL insert.
 *
 * @alias xql.node.InsertQuery
 */
class InsertQuery extends Query {
  constructor() {
    super("INSERT");
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileInsert(this);
  }

  // \function InsertQuery.TABLE(table)
  //
  // Alias to `InsertQuery.INTO(table)`.
  TABLE(table) {
    return this._setFromOrIntoTable(table, "TABLE");
  }

  // \function InsertQuery.INTO(table)
  INTO(table) {
    return this._setFromOrIntoTable(table, "INTO");
  }

  // \function InsertQuery.RETURNING(...)
}
xql$node.InsertQuery = alias(InsertQuery, {
  RETURNING: "_addFieldsOrReturning"
});

/**
 * SQL update.
 *
 * @alias xql.node.UpdateQuery
 */
class UpdateQuery extends Query {
  constructor() {
    super("UPDATE");
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileUpdate(this);
  }

  // \function UpdateQuery.TABLE(table)
  TABLE(table) {
    return this._setFromOrIntoTable(table, "TABLE");
  }

  // \function UpdateQuery.FROM(...)
  FROM(table) {
    return this._setFromOrIntoTable(table, "FROM");
  }

  // \function UpdateQuery.RETURNING(...)
}
xql$node.UpdateQuery = alias(UpdateQuery, {
  RETURNING: "_addFieldsOrReturning"
});

/**
 * SQL delete.
 *
 * @alias xql.node.DeleteQuery
 */
class DeleteQuery extends Query {
  constructor() {
    super("DELETE");
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileDelete(this);
  }

  // \function DeleteQuery.TABLE(table)
  //
  // Alias to `DeleteQuery.FROM(table)`.

  // \function DeleteQuery.FROM(table)

  // \function DeleteQuery.RETURNING(...)

  // \function DeleteQuery.USING(...)
  USING() {
    var arg;
    if (arguments.length === 1 && isArray((arg = arguments[0])))
      return this._addFromOrUsing(arg);
    else
      return this._addFromOrUsing(slice.call(arguments, 0));
  }
}
xql$node.DeleteQuery = alias(DeleteQuery, {
  FROM     : "_setFromOrIntoTable",
  TABLE    : "_setFromOrIntoTable",
  RETURNING: "_addFieldsOrReturning"
});

/**
 * SQL combining query/operator (UNION, INTERSECT, EXCEPT).
 *
 * @alias xql.node.CompoundQuery
 */
class CompoundQuery extends Query {
  constructor(type, values) {
    super(type);

    this._flags |= NodeFlags.kDistinct;
    this._values = values || [];
  }

  /** @override */
  mustWrap(ctx) {
    return true;
  }

  /** @override */
  compileNode(ctx) {
    return ctx._compileCompound(this);
  }

  /**
   * Sets the `ALL` option of the query (and clears the `DISTINCT` option).
   *
   * @return {this}
   */
  ALL() {
    return this.replaceFlag(NodeFlags.kDistinct, NodeFlags.kAll);
  }

  /**
   * Sets the `DISTINCT` option of the query (and clears the `ALL` option).
   *
   * @return {this}
   */
  DISTINCT() {
    return this.replaceFlag(NodeFlags.kAll, NodeFlags.kDistinct);
  }

  push() {
    var values = this._values;
    values.push.apply(values, arguments);
    return this;
  }

  concat(array) {
    var values = this._values;
    for (var i = 0, len = array.length; i < len; i++)
      values.push(array[i]);
    return this;
  }
}
xql$node.CompoundQuery = CompoundQuery;

// ============================================================================
// [xql.SQL]
// ============================================================================

/**
 * Constructs a RAW query node.
 *
 * @param {string} raw Raw query string (won't be escaped).
 * @param {array=} bindings Data that will be sustituted in `raw`.
 * @return {Raw}
 *
 * @alias xql.RAW
 */
function RAW(raw, bindings) {
  return new Raw(raw, bindings);
}
xql.RAW = RAW;

/**
 * Constructs a SELECT query.
 *
 * @param {...*} fields Fields can be specified in several ways. This parameter
 *   is passed as is into `SelectQuery.FIELDS()` function.
 * @return {SelectQuery}
 *
 * @alias xql.SELECT
 */
function SELECT(/* ... */) {
  var q = new SelectQuery();
  if (arguments.length)
    q.FIELD.apply(q, arguments);
  return q;
}
xql.SELECT = SELECT;

/**
 * Constructs an INSERT query.
 *
 * @param {...*} args
 * @return {InsertQuery}
 *
 * @alias xql.INSERT
 */
function INSERT(/* ... */) {
  var q = new InsertQuery();

  var i = 0, len = arguments.length;
  var arg;

  // If the first parameter is a string or an identifier it is a table name.
  if (i < len) {
    arg = arguments[i];
    if (typeof arg === "string" || arg instanceof Identifier) {
      q._table = arg;
      i++;
    }
  }

  // Next arguments can contain data (array/object) to insert.
  while (i < len) {
    arg = arguments[i++];
    q.VALUES(arg);
  }

  return q;
}
xql.INSERT = INSERT;

/**
 * Constructs an UPDATE query.
 *
 * @param {...*} args
 * @return {UpdateQuery}
 *
 * @alias xql.UPDATE
 */
function UPDATE(/* ... */) {
  var q = new UpdateQuery();

  var i = 0, len = arguments.length;
  var arg;

  // If the first parameter is a string or an identifier it is a table name.
  if (i < len) {
    arg = arguments[i];
    if (typeof arg === "string" || arg instanceof Identifier) {
      q._table = arg;
      i++;
    }
  }

  // Next argument can contain data to update.
  if (i < len) {
    arg = arguments[i];
    q.VALUES(arg);
  }

  // TODO: What if more arguments are passed.

  return q;
}
xql.UPDATE = UPDATE;

/**
 * Constructs a DELETE query.
 *
 * @param {string=} from SQL table where to delete records.
 * @return {DeleteQuery}
 *
 * @alias xql.DELETE
 */
function DELETE(from) {
  var q = new DeleteQuery();
  if (from)
    q._table = from;
  return q;
}
xql.DELETE = DELETE;

/**
 * Constructs a logical AND expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL conditions that form the AND expression.
 * @return {Logical}
 *
 * @alias xql.AND
 */
function AND(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new Logical("AND", values);
}
xql.AND = AND;

/**
 * Constructs a logical OR expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL conditions that form the OR expression.
 * @return {Logical}
 *
 * @alias xql.OR
 */
function OR(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new Logical("OR", values);
}
xql.OR = OR;

/**
 * Constructs an `EXCEPT` expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL queries that form the EXCEPT expression.
 * @return {CompoundQuery}
 *
 * @alias xql.EXCEPT
 */
function EXCEPT(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CompoundQuery("EXCEPT", values);
}
xql.EXCEPT = EXCEPT;

/**
 * Shorthand for `EXCEPT(...args).ALL()`.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 * @return {CompoundQuery}
 *
 * @see EXCEPT
 * @see CompoundQuery.prototype.ALL
 *
 * @alias xql.EXCEPT_ALL
 */
function EXCEPT_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CompoundQuery("EXCEPT", values).ALL();
}
xql.EXCEPT_ALL = EXCEPT_ALL;

/**
 * Constructs an `INTERSECT` expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL queries that form the INTERSECT expression.
 * @return {CompoundQuery}
 *
 * @alias xql.INTERSECT
 */
function INTERSECT(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CompoundQuery("INTERSECT", values);
}
xql.INTERSECT = INTERSECT;

/**
 * Shorthand for `INTERSECT(...args).ALL()`.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 * @return {CompoundQuery}
 *
 * @see INTERSECT
 * @see CompoundQuery.prototype.ALL
 *
 * @alias xql.INTERSECT_ALL
 */
function INTERSECT_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CompoundQuery("INTERSECT", values).ALL();
}
xql.INTERSECT_ALL = INTERSECT_ALL;

/**
 * Constructs a `UNION` expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL queries that form the UNION expression.
 * @return {CompoundQuery}
 *
 * @alias xql.UNION
 */
function UNION(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CompoundQuery("UNION", values);
}
xql.UNION = UNION;

/**
 * Shorthand for `UNION(...args).ALL()`.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 * @return {CompoundQuery}
 *
 * @see UNION
 * @see CompoundQuery.prototype.ALL
 *
 * @alias xql.UNION_ALL
 */
function UNION_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CompoundQuery("UNION", values).ALL();
}
xql.UNION_ALL = UNION_ALL;

/**
 * Constructs a column's identifier.
 *
 * @param {string} column Column's name.
 * @param {string=} as SQL alias.
 * @return {Identifier}
 *
 * @alias xql.COL
 */
function COL(column, as) {
  // High-performane version of:
  //   `new Identifier(column, as)`
  return {
    __proto__: Identifier.prototype,
    _type    : "",
    _flags   : 0,
    _as      : as || "",
    _value   : column
  };
}
xql.COL = COL;

/**
 * Constructs a wrapped value.
 *
 * @param {*} value The value to wrap (any type).
 * @param {string=} as SQL alias.
 * @return {Value}
 *
 * @alias xql.VAL
 */
function VAL(value, as) {
  // High-performane version of:
  //   `new Value(value, as)`
  return {
    __proto__: Value.prototype,
    _type    : "",
    _flags   : 0,
    _as      : as || "",
    _value   : value
  };
}
xql.VAL = VAL;

/**
 * Constructs a wrapped ARRAY value.
 *
 * @param {array} value The value to wrap.
 * @param {string=} as SQL alias.
 * @return {Value}
 *
 * @alias xql.ARRAY_VAL
 */
function ARRAY_VAL(value, as) {
  return new Value("ARRAY", value, as);
}
xql.ARRAY_VAL = ARRAY_VAL;

/**
 * Constructs a wrapped JSON value.
 *
 * @param {*} value The value to wrap.
 * @param {string=} as SQL alias.
 * @return {Value}
 *
 * @alias xql.JSON_VAL
 */
function JSON_VAL(value, as) {
  return new Value("JSON", value, as);
}
xql.JSON_VAL = JSON_VAL;

// \function SORT(column, direction, nulls)
function SORT(column, direction, nulls) {
  return new Sort(column, direction, nulls);
}
xql.SORT = SORT;

// \internal
function UNARY_OP(op, child) {
  // High-performane version of:
  //   `new UnaryOp(op, x)`
  return {
    __proto__: UnaryOp.prototype,
    _type    : op,
    _flags   : 0,
    _as      : "",
    _value   : child,
  };
}

// \internal
function BINARY_OP(a, op, b) {
  // High-performane version of:
  //   `new BinaryOp(a, op, b)`
  return {
    __proto__: BinaryOp.prototype,
    _type    : op,
    _flags   : 0,
    _as      : "",
    _left    : a,
    _right   : b
  };
}

// \function OP(...)
//
// Construct unary or binary operator.
function OP(a, op, b) {
  var len = arguments.length;

  if (len === 2)
    return UNARY_OP(op, a);
  else if (len === 3)
    return BINARY_OP(a, op, b);
  else
    throwCompileError("OP() - Illegal number or parameters '" + len + "' (2 or 3 allowed)");
}
xql.OP = OP;

function EQ(a, b) { return BINARY_OP(a, "=" , b); }
function NE(a, b) { return BINARY_OP(a, "!=", b); }
function LT(a, b) { return BINARY_OP(a, "<" , b); }
function LE(a, b) { return BINARY_OP(a, "<=", b); }
function GT(a, b) { return BINARY_OP(a, ">" , b); }
function GE(a, b) { return BINARY_OP(a, ">=", b); }

xql.EQ = EQ;
xql.NE = NE;
xql.LT = LT;
xql.LE = LE;
xql.GT = GT;
xql.GE = GE;

function FUNC(name /* [, ...] */) {
  return new Func(name, slice.call(arguments, 1));
}
xql.FUNC = FUNC;

function CASE() {
  return new Case();
}
xql.CASE = CASE;

// ============================================================================
// [xql.FUNC]
// ============================================================================

(function() {

const N = -1;

const kUnary        = OpFlags.kUnary;
const kBinary       = OpFlags.kBinary;
const kFunction     = OpFlags.kFunction;
const kAggregate    = OpFlags.kAggregate;
const kVoid         = OpFlags.kVoid;
const kInPlaceNot   = OpFlags.kInPlaceNot;
const kLeftValues   = OpFlags.kLeftValues;
const kRightValues  = OpFlags.kRightValues;

function register(defs, commons) {
  const baseFlags    = commons.flags    || 0;
  const baseCategory = commons.category || "core";
  const baseDialect  = commons.dialect  || "*";

  for (var i = 0; i < defs.length; i++) {
    const def = defs[i];
    const name = def.name;
    const args = def.args;
    const flags = (def.flags || 0) | baseFlags;
    const dialect = def.dialect || baseDialect;
    const category = def.category || baseCategory;

    OpInfo.add({
      name    : name,
      nameFmt : (flags & kFunction) ? name : " " + def.name + " ",
      desc    : def.desc || "",
      ctor    : def.ctor || Func,
      flags   : flags,
      dialect : dialect,
      category: category,
      minArgs : isArray(args) ? args[0] : args,
      maxArgs : isArray(args) ? args[1] : args,
      compile : def.compile || null
    });
  }
}

function compileCAST(ctx, $) {
  const args = $._values;
  return "CAST(" + ctx.escapeValue(args[0]) + " AS " + ctx.escapeValue(args[1]) + ")";
}

function compileBETWEEN(ctx, $) {
  const args = $._values;

  return ctx.escapeOrWrap(args[0]) + " BETWEEN " +
         ctx.escapeOrWrap(args[1]) + " AND " +
         ctx.escapeOrWrap(args[2]);
}

function compileATAN(ctx, $) {
  const args = $._values;
  return ctx._compileFuncImpl(args.length <= 1 ? "ATAN" : "ATAN2", $._as, $._flags, args);
}

function compileLOG10(ctx, $) {
  if (ctx.dialect !== "mysql")
    return ctx._compileFuncImpl("LOG", $._as, $._flags, [10, $._values[0]]);
  else
    return ctx._compileFuncImpl("LOG10", $._as, $._flags, $._values);
}

function compileLOG2(ctx, $) {
  if (ctx.dialect !== "mysql")
    return ctx._compileFuncImpl("LOG", $._as, $._flags, [2, $._values[0]]);
  else
    return ctx._compileFuncImpl("LOG2", $._as, $._flags, $._values);
}

function compileRANDOM(ctx, $) {
  if (ctx.dialect === "mysql")
    return ctx._compileFuncImpl("RAND", $._as, $._flags, $._values);
  else
    return ctx._compileFuncImpl("RANDOM", $._as, $._flags, $._values);
}

function compileTRUNC(ctx, $) {
  var name = "TRUNC";
  var args = $._values;

  if (ctx.dialect === "mysql") {
    name = "TRUNCATE";
    if (args.length === 1)
      args = args.concat(0);
  }

  return ctx._compileFuncImpl(name, $._as, $._flags, args);
}

function compileCHR(ctx, $) {
  if (ctx.dialect === "mysql")
    return ctx._compileFuncImpl("CHAR", $._as, $._flags, $._values);
  else
    return ctx._compileFuncImpl("CHR", $._as, $._flags, $._values);
}

register([
  { name: "="                    , args: 2     , flags: 0           , dialect: "*"     },
  { name: ">"                    , args: 2     , flags: 0           , dialect: "*"     },
  { name: ">="                   , args: 2     , flags: 0           , dialect: "*"     },
  { name: "<"                    , args: 2     , flags: 0           , dialect: "*"     },
  { name: "<="                   , args: 2     , flags: 0           , dialect: "*"     },
  { name: "<>"                   , args: 2     , flags: 0           , dialect: "*"     },
  { name: "@>"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Contains"               },
  { name: "<@"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Contained by"           },
  { name: "&&"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Overlap"                },
  { name: "&<"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Right of"               },
  { name: "&>"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Left of"                },
  { name: "-|-"                  , args: 2     , flags: 0           , dialect: "*"     , desc: "Adjacent to"            },
  { name: "+"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Add / Union"            },
  { name: "-"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Subtract / Difference"  },
  { name: "*"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Multiply / Intersect"   },
  { name: "/"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Divide"                 },
  { name: "%"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Modulo"                 },
  { name: "^"                    , args: 2     , flags: 0           , dialect: "pgsql" , desc: "Power"                  },
  { name: "&"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Bitwise AND"            },
  { name: "|"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Bitwise OR"             },
  { name: "#"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Bitwise XOR"            },
  { name: "~"                    , args: 2     , flags: 0           , dialect: "*"     , desc: "Bitwise NOT / Match"    },
  { name: "<<"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Left shift / Left of"   },
  { name: ">>"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Right shift / Right of" },
  { name: "||"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Concatenate"            },
  { name: "~*"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Match (I)"              },
  { name: "!~"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Not match"              },
  { name: "!~*"                  , args: 2     , flags: 0           , dialect: "*"     , desc: "Not match (I)"          }
], { category: "general", flags: kBinary });

register([
  { name: "IS"                   , args: 2     , flags: 0           , dialect: "*"     },
  { name: "AND"                  , args: 2     , flags: 0           , dialect: "*"     , desc: "Logical AND" },
  { name: "OR"                   , args: 2     , flags: 0           , dialect: "*"     , desc: "Logical OR" },
  { name: "LIKE"                 , args: 2     , flags: 0           , dialect: "*"     },
  { name: "ILIKE"                , args: 2     , flags: 0           , dialect: "*"     },
  { name: "IN"                   , args: 2     , flags: kRightValues, dialect: "*"     , desc: "$1 IN ($2)" },
], { category: "general", flags: kBinary | kInPlaceNot });

register([
  { name: "CAST"                 , args: 2     , flags: 0           , dialect: "*"     , desc: "Cast to a different type", compile: compileCAST },
  { name: "COALESCE"             , args: [1, N], flags: 0           , dialect: "*"     , desc: "Return the first NON-NULL argument" },
  { name: "GREATEST"             , args: [1, N], flags: 0           , dialect: "*"     , desc: "Select the largest" },
  { name: "LEAST"                , args: [1, N], flags: 0           , dialect: "*"     , desc: "Select the smallest" },
  { name: "NULLIF"               , args: 2     , flags: 0           , dialect: "*"     , desc: "Return NULL if $1 == $2; otherwise return $1" },
  { name: "BETWEEN"              , args: 3     , flags: 0           , dialect: "*"     , desc: "$1 BETWEEN $2 AND $3", compile: compileBETWEEN }
], { category: "general", flags: kFunction });

register([
  { name: "ABS"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "ACOS"                 , args: 1     , flags: 0           , dialect: "*"     },
  { name: "ASIN"                 , args: 1     , flags: 0           , dialect: "*"     },
  { name: "ATAN"                 , args: [1, 2], flags: 0           , dialect: "*"      , compile: compileATAN },
  { name: "ATAN2"                , args: 2     , flags: 0           , dialect: "*"     },
  { name: "CBRT"                 , args: 1     , flags: 0           , dialect: "pgsql" },
  { name: "CEILING"              , args: 1     , flags: 0           , dialect: "*"     },
  { name: "COS"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "COT"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "DEGREES"              , args: 1     , flags: 0           , dialect: "*"     },
  { name: "DIV"                  , args: 2     , flags: 0           , dialect: "*"     }, // TODO:
  { name: "EXP"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "FLOOR"                , args: 1     , flags: 0           , dialect: "*"     },
  { name: "LN"                   , args: 1     , flags: 0           , dialect: "*"     },
  { name: "LOG"                  , args: [1, 2], flags: 0           , dialect: "*"     },
  { name: "LOG10"                , args: 1     , flags: 0           , dialect: "*"      , compile: compileLOG10 },
  { name: "LOG2"                 , args: 1     , flags: 0           , dialect: "*"      , compile: compileLOG2 },
  { name: "MOD"                  , args: 2     , flags: 0           , dialect: "*"     },
  { name: "PI"                   , args: 0     , flags: 0           , dialect: "*"     },
  { name: "POWER"                , args: 2     , flags: 0           , dialect: "*"     },
  { name: "RADIANS"              , args: 1     , flags: 0           , dialect: "*"     },
  { name: "RANDOM"               , args: 0     , flags: 0           , dialect: "*"      , compile: compileRANDOM },
  { name: "ROUND"                , args: [1, 2], flags: 0           , dialect: "*"     },
  { name: "SIGN"                 , args: 1     , flags: 0           , dialect: "*"     },
  { name: "SIN"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "SQRT"                 , args: 1     , flags: 0           , dialect: "*"     },
  { name: "TAN"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "TRUNC"                , args: 1     , flags: 0           , dialect: "*"      , compile: compileTRUNC },
  { name: "WIDTH_BUCKET"         , args: 4     , flags: 0           , dialect: "pgsql" }
], { category: "math", flags: kFunction });

register([
  { name: "SETSEED"              , args: 1     , flags: 0           , dialect: "pgsql" }
], { category: "math", flags: kFunction | kVoid });

register([
  { name: "ASCII"                , args: 1     , flags: 0           , dialect: "*"     },
  { name: "BIT_LENGTH"           , args: 1     , flags: 0           , dialect: "*"     },
  { name: "BTRIM"                , args: [1, N], flags: 0           , dialect: "pgsql" },
  { name: "CHAR"                 , args: [1, N], flags: 0           , dialect: "mysql" },
  { name: "CHAR_LENGTH"          , args: 1     , flags: 0           , dialect: "*"     },
  { name: "CHR"                  , args: 1     , flags: 0           , dialect: "*"      , compile: compileCHR },
  { name: "CONCAT"               , args: [1, N], flags: 0           , dialect: "*"     },
  { name: "CONCAT_WS"            , args: [2, N], flags: 0           , dialect: "*"     },
  { name: "CONVERT"              , args: 3     , flags: 0           , dialect: "pgsql" },
  { name: "CONVERT_FROM"         , args: 2     , flags: 0           , dialect: "pgsql" },
  { name: "CONVERT_TO"           , args: 2     , flags: 0           , dialect: "pgsql" },
  { name: "FORMAT"               , args: null  , flags: 0           , dialect: "-"     },
  { name: "INITCAP"              , args: 1     , flags: 0           , dialect: "pgsql" },
  { name: "LEFT"                 , args: 2     , flags: 0           , dialect: "*"     },
  { name: "LENGTH"               , args: 1     , flags: 0           , dialect: "*"     },
  { name: "LOWER"                , args: 1     , flags: 0           , dialect: "*"     },
  { name: "LPAD"                 , args: [2, 3], flags: 0           , dialect: "*"     },
  { name: "LTRIM"                , args: [1, N], flags: 0           , dialect: "*"     },
  { name: "MD5"                  , args: 1     , flags: 0           , dialect: "*"     },
  { name: "OCTET_LENGTH"         , args: 1     , flags: 0           , dialect: "*"     },
  { name: "OVERLAY"              , args: null  , flags: 0           , dialect: "pgsql" }, // TODO:
  { name: "PG_CLIENT_ENCODING"   , args: 0     , flags: 0           , dialect: "pgsql" },
  { name: "POSITION"             , args: null  , flags: 0           , dialect: "*"     }, // TODO:
  { name: "REPEAT"               , args: 2     , flags: 0           , dialect: "*"     },
  { name: "REPLACE"              , args: 3     , flags: 0           , dialect: "*"     },
  { name: "REVERSE"              , args: 1     , flags: 0           , dialect: "*"     },
  { name: "RIGHT"                , args: 2     , flags: 0           , dialect: "*"     },
  { name: "RPAD"                 , args: [2, 3], flags: 0           , dialect: "*"     },
  { name: "RTRIM"                , args: [1, N], flags: 0           , dialect: "*"     },
  { name: "SPLIT_PART"           , args: 3     , flags: 0           , dialect: "pgsql" },
  { name: "STRCMP"               , args: 2     , flags: 0           , dialect: "mysql" },
  { name: "STRPOS"               , args: 2     , flags: 0           , dialect: "pgsql" },
  { name: "SUBSTR"               , args: [2, 3], flags: 0           , dialect: "*"     },
  { name: "SUBSTRING"            , args: null  , flags: 0           , dialect: "*"     },
  { name: "TRANSLATE"            , args: 3     , flags: 0           , dialect: "pgsql" },
  { name: "TRIM"                 , args: null  , flags: 0           , dialect: "*"     },
  { name: "UPPER"                , args: 1     , flags: 0           , dialect: "*"     }
], { category: "string", flags: kFunction });

register([
  { name: "DECODE"               , args: null  , flags: 0           , dialect: "*"     },
  { name: "ENCODE"               , args: null  , flags: 0           , dialect: "*"     },

  { name: "GET_BIT"              , args: null  , flags: 0           , dialect: "*"     },
  { name: "GET_BYTE"             , args: null  , flags: 0           , dialect: "*"     },
  { name: "QUOTE_IDENT"          , args: null  , flags: 0           , dialect: "*"     },
  { name: "QUOTE_LITERAL"        , args: null  , flags: 0           , dialect: "*"     },
  { name: "QUOTE_NULLABLE"       , args: null  , flags: 0           , dialect: "*"     },
  { name: "REGEXP_MATCHES"       , args: null  , flags: 0           , dialect: "*"     },
  { name: "REGEXP_REPLACE"       , args: null  , flags: 0           , dialect: "*"     },
  { name: "REGEXP_SPLIT_TO_ARRAY", args: null  , flags: 0           , dialect: "*"     },
  { name: "REGEXP_SPLIT_TO_TABLE", args: null  , flags: 0           , dialect: "*"     },
  { name: "SET_BIT"              , args: null  , flags: 0           , dialect: "*"     },
  { name: "SET_BYTE"             , args: null  , flags: 0           , dialect: "*"     },
  { name: "TO_ASCII"             , args: null  , flags: 0           , dialect: "*"     },
  { name: "TO_HEX"               , args: null  , flags: 0           , dialect: "*"     }
], { category: "other", flags: kFunction });

register([
  { name: "ISEMPTY"              , args: 1     , dialect: "pgsql" },
  { name: "LOWER_INC"            , args: 1     , dialect: "pgsql" },
  { name: "LOWER_INF"            , args: 1     , dialect: "pgsql" },
  { name: "UPPER_INC"            , args: 1     , dialect: "pgsql" },
  { name: "UPPER_INF"            , args: 1     , dialect: "pgsql" },
  { name: "RANGE_MERGE"          , args: 2     , dialect: "pgsql" }
], { category: "range", flags: kFunction });

register([
  { name: "ARRAY_APPEND"         , args: 2     , dialect: "pgsql" , desc: "Append $2 to the array" },
  { name: "ARRAY_CAT"            , args: 2     , dialect: "pgsql" , desc: "Concatenate arrays $1 and $2" },
  { name: "ARRAY_DIMS"           , args: 1     , dialect: "pgsql" , desc: "Return a text representation of array's dimensions" },
  { name: "ARRAY_NDIMS"          , args: 1     , dialect: "pgsql" , desc: "Return the number of dimensions of the array" },
  { name: "ARRAY_FILL"           , args: [2, N], dialect: "pgsql" , desc: "Return an array initialized with supplied value and dimensions" },
  { name: "ARRAY_LENGTH"         , args: 2     , dialect: "pgsql" , desc: "Return the length of the requested array dimension" },
  { name: "ARRAY_LOWER"          , args: 2     , dialect: "pgsql" , desc: "Return lower bound of the requested array dimension" },
  { name: "ARRAY_POSITION"       , args: [2, 3], dialect: "pgsql" , desc: "Return the subscript of the first occurrence of $2, optionally starting from $3" },
  { name: "ARRAY_POSITIONS"      , args: 2     , dialect: "pgsql" , desc: "Return an array of subscripts of all occurrences of $2 in the array" },
  { name: "ARRAY_PREPEND"        , args: 2     , dialect: "pgsql" , desc: "Prepend $2 to the array" },
  { name: "ARRAY_REMOVE"         , args: 2     , dialect: "pgsql" , desc: "Remove all elements equal to $2 from the array" },
  { name: "ARRAY_REPLACE"        , args: 3     , dialect: "pgsql" , desc: "Replace each element equal to $2 with $3" },
  { name: "ARRAY_TO_STRING"      , args: [2, 3], dialect: "pgsql" , desc: "Concatenates $1 and $2 optionally using delimiter $3" },
  { name: "ARRAY_UPPER"          , args: 2     , dialect: "pgsql" , desc: "Return upper bound of the requested array dimension" },
  { name: "CARDINALITY"          , args: 1     , dialect: "pgsql" , desc: "Return the total number of elements in the array" },
  { name: "STRING_TO_ARRAY"      , args: [2, 3], dialect: "pgsql" , desc: "Split string into array elements optionally using delimiter $3" },
  { name: "UNNEST"               , args: [1, N], dialect: "pgsql" , desc: "Expand an array (or multiple arrays) to a set of rows" }
], { category: "array", flags: kFunction });

register([
  { name: "STRING_AGG"           , args: 2     , dialect: "pgsql" , desc: "Input values concatenated into a string, separated by $2" }
], { category: "string", flags: kFunction | kAggregate });

register([
  { name: "ARRAY_AGG"            , args: 1     , dialect: "pgsql" }
], { category: "array", flags: kFunction | kAggregate });

register([
  { name: "AVG"                  , args: 1     , dialect: "*"     , desc: "The average (arithmetic mean) of all input values" },
  { name: "BIT_AND"              , args: 1     , dialect: "*"     , desc: "The bitwise AND of all NON-NULL input values, or NULL" },
  { name: "BIT_OR"               , args: 1     , dialect: "*"     , desc: "The bitwise OR of all NON-NULL input values, or NULL" },
  { name: "BIT_XOR"              , args: 1     , dialect: "mysql" , desc: "The bitwise XOR of all NON-NULL input values, or NULL" },
  { name: "BOOL_AND"             , args: 1     , dialect: "pgsql" , desc: "TRUE if all input values are TRUE, otherwise FALSE" },
  { name: "BOOL_OR"              , args: 1     , dialect: "pgsql" , desc: "TRUE if at least one input value is TRUE, otherwise FALSE" },
  { name: "COUNT"                , args: 1     , dialect: "*"     , desc: "Number of input rows (*) for which the value of expression is not null" },
  { name: "MAX"                  , args: 1     , dialect: "*"     , desc: "Maximum value of expression across all input values" },
  { name: "MIN"                  , args: 1     , dialect: "*"     , desc: "Minimum value of expression across all input values" },
  { name: "SUM"                  , args: 1     , dialect: "*"     , desc: "Sum of expression across all input values" }
], { category: "general", flags: kFunction | kAggregate });

register([
  { name: "JSON_AGG"             , args: 1     , dialect: "pgsql" , desc: "Aggregates values as a JSON array" },
  { name: "JSONB_AGG"            , args: 2     , dialect: "pgsql" , desc: "Aggregates values as a JSON array" },
  { name: "JSON_OBJECT_AGG"      , args: 2     , dialect: "pgsql" , desc: "Aggregates name/value pairs as a JSON object" },
  { name: "JSONB_OBJECT_AGG"     , args: 2     , dialect: "pgsql" , desc: "Aggregates name/value pairs as a JSON object" }
], { category: "json", flags: kFunction | kAggregate });

register([
  { name: "XMLAGG"               , args: 1     , dialect: "pgsql" , desc: "Concatenation of XML values" }
], { category: "xml", flags: kFunction | kAggregate });

register([
  { name: "CORR"                 , args: 2     , dialect: "pgsql" , desc: "Correlation coefficient" },
  { name: "COVAR_POP"            , args: 2     , dialect: "pgsql" , desc: "Population covariance" },
  { name: "COVAR_SAMP"           , args: 2     , dialect: "pgsql" , desc: "Sample covariance" },
  { name: "REGR_AVGX"            , args: 2     , dialect: "pgsql" , desc: "Average of the independent variable (sum(X)/N)" },
  { name: "REGR_AVGY"            , args: 2     , dialect: "pgsql" , desc: "Average of the dependent variable (sum(Y)/N)" },
  { name: "REGR_COUNT"           , args: 2     , dialect: "pgsql" , desc: "Number of input rows in which both expressions are NON-NULL" },
  { name: "REGR_INTERCEPT"       , args: 2     , dialect: "pgsql" , desc: "Y-intercept of the least-squares-fit linear equation determined by the (X, Y) pairs" },
  { name: "REGR_R2"              , args: 2     , dialect: "pgsql" , desc: "Square of the correlation coefficient" },
  { name: "REGR_SLOPE"           , args: 2     , dialect: "pgsql" , desc: "Slope of the least-squares-fit linear equation determined by the (X, Y) pairs" },
  { name: "REGR_SXX"             , args: 2     , dialect: "pgsql" , desc: "`sum(X^2) - sum(X)^2/N` - sum of squares of the independent variable" },
  { name: "REGR_SXY"             , args: 2     , dialect: "pgsql" , desc: "`sum(X*Y) - sum(X) * sum(Y)/N` - sum of products of independent times dependent variable)" },
  { name: "REGR_SYY"             , args: 2     , dialect: "pgsql" , desc: "`sum(Y^2) - sum(Y)^2/N` - sum of squares of the dependent variable" },
  { name: "STDDEV_POP"           , args: 1     , dialect: "pgsql" , desc: "Population standard deviation of the input values" },
  { name: "STDDEV_SAMP"          , args: 1     , dialect: "pgsql" , desc: "Sample standard deviation of the input values" },
  { name: "VAR_POP"              , args: 1     , dialect: "pgsql" , desc: "Population variance of the input values" },
  { name: "VAR_SAMP"             , args: 1     , dialect: "pgsql" , desc: "Sample variance of the input values" }
], { category: "statistics", flags: kFunction | kAggregate });

register([
  { name: "CUME_DIST"            , args: [1, N], dialect: "pgsql" , desc: "Rank of the hypothetical row, with gaps for duplicate rows" },
  { name: "DENSE_RANK"           , args: [1, N], dialect: "pgsql" , desc: "Rank of the hypothetical row, without gaps" },
  { name: "PERCENT_RANK"         , args: [1, N], dialect: "pgsql" , desc: "Relative rank of the hypothetical row, ranging from 0 to 1" },
  { name: "RANK"                 , args: [1, N], dialect: "pgsql" , desc: "Relative rank of the hypothetical row, ranging from 1/N to 1" }
], { category: "hypothetical-set", flags: kFunction | kAggregate });

// TODO:
/*
  { name: "EXISTS"               , args: null  , dialect: "*"     },
*/

OpInfo.alias("!=", "<>");
OpInfo.alias("POW", "POWER");
OpInfo.alias("CEIL", "CEILING");
OpInfo.alias("EVERY", "BOOL_AND");
OpInfo.alias("STDDEV", "STDDEV_SAMP");
OpInfo.alias("VARIANCE", "VAR_SAMP");

OpInfo.not("=", "<>");
OpInfo.not(">", "<=");
OpInfo.not("<", ">=");
OpInfo.not("~", "!~");
OpInfo.not("~*", "!~*");

// Add all known functions to `xql` namespace.
OpInfo.forEach(function(_alias, info) {
  const alias = _alias;
  const flags = info.flags;

  if (flags & kFunction) {
    const name = info.name;
    const Func = info.ctor;

    xql[alias] = function(/* ... */) {
      return new Func(name, slice.call(arguments, 0));
    };
  }
});

})();

}).apply(this, typeof module === "object" ? [exports] : [this.xql = {}]);
