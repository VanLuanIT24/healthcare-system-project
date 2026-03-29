function successResponse(res, { statusCode = 200, message, data = {} }) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function errorResponse(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    message: error.message || 'Có lỗi xảy ra.',
  });
}

module.exports = {
  successResponse,
  errorResponse,
};
