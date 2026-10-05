const express = require('express')
const { getAuthUrl, handleCallback } = require('../controllers/authController')

const router = express.Router()

router.get('/google/url', getAuthUrl)
router.get('/google/callback', handleCallback)

module.exports = router