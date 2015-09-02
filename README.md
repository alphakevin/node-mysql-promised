# mysql-promised

Promised warp for [felixge/node-mysql](https://github.com/felixge/node-mysql)
using bluebird

## Install

```sh
$ npm install mysql-promised
```

## TODO

  * Add test scripts.
  * Provide utils for createConnection etc.

## Usage

Suppose we have this table in mysql database:

```sql
CREATE TABLE IF NOT EXISTS `user` (
  `id` int(10) unsigned NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(40) NOT NULL,
  `email` varchar(50) DEFAULT NULL,
  `language` varchar(5) DEFAULT 'en'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

Now we create a model for table `user`

```js
var Base = require('node-mysql-promised');
var mysql = require('mysql');

var connection = mysql.createConnection(...);
var user = new Base(connection, {
  pk: 'id',       // required
  table: 'user',  // required
  constraints: {
    username: {format: /[A-Za-z0-9\-]+/,length: {maximum: 50}},
    password: {length: {maximum: 40}},
    email: {email: true},
    language: {format: /[a-z]{2}(-[A-Z]{2})?/}
  } // see validate.js
});
```

## Class Methods

### query()

`model.query(sql, params)`

This method is the same as connection.query, except it returns a promise:

```js
user.query('select * from ?', [user.table])
.then(function(rows){
  console.log(rows);
})
.catch(function(err){
  //handle error
});
```

You can use original node style callback as you like:

```js
user.query('select * from ?', [user.talbe], function(err, rows) {
  //handle error
  console.log(rows);
});
```

### search()

`model.search(condition, options)`

Search table by condition

```js
user.search({username: 'king'})
.then(...);
```

### find()

Same as `search()` except it will only return the first row.

`model.find(condition, options)`

### findOne()

Find a row and returns only the `field` column

`model.findOne(field, condition, options)`

### insert()

`model.insert(data)`

### update()

`model.update(condition, data, constraints)`

### replace()

Update a row when it exists and insert a row when it does not.

`replace(data, constraints)`

### remove()

Remove a row (rows);

`model.remove(condition)`

### delete()

Alias to `remove()`

## Query Conditions

In method such as `search()`, `update()`, `delete()`, condition param can be:

An `object` which key-value pairs are translate into SQL condition

```js
{username:'user1',password:'123456'}
```
==>

```sql
WHERE `username` = 'user1' AND `password` = '123456'
```

Or an `array` which sub-array are translate into SQL condition

```js
[
  ['username', ['LIKE', 'super%']],
  ['username', ['LIKE', 'spider', 'OR']]
]
```

==>

```sql
WHERE `username` LIKE 'super%' OR `username` LIKE '%spider%'
```

Or just single `string` or `int` which indicates it is primary key

```js
12
```

==>

```sql
WHERE `id` = 12
```

## Query Options

A `string` or `object` provides additional options for query.

When this option is a `string`, it will directly added to SQL.

```js
{
  orderBy: '`add_time` DESC'
  limit: 10,
  start: 50
}
```

==>

```sql
ORDER BY `add_time` DESC LIMIT 50, 10
```
