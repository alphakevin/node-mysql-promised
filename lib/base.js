/**
 * Database abstract model
 * @author alphakevin
 */

var util = require('util');

var mysql = require('mysql');
var validate = require('validate.js');
var _ = require('underscore');
var Promise = require('bluebird');
var DbError = require('./error');

module.exports = BaseModel;

util.inherits(DbError, Error);

/**
 * Database abstract model
 * @constructor
 * @param {mysql} connection Database connection
 * @param {object} options
 */
function BaseModel(connection, options) {
  options = _.defaults(options, {
    pk: 'id',
    constraints: {}
  });
  this.db = connection;
  this.table = options.table;
  this.pk = options.pk;
  this.constraints = options.constraints || {};

  var methods = 'search,find,findByPk,insert,update,replace,delete';
  this.bindCallback(methods);
  methods = 'query,beginTransaction,commit,rollback,changeUser,ping,statistics';
  this.bindPromise(methods);
}

BaseModel.prototype.now = function() {
  return new Date();
};

BaseModel.prototype.destroy = function() {
    this.db.destroy();
};

BaseModel.prototype.pause = function() {
    this.db.pause();
};

BaseModel.prototype.resume = function() {
    this.db.resume();
};

BaseModel.prototype.escape = function(value){
    return this.db.escape(value);
};

BaseModel.prototype.escapeId = function(value){
    return this.db.escapeId(value);
};

BaseModel.prototype.format = function(sql, values){
    return this.db.format(sql, values);
};

/**
 * Promised version of mysql lib
 * @param <array> methods
 */
BaseModel.prototype.bindPromise = function(methods) {
  var self = this;
  if (_.isString(methods)) {
    methods = methods.split(',');
  }
  _.each(methods, function(name){
    self[name] = function(){
      var args = Array.prototype.slice.call(arguments);
      var deferred = Promise.defer();
      var callback = function(err, rows){
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(rows);
        }
      };
      args.push(callback);
      return Promise.resolve().then(function(){
        self.db[name].apply(self.db, args);
        return deferred.promise;
      })
    }.bind(self);
  })
};

/**
 * Add Nodejs style callbacks support to promised method
 * @param <array> methods
 */
BaseModel.prototype.bindCallback = function(methods) {
  var self = this;
  if (_.isString(methods)) {
    methods = methods.split(',');
  }
  _.each(methods, function(name){
    var oldMethod = self[name];
    var newMethod = function() {
      var args = Array.prototype.slice.call(arguments);
      if (_.isFunction(_.last(args))) {
        var cb = args.pop();
      }
      var promise = oldMethod.apply(self, args);
      if (cb) {
        promise.then(function(data) {
          cb(null, data);
          return data;
        }, function(error) {
          cb(error);
        });
      }
      return promise;
    }
    self[name] = newMethod.bind(self);
  });
};

BaseModel.prototype.buildPkCondition = function(data) {
  var condition = {};
  if (_.isArray(this.pk)) {
    if (_.isObject(data)) {
      _.each(this.pk, function(key) {
        if (!data[key]) {
          throw DbError('invalid_call', 'missing "' + key + '" for composite primary key');
        }
        condition[key] = data[key];
      });
    } else if (_.isArray()) {
      _.each(this.pk, function(key, i) {
        if (!data[i]) {
          throw DbError('invalid_call', 'missing "' + key + '" for composite primary key');
        }
        condition[key] = data[i];
      });
    } else {
      throw DbError('invalid_call', 'invalid input for composite primary key');
    }
  } else {
    if (_.isObject(data)) {
      if (_.isUndefined(data[this.pk])) {
        throw new Error('missing primary key');
      }
      condition[this.pk] = data[this.pk];
    } else {
      condition[this.pk] = data;
    }
  }
  return condition;
};

/**
 * Compile conditions
 * @param <string|object> conditions Condition string, array or object
 * @returns <string> Compiled WHERE string
 */
BaseModel.prototype.compileConditions = function(conditions) {
  if (_.isNumber(conditions)
   || (_.isString(conditions) && /^[^\s=<>"]+$/.test(conditions))) {
    var pk = conditions;
    conditions = {};
    conditions[this.pk] = pk;
  } else if (_.isString(conditions) && condition.length > 0) {
    return ' WHERE ' + conditions;
  }
  if (_.isObject(conditions) && !_.isArray(conditions)) {
    if (_.isEmpty(conditions)) {
      return '';
    }
    var arr = [];
    _.each(conditions, function(value, key) {
      arr.push([key, value]);
    });
    conditions = arr;
  }
  var str = '';
  var i = 0;
  _.each(conditions, function(item) {
    var key = item[0];
    var value = item[1];
    var operator = '=';
    var conj = 'AND';
    if (_.isArray(value)) {
      if (value.length == 3) {
        conj = value[2].toUpperCase();
      }
      if (value.length >= 2) {
        operator = value[0].toUpperCase();
        value = value[1];
      } else {
        throw DbError('invalid_param', 'not enough params for condition');
      }
    }
    if (operator == 'LIKE' && !/[%?]/.test(value)) {
      value = '%' + value + '%';
    }
    if (i > 0) {
      str += ' ' + conj + ' ';
    }
    str += '(' + mysql.escapeId(key) + ' ' + operator + ' ' + mysql.escape(value) + ')';
    i++;
  });
  return str ? (' WHERE ' + str) : '';
};

/**
 * Compile Options
 * @param <string|object> options
 *   Example: {limit: [<start>, <limit>], orderBy: 'id ASC'}
 *        or: {start: <start>, limit: <limit>}
 * @returns <string>
 */
BaseModel.prototype.compileOptions = function(options) {
  var str = '';
  if (_.isString(options)) {
    str = options;
  } else if (_.isObject(options)) {
    if (options.orderBy) {
      str += ' ORDER BY ' + options.orderBy;
    }
    if (options.limit) {
      var limit = [];
      if (_.isArray(options.limit)) {
        limit = options.limit;
      } else {
        if (options.start) {
          limit.push(options.start);
        }
        if (options.limit) {
          limit.push(options.limit);
        }
      }
      str += ' LIMIT ' + limit.join(', ');
    }
  }
  return str;
};

BaseModel.prototype.search = function(conditions, options) {
  var sql = "SELECT * FROM ??";
  console.log(conditions, options);
  sql = mysql.format(sql, [this.table]);
  sql += this.compileConditions(conditions);
  sql += this.compileOptions(options);
  console.log(sql);
  return this.query(sql);
};

BaseModel.prototype.find = function(conditions, options) {
  options = options || {};
  options.limit = 1;
  return this.search(conditions, options)
  .then(function(rows) {
    return rows.length == 0 ? null : rows[0];
  });
};

BaseModel.prototype.findByPk = function(conditions, options) {
  return this.find(conditions, options);
};

BaseModel.prototype.findOne = function(field, conditions, options) {
  return this.find(conditions, options)
  .then(function(row){
    if (_.isNull(row)) {
      return undefined;
    } else {
      return row[field];
    }
  })
};

BaseModel.prototype.queryOne = function() {
  var args = Array.prototype.slice.call(arguments);
  console.log(args);
  var sql = args[0];
  if (!/select/i.test(sql)) {
    throw DbError('invalid_call', 'only select allowed: ' + sql);
  }
  return this.query.apply(this, args)
  .then(function(rows){
    if (rows.length == 0) {
      return undefined;
    }
    var row = rows[0];
    var keys = _.keys(row);
    return row[keys[0]];
  });
}

BaseModel.prototype.findAll = function(options) {
  return this.search({}, options);
};

BaseModel.prototype.remove = BaseModel.prototype.delete = function(conditions) {
  var sql = "DELETE FROM ??";
  sql = mysql.format(sql, [this.table]);
  sql += this.compileConditions(conditions)
  return this.query(sql);
};

BaseModel.prototype.validate = function(data, constraints) {
  if (constraints === true) {
    constraints = this.constraints;
  } else {
    var constraints2 = constraints;
    constraints = _.clone(this.constraints);
    _.each(constraints2, function(value, key) {
      _.extend(constraints[key], value);
    });
  }
  return validate(data, constraints);
};

BaseModel.prototype.insert = function(data, constraints) {
  if (constraints) {
    var errors = this.validate(data, constraints);
    if (errors) {
      throw DbError('validition', errors);
    }
  }
  var sql = "INSERT INTO ?? SET ?";
  console.log(data, this.constraints);
  data = _.pick(data, _.keys(this.constraints));
  console.log(data);
  sql = mysql.format(sql, [this.table, data]);
  console.log(sql);
  return this.query(sql);
};

BaseModel.prototype.update = function(conditions, data, constraints) {
  if (constraints) {
    var errors = validate(conditions, constraints);
    if (errors) {
      throw DbError('validition', errors);
    }
  }
  var sql = "UPDATE ?? SET ?";
  data = _.pick(data, _.keys(this.constraints));
  sql = mysql.format(sql, [this.table, data]);
  sql += this.compileConditions(conditions);
  console.log(sql);
  return this.query(sql);
};

BaseModel.prototype.replace = function(data, constraints) {
  var self = this;
  var condition = self.buildPkCondition(data);
  if (_.isUndefined(condition)) {
    throw DbError('invalid_param', 'missing primary key');
  }
  return self.find(condition).then(function(row) {
    if (row) {
      return self.update(condition, data, constraints);
    } else {
      return self.insert(data, constraints);
    }
  });
};
