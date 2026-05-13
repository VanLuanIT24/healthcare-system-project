const BaseRepository = require('./base.repository');

function createRepository(Model, options = {}) {
  return new BaseRepository(Model, options);
}

function createRepositoryMap(modelMap = {}) {
  return Object.fromEntries(
    Object.entries(modelMap).map(([key, Model]) => [key, createRepository(Model)]),
  );
}

module.exports = {
  createRepository,
  createRepositoryMap,
};
