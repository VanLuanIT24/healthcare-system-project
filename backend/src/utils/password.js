const bcrypt = require('bcryptjs');

async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, 12);
}

async function comparePassword(plainTextPassword, hashedPassword) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}

module.exports = {
  hashPassword,
  comparePassword,
};
