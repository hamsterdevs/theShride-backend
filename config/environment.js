const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

module.exports = {
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5174',
  port: Number(process.env.PORT) || 5000,
}