const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Đảm bảo rằng thư mục uploads và thư mục chứa embeddings mẫu tồn tại
const uploadsDir = path.join(__dirname, 'uploads');
const embeddingsDir = path.join(__dirname, 'embeddings');  // Đảm bảo có thư mục này để lưu embeddings mẫu

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(embeddingsDir)) {
    fs.mkdirSync(embeddingsDir);
}

exports.analyzeFace = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    // Kiểm tra xem tệp có tồn tại trong thư mục uploads không
    const imagePath = path.join(uploadsDir, req.file.filename);
    
    if (!fs.existsSync(imagePath)) {
        return res.status(400).json({ error: "File does not exist" });
    }

    const scriptPath = path.join(__dirname, 'deepface_analyze.py');

    // Chạy Python script và truyền đường dẫn đến ảnh và thư mục embeddings
    const pythonProcess = spawn('python3', [scriptPath, imagePath, embeddingsDir]);

    let output = "";
    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            try {
                const result = JSON.parse(output);
                res.json(result); // Trả về kết quả nhận diện khuôn mặt
            } catch (err) {
                res.status(500).json({ error: "Failed to parse Python output" });
            }
        } else {
            res.status(500).json({ error: "Python script exited with an error" });
        }
    });
};
