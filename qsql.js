(function(qclass, qsql) {
"use strict";

function returnFalse() {
  return false;
}

// \internal
// \{
var isArray = Array.isArray;
var isBuffer = typeof Buffer === "object" ? Buffer.isBuffer : returnFalse;
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

// Map of strings which can be implicitly casted to `TRUE` or `FALSE`.
var boolMap = {
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
Object.keys(boolMap).forEach(function(key) {
  boolMap[key.toUpperCase()] = boolMap[key];
});

var typeMap = {
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
  "raw"     : "raw"
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
  "~"    : " ~ "    ,// Bit-Not  | Match    |          |          |          |
  "<<"   : " << "   ,// Shf-Left |          |          |?LeftOf   |          |
  ">>"   : " >> "   ,// Shf-Right|          |          |?RightOf  |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "||"   : " || "   ,//          | Concat   | Concat   |          |          |
  "~*"   : " ~* "   ,//          |?MatchI   |          |          |          |
  "!~"   : " ~* "   ,//          |?NotMatch |          |          |          |
  "!~*"  : " !~* "  ,//          |?NotMatchI|          |          |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "AND"  : " AND "  ,//          |          |          |          |          |
  "OR"   : " OR "   ,//          |          |          |          |          |
  //-----+----------+------------+----------+----------+----------+----------+
  "LIKE" : " LIKE " ,//          |?Like     |          |          |          |
  "ILIKE": " ILIKE " //          |?LikeI    |          |          |          |
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
    if (s.charCodeAt(0) === 0)
      throw new CompileError("String can't contain NULL character.");
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
// Base class for all `Node`s related to query building.
//
// Node doesn't have any functionality and basically only initializes
// `_type` and `_as` members.
//
// Classes that inherit `Node` can omit calling `Node`s constructor for
// performance reasons.
function Node(type, as) {
  this._type = type || "";
  this._as = as || "";
}
core.Node = qclass({
  construct: Node,

  // \function Node.AS(as:String)
  AS: function(as) {
    this._as = as;
    return this;
  },

  // \function Node.EQ(b:{Var|Node})
  EQ: function(b) {
    return new Binary(this, "=", b);
  },

  // \function Node.NE(b:{Var|Node})
  NE: function(b) {
    return new Binary(this, "<>", b);
  },

  // \function Node.LT(b:{Var|Node})
  LT: function(b) {
    return new Binary(this, "<", b);
  },

  // \function Node.LE(b:{Var|Node})
  LE: function(b) {
    return new Binary(this, "<=", b);
  },

  // \function Node.GT(b:{Var|Node})
  GT: function(b) {
    return new Binary(this, ">", b);
  },

  // \function Node.GE(b:{Var|Node})
  GE: function(b) {
    return new Binary(this, ">=", b);
  },

  // \function Node.IN(b:{Var|Node})
  //
  // Returns a new Node which contains `this IN b` expression.
  IN: function(b) {
    return new Binary(this, "IN", b);
  },

  // \function Node.shouldWrap()
  //
  // Get whether the not should be wrapped in parentheses.
  shouldWrap: function(ctx) {
    throw new CompileError("Node(" + this._type + ").shouldWrap() - Must be reimplemented.");
  },

  // \function Node.compileNode()
  //
  // Compile the node.
  compileNode: function(ctx) {
    throw new CompileError("Node(" + this._type + ").compileNode() - Must be reimplemented.");
  },

  // \function Node.compileQuery()
  //
  // Compile the whole query adding semicolon ';' at the end.
  compileQuery: function(ctx) {
    return this.compileNode(ctx) + ";";
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

  shouldWrap: function(ctx) {
    return false;
  },

  compileNode: function(ctx) {
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
        throw new CompileError("Unary.compileNode() - Unknown type '" + type + "'.");
    }

    var as = this._as;
    if (as)
      s += " AS " + escapeIdentifier(as);

    return s;
  }
});

// \class core.Binary
function Binary(left, type, right, as) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._as = as || "";
  this._left = left;
  this._right = right;
}
core.Binary = qclass({
  extend: Node,
  construct: Binary,

  shouldWrap: function(ctx) {
    return false;
  },

  compileNode: function(ctx) {
    var type = this._type;
    var s = "";

    var left = escapeValue(this._left);
    var right = escapeValue(this._right);

    if (operatorMap.hasOwnProperty(type))
      s = left + operatorMap[type] + right;
    else
      throw new CompileError("Binary.compileNode() - Unknown operator '" + type + "'.");

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

// \class core.Combine
function Combine() {
  Group.apply(this, arguments);
  this._all = false;
}
core.Combine = qclass({
  extend: Group,
  construct: Combine,

  ALL: function(value) {
    if (typeof value !== "boolean")
      value = true;

    if (this._all === value)
      return this;

    if (value)
      this._type += " ALL";
    else
      this._type = this._type.substr(0, this._type.length - 4);

    this._all = value;
    return this;
  },

  shouldWrap: function(ctx) {
    return true;
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

  compileNode: function(ctx) {
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

  compileNode: function(ctx) {
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

  compileNode: function(ctx) {
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

  compileNode: function(ctx) {
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

  compileNode: function(ctx) {
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

  compileNode: function(ctx) {
    return this.escapeJson(this._value);
  }
});

// \class core.Query
function Query(type, lang) {
  // Doesn't call `Node` constructor.
  this._type = type || "";
  this._as = "";

  // Query flags, initially `null`.
  //
  // Flags become an object that acts as a set, where keys are elements of the
  // set. See `_getFlag()` and `_setFlag()`.
  this._flags = null;

  // Tables used after `FROM` statement, always an array of identifiers - mixed
  // content of Strings and Nodes is allowed and strings will be escaped as
  // identifiers in such case.
  this._from = [];

  this._fields = null;      // FIELD.
  this._joins = null;       // JOIN.

  this._values = null;      // VALUES
  this._columns = null;     // COLUMNS

  this._where = null;       // WHERE.

  this._groupBy = null;     // GROUP BY.
  this._having = null;      // HAVING.

  // Returning fields, evaluated if the query is `INSERT` / `UPDATE` or `DELETE`.
  this._returning = null;

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
  FROM: function(argFrom) {
    var thisFrom = this._from;

    if (isArray(argFrom))
      thisFrom.push.apply(thisFrom, argFrom);
    else
      thisFrom.push(argFrom);

    return this;
  },

  // \function Query.FIELD(...)
  FIELD: function(f) {
    var fields = this._fields;

    if (arguments.length > 1) {
      if (fields === null) {
        this._fields = Array_slice.call(arguments, 0);
      }
      else {
        for (var i = 0, len = arguments.length; i < len; i++)
          fields.push(arguments[i]);
      }
    }
    else if (isArray(f)) {
      // Optimization: If `_fields` is `null` the given array `f` is referenced.
      if (fields === null) {
        this._fields = f;
      }
      else {
        for (var i = 0, len = f.length; i < len; i++)
          fields.push(f[i]);
      }
    }
    else {
      if (fields === null)
        this._fields = [f];
      else
        fields.push(f);
    }

    return this;
  },

  // \function Query.INTO(...)
  INTO: function(into) {
    if (this._table)
      throw new CompileError("INTO() - table already specified ('" + table + "').");

    this._table = into;
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

  // \function Query.GROUP_BY(...)
  GROUP_BY: function(f) {
    var groupBy = this._groupBy;

    if (arguments.length > 1) {
      if (groupBy === null) {
        this._groupBy = Array_slice.call(arguments, 0);
      }
      else {
        for (var i = 0, len = arguments.length; i < len; i++)
          groupBy.push(arguments[i]);
      }
    }
    else if (isArray(f)) {
      // Optimization: If `_groupBy` is `null` the given array `f` is referenced.
      if (groupBy === null) {
        this._groupBy = f;
      }
      else {
        for (var i = 0, len = f.length; i < len; i++)
          groupBy.push(f[i]);
      }
    }
    else {
      if (groupBy === null)
        this._groupBy = [f];
      else
        groupBy.push(f);
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
  },

  // \function Query.ORDER_BY(...)
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

  RETURNING: function(f) {
    var returning = this._returning;

    if (arguments.length > 1) {
      if (returning === null) {
        this._returning = Array_slice.call(arguments, 0);
      }
      else {
        for (var i = 0, len = arguments.length; i < len; i++)
          returning.push(arguments[i]);
      }
    }
    else if (isArray(f)) {
      // Optimization: If `_fields` is `null` the given array `f` is referenced.
      if (returning === null) {
        this._returning = f;
      }
      else {
        for (var i = 0, len = f.length; i < len; i++)
          returning.push(f[i]);
      }
    }
    else {
      if (returning === null)
        this._returning = [f];
      else
        returning.push(f);
    }

    return this;
  },

  shouldWrap: function() {
    return true;
  },

  compileNode: function(ctx) {
    switch (this._type) {
      case "SELECT": return this.compileSelect(ctx);
      case "INSERT": return this.compileInsert(ctx);
      case "UPDATE": return this.compileUpdate(ctx);
      case "DELETE": return this.compileDelete(ctx);
      default:
        throw new CompileError("Query.compileNode() - Unknown query type '" + this._type + "'.");
    }
  },

  // \function Query.compileSelect
  compileSelect: function(ctx) {
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
          t += def.compileNode(ctx);
      }
    }
    s += " " + t;

    // Compile `FROM table[, table[, ...]]`.
    t = this.compileFrom(ctx);
    if (t)
      s += " " + t;

    // Compile `WHERE ...`.
    t = this.compileWhere(ctx);
    if (t)
      s += " " + t;

    // Compile `GROUP BY ...`.
    t = this.compileGroupBy(ctx);
    if (t)
      s += " " + t;

    // Compile `HAVING ...`.
    t = this.compileHaving(ctx);
    if (t)
      s += " " + t;

    // Compile `OFFSET ... LIMIT ...`.
    t = this.compileOffsetLimit(ctx);
    if (t)
      s += " " + t;

    return s;
  },

  // \function Query.compileInsert
  compileInsert: function(ctx) {
    var s = "";
    var t = "";

    var k;
    var i, len;

    // Compile `INSERT INTO table (...)`
    var table = this._table;
    var columns = this._columns;

    if (!table) {
      throw new CompileError(
        "Query.compileInsert() - Table not defined.");
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

        if (object.hasOwnProperty(k))
          t += escapeValue(object[k]);
        else
          t += "DEFAULT";
      }

      if (i !== 0)
        s += ",";
      s += " (" + t + ")";
    }

    // Compile `RETURNING ...`.
    t = this.compileReturning(ctx);
    if (t)
      s += " " + t;

    return s;
  },

  // \function Query.compileUpdate
  compileUpdate: function(ctx) {
    var s = "";
    var t = "";

    var k;

    // Compile `UPDATE table`
    var table = this._table;

    if (!table) {
      throw new CompileError(
        "Query.compileUpdate() - Table not defined.");
    }

    if (typeof table === "string")
      t = escapeIdentifier(table);
    else
      t = table.compileNode();

    s += "UPDATE " + t;

    // Compile `SET ...`
    var objects = this._values;

    if (!objects)
      throw new CompileError(
        "Query.compileUpdate() - Not values to SET provided.");

    if (objects.length !== 1)
      throw new CompileError(
        "Query.compileUpdate() - Can only update one record (" + objects.length + " provided).");

    var values = objects[0];

    t = "";
    for (var k in values) {
      var value = values[k];
      if (t)
        t += ", ";
      t += escapeIdentifier(k) + " = " + escapeValue(value);
    }
    s += " SET " + t;

    // Compile `FROM table[, table[, ...]]`.
    t = this.compileFrom(ctx);
    if (t)
      s += " " + t;

    // Compile `WHERE ...`
    t = this.compileWhere(ctx);
    if (t)
      s += " " + t;

    // Compile `OFFSET` / `LIMIT`.
    t = this.compileOffsetLimit(ctx);
    if (t)
      s += " " + t;

    // Compile `RETURNING ...`.
    t = this.compileReturning(ctx);
    if (t)
      s += " " + t;

    return s;
  },

  // \function Query.compileDelete
  compileDelete: function(ctx) {
    var s = "";
    var t = "";

    // Compile `DELETE`
    s += "DELETE";

    // Compile `FROM table[, table[, ...]]`.
    t = this.compileFrom(ctx);
    if (!t)
      throw new CompileError("Query.compileDelete() - Missing table definition.");
    s += " " + t;

    // Compile `WHERE ...`
    t = this.compileWhere(ctx);
    if (t)
      s += " " + t;

    // Compile `OFFSET` / `LIMIT`.
    t = this.compileOffsetLimit(ctx);
    if (t)
      s += " " + t;

    // Compile `RETURNING ...`.
    t = this.compileReturning(ctx);
    if (t)
      s += " " + t;

    return s;
  },

  compileFrom: function(ctx) {
    var s = "";
    var from = this._from;

    if (!from || from.length === 0)
      return s;

    for (var i = 0, len = from.length; i < len; i++) {
      var table = from[i];

      if (s)
        s += ", ";

      if (typeof table === "string")
        s += escapeIdentifier(table);
      else
        s += table.compileNode(ctx);
    }

    if (!s)
      return s;

    return "FROM " + s;
  },

  compileGroupBy: function(ctx) {
    var s = "";
    var defs = this._groupBy;

    if (defs && defs.length) {
      for (var i = 0, len = defs.length; i < len; i++) {
        var def = defs[i];

        if (s)
          s += ", ";

        // Group can be in a form of `string` or `Node`.
        if (typeof def === "string")
          s += escapeIdentifier(def);
        else
          s += def.compileNode(ctx);
      }
    }

    if (!s)
      return s;

    return "GROUP BY " + s;
  },

  compileWhere: function(ctx) {
    var condition = this._where;
    if (!condition || condition._values.length === 0)
      return "";
    return this.compileWhereOrHaving(ctx, "WHERE", condition);
  },

  compileHaving: function(ctx) {
    var condition = this._having;
    if (!condition || condition._values.length === 0)
      return "";
    return this.compileWhereOrHaving(ctx, "HAVING", condition);
  },

  compileWhereOrHaving: function(ctx, keyword, condition) {
    var s = "";
    var expressionList = condition._values;

    for (var i = 0, len = expressionList.length; i < len; i++) {
      var expression = expressionList[i];
      var compiled = expression.compileNode(ctx);

      if (s)
        s += " " + condition._type + " ";

      if (expression.shouldWrap())
        s += "(" + compiled + ")";
      else
        s += compiled;
    }

    if (!s)
      return s;

    return keyword + " " + s;
  },

  compileReturning: function(ctx) {
    var s = "";
    var returning = this._returning;

    if (!returning || returning._values.length === 0)
      return s;

    var defs = returning._values;
    for (var i = 0, len = defs.length; i < len; i++) {
      var def = defs[i];

      if (s)
        s += ", ";

      // Returning column can be in a form of `string` or `Node`.
      if (typeof def === "string")
        s += escapeIdentifier(def);
      else
        s += def.compileNode(ctx);
    }

    if (!s)
      return s;

    return "RETURNING " + s;
  },

  compileOffsetLimit: function(ctx) {
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

  // Get the object where `WHERE` conditions can be added right now.
  _getWhere: function(type) {
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

    return where;
  },

  _addWhere: function(type, a, op, b, nArgs) {
    var node;

    // WHERE/OR_WHERE accepts 1 or 3 arguments.
    if (nArgs === 3) {
      if (typeof a === "string")
        a = COL(a);
      node = new Binary(a, op, b);
    }
    else if (nArgs !== 1) {
      var prefix = type === "OR" ? "OR_" : "";
      throw new CompileError(prefix + "WHERE - Invalid argument.");
    }
    else if (isArray(a)) {
      this._getWhere(type).concat(a);
      return this;
    }
    else {
      node = (a instanceof Node) ? a : new ObjectOp("AND", a);
    }

    this._getWhere(type).push(node);
    return this;
  },

  // Get the object where `WHERE` conditions can be added right now.
  _getHaving: function(type) {
    var having = this._having;

    if (having === null) {
      // If no `WHERE` has been added yet, create one.
      having = new Logical(type);
      this._having = having;
    }
    else if (having.type !== type) {
      // If the current expression operator is not the same as `type`, wrap the
      // current expression inside a new node.
      having = new Logical(type);
      having.push(this._having);
      this._having = having;
    }

    return having;
  },

  _addHaving: function(type, a, op, b, nArgs) {
    var node;

    // HAVING/OR_HAVING accepts 1 or 3 arguments.
    if (nArgs === 3) {
      if (typeof a === "string")
        a = COL(a);
      node = new Binary(a, op, b);
    }
    else if (nArgs !== 1) {
      var prefix = type === "OR" ? "OR_" : "";
      throw new CompileError(prefix + "HAVING() - Invalid argument.");
    }
    else if (isArray(a)) {
      this._getHaving(type).concat(a);
      return this;
    }
    else {
      node = (a instanceof Node) ? a : new ObjectOp("AND", a);
    }

    this._getHaving(type).push(node);
    return this;
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

    if (typeof arg === "string" || arg instanceof Identifier) {
      q._table = arg;
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

    if (typeof arg === "string" || arg instanceof Identifier) {
      q._table = arg;
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

// \function EXCEPT_ALL(...)
function EXCEPT_ALL(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("EXCEPT", values).ALL();
}
qsql.EXCEPT_ALL = EXCEPT_ALL;

// \function INTERSECT(...)
function INTERSECT(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("INTERSECT", values);
}
qsql.INTERSECT = INTERSECT;

// \function INTERSECT_ALL(...)
function INTERSECT_ALL(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("INTERSECT", values).ALL();
}
qsql.INTERSECT_ALL = INTERSECT_ALL;

// \function UNION(...)
function UNION(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("UNION", values);
}
qsql.UNION = UNION;

// \function UNION_ALL(...)
function UNION_ALL(array) {
  var values = isArray(array) ? array : Array_slice.call(arguments, 0);
  return new Combine("UNION", values).ALL();
}
qsql.UNION_ALL = UNION_ALL;

// \function COL(string, as)
function COL(string, as) {
  return new Identifier(string, as);
};
qsql.COL = COL;

// \function OP(...)
//
// Construct unary or binary operator.
function OP(a, op, b) {
  var len = arguments.length;

  if (len === 2)
    return new Unary(op, a);
  else if (len === 3)
    return new Binary(a, op, b);
  else
    throw new CompileError("OP() - Illegal number or parameters '" + len + "' (2 or 3 allowed).")
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
