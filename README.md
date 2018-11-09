xql.js
======

Extensible and dependency free SQL builder and expression tree for node.js.

  * [Official Repository (jsstuff/xql)](https://github.com/jsstuff/xql)
  * [Official Fiddler](https://kobalicek.com/fiddle-xql.html)
  * [Public Domain (https://unlicense.org)](https://unlicense.org)

Disclaimer
----------

This library is used in production, but it doesn't contain all possible features of all available DB engines. It started initially with only PostgreSQL support, but now also MySQL, MSSQL, and SQLite dialects are available.

Be prepared for some minor API changes before the library stabilizes.

Introduction
------------

xql.js is a library designed to build SQL queries programmatically. It provides SQL expression tree that is created by high level API calls which mimic SQL syntax. It's a tool that helps to create the SQL expression tree that can be compiled into a single query string at the end of the building phase. The library has been designed primarily for DAO/DB layers, but use-cases are nearly unlimited.

There are several reasons why xql.js has been developed:

  1. Full support and focus on PostgreSQL (PG is the primary engine, but xql is getting support for MySQL and SQLite3 as well).
  2. High performance and low memory footprint, see [jsstuff/xql-bench](https://github.com/jsstuff/xql-bench) that compares with other engines.
  3. Schemaless by design, but allows to specify type-mapping so the input data can be properly escaped.
  4. Control of SQL parameters and the way they are formatted / escaped.
  5. Construction of SQL query shouldn't require RAW expressions to be written, but it should be easy to use RAW expressions in case they are needed.
  6. No more legacy JS (xql.js is based on ES6 classes), however, it doesn't dictate you how to write your own code.

There are several node.js libraries that focus on SQL query building, but none has satisfied all the needs. The closest library and huge inspiration for xql.js was Python's [SqlAlchemy](http://www.sqlalchemy.org), which is much more advanced compared to any node.js SQL framework at the moment. However, xql.js is just a query builder that has a type-mapping feature, which is used describe column types for serialization, but they are not used to describe relations or anything else. There are no plans to add ORM support to xql.js in any future release.

To simplify the library design and use cases, xql.js itself doesn't implement any functionality to talk to a real database - is just a query builder. There is another project in preparation that will bridge xql.js with node.js SQL drivers, but since there are so many libraries that can be used (including libraries for SQL connection pooling) there was no real work done to create another library for this purpose yet.

At the beginning, xql.js has been designed to work primarily with PostgreSQL, but other dialects are already in-progress and some code that brings initial support for MySQL and SQLite3 has landed.

Basic Usage
-----------

To use xql.js in node.js add `"xql"` library to your `package.json` and then `require("xql")` it. You need to create a context before you compile your expressions:

```js
const xql = require("xql");

// Create your context - context is used to hold database dialect and some
// options. It doesn't hold any intermediate data. It's perfectly fine to
// use one context for all your queries (and it's designed this way).
const ctx = xql.dialect.newContext({ dialect: "pgsql" /* [more options]*/ });

// Create some query.
var query = xql.SELECT("*")
  .FROM("cities")
  .WHERE("population", ">=", 1000000) // 3 form WHERE.
  .WHERE("capital", true);            // 2 form WHERE, implicit equality.

// Use context to compile the query.
console.log(query.compileStatement(ctx));
// SELECT * FROM "cities" WHERE "population" >= 1000000 AND "capital" = TRUE;
```

If you plan to pretty-print your queries for debugging purposes, use `pretty` and optionally `indentation` (default 2) option:

```js
const xql = require("xql");
const ctx = xql.dialect.newContext({
  dialect: "pgsql"
  pretty: true
});

var query = xql.SELECT("*")
  .FROM("cities")
  .WHERE("population", ">=", 1000000)
  .WHERE("capital", true);

console.log(query.compileStatement(ctx));
// SELECT
//   *
// FROM
//   "cities"
// WHERE
//   "population" >= 1000000 AND "capital" = TRUE;
```

If you ask yourself why all SQL constructs are UPPERCASED the explanation is very simple: in the past xql.js supported both conventions (UPPERCASED and camelCased), but it led to confusion and ambiguity. The new API follows a very simple rule: if any function creates a new SQL expression or modifies an existing one based on SQL semantics it's name is always UPPERCASED, otherwise it's camelCased (utility functions, etc). This way it's very simple to visually distinguish between SQL building blocks and other logic in your own code. Please open an issue if you would like to discuss other possibilities.

API Overview
------------

xql.js library consists of several nested namespaces, however, they are rarely used outside of `xql` implementation:

Namespace                   | Description
:-------------------------- | :------------------------------------
`xql`                       | High-level SQL builder interface targeting end-users
`xql.error`                 | Namespace that provides custom errors used by xql.js
`xql.misc`                  | SQL utilities made public, contains also a `VERSION` member in a `"major.minor.patch"` form
`xql.node`                  | SQL expression tree, contains `xql.node.Node` and all nodes that inherit from it

Error classes:

Error                       | Description
:-------------------------- | :------------------------------------
`xql.error.ValueError`      | Error thrown if data is wrong
`xql.error.CompileError`    | Error thrown if query is wrong

Expression tree:

Node                        | Description
:-------------------------- | :------------------------------------
`xql.node.Node`             | Base node, all SQL nodes inherit from it, it's safe to use `instanceof` operator to check whether an object is a `xql.node.Node`
`xql.node.NodeArray`        | Contains array of SQL nodes or values
`xql.node.Raw`              | Raw SQL expression intended to be used unescaped (the only way to pass something, which will not be escaped)
`xql.node.Value`            | SQL value base class
`xql.node.Identifier`       | SQL identifier, like table or column
`xql.node.Unary`            | SQL unary node (can contain a single child)
`xql.node.Binary`           | SQL binary node (can contain two children, left and right)
`xql.node.Func`             | SQL function or aggregate
`xql.node.Case`             | SQL `CASE` construct
`xql.node.When`             | SQL `WHEN` construct
`xql.node.Logical`          | Logical operator like `AND` and `OR`, which is based on `NodeArray` and can contain more than two expressions
`xql.node.ConditionalMap`   | Special node that contains key/value interface that can be used to construct `WHERE` like expressions without constructing `xql.node.Logical` nodes.
`xql.node.Join`             | SQL `JOIN` construct
`xql.node.Sort`             | SQL `ORDER BY` construct
`xql.node.With`             | Expression representing `"identifier" AS (SELECT ...)` part of WITH clause.
`xql.node.Statement`        | Base class representing a single SQL statement, which should end with semicolon
`xql.node.QueryStatement`   | Base class used by `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements
`xql.node.SelectStatement`  | SQL `SELECT` statement
`xql.node.InsertStatement`  | SQL `INSERT` statement
`xql.node.UpdateStatement`  | SQL `UPDATE` statement
`xql.node.DeleteStatement`  | SQL `DELETE` statement
`xql.node.CompoundStatement`| SQL `UNION`, `INTERSECT`, and `EXCEPT` operators that can be used to combine multiple query statements

High-level SQL builder concepts:

SQL-Builder API             | Description
:-------------------------- | :------------------------------------
`xql.TABLE(...)`            | Create a `xql.node.Identifier` wrapping a table name
`xql.COLUMN(...)`           | Create a `xql.node.Identifier` wrapping a column name (in a format `"column"` or `"table"."column"` or `"namespace"."table"."column"`)
`xql.COL(...)`              | Alias to `xql.COLUMN`
`xql.VALUE(...)`            | Create a `xql.node.Value` wrapping a value like `null`, `boolean`, `number`, or `string`
`xql.VAL(...)`              | Alias to `xql.VALUE`.
`xql.VALUES(...)`           | Create a `xql.node.Value` wrapping an array into SQL `VALUES`
`xql.DATE(...)`             | Create a `xql.node.Value` wrapping a `DATE` value
`xql.TIME(...)`             | Create a `xql.node.Value` wrapping a `TIME` value
`xql.TIMESTAMP(...)`        | Create a `xql.node.Value` wrapping a `TIMESTAMP` value
`xql.TIMESTAMPTZ(...)`      | Create a `xql.node.Value` wrapping a `TIMESTAMPTZ` value
`xql.INTERVAL(...)`         | Create a `xql.node.Value` wrapping a `INTERVAL` value
`xql.ARRAY(...)`            | Create a `xql.node.Value` wrapping an `ARRAY` value
`xql.JSON_(...)`            | Create a `xql.node.Value` wrapping a `JSON` value
`xql.RAW(s, bindings)`      | Create a RAW query `xql.node.Raw` node based on query string `s` and optional `bindings`
`xql.OP(...)`               | Create a `xql.node.Unary` or `xql.node.Binary` node depending on the count of parameters. The most used form is a 3 operand form, which is used to describe a binary expression. <br><br>For example `OP(COL("salary"), "+", 500).AS("newSalary")` can be used to describe an expression like `"salary" + 500 AS "newSalary"`. Please note that `AND` and `OR` operators should always use `xql.node.Logical` as xql.js can construct queries containing multiple `AND` and `OR` leaves
`xql.EQ(a, b)`              | Create a `xql.node.Binary` node describing `a = b` expression
`xql.NE(a, b)`              | Create a `xql.node.Binary` node describing `a <> b` expression
`xql.LT(a, b)`              | Create a `xql.node.Binary` node describing `a < b` expression
`xql.LE(a, b)`              | Create a `xql.node.Binary` node describing `a <= b` expression
`xql.GT(a, b)`              | Create a `xql.node.Binary` node describing `a > b` expression
`xql.GE(a, b)`              | Create a `xql.node.Binary` node describing `a >= b` expression
`xql.IS(a, b)`              | Create a `xql.node.Binary` node describing `a IS b` expression (you can use EQ as well which would detect IS case)
`xql.IS_DISTINCT_FROM(a, b)`| Create a `xql.node.Binary` node describing `a IS DISTINCT FROM b` expression
`xql.LIKE(a, b)`            | Create a `xql.node.Binary` node describing `a LIKE b` expression
`xql.ILIKE(a, b)`           | Create a `xql.node.Binary` node describing `a ILIKE b` expression
`xql.SIMILAR_TO(a, b)`      | Create a `xql.node.Binary` node describing `a SIMILAR TO b` expression
`xql.IN(a, b)`              | Create a `xql.node.Binary` node describing `a IN (b)` expression
`xql.NOT_IN(a, b)`          | Create a `xql.node.Binary` node describing `a NOT IN (b)` expression
`xql.BETWEEN(x, a, b)`      | Create a `xql.node.Func` node describing `x BETWEEN a AND b` expression
`xql.NOT_BETWEEN(x, a, b)`  | Create a `xql.node.Func` node describing `x NOT BETWEEN a AND b` expression
`xql.FUNCTION_NAME(...)`    | Create a `xql.node.Func` node describing `FUNCTION_NAME(...)` expression. Note that `FUNCTION_NAME` has to be replaced by the name of the function to be used, for example `xql.SIN(...)` describes `SIN()` function and `xql.COUNT(...)` describes `COUNT()` aggregate
`xql.AND(...)`              | Create a `xql.node.Logical` expression describing `AND` expression
`xql.OR(...)`               | Create a `xql.node.Logical` expression describing `OR` expression
`xql.SELECT(...)`           | Create a `xql.node.SelectStatement` and pass optional arguments to the `SelectStatement.FIELD(...)` method
`xql.INSERT(...)`           | Create a `xql.node.InsertStatement` and use an optional first argument as a table name (`FROM` clause) if it's a string or an identifier, and pass all other arguments to `SelectStatement.FIELD(...)` method
`xql.UPDATE(...)`           | Create a `xql.node.UpdateStatement` and use an optional first argument as a table name (`UPDATE ...` clause) if it's a string or an identifier, and pass all other arguments to `UpdateStatement.FIELD(...)` method
`xql.DELETE(...)`           | Create a `xql.node.DeleteStatement` and use an optional first argument as a table name
`xql.EXCEPT(...)`           | Create a `xql.node.CompoundStatement` describing `EXCEPT` expression
`xql.EXCEPT_ALL(...)`       | Create a `xql.node.CompoundStatement` describing `EXCEPT ALL` query
`xql.INTERSECT(...)`        | Create a `xql.node.CompoundStatement` describing `INTERSECT` query
`xql.INTERSECT_ALL(...)`    | Create a `xql.node.CompoundStatement` describing `INTERSECT ALL` query
`xql.UNION(...)`            | Create a `xql.node.CompoundStatement` describing `UNION` query
`xql.UNION_ALL(...)`        | Create a `xql.node.CompoundStatement` describing `UNION ALL` query
`xql.SORT(c, sort, nulls)`  | Create a `xql.node.Sort` node wrapping an `ORDER BY` clause

Generic Interface
-----------------

Since every node that is used to describe various constructs inherits directly or indirectly from `xql.node.Node` all nodes share a common interface:

xql.node.Node              | Description
:------------------------- | :------------------------------------
`.getType()`               | Get the node type {String}. For example a `xql.node.SelectStatement` is a `SELECT` type, logical operator is `AND` or `OR` type, etc...
`.setType(type)`           | Set the node type (used internally)
`.getLabel()`              | Get the node label that is rendered as `AS "label"` in SQL
`.setLabel(label)`         | Set the node label
`.canExecute()`            | Can be used to check whether the node can be executed by SQL engine. Only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries and `UNION`, `INTERSECT`, and `EXCEPT` operators can be executed.
`.compileNode(ctx)`        | Compile the node into a string. The `ctx` argument is currently not used, but it's designed in a way to pass an additional information to the compiler so multiple dialects can be used in the future.
`.compileStatement(ctx?)`  | Compile the query, it's basically a `compileNode()` call with semicolon `";"` at the end. This method should be used to return the query to be executed by your DB engine. It's provided by all query nodes.
`.AS(label)`               | Alias to `setLabel()`.
`.EQ(b)`                   | Returns `this = b` expression.
`.NE(b)`                   | Returns `this <> b` expression.
`.LT(b)`                   | Returns `this < b` expression.
`.LE(b)`                   | Returns `this <= b` expression.
`.GT(b)`                   | Returns `this > b` expression.
`.GE(b)`                   | Returns `this >= b` expression.
`.IN(b)`                   | Returns `this IN b` expression.
`.NOT_IN(b)`               | Returns `this NOT IN b` expression.

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

Select query is described by `xql.node.SelectStatement` node and wrapped by `xql.SELECT(...)`. It accepts arguments that are passed to the `FIELD()` method making the  `SELECT(...)`, `SELECT([...])` and `SELECT().FIELD(...)` constructs equivalent.

The `xql.node.SelectStatement` implements the following interface:

xql.node.SelectStatement   | Description
:------------------------- | :------------------------------------
`.FIELD(...)`              |
`.FIELD([...])`            | Add a field or expression to be selected. It accepts a `xql.node.Node`, column name, or a dictionary defining columns and their expressions. <br><br>The `FIELD()` calls are usually chained. For example `FIELD("a").FIELD("b")` calls are the same as `FIELD("a", "b")`, `FIELD(["a", "b"])`, and `FIELD({ a: true, b: true })`
`.DISTINCT(...)`           | Add a `DISTINCT` or `DISTINCT ON` (if arguments are provided) clause to the query.
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
      <td>`SELECT(["a", "b", "c"]).DISTINCT().FROM("x").WHERE("a", "<>", 42)`</td>
      <td>`SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" <> 42`</td>
    </tr>
    <tr>
      <td>`SELECT(["a", "b", "c"]).DISTINCT("a").FROM("x").WHERE("a", "<>", 42)`</td>
      <td>`SELECT DISTINCT ON ("a") "a", "b", "c" FROM "x" WHERE "a" <> 42`</td>
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

Insert query is described by `xql.node.InsertStatement` node and wrapped by `xql.INSERT(...)`. Note that `INSERT(...)` accepts parameters that can describe a target table and data to be inserted.

The `xql.node.InsertStatement` implements the following interface:

xql.node.InsertStatement   | Description
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

Update query is described by `xql.node.UpdateStatement` node and wrapped by `xql.UPDATE(...)`. Please note that `UPDATE(...)` accepts parameters that can describe a target table and data to be updated.

The `xql.node.UpdateStatement` implements the following interface:

xql.node.UpdateStatement   | Description
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

Delete query is described by `xql.node.DeleteStatement` node and wrapped by `xql.DELETE(...)`.

The `xql.node.DeleteStatement` implements the following interface:

xql.node.DeleteStatement   | Description
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
  "tagsArray" = ARRAY['accounting', 'customer support'],  -- Using PG ARRAY syntax.
  "tagsJson" = '["accounting", "customer support"]'::json -- Using PG JSON syntax.
WHERE
  "userId" = 1;
```

More Examples
-------------

There is a project called [xql-fiddle](https://kobalicek.com/fiddle-xql.html), which can be used to explore xql.js possibilities by playing with it online. It contains more snippets and tries to teach by examples.
