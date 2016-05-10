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

/**
 * Miscellaneous namespace.
 *
 * @namespace
 * @alias xql.misc
 */
const xql$misc = xql.misc = {};

// xql.misc.VERSION
//
// Version information in a "major.minor.patch" form.
//
// Note: Version information has been put into the `xql.misc` namespace to
// prevent a possible clashing with SQL builder's interface exported in the
// root namespace.
xql$misc.VERSION = "1.0.0";

// Always returns false, used internally for browser support.
function returnFalse() { return false; }

// Global shorthands.
const isArray  = Array.isArray;
const isBuffer = typeof Buffer === "function" ? Buffer.isBuffer : returnFalse;
const slice    = Array.prototype.slice;
const hasOwn   = Object.prototype.hasOwnProperty;

// Empty object used as an replacement for value of object with no properties.
const EmptyObject = {};

// Global regular expressions.
const reNewLine   = /\n/g;                // Check for new line characters.
const reInt       = /^-?\d+$/;            // Check for a well-formatted int with optional '-' sign.
const reUpperCase = /^[A-Z_][A-Z_0-9]*$/; // Check for an UPPERCASE_ONLY string.
// Checks if a string is a well formatted integer or floating point number, also
// accepts scientific notation "E[+-]?xxx".
const reNumber = /^(NaN|-?Infinity|^-?((\d+\.?|\d*\.\d+)([eE][-+]?\d+)?))$/;

// Map of identifiers that are not escaped.
const IdentifierMap = {
  "*"       : true
};

// Map of strings which can be implicitly casted to `TRUE` or `FALSE`.
const BoolMap = {
  "0"       : "FALSE",
  "f"       : "FALSE",
  "false"   : "FALSE",
  "n"       : "FALSE",
  "no"      : "FALSE",
  "off"     : "FALSE",

  "1"       : "TRUE",
  "t"       : "TRUE",
  "true"    : "TRUE",
  "y"       : "TRUE",
  "yes"     : "TRUE",
  "on"      : "TRUE"
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

// Operator flags.
const OperatorFlags = {
  kUnary       : 0x00000001, // Operator is unary (has one child node - `value`).
  kBinary      : 0x00000002, // Operator is binary (has two child nodes - `left` and `right`).

  kCond        : 0x00000010, // Operator is a conditional expression.
  kData        : 0x00000020, // Operator processes data (has a result).

  kInPlaceNot  : 0x00001000, // Operator allows in place NOT (a NOT OP b).
  kLeftValues  : 0x00002000, // Operator expects left  values as (a, b[, ...]).
  kRightValues : 0x00004000, // Operator expects right values as (a, b[, ...]).

  kBoolean     : 0x00010000, // Operator allows boolean  operands.
  kNumber      : 0x00020000, // Operator allows number   operands.
  kString      : 0x00040000, // Operator allows string   operands.
  kArray       : 0x00080000, // Operator allows array    operands.
  kJson        : 0x00100000, // Operator allows json     operands.
  kRange       : 0x00200000, // Operator allows range    operands.
  kGeometry    : 0x00400000  // Operator allows geometry operands.
};

// Operator definitions.
const OperatorDefs = (function() {
  const kUnary        = OperatorFlags.kUnary;
  const kBinary       = OperatorFlags.kBinary;

  const kCond         = OperatorFlags.kCond;
  const kData         = OperatorFlags.kData;

  const kInPlaceNot   = OperatorFlags.kInPlaceNot;
  const kLeftValues   = OperatorFlags.kLeftValues;
  const kRightValues  = OperatorFlags.kRightValues;

  const kBoolean      = OperatorFlags.kBoolean;
  const kNumber       = OperatorFlags.kNumber;
  const kString       = OperatorFlags.kString;
  const kArray        = OperatorFlags.kArray;
  const kJson         = OperatorFlags.kJson;
  const kRange        = OperatorFlags.kRange;
  const kGeometry     = OperatorFlags.kGeometry;

  const kAnyType      = kBoolean  |
                        kNumber   |
                        kString   |
                        kArray    |
                        kJson     |
                        kRange    |
                        kGeometry ;

  var defs = {};

  function add(op, flags) {
    var def = {
      op    : op,
      as    : " " + op + " ",
      not   : null,
      flags : flags
    };
    defs[op] = def;
  }

  // +---------+---------------------------+-----------------------------------+
  // | Keyword | Operator Type             | Operator Flags                    |
  // +---------+---------------------------+-----------------------------------+
  add("="      , kBinary | kCond           | kNumber | kString                 );
  add(">"      , kBinary | kCond           | kNumber | kString                 );
  add(">="     , kBinary | kCond           | kNumber | kString                 );
  add("<"      , kBinary | kCond           | kNumber | kString                 );
  add("<="     , kBinary | kCond           | kNumber | kString                 );
  add("<>"     , kBinary | kCond           | kNumber | kString                 );
  add("@>"     , kBinary | kCond           | kArray  | kRange                  ); // Contains
  add("<@"     , kBinary | kCond           | kArray  | kRange                  ); // Contained By.
  add("&&"     , kBinary | kCond           | kRange                            ); // Overlap.
  add("&<"     , kBinary | kCond           | kRange                            ); // Right Of.
  add("&>"     , kBinary | kCond           | kRange                            ); // Left Of.
  add("-|-"    , kBinary | kCond           | kRange                            ); // Adjacent To.
  add("+"      , kBinary | kData           | kNumber | kArray | kRange         ); // Add/Union.
  add("-"      , kBinary | kData           | kNumber | kArray | kRange         ); // Sub/Difference.
  add("*"      , kBinary | kData           | kNumber | kArray | kRange         ); // Multiply/Intersect.
  add("/"      , kBinary | kData           | kNumber                           ); // Divide.
  add("%"      , kBinary | kData           | kNumber                           ); // Modulo.
  add("^"      , kBinary | kData           | kNumber                           ); // Power.
  add("&"      , kBinary | kData           | kNumber                           ); // Bit-And.
  add("|"      , kBinary | kData           | kNumber                           ); // Bit-Or.
  add("#"      , kBinary | kData           | kNumber                           ); // Bit-Xor.
  add("~"      , kBinary | kCond | kData   | kNumber | kString                 ); // Bit-Not/Match.
  add("<<"     , kBinary | kCond | kData   | kNumber | kRange                  ); // Shift-Left/LeftOf.
  add(">>"     , kBinary | kCond | kData   | kNumber | kRange                  ); // Shift-Right/RightOf.
  add("||"     , kBinary | kData           | kString                           ); // Concat.
  add("~*"     , kBinary | kCond           | kString                           ); // Match (I).
  add("!~"     , kBinary | kCond           | kString                           ); // Not Match.
  add("!~*"    , kBinary | kCond           | kString                           ); // Not Match (I).

  add("IS"     , kBinary | kCond           | kAnyType     | kInPlaceNot        ); // IS.
  add("AND"    , kBinary | kCond           | kBoolean     | kInPlaceNot        ); // Logical And.
  add("OR"     , kBinary | kCond           | kBoolean     | kInPlaceNot        ); // Logical Or.
  add("LIKE"   , kBinary | kCond           | kString      | kInPlaceNot        ); // Like.
  add("ILIKE"  , kBinary | kCond           | kString      | kInPlaceNot        ); // Like (I).
  add("IN"     , kBinary | kCond           | kRightValues | kInPlaceNot        ); // In.

  // Aliases;
  defs["!="] = defs["<>"];

  // Negations.
  defs["="  ].not = defs["<>" ];
  defs[">"  ].not = defs["<=" ];
  defs[">=" ].not = defs["<"  ];
  defs["<"  ].not = defs[">=" ];
  defs["<=" ].not = defs[">"  ];
  defs["<>" ].not = defs["="  ];
  defs["~"  ].not = defs["!~" ];
  defs["!~" ].not = defs["~"  ];
  defs["~*" ].not = defs["!~*"];
  defs["!~*"].not = defs["~*" ];

  return defs;
})();

// Node flags.
const NodeFlags = {
  kImmutable    : 0x00000001,
  kNot          : 0x00000002,

  kAscending    : 0x00000010,
  kDescending   : 0x00000020,
  kNullsFirst   : 0x00000040,
  kNullsLast    : 0x00000080,

  kAll          : 0x00000100,
  kDistinct     : 0x00000200,
  kAllOrDistinct: 0x00000300
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

// List of ordinary functions, which will become available in `xql` namespace.
const functionsList = [
  "ABS",
  "ACOS",
  "ARRAY_APPEND",
  "ARRAY_CAT",
  "ARRAY_DIMS",
  "ARRAY_NDIMS",
  "ARRAY_FILL",
  "ARRAY_LENGTH",
  "ARRAY_LOWER",
  "ARRAY_PREPEND",
  "ARRAY_REMOVE",
  "ARRAY_REPLACE",
  "ARRAY_TO_STRING",
  "ARRAY_UPPER",
  "ASCII",
  "ASIN",
  "ATAN",
  "ATAN2",
  "BIT_LENGTH",
  "BTRIM",
  "CBRT",
  "CEIL",
  "CEILING",
  "CHAR_LENGTH",
  "CHR",
  "COALESCE",
  "CONCAT",
  "CONCAT_WS",
  "CONVERT",
  "CONVERT_FROM",
  "CONVERT_TO",
  "COS",
  "COT",
  "DECODE",
  "DEGREES",
  "DIV",
  "ENCODE",
  "EXISTS",
  "EXP",
  "FLOOR",
  "FORMAT",
  "GET_BIT",
  "GET_BYTE",
  "GREATEST",
  "INITCAP",
  "ISEMPTY",
  "LEAST",
  "LEFT",
  "LENGTH",
  "LN",
  "LOG",
  "LOWER",
  "LOWER_INC",
  "LOWER_INF",
  "LPAD",
  "LTRIM",
  "MD5",
  "MOD",
  "NULLIF",
  "OCTET_LENGTH",
  "OVERLAY",
  "PG_CLIENT_ENCODING",
  "PI",
  "POSITION",
  "POWER",
  "QUOTE_IDENT",
  "QUOTE_LITERAL",
  "QUOTE_NULLABLE",
  "RADIANS",
  "RANDOM",
  "REGEXP_MATCHES",
  "REGEXP_REPLACE",
  "REGEXP_SPLIT_TO_ARRAY",
  "REGEXP_SPLIT_TO_TABLE",
  "REPEAT",
  "REPLACE",
  "REVERSE",
  "RIGHT",
  "ROUND",
  "RPAD",
  "RTRIM",
  "SET_BIT",
  "SET_BYTE",
  "SETSEED",
  "SIGN",
  "SIN",
  "SPLIT_PART",
  "SQRT",
  "STRING_TO_ARRAY",
  "STRPOS",
  "SUBSTR",
  "SUBSTRING",
  "TAN",
  "TO_ASCII",
  "TO_HEX",
  "TRANSLATE",
  "TRIM",
  "TRUNC",
  "UNNEST",
  "UPPER",
  "UPPER_INC",
  "UPPER_INF",
  "WIDTH_BUCKET"
];

// List of aggregate functions, which will become available in `xql` namespace.
const aggregatesList = [
  "ARRAY_AGG",
  "AVG",
  "BIT_AND",
  "BIT_OR",
  "BOOL_AND",
  "BOOL_OR",
  "CORR",
  "COUNT",
  "COVAR_POP",
  "COVAR_SAMP",
  "EVERY",
  "JSON_AGG",
  "MAX",
  "MIN",
  "REGR_AVGX",
  "REGR_AVGY",
  "REGR_COUNT",
  "REGR_INTERCEPT",
  "REGR_R2",
  "REGR_SLOPE",
  "REGR_SXX",
  "REGR_SXY",
  "REGR_SYY",
  "STDDEV",
  "STDDEV_POP",
  "STDDEV_SAMP",
  "STRING_AGG",
  "SUM",
  "VARIANCE",
  "VAR_POP",
  "VAR_SAMP",
  "XMLAGG"
];

// ============================================================================
// [xql.error]
// ============================================================================

/**
 * Error classes namespace.
 *
 * @namespace
 * @alias xql.error
 */
const xql$error = xql.error = {};

/**
 * Error thrown if data is wrong.
 * @param message Error mesasge.
 * @class xql.error.ValueError
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
 * @class xql.error.CompileError
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

/**
 * Convert a given string `s` into a camelCase representation.
 *
 * @param {string} s
 * @return {string}
 *
 * @function xql.misc.toCamelCase(s)
 */
const toCamelCase = (function() {
  const re = /_[a-z]/g;

  function fn(s) {
    return s.charAt(1);
  }

  function toCamelCase(s) {
    return s.toLowerCase().replace(re, fn);
  }

  return toCamelCase;
})();
xql$misc.toCamelCase = toCamelCase;

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
  return hasOwnProperty.call(xql$dialect$map, dialect);
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

  if (!hasOwnProperty.call(xql$dialect$map, dialect))
    throwTypeError("xql.dialect.newContext() - Unknown dialect '" + dialect + "'");

  var classobj = xql$dialect$map[dialect];
  return new classobj(options);
}
xql$dialect.newContext = $xql$dialect$newContext;

/**
 * Database dialect context that implements a dialect-specific functionality.
 *
 * @param {string} dialect Database dialect the context is using.
 * @param {object} options Context options.
 *
 * @class
 * @alias xql.dialect.Context
 */
class Context {
  constructor(dialect, options) {
    this.dialect = dialect;
    this.pretty = options.pretty ? true : false;
    this.indentation = options.indentation || 2;

    this.spaceOrNL = ""; // Space character, either " " or "\n" (pretty).
    this.commaStr = "";  // Comma separator, either ", " or ",\n" (pretty).
    this.indentStr = ""; // Indentation string.
    this.concatStr = ""; // Concatenation string, equals to `space + indentStr`.

    this.indent = null;
    this.concat = null;

    this._update();
  }

  /**
   * Escapes a single or multiple SQL identifier(s).
   *
   * @param {...string} args A single or multiple SQL identifiers to escape.
   * @return {string} Escaped identifier(s).
   *
   * @abstract
   */
  escapeIdentifier() {
    throwTypeError("Abstract method called");
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
   *
   * @abstract
   */
  escapeValue(value, explicitType) {
    throwTypeError("Abstract method called");
  }

  /**
   * Escapes a number `value` into a SQL number.
   *
   * @param {number} value A numeric value to escape.
   * @return {string} Escaped `value` as string.
   *
   * @abstract
   */
  escapeNumber(value) {
    throwTypeError("Abstract method called");
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
   * @param {Buffer} value A buffer to escape.
   * @return {string} Escaped `value` as buffer.
   *
   * @abstract
   */
  escapeBuffer(value) {
    throwTypeError("Abstract method called");
  }

  /**
   * Escapes an array into SQL `VALUES` representation.
   *
   * @param {array} value An array to escape.
   * @return {string} Escaped `value` as SQL `VALUES`.
   *
   * @abstract
   */
  escapeValues(value) {
    throwTypeError("Abstract method called");
  }

  /**
   * Escapes an array into SQL-ARRAY representation.
   *
   * @param {array} value An array to escape.
   * @param {boolean} isNested Whether the array is nested in another array.
   *   Some dialects (like pgsql) need this information to properly escape the
   *   array.
   * @return {string} Escaped `value` as SQL-ARRAY.
   *
   * @abstract
   */
  escapeArray(value, isNested) {
    throwTypeError("Abstract method called");
  }

  /**
   * Escapes a value into SQL-JSON representation.
   *
   * @param {*} value A value to escape.
   * @return {string} Escaped `value` as SQL-JSON.
   *
   * @abstract
   */
  escapeJson(value) {
    throwTypeError("Abstract method called");
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

  /**
   * Called whenever some property is changed to update all computed properties.
   *
   * @private
   */
  _update() {
    var compact = !this.pretty;

    this.spaceOrNL = compact ? " "  : "\n";
    this.commaStr  = compact ? ", " : ",\n";
    this.indentStr = compact ? ""   : " ".repeat(this.indentation);
    this.concatStr = compact ? " "  : this.spaceOrNL + this.indentStr;

    this.indent    = compact ? this._indent$none : this._indent$pretty;
    this.concat    = compact ? this._concat$none : this._concat$pretty;
  }

  /**
   * Indents a given string `s` by the Context's indentation settings if pretty
   * print is enabled, otherwise does nothing.
   *
   * @param {string} s String to indent.
   * @return {string} Indented string if indentation is enabled or unchanged `s`.
   *
   * @function indent
   */
  _indent$none(s) {
    return s;
  }

  _indent$pretty(s) {
    var indentStr = this.indentStr;
    return indentStr + s.replace(reNewLine, "\n" + indentStr);
  }

  /**
   * Called before a string `s` is concatenated into a SQL expression in a way
   * that may require a new line if pretty printing is enabled. It returns the
   * original string prefixed with a space or a line break and possibly indented.
   *
   * @param {string} s Input string to process.
   * @return {string} Possibly modified string.
   *
   * @function concat
   *
   * TODO: Change the name
   */
  _concat$none(s) {
    return " " + s;
  }

  _concat$pretty(s) {
    var concatStr = this.concatStr;
    return concatStr + s.replace(reNewLine, concatStr);
  }
}
xql$dialect.Context = Context;

// ============================================================================
// [xql.pgsql]
// ============================================================================

(function() {

const reEscapeIdent = /[\.\x00]/g;
const reEscapeChars = /[\"\$\'\?]/g;

const reEscapeString =  /[\0\b\f\n\r\t\\\']/g;
const mpEscapeString = {
  "\0": "\\x00",// Null character.
  "\b": "\\b",  // Backspace.
  "\f": "\\f",  // Form Feed.
  "\n": "\\n",  // New Line.
  "\r": "\\r",  // Carriage Return.
  "\t": "\\t",  // Tag.
  "\\": "\\\\", // Backslash.
  "\'": "\\\'"  // Single Quote.
};
function fnEscapeString(s) {
  if (s.charCodeAt(0) === 0)
    throwCompileError("String can't contain NULL character");
  return mpEscapeString[s];
}

// \class PGSQLContext
//
// PostgreSQL context.
class PGSQLContext extends Context {
  constructor(options) {
    super("pgsql", options);
  }

  /** @override */
  escapeIdentifier() {
    var output = "";

    for (var i = 0, len = arguments.length; i < len; i++) {
      var a = arguments[i];

      // Gaps are allowed.
      if (!a)
        continue;

      // Apply escaping to all parts of an identifier (if any).
      for (;;) {
        var m = a.search(reEscapeIdent);
        var p = a;

        // Multiple arguments are joined by using ".".
        if (output)
          output += ".";

        if (m !== -1) {
          var c = a.charCodeAt(m);

          // '.' ~= 46.
          if (c === 46)
            p = a.substr(0, m);
          else // (c === 0)
            throwCompileError("Identifier can't contain NULL character");
        }

        if (hasOwn.call(IdentifierMap, p))
          output += p;
        else
          output += '"' + p + '"';

        if (m === -1)
          break;

        a = a.substr(m + 1);
      }
    }

    return output;
  }

  /** @override */
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
          if (value == null)
            return "NULL";

          if (typeof value === "boolean")
            return value ? "TRUE" : "FALSE";

          if (typeof value === "string" && hasOwn.call(BoolMap, value))
            return BoolMap[value];

          if (typeof value === "number") {
            if (value === 0) return "FALSE";
            if (value === 1) return "TRUE";
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
          if (value == null)
            return "NULL";

          if (Array.isArray(value))
            return this.escapeArray(value, false);

          // Will throw.
          break;

        case "values":
          if (value == null)
            return "NULL";

          if (Array.isArray(value))
            return this.escapeValues(value, false);

          // Will throw.
          break;

        case "json":
          // `undefined` maps to native DB `NULL` type while `null` maps to
          // JSON `null` type. This is the only way to distinguish between
          // these. `undefined` is disallowed by JSON anyway.
          if (value === undefined)
            return "NULL";

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
    if (typeof value === "string")
      return this.escapeString(value);

    if (typeof value === "number")
      return this.escapeNumber(value);

    if (typeof value === "boolean")
      return value ? "TRUE" : "FALSE";

    // Check - `undefined` and `null`.
    //
    // Undefined implicitly converts to `NULL`.
    if (value == null)
      return "NULL";

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

  /** @override */
  escapeNumber(value) {
    if (!isFinite(value)) {
      if (value === Infinity)
        return "'Infinity'";
      if (value === -Infinity)
        return "'-Infinity'";

      return "'NaN'";
    }

    return value.toString();
  }

  /** @override */
  escapeString(value) {
    var oldLength = value.length;
    value = value.replace(reEscapeString, fnEscapeString);

    // We have to tell Postgres explicitly that the string is escaped by
    // a C-style escaping sequence(s).
    if (value.length !== oldLength)
      return "E'" + value + "'";

    // String doesn't contain any character that has to be escaped. We can
    // use simply '...'.
    return "'" + value + "'";
  }

  /** @override */
  escapeBuffer(value) {
    return "E'\\x" + value.toString("hex") + "'";
  }

  /** @override */
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

  /** @override */
  escapeArray(value, isNested) {
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

    if (isNested)
      return "[" + out + "]";
    else
      return "ARRAY[" + out + "]";
  }

  /** @override */
  escapeJson(value) {
    return this.escapeString(JSON.stringify(value));
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

    // These are hints for javascript runtime. We really want this rountine
    // as fast as possible.
    var i = input.search(reEscapeChars);
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

            // a) String is c-like escaped.
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
            // b) String is SQL escaped.
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
      // Check if the character is question mark (63).
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
 * @class
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

  // \function Node.EQ(b:{Var|Node})
  EQ(b) {
    return BINARY_OP(this, "=", b);
  }

  // \function Node.NE(b:{Var|Node})
  NE(b) {
    return BINARY_OP(this, "<>", b);
  }

  // \function Node.LT(b:{Var|Node})
  LT(b) {
    return BINARY_OP(this, "<", b);
  }

  // \function Node.LE(b:{Var|Node})
  LE(b) {
    return BINARY_OP(this, "<=", b);
  }

  // \function Node.GT(b:{Var|Node})
  GT(b) {
    return BINARY_OP(this, ">", b);
  }

  // \function Node.GE(b:{Var|Node})
  GE(b) {
    return BINARY_OP(this, ">=", b);
  }

  // \function Node.IN(b:{Var|Node})
  //
  // Returns a new Node which contains `this IN b` expression.
  IN(b) {
    var len = arguments.length;

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
}
xql$node.Node = Node;

/**
 * SQL RAW expression.
 *
 * @param {string} expression Expression string.
 * @param {array=} bindings Bindings array used by the expression.
 *
 * @class
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
    if (bindings && bindings.length)
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
   * Gets the raw expression's bindings or `null` if no bindings were provided.
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
 * SQL unary expression.
 *
 * @class
 * @alias xql.node.Unary
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

  /** @override */
  compileNode(ctx) {
    var type = this._type;
    var out = ctx.escapeValue(this._value);

    switch (type) {
      case "NOT":
        out = "NOT " + out;
        break;

      case "-":
        out = "-" + out;
        break;

      default:
        if (type)
          out = type + " " + out;
        break;
    }

    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);

    return out;
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
 * SQL binary expression.
 *
 * @class
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

  addLeft(value) {
    var left = this._left;
    if (!isArray(left))
      throwCompileError("Binary.addLeft() - Left operand is not an Array");

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

  addRight(value) {
    var right = this._right;
    if (!isArray(right))
      throwCompileError("Binary.addRight() - Left operand is not an Array.");

    right.push(value);
    return this;
  }
}
xql$node.Binary = Binary;

/**
 * SQL operator.
 *
 * @class
 * @alias xql.node.Operator
 */
class Operator extends Binary {
  constructor(left, type, right, as) {
    super(left, type, right, as);
  }

  /** @override */
  mustWrap(ctx) {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    var type = this._type;
    var out = "";

    var keyword = "";

    var leftNode = this._left;
    var rightNode = this._right;

    var left = "";
    var right = "";

    if (!type)
      throwCompileError("Operator.compileNode() - No operator specified");

    if (hasOwn.call(OperatorDefs, type)) {
      var op = OperatorDefs[type];
      var flags = op.flags;

      if (flags & OperatorFlags.kLeftValues)
        left = ctx.escapeValues(leftNode);

      if (flags & OperatorFlags.kRightValues)
        right = ctx.escapeValues(rightNode);

      // Check if the right operand is `NULL` and convert the operator to `IS`
      // or `IS NOT` if necessary to be more conforming with SQL standard.
      if (right === "NULL") {
        if (op.op === "=")
          op = OperatorDefs["IS"];
      }

      keyword = op.as;
    }
    else {
      keyword = " " + type + " ";
    }


    if (!left)
      left = ctx.escapeValue(leftNode);
    if (leftNode instanceof Binary)
      left = "(" + left + ")";

    if (!right)
      right = ctx.escapeValue(rightNode);
    if (rightNode instanceof Binary)
      right = "(" + right + ")";

    out = left + keyword + right;

    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);

    return out;
  }
}
xql$node.Operator = Operator;

/**
 * A node that can have children (base for `Logical` and `Func`).
 *
 * @class
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
 * @class
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

// \class node.ObjectOp
//
// Condition defined as an object having multiple properties (key/value pairs).
// Implicit `AND` operator is used to for the query.
class ObjectOp extends Unary {
  constructor(type, value) {
    super(type, "");
    this._value = value;
  }

  /** @override */
  mustWrap(ctx) {
    return false;
  }

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
xql$node.ObjectOp = ObjectOp;

/**
 * SQL identifier.
 *
 * @class
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
 * SQL join expression.
 *
 * @class
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
    var out = "";

    var type = this._type;
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

    var lo = this._left;
    var ro = this._right;

    var left = typeof lo === "string" ? ctx.escapeIdentifier(lo) : lo.compileNode(ctx);
    var right = typeof ro === "string" ? ctx.escapeIdentifier(ro) : ro.compileNode(ctx);

    out = left + keyword + right;

    // Compile `USING (...)` clause.
    var condition = this._condition;
    if (isArray(condition)) {
      var t = "";

      for (var i = 0, len = condition.length; i < len; i++) {
        var identifier = condition[i];

        if (t)
          t += ", ";

        if (typeof identifier === "string")
          t += ctx.escapeIdentifier(identifier);
        else
          t += identifier.compileNode(ctx);
      }

      if (t)
        out += " USING (" + t + ")";
    }
    // Compile `ON ...` clause.
    else if (condition instanceof Node) {
      out += " ON " + condition.compileNode(ctx);
    }

    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);

    return out;
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
 * SQL sort expression.
 *
 * @class
 * @alias xql.node.Sort
 */
class Sort extends Identifier {
  constructor(column, order, nulls) {
    var flags = 0;

    if (order && hasOwn.call(SortDirection, order))
      flags |= SortDirection[order];

    if (nulls && hasOwn.call(SortNulls, nulls))
      flags |= SortNulls[nulls];

    // Doesn't call `Identifier` constructor.
    super("SORT", "");
    this._flags = flags;
    this._value = column;
  }

  /** @override */
  compileNode(ctx) {
    var value = this._value;
    var flags = this._flags;

    // Value of type:
    //   - `number` - describes column order,
    //   - `string` - describes column name.
    //   - `Node`   - SQL expression/column.
    var s;

    if (typeof value === "number")
      s = "" + value;
    else if (typeof value === "string")
      s = ctx.escapeIdentifier(value);
    else if (value instanceof Node)
      s = value.compileNode(ctx);
    else
      throwCompileError("Sort.compileNode() - Invalid value type " + typeof value);

    if (flags & NodeFlags.kAscending)
      s += " ASC";
    else if (flags & NodeFlags.kDescending)
      s += " DESC";

    if (flags & NodeFlags.kNullsFirst)
      s += " NULLS FIRST";
    else if (flags & NodeFlags.kNullsLast)
      s += " NULLS LAST";

    return s;
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
 * SQL function expression.
 *
 * @class
 * @alias xql.node.Func
 */
class Func extends NodeArray {
  constructor(type, values) {
    super(type, "");
    this._flags |= NodeFlags.kAll;
    this._values = values || [];
  }

  /** @override */
  mustWrap() {
    return false;
  }

  /** @override */
  compileNode(ctx) {
    var out = "";

    var flags = this._flags;
    var values = this._values;

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = ctx.escapeValue(value);

      if (out)
        out += ", ";
      out += escaped;
    }

    // Add `DISTINCT` if specified.
    if (flags & NodeFlags.kDistinct)
      out = out ? "DISTINCT " + out : "DISTINCT";

    // Form `FUNCTION([DISTINCT] [parameters...])`.
    out = this._type + "(" + out + ")";

    var as = this._as;
    if (as)
      out += " AS " + ctx.escapeIdentifier(as);

    return out;
  }

  getArguments() {
    return this._values;
  }

  setArguments(args) {
    this._values = args || [];
    return this;
  }
}
xql$node.Func = Func;

/**
 * SQL aggregate function.
 *
 * @class
 * @alias xql.node.Aggregate
 */
class Aggregate extends Func {
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
xql$node.Aggregate = Aggregate;

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
 * @class
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
 * SQL query.
 *
 * Query is a base class that provides basic blocks for implementing:
 *   - `SELECT` - See `SelectQuery`.
 *   - `INSERT` - See `InsertQuery`.
 *   - `UPDATE` - See `UpdateQuery`.
 *   - `DELETE` - See `DeleteQuery`.
 *   - `EXCEPT`, `INTERSECT`, and `UNION` - See `CombiningQuery`.
 *
 * The following features are implemented by the `Query`:
 *   - `TABLE`- Specifies a single database table.
 *   - `SELECT` or `RETURNING`- Specifies select or returning expression columns.
 *   - `WHERE` - Specifies `WHERE` clause.
 *
 * @param {string} type Type of the query.
 *
 * @class
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
    //   - `EXCEPT`, `INTERSECT`, `UNION` - See `CombiningQuery`.
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

  _compileGroupBy(ctx, groupBy) {
    var out = "";
    var commaStr = ctx.commaStr;

    for (var i = 0, len = groupBy.length; i < len; i++) {
      var group = groupBy[i];
      if (out) out += commaStr;

      // Group can be in a form of `string` or `Node`.
      if (typeof group === "string")
        out += ctx.escapeIdentifier(group);
      else
        out += group.compileNode(ctx);
    }

    return out;
  }

  _compileOrderBy(ctx, orderBy) {
    var out = "";
    var commaStr = ctx.commaStr;

    for (var i = 0, len = orderBy.length; i < len; i++) {
      var sort = orderBy[i];
      if (out) out += commaStr;
      out += sort.compileNode(ctx);
    }

    return out;
  }

  _compileFieldsOrReturning(ctx, list) {
    var out = "";
    var commaStr = ctx.commaStr;

    for (var i = 0, len = list.length; i < len; i++) {
      var column = list[i];
      if (out) out += commaStr;

      // Returning column can be in a form of `string` or `Node`.
      if (typeof column === "string") {
        out += ctx.escapeIdentifier(column);
      }
      else {
        var compiled = column.compileNode(ctx);
        if (column.mustWrap())
          out += this._wrapQuery(ctx, compiled);
        else
          out += compiled;
      }
    }

    return out;
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

  _compileFromOrUsing(ctx, node) {
    var out = "";
    if (typeof node === "string")
      out += ctx.escapeIdentifier(node);
    else
      out += node.compileNode(ctx);
    return out;
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
        node = (a instanceof Node) ? a : new ObjectOp("AND", a);
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

  _compileWhereOrHaving(ctx, condition) {
    var out = "";

    var list = condition._values;
    var i, len = list.length;

    if (len === 1)
      return list[0].compileNode(ctx);

    for (i = 0; i < len; i++) {
      var expression = list[i];
      var compiled = expression.compileNode(ctx);

      if (out)
        out += " " + condition._type + " ";

      if (expression.mustWrap())
        out += "(" + compiled + ")";
      else
        out += compiled;
    }

    return out;
  }

  _compileOffsetLimit(ctx, offset, limit) {
    var out = "";

    if (offset)
      out += "OFFSET" + ctx.concatStr + offset;

    if (limit) {
      if (out) out += ctx.spaceOrNL;
      out += "LIMIT" + ctx.concatStr + limit;
    }

    return out;
  }

  _wrapQuery(ctx, str) {
    if (ctx.pretty)
      return "(" + indent(str + ")", " ").substr(1);
    else
      return "(" + str + ")";
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
 * @class
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
    var out = "SELECT";
    var space = ctx.spaceOrNL;
    var flags = this._flags;

    // Compile `SELECT [ALL|DISTINCT]`
    //
    // Use `*` if  fields are not used.
    if (flags & NodeFlags.kDistinct)
      out += " DISTINCT";

    // Compile `[*|fields]`
    //
    // Note, `*` is only used if there are no columns specified.
    var cols = this._fieldsOrReturning;
    out += ctx.concat(cols && cols.length ? this._compileFieldsOrReturning(ctx, cols) : "*");

    // Compile `FROM table[, table[, ...]]` or `FROM table JOIN table [, JOIN ...]`.
    var from = this._fromOrUsing;
    if (from)
      out += space + "FROM" + ctx.concat(this._compileFromOrUsing(ctx, from));

    // Compile `WHERE ...`.
    var where = this._where;
    if (where && where._values.length)
      out += space + "WHERE" + ctx.concat(this._compileWhereOrHaving(ctx, where));

    // Compile `GROUP BY ...`.
    var groupBy = this._groupBy;
    if (groupBy && groupBy.length)
      out += space + "GROUP BY" + ctx.concat(this._compileGroupBy(ctx, groupBy));

    // Compile `HAVING ...`.
    var having = this._having;
    if (having && having._values.length)
      out += space + "HAVING" + ctx.concat(this._compileWhereOrHaving(ctx, having));

    // TODO: Compile `WINDOW ...`.

    // Compile `ORDER BY ...`.
    var orderBy = this._orderBy;
    if (orderBy && orderBy.length)
      out += space + "ORDER BY" + ctx.concat(this._compileOrderBy(ctx, orderBy));

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit)
      out += space + this._compileOffsetLimit(ctx, offset, limit);

    // TODO: Compile `FETCH ...`.
    // TODO: Compile `FOR ...`.

    return out;
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
        node = (a instanceof Node) ? a : new ObjectOp("AND", a);
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
      // Optimization: If `_groupBy` is `null` the given array `f` is referenced.
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
 * @class
 * @alias xql.node.InsertQuery
 */
class InsertQuery extends Query {
  constructor() {
    super("INSERT");
  }

  /** @override */
  compileNode(ctx) {
    var out = "";

    var t = "";
    var space = ctx.spaceOrNL;

    var k;
    var i, len;

    // Compile `INSERT INTO table (...)`.
    var table = this._table;
    var columns = this._columns;
    var typeMapping = this._typeMapping || EmptyObject;

    if (!table)
      throwCompileError("InsertQuery.compileNode() - Table not defined");

    // Compile `INSERT INTO table (...)`.
    if (typeof table === "string")
      t = ctx.escapeIdentifier(table);
    else
      t = table.compileNode(ctx);

    for (k in columns) {
      if (out) out += ", ";
      out += ctx.escapeIdentifier(k);
    }
    out = "INSERT INTO" + ctx.concat(t + " (" + out + ")");

    // Compile `VALUES (...)[, (...)]`.
    var objects = this._values;
    var prefix = (ctx.pretty ? ctx.concatStr : " ") + "(";

    out += space + "VALUES";
    for (i = 0, len = objects.length; i < len; i++) {
      var object = objects[i];

      t = "";
      for (k in columns) {
        if (t) t += ", ";
        if (hasOwn.call(object, k))
          t += ctx.escapeValue(object[k], typeMapping[k]);
        else
          t += "DEFAULT";
      }

      if (i !== 0) out += ",";
      out += prefix + t + ")";
    }

    // Compile `RETURNING ...`.
    var returning = this._fieldsOrReturning;
    if (returning && returning.length)
      out += space + "RETURNING" + ctx.concat(this._compileFieldsOrReturning(ctx, returning));

    return out;
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
 * @class
 * @alias xql.node.UpdateQuery
 */
class UpdateQuery extends Query {
  constructor() {
    super("UPDATE");
  }

  /** @override */
  compileNode(ctx) {
    var out = "";

    var t = "";
    var space = ctx.spaceOrNL;
    var commaStr = ctx.commaStr;

    // Compile `UPDATE ...`
    var table = this._table;
    if (!table)
      throwCompileError("UpdateQuery.compileNode() - Table not defined");

    if (typeof table === "string")
      t = ctx.escapeIdentifier(table);
    else
      t = table.compileNode(ctx);
    out = "UPDATE" + ctx.concat(t);

    // Compile `SET ...`
    var objects = this._values;

    if (!objects)
      throwCompileError("UpdateQuery.compileNode() - No data to update provided");

    if (objects.length !== 1)
      throwCompileError("UpdateQuery.compileNode() - Can only update one record (" + objects.length + " provided)");

    var values = objects[0];
    var typeMapping = this._typeMapping || EmptyObject;

    t = "";
    for (var k in values) {
      var value = values[k];
      var compiled;

      if (!(value instanceof Node))
        compiled = ctx.escapeValue(value, typeMapping[k]);
      else
        compiled = value.compileNode(ctx);

      if (t) t += commaStr;
      t += ctx.escapeIdentifier(k) + " = " + compiled;
    }
    out += space + "SET" + ctx.concat(t);

    // Compile `FROM table[, table[, ...]]` or `FROM table JOIN table [, JOIN ...]`.
    var from = this._fromOrUsing;
    if (from)
      out += space + "FROM"  + ctx.concat(this._compileFromOrUsing(ctx, from));

    // Compile `WHERE ...`.
    var where = this._where;
    if (where && where._values.length)
      out += space + "WHERE" + ctx.concat(this._compileWhereOrHaving(ctx, where));

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit)
      out += space + this._compileOffsetLimit(ctx, offset, limit);

    // Compile `RETURNING ...`.
    var returning = this._fieldsOrReturning;
    if (returning && returning.length)
      out += space + "RETURNING" + ctx.concat(this._compileFieldsOrReturning(ctx, returning));

    return out;
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
 * @class
 * @alias xql.node.DeleteQuery
 */
class DeleteQuery extends Query {
  constructor() {
    super("DELETE");
  }

  /** @override */
  compileNode(ctx) {
    var out = "";

    var t = "";
    var space = ctx.spaceOrNL;

    // Compile `DELETE FROM ...`
    var table = this._table;
    if (!table)
      throwCompileError("DeleteQuery.compileNode() - Table not defined");

    if (typeof table === "string")
      t = ctx.escapeIdentifier(table);
    else
      t = table.compileNode(ctx);

    out += "DELETE FROM" + ctx.concat(t);

    // Compile `USING table[, table[, ...]]` or `USING table JOIN table [, JOIN ...]`.
    var using = this._fromOrUsing;
    if (using)
      out += space + "USING" + ctx.concat(this._compileFromOrUsing(ctx, using));

    // Compile `WHERE ...`
    var where = this._where;
    if (where && where._values.length)
      out += space + "WHERE" + ctx.concat(this._compileWhereOrHaving(ctx, where));

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit)
      out += space + this._compileOffsetLimit(ctx, offset, limit);

    // Compile `RETURNING ...`.
    var returning = this._fieldsOrReturning;
    if (returning && returning.length)
      out += space + "RETURNING" + ctx.concat(this._compileFieldsOrReturning(ctx, returning));

    return out;
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
 * @class
 * @alias xql.node.CombiningQuery
 */
class CombiningQuery extends Query {
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
    var out = "";
    var space = ctx.spaceOrNL;

    var flags = this._flags;
    var combineOp = this._type;

    if (flags & NodeFlags.kAll)
      combineOp += " ALL";

    var values = this._values;
    var separator = space + combineOp + space;

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var compiled = ctx.escapeValue(value);

      if (out)
        out += separator;

      // TODO: This is not nice, introduce something better than this.
      var mustWrap = !(value instanceof Query) || (value instanceof CombiningQuery);
      if (mustWrap)
        compiled = this._wrapQuery(ctx, compiled);

      out += compiled;
    }

    // Compile `ORDER BY ...`.
    var orderBy = this._orderBy;
    if (orderBy && orderBy.length)
      out += space + "ORDER BY" + ctx.concat(this._compileOrderBy(ctx, orderBy));

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit)
      out += space + this._compileOffsetLimit(ctx, offset, limit);

    return out;
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
xql$node.CombiningQuery = CombiningQuery;

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
 * @return {CombiningQuery}
 *
 * @alias xql.EXCEPT
 */
function EXCEPT(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombiningQuery("EXCEPT", values);
}
xql.EXCEPT = EXCEPT;

/**
 * Shorthand for `EXCEPT(...args).ALL()`.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 * @return {CombiningQuery}
 *
 * @see EXCEPT
 * @see CombiningQuery.prototype.ALL
 *
 * @alias xql.EXCEPT_ALL
 */
function EXCEPT_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombiningQuery("EXCEPT", values).ALL();
}
xql.EXCEPT_ALL = EXCEPT_ALL;

/**
 * Constructs an `INTERSECT` expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL queries that form the INTERSECT expression.
 * @return {CombiningQuery}
 *
 * @alias xql.INTERSECT
 */
function INTERSECT(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombiningQuery("INTERSECT", values);
}
xql.INTERSECT = INTERSECT;

/**
 * Shorthand for `INTERSECT(...args).ALL()`.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 * @return {CombiningQuery}
 *
 * @see INTERSECT
 * @see CombiningQuery.prototype.ALL
 *
 * @alias xql.INTERSECT_ALL
 */
function INTERSECT_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombiningQuery("INTERSECT", values).ALL();
}
xql.INTERSECT_ALL = INTERSECT_ALL;

/**
 * Constructs a `UNION` expression.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 *   Arguments must be SQL queries that form the UNION expression.
 * @return {CombiningQuery}
 *
 * @alias xql.UNION
 */
function UNION(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombiningQuery("UNION", values);
}
xql.UNION = UNION;

/**
 * Shorthand for `UNION(...args).ALL()`.
 *
 * @param {...*} args Arguments passed as an array or as `...args`.
 * @return {CombiningQuery}
 *
 * @see UNION
 * @see CombiningQuery.prototype.ALL
 *
 * @alias xql.UNION_ALL
 */
function UNION_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombiningQuery("UNION", values).ALL();
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
  //   `new Unary(op, x)`
  return {
    __proto__: Unary.prototype,
    _type    : op,
    _flags   : 0,
    _as      : "",
    _value   : child,
  };
}

// \internal
function BINARY_OP(a, op, b) {
  // High-performane version of:
  //   `new Operator(a, op, b)`
  return {
    __proto__: Operator.prototype,
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

// Add functions to `xql`.
functionsList.forEach(function(name) {
  var func = function(/* ... */) {
    return new Func(name, slice.call(arguments, 0));
  };
  xql[name] = func;
});

// Add aggregates to `xql`.
aggregatesList.forEach(function(name) {
  var func = function(/* ... */) {
    return new Aggregate(name, slice.call(arguments, 0));
  };
  xql[name] = func;
});

// Link camel-cased equivalents of all functions in `xql` namespace.
Object.keys(xql).forEach(function(name) {
  if (reUpperCase.test(name)) {
    xql[toCamelCase(name)] = xql[name];
  }
});

}).apply(this, typeof module === "object" ? [exports] : [this.xql = {}]);
