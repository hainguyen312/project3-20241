const { spawn } = require('child_process');
const path = require('path');

exports.analyzeFace = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const imagePath = path.join(__dirname, 'uploads', req.file.filename);
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
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: "Failed to parse Python output" });
            }
        } else {
            res.status(500).json({ error: "Python script exited with an error" });
        }
    });
};
