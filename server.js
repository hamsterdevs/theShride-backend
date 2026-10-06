const cors = require('cors')
const express = require('express')
const { corsOptions } = require('./config/cors')
const { port } = require('./config/environment')
const errorHandler = require('./config/errorHandler')
const openApiSpec = require('./config/openapi.json')
const sessionMiddleware = require('./middleware/session')
const applicationRoutes = require('./routes/applicationRoutes')
const applyRoutes = require('./routes/applyRoutes')
const authRoutes = require('./routes/authRoutes')
const jobRoutes = require('./routes/jobRoutes')
const resumeRoutes = require('./routes/resumeRoutes')
const sessionRoutes = require('./routes/sessionRoutes')
const waitlistRoutes = require('./routes/waitlistRoutes')

const app = express()

// 1. Request Diagnostic Logger (Must be at the very top)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Origin: ${req.headers.origin || 'No Origin (Postman/Curl)'}`)
  next()
})

app.use(cors(corsOptions))
app.use(express.json())
app.options(/.*/, cors(corsOptions))

// Guest-session identity: every request after this point has req.sessionId,
// either the one the client sent via X-Session-Id or one minted just now.
app.use(sessionMiddleware)

app.get('/openapi.json', (request, response) => {
  response.json(openApiSpec)
})

app.use('/docs', async (request, response, next) => {
  try {
    const { apiReference } = await import('@scalar/express-api-reference')
    return apiReference({
      spec: { content: openApiSpec },
      theme: 'purple',
    })(request, response, next)
  } catch (error) {
    return next(error)
  }
})

app.get('/api/health', (request, response) => {
  response.status(200).json({ status: 'ok', service: 'jobapply-api' })
})

app.use('/api/auth', authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/apply', applyRoutes)
app.use('/api/session', sessionRoutes)
app.use('/api/waitlist', waitlistRoutes)

// 2. Catch-all 404 Route Logger
app.use((req, res) => {
  console.warn(`[404 NOT FOUND] ${req.method} ${req.url}`)
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found.` })
})

app.use(errorHandler)

if (require.main === module) {
  app.listen(port, () => {
    console.log(`JobApply API listening on http://localhost:${port}`)
    console.log(`API Docs available at http://localhost:${port}/docs`)
  })
}

module.exports = app