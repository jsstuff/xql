"use strict";

var assert = require("assert");
var qsql = require("./qsql");

// Some useful shortcuts.
var SELECT = qsql.SELECT;
var UPDATE = qsql.UPDATE;
var INSERT = qsql.INSERT;
var DELETE = qsql.DELETE;

var AND = qsql.AND;
var OR = qsql.OR;
var OP = qsql.OP;

var EXCEPT = qsql.EXCEPT;
var UNION = qsql.UNION;
var INTERSECT = qsql.INTERSECT;

var COL = qsql.COL;
var MIN = qsql.MIN;
var MAX = qsql.MAX;

var escapeIdentifier = qsql.escapeIdentifier;
var escapeValue = qsql.escapeValue;
var substitute = qsql.substitute;

function simplify(s) {
  return s.trim().replace(/\s+/g, " ");
}

function shouldMatch(a, b) {
  // Compile `a` and/or `b` if needed.
  if (a instanceof qsql.core.Node) a = a.compileNode();
  if (b instanceof qsql.core.Node) b = b.compileNode();

  // Simplify, basically removes redundant spaces.
  a = simplify(a);
  b = simplify(b);

  // Remove trailing semicolon from `a` and/or `b`.
  if (a.length > 0 && a.charAt(a.length - 1) === ";") a = a.substr(0, a.length - 1);
  if (b.length > 0 && b.charAt(b.length - 1) === ";") b = b.substr(0, b.length - 1);

  // They should match.
  if (a !== b) {
    throw new Error(
      "Queries do not match:\n" +
      "\n" + a + "\n" +
      "\n" + b + "\n")
  }
}

function shouldThrow(fn) {
  try {
    fn();
    assert(!"Should have thrown an exception.");
  } catch(ex) { /* Success. */ }
}

describe("QSql", function() {
  // Escape.
  it("should escape identifier.", function() {
    // Proper identifiers.
    shouldMatch(escapeIdentifier("")           , '');
    shouldMatch(escapeIdentifier("a")          , '"a"');
    shouldMatch(escapeIdentifier("a.b")        , '"a"."b"');
    shouldMatch(escapeIdentifier("a", "b")     , '"a"."b"');
    shouldMatch(escapeIdentifier("a", "b", "c"), '"a"."b"."c"');
    shouldMatch(escapeIdentifier("a.b", "c")   , '"a"."b"."c"');
    shouldMatch(escapeIdentifier("a", "b.c")   , '"a"."b"."c"');

    // Buggy input (gaps).
    shouldMatch(escapeIdentifier("", "", "")   , '');

    shouldMatch(escapeIdentifier("a", "", "")  , '"a"');
    shouldMatch(escapeIdentifier("", "a", "")  , '"a"');
    shouldMatch(escapeIdentifier("", "", "a")  , '"a"');

    shouldMatch(escapeIdentifier("", "a", "b") , '"a"."b"');
    shouldMatch(escapeIdentifier("a", "", "b") , '"a"."b"');
    shouldMatch(escapeIdentifier("a", "b", "") , '"a"."b"');

    // Keywords in input.
    shouldMatch(escapeIdentifier("*")          , '*');
    shouldMatch(escapeIdentifier("a.*")        , '"a".*');
    shouldMatch(escapeIdentifier("a", "*")     , '"a".*');
    shouldMatch(escapeIdentifier("*", "a")     , '*."a"');

    // Null characters are not allowed.
    shouldThrow(function() { shouldMatch(escapeIdentifier("\0")); });
  });

  it("should escape value.", function() {
    shouldMatch(escapeValue(undefined)     , "NULL");
    shouldMatch(escapeValue(null)          , "NULL");

    shouldMatch(escapeValue(true)          , "TRUE");
    shouldMatch(escapeValue(false)         , "FALSE");

    shouldMatch(escapeValue(0)             , "0");
    shouldMatch(escapeValue(1)             , "1");
    shouldMatch(escapeValue(-1)            , "-1");
    shouldMatch(escapeValue(0.5)           , "0.5");
    shouldMatch(escapeValue(NaN)           , "'NaN'");
    shouldMatch(escapeValue(Infinity)      , "'Infinity'");
    shouldMatch(escapeValue(-Infinity)     , "'-Infinity'");

    shouldMatch(escapeValue("")            , "''");
    shouldMatch(escapeValue("text")        , "'text'");
    shouldMatch(escapeValue("'text'")      , "E'\\'text\\''");
    shouldMatch(escapeValue('"text"')      , "'\"text\"'");
    shouldMatch(escapeValue('\b')          , "E'\\b'");
    shouldMatch(escapeValue('\f')          , "E'\\f'");
    shouldMatch(escapeValue('\n')          , "E'\\n'");
    shouldMatch(escapeValue('\r')          , "E'\\r'");
    shouldMatch(escapeValue('\t')          , "E'\\t'");
    shouldMatch(escapeValue('\\')          , "E'\\\\'");
    shouldMatch(escapeValue('\'')          , "E'\\''");

    // [] defaults to ARRAY[].
    shouldMatch(escapeValue([])            , "'{}'");
    shouldMatch(escapeValue([0, 1])        , "ARRAY[0, 1]");
    shouldMatch(escapeValue([[0, 1]])      , "ARRAY[[0, 1]]");
    shouldMatch(escapeValue([[0], [1]])    , "ARRAY[[0], [1]]");
    shouldMatch(escapeValue(["a", "b"])    , "ARRAY['a', 'b']");
    shouldMatch(escapeValue([["a", "b"]])  , "ARRAY[['a', 'b']]");
    shouldMatch(escapeValue([["a"], ["b"]]), "ARRAY[['a'], ['b']]");

    // {} defaults to JSON.
    shouldMatch(escapeValue({})            , "'{}'");
    shouldMatch(escapeValue({a:1})         , "'{\"a\":1}'");
    shouldMatch(escapeValue({a:1,b:2})     , "'{\"a\":1,\"b\":2}'");
    shouldMatch(escapeValue({a:"a",b:"b"}) , "'{\"a\":\"a\",\"b\":\"b\"}'");
    shouldMatch(escapeValue({a:["a","b"]}) , "'{\"a\":[\"a\",\"b\"]}'");

    shouldThrow(function() { escapeValue('\0'); });
  });

  // Substitute.
  it("should substitute expression.", function() {
    shouldMatch(
      substitute("a = ?, b = '', c = ?", [1, 2]),
      "a = 1, b = '', c = 2");

    shouldMatch(
      substitute("a = $1, b = '', c = $2", [1, 2]),
      "a = 1, b = '', c = 2");

    shouldMatch(
      substitute("a = ?, b = '?', c = ?", [1, 2]),
      "a = 1, b = '?', c = 2");

    shouldMatch(
      substitute("a = $1, b = '$1', c = $2", [1, 2]),
      "a = 1, b = '$1', c = 2");

    shouldMatch(
      substitute("a = ?, b = '?''?', c = ?", [1, 2]),
      "a = 1, b = '?''?', c = 2");

    shouldMatch(
      substitute("a = $1, b = '$1''$1', c = $2", [1, 2]),
      "a = 1, b = '$1''$1', c = 2");

    shouldMatch(
      substitute("\"a?\" = ?, b = E'?\\'?', c = ?", [1, 2]),
      "\"a?\" = 1, b = E'?\\'?', c = 2");

    shouldMatch(
      substitute("\"a$1\" = $1, b = E'$1\\'?', c = $2", [1, 2]),
      "\"a$1\" = 1, b = E'$1\\'?', c = 2");
  });

  // SELECT.
  it("should test SELECT(*).", function() {
    shouldMatch(
      SELECT().FROM("x"),
      'SELECT * FROM "x"');
  });

  it("should test SELECT(...) vs. SELECT().FIELD(...).", function() {
    // Test all SELECT variations, they all should behave the same way.
    shouldMatch(
      SELECT("a", "b", "c").FROM("x"),
      'SELECT "a", "b", "c" FROM "x"');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x"),
      'SELECT "a", "b", "c" FROM "x"');

    shouldMatch(
      SELECT(COL("a"), COL("b"), COL("c")).FROM("x"),
      'SELECT "a", "b", "c" FROM "x"');

    shouldMatch(
      SELECT([COL("a"), COL("b"), COL("c")]).FROM("x"),
      'SELECT "a", "b", "c" FROM "x"');

    shouldMatch(
      SELECT({a: true, b: true, c: true }).FROM("x"),
      'SELECT "a", "b", "c" FROM "x"');

    shouldMatch(
      SELECT({a: "a", b: "b", c: "c" }).FROM("x"),
      'SELECT "a" AS "a", "b" AS "b", "c" AS "c" FROM "x"');

    shouldMatch(
      SELECT().FIELD("a").FIELD("b").FIELD("c").FROM("x"),
      'SELECT "a", "b", "c" FROM "x"');
  });

  it("should test SELECT ... FROM ... WHERE ... .", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").WHERE("a", 42),
      'SELECT "a", "b", "c" FROM "x" WHERE "a" = 42');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").WHERE("a", "=", 42),
      'SELECT "a", "b", "c" FROM "x" WHERE "a" = 42');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").WHERE("a", "<=", 42),
      'SELECT "a", "b", "c" FROM "x" WHERE "a" <= 42');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").WHERE("a", "IN", [42, 23]),
      'SELECT "a", "b", "c" FROM "x" WHERE "a" IN (42, 23)');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").WHERE({ a: 1, b: 2, c: 3 }),
      'SELECT "a", "b", "c" FROM "x" WHERE "a" = 1, "b" = 2, "c" = 3');
  });

  it("should test SELECT DISTINCT ... FROM ... WHERE ... .", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).DISTINCT().FROM("x").WHERE("a", "<=", 42),
      'SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" <= 42');

    shouldMatch(
      SELECT().DISTINCT("a", "b", "c").FROM("x").WHERE("a", ">=", 42),
      'SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" >= 42');

    shouldMatch(
      SELECT().DISTINCT(["a", "b", "c"]).FROM("x").WHERE("a", "<>", 42),
      'SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" <> 42');

    shouldMatch(
      SELECT().DISTINCT({ a: true, b: true, c: true }).FROM("x").WHERE("a", "<=", 42),
      'SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" <= 42');
  });

  it("should test SELECT ... FROM ... GROUP BY ... .", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").GROUP_BY(COL("a")),
      'SELECT "a", "b", "c" FROM "x" GROUP BY "a"');
  });

  it("should test SELECT ... FROM ... GROUP BY ... HAVING ....", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").GROUP_BY(COL("a"))
        .HAVING("a", "<", 3)
        .HAVING("b", ">", 1),
      'SELECT "a", "b", "c" FROM "x" GROUP BY "a" HAVING "a" < 3 AND "b" > 1');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").GROUP_BY(COL("a"))
        .HAVING(COL("a"), "<", 3)
        .HAVING(COL("b"), ">", 1),
      'SELECT "a", "b", "c" FROM "x" GROUP BY "a" HAVING "a" < 3 AND "b" > 1');
  });

  it("should test SELECT ... FROM ... WHERE ... IN ...", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").WHERE(COL("x").IN(1, 2, 3)),
      'SELECT "a", "b", "c" FROM "x" WHERE "x" IN (1, 2, 3)');
  });

  it("should test SELECT ... FROM ... ORDER BY ...", function() {
    shouldMatch(
      SELECT().FROM("x").ORDER_BY("a"),
      'SELECT * FROM "x" ORDER BY "a"');

    shouldMatch(
      SELECT().FROM("x").ORDER_BY("a", "ASC"),
      'SELECT * FROM "x" ORDER BY "a" ASC');

    shouldMatch(
      SELECT().FROM("x").ORDER_BY("a", "DESC"),
      'SELECT * FROM "x" ORDER BY "a" DESC');

    shouldMatch(
      SELECT().FROM("x").ORDER_BY("a", "ASC", "NULLS FIRST"),
      'SELECT * FROM "x" ORDER BY "a" ASC NULLS FIRST');

    shouldMatch(
      SELECT().FROM("x").ORDER_BY("a", "ASC", "NULLS LAST"),
      'SELECT * FROM "x" ORDER BY "a" ASC NULLS LAST');

    shouldMatch(
      SELECT().FROM("x").ORDER_BY("a", "ASC").ORDER_BY("b", "DESC"),
      'SELECT * FROM "x" ORDER BY "a" ASC, "b" DESC');
  });

  it("should test SELECT ... FROM ... OFFSET ... LIMIT ...", function() {
    shouldMatch(
      SELECT().FROM("x").OFFSET(1),
      'SELECT * FROM "x" OFFSET 1');

    shouldMatch(
      SELECT().FROM("x").LIMIT(1),
      'SELECT * FROM "x" LIMIT 1');

    shouldMatch(
      SELECT().FROM("x").OFFSET(10).LIMIT(20),
      'SELECT * FROM "x" OFFSET 10 LIMIT 20');
  });

  // INSERT.
  it("should test INSERT INTO ... () VALUES (...)", function() {
    shouldMatch(
      INSERT("x").VALUES({ a: 0, b: false, c: "String" }),
      'INSERT INTO "x" ("a", "b", "c") VALUES (0, FALSE, \'String\')');

    shouldMatch(
      INSERT().INTO("x").VALUES({ a: 0, b: false, c: "String" }),
      'INSERT INTO "x" ("a", "b", "c") VALUES (0, FALSE, \'String\')');
  });

  it("should test INSERT INTO ... () VALUES (...) RETURNING ...", function() {
    shouldMatch(
      INSERT("x").VALUES({ a: 0, b: false, c: "String" }).RETURNING("a", "b", "c"),
      'INSERT INTO "x" ("a", "b", "c") VALUES (0, FALSE, \'String\') RETURNING "a", "b", "c"');
  });

  // UPDATE.
  it("should test UPDATE ... SET ...", function() {
    shouldMatch(
      UPDATE("x").VALUES({ a: 1, b: "someString" }),
      'UPDATE "x" SET "a" = 1, "b" = \'someString\'');

    shouldMatch(
      UPDATE("x").VALUES({ a: 1, b: OP(COL("b"), "+", 1) }),
      'UPDATE "x" SET "a" = 1, "b" = "b" + 1');
  });

  it("should test UPDATE ... SET ... WHERE ...", function() {
    shouldMatch(
      UPDATE("x").VALUES({ a: 1, b: "someString" }).WHERE(COL("id"), "=", 1000),
      'UPDATE "x" SET "a" = 1, "b" = \'someString\' WHERE "id" = 1000');
  });

  it("should test UPDATE ... SET ... WHERE ... RETURNING ...", function() {
    shouldMatch(
      UPDATE("x").VALUES({ a: 1, b: "someString" })
        .WHERE("id", "=", 1000)
        .RETURNING("a", "b"),
      'UPDATE "x" SET "a" = 1, "b" = \'someString\' WHERE "id" = 1000 RETURNING "a", "b"');
  });

  // DELETE.
  it("should test DELETE ... ", function() {
    shouldMatch(
      DELETE().FROM("x"),
      'DELETE FROM "x"');
  });

  it("should test DELETE ... FROM ...", function() {
    shouldMatch(
      DELETE().FROM("x").WHERE(COL("a"), "<=", 42),
      'DELETE FROM "x" WHERE "a" <= 42');
  });
});
