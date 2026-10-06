const express = require('express')
const { joinWaitlist, exportSignups } = require('../controllers/waitlistController')

const router = express.Router()

router.post('/', joinWaitlist)
router.get('/export', exportSignups)

module.exports = router