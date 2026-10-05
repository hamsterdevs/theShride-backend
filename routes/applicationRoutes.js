const express = require('express')
const { draftApplication, sendApplication } = require('../controllers/applicationController')

const router = express.Router()

router.post('/draft', draftApplication)
router.post('/send', sendApplication)

module.exports = router
