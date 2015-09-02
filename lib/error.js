/**
 * Database error
 * @author alphakevin
 */

var util = require('util');

module.exports = DbError;

function DbError(message, description) {
  if (this.constructor !== DbError) {
    return new DbError(message, description);
  }
  Error.call(this);
  this.constructor = DbError;
  this.message = message;
  this.description = description;
}

util.inherits(DbError, Error);
