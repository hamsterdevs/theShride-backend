const multer = require('multer')
const { applyErrorCorsHeaders } = require('./cors')

function errorHandler(error, request, response, next) {
  applyErrorCorsHeaders(request, response)

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'Resume file must be 10 MB or smaller.' })
  }

  const status = error.status || 500
  console.error(`[api] ${error.message}`)
  const message = status === 500 ? 'The request could not be completed.' : error.message
  return response.status(status).json({ error: message })
}

module.exports = errorHandler