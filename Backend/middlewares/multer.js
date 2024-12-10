const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Thư mục lưu ảnh
    },
    filename: (req, file, cb) => {
        const extname = path.extname(file.originalname).toLowerCase(); // Lấy đuôi file
        const filename = `${Date.now()}${extname}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG or PNG is allowed.'), false);
    }
};

module.exports.upload = multer({ 
    storage, 
    fileFilter 
});
