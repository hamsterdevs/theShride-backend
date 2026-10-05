const express = require('express')
const { parseJob } = require('../controllers/jobController')

const router = express.Router()

router.post('/parse', parseJob)

module.exports = router
