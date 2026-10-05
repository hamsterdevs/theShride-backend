const crypto = require('crypto')
const db = require('../db')
const { touchSession } = require('../db/sessions')

// async: Postgres is a network call now, not an in-process file like SQLite was.
// Express 5 auto-forwards a rejected promise here to the error handler, so no
// try/catch is needed just for propagation.
async function sessionMiddleware(request, response, next) {
  await db.ready // resolves instantly after the first request of the process's lifetime

  let sessionId = request.get('X-Session-Id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    response.set('X-Session-Id', sessionId)
  }

  await touchSession(sessionId)
  request.sessionId = sessionId
  next()
}

module.exports = sessionMiddleware
