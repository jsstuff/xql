xql.js
======

SQL builder and utilities library for node.js, [try it online](http://kobalicek.com/fiddle-xql.html).

  * [Official Repository (exjs/xql)](https://github.com/exjs/xql)
  * [Public Domain (unlicense.org)](https://unlicense.org)

Disclaimer
----------

This library is used in production, but it doesn't contain all possible features of all available DB engines (currently only PG). Be prepared for some minor API changes before the library stabilizes.

Introduction
------------

xql.js is a library designed to build SQL queries programmatically. It implements a SQL expression tree that is created by high level API calls which mimic SQL syntax. It's a tool that helps to create the SQL expression tree that can be compiled into a single query string at the end of the building phase. The library has been designed primarily for DAO/DB layers, but use-cases are nearly unlimited.

There are several reasons why xql.js has been developed:

  1. Full support and focus on PostgreSQL (PG is the primary engine, but xql is getting support for MySQL and SQLite3 as well).
  2. High performance and low memory footprint, see [exjs/xql-bench](https://github.com/exjs/xql-bench) that compares with other engines.
  3. Schemaless by design, but allows to specify type-mapping so the input data can be properly escaped.
  4. Control of SQL parameters and the way they are formatted / escaped.
  5. Construction of SQL query shouldn't require RAW expressions to be written, but it should be easy to use RAW expressions in case they are needed.
  6. No more legacy JS (xml.js is based on ES6 classes), however, it doesn't dictate you how to write your own code.

There are several node.js libraries that focus on SQL query building, but none has satisfied all the needs. The closest library and huge inspiration for xql.js was Python's [SqlAlchemy](http://www.sqlalchemy.org), which is much more advanced compared to any node.js SQL framework at the moment. However, xql.js is just a query builder that has a type-mapping feature, which is used describe column types for serialization, but they are not used to describe relations or anything else. There are no plans to add ORM support to xql.js in any future release.

To simplify the library design and use cases, xql.js itself doesn't implement any functionality to talk to a real database - is just a query builder. There is another project in preparation that will bridge xql.js with node.js SQL drivers, but since there are so many libraries that can be used (including libraries for SQL connection pooling) there was no real work done to create another library for this purpose yet.

At the beginning, xql.js has been designed to work primarily with PostgreSQL, but other dialects are already in-progress and some code that brings initial support for MySQL and SQLite3 has landed.

Basic Usage
-----------

To use xql.js in node.js add `"xql"` library to your `package.json` and then `require("xql")` it. You need to create a context before you compile your expressions:

```js
var xql = require("xql");

// Create your context - context is used to hold database dialect and some
// options. It doesn't hold any intermediate data. It's perfectly fine to
// use one context for all your queries (and it's designed this way).
var ctx = xql.dialect.newContext({ dialect: "pgsql" /* [more options]*/ });

// Create some query.
var query = xql.SELECT("*")
  .FROM("cities")
  .WHERE("population", ">=", 1000000) // 3 form WHERE.
  .WHERE("capital", true);            // 2 form WHERE, implicit equality.

// Use context to compile the query.
console.log(query.compileQuery(ctx));
// SELECT * FROM "cities" WHERE "population" >= 1000000 AND "capital" = TRUE;
```

If you plan to pretty-print your queries for debugging purposes, use `pretty` and optionally `indentation` (default 2) option:

```js
var xql = require("xql");
var ctx = xql.dialect.newContext({
  dialect: "pgsql"
  pretty: true
});

var query = xql.SELECT("*")
  .FROM("cities")
  .WHERE("population", ">=", 1000000)
  .WHERE("capital", true);

console.log(query.compileQuery(ctx));
// SELECT
//   *
// FROM
//   "cities"
// WHERE
//   "population" >= 1000000 AND "capital" = TRUE;
```

If you ask yourself why all SQL constructs are UPPERCASED the explanation is very simple: in the past xql.js supported both conventions (UPPERCASED and camelCased), but it led to confusion and ambiguity. The new API follows a very simple rule: if any function creates a new SQL expression it's name is always UPPERCASED, otherwise it's camelCased. This way it's very simple to visually distinguish between SQL building blocks and other logic in the source code.

API Overview
------------

xql.js library consists of several nested namespaces, however, they are rarely used outside of `xql` implementation:

Namespace                  | Description
:------------------------- | :------------------------------------
`xql`                      | Main API and high-level SQL builder interface (both UPPERCASED and camelCased versions of the same APIs)
`xql.error`                | Custom errors xql.js uses
`xql.misc`                 | SQL utilities xql is using made public, contains also a `VERSION` key in a `"major.minor.patch"` form
`xql.node`                 | Expression tree, contains `xql.node.Node` and all nodes that inherit from it

Error classes:

Error                      | Description
:------------------------- | :------------------------------------
`xql.error.ValueError`     | Error thrown if data is wrong
`xql.error.CompileError`   | Error thrown if query is wrong

Expression tree:

Node                       | Description
:------------------------- | :------------------------------------
`xql.node.Node`            | Base node, all SQL nodes inherit from it, it's safe to use `instanceof` operator to check whether an object is a `xql.node.Node`
`xql.node.Raw`             | Raw SQL expression
`xql.node.Unary`           | Unary SQL node (can contain a single child)
`xql.node.Binary`          | Binary SQL node (can contain two children, left and right)
`xql.node.Operator`        | SQL operator, like `=`, `+`, `-`, etc...
`xql.node.Group`           | Group of SQL nodes
`xql.node.Logical`         | Logical operator (Group), like `AND`, `OR`, etc...
`xql.node.ObjectOp`        | Special node that contains key/value interface that can be used to construct `WHERE` like expressions
`xql.node.Identifier`      | SQL identifier, like table or column
`xql.node.Join`            | SQL `JOIN` construct
`xql.node.Sort`            | SQL `ORDER BY` construct
`xql.node.Func`            | SQL function expression
`xql.node.Aggregate`       | SQL aggregate expression
`xql.node.Value`           | SQL value base class
`xql.node.PrimitiveValue`  | Primitive value like `NULL`, boolean, number, or string
`xql.node.ArrayValue`      | Array value (can serialize as JSON or ARRAY)
`xql.node.JsonValue`       | JSON value (can serialize as JSON or STRING)
`xql.node.Query`           | SQL query base class
`xql.node.SelectQuery`     | SQL `SELECT` query
`xql.node.InsertQuery`     | SQL `INSERT` query
`xql.node.UpdateQuery`     | SQL `UPDATE` query
`xql.node.DeleteQuery`     | SQL `DELETE` query
`xql.node.CombinedQuery`   | SQL `UNION`, `INTERSECT`, and `EXCEPT` operators that can be used to combine multiple queries

High-level SQL builder concepts:

SQL-Builder API            | Description
:------------------------- | :------------------------------------
`xql.SELECT(...)`          | Create a `xql.node.SelectQuery` and pass optional arguments to the `SelectQuery.FIELD(...)` method
`xql.INSERT(...)`          | Create a `xql.node.InsertQuery` and use an optional first argument as a table name (`FROM` clause) if it's a string or an identifier, and pass all other arguments to `SelectQuery.FIELD(...)` method
`xql.UPDATE(...)`          | Create a `xql.node.UpdateQuery` and use an optional first argument as a table name (`UPDATE ...` clause) if it's a string or an identifier, and pass all other arguments to `UpdateQuery.FIELD(...)` method
`xql.DELETE(...)`          | Create a `xql.node.DeleteQuery` and use an optional first argument as a table name
`xql.EXCEPT(...)`          | Create a `xql.node.CombinedQuery` describing `EXCEPT` expression
`xql.EXCEPT_ALL(...)`      | Create a `xql.node.CombinedQuery` describing `EXCEPT ALL` query
`xql.INTERSECT(...)`       | Create a `xql.node.CombinedQuery` describing `INTERSECT` query
`xql.INTERSECT_ALL(...)`   | Create a `xql.node.CombinedQuery` describing `INTERSECT ALL` query
`xql.UNION(...)`           | Create a `xql.node.CombinedQuery` describing `UNION` query
`xql.UNION_ALL(...)`       | Create a `xql.node.CombinedQuery` describing `UNION ALL` query
`xql.SORT(c, sort, nulls)` | Create a `xql.node.Sort` node wrapping an `ORDER BY` clause
`xql.RAW(s, bindings)`     | Create a RAW query `xql.node.Raw` node based on query string `s` and optional `bindings`
`xql.AND(...)`             | Create a `xql.node.Logical` expression describing `AND` expression
`xql.OR(...)`              | Create a `xql.node.Logical` expression describing `OR` expression
`xql.COL(...)`             | Create a `xql.node.Identifier` wrapping a column name (in a format `"column"` or `"table"."column"` or `"namespace"."table"."column"`)
`xql.VAL(...)`             | Create a `xql.node.PrimitiveValue` wrapping a primitive value like `null`, `boolean`, `number`, or `string`
`xql.ARRAY_VAL(...)`       | Create a `xql.node.ArrayValue` wrapping an array
`xql.JSON_VAL(...)`        | Create a `xql.node.ArrayValue` wrapping an object (JSON)
`xql.OP(...)`              | Create a `xql.node.Unary` or `xql.node.Binary` node depending on the count of parameters. The most used form is a 3 operand form, which is used to describe a binary expression. <br><br>For example `OP(COL("salary"), "+", 500).AS("newSalary")` can be used to describe an expression like `"salary" + 500 AS "newSalary"`. Please note that `AND` and `OR` operators should always use `xql.node.Logical` as xql.js can construct queries containing multiple `AND` and `OR` leaves
`xql.EQ(a, b)`             | Create a `xql.node.Binary` node describing `a = b` expression
`xql.NE(a, b)`             | Create a `xql.node.Binary` node describing `a <> b` expression
`xql.LT(a, b)`             | Create a `xql.node.Binary` node describing `a < b` expression
`xql.LE(a, b)`             | Create a `xql.node.Binary` node describing `a <= b` expression
`xql.GT(a, b)`             | Create a `xql.node.Binary` node describing `a > b` expression
`xql.GE(a, b)`             | Create a `xql.node.Binary` node describing `a >= b` expression
`xql.FUNCTION_NAME(...)`   | Create a `xql.node.Func` node describing `FUNCTION_NAME(...)` expression. Note that `FUNCTION_NAME` has to be replaced by the name of the function to be used, for example `xql.SIN(...)` describes `SIN()` function and `xql.COUNT(...)` describes `COUNT()` aggregate

Generic Interface
-----------------

Since every node that is used to describe various constructs inherits directly or indirectly from `xql.node.Node` all nodes share a common interface:

xql.node.Node              | Description
:------------------------- | :------------------------------------
`.getType()`               | Get the node type {String}. For example a `xql.node.SelectQuery` is a `SELECT` type, logical operator is `AND` or `OR` type, etc...
`.setType(type)`           | Set the node type (used internally)
`.getLabel()`              | Get the node label that is rendered as `AS "label"` in SQL
`.setLabel(label)`         | Set the node label
`.canExecute()`            | Can be used to check whether the node can be executed by SQL engine. Only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries and `UNION`, `INTERSECT`, and `EXCEPT` operators can be executed.
`.compileNode(ctx)`        | Compile the node into a string. The `ctx` argument is currently not used, but it's designed in a way to pass an additional information to the compiler so multiple dialects can be used in the future.
`.compileQuery(ctx?)`      | Compile the query, it's basically a `compileNode()` call with semicolon `";"` at the end. This method should be used to return the query to be executed by your DB engine. It's provided by all query nodes.
`.AS(label)`               | Alias to `setLabel()`.
`.EQ(b)`                   | Returns `this = b` expression.
`.NE(b)`                   | Returns `this <> b` expression.
`.LT(b)`                   | Returns `this < b` expression.
`.LE(b)`                   | Returns `this <= b` expression.
`.GT(b)`                   | Returns `this > b` expression.
`.GE(b)`                   | Returns `this >= b` expression.
`.IN(b)`                   | Returns `this IN b` expression.

For example `COL("a").EQ(1)` yields the same tree as `OP(COL("a"), "=", 1)`

The `xql.node.Unary` interface:

xql.node.Unary             | Description
:------------------------- | :------------------------------------
`.getValue()`              | Get the child node or value
`.setValue(value)`         | Set the child node or value

The `xql.node.Binary` interface:

xql.node.Binary            | Description
:------------------------- | :------------------------------------
`.getLeft()`               | Get the left node or value
`.setLeft(left)`           | Set the left node or value
`.getRight()`              | Get the right node or value
`.setRight(right)`         | Set the right node or value
`.addLeft(left)`           |
`.addRight(right)`         | Helpers, can only be used if the target value is an array, in such case the value `left` or `right` is pushed into it.

SELECT
------

Select query is described by `xql.node.SelectQuery` node and wrapped by `xql.SELECT(...)`. It accepts arguments that are passed to the `FIELD()` method making the  `SELECT(...)`, `SELECT([...])` and `SELECT().FIELD(...)` constructs equivalent.

The `xql.node.SelectQuery` implements the following interface:

xql.node.SelectQuery       | Description
:------------------------- | :------------------------------------
`.FIELD(...)`              |
`.FIELD([...])`            | Add a field or expression to be selected. It accepts a `xql.node.Node`, column name, or a dictionary defining columns and their expressions. <br><br>The `FIELD()` calls are usually chained. For example `FIELD("a").FIELD("b")` calls are the same as `FIELD("a", "b")`, `FIELD(["a", "b"])`, and `FIELD({ a: true, b: true })`
`.DISTINCT(...)`           | Add a `DISTINCT` clause to the query. <br><br>Please note that `DISTINCT(...)` passes all optional arguments to the `FIELD()` method making `SELECT(...).DISTINCT()` and `SELECT().DISTINCT(...)` constructs equivalent
`.FROM(...)`               |
`.FROM([...])`             | Add `FROM` clause to the query. The method accepts multiple arguments or a list of arguments. Most of the time `FROM` is used with a single argument describing the table to select from, however, multiple arguments forming an implicit `CROSS JOIN` construct, which matches the SQL specification, are allowed. <br><br>For example `FROM(a)` construct will generate `SELECT ... FROM "a"` query, while `FROM(a, b)` construct will generate `SELECT ... FROM "a", "b"` or `SELECT ... FROM "a" CROSS JOIN "b"` (these are equivalent, xql.js can generate any of these depending on the version and implementation changes)
`.CROSS_JOIN(with, cond)`  |
`.INNER_JOIN(...)`         |
`.LEFT_JOIN(...)`          |
`.RIGHT_JOIN(...)`         |
`.FULL_JOIN(...)`          | Add a `JOIN` clause to the query. Joins always join the current query with a new table. For example `FROM("a").INNER_JOIN("b").LEFT_JOIN("c")` construct will generate `SELECT ... FROM "a" INNER JOIN "b" LEFT OUTER JOIN "c"` query
`.WHERE(node)`             |
`.WHERE(a, b)`             |
`.WHERE(a, op, b)`         | Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `AND`ed with other `WHERE` clauses if present)
`.OR_WHERE(node)`          |
`.OR_WHERE(a, b)`          |
`.OR_WHERE(a, op, b)`      | Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `OR`ed with other `WHERE` clauses if present)
`.GROUP_BY(...)`           |
`.GROUP_BY([...])`         | Add a `GROUP BY` clause to the query. Group by can be specified as a column or a `xql.node.Node`
`.HAVING(node)`            |
`.HAVING(a, b)`            |
`.HAVING(a, op, b)`        | Add a `HAVING` clause `node`, `HAVING a = b`, or `HAVING a op b` to the query (implicitly `AND`ed with other `HAVING` clauses if present)
`.OR_HAVING(node)`         |
`.OR_HAVING(a, b)`         |
`.OR_HAVING(a, op, b)`     | Add a `HAVING` clause `node`, `HAVING a = b`, or `HAVING a op b` to the query (implicitly `OR`ed with other `HAVING` clauses if present)
`.ORDER_BY(col, dir, nulls)`| Add an `ORDER BY` expression of the form `"col" [ASC/DESC] [NULLS FIRST/LAST]`. If `col` is an array the builder will insert multiple sort clauses with the same `dir` and `nulls` order
`.OFFSET(offset)`          | Add an `OFFSET` clause to the query
`.LIMIT(limit)`            | Add a `LIMIT` clause to the query

Sample SQL selects:

<table>
  <thead>
    <tr>
      <td>JavaScript</td>
      <td>SQL</td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>`SELECT(["id", "name"]).FROM("users")`</td>
      <td>`SELECT "id", "name" FROM "users"`</td>
    </tr>
    <tr>
      <td>`SELECT().FIELD("id").FIELD("name").FROM("users")`</td>
      <td>`SELECT "id", "name" FROM "users"`</td>
    </tr>
    <tr>
      <td>`SELECT([COL("id").AS("userId"), "name"]).FROM("users")`</td>
      <td>`SELECT "id" AS "userId", "name" FROM "users"`</td>
    </tr>
    <tr>
      <td>`SELECT().DISTINCT(["a", "b", "c"]).FROM("x").WHERE("a", "<>", 42)`</td>
      <td>`SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" <> 42`</td>
    </tr>
  </tbody>
</table>

Complex SQL selects are possible by combining various SQL expressions together:

```js
var query = SELECT()
  .FIELD("name")
  .FIELD(
     SELECT(MAX(COL("pop")))
      .FROM("cities")
      .WHERE(COL("cities.state"), "=", COL("states.name"))
      .AS("population"))
  .FROM("states");
```

yields to:

```sql
SELECT
  "name",
  (SELECT MAX("pop") FROM "cities" WHERE "cities"."state" = "states"."name")
FROM
  "states";
```

INSERT
------

Insert query is described by `xql.node.InsertQuery` node and wrapped by `xql.INSERT(...)`. Note that `INSERT(...)` accepts parameters that can describe a target table and data to be inserted.

The `xql.node.InsertQuery` implements the following interface:

xql.node.InsertQuery       | Description
:------------------------- | :------------------------------------
`.TABLE(table)`            |
`.INTO(table)`             | Specify a target `table`
`.VALUES(data)`            | Specify a data to be inserted. The `data` argument can be both array or object. If an array is passed each element describes one row (it has to be array of objects), of an object is passed, it describes only one row. If `VALUES()` is called multiple times it pushes more rows to be inserted by the query
`.RETURNING(...)`          | Specify a `RETURNING` clause, uses the same syntax as `SELECT()`

Sample SQL insert:

```js
// INSERT("tasks", {...}).RETURNING(...) would also work.
var query = INSERT()
  .INTO("tasks")
  .VALUES({
    title: "Try xql.js",
    duration: 5
  })
  .RETURNING("id");
```

yields to:

```sql
INSERT INTO
  "tasks" ("title", "duration")
VALUES
  ('Try xql.js', 5)
RETURNING
  "id";
```

UPDATE
------

Update query is described by `xql.node.UpdateQuery` node and wrapped by `xql.UPDATE(...)`. Please note that `UPDATE(...)` accepts parameters that can describe a target table and data to be updated.

The `xql.node.UpdateQuery` implements the following interface:

xql.node.UpdateQuery       | Description
:------------------------- | :------------------------------------
`.TABLE(table)`            | Specify a target `table`
`.FROM(...)`               | Specify a `FROM` clause, uses the same syntax as `FROM()` defined by `SELECT` query
`.WHERE(node)`             |
`.WHERE(a, b)`             |
`.WHERE(a, op, b)`         | Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `AND`ed with other `WHERE` clauses if present)
`.OR_WHERE(node)`          |
`.OR_WHERE(a, b)`          |
`.OR_WHERE(a, op, b)`      | Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `OR`ed with other `WHERE` clauses if present)
`.RETURNING(...)`          | Specify a `RETURNING` clause, uses the same syntax as `FIELD()` defined by `SELECT` query

Sample SQL update:

```js
var query = UPDATE("users")
  .VALUES({
    address: "Friedrichstrasse 50, Berlin",
    addressChanged: OP(COL("addressChanged"), "+", 1)
  })
  .WHERE("userId", "=", 1);
```

yields to:

```sql
UPDATE
  "users"
SET
  "address" = 'Friedrichstrasse 50, Berlin',
  "addressChanged" = "addressChanged" + 1
WHERE
  "userId" = 1;
```

DELETE
------

Delete query is described by `xql.node.DeleteQuery` node and wrapped by `xql.DELETE(...)`.

The `xql.node.DeleteQuery` implements the following interface:

xql.node.DeleteQuery       | Description
:------------------------- | :------------------------------------
`.TABLE(table)`            |
`.FROM(table)`             | Specify a target `table`
`.USING(...)`              | Specify a `USING` clause, uses the same syntax as `FROM()` defined by `SELECT` query
`.WHERE(node)`             |
`.WHERE(a, b)`             |
`.WHERE(a, op, b)`         | Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `AND`ed with other `WHERE` clauses if present)
`.OR_WHERE(node)`          |
`.OR_WHERE(a, b)`          |
`.OR_WHERE(a, op, b)`      | Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `OR`ed with other `WHERE` clauses if present)
`.RETURNING(...)`          | Specify a `RETURNING` clause, uses the same syntax as `FIELD()` defined by `SELECT` query.

Sample SQL delete:

```js
var query = DELETE().FROM("tasks").WHERE("completed", "=", true)
```

yields to:

```sql
DELETE FROM "tasks" WHERE "completed" = TRUE;
```

Type Mapping
------------

xql.js has a feature called `TypeMapping`, which allows to override a default serialization of data used by `INSERT` and `UPDATE`. The type mapping is an object where a key/value defines a column/data-type pair. It can be set by `setTypeMapping()` and get by `getTypeMapping()` methods of the query object.

The following example illustrates how type mapping may affect data serialization:

```js
var typeMapping = {
  tagsArray: "ARRAY",
  tagsJson : "JSON"
};

var query = UPDATE("users")
  .VALUES({
    tagsArray : ["accounting", "customer support"],
    tagsJson  : ["accounting", "customer support"]
  })
  .WHERE("userId", "=", 1)
  .setTypeMapping(typeMapping);
```

```sql
UPDATE
  "users"
SET
  "tagsArray" = ARRAY['accounting', 'customer support'], -- Using PG ARRAY syntax.
  "tagsJson" = '["accounting", "customer support"]'      -- Using PG JSON syntax.
WHERE
  "userId" = 1;
```

More Examples
-------------

There is a project called [xql-fiddle](http://kobalicek.com/fiddle-xql.html), which can be used to explore xql.js possibilities by playing with it online. It contains more snippets and tries to teach by examples.
