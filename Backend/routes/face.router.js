const express = require('express');
const { upload } = require('../middlewares/multer');
const faceController = require('../controllers/face.controller');

const router = express.Router();

router.post('/analyze', upload.single('videoImage'), faceController.analyzeFace);

module.exports = router;
