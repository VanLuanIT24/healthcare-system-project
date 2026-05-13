const Module = require('module');
const path = require('path');

function loadWithStubs(modulePath, stubs = {}) {
  const absolutePath = path.resolve(modulePath);
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[absolutePath];

  try {
    return require(absolutePath);
  } finally {
    Module._load = originalLoad;
  }
}

module.exports = { loadWithStubs };
