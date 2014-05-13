(function(qclass, qsql) {
"use strict";

// \internal
// \{
var isArray = Array.isArray;
var isBuffer = Buffer.isBuffer;
var Array_slice = Array.prototype.slice;
// \}

// \namespace core
var core = qsql.core = {};

// \namespace util
var util = qsql.util = {};

var reInt = /^-?\d+$/;
var reUpperCase = /^[A-Z_][A-Z_0-9]*$/;

// Shared object that contains no keys. Used to replace missing object that is
// optional.
var noObject = {};

// Map of identifiers that are not escaped.
var identifierMap = {
  "*"     : true
};

// Map of strings which can be implicitly cased to `TRUE` or `FALSE`.
var boolMap = {
  "0"     : "FALSE",
  "f"     : "FALSE",
  "false" : "FALSE",
  "n"     : "FALSE",
  "no"    : "FALSE",
  "off"   : "FALSE",

  "1"     : "TRUE",
  "t"     : "TRUE",
  "true"  : "TRUE",
  "y"     : "TRUE",
  "yes"   : "TRUE",
  "on"    : "TRUE"
};
Object.keys(boolMap).forEach(function(key) {
  boolMap[key.toUpperCase()] = boolMap[key];
});

var typeMap = {
  bool    : "boolean",
  boolean : "boolean",
  smallint: "integer",
  int     : "integer",
  integer : "integer",
  real    : "number",
  float   : "number",
  number  : "number",
  numeric : "number",

  char    : "string",
  varchar : "string",
  string  : "string",
  text    : "string",

  array   : "array",
  json    : "json",
  raw     : "raw"
};
Object.keys(typeMap).forEach(function(key) {
  typeMap[key.toUpperCase()] = typeMap[key];
});

var operatorMap = {
  //-----+----------+------------+----------+----------+----------+----------+
  // Op  | MappedTo | Int/Float  | String   | Array    | Range    | Geometry |
  //-----+----------+------------+----------+----------+----------+----------+
  "="    : " = "    ,//?Equal    |?Equal    |          |?Equal    |          |
  ">"    : " > "    ,//?Greater  |?Greater  |          |?Greater  |          |
  ">="   : " >= "   ,//?GreaterEq|?GreaterEq|          |?GreaterEq|          |
  "<"    : " < "    ,//?Less     |?Less     |          |?Less     |          |
  "<="   : " <= "   ,//?LessEq   |?LessEq   |          |?LessEq   |          |
  "<>"   : " <> "   ,//?NotEqual |?NotEqual |          |?NotEqual |          |
  "!="   : " <> "   ,//?NotEqual |?NotEqual |          |          |          |
  "@>"   : " @> "   ,//          |          |?Contains |?Contains |          |
  "<@"   : " <@ "   ,//          |          |?Cont-By  |?Cont-By  |          |
  "&&"   : " && "   ,//          |          |?Overlap  |?Overlap  |          |
  "&<"   : " &< "   ,//          |          |          |?Right-Of |          |
  "&>"   : " &> "   ,//          |          |          |?Left-Of  |          |
  "-|-"  : " -|- "  ,//          |          |          |?Adj-To   |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "+"    : " + "    ,// Add      |          | Union    | Union    |          |
  "-"    : " - "    ,// Subtract |          | Diff     | Diff     |          |
  "*"    : " * "    ,// Multiply |          | Intersect| Intersect|          |
  "/"    : " / "    ,// Divide   |          |          |          |          |
  "%"    : " % "    ,// Modulo   |          |          |          |          |
  "^"    : " ^ "    ,// Power    |          |          |          |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "&"    : " & "    ,// Bit-And  |          |          |          |          |
  "|"    : " | "    ,// Bit-Or   |          |          |          |          |
  "#"    : " # "    ,// Bit-Xor  |          |          |          |          |
  "~"    : " ~ "    ,// Bit-Not  | MatchRe  |          |          |          |
  "<<"   : " << "   ,// Shf-Left |          |          |?LeftOf   |          |
  ">>"   : " >> "   ,// Shf-Right|          |          |?RightOf  |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "||"   : " || "   ,//          | Concat   | Concat   |          |          |
  "~*"   : " ~* "   ,//          |?MatchRe i|          |          |          |
  "!~"   : " ~* "   ,//          |?NotMRe   |          |          |          |
  "!~*"  : " !~* "  ,//          |?NotMRe  i|          |          |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "AND"  : " AND "  ,//          |          |          |          |          |
  "OR"   : " OR "   ,//          |          |          |          |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "LIKE" : " LIKE " ,//          |?Like     |          |          |          |
  "ILIKE": " ILIKE " //          |?Like (i) |          |          |          |
  //-----+----------+------------+----------+----------+----------+----------+
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
  extend: Error,
  construct: ValueError
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
  extend: Error,
  construct: CompileError
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
  var fn = function(s) {
    return s.charAt(1);
  };

  function toCamelCase(s) {
    return s.toLowerCase().replace(re, fn);
  };

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

        if (identifierMap.hasOwnProperty(p))
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

  // QSql.Node.
  //
  // All QSql objects extend `Node`.
  if (value instanceof Node)
    return value.compile();

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
  var type = typeMap[explicitType];

  if (!type)
    throw new ValueError("Unknown explicit type '" + explicitType + "'.");

  switch (type) {
    case "boolean":
      if (value == null)
        return "NULL";

      if (typeof value === "boolean")
        return value ? "TRUE" : "FALSE";

      if (typeof value === "string" && boolMap.hasOwnProperty(value))
        return boolMap[value];

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
      // TODO:
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
    "\0"  : "\\x00",// Null character.
    "\b"  : "\\b",  // Backspace.
    "\f"  : "\\f",  // Form Feed.
    "\n"  : "\\n",  // New Line.
    "\r"  : "\\r",  // Carriage Return.
    "\t"  : "\\t",  // Tag.
    "\\"  : "\\\\", // Backslash.
    "\'"  : "\\\'"  // Single Quote.
  };

  var fn = function(s) {
    return map[s];
  };

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
  };

  return escapeString;
})();
qsql.escapeString = escapeString;

// \function escapeNumber(value)
function escapeNumber(value) {
  if (!isFinite(value)) {
    if (isNaN(value))
      return "'NaN'";
    if (value === Infinity)
      return "'Infinity'";
    if (value === -Infinity)
      return "'-Infinity'";
  }

  return value.toString();
};
qsql.escapeNumber = escapeNumber;

// \function escapeBuffer(value)
function escapeBuffer(value) {
  return "E'\\x" + value.toString("hex") + "'";
};
qsql.escapeBuffer = escapeBuffer;

// \function escapeArray(value, isNested)
function escapeArray(value, isNested) {
  var s = "";

  for (var i = 0, len = value.length; i < len; i++) {
    var element = value[i];

    if (s)
      s += ", ";

    if (isArray(element))
      s += escapeArray(element, true);
    else
      s += escapeValue(element);
  }

  if (isNested)
    return "[" + s + "]";
  else
    return "ARRAY[" + s + "]";
};
qsql.escapeArray = escapeArray;

// \function escapeJson(value)
function escapeJson(value) {
  escapeString(JSON.stringify(value));
};
qsql.escapeJson = escapeJson;

// \function substitute(query, bindings)
//
// Substitutes `?` sequences or postgres specific `$N` sequences in the `query`
// string with `bindings` and returns a new string. The function automatically
// detects the format of `query` string and checks if it's consistent (i.e. it
// throws if `?` is used together with `$1`).
//
// This function knows how to recognize escaped identifiers and strings in the
// query and skips content of these. For example for a given string `'?' ?` only
// the second `?` is considered and substituted.
//
// NOTE: Although the function understands SQL syntax, it doesn't do validation
// of the query itself. The purpose is to replace query parameters and not to
// perform expensive validation (that will be done by the server anyway).
var substitute = (function() {
  function substitute(query, bindings) {
    var input = query.toString();
    var output = "";

    // These are hints for javascript runtime. We really want this rountine
    // as fast as possible. The `|0` hint tells VM to use integer instead of
    // double precision floating point.
    var i      = 0|0;
    var len    = input.length|0;
    var iStart = 0|0;

    // Substitute mode:
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

        // Parse `'` - `'...'` section. Skip until the closing `'`.
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
          // 
          // We have to check `i - 2`, because `i` has been incremented already.
          if (i >= 2 && input.charCodeAt(i - 2) === 69) {
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
              throw new CompileError("Substitute() - Mixed substitution marks, " +
                "initial '" + String.fromCharCode(mode) + "'" +
                "is followed by '" + String.fromCharCode(c) + "'.");
            }
            mode = c;
          }

          // Flush accumulated input.
          output += input.substring(iStart, i - 1);
          iStart = i;

          // Parse the number `[0-9]+`
          while (i < len) {
            c = input.charCodeAt(i);
            // `0` === 48
            // `9` === 57
            if (c < 48 || c > 57)
              break;
            i++;
          }

          if (iStart === i) {
            throw new CompileError("Substitute() - Missing number after '$' mark.");
          }

          // Convert to index.
          bIndex = parseInt(input.substring(iStart, i)) - 1;
          if (bIndex >= bLength) {
            throw new CompileError("Substitute() - Index " + bIndex + " out of range (" + bLength + ").");
          }

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

        if (bIndex >= bLength) {
          throw new CompileError("Substitute() - Index " + bIndex + " out of range (" + bLength + ").");
        }

        // Flush accumulated input.
        output += input.substring(iStart, i - 1);

        // Substitute.
        output += escapeValue(bindings[bIndex]);

        // Advance.
        iStart = i;
        bIndex++;
      }
    }

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
// Base class for all QSql classes related to query building.
//
// Node doesn't have any functionality and basically only initializes
// `type` member.
//
// Classes that inherit Node can omit calling `Node` constructor for
// performance reasons, see `Value`.
function Node(type, as) {
  this._type = type || "";
  this._as = as || "";
}
core.Node = qclass({
  construct: Node,

  AS: function(as) {
    this._as = as;
    return this;
  },

  shouldWrap: function() {
    throw new CompileError("Node(" + this._type + ").shouldWrap() - Not implemented.");
  },

  // \function Node.compile()
  //
  // Compile the node.
  compile: function() {
    throw new CompileError("Node(" + this._type + ").compile() - Not implemented.");
  },

  // \function Node.compileQuery()
  //
  // Compile the whole adding semicolon ';' at the end.
  compileQuery: function() {
    return this.compile() + ";";
  },

  toString: function() {
    return this.compile();
  }
});

// \class core.Raw
//
// Wraps RAW query.
function Raw(string, bindings) {
  // Doesn't call `Node` constructor.
  this._type = "RAW";
  this._as = "";
  this._value = string || "";
  this._bindings = bindings || null;
}
core.Raw = qclass({
  extend: Node,
  construct: Raw,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    var s = this._value;

    var bindings = this._bindings;
    if (bindings || bindings.length)
      s = substitute(s, bindings);

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  }
});

// \class core.Unary
function Unary(type, value) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._as = "";
  this._value = value;
}
core.Unary = qclass({
  extend: Node,
  construct: Unary,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
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
        throw new CompileError("Unary.compile() - Unknown type '" + type + "'.");
    }

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  }
});

// \class core.Binary
function Binary(type, left, right, as) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._as = as || "";
  this._left = left;
  this._right = right;
}
core.Binary = qclass({
  extend: Node,
  construct: Binary,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    var type = this._type;
    var s = "";

    var left = escapeValue(this._left);
    var right = escapeValue(this._right);

    if (operatorMap.hasOwnProperty(type))
      s = left + operatorMap[type] + right;
    else
      throw new CompileError("Binary.compile() - Unknown operator '" + type + "'.");

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
  this._as = "";
  this._values = values || [];
}
core.Group = qclass({
  extend: Node,
  construct: Group,

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
  extend: Group,
  construct: Logical,

  shouldWrap: function() {
    return this._values.length > 1;
  },

  compile: function() {
    var type = this._type;
    var s = "";

    var values = this._values;
    var separator = " " + type + " ";

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = escapeValue(value);

      if (s)
        s += separator;

      if (value.shouldWrap())
        s += "(" + escaped + ")";
      else
        s += escaped;
    }

    return s;
  }
});

// \class core.Combine
function Combine() {
  Group.apply(this, arguments);
  this._all = false;
}
core.Combine = qclass({
  extend: Group,
  construct: Combine,

  ALL: function() {
    if (this._all === true)
      return this;

    this._type += " ALL";
    this._all = true;

    return this;
  },

  shouldWrap: function() {
    return true;
  },

  compile: function() {
    var type = this._type;
    var s = "";

    var values = this._values;
    var separator = " " + type + " ";

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = escapeValue(value);

      if (s)
        s += separator;

      // Wrap if the value is not a query.
      if (!(value instanceof Query))
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
  this._as = "";
  this._value = value;
}
core.ObjectOp = qclass({
  extend: Unary,
  construct: ObjectOp,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    // TODO:
  }
});

function Identifier(value, as) {
  // Doesn't call `Node` constructor.
  this._type = "IDENTIFIER";
  this._as = as || "";
  this._value = value;
}
core.Identifier = qclass({
  extend: Node,
  construct: Identifier,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    var s = escapeIdentifier(this._value);
    var as = this._as;

    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  }
});

// \class core.Func
function Func(type, values) {
  // Doesn't call `Group` constructor.
  this._type = type || "";
  this._as = "";
  this._values = values || [];
}
core.Func = qclass({
  extend: Group,
  construct: Func,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    var s = "";
    var values = this._values;

    for (var i = 0, len = values.length; i < len; i++) {
      var value = values[i];
      var escaped = escapeValue(value);

      if (s)
        s += ", ";
      s += escaped;
    }

    s = this._type + "(" + s + ")";
    
    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  }
});

// \class core.Aggregate
function Aggregate() {
  Func.apply(this, arguments);
}
core.Aggregate = qclass({
  extend: Func,
  construct: Aggregate
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
  this._as = "";
  this._value = value;
}
core.Value = qclass({
  extend: Node,
  construct: Value,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    return this.escapeValue(this._value, this._type);
  }
});

// \class core.ArrayValue
//
// Wraps ARRAY data.
function ArrayValue(value) {
  // Doesn't call `Value` constructor.
  this._type = "ARRAY";
  this._as = "";
  this._value = value;
}
core.ArrayValue = qclass({
  extend: Value,
  construct: ArrayValue,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    return this.escapeArray(this._value, false);
  }
});

// \class core.JsonValue
//
// Wraps JSON data.
function JsonValue(value) {
  // Doesn't call `Value` constructor.
  this._type = "JSON";
  this._as = "";
  this._value = value;
}
core.JsonValue = qclass({
  extend: Value,
  construct: JsonValue,

  shouldWrap: function() {
    return false;
  },

  compile: function() {
    return this.escapeJson(this._value);
  }
});

// \class core.Query
function Query(type, lang) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._as = "";

  this._flags = null;       // Qyery flags.

  this._tables = [];        // Tables  (ALL).
  this._fields = null;      // Fields  (SELECT).
  this._joins = null;       // Joins   (SELECT).

  this._values = null;      // VALUES  (INSERT / UPDATE).
  this._columns = null;     // columns (INSERT / UPDATE).

  this._where = null;       // Where  (SELECT/UPDATE/DELETE).
  this._returning = null;   // RETURNING fields.

  this._offset = 0;         // OFFSET.
  this._limit = 0;          // LIMIT.
}
core.Query = qclass({
  extend: Node,
  construct: Query,

  extensions: {
    aliases: function(aliases) {
      var p = this.prototype;
      for (var alias in aliases)
        p[alias] = p[aliases[alias]];
    }
  },

  // \function Query.DISTINCT(...)
  //
  // Adds `DISTINCT` clause to the query. It accepts the same arguments as
  // `SELECT()` so it can be used in a similar way. The following expressions
  // are equivalent:
  //
  //   - `SELECT(["a", "b", "c"]).DISTINCT()`
  //   - `SELECT().DISTINCT(["a", "b", "c"])`
  //   - `SELECT().DISTINCT().FIELD(["a", "b", "c"])`
  DISTINCT: function(array) {
    this._setFlag("DISTINCT");

    if (arguments.length > 1)
      return this.FIELD(Array_slice.call(arguments, 0));
    else if (array)
      return this.FIELD(array);
    else
      return this;
  },

  // \function Query.FROM(...)
  //
  // Specified `FROM` clause of the query.
  FROM: function(from) {
    var tables = this._tables;

    if (isArray(from))
      tables.push.apply(tables, from);
    else
      tables.push(from);

    return this;
  },

  // \function Query.FIELD(...)
  FIELD: function(f) {
    var fields = this._fields;

    if (fields === null)
      fields = this._fields = [];

    if (arguments.length > 1) {
      for (var i = 0, len = arguments.length; i < len; i++)
        fields.push(arguments[i]);
    }
    else if (isArray(f)) {
      for (var i = 0, len = f.length; i < len; i++)
        fields.push(f[i]);
    }
    else {
      fields.push(f);
    }

    return this;
  },

  // \function Query.INTO(...)
  INTO: function(into) {
    var tables = this._tables;

    if (tables.length === 1)
      throw new CompileError("Query.INTO() - table already specified ('" + tables[0] + "').");

    tables.push(into);
    return this;
  },

  // \function Query.VALUES(data)
  VALUES: function(data) {
    var values = this._values;
    var columns = this._columns;

    var dataIsArray = isArray(data);
    if (dataIsArray && data.length === 0)
      return this;

    if (values === null) {
      values = [];
      columns = {};

      this._values = values;
      this._columns = columns;
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
      var object = data;
      values.push(object);

      for (k in object)
        columns[k] = true;
    }

    return this;
  },

  // \function Query.WHERE(...)
  //
  // Add `WHERE` condition to the query.
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
    var node;

    if (arguments.length === 1)
      node = (a instanceof Node) ? a : new ObjectOp("AND", a);
    else if (arguments.length === 3)
      node = new Binary(op, a, b);
    else
      throw new CompileError("Query.WHERE() - Invalid argument.");

    return this._addWhere("AND", node);
  },

  // \function Query.OR_WHERE(...)
  //
  // Add top-level `OR` to the query.
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
  OR_WHERE: function(a, op, b) {
    var node;

    if (arguments.length === 1)
      node = (a instanceof Node) ? a : new ObjectOp("AND", a);
    else if (arguments.length === 3)
      node = new Binary(op, a, b);
    else
      throw new CompileError("Query.OR_WHERE() - Invalid argument.");

    return this._addWhere("OR", node);
  },

  GROUP_BY: function() {
    // TODO:
  },

  HAVING: function() {
    // TODO:
  },

  ORDER_BY: function() {
    // TODO:
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
  },

  // Get the object where `WHERE` conditions can be added right now.
  _addWhere: function(type, node) {
    var where = this._where;

    if (where === null) {
      // If no `WHERE` has been added yet, create one.
      where = new Logical(type);
      this._where = where;
    }
    else if (where.type !== type) {
      // If the current expression operator is not the same as `type`, wrap the
      // current expression inside a new node.
      where = new Logical(type);
      where.push(this._where);
      this._where = where;
    }

    where.push(node);
    return this;
  },

  _getFlag: function(flag) {
    var flags = this._flags;
    if (!flags)
      return false;
    return flags.hasOwnProperty(flag);
  },

  _setFlag: function(flag) {
    var flags = this._flags;
    if (!flags)
      flags = this._flags = {};
    flags[flag] = true;
    return this;
  },

  shouldWrap: function() {
    return true;
  },

  compile: function() {
    switch (this._type) {
      case "SELECT": return this.compileSelect();
      case "INSERT": return this.compileInsert();
      case "UPDATE": return this.compileUpdate();
      case "DELETE": return this.compileDelete();
      default:
        throw new CompileError("Query.compile() - Unknown query type '" + this._type + "'.");
    }
  },

  // \function Query.compileSelect
  compileSelect: function() {
    var s = "";
    var i, len;

    var flags = this._flags || noObject;

    // Compile `SELECT [DISTINCT] [*|fields]`
    //
    // Use `*` if  fields are not used.
    if (!flags.hasOwnProperty("DISTINCT"))
      s += "SELECT";
    else
      s += "SELECT DISTINCT";

    var t = "";
    var defs = this._fields;

    if (!defs || defs.length === 0) {
      t = "*";
    }
    else {
      for (i = 0, len = defs.length; i < len; i++) {
        var def = defs[i];

        if (t)
          t += ", ";

        // Field can be in a form of `string` or `Node`.
        if (typeof def === "string")
          t += escapeIdentifier(def);
        else
          t += def.compile();
      }
    }
    s += " " + t;

    // Compile `FROM table[, table[, ...]]`.
    t = this.compileFrom();
    if (t)
      s += " " + t;

    // Compile `WHERE ...`.
    t = this.compileWhere();
    if (t)
      s += " " + t;

    // Compile `OFFSET` / `LIMIT`.
    t = this.compileOffsetLimit();
    if (t)
      s += " " + t;

    return s;
  },

  // \function Query.compileInsert
  compileInsert: function() {
    var s = "";
    var k;
    var i, len;

    // Compile `INSERT INTO table (...)`
    var defs = this._tables;
    if (defs.length !== 1)
      throw new CompileError(
        "Query.compileInsert() - Can only insert to one table (" + defs.length + " given).");

    var table = defs[0];
    var objects = this._values;
    var columns = this._columns;

    for (k in columns) {
      if (s)
        s += ", ";
      s += escapeIdentifier(k);
    }

    s = "INSERT INTO " + escapeIdentifier(table) + " (" + s + ")";

    // Compile `VALUES (...)[, (...)]`.
    var t = "";
    var defs = this._fields;

    s += " VALUES";
    for (i = 0, len = objects.length; i < len; i++) {
      var object = objects[i];
      var t = "";

      for (k in columns) {
        if (t)
          t += ", ";

        if (object.hasOwnProperty(k))
          t += escapeValue(object[k]);
        else
          t += "DEFAULT";
      }

      if (i !== 0)
        s += ",";
      s += " (" + t + ")";
    }

    return s;
  },

  // \function Query.compileUpdate
  compileUpdate: function() {
    var s = "";
    var k;

    // Compile `UPDATE table`
    var defs = this._tables;
    if (defs.length !== 1)
      throw new CompileError(
        "Query.compileUpdate() - Can only update to one table (" + defs.length + " given).");

    var table = defs[0];
    s += "UPDATE " + escapeIdentifier(table);

    // Compile `SET ...`
    var objects = this._values;

    if (!objects)
      throw new CompileError(
        "Query.compileUpdate() - Not values to SET provided.");

    if (objects.length !== 1)
      throw new CompileError(
        "Query.compileUpdate() - Can only update one record (" + objects.length + " provided).");

    var values = objects[0];
    var t = "";

    for (var k in values) {
      var value = values[k];
      if (t)
        t += ", ";
      t += escapeIdentifier(k) + " = " + escapeValue(value);
    }
    s += " SET " + t;

    // Compile `FROM table[, table[, ...]]`.
    t = this.compileFrom();
    if (t)
      s += " " + t;

    // Compile `WHERE ...`
    t = this.compileWhere();
    if (t)
      s += " " + t;

    // Compile `OFFSET` / `LIMIT`.
    t = this.compileOffsetLimit();
    if (t)
      s += " " + t;

    return s;
  },

  // \function Query.compileDelete
  compileDelete: function() {
    var s = "";
    var t = "";

    // Compile `DELETE`
    s += "DELETE";

    // Compile `FROM table[, table[, ...]]`.
    t = this.compileFrom();
    if (!t)
      throw new CompileError("Query.compileDelete() - Missing table definition.");
    s += " " + t;

    // Compile `WHERE ...`
    t = this.compileWhere();
    if (t)
      s += " " + t;

    // Compile `OFFSET` / `LIMIT`.
    t = this.compileOffsetLimit();
    if (t)
      s += " " + t;

    return s;
  },

  compileFrom: function() {
    var s = "";
    var tables = this._tables;

    if (!tables || tables.length === 0)
      return s;

    for (var i = 0, len = tables.length; i < len; i++) {
      var table = tables[i];

      if (s)
        s += ", ";

      if (typeof table === "string")
        s += escapeIdentifier(table);
      else
        s += table.compile();
    }

    if (!s)
      return s;

    return "FROM " + s;
  },

  compileWhere: function() {
    var s = "";
    var where = this._where;

    if (where && where._values.length !== 0) {
      var defs = where._values;

      for (var i = 0, len = defs.length; i < len; i++) {
        var def = defs[i];
        if (s)
          s += " " + where._type + " ";

        if (def.shouldWrap())
          s += "(" + def.compile() + ")";
        else
          s += def.compile();
      }
    }

    if (!s)
      return s;

    return "WHERE " + s;
  },

  compileOffsetLimit: function() {
    var s = "";

    var offset = this._offset;
    var limit = this._limit;

    if (offset) {
      s += "OFFSET " + offset;
    }

    if (limit) {
      if (s)
        s += " ";
      s += "LIMIT " + limit;
    }

    return s;
  }
});

// \function RAW(string:String, bindings:Array?)
function RAW(string, bindings) {
  return new Raw(string, bindings);
}
qsql.RAW = RAW;

// \function SELECT(...)
function SELECT(array) {
  var q = new Query("SELECT");

  if (arguments.length > 1)
    return q.FIELD(Array_slice.call(arguments, 0));
  else if (array)
    return q.FIELD(array);
  else
    return q;
}
qsql.SELECT = SELECT;

// \function INSERT(...)
function INSERT(/* ... */) {
  var q = new Query("INSERT");

  var i = 0;
  var len = arguments.length;

  // If the first parameter is a string or identifier it is a table identifier.
  if (i < len) {
    var arg = arguments[i];

    if (typeof arg === "string") {
      q._tables = [arg];
      i++;
    }
    else if (arg instanceof Identifier) {
      q._tables = [arg._value];
      i++;
    }
  }

  // Next arguments can contain data (array/object) to insert.
  while (i < len) {
    var arg = arguments[i++];
    this.VALUES(arg);
  }

  return q;
}
qsql.INSERT = INSERT;

// \function UPDATE(...)
function UPDATE(/* ... */) {
  var q = new Query("UPDATE");

  var i = 0;
  var len = arguments.length;

  // If the first parameter is a string or identifier it is a table identifier.
  if (i < len) {
    var arg = arguments[i];

    if (typeof arg === "string") {
      q._tables = [arg];
      i++;
    }
    else if (arg instanceof Identifier) {
      q._tables = [arg._value];
      i++;
    }
  }

  // Next argument can contain data to update.
  if (i < len) {
    var arg = arguments[i];
    this.VALUES(arg);
  }

  return q;
}
qsql.UPDATE = UPDATE;

// \function DELETE(...)
function DELETE() {
  var q = new Query("DELETE");
  return q;
}
qsql.DELETE = DELETE;

// \function AND(...)
function AND(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Logical("AND", values);
};
qsql.AND = AND;

// \function OR(...)
function OR(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Logical("OR", values);
};
qsql.OR = OR;

// \function EXCEPT(...)
function EXCEPT(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("EXCEPT", values);
}
qsql.EXCEPT = EXCEPT;

// \function INTERSECT(...)
function INTERSECT(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("INTERSECT", values);
}
qsql.INTERSECT = INTERSECT;

// \function UNION(...)
function UNION(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("UNION", values);
}
qsql.UNION = UNION;

function COL(string, as) {
  return new Identifier(string, as);
};
qsql.COL = COL;

// Unary and Binary.
function OP(a, op, b) {
  var len = arguments.length;

  if (len === 2)
    return new Unary(op, a);
  else if (len === 3)
    return new Binary(op, a, b);
  else
    throw new CompileError("OP() - Illegal number or parameters (" + len + ").")
};
qsql.OP = OP;

function EQ(a, b) { return OP(a, "=" , b); };
function NE(a, b) { return OP(a, "!=", b); };
function LT(a, b) { return OP(a, "<" , b); };
function LE(a, b) { return OP(a, "<=", b); };
function GT(a, b) { return OP(a, ">" , b); };
function GE(a, b) { return OP(a, ">=", b); };

qsql.EQ = EQ;
qsql.NE = NE;
qsql.LT = LT;
qsql.LE = LE;
qsql.GT = GT;
qsql.GE = GE;

// \function INCREMENT(field, value)
function INCREMENT(field, value) {
  // TODO:
};
qsql.INCREMENT = INCREMENT;

// \function DECREMENT(field, value)
function DECREMENT(field, value) {
  // TODO:
};
qsql.DECREMENT = DECREMENT;

// Add functions to `qsql`.
functionsList.forEach(function(name) {
  var func = function(/* ... */) {
    return new Func(name, Array_slice.call(arguments, 0));
  };
  qsql[name] = func;
});

// Add aggregates to `qsql`.
aggregatesList.forEach(function(name) {
  var func = function(/* ... */) {
    return new Aggregate(name, Array_slice.call(arguments, 0));
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
