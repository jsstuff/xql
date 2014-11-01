QSql
====

SQL builder and utilities library designed to work with Node.js and PostgreSQL, [try it online](http://kobalicek.com/qsql-interactive.html).

  * [Official Repository (jshq/qsql)](https://github.com/jshq/qsql)
  * [Unlicense] (http://unlicense.org)


Disclaimer
----------

This library is used in production, but is not 100% complete. It has been designed for PostgreSQL, but there are plans to include other DB dialects and WebSQL. Use at your own risk and be prepared for some minor API changes in the future.


Introduction
------------

QSql is a library designed to build SQL queries programmatically. It implements SQL syntax tree that can be created by using high level API calls which mimic SQL syntax. Each SQL function creates a `Node` that can be added to another `Node`, the whole node-tree is a SQL query that can be compiled into a string. The library has been designed to be used in DAO/DB layers of applications.

There are several reasons why QSql has been developed:

  1. Full support and focus on PostgreSQL backend (at the moment)
  2. High performance and low memory footprint
  3. Schema should be optional and not mandatory
  4. Control of SQL parameters and the way they are formatted / escaped
  5. Construction of SQL query doesn't require writing RAW expressions, but it should be easy to use RAW expressions in case they are needed
  6. Ability to queue multiple queries in a single instance of a query builder

There are several node.js libraries that focus on SQL query building, but none has satisfied all the needs. The closest library and huge inspiration for QSql is Python's [SqlAlchemy](http://www.sqlalchemy.org), which is much more advanced compared to any node.js SQL framework at the moment. QSql is just a query builder and will stay just a query builder - it has a very minimal support for schemas that can be used to describe column types for serialization, but tjey are not used to describe anything else. QSql is not an ORM and this functionality is not planned for any QSql release.

QSql itself is just a query builder, it doesn't talk to a database. There is another project in preparation that will bridge QSql and node.js SQL drivers, but since there are many libraries that can be used (including libraries for SQL connection pooling) there was no work done to create another library for this purpose.

QSql has been initially designed to work with PostgreSQL, but the project will be extended to support also other database engines; it's planned.


Overview
--------

QSql library is structured as follows:

  - `qsql` - Main API and high-level SQL builder interface (both uppercased and lowercased).
  - `qsql.core` - SQL expression tree; contains `qsql.Node` and classes that inherit from it.
  - `qsql.util` - SQL utilities used by QSql made public.

QSql contains the following Error classes:

  - `qsql.ValueError` - Error thrown if data is wrong.
  - `qsql.CompileError` - Error thrown if query is wrong.

QSql contains the following SQL nodes (low-level):

  - `qsql.core.Node` - Base node, all SQL nodes inherit from it, it's safe to use `instanceof` operator to check whether any object is a `qsql.Node`.
  - `qsql.core.Raw` - Raw SQL expression.
  - `qsql.core.Unary` - Unary SQL node (can contain a single child).
  - `qsql.core.Binary` - Binary SQL node (can contain two children, left and right).
  - `qsql.core.Operator` - SQL operator, like `=`, `+`, `-`, etc...
  - `qsql.core.Group` - Group of SQL nodes.
  - `qsql.core.Logical` - Logical operator (Group), like `AND`, `OR`, etc...
  - `qsql.core.ObjectOp` - Special QSql node that contains key/value interface that can be used to construct `WHERE` like expressions.
  - `qsql.core.Identifier` - SQL identifier, like table or column.
  - `qsql.core.Join` - SQL `JOIN` construct.
  - `qsql.core.Sort` - SQL `ORDER BY` construct.
  - `qsql.core.Func` - SQL function expression.
  - `qsql.core.Aggregate` - SQL aggregate expression.
  - `qsql.core.Value` - SQL value base class.
  - `qsql.core.PrimitiveValue` - Primitive value like `NULL`, boolean, number, or string.
  - `qsql.core.ArrayValue` - Array value (can serialize as JSON or ARRAY).
  - `qsql.core.JsonValue` - JSON value (can serialize as JSON or STRING).
  - `qsql.core.Query` - SQL query base class.
  - `qsql.core.SelectQuery` - SQL `SELECT` query.
  - `qsql.core.InsertQuery` - SQL `INSERT` query.
  - `qsql.core.UpdateQuery` - SQL `UPDATE` query.
  - `qsql.core.DeleteQuery` - SQL `DELETE` query.
  - `qsql.core.CombinedQuery` - SQL `UNION`, `INTERSECT`, and `EXCEPT` operators that can be used to combine multiple queries.

QSql contains the following SQL builder concepts (high-level)

  - `qsql.SELECT(...)` - Create a `qsql.core.SelectQuery` node and pass optional arguments to the `SelectQuery.FIELD(...)` method. 
  - `qsql.INSERT(...)` - Create a `qsql.core.InsertQuery` node and use an optional first argument as a table name (`FROM` clause) if it's a string or an identifier, and pass all other arguments to `SelectQuery.FIELD(...)` method.
  - `qsql.UPDATE(...)` - Create a `qsql.core.UpdateQuery` node and use an optional first argument as a table name (`UPDATE ...` clause) if it's a string or an identifier, and pass all other arguments to `UpdateQuery.FIELD(...)` method.
  - `qsql.DELETE(...)` - Create a `qsql.core.DeleteQuery` node and use an optional first argument as a table name.

  - `qsql.EXCEPT(...)` - Create a `qsql.core.CombinedQuery` describing `EXCEPT` expression.
  - `qsql.EXCEPT_ALL(...)` - Create a `qsql.core.CombinedQuery` describing `EXCEPT ALL` query.

  - `qsql.INTERSECT(...)` - Create a `qsql.core.CombinedQuery` describing `INTERSECT` query.
  - `qsql.INTERSECT_ALL(...)` - Create a `qsql.core.CombinedQuery` describing `INTERSECT ALL` query.

  - `qsql.UNION(...)` - Create a `qsql.core.CombinedQuery` describing `UNION` query.
  - `qsql.UNION_ALL(...)` - Create a `qsql.core.CombinedQuery` describing `UNION ALL` query.

  - `qsql.SORT(column, direction, nulls)` - Create a `qsql.core.Sort` node wrapping an `ORDER BY` clause.
  - `qsql.RAW(string, bindings)` - Create a RAW query `qsql.core.Raw` node based on query `string` and optional `bindings`.

  - `qsql.AND(...)` - Create a `qsql.core.Logical` expression describing `AND` expression.
  - `qsql.OR(...)` - Create a `qsql.core.Logical` expression describing `OR` expression.

  - `qsql.COL(...)` - Create a `qsql.core.Identifier` wrapping a column name (in a format `"column"` or `"table"."column"` or `"namespace"."table"."column"`.
  - `qsql.VAL(...)` - Create a `qsql.core.PrimitiveValue` wrapping a primitive value like null, boolean, number, or string. 
  - `qsql.ARRAY_VAL(...)` - Create a `qsql.core.ArrayValue` wrapping an array. 
  - `qsql.JSON_VAL(...)` - Create a `qsql.core.ArrayValue` wrapping an object (JSON).

  - `qsql.OP(...)` - Create a `qsql.core.Unary` or `qsql.core.Binary` node depending on the count of parameters. The most used form is a 3 operand form, which is used to desctibe a binary expression. For example `qsql.OP(qsql.COL("salary"), "+", 500).AS("estimatedSalary")` can be used to describe `+` operator. Please note that `AND` and `OR` operators should always use `qsql.core.Logical` as QSql can construct queries containing multiple `AND` and `OR` leaves.

  - `qsql.EQ(a, b)` - Create a `qsql.core.Binary` describing `a = b` expression.
  - `qsql.NE(a, b)` - Create a `qsql.core.Binary` describing `a <> b` expression.
  - `qsql.LT(a, b)` - Create a `qsql.core.Binary` describing `a < b` expression.
  - `qsql.LE(a, b)` - Create a `qsql.core.Binary` describing `a <= b` expression.
  - `qsql.GT(a, b)` - Create a `qsql.core.Binary` describing `a > b` expression.
  - `qsql.GE(a, b)` - Create a `qsql.core.Binary` describing `a >= b` expression.

  - `qsql.FUNCTION_OR_AGGREGATE(...)` - Create a `qsql.core.Func` node describing `FUNCTION_OR_AGGREGATE(...)` expression. Note that `FUNCTION_OR_AGGREGATE` has to be replaced by the name of the function to be used, for example `qsql.SIN(...)` describes `SIN()` function and `qsql.COUNT(...)` describes `COUNT()` aggregate function.


Generic Interface
-----------------

Since every node that is used to describe various constructs inherits directly or indirectly from `qsql.core.Node` all nodes share a common interface.

  - `getType()`, `setType(type)` - Get/Set a type (string) of the node. For example a `qsql.core.SelectQuery` is `SELECT` type, logical operator is `AND` or `OR`, etc...
  - `getLabel()`, `setLabel(label)` - Get/Set a label, `AS "label"` clause of the query.

  - `canExecute()` - Can be used to check whether the node can be executed by SQL engine. Only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries and `UNION`, `INTERSECT`, and `EXCEPT` operators can be executed.

  - `compileNode(ctx)` - Compile the node into a string. The `ctx` argument is currently not used, but it's designed in a way to pass an additional information to the compiler so multiple dialects can be used in the future.

  - `compileQuery(ctx?)` - Compile the query, it's basically a `compileNode()` call with semicolon `";"` at the end. 

  - `AS(label)` - alias to `setLabel()`.

  - `EQ(b)` - Returns `this = b` expression.
  - `NE(b)` - Returns `this <> b` expression.
  - `LT(b)` - Returns `this < b` expression.
  - `LE(b)` - Returns `this <= b` expression.
  - `GT(b)` - Returns `this > b` expression.
  - `GE(b)` - Returns `this >= b` expression.
  - `IN(b)` - Returns `this IN b` expression.

For example `COL("a").EQ(1)` yields the same tree as `OP(COL("a"), "=", 1)`

The `qsql.core.Unary` interface:

  - `getValue()`, `setValue(value)` - Get/Set the only child of the node (can be value or another node).

The `qsql.core.Binary` interface:

  - `getLeft()`, `setLeft(left)` - Get/Set the left child of the node (can be value or another node).
  - `getRight()`, `setRight(right)` - Get/Set the right child of the node (can be value or another node).
  - `addLeft(left)`, `addRight(right)` - Helpers, can only be used if the target value is an array, in such case the value `left` or `right` is pushed into it.


SELECT
------

Select query is described by `qsql.core.SelectQuery` node and wrapped by `qsql.SELECT(...)`. It accepts arguments that are passed to the `FIELD()` method making the  `SELECT(...)`, SELECT([...])` and `SELECT().FIELD(...)` constructs equivalent.

The `qsql.core.SelectQuery` implements the following interface:

  - `FIELD(...)`, `FIELD([...])` - Add a field or expression to be selected. It accepts a `qsql.core.Node`, column name, or a dictionary defining columns and their expressions. The `FIELD()` calls are usually chained. For example `FIELD("a").FIELD("b")` calls are the same as `FIELD("a", "b")`, `FIELD(["a", "b"])`, and `FIELD({ a: true, b: true })`.

  - `DISTINCT(...)` - Add a `DISTINCT` clause to the query. Note that `DISTINCT(...)` passed optional arguments to the `FIELD()` method, making `SELECT(...).DISTINCT()` and `SELECT().DISTINCT(...)` constructs equivalent.

  - `FROM(...)`, `FROM([...])` - Add `FROM` clause to the query. The method accepts multiple arguments or a list of arguments. Most of the time `FROM` is used with a single argument describing the table to select from, however, multiple arguments forming an implicit `CROSS JOIN` construct are allowed. For example `FROM(a)` construct will generate `SELECT ... FROM "a"` query, while `FROM(a, b)` construct will generate `SELECT ... FROM "a", "b"` or `SELECT ... FROM "a" CROSS JOIN "b"` (these are equivalent, QSql can generate any of these depending on QSql version and implementation changes).

  - `CROSS_JOIN(with_, condition)`, `INNER_JOIN(...)`, `LEFT_JOIN(...)`, `RIGHT_JOIN(...)`, `FULL_JOIN(...)` - Add a `JOIN` clause to the query. Joins always join the current query with a new table. For example `FROM("a").INNER_JOIN("b").LEFT_JOIN("c")` construct will generate `SELECT ... FROM "a" INNER JOIN "b" LEFT OUTER JOIN "c"` query.

  - `WHERE(node)`, `WHERE(a, b)`, `WHERE(a, op, b)` - Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `AND`ed with other `WHERE` clauses if present).
  - `OR_WHERE(node)`, `OR_WHERE(a, b)`, `OR_WHERE(a, op, b)` - Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `OR`ed with other `WHERE` clauses if present).

  - `GROUP_BY(...)`, `GROUP_BY([...])` - Add a `GROUP BY` clause to the query. Group by can be specified as a column or a `qsql.core.Node`.
  - `HAVING(node)`, `HAVING(a, b)`, `HAVING(a, op, b)` - Add a `HAVING` clause `node`, `HAVING a = b`, or `HAVING a op b` to the query (implicitly `AND`ed with other `HAVING` clauses if present).
  - `OR_HAVING(node)`, `OR_HAVING(a, b)`, `OR_HAVING(a, op, b)` - Add a `HAVING` clause `node`, `HAVING a = b`, or `HAVING a op b` to the query (implicitly `OR`ed with other `HAVING` clauses if present).

  - `ORDER_BY(column(s), direction, nulls)` - Add an `ORDER BY` expression of the form `"column" [ASC|DESC] [NULLS FIRST|LAST]`. If `column` is an array the builder will insert multiple sort clauses with the same `direction` and `nulls` order.
  
  - `OFFSET(offset)` - Add an `OFFSET` clause to the query.
  - `LIMIT(limit)` - Add a `LIMIT` clause to the query.

Sample SQL selects:

  - `SELECT(["id", "name"]).FROM("users")` -> `SELECT "id", "name" FROM "users"`.
  - `SELECT().FIELD("id").FIELD("name").FROM("users")` -> `SELECT "id", "name" FROM "users"`.
  - `SELECT([COL("id").AS("userId"), "name"]).FROM("users")` -> `SELECT "id" AS "userId", "name" FROM "users"`.
  - `SELECT().DISTINCT(["a", "b", "c"]).FROM("x").WHERE("a", "<>", 42)` -> `SELECT DISTINCT "a", "b", "c" FROM "x" WHERE "a" <> 42`.

Complex SQL selects are possible by combining various SQL expressions:

```[JS]
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

```SQL
SELECT
  "name",
  (SELECT MAX("pop") FROM "cities" WHERE "cities"."state" = "states"."name")
FROM 
  "states";
```


INSERT
------

Insert query is described by `qsql.core.InsertQuery` node and wrapped by `qsql.INSERT(...)`. Note that `INSERT(...)` accepts parameters that can describe a target table and data to be inserted.

The `qsql.core.InsertQuery` implements the following interface:

  - `TABLE(table)`, `INTO(table)` - Specify a target `table`.
  - `VALUES(data)` - Specify a data to be inserted. The `data` argument can be both array or object. If an array is passed each element describes one row (it has to be array of objects), of an object is passed, it describes only one row. If `VALUES()` is called multiple times it pushes more rows to be inserted by the query. 
  - `RETURNING(...)` - Specify a `RETURNING` clause, uses the same syntax as `SELECT()`.

Sample SQL insert:

```JS
// INSERT("tasks", {...}).RETURNING(...) would also work.
var query = INSERT()
  .INTO("tasks")
  .VALUES({
    title: "Try QSql,
    duration: 5
  })
  .RETURNING("id");
```

yields to:

```SQL
INSERT INTO
  "tasks" ("title", "duration")
VALUES
  ('Try QSql', 5)
RETURNING
  "id";
```


UPDATE
------

Insert query is described by `qsql.core.UpdateQuery` node and wrapped by `qsql.UPDATE(...)`. Note that `UPDATE(...)` accepts parameters that can describe a target table and data to be updated.

The `qsql.core.UpdateQuery` implements the following interface:

  - `TABLE(table)` - Specify a target `table`.
  - `FROM(...)` - Specify a `FROM` clause, uses the same syntax as `FROM()` defined by `SELECT` query.

  - `WHERE(node)`, `WHERE(a, b)`, `WHERE(a, op, b)` - Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `AND`ed with other `WHERE` clauses if present).
  - `OR_WHERE(node)`, `OR_WHERE(a, b)`, `OR_WHERE(a, op, b)` - Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `OR`ed with other `WHERE` clauses if present).

  - `RETURNING(...)` - Specify a `RETURNING` clause, uses the same syntax as `FIELD()` defined by `SELECT` query.

Sample SQL update:

```JS
var query = UPDATE("users")
  .VALUES({
    address: "Friedrichstrasse 50, Berlin",
    addressChanged: OP(COL("addressChanged"), "+", 1)
  })
  .WHERE("userId", "=", 1);
```

yields to:

```SQL
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

Delete query is described by `qsql.core.DeleteQuery` node and wrapped by `qsql.DELETE(...)`.

The `qsql.core.DeleteQuery` implements the following interface:

  - `TABLE(table)`, `FROM(table)` - Specify a target `table`.
  - `USING(...)` - Specify a `USING` clause, uses the same syntax as `FROM()` defined by `SELECT` query.

  - `WHERE(node)`, `WHERE(a, b)`, `WHERE(a, op, b)` - Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `AND`ed with other `WHERE` clauses if present).
  - `OR_WHERE(node)`, `OR_WHERE(a, b)`, `OR_WHERE(a, op, b)` - Add a `WHERE` clause `node`, `WHERE a = b`, or `WHERE a op b` to the query (implicitly `OR`ed with other `WHERE` clauses if present).

  - `RETURNING(...)` - Specify a `RETURNING` clause, uses the same syntax as `FIELD()` defined by `SELECT` query.

Sample SQL delete:

```JS
var query = DELETE().FROM("tasks").WHERE("completed", "=", true)
```

yields to:

```SQL
DELETE FROM "tasks" WHERE "completed" = TRUE;
```


Type Mapping
------------

QSql has a feature called `TypeMapping`, which allows to override a default serialization of data used by `INSERT` and `UPDATE`. The type mapping is an object where a key/value defines a column/data-type pair. It can be set by `setTypeMapping()` and get by `getTypeMapping()` methods of the query object.

The following example illustrates how type mapping may affect data serialization:

```JS
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

```SQL
UPDATE
  "users"
SET 
  "tagsArray" = ARRAY['accounting', 'customer support'], -- Using PG ARRAY syntax.
  "tagsJson" = '["accounting", "customer support"]'      -- Using PG JSON syntax.
WHERE 
  "userId" = 1;
```


More QSql Samples
-----------------

There is a project called [QSql-Interactive](http://kobalicek.com/qsql-interactive.html), which can be used to explore QSql possibilities by playing with it online. It contains more snippets and tries to teach by examples.
