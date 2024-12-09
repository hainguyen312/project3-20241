const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs'); // Đảm bảo rằng bạn đã require fs

// Đảm bảo rằng thư mục uploads tồn tại
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
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

    const pythonProcess = spawn('python3', [scriptPath, imagePath]);

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
                res.json(result); // Trả về dữ liệu khuôn mặt đã nhận diện
            } catch (err) {
                res.status(500).json({ error: "Failed to parse Python output" });
            }
        } else {
            res.status(500).json({ error: "Python script exited with an error" });
        }
    });
};
