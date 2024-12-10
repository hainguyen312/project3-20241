const { spawn } = require('child_process');
const path = require('path');

exports.analyzeFace = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const embeddingsFolder = path.join(__dirname, '../embeddings');
    const scriptPath = path.join(__dirname, '../deepface_analyze.py');

    const pythonProcess = spawn('python3', [scriptPath, filePath, embeddingsFolder]);

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
};
