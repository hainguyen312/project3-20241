const { spawn } = require('child_process');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { FirebaseStorage } = require('../firebase'); 

// Hàm tải ảnh lên Firebase Storage
const uploadImageToFirebase = async (imageBuffer, folder = 'temp') => {
    try {
        const fileName = `${folder}/${uuidv4()}.jpg`;
        const fileRef = FirebaseStorage.bucket().file(fileName);

        await fileRef.save(imageBuffer, {
            metadata: { contentType: 'image/jpeg' }
        });

        // Lấy URL có thể truy cập công khai của file
        const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: '03-09-2099' // Thời gian hết hạn URL
        });

        console.log(`Image uploaded successfully to Firebase at ${url}`);
        return url;
    } catch (error) {
        console.error("Error uploading image to Firebase:", error);
        throw new Error("Failed to upload image to Firebase.");
    }
};

exports.analyzeFace = async (req, res) => {
    const { avatarUrl } = req.body;

    if (!req.file || !avatarUrl) {
        return res.status(400).json({ error: "Both video image file and avatar URL are required." });
    }

    try {
        // Tải ảnh video call từ file và upload lên Firebase
        const videoImageBuffer = req.file.buffer;
        const uploadedImageUrl = await uploadImageToFirebase(videoImageBuffer, 'video-frames');

        // Gọi script Python để phân tích khuôn mặt
        const scriptPath = require('path').join(__dirname, '../deepface_analyze.py');
        const pythonProcess = spawn('python3', [scriptPath, uploadedImageUrl, avatarUrl]);

        let output = "";
        let errorOutput = "";

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    res.json(result);
                } catch (err) {
                    console.error("JSON parsing error:", err);
                    res.status(500).json({ error: "Failed to parse Python output", details: output });
                }
            } else {
                console.error("Python script error:", errorOutput);
                res.status(500).json({ error: "Python script exited with an error", details: errorOutput });
            }
        });

    } catch (error) {
        console.error("Error in analyzeFace controller:", error);
        res.status(500).json({ error: error.message });
    }
};
