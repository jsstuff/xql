// xql.js <https://github.com/exjs/xql>
"use strict";

const assert = require("assert");
const xql = require("./xql");

// Queryable.
const SELECT           = xql.SELECT;
const UPDATE           = xql.UPDATE;
const INSERT           = xql.INSERT;
const DELETE           = xql.DELETE;
const EXCEPT           = xql.EXCEPT;
const EXCEPT_ALL       = xql.EXCEPT_ALL;
const UNION            = xql.UNION;
const UNION_ALL        = xql.UNION_ALL;
const INTERSECT        = xql.INTERSECT;
const INTERSECT_ALL    = xql.INTERSECT_ALL;

// Query building.
const COL              = xql.COL;
const VAL              = xql.VAL;
const ARRAY_VAL        = xql.ARRAY_VAL;
const JSON_VAL         = xql.JSON_VAL;

// Operators/Functions
const AND              = xql.AND;
const OR               = xql.OR;
const OP               = xql.OP;
const MIN              = xql.MIN;
const MAX              = xql.MAX;

// Helpers.
var ctx = xql.dialect.newContext({ dialect: "pgsql" });

function simplify(s) {
  return s.trim().replace(/\s+/g, " ");
}

function shouldMatch(a, b) {
  // Compile `a` and/or `b` if needed.
  if (a instanceof xql.node.Node) a = a.compileNode(ctx);
  if (b instanceof xql.node.Node) b = b.compileNode(ctx);

  // Simplify (removes redundant spaces).
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

describe("xql", function() {
  // Escape.
  it("should escape identifier.", function() {
    // Proper identifiers.
    shouldMatch(ctx.escapeIdentifier("")                , '""');
    shouldMatch(ctx.escapeIdentifier("a")               , '"a"');
    shouldMatch(ctx.escapeIdentifier("a.b")             , '"a"."b"');
    shouldMatch(ctx.escapeIdentifier(["a", "b"])        , '"a"."b"');
    shouldMatch(ctx.escapeIdentifier(["a", "b", "c"])   , '"a"."b"."c"');
    shouldMatch(ctx.escapeIdentifier(["a.b", "c"])      , '"a"."b"."c"');
    shouldMatch(ctx.escapeIdentifier(["a", "b.c"])      , '"a"."b"."c"');

    // Buggy inputs (empty strings and nulls).
    shouldMatch(ctx.escapeIdentifier([null, null, null]), '""');

    shouldMatch(ctx.escapeIdentifier(["a", null, null]) , '"a"');
    shouldMatch(ctx.escapeIdentifier([null, "a", null]) , '"a"');
    shouldMatch(ctx.escapeIdentifier([null, null, "a"]) , '"a"');

    shouldMatch(ctx.escapeIdentifier([null, "a", "b"])  , '"a"."b"');
    shouldMatch(ctx.escapeIdentifier(["a", null, "b"])  , '"a"."b"');
    shouldMatch(ctx.escapeIdentifier(["a", "b", null])  , '"a"."b"');

    shouldMatch(ctx.escapeIdentifier(["", "", ""])      , '""."".""');

    shouldMatch(ctx.escapeIdentifier(["a", "", ""])     , '"a"."".""');
    shouldMatch(ctx.escapeIdentifier(["", "a", ""])     , '""."a".""');
    shouldMatch(ctx.escapeIdentifier(["", "", "a"])     , '"".""."a"');

    shouldMatch(ctx.escapeIdentifier(["", "a", "b"])    , '""."a"."b"');
    shouldMatch(ctx.escapeIdentifier(["a", "", "b"])    , '"a".""."b"');
    shouldMatch(ctx.escapeIdentifier(["a", "b", ""])    , '"a"."b".""');

    // Keywords in input.
    shouldMatch(ctx.escapeIdentifier("*")               , '*');
    shouldMatch(ctx.escapeIdentifier(["a.*"])           , '"a".*');
    shouldMatch(ctx.escapeIdentifier(["a", "*"])        , '"a".*');
    shouldMatch(ctx.escapeIdentifier(["*", "a"])        , '*."a"');

    // Null characters are not allowed.
    shouldThrow(function() { shouldMatch(ctx.escapeIdentifier("\0")); });
  });

  it("should escape value.", function() {
    shouldMatch(ctx.escapeValue(undefined)     , "NULL");
    shouldMatch(ctx.escapeValue(null)          , "NULL");

    shouldMatch(ctx.escapeValue(true)          , "TRUE");
    shouldMatch(ctx.escapeValue(false)         , "FALSE");

    shouldMatch(ctx.escapeValue(0)             , "0");
    shouldMatch(ctx.escapeValue(1)             , "1");
    shouldMatch(ctx.escapeValue(-1)            , "-1");
    shouldMatch(ctx.escapeValue(0.5)           , "0.5");
    shouldMatch(ctx.escapeValue(NaN)           , "'NaN'");
    shouldMatch(ctx.escapeValue(Infinity)      , "'Infinity'");
    shouldMatch(ctx.escapeValue(-Infinity)     , "'-Infinity'");

    shouldMatch(ctx.escapeValue("")            , "''");
    shouldMatch(ctx.escapeValue("text")        , "'text'");
    shouldMatch(ctx.escapeValue("'text'")      , "E'\\'text\\''");
    shouldMatch(ctx.escapeValue('"text"')      , "'\"text\"'");
    shouldMatch(ctx.escapeValue('\b')          , "E'\\b'");
    shouldMatch(ctx.escapeValue('\f')          , "E'\\f'");
    shouldMatch(ctx.escapeValue('\n')          , "E'\\n'");
    shouldMatch(ctx.escapeValue('\r')          , "E'\\r'");
    shouldMatch(ctx.escapeValue('\t')          , "E'\\t'");
    shouldMatch(ctx.escapeValue('\\')          , "E'\\\\'");
    shouldMatch(ctx.escapeValue('\'')          , "E'\\''");

    // [] defaults to ARRAY[].
    shouldMatch(ctx.escapeValue([])            , "'{}'");
    shouldMatch(ctx.escapeValue([0, 1])        , "ARRAY[0, 1]");
    shouldMatch(ctx.escapeValue([[0, 1]])      , "ARRAY[[0, 1]]");
    shouldMatch(ctx.escapeValue([[0], [1]])    , "ARRAY[[0], [1]]");
    shouldMatch(ctx.escapeValue(["a", "b"])    , "ARRAY['a', 'b']");
    shouldMatch(ctx.escapeValue([["a", "b"]])  , "ARRAY[['a', 'b']]");
    shouldMatch(ctx.escapeValue([["a"], ["b"]]), "ARRAY[['a'], ['b']]");

    // {} defaults to JSON.
    shouldMatch(ctx.escapeValue({})            , "'{}'");
    shouldMatch(ctx.escapeValue({a:1})         , "'{\"a\":1}'");
    shouldMatch(ctx.escapeValue({a:1,b:2})     , "'{\"a\":1,\"b\":2}'");
    shouldMatch(ctx.escapeValue({a:"a",b:"b"}) , "'{\"a\":\"a\",\"b\":\"b\"}'");
    shouldMatch(ctx.escapeValue({a:["a","b"]}) , "'{\"a\":[\"a\",\"b\"]}'");

    shouldThrow(function() { ctx.escapeValue('\0'); });
  });

  // Substitute.
  it("should substitute expression.", function() {
    shouldMatch(
      ctx.substitute("a = ?, b = '', c = ?", [1, 2]),
      "a = 1, b = '', c = 2");

    shouldMatch(
      ctx.substitute("a = $1, b = '', c = $2", [1, 2]),
      "a = 1, b = '', c = 2");

    shouldMatch(
      ctx.substitute("a = ?, b = '?', c = ?", [1, 2]),
      "a = 1, b = '?', c = 2");

    shouldMatch(
      ctx.substitute("a = $1, b = '$1', c = $2", [1, 2]),
      "a = 1, b = '$1', c = 2");

    shouldMatch(
      ctx.substitute("a = ?, b = '?''?', c = ?", [1, 2]),
      "a = 1, b = '?''?', c = 2");

    shouldMatch(
      ctx.substitute("a = $1, b = '$1''$1', c = $2", [1, 2]),
      "a = 1, b = '$1''$1', c = 2");

    shouldMatch(
      ctx.substitute("\"a?\" = ?, b = E'?\\'?', c = ?", [1, 2]),
      "\"a?\" = 1, b = E'?\\'?', c = 2");

    shouldMatch(
      ctx.substitute("\"a$1\" = $1, b = E'$1\\'?', c = $2", [1, 2]),
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

  it("should test SELECT ... FROM ... WHERE ...", function() {
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
      'SELECT "a", "b", "c" FROM "x" WHERE "a" = 1 AND "b" = 2 AND "c" = 3');
  });

  it("should test SELECT DISTINCT ... FROM ... WHERE ...", function() {
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

  it("should test SELECT ... FROM ... GROUP BY ...", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").GROUP_BY(COL("a")),
      'SELECT "a", "b", "c" FROM "x" GROUP BY "a"');
  });

  it("should test SELECT ... FROM ... GROUP BY ... HAVING ...", function() {
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

  it("should test SELECT ... JOIN ...", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x", "y"),
      'SELECT "a", "b", "c" FROM "x" CROSS JOIN "y"');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").CROSS_JOIN("y"),
      'SELECT "a", "b", "c" FROM "x" CROSS JOIN "y"');
  });

  it("should test SELECT ... JOIN ... USING (...)", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").INNER_JOIN("y", ["a"]),
      'SELECT "a", "b", "c" FROM "x" INNER JOIN "y" USING ("a")');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").INNER_JOIN("y", ["a", "b"]),
      'SELECT "a", "b", "c" FROM "x" INNER JOIN "y" USING ("a", "b")');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").LEFT_JOIN("y", ["a"]),
      'SELECT "a", "b", "c" FROM "x" LEFT OUTER JOIN "y" USING ("a")');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").LEFT_JOIN("y", ["a", "b"]),
      'SELECT "a", "b", "c" FROM "x" LEFT OUTER JOIN "y" USING ("a", "b")');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").RIGHT_JOIN("y", ["a"]),
      'SELECT "a", "b", "c" FROM "x" RIGHT OUTER JOIN "y" USING ("a")');

    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").RIGHT_JOIN("y", ["a", "b"]),
      'SELECT "a", "b", "c" FROM "x" RIGHT OUTER JOIN "y" USING ("a", "b")');
  });

  it("should test SELECT ... JOIN ... ON ...", function() {
    shouldMatch(
      SELECT(["a", "b", "c"]).FROM("x").INNER_JOIN("y", OP(COL("x.a"), "=", COL("y.b"))),
      'SELECT "a", "b", "c" FROM "x" INNER JOIN "y" ON "x"."a" = "y"."b"');
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

  it("should test SELECT ... without using a table", function() {
    shouldMatch(
      SELECT([VAL(0).AS("a"), VAL("test").AS("b")]),
      'SELECT 0 AS "a", \'test\' AS "b"');
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

  it("should test UPDATE ... with nested operators", function() {
    shouldMatch(
      UPDATE("x").VALUES({ a: OP(COL("a"), "/", OP(COL("b"), "+", 1)) }),
      'UPDATE "x" SET "a" = "a" / ("b" + 1)');
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

  // Combined query (UNION, INTERSECT, EXCEPT).
  it("should test ... UNION ...", function() {
    shouldMatch(
      UNION(SELECT("a").FROM("x"), SELECT("a").FROM("y")),
      'SELECT "a" FROM "x" UNION SELECT "a" FROM "y"');
  });

  it("should test ... UNION ALL ... ", function() {
    shouldMatch(
      UNION_ALL(SELECT("a").FROM("x"), SELECT("a").FROM("y")),
      'SELECT "a" FROM "x" UNION ALL SELECT "a" FROM "y"');
  });

  it("should test ... INTERSECT ... ", function() {
    shouldMatch(
      INTERSECT(SELECT("a").FROM("x"), SELECT("a").FROM("y")),
      'SELECT "a" FROM "x" INTERSECT SELECT "a" FROM "y"');
  });

  it("should test ... INTERSECT ALL ... ", function() {
    shouldMatch(
      INTERSECT_ALL(SELECT("a").FROM("x"), SELECT("a").FROM("y")),
      'SELECT "a" FROM "x" INTERSECT ALL SELECT "a" FROM "y"');
  });

  it("should test ... EXCEPT ... ", function() {
    shouldMatch(
      EXCEPT(SELECT("a").FROM("x"), SELECT("a").FROM("y")),
      'SELECT "a" FROM "x" EXCEPT SELECT "a" FROM "y"');
  });

  it("should test ... EXCEPT ALL ... ", function() {
    shouldMatch(
      EXCEPT_ALL(SELECT("a").FROM("x"), SELECT("a").FROM("y")),
      'SELECT "a" FROM "x" EXCEPT ALL SELECT "a" FROM "y"');
  });

  // Combined query with ORDER BY and/or OFFSET/LIMIT.
  it("should test ... UNION ... ORDER BY ... OFFSET ... LIMIT ...", function() {
    shouldMatch(
      UNION(SELECT("a").FROM("x"), SELECT("a").FROM("y")).ORDER_BY("a").OFFSET(10).LIMIT(10),
      'SELECT "a" FROM "x" UNION SELECT "a" FROM "y" ORDER BY "a" OFFSET 10 LIMIT 10');
  });

  // Multiple combined queries in the same group.
  it("should test ... UNION ... UNION ...", function() {
    shouldMatch(
      UNION(
        SELECT("a").FROM("x"),
        SELECT("a").FROM("y"),
        SELECT("a").FROM("z")),
      'SELECT "a" FROM "x" UNION SELECT "a" FROM "y" UNION SELECT "a" FROM "z"');
  });

  // Multiple combined queries in nested groups.
  it("should test ... UNION (... UNION ...)", function() {
    shouldMatch(
      UNION(
        SELECT("a").FROM("x"),
        UNION(
          SELECT("a").FROM("y"),
          SELECT("a").FROM("z"))
      ),
      'SELECT "a" FROM "x" UNION (SELECT "a" FROM "y" UNION SELECT "a" FROM "z")');
  });

  it("should test ... UNION (... UNION ...)", function() {
    shouldMatch(
      UNION(
        UNION(
          SELECT("a").FROM("x"),
          SELECT("a").FROM("y")),
        SELECT("a").FROM("z")
      ),
      '(SELECT "a" FROM "x" UNION SELECT "a" FROM "y") UNION SELECT "a" FROM "z"');
  });
});
