const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/

const corsOptions = {
  origin(origin, callback) {
    if (!origin || localOriginPattern.test(origin)) return callback(null, true)
    return callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  exposedHeaders: ['X-Session-Id'],
}

function applyErrorCorsHeaders(request, response) {
  const origin = request.get('origin')
  if (!origin) return
  response.set('Access-Control-Allow-Origin', origin)
  response.set('Access-Control-Allow-Credentials', 'true')
  response.set('Vary', 'Origin')
}

module.exports = { applyErrorCorsHeaders, corsOptions }