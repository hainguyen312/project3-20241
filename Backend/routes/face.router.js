const express = require('express');
const multer = require('multer');
const router = express.Router();
const faceController = require('../controllers/face.controller');

// Cấu hình multer để lưu file ảnh
const upload = multer({ dest: '../uploads/' });

// Endpoint để nhận diện khuôn mặt
router.post('/analyze', upload.single('image'), faceController.analyzeFace);

module.exports = router;
