QSql
====

SQL builder and utilities library designed to work with PostgreSQL.

Official Repository
-------------------

https://github.com/kobalicek/qsql

Disclaimer
----------

This library is unstable and not ready for production.

Introduction
------------

QSql is a library designed to build SQL queries programmatically. It implements SQL expressions as tree structures that are created by using high level API calls, which mimic SQL syntax. Each SQL function creates a node that can be added to another node, the whole node-tree is a SQL query that can be compiled to a single string.

There are several reasons why QSql has been developed:

  1. Full support and focus on PostgreSQL backend
  2. Schema should be optional and not mandatory
  3. Control of SQL parameters and the way they are formatted / escaped
  4. Construction of SQL query doesn't require to write RAW expressions
  5. Ability to queue multiple queries in a single instance of query builder

There are several node.js libraries that focus on SQL query building, but none has satisfied all the needs. Closest library and huge inspiration for QSql is Python's [SqlAlchemy](http://www.sqlalchemy.org), which is much more advanced compared to any node.js SQL framework at the moment. QSql only targets PostgreSQL, which makes the library much simpler and more straightforward (no abstractions and no quirks to support multiple dialects), however it also makes the library a perfect solution for a PostgreSQL based application.

QSql itself is a query builder, it doesn't talk to database. There is another project in preparation that will bridge QSql and node.js PostgreSQL driver.

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
