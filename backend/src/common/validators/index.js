module.exports = {
  ...require('./object-id-param.validator'),
  ...require('./request-shape.validator'),
  authRequest: require('./auth-request.validator'),
  iamRequest: require('./iam-request.validator'),
};
