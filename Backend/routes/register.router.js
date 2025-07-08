const express = require('express');
const router = express.Router();
const registerController = require('../controllers/register.controller');
const { upload } = require('../middlewares/multer');

router.post('/', upload.single('faceImage'), registerController.handleRegister);

module.exports = router;
