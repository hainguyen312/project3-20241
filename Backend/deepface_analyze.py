import sys
import json
from deepface import DeepFace
import numpy as np
import os

# Lấy đường dẫn đến ảnh và thư mục lưu embeddings
image_path = sys.argv[1]
embeddings_folder = sys.argv[2]

# Hàm tính toán cosine similarity giữa 2 embeddings
def cosine_similarity(embedding1, embedding2):
    return np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))

# Trích xuất embeddings từ thư mục
def load_embeddings(embedding_folder):
    embeddings = []
    if not os.path.exists(embedding_folder):
        raise FileNotFoundError(f"Embeddings folder {embedding_folder} not found.")
    
    for filename in os.listdir(embedding_folder):
        if filename.endswith(".embedding"):
            with open(os.path.join(embedding_folder, filename), "rb") as f:
                embeddings.append(np.frombuffer(f.read(), dtype=np.float32))
    return embeddings

# Hàm chuyển đổi tất cả numpy.float32 sang float
def convert_to_serializable(data):
    if isinstance(data, dict):
        return {key: convert_to_serializable(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [convert_to_serializable(item) for item in data]
    elif isinstance(data, np.float32):
        return float(data)
    else:
        return data

# Hàm chính để nhận diện khuôn mặt
def recognize_face(image_path, embeddings_folder):
    try:
        if not os.path.exists(image_path):
            return {"error": f"Image file {image_path} not found."}
        
        # Trích xuất embedding từ ảnh upload
        analysis = DeepFace.represent(image_path, model_name="VGG-Face", enforce_detection=False)
        detected_embedding = analysis[0]['embedding']
        detected_embedding = [float(i) for i in detected_embedding]

        # Phân tích các đặc điểm khuôn mặt
        face_analysis = DeepFace.analyze(image_path, actions=['age', 'gender', 'race', 'emotion'], enforce_detection=False)

        # Chuyển đổi các giá trị không serializable
        face_analysis = convert_to_serializable(face_analysis)

        # Load embeddings mẫu
        embeddings = load_embeddings(embeddings_folder)

        # So sánh với embeddings của người A
        for personA_embedding in embeddings:
            similarity = cosine_similarity(detected_embedding, personA_embedding)
            if similarity > 0.7:  # Ngưỡng tương đồng
                return {
                    "recognized": True,
                    "similarity": similarity,
                    "details": {
                        "age": face_analysis[0]['age'],
                        "gender": face_analysis[0]['gender'],
                        "race": face_analysis[0]['dominant_race'],
                        "emotion": face_analysis[0]['dominant_emotion']
                    }
                }
        
        return {
            "recognized": False,
            "similarity": similarity,
            "details": {
                "age": face_analysis[0]['age'],
                "gender": face_analysis[0]['gender'],
                "race": face_analysis[0]['dominant_race'],
                "emotion": face_analysis[0]['dominant_emotion']
            }
        }
    except Exception as e:
        return {"error": str(e)}

# Gọi hàm nhận diện và in kết quả
result = recognize_face(image_path, embeddings_folder)
print(json.dumps(result))
