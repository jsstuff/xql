// QSql <https://github.com/jshq/qsql>
(function(qclass, qsql) {
"use strict";

// \namespace core
var core = qsql.core = {};

// \namespace util
var util = qsql.util = {};

// \internal
// \{

// Always returns false, used internally for browser support.
function returnFalse() {
  return false;
}

// Get whether an object is `Array`.
//
// Link to `Array.isArray`.
var isArray = Array.isArray;

// Get whether an object is `Buffer`.
//
// Returns false if a running environment doesn't support `Buffer` type.
var isBuffer = typeof Buffer === "function" ? Buffer.isBuffer : returnFalse;

// Link to `Array.prototype.slice`.
var slice = Array.prototype.slice;

// Link to `Object.prototype.hasOwnProperty`.
var hasOwnProperty = Object.prototype.hasOwnProperty;

// Checks if a string is a well formatted integer with optional '-' sign.
var reInt = /^-?\d+$/;

// Checks if a string is a well formatted integer or floating point number, also
// accepts scientific notation "E[+-]?xxx".
var reNumber = /^(NaN|-?Infinity|^-?((\d+\.?|\d*\.\d+)([eE][-+]?\d+)?))$/;

// Checks if a string is UPPERCASE_ONLY, underscores are accepted.
var reUpperCase = /^[A-Z_][A-Z_0-9]*$/;

// Empty object used as an replacement for value of object with no properties.
var EmptyObject = {};

// \}

// Map of identifiers that are not escaped.
var IdentifierMap = {
  "*"       : true
};

// Map of strings which can be implicitly casted to `TRUE` or `FALSE`.
var BoolMap = {
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

var TypeMap = {
  "bool"    : "boolean",
  "boolean" : "boolean",
  "smallint": "integer",
  "int"     : "integer",
  "integer" : "integer",
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
var OperatorFlags = {
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
var OperatorDefs = (function() {
  var kUnary        = OperatorFlags.kUnary;
  var kBinary       = OperatorFlags.kBinary;

  var kCond         = OperatorFlags.kCond;
  var kData         = OperatorFlags.kData;

  var kInPlaceNot   = OperatorFlags.kInPlaceNot;
  var kLeftValues   = OperatorFlags.kLeftValues;
  var kRightValues  = OperatorFlags.kRightValues;

  var kBoolean      = OperatorFlags.kBoolean;
  var kNumber       = OperatorFlags.kNumber;
  var kString       = OperatorFlags.kString;
  var kArray        = OperatorFlags.kArray;
  var kJson         = OperatorFlags.kJson;
  var kRange        = OperatorFlags.kRange;
  var kGeometry     = OperatorFlags.kGeometry;

  var kAnyType      = kBoolean  |
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
  add("@>"     , kBinary | kCond           | kArray | kRange                   ); // Contains
  add("<@"     , kBinary | kCond           | kArray | kRange                   ); // Contained By.
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
var NodeFlags = {
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
qsql.NodeFlags = NodeFlags;

// Sort directions.
var SortDirection = {
  ""            : 0,
  "0"           : 0,

  "1"           : NodeFlags.kAscending,
  "-1"          : NodeFlags.kDescending,

  "ASC"         : NodeFlags.kAscending,
  "DESC"        : NodeFlags.kDescending
};

// Sort nulls.
var SortNulls = {
  "NULLS FIRST" : NodeFlags.kNullsFirst,
  "NULLS LAST"  : NodeFlags.kNullsLast
};

// List of ordinary functions, which will become available in `qsql` namespace.
var functionsList = [
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

// List of aggregate functions, which will become available in `qsql` namespace.
var aggregatesList = [
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

// \class ValueError
//
// Error thrown if data is wrong.
function ValueError(message) {
  var e = Error.call(this, message);

  this.message = message;
  this.stack = e.stack || "";
}
qsql.ValueError = qclass({
  $extend: Error,
  $construct: ValueError
});

// \class CompileError
//
// Error thrown if query is wrong.
function CompileError(message) {
  var e = Error.call(this, message);

  this.message = message;
  this.stack = e.stack || "";
}
qsql.CompileError = qclass({
  $extend: Error,
  $construct: CompileError
});

// \function util.typeOf(value)
//
// Get type of `value` as a string. This function extends standard `typeof`
// operator with "array", "buffer", "null" and "undefined". The `typeOf` is
// actually used for debugging and error handling to make error messages more
// informative.
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
util.typeOf = typeOf;

// \internal
var toCamelCase = (function() {
  var re = /_[a-z]/g;

  function fn(s) {
    return s.charAt(1);
  }

  function toCamelCase(s) {
    return s.toLowerCase().replace(re, fn);
  }

  return toCamelCase;
})();

// \function escapeIdentifier(...)
//
// Escape SQL identifier.
var escapeIdentifier = (function() {
  var re = /[\.\x00]/g;

  function escapeIdentifier() {
    var s = "";

    for (var i = 0, len = arguments.length; i < len; i++) {
      var a = arguments[i];

      // Gaps are allowed.
      if (!a)
        continue;

      // Apply escaping to all parts of an identifier (if any).
      for (;;) {
        var m = a.search(re);
        var p = a;

        // Multiple arguments are joined by using ".".
        if (s)
          s += ".";

        if (m !== -1) {
          var c = a.charCodeAt(m);

          // '.' ~= 46.
          if (c === 46) {
            p = a.substr(0, m);
          }
          else { // (c === 0)
            throw new CompileError("Identifier can't contain NULL character.");
          }
        }

        if (hasOwnProperty.call(IdentifierMap, p))
          s += p;
        else
          s += '"' + p + '"';

        if (m === -1)
          break;

        a = a.substr(m + 1);
      }
    }

    return s;
  }

  return escapeIdentifier;
})();
qsql.escapeIdentifier = escapeIdentifier;

// \function escapeValue(value, explicitType?:String)
//
// Escape `value` so it can be inserted into SQL query.
//
// The `value` can be any JS type that can be implicitly or explicitly
// converted to SQL. The `explicitType` parameter can be used to force
// the type explicitly in case of ambiguity.
function escapeValue(value, explicitType) {
  // Explicitly defined type.
  if (explicitType)
    return escapeValueExplicit(value, explicitType);

  // Type is deduced from `value`.

  // Check - `string`, `number` and `boolean`.
  //
  // These types are expected in most cases so they are checked first. All
  // other types require more processing to escape them properly anyway.
  if (typeof value === "string")
    return escapeString(value);

  if (typeof value === "number")
    return escapeNumber(value);

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
    throw new ValueError("Unexpected implicit value type '" + (typeof value) + "'.");

  // Node.
  //
  // All QSql objects extend `Node`.
  if (value instanceof Node)
    return value.compileNode();

  // Check - Buffer (BLOB / BINARY).
  if (isBuffer(value))
    return escapeBuffer(value);

  // Check - Array (ARRAY).
  if (isArray(value))
    return escapeArray(value, false);

  return escapeString(JSON.stringify(value));
}
qsql.escapeValue = escapeValue;

// \function escapeValueExplicit(value, explicitType:String)
function escapeValueExplicit(value, explicitType) {
  if (value instanceof Node)
    return value.compileNode();

  var type = TypeMap[explicitType];

  if (!type)
    throw new ValueError("Unknown explicit type '" + explicitType + "'.");

  switch (type) {
    case "boolean":
      if (value == null)
        return "NULL";

      if (typeof value === "boolean")
        return value ? "TRUE" : "FALSE";

      if (typeof value === "string" && hasOwnProperty.call(BoolMap, value))
        return BoolMap[value];

      if (typeof value === "number") {
        if (value === 0)
          return "FALSE";

        if (value === 1)
          return "TRUE";

        throw new ValueError(
          "Couldn't convert 'number(" + value + ")' to 'boolean'.");
      }

      // Will throw.
      break;

    case "integer":
      if (value == null)
        return "NULL";

      if (typeof value === "number") {
        if (!isFinite(value) || Math.floor(value) !== value) {
          throw new ValueError(
            "Couldn't convert 'number(" + value + ")' to 'integer'.");
        }

        return value.toString();
      }

      if (typeof value === "string") {
        if (!reInt.test(value)) {
          throw new ValueError(
            "Couldn't convert ill formatted 'string' to 'integer'.");
        }

        return value;
      }

      // Will throw.
      break;

    case "number":
      if (value == null)
        return "NULL";

      if (typeof value === "number") {
        return escapeNumber(value);
      }

      if (typeof value === "string") {
        if (!reNumber.test(value)) {
          throw new ValueError(
            "Couldn't convert ill formatted 'string' to 'number'.");
        }

        return value;
      }

      // Will throw
      break;

    case "string":
      if (value == null)
        return "NULL";

      if (typeof value === "string")
        return escapeString(value);

      if (typeof value === "number" || typeof value === "boolean")
        return escapeString(value.toString());

      if (typeof value === "object")
        return escapeString(JSON.stringify(value));

      // Will throw.
      break;

    case "array":
      if (value == null)
        return "NULL";

      if (Array.isArray(value))
        return escapeArray(value, false);

      // Will throw.
      break;

    case "values":
      if (value == null)
        return "NULL";

      if (Array.isArray(value))
        return escapeValues(value, false);

      // Will throw.
      break;

    case "json":
      // `undefined` maps to native DB `NULL` type while `null` maps to
      // JSON `null` type. This is the only way to distinguish between
      // these. `undefined` is disallowed by JSON anyway.
      if (value === undefined)
        return "NULL";

      return escapeJson(value);

    case "raw":
      return value;
  }

  throw new ValueError(
    "Couldn't convert '" + typeOf(value) + "' to '" + explicitType + "'.");
}
qsql.escapeValueExplicit = escapeValueExplicit;

// \function escapeString(value)
//
// Escape a given `value` of type string so it can be used in SQL query.
var escapeString = (function() {
  var re =  /[\0\b\f\n\r\t\\\']/g;
  var map = {
    "\0": "\\x00",// Null character.
    "\b": "\\b",  // Backspace.
    "\f": "\\f",  // Form Feed.
    "\n": "\\n",  // New Line.
    "\r": "\\r",  // Carriage Return.
    "\t": "\\t",  // Tag.
    "\\": "\\\\", // Backslash.
    "\'": "\\\'"  // Single Quote.
  };

  function fn(s) {
    if (s.charCodeAt(0) === 0)
      throw new CompileError("String can't contain NULL character.");
    return map[s];
  }

  function escapeString(value) {
    var oldLength = value.length;
    value = value.replace(re, fn);

    // We have to tell Postgres explicitly that the string is escaped by
    // a C-style escaping sequence(s).
    if (value.length !== oldLength)
      return "E'" + value + "'";

    // String doesn't contain any character that has to be escaped. We can
    // use simply '...'.
    return "'" + value + "'";
  }

  return escapeString;
})();
qsql.escapeString = escapeString;

// \function escapeNumber(value)
function escapeNumber(value) {
  if (!isFinite(value)) {
    if (value === Infinity)
      return "'Infinity'";
    if (value === -Infinity)
      return "'-Infinity'";

    return "'NaN'";
  }

  return value.toString();
}
qsql.escapeNumber = escapeNumber;

// \function escapeBuffer(value)
function escapeBuffer(value) {
  return "E'\\x" + value.toString("hex") + "'";
}
qsql.escapeBuffer = escapeBuffer;

// \function escapeValues(value)
function escapeValues(value) {
  var s = "";

  for (var i = 0, len = value.length; i < len; i++) {
    var element = value[i];

    if (s)
      s += ", ";

    if (isArray(element))
      s += escapeArray(element, false);
    else
      s += escapeValue(element);
  }

  return "(" + s + ")";
}
qsql.escapeValues = escapeValues;

// \function escapeArray(value, isNested)
function escapeArray(value, isNested) {
  var s = "";
  var i = 0, len = value.length;

  if (len === 0)
    return "'{}'";

  do {
    var element = value[i];

    if (s)
      s += ", ";

    if (isArray(element))
      s += escapeArray(element, true);
    else
      s += escapeValue(element);
  } while (++i < len);

  if (isNested)
    return "[" + s + "]";
  else
    return "ARRAY[" + s + "]";
}
qsql.escapeArray = escapeArray;

// \function escapeJson(value)
function escapeJson(value) {
  return escapeString(JSON.stringify(value));
}
qsql.escapeJson = escapeJson;

// \function substitute(query, bindings)
//
// Substitutes `?` sequences or Postgres specific `$N` sequences in the `query`
// string with `bindings` and returns a new string. The function automatically
// detects the format of `query` string and checks if it's consistent (i.e. it
// throws if `?` is used together with `$1`).
//
// This function knows how to recognize escaped identifiers and strings in the
// query and skips content of these. For example for a given string `'?' ?` only
// the second `?` is considered and substituted.
//
// NOTE: Although the function understands SQL syntax, the function expects
// well formed SQL query. The purpose is to replace query parameters and not
// to perform expensive validation (that will be done by the server anyway).
var substitute = (function() {
  var reEscapeChars = /[\"\$\'\?]/g;

  function substitute(query, bindings) {
    var input = "";
    var output = "";

    if (typeof query === "string")
      input = query;
    else if (query instanceof Node)
      input = query.compileNode();
    else
      input = query.toString();

    // These are hints for javascript runtime. We really want this rountine
    // as fast as possible. The `|0` hint tells VM to use integer instead of
    // double precision floating point.
    var i = input.search(reEscapeChars)|0;
    if (i === -1)
      return input;

    var len = input.length|0;
    var iStart = 0|0;

    // Substitution mode:
    //   0  - Not set.
    //   36 - `$`.
    //   63 - `?`.
    var mode = 0|0;

    // Bindings index, incremented if query contains `?` or parsed if `$`.
    var bIndex = 0|0;
    // Count of bindings available.
    var bLength = bindings.length|0;

    while (i < len) {
      var c = input.charCodeAt(i)|0;
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

            c = input.charCodeAt(i)|0;
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
            c = input.charCodeAt(i)|0;
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

              c = input.charCodeAt(i)|0;
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

              c = input.charCodeAt(i)|0;
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
              c = input.charCodeAt(i)|0;
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
              throw new CompileError("Substitute() - Mixed substitution marks, " +
                "initial '" + String.fromCharCode(mode) + "'" +
                "is followed by '" + String.fromCharCode(c) + "'.");
            }
            mode = c;
          }

          // Flush accumulated input.
          output += input.substring(iStart, i - 1);

          bIndex = 0|0;
          iStart = i;

          // Parse the number `[0-9]+` directly to `bIndex`.
          while (i < len) {
            c = input.charCodeAt(i)|0;
            // `0` === 48
            // `9` === 57
            if (c < 48 || c > 57)
              break;

            bIndex = (bIndex * 10 + (c - 48)) | 0;
            if (bIndex > bLength)
              throw new CompileError("Substitute() - Index '" + bIndex + "' of range (" + bLength + ").");
            i++;
          }

          if (bIndex === 0)
            throw new CompileError("Substitute() - Index can't be zero.");
          bIndex--;

          if (iStart === i)
            throw new CompileError("Substitute() - Missing number after '$' mark.");

          // Substitute.
          output += escapeValue(bindings[bIndex]);
          iStart = i;
        }
      }
      // Check if the character is question mark (63).
      else if (c === 63) {
        // Basically a duplicate from `$`.
        if (mode !== c) {
          if (mode !== 0) {
            throw new CompileError("Substitute() - Mixed substitution marks, " +
              "initial '" + String.fromCharCode(mode) + "'" +
              "is followed by '" + String.fromCharCode(c) + "'.");
          }
          mode = c;
        }

        if (bIndex >= bLength)
          throw new CompileError("Substitute() - Index '" + bIndex + "' out of range (" + bLength + ").");

        // Flush accumulated input.
        output += input.substring(iStart, i - 1);

        // Substitute.
        output += escapeValue(bindings[bIndex]);

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

  return substitute;
})();
qsql.substitute = substitute;

// \class core.Node
//
// Base class for all `Node`s related to query building.
//
// `Node` doesn't have any functionality and basically only initializes `_type`,
// `_flags` and `_as` members. Classes that inherit `Node` can omit calling
// `Node`s constructor for performance reasons, but if you do so, please
// always initialize members in the correct order [_type, _flags, _as].
function Node(type, as) {
  this._type = type || "";
  this._flags = 0|0;

  this._as = as || "";
}
core.Node = qclass({
  $construct: Node,

  // \function Node.shouldWrap()
  //
  // Get whether the not should be wrapped in parentheses.
  shouldWrap: function(ctx) {
    throw new CompileError("Node(" + this._type + ").shouldWrap() - Must be reimplemented.");
  },

  // \function Query.compileQuery()
  //
  // Compile the whole by using `compileNode()` and add a semicolon ';' at the
  // end.
  //
  // \note This function is `null` by default and only added by nodes which can
  // be executed. Use `Node.canExecute()` method to check whether the node can
  // actually be executed, i.e. compiles into an executable SQL.
  compileQuery: null,

  // \function Node.compileNode()
  //
  // Compile the node.
  compileNode: function(ctx) {
    throw new CompileError("Node(" + this._type + ").compileNode() - Must be reimplemented.");
  },

  // \function Node.canExecute()
  //
  // Get whether the compiled node can be executed, i.e. the node implements
  // `compileQuery()`, which returns the query combined with a semicolon ";".
  //
  // \note There is not a base class for nodes which can execute, this getter
  // uses reflection; it dynamically checks for presence of `compileQuery` and
  // returns `true` if found.
  canExecute: function() {
    return typeof this.compileQuery === "function";
  },

  getType: function() {
    return this._type;
  },

  setType: function(type) {
    this._type = type;
    return this;
  },

  getFlag: function(flag) {
    return (this._flags & flag) !== 0;
  },

  setFlag: function(flag, value) {
    var flags = this._flags;

    if (value || value === undefined)
      flags |= flag;
    else
      flags &= ~flag;

    this._flags = flags;
    return this;
  },

  getLabel: function() {
    return this._as;
  },

  setLabel: function(as) {
    this._as = as;
    return this;
  },

  // \function Node.AS(as:String)
  AS: function(as) {
    this._as = as;
    return this;
  },

  // \function Node.EQ(b:{Var|Node})
  EQ: function(b) {
    return new Operator(this, "=", b);
  },

  // \function Node.NE(b:{Var|Node})
  NE: function(b) {
    return new Operator(this, "<>", b);
  },

  // \function Node.LT(b:{Var|Node})
  LT: function(b) {
    return new Operator(this, "<", b);
  },

  // \function Node.LE(b:{Var|Node})
  LE: function(b) {
    return new Operator(this, "<=", b);
  },

  // \function Node.GT(b:{Var|Node})
  GT: function(b) {
    return new Operator(this, ">", b);
  },

  // \function Node.GE(b:{Var|Node})
  GE: function(b) {
    return new Operator(this, ">=", b);
  },

  // \function Node.IN(b:{Var|Node})
  //
  // Returns a new Node which contains `this IN b` expression.
  IN: function(b) {
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

    return new Operator(this, "IN", b);
  }
});

// \internal
//
// Implementation of `Node.compileQuery()`.
function Node$compileQuery(ctx) {
  return this.compileNode(ctx) + ";";
}

// \class core.Raw
//
// Wraps RAW query.
function Raw(expression, bindings) {
  // Doesn't call `Node` constructor.
  this._type = "RAW";
  this._flags = 0|0;

  this._as = "";
  this._value = expression || "";
  this._bindings = bindings || null;
}
core.Raw = qclass({
  $extend: Node,
  $construct: Raw,

  shouldWrap: function(ctx) {
    return false;
  },

  compileQuery: Node$compileQuery,

  compileNode: function(ctx) {
    var s = this._value;

    var bindings = this._bindings;
    if (bindings && bindings.length)
      s = substitute(s, bindings);

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  },

  getExpression: function() {
    return this._value;
  },

  setExpression: function(expression) {
    this._value = expression;
    return this;
  },

  getBindings: function() {
    return this._bindings;
  },

  setBindings: function(bindings) {
    this._bindings = bindings || null;
    return this;
  }
});

// \class core.Unary
function Unary(type, value) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._flags = 0|0;

  this._as = "";
  this._value = value;
}
core.Unary = qclass({
  $extend: Node,
  $construct: Unary,

  shouldWrap: function(ctx) {
    return false;
  },

  compileNode: function(ctx) {
    var type = this._type;
    var s = escapeValue(this._value);

    switch (type) {
      case "NOT":
        s = "NOT " + s;
        break;

      case "-":
        s = "-" + s;
        break;

      default:
        if (type)
          s = type + " " + s;
        break;
    }

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  },

  getValue: function() {
    return this._value;
  },

  setValue: function(value) {
    this._value = value;
    return this;
  }
});

// \class core.Binary
function Binary(left, type, right, as) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._flags = 0|0;

  this._as = as || "";
  this._left = left;
  this._right = right;
}
core.Binary = qclass({
  $extend: Node,
  $construct: Binary,

  getLeft: function() {
    return this._left;
  },

  setLeft: function(value) {
    this._left = value;
    return this;
  },

  addLeft: function(value) {
    var left = this._left;

    if (!isArray(left))
      throw new CompileError("Binary.addLeft() - Left operand is not an Array.");

    left.push(value);
    return this;
  },

  getRight: function() {
    return this._right;
  },

  setRight: function(right) {
    this._right = right;
    return this;
  },

  addRight: function(value) {
    var right = this._right;

    if (!isArray(right))
      throw new CompileError("Binary.addRight() - Left operand is not an Array.");

    right.push(value);
    return this;
  }
});

// \class core.Operator
function Operator(left, type, right, as) {
  // Doesn't call `Binary` constructor.
  this._type = type || "";
  this._flags = 0|0;

  this._as = as || "";
  this._left = left;
  this._right = right;
}
core.Operator = qclass({
  $extend: Binary,
  $construct: Operator,

  shouldWrap: function(ctx) {
    return false;
  },

  compileNode: function(ctx) {
    var type = this._type;
    var s = "";

    var keyword = "";

    var leftNode = this._left;
    var rightNode = this._right;

    var left = "";
    var right = "";

    if (!type)
      throw new CompileError("Operator.compileNode() - No operator specified.");

    if (hasOwnProperty.call(OperatorDefs, type)) {
      var op = OperatorDefs[type];
      var flags = op.flags;

      if (flags & OperatorFlags.kLeftValues) {
        left = escapeValues(leftNode);
      }

      if (flags & OperatorFlags.kRightValues) {
        right = escapeValues(rightNode);
      }

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
      left = escapeValue(leftNode);
    if (leftNode instanceof Binary)
      left = "(" + left + ")";

    if (!right)
      right = escapeValue(rightNode);
    if (rightNode instanceof Binary)
      right = "(" + right + ")";

    s = left + keyword + right;

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  }
});

// \class core.Group
function Group(type, values) {
  // Doesn't call `Node` constructor.
  this._type = type;
  this._flags = 0|0;

  this._as = "";
  this._values = values || [];
}
core.Group = qclass({
  $extend: Node,
  $construct: Group,

  push: function() {
    var values = this._values;
    values.push.apply(values, arguments);
    return this;
  },

  concat: function(array) {
    var values = this._values;
    for (var i = 0, len = array.length; i < len; i++)
      values.push(array[i]);
    return this;
  }
});

// \class core.Logical
function Logical() {
  Group.apply(this, arguments);
}
core.Logical = qclass({
  $extend: Group,
  $construct: Logical,

  shouldWrap: function(ctx) {
    return this._values.length > 1;
  },

  compileNode: function(ctx) {
    var type = this._type;
    var s = "";

    var values = this._values;
    var separator = " " + type + " ";

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = escapeValue(value);

      if (s)
        s += separator;

      if (value.shouldWrap(ctx))
        s += "(" + escaped + ")";
      else
        s += escaped;
    }

    return s;
  }
});

// \class core.ObjectOp
//
// Condition defined as an object having multiple properties (key/value pairs).
// Implicit `AND` operator is used to for the query.
function ObjectOp(type, value) {
  // Doesn't call `Unary` constructor.
  this._type = type;
  this._flags = 0|0;

  // `_as` is never used.
  this._as = "";
  this._value = value;
}
core.ObjectOp = qclass({
  $extend: Unary,
  $construct: ObjectOp,

  shouldWrap: function(ctx) {
    return false;
  },

  compileNode: function(ctx) {
    var s = "";

    var separator = " " + this._type + " ";
    var columns = this._value;

    for (var k in columns) {
      var value = columns[k];
      var compiled = escapeValue(value);

      if (s)
        s += separator;
      s += escapeIdentifier(k);

      if (compiled === "NULL")
        s += " IS ";
      else
        s += " = ";

      if (value instanceof Node && value.shouldWrap())
        s += "(" + compiled + ")";
      else
        s += compiled;
    }

    return s;
  }
});

function Identifier(value, as) {
  // Doesn't call `Node` constructor.
  this._type = "IDENTIFIER";
  this._flags = 0|0;

  this._as = as || "";
  this._value = value;
}
core.Identifier = qclass({
  $extend: Node,
  $construct: Identifier,

  shouldWrap: function() {
    return false;
  },

  compileNode: function(ctx) {
    var s = escapeIdentifier(this._value);
    var as = this._as;

    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  },

  getValue: function() {
    return this._value;
  },

  setValue: function(value) {
    this._value = value;
    return this;
  }
});

// \class core.Join
function Join(left, type, right, condition) {
  // Doesn't call `Binary` constructor.
  this._type = type || "";
  this._flags = 0|0;

  this._as = "";
  this._left = left;
  this._right = right;
  this._condition = condition;
}
core.Join = qclass({
  $extend: Binary,
  $construct: Join,

  shouldWrap: function(ctx) {
    return false;
  },

  compileNode: function(ctx) {
    var type = this._type;
    var s = "";

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

    var left = "";
    var right = "";

    if (typeof this._left === "string")
      left = escapeIdentifier(this._left);
    else
      left = this._left.compileNode();

    if (typeof this._right === "string")
      right = escapeIdentifier(this._right);
    else
      right = this._right.compileNode();

    s = left + keyword + right;

    var condition = this._condition;

    // Compile `USING (...)` clause.
    if (isArray(condition)) {
      var t = "";

      for (var i = 0, len = condition.length; i < len; i++) {
        var identifier = condition[i];

        if (t)
          t += ", ";

        if (typeof identifier === "string")
          t += escapeIdentifier(identifier);
        else
          t += identifier.compileNode();
      }

      if (t)
        s += " USING (" + t + ")";
    }
    // Compile `ON ...` clause.
    else if (condition instanceof Node) {
      s += " ON " + condition.compileNode();
    }

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  },

  getCondition: function() {
    return this._condition;
  },

  setCondition: function(condition) {
    this._condition = condition;
    return this;
  }
});

// \class core.Sort
//
// Sort expression that comes after `ORDER BY`.
function Sort(column, direction, nulls) {
  var flags = 0|0;

  if (direction && hasOwnProperty.call(SortDirection, direction))
    flags |= SortDirection[direction];

  if (nulls && hasOwnProperty.call(SortNulls, nulls))
    flags |= SortNulls[nulls];

  // Doesn't call `Identifier` constructor.
  this._type = "SORT";
  this._flags = flags;

  this._as = ""; // Sort expression never uses `AS`.
  this._value = column;
}
core.Sort = qclass({
  $extend: Identifier,
  $construct: Sort,

  compileNode: function(ctx) {
    var value = this._value;
    var flags = this._flags;

    // Value of type:
    //   - `number` - describes column order,
    //   - `string` - describes column name.
    //   - `Node`   - SQL expression/column.
    var s = typeof value === "number"
      ? "" + value
      : escapeIdentifier(this._value);

    if (flags & NodeFlags.kAscending)
      s += " ASC";
    else if (flags & NodeFlags.kDescending)
      s += " DESC";

    if (flags & NodeFlags.kNullsFirst)
      s += " NULLS FIRST";
    else if (flags & NodeFlags.kNullsLast)
      s += " NULLS LAST";

    return s;
  },

  getDirection: function() {
    var flags = this._flags;
    if (flags & NodeFlags.kDescending)
      return "DESC";
    else if (flags & NodeFlags.kAscending)
      return "ASC";
    else
      return "";
  },

  setDirection: function(direction) {
    var flags = this._flags & ~(NodeFlags.kAscending | NodeFlags.kDescending);
    if (hasOwnProperty.call(SortDirection, direction))
      this._flags = flags | SortDirection[direction];
    else
      throw new CompileError("Sort.setDirection() - Invalid argument '" + direction + "'.");
    return this;
  },

  hasAscending: function() {
    return (this._flags & NodeFlags.kAscending) !== 0;
  },

  hasDescending: function() {
    return (this._flags & NodeFlags.kDescending) !== 0;
  },

  getNullsOrder: function() {
    var flags = this._flags;
    if (flags & NodeFlags.kNullsFirst)
      return "NULLS FIRST";
    else if (flags & NodeFlags.kNullsLast)
      return "NULLS LAST";
    else
      return "";
  },

  setNullsOrder: function(nulls) {
    var flags = this._flags & ~(NodeFlags.kNullsFirst | NodeFlags.kNullsLast);
    if (hasOwnProperty.call(SortNulls, nulls))
      this._flags = flags | SortNulls[nulls];
    else
      throw new CompileError("Sort.setDirection() - Invalid argument '" + nulls + "'.");
    return this;
  },

  hasNullsFirst: function() {
    return (this._flags & NodeFlags.kNullsFirst) !== 0;
  },

  hasNullsLast: function() {
    return (this._flags & NodeFlags.kNullsLast) !== 0;
  },

  // \function Sort.ASC()
  //
  // Set sorting mode to ascending (`ASC`).
  ASC: function() {
    this._flags = this._flags & ~NodeFlags.kDescending
                              |  NodeFlags.kAscending;
    return this;
  },

  // \function Sort.DESC()
  //
  // Set sorting mode to descending (`DESC`).
  DESC: function() {
    this._flags = this._flags & ~NodeFlags.kAscending
                              |  NodeFlags.kDescending;
    return this;
  },

  // \function Sort.NULLS_FIRST()
  //
  // Set sorting nulls first (`NULLS FIRST`).
  NULLS_FIRST: function() {
    this._flags = this._flags & ~NodeFlags.kNullsLast
                              |  NodeFlags.kNullsFirst;
    return this;
  },

  // \function Sort.NULLS_LAST()
  //
  // Set sorting nulls last (`NULLS LAST`).
  NULLS_LAST: function() {
    this._flags = this._flags & ~NodeFlags.kNullsFirst
                              |  NodeFlags.kNullsLast;
    return this;
  }
});

// \class core.Func
function Func(type, values) {
  // Doesn't call `Group` constructor.
  this._type = type || "";
  this._flags = 0|0;

  this._as = "";
  this._values = values || [];
}
core.Func = qclass({
  $extend: Group,
  $construct: Func,

  shouldWrap: function() {
    return false;
  },

  compileNode: function(ctx) {
    var s = "";

    var flags = this._flags;
    var values = this._values;

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = escapeValue(value);

      if (s)
        s += ", ";
      s += escaped;
    }

    // Add `ALL` or `DISTINCT` (support for aggregate functions).
    if (flags & NodeFlags.kAllOrDistinct) {
      var keyword = flags & NodeFlags.kAll ? "ALL" : "DISTINCT";
      if (!s)
        s = keyword;
      else
        s = keyword + " " + s;
    }

    s = this._type + "(" + s + ")";

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  },

  getArguments: function() {
    return this._values;
  },

  setArguments: function(args) {
    this._values = args || [];
    return this;
  }
});

// \class core.Aggregate
function Aggregate() {
  Func.apply(this, arguments);
}
core.Aggregate = qclass({
  $extend: Func,
  $construct: Aggregate,

  ALL: function(value) {
    return this.setFlag(NodeFlags.kAll, value);
  },

  DISTINCT: function(value) {
    return this.setFlag(NodeFlags.kDistinct, value);
  }
});

// \class core.Value
//
// Wrapper class that contains `data` and `type`.
//
// Used in cases where it's difficult to automatically determine how the value
// should be escaped (which can result in invalid query if determined wrong).
//
// `Value` shouldn't be in general used for all types, only types where the
// mapping is ambiguous and can't be automatically deduced. For example
// PostgreSQL uses different syntax for `JSON` and `ARRAY`. In such case QSql
// has no knowledge which format to use and will choose ARRAY over JSON.
//
// Value is an alternative to schema. If schema is provided it's unnecessary
// to wrap values to `Value`.
function Value(type, value) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._flags = 0|0;

  this._as = "";
  this._value = value;
}
core.Value = qclass({
  $extend: Node,
  $construct: Value,

  shouldWrap: function() {
    return false;
  },

  compileNode: function(ctx) {
    return escapeValue(this._value, this._type);
  },

  getValue: function() {
    return this._value;
  },

  setValue: function(value) {
    this._value = value;
    return this;
  }
});

// \class core.ArrayValue
//
// Wraps ARRAY data.
function ArrayValue(value) {
  // Doesn't call `Value` constructor.
  this._type = "ARRAY";
  this._flags = 0|0;

  this._as = "";
  this._value = value;
}
core.ArrayValue = qclass({
  $extend: Value,
  $construct: ArrayValue,

  shouldWrap: function() {
    return false;
  },

  compileNode: function(ctx) {
    return escapeArray(this._value, false);
  }
});

// \class core.JsonValue
//
// Wraps JSON data.
function JsonValue(value) {
  // Doesn't call `Value` constructor.
  this._type = "JSON";
  this._flags = 0|0;

  this._as = "";
  this._value = value;
}
core.JsonValue = qclass({
  $extend: Value,
  $construct: JsonValue,

  shouldWrap: function() {
    return false;
  },

  compileNode: function(ctx) {
    return escapeJson(this._value);
  }
});

// \class core.Query
//
// Query implements a generic interface used by:
//
//   - `SELECT` - See `SelectQuery`.
//   - `INSERT` - See `InsertQuery`.
//   - `UPDATE` - See `UpdateQuery`.
//   - `DELETE` - See `DeleteQuery`.
//   - `EXCEPT`, `INTERSECT`, `UNION` - See `CombinedQuery`.
//
// The following features are implemented by `Query` itself:
//
//   - `TABLE`- Specifies a single table name, used by `INSERT`, `UPDATE`
//      and `DELETE`.
//
//   - `SELECT/RETURNING`- Specifies select expression or returning expression,
//      used by `SELECT` (as `SELECT` expression) and also by `INSERT`, `UPDATE`
//      and `DELETE` (as `RETURNING` expression).
//
//   - `WHERE` - Specifies `WHERE` clause, used by `SELECT`, `UPDATE` and `DELETE`.
function Query(type) {
  // Doesn't call `Node` constructor.
  this._type = type;
  this._flags = 0|0;

  this._as = "";

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
  //   - `EXCEPT`, `INTERSECT`, `UNION` - See `CombinedQuery`.
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
  // It can be escaped by using Postgres `ARRAY[] or {}` or as JSON `[]`.
  this._typeMapping = null;
}
core.Query = qclass({
  $extend: Node,
  $construct: Query,

  shouldWrap: function() {
    return true;
  },

  getTypeMapping: function() {
    return this._typeMapping;
  },

  setTypeMapping: function(typeMapping) {
    this._typeMapping = typeMapping;
    return this;
  },

  _addFieldsOrReturning: function(defs) {
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

    // Handle single parameter of type `Object` or `Array`.
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
  },

  _compileFieldsOrReturning: function(ctx, prefix, list) {
    var s = "";

    for (var i = 0, len = list.length; i < len; i++) {
      var column = list[i];

      if (s)
        s += ", ";

      // Returning column can be in a form of `string` or `Node`.
      if (typeof column === "string") {
        s += escapeIdentifier(column);
      }
      else {
        var compiled = column.compileNode(ctx);
        if (column.shouldWrap())
          s += "(" + compiled + ")";
        else
          s += compiled;
      }
    }

    return prefix + s;
  },

  // \function Query._setFromOrIntoTable(...)
  _setFromOrIntoTable: function(table) {
    if (this._table)
      throw new CompileError("INTO() - table already specified ('" + table + "').");

    this._table = table;
    return this;
  },

  // \function Query._addFromOrUsing(...)
  _addFromOrUsing: function(arg) {
    var args = null;
    var len = 0;

    if (isArray(arg)) {
      args = arg;
      len = args.length;
    }
    else {
      args = arguments;
      len = args.length;
    }

    if (len < 1)
      return this;

    var left = this._fromOrUsing;
    if (left !== null)
      this._fromOrUsing = new Join(left, "", arg);
    else
      this._fromOrUsing = arg;

    if (len <= 1)
      return this;

    // Implicit `CROSS JOIN` syntax.
    var i = 1;
    do {
      arg = args[i];
      this._fromOrUsing = new Join(left, "", arg);
    } while (++i < len);

    return this;
  },

  // \function Query._join(type, with_, condition)
  _join: function(type, with_, condition) {
    var left = this._fromOrUsing;

    // Well this shouldn't be `null`.
    if (left === null)
      throw new CompileError("Query._join() - There is no table in query to join with.");

    this._fromOrUsing = new Join(left, type, with_, condition);
    return this;
  },

  _compileFromOrUsing: function(ctx, prefix, node) {
    var s = "";

    if (typeof node === "string")
      s += escapeIdentifier(node);
    else
      s += node.compileNode(ctx);

    return prefix + s;
  },

  // Add `WHERE` condition of specified `type`.
  _addWhere: function(type, a, op, b, nArgs) {
    var node;
    var where = this._where;
    var aIsArray = false;

    // Accept 1, 2 or 3 arguments.
    if (nArgs >= 2) {
      if (typeof a === "string")
        a = COL(a);
      if (nArgs === 2)
        node = new Operator(a, "=", op);
      else
        node = new Operator(a, op, b);
    }
    else if (nArgs !== 1) {
      throw new CompileError("Query." + (type === "OR" ? "OR_" : "") + "WHERE() - Invalid argument.");
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
    else if (where.type !== type) {
      where = new Logical(type);
      where.push(this._where);
      this._where = where;
    }

    if (aIsArray)
      where.concat(a);
    else
      where.push(node);

    return this;
  },

  _compileWhereOrHaving: function(ctx, prefix, condition) {
    var s = "";

    var list = condition._values;
    var i, len = list.length;

    if (len === 0)
      return s;

    if (len === 1)
      return prefix + list[0].compileNode(ctx);

    for (i = 0; i < len; i++) {
      var expression = list[i];
      var compiled = expression.compileNode(ctx);

      if (s)
        s += " " + condition._type + " ";

      if (expression.shouldWrap())
        s += "(" + compiled + ")";
      else
        s += compiled;
    }

    return prefix + s;
  },

  _compileOffsetLimit: function(ctx, offset, limit) {
    var s = "";

    if (offset) {
      s += "OFFSET " + offset;
    }

    if (limit) {
      if (s)
        s += " ";
      s += "LIMIT " + limit;
    }

    return s;
  },

  // \function Query.VALUES(data)
  VALUES: function(data) {
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
  },

  // \function Query.WHERE(...)
  //
  // Add `WHERE` expression to the query.
  //
  // This function has multiple overloads:
  //
  // 1. `where(node:Node)`
  //   Node that contains an expression.
  //
  // 2. `where(keys:Object)`
  //   Object that contain key/value pairs that will be checked for equality,
  //   implicit `AND` will be added to the query between all keys specified.
  //   Objects without keys are ignored.
  //
  // 3. `where(a:String, op:String, b:Variant)`
  //   Adds one `WHERE` clause in the form `a op b`.
  WHERE: function(a, op, b) {
    return this._addWhere("AND", a, op, b, arguments.length);
  },

  // \function Query.OR_WHERE(...)
  //
  // Add top-level `OR` to the query.
  //
  // This function accepts the same arguments and behaves identically as `WHERE`.
  OR_WHERE: function(a, op, b) {
    return this._addWhere("OR", a, op, b, arguments.length);
  },

  // \function Query.ORDER_BY(...)
  ORDER_BY: function(column, direction, nulls) {
    var orderBy = this._orderBy;

    if (orderBy === null)
      orderBy = this._orderBy = [];

    if (isArray(column))
      orderBy.push.apply(orderBy, column);
    else
      orderBy.push(new Sort(column, direction, nulls));

    return this;
  },

  // \function Query.OFFSET(offset)
  OFFSET: function(offset) {
    this._offset = offset;
    return this;
  },

  // \function Query.LIMIT(limit)
  LIMIT: function(limit) {
    this._limit = limit;
    return this;
  }
});

// \class core.SelectQuery
function SelectQuery() {
  Query.call(this, "SELECT");

  // `GROUP BY` clause.
  this._groupBy = null;

  // `HAVING` clause.
  this._having = null;
}
core.SelectQuery = qclass({
  $extend: Query,
  $construct: SelectQuery,

  compileQuery: Node$compileQuery,

  compileNode: function(ctx) {
    var s = "SELECT";
    var flags = this._flags;

    // Compile `SELECT [ALL|DISTINCT]`
    //
    // Use `*` if  fields are not used.
    if (flags & NodeFlags.kAllOrDistinct) {
      if (flags & NodeFlags.kAll)
        s += " ALL";
      else
        s += " DISTINCT";
    }

    // Compile `[*|fields]`
    //
    // Note, `*` is only used if there are no columns specified.
    var columns = this._fieldsOrReturning;
    if (columns && columns.length)
      s += this._compileFieldsOrReturning(ctx, " ", columns);
    else
      s += " *";

    // Compile `FROM table[, table[, ...]]` or `FROM table JOIN table [, JOIN ...]`.
    var from = this._fromOrUsing;
    if (from) {
      s += this._compileFromOrUsing(ctx, " FROM ", from);
    }

    // Compile `WHERE ...`.
    var where = this._where;
    if (where && where._values.length) {
      s += this._compileWhereOrHaving(ctx, " WHERE ", where);
    }

    // Compile `GROUP BY ...`.
    var groupBy = this._groupBy;
    if (groupBy && groupBy.length) {
      s += this._compileGroupBy(ctx, " GROUP BY ", groupBy);
    }

    // Compile `HAVING ...`.
    var having = this._having;
    if (having && having._values.length) {
      s += this._compileWhereOrHaving(ctx, " HAVING ", having);
    }

    // TODO: Compile `WINDOW ...`.

    // Compile `ORDER BY ...`.
    var orderBy = this._orderBy;
    if (orderBy && orderBy.length) {
      s += this._compileOrderBy(ctx, " ORDER BY ", orderBy);
    }

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit) {
      s += " " + this._compileOffsetLimit(ctx, offset, limit);
    }

    // TODO: Compile `FETCH ...`.
    // TODO: Compile `FOR ...`.

    return s;
  },

  _compileGroupBy: function(ctx, prefix, groupBy) {
    var s = "";

    for (var i = 0, len = groupBy.length; i < len; i++) {
      var group = groupBy[i];

      if (s)
        s += ", ";

      // Group can be in a form of `string` or `Node`.
      if (typeof group === "string")
        s += escapeIdentifier(group);
      else
        s += group.compileNode(ctx);
    }

    return prefix + s;
  },

  _compileOrderBy: function(ctx, prefix, orderBy) {
    var s = "";

    for (var i = 0, len = orderBy.length; i < len; i++) {
      var order = orderBy[i];
      if (s)
        s += ", ";
      s += order.compileNode();
    }

    return prefix + s;
  },

  // Add `HAVING` condition of specified `type`.
  _addHaving: function(type, a, op, b, nArgs) {
    var node;
    var having = this._having;
    var aIsArray = false;

    // Accept 1, 2 or 3 arguments.
    if (nArgs >= 2) {
      if (typeof a === "string")
        a = COL(a);
      if (nArgs === 2)
        node = new Operator(a, "=", op);
      else
        node = new Operator(a, op, b);
    }
    else if (nArgs !== 1) {
      throw new CompileError((type === "OR" ? "OR_" : "") + "HAVING - Invalid argument.");
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
    else if (having.type !== type) {
      having = new Logical(type);
      having.push(this._having);
      this._having = having;
    }

    if (aIsArray)
      having.concat(a);
    else
      having.push(node);

    return this;
  },

  // \function SelectQuery.DISTINCT(...)
  //
  // Adds `DISTINCT` clause to the query. It accepts the same arguments as
  // `SELECT()` so it can be used in a similar way. The following expressions
  // are equivalent:
  //
  //   - `SELECT(["a", "b", "c"]).DISTINCT()`
  //   - `SELECT().DISTINCT(["a", "b", "c"])`
  //   - `SELECT().DISTINCT().FIELD(["a", "b", "c"])`
  DISTINCT: function(/* ... */) {
    this._flags |= NodeFlags.kDistinct;
    if (arguments.length)
      this.FIELD.apply(this, arguments);
    return this;
  },

  // \function SelectQuery.FROM(...)
  FROM: Query.prototype._addFromOrUsing,

  // \function SelectQuery.CROSS_JOIN(...)
  CROSS_JOIN: function(with_, condition) {
    return this._join("CROSS", with_, condition);
  },

  // \function SelectQuery.INNER_JOIN(...)
  INNER_JOIN: function(with_, condition) {
    return this._join("INNER", with_, condition);
  },

  // \function SelectQuery.LEFT_JOIN(...)
  LEFT_JOIN: function(with_, condition) {
    return this._join("LEFT", with_, condition);
  },

  // \function SelectQuery.RIGHT_JOIN(...)
  RIGHT_JOIN: function(with_, condition) {
    return this._join("RIGHT", with_, condition);
  },

  // \function SelectQuery.FULL_JOIN(...)
  FULL_JOIN: function(with_, condition) {
    return this._join("FULL", with_, condition);
  },

  // \function Query.FIELD(...)
  FIELD: Query.prototype._addFieldsOrReturning,

  // \function Query.GROUP_BY(...)
  GROUP_BY: function(arg) {
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
  },

  // \function Query.HAVING(...)
  HAVING: function(a, op, b) {
    return this._addHaving("AND", a, op, b, arguments.length);
  },

  // \function Query.OR_HAVING(...)
  OR_HAVING: function(a, op, b) {
    return this._addHaving("OR", a, op, b, arguments.length);
  }
});

// \class core.InsertQuery
function InsertQuery() {
  Query.call(this, "INSERT");
}
core.InsertQuery = qclass({
  $extend: Query,
  $construct: InsertQuery,

  compileQuery: Node$compileQuery,

  compileNode: function(ctx) {
    var s = "";
    var t = "";

    var k;
    var i, len;

    // Compile `INSERT INTO table (...)`
    var table = this._table;
    var columns = this._columns;
    var typeMapping = this._typeMapping || EmptyObject;

    if (!table) {
      throw new CompileError(
        "InsertQuery.compileNode() - Table not defined.");
    }

    if (typeof table === "string")
      t = escapeIdentifier(table);
    else
      t = table.compileNode();

    for (k in columns) {
      if (s)
        s += ", ";
      s += escapeIdentifier(k);
    }
    s = "INSERT INTO " + t + " (" + s + ")";

    // Compile `VALUES (...)[, (...)]`.
    var objects = this._values;
    s += " VALUES";

    for (i = 0, len = objects.length; i < len; i++) {
      var object = objects[i];

      t = "";
      for (k in columns) {
        if (t)
          t += ", ";

        if (hasOwnProperty.call(object, k))
          t += escapeValue(object[k], typeMapping[k]);
        else
          t += "DEFAULT";
      }

      if (i !== 0)
        s += ",";
      s += " (" + t + ")";
    }

    // Compile `RETURNING ...`.
    var returning = this._fieldsOrReturning;
    if (returning && returning.length)
      s += this._compileFieldsOrReturning(ctx, " RETURNING ", returning);

    return s;
  },

  // \function InsertQuery.TABLE(table)
  TABLE: Query.prototype._setFromOrIntoTable,
  //
  // Alias to `InsertQuery.INTO(table)`.

  // \function InsertQuery.INTO(table)
  INTO: Query.prototype._setFromOrIntoTable,

  // \function InsertQuery.RETURNING(...)
  RETURNING: Query.prototype._addFieldsOrReturning
});

// \class core.UpdateQuery
function UpdateQuery() {
  Query.call(this, "UPDATE");
}
core.UpdateQuery = qclass({
  $extend: Query,
  $construct: UpdateQuery,

  compileQuery: Node$compileQuery,

  compileNode: function(ctx) {
    var s = "";
    var t = "";

    // Compile `UPDATE ...`
    var table = this._table;
    if (!table)
      throw new CompileError(
        "UpdateQuery.compileNode() - Table not defined.");

    if (typeof table === "string")
      t = escapeIdentifier(table);
    else
      t = table.compileNode();

    s += "UPDATE " + t;

    // Compile `SET ...`
    var objects = this._values;

    if (!objects)
      throw new CompileError(
        "UpdateQuery.compileNode() - No data to update provided.");

    if (objects.length !== 1)
      throw new CompileError(
        "UpdateQuery.compileNode() - Can only update one record (" + objects.length + " provided).");

    var values = objects[0];
    var typeMapping = this._typeMapping || EmptyObject;

    t = "";
    for (var k in values) {
      var value = values[k];
      var compiled;

      if (!(value instanceof Node))
        compiled = escapeValue(value, typeMapping[k]);
      else
        compiled = value.compileNode();

      if (t)
        t += ", ";

      t += escapeIdentifier(k) + " = " + compiled;
    }
    s += " SET " + t;

    // Compile `FROM table[, table[, ...]]` or `FROM table JOIN table [, JOIN ...]`.
    var from = this._fromOrUsing;
    if (from)
      s += this._compileFromOrUsing(ctx, " FROM ", from);

    // Compile `WHERE ...`
    var where = this._where;
    if (where && where._values.length)
      s += this._compileWhereOrHaving(ctx, " WHERE ", where);

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit)
      s += " " + this._compileOffsetLimit(ctx, offset, limit);

    // Compile `RETURNING ...`.
    var returning = this._fieldsOrReturning;
    if (returning && returning.length)
      s += this._compileFieldsOrReturning(ctx, " RETURNING ", returning);

    return s;
  },

  // \function UpdateQuery.TABLE(table)
  TABLE: Query.prototype._setFromOrIntoTable,

  // \function UpdateQuery.FROM(...)
  FROM: Query.prototype._addFromOrUsing,

  // \function UpdateQuery.RETURNING(...)
  RETURNING: Query.prototype._addFieldsOrReturning
});

// \class core.DeleteQuery
function DeleteQuery() {
  Query.call(this, "DELETE");
}
core.DeleteQuery = qclass({
  $extend: Query,
  $construct: DeleteQuery,

  compileQuery: Node$compileQuery,

  compileNode: function(ctx) {
    var s = "";
    var t = "";

    // Compile `DELETE FROM ...`
    var table = this._table;
    if (!table)
      throw new CompileError(
        "DeleteQuery.compileNode() - Table not defined.");

    if (typeof table === "string")
      t = escapeIdentifier(table);
    else
      t = table.compileNode();

    s += "DELETE FROM " + t;

    // Compile `USING table[, table[, ...]]` or `USING table JOIN table [, JOIN ...]`.
    var using = this._fromOrUsing;
    if (using)
      s += this._compileFromOrUsing(ctx, " USING ", using);

    // Compile `WHERE ...`
    var where = this._where;
    if (where && where._values.length)
      s += this._compileWhereOrHaving(ctx, " WHERE ", where);

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit)
      s += " " + this._compileOffsetLimit(ctx, offset, limit);

    // Compile `RETURNING ...`.
    var returning = this._fieldsOrReturning;
    if (returning && returning.length)
      s += this._compileFieldsOrReturning(ctx, " RETURNING ", returning);

    return s;
  },

  // \function DeleteQuery.TABLE(table)
  //
  // Alias to `DeleteQuery.FROM(table)`.
  TABLE: Query.prototype._setFromOrIntoTable,

  // \function DeleteQuery.FROM(table)
  FROM: Query.prototype._setFromOrIntoTable,

  // \function DeleteQuery.USING(...)
  USING: Query.prototype._addFromOrUsing,

  // \function DeleteQuery.RETURNING(...)
  RETURNING: Query.prototype._addFieldsOrReturning
});

// \class core.CombinedQuery
function CombinedQuery() {
  Group.apply(this, arguments);

  // Make these members use the same layout as `Query` so JS engine can use the
  // same hidden class for `CombinedQuery`.
  this._columns = null;
  this._fieldsOrReturning = null;
  this._table = null;
  this._fromOrUsing = null;
  this._where = null;

  // These are actually used.
  this._orderBy = null;
  this._offset = 0;
  this._limit = 0;

  // TODO: Not used, I think when a type-mapping is set it should set it in all
  // Nodes supporting type mapping.
  this._typeMapping = null;
}
core.CombinedQuery = qclass({
  $extend: Group,
  $construct: CombinedQuery,

  shouldWrap: function(ctx) {
    return true;
  },

  compileQuery: Node$compileQuery,

  compileNode: function(ctx) {
    var s = "";

    var type = this._type;
    var flags = this._flags;

    if (flags & NodeFlags.kAllOrDistinct) {
      if (flags & NodeFlags.kDistinct)
        type += " DISTINCT";
      else
        type += " ALL";
    }

    var values = this._values;
    var separator = " " + type + " ";

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var compiled = escapeValue(value);

      if (s)
        s += separator;

      // Wrap if the value if it's not a query.
      if (!(value instanceof Query))
        s += "(" + compiled + ")";
      else
        s += compiled;
    }

    // Compile `ORDER BY ...`.
    var orderBy = this._orderBy;
    if (orderBy && orderBy.length) {
      s += this._compileOrderBy(ctx, " ORDER BY ", orderBy);
    }

    // Compile `OFFSET ...` / `LIMIT ...`.
    var offset = this._offset;
    var limit = this._limit;

    if (offset || limit) {
      s += " " + this._compileOffsetLimit(ctx, offset, limit);
    }

    return s;
  },

  _compileOrderBy: SelectQuery.prototype._compileOrderBy,
  _compileOffsetLimit: Query.prototype._compileOffsetLimit,

  ALL: function(value) {
    return this.setFlag(NodeFlags.kAll, value);
  },

  DISTINCT: function(value) {
    return this.setFlag(NodeFlags.kDistinct, value);
  },

  ORDER_BY: Query.prototype.ORDER_BY,
  OFFSET: Query.prototype.OFFSET,
  LIMIT: Query.prototype.LIMIT
});

// \function RAW(string:String, bindings:Array?)
function RAW(string, bindings) {
  return new Raw(string, bindings);
}
qsql.RAW = RAW;

// \function SELECT(...)
function SELECT(/* ... */) {
  var q = new SelectQuery();
  if (arguments.length)
    q.FIELD.apply(q, arguments);
  return q;
}
qsql.SELECT = SELECT;

// \function INSERT(...)
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
qsql.INSERT = INSERT;

// \function UPDATE(...)
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

  return q;
}
qsql.UPDATE = UPDATE;

// \function DELETE(...)
function DELETE(from) {
  var q = new DeleteQuery();
  if (from)
    q._table = from;
  return q;
}
qsql.DELETE = DELETE;

// \function AND(...)
function AND(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new Logical("AND", values);
}
qsql.AND = AND;

// \function OR(...)
function OR(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new Logical("OR", values);
}
qsql.OR = OR;

// \function EXCEPT(...)
function EXCEPT(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombinedQuery("EXCEPT", values);
}
qsql.EXCEPT = EXCEPT;

// \function EXCEPT_ALL(...)
function EXCEPT_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombinedQuery("EXCEPT", values).ALL();
}
qsql.EXCEPT_ALL = EXCEPT_ALL;

// \function INTERSECT(...)
function INTERSECT(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombinedQuery("INTERSECT", values);
}
qsql.INTERSECT = INTERSECT;

// \function INTERSECT_ALL(...)
function INTERSECT_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombinedQuery("INTERSECT", values).ALL();
}
qsql.INTERSECT_ALL = INTERSECT_ALL;

// \function UNION(...)
function UNION(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombinedQuery("UNION", values);
}
qsql.UNION = UNION;

// \function UNION_ALL(...)
function UNION_ALL(array) {
  var values = isArray(array) ? array : slice.call(arguments, 0);
  return new CombinedQuery("UNION", values).ALL();
}
qsql.UNION_ALL = UNION_ALL;

// \function COL(string, as)
function COL(string, as) {
  return new Identifier(string, as);
}
qsql.COL = COL;

// \function SORT(column, direction, nulls)
function SORT(column, direction, nulls) {
  return new Sort(column, direction, nulls);
}
qsql.SORT = SORT;

// \function OP(...)
//
// Construct unary or binary operator.
function OP(a, op, b) {
  var len = arguments.length;

  if (len === 2)
    return new Unary(op, a);
  else if (len === 3)
    return new Operator(a, op, b);
  else
    throw new CompileError("OP() - Illegal number or parameters '" + len + "' (2 or 3 allowed).");
}
qsql.OP = OP;

function EQ(a, b) { return OP(a, "=" , b); }
function NE(a, b) { return OP(a, "!=", b); }
function LT(a, b) { return OP(a, "<" , b); }
function LE(a, b) { return OP(a, "<=", b); }
function GT(a, b) { return OP(a, ">" , b); }
function GE(a, b) { return OP(a, ">=", b); }

qsql.EQ = EQ;
qsql.NE = NE;
qsql.LT = LT;
qsql.LE = LE;
qsql.GT = GT;
qsql.GE = GE;

// Add functions to `qsql`.
functionsList.forEach(function(name) {
  var func = function(/* ... */) {
    return new Func(name, slice.call(arguments, 0));
  };
  qsql[name] = func;
});

// Add aggregates to `qsql`.
aggregatesList.forEach(function(name) {
  var func = function(/* ... */) {
    return new Aggregate(name, slice.call(arguments, 0));
  };
  qsql[name] = func;
});

// Link camel-cased equivalents of all functions in `qsql` namespace.
Object.keys(qsql).forEach(function(name) {
  if (reUpperCase.test(name)) {
    qsql[toCamelCase(name)] = qsql[name];
  }
});

}).apply(this, typeof module === "object"
  ? [require("qclass"), exports] : [this.qclass, this.qsql = {}]);
