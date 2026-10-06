const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

module.exports = {
  clientOrigin: process.env.CLIENT_ORIGIN || 'https://the-shride.vercel.app',
  port: Number(process.env.PORT) || 5000,
}