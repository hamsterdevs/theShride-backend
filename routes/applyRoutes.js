const express = require('express')
const { generateAndApply } = require('../controllers/applyController')

const router = express.Router()

router.post('/', generateAndApply)

module.exports = router