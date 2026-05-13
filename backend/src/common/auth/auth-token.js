const { verifyAccessToken } = require('../../services/auth/token.service');

function extractBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function decodeAndValidateJwt(token) {
  return verifyAccessToken(token);
}

module.exports = {
  decodeAndValidateJwt,
  extractBearerToken,
};
