const express = require('express')
const { getCurrentSession } = require('../controllers/sessionController')

const router = express.Router()

router.get('/', getCurrentSession)

module.exports = router
