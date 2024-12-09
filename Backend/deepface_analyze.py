# deepface_analyze.py
import sys
from deepface import DeepFace
import json

image_path = sys.argv[1]

# Analyze the image
try:
    analysis = DeepFace.analyze(image_path, actions=['emotion', 'age', 'gender', 'race'])
    print(json.dumps(analysis))  # Return the analysis as JSON
except Exception as e:
    print(json.dumps({"error": str(e)}))  # In case of error, return the error
