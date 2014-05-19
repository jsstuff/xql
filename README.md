QSql
====

SQL builder and utilities library designed to work with Node.js and PostgreSQL, [try it online](http://kobalicek.com/qsql-interactive.html).

Official Repository
-------------------

https://github.com/kobalicek/qsql

Disclaimer
----------

This library is unstable and not ready for production.

Introduction
------------

QSql is a library designed to build SQL queries programmatically. It implements SQL syntax tree that can be created by using high level API calls which mimic SQL syntax. Each SQL function creates a `Node` that can be added to another `Node`, the whole node-tree is a SQL query that can be compiled into a string. The library has been designed to be used in DAO layer of an application.

There are several reasons why QSql has been developed:

  1. Full support and focus on PostgreSQL backend (at the moment)
  2. High performance and low memory footprint
  3. Schema should be optional and not mandatory
  4. Control of SQL parameters and the way they are formatted / escaped
  5. Construction of SQL query doesn't require writing RAW expressions
  6. Ability to queue multiple queries in a single instance of query builder

There are several node.js libraries that focus on SQL query building, but none has satisfied all the needs. Closest library and huge inspiration for QSql is Python's [SqlAlchemy](http://www.sqlalchemy.org), which is much more advanced compared to any node.js SQL framework at the moment. QSql only targets PostgreSQL, which makes the library simple and straightforward. QSql is a perfect solution for a PostgreSQL based application.

QSql itself is just a query builder, it doesn't talk to database. There is another project in preparation that will bridge QSql and node.js PostgreSQL driver.

QSql has been initially designed to work with PostgreSQL, but the project will be extended to support also other database engines.

Basics
------

TO BE DOCUMENTED

Select
------

TO BE DOCUMENTED

Insert
------

TO BE DOCUMENTED

Update
------

TO BE DOCUMENTED

Remove
------

TO BE DOCUMENTED

License
-------

QSql follows `Unlicense`.
