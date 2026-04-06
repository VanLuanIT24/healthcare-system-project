const { verifyAccessToken } = require('./tokens');

function extractBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function decodeAndValidateJwt(token) {
  const payload = verifyAccessToken(token);

  if (!payload || payload.actor_type !== 'staff' && payload.actor_type !== 'patient') {
    const error = new Error('Token truy cập không hợp lệ.');
    error.statusCode = 401;
    throw error;
  }

  return payload;
}

module.exports = {
  extractBearerToken,
  decodeAndValidateJwt,
};
