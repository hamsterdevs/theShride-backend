const express = require('express')
const multer = require('multer')
const { parseResume } = require('../controllers/resumeController')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) return callback(null, true)
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.originalname)) return callback(null, true)
    const error = new Error('Only PDF and DOCX resumes are supported by this endpoint.')
    error.status = 415
    return callback(error)
  },
})

router.post('/parse', upload.single('resume'), parseResume)

module.exports = router