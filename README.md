uql.js
======

SQL builder and utilities library designed to work with Node.js and PostgreSQL, [try it online](http://kobalicek.com/fiddle-uql.html).

  * [Official Repository (exceptionaljs/uql)](https://github.com/exceptionaljs/uql)
  * [Public Domain (unlicense.org)](http://unlicense.org)

Disclaimer
----------

This library is used in production, but it doesn't contain all possible features of all available DB engines (currently only PG). Be prepared for some minor API changes before the library reaches v1.0.

Introduction
------------

uql.js is a library designed to build SQL queries programmatically. It implements a SQL expression tree that is created by high level API calls which mimic SQL syntax. It's basically just a tool that helps to create the expression tree that is compiled into a single SQL string at the end of the building phase. The library has been designed primarily for DAO/DB layers, but use-cases are nearly unlimited.

There are several reasons why uql.js has been developed:

  1. Full support and focus on PostgreSQL backend (at the moment)
  2. High performance and low memory footprint
  3. Schema should be optional and not mandatory
  4. Control of SQL parameters and the way they are formatted / escaped
  5. Construction of SQL query doesn't require writing RAW expressions, but it should be easy to use RAW expressions in case they are needed
  6. Ability to queue multiple queries in a single instance of a query builder

There are several node.js libraries that focus on SQL query building, but none has satisfied all the needs. The closest library and huge inspiration for uql.js was Python's [SqlAlchemy](http://www.sqlalchemy.org), which is much more advanced compared to any node.js SQL framework at the moment. However, uql.js is just a query builder that has a minimal support for schemas that can be used to describe column types for serialization, but they are not used to describe relations or anything else. There are no plans to add ORM support to uql.js in any future release.

To simplify the library design and use cases, uql.js itself doesn't implement any functionality to talk to a real database - is just a query builder. There is another project in preparation that will bridge uql.js with node.js SQL drivers, but since there are so many libraries that can be used (including libraries for SQL connection pooling) there was no real work done to create another library for this purpose.

At the beginning, uql.js has been designed to work primarily with PostgreSQL, but the project will be extended to support also other database engines; it's planned.

Overview
--------

uql.js library consists of several nested namespaces, however, they are rarely used outside of `uql` implementation:

Namespace                  | Description
:------------------------- | :------------------------------------
`uql`                      | Main API and high-level SQL builder interface (both UPPERCASED and camelCased versions of the same APIs)
`uql.core`                 | Expression tree nodes, contains `uql.core.Node` and all nodes that inherit from it
`uql.util`                 | SQL utilities made public
`uql.misc`                 | Contains `VERSION` key in a `"major.minor.patch"` form

Error classes:

Error                      | Description
:------------------------- | :------------------------------------
`uql.ValueError`           | Error thrown if data is wrong
`uql.CompileError`         | Error thrown if query is wrong

Expression tree:

Node                       | Description
:------------------------- | :------------------------------------
`uql.core.Node`            | Base node, all SQL nodes inherit from it, it's safe to use `instanceof` operator to check whether an object is a `uql.core.Node`
`uql.core.Raw`             | Raw SQL expression
`uql.core.Unary`           | Unary SQL node (can contain a single child)
`uql.core.Binary`          | Binary SQL node (can contain two children, left and right)
`uql.core.Operator`        | SQL operator, like `=`, `+`, `-`, etc...
`uql.core.Group`           | Group of SQL nodes
`uql.core.Logical`         | Logical operator (Group), like `AND`, `OR`, etc...
`uql.core.ObjectOp`        | Special node that contains key/value interface that can be used to construct `WHERE` like expressions
`uql.core.Identifier`      | SQL identifier, like table or column
`uql.core.Join`            | SQL `JOIN` construct
`uql.core.Sort`            | SQL `ORDER BY` construct
`uql.core.Func`            | SQL function expression
`uql.core.Aggregate`       | SQL aggregate expression
`uql.core.Value`           | SQL value base class
`uql.core.PrimitiveValue`  | Primitive value like `NULL`, boolean, number, or string
`uql.core.ArrayValue`      | Array value (can serialize as JSON or ARRAY)
`uql.core.JsonValue`       | JSON value (can serialize as JSON or STRING)
`uql.core.Query`           | SQL query base class
`uql.core.SelectQuery`     | SQL `SELECT` query
`uql.core.InsertQuery`     | SQL `INSERT` query
`uql.core.UpdateQuery`     | SQL `UPDATE` query
`uql.core.DeleteQuery`     | SQL `DELETE` query
`uql.core.CombinedQuery`   | SQL `UNION`, `INTERSECT`, and `EXCEPT` operators that can be used to combine multiple queries

High-level SQL builder concepts:

SQL-Builder API            | Description
:------------------------- | :------------------------------------
`uql.SELECT(...)`          | Create a `uql.core.SelectQuery` and pass optional arguments to the `SelectQuery.FIELD(...)` method
`uql.INSERT(...)`          | Create a `uql.core.InsertQuery` and use an optional first argument as a table name (`FROM` clause) if it's a string or an identifier, and pass all other arguments to `SelectQuery.FIELD(...)` method
`uql.UPDATE(...)`          | Create a `uql.core.UpdateQuery` and use an optional first argument as a table name (`UPDATE ...` clause) if it's a string or an identifier, and pass all other arguments to `UpdateQuery.FIELD(...)` method
`uql.DELETE(...)`          | Create a `uql.core.DeleteQuery` and use an optional first argument as a table name
`uql.EXCEPT(...)`          | Create a `uql.core.CombinedQuery` describing `EXCEPT` expression
`uql.EXCEPT_ALL(...)`      | Create a `uql.core.CombinedQuery` describing `EXCEPT ALL` query
`uql.INTERSECT(...)`       | Create a `uql.core.CombinedQuery` describing `INTERSECT` query
`uql.INTERSECT_ALL(...)`   | Create a `uql.core.CombinedQuery` describing `INTERSECT ALL` query
`uql.UNION(...)`           | Create a `uql.core.CombinedQuery` describing `UNION` query
`uql.UNION_ALL(...)`       | Create a `uql.core.CombinedQuery` describing `UNION ALL` query
`uql.SORT(c, sort, nulls)` | Create a `uql.core.Sort` node wrapping an `ORDER BY` clause
`uql.RAW(s, bindings)`     | Create a RAW query `uql.core.Raw` node based on query string `s` and optional `bindings`
`uql.AND(...)`             | Create a `uql.core.Logical` expression describing `AND` expression
`uql.OR(...)`              | Create a `uql.core.Logical` expression describing `OR` expression
`uql.COL(...)`             | Create a `uql.core.Identifier` wrapping a column name (in a format `"column"` or `"table"."column"` or `"namespace"."table"."column"`)
`uql.VAL(...)`             | Create a `uql.core.PrimitiveValue` wrapping a primitive value like `null`, `boolean`, `number`, or `string`
`uql.ARRAY_VAL(...)`       | Create a `uql.core.ArrayValue` wrapping an array
`uql.JSON_VAL(...)`        | Create a `uql.core.ArrayValue` wrapping an object (JSON)
`uql.OP(...)`              | Create a `uql.core.Unary` or `uql.core.Binary` node depending on the count of parameters. The most used form is a 3 operand form, which is used to describe a binary expression. <br><br>For example `OP(COL("salary"), "+", 500).AS("newSalary")` can be used to describe an expression like `"salary" + 500 AS "newSalary"`. Please note that `AND` and `OR` operators should always use `uql.core.Logical` as uql.js can construct queries containing multiple `AND` and `OR` leaves
`uql.EQ(a, b)`             | Create a `uql.core.Binary` node describing `a = b` expression
`uql.NE(a, b)`             | Create a `uql.core.Binary` node describing `a <> b` expression
`uql.LT(a, b)`             | Create a `uql.core.Binary` node describing `a < b` expression
`uql.LE(a, b)`             | Create a `uql.core.Binary` node describing `a <= b` expression
`uql.GT(a, b)`             | Create a `uql.core.Binary` node describing `a > b` expression
`uql.GE(a, b)`             | Create a `uql.core.Binary` node describing `a >= b` expression
`uql.FUNCTION_NAME(...)`   | Create a `uql.core.Func` node describing `FUNCTION_NAME(...)` expression. Note that `FUNCTION_NAME` has to be replaced by the name of the function to be used, for example `uql.SIN(...)` describes `SIN()` function and `uql.COUNT(...)` describes `COUNT()` aggregate

Generic Interface
-----------------

Since every node that is used to describe various constructs inherits directly or indirectly from `uql.core.Node` all nodes share a common interface:

uql.core.Node              | Description
:------------------------- | :------------------------------------
`.getType()`               | Get the node type {String}. For example a `uql.core.SelectQuery` is a `SELECT` type, logical operator is `AND` or `OR` type, etc...
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

The `uql.core.Unary` interface:

uql.core.Unary             | Description
:------------------------- | :------------------------------------
`.getValue()`              | Get the child node or value
`.setValue(value)`         | Set the child node or value

The `uql.core.Binary` interface:

uql.core.Binary            | Description
:------------------------- | :------------------------------------
`.getLeft()`               | Get the left node or value
`.setLeft(left)`           | Set the left node or value
`.getRight()`              | Get the right node or value
`.setRight(right)`         | Set the right node or value
`.addLeft(left)`           |
`.addRight(right)`         | Helpers, can only be used if the target value is an array, in such case the value `left` or `right` is pushed into it.

SELECT
------

Select query is described by `uql.core.SelectQuery` node and wrapped by `uql.SELECT(...)`. It accepts arguments that are passed to the `FIELD()` method making the  `SELECT(...)`, `SELECT([...])` and `SELECT().FIELD(...)` constructs equivalent.

The `uql.core.SelectQuery` implements the following interface:

uql.core.SelectQuery       | Description
:------------------------- | :------------------------------------
`.FIELD(...)`              |
`.FIELD([...])`            | Add a field or expression to be selected. It accepts a `uql.core.Node`, column name, or a dictionary defining columns and their expressions. <br><br>The `FIELD()` calls are usually chained. For example `FIELD("a").FIELD("b")` calls are the same as `FIELD("a", "b")`, `FIELD(["a", "b"])`, and `FIELD({ a: true, b: true })`
`.DISTINCT(...)`           | Add a `DISTINCT` clause to the query. <br><br>Please note that `DISTINCT(...)` passes all optional arguments to the `FIELD()` method making `SELECT(...).DISTINCT()` and `SELECT().DISTINCT(...)` constructs equivalent
`.FROM(...)`               |
`.FROM([...])`             | Add `FROM` clause to the query. The method accepts multiple arguments or a list of arguments. Most of the time `FROM` is used with a single argument describing the table to select from, however, multiple arguments forming an implicit `CROSS JOIN` construct, which matches the SQL specification, are allowed. <br><br>For example `FROM(a)` construct will generate `SELECT ... FROM "a"` query, while `FROM(a, b)` construct will generate `SELECT ... FROM "a", "b"` or `SELECT ... FROM "a" CROSS JOIN "b"` (these are equivalent, uql.js can generate any of these depending on the version and implementation changes)
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
`.GROUP_BY([...])`         | Add a `GROUP BY` clause to the query. Group by can be specified as a column or a `uql.core.Node`
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

Insert query is described by `uql.core.InsertQuery` node and wrapped by `uql.INSERT(...)`. Note that `INSERT(...)` accepts parameters that can describe a target table and data to be inserted.

The `uql.core.InsertQuery` implements the following interface:

uql.core.InsertQuery       | Description
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
    title: "Try uql.js",
    duration: 5
  })
  .RETURNING("id");
```

yields to:

```sql
INSERT INTO
  "tasks" ("title", "duration")
VALUES
  ('Try uql.js', 5)
RETURNING
  "id";
```

UPDATE
------

Update query is described by `uql.core.UpdateQuery` node and wrapped by `uql.UPDATE(...)`. Please note that `UPDATE(...)` accepts parameters that can describe a target table and data to be updated.

The `uql.core.UpdateQuery` implements the following interface:

uql.core.UpdateQuery       | Description
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

Delete query is described by `uql.core.DeleteQuery` node and wrapped by `uql.DELETE(...)`.

The `uql.core.DeleteQuery` implements the following interface:

uql.core.DeleteQuery       | Description
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

uql.js has a feature called `TypeMapping`, which allows to override a default serialization of data used by `INSERT` and `UPDATE`. The type mapping is an object where a key/value defines a column/data-type pair. It can be set by `setTypeMapping()` and get by `getTypeMapping()` methods of the query object.

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

There is a project called [uql-fiddle](http://kobalicek.com/fiddle-uql.html), which can be used to explore uql.js possibilities by playing with it online. It contains more snippets and tries to teach by examples.

License
-------

uql.js has been released to public domain, [see unlicense.org](http://unlicense.org/).
