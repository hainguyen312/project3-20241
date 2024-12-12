import sys
import json
from deepface import DeepFace
import numpy as np
import os
import requests
from PIL import Image
from io import BytesIO

os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

# Hàm tính toán cosine similarity giữa 2 embeddings
def cosine_similarity(embedding1, embedding2):
    return np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))

# Hàm chuyển đổi tất cả numpy.float32 sang float
def convert_to_serializable(data):
    if isinstance(data, dict):
        return {key: convert_to_serializable(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [convert_to_serializable(item) for item in data]
    elif isinstance(data, np.ndarray):  # Chuyển numpy array sang list
        return data.tolist()
    elif isinstance(data, (np.float32, np.float64)):  # Chuyển numpy float sang float Python
        return float(data)
    elif isinstance(data, (np.int32, np.int64)):  # Chuyển numpy int sang int Python
        return int(data)
    elif isinstance(data, (np.bool_, bool)):  # Chuyển numpy bool sang bool Python
        return bool(data)
    else:
        return data

# Hàm tải ảnh từ URL hoặc đường dẫn file
def load_image(image_path_or_url):
    if image_path_or_url.startswith("http://") or image_path_or_url.startswith("https://"):
        response = requests.get(image_path_or_url)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    return Image.open(image_path_or_url)

# Hàm chính để nhận diện khuôn mặt giữa 2 ảnh
def recognize_face_between_images(video_image_path, avatar_image_path):
    try:
        # Tải ảnh từ đường dẫn hoặc URL
        video_image = np.array(load_image(video_image_path))  # Chuyển đổi sang numpy array
        avatar_image = np.array(load_image(avatar_image_path))  # Chuyển đổi sang numpy array

        # Trích xuất embedding cho ảnh video call
        video_analysis = DeepFace.represent(video_image, model_name="VGG-Face", enforce_detection=False)
        video_embedding = np.array(video_analysis[0]['embedding'], dtype=np.float32)

        # Trích xuất embedding cho ảnh đại diện (avatar)
        avatar_analysis = DeepFace.represent(avatar_image, model_name="VGG-Face", enforce_detection=False)
        avatar_embedding = np.array(avatar_analysis[0]['embedding'], dtype=np.float32)

        # Tính toán độ tương đồng giữa 2 embeddings
        similarity = cosine_similarity(video_embedding, avatar_embedding)

        # Phân tích các đặc điểm khuôn mặt cho ảnh video call
        face_analysis = DeepFace.analyze(video_image, actions=['age', 'gender', 'race', 'emotion'], enforce_detection=False)

        # Chuyển đổi các giá trị không serializable
        face_analysis = convert_to_serializable(face_analysis)

        # Kết quả trả về
        return {
            "recognized": similarity > 0.7,  # Ngưỡng nhận diện là 0.7
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

# Lấy tham số từ dòng lệnh (truyền 2 file ảnh)
video_image_path = sys.argv[1]  # Ảnh từ video call
avatar_image_path = sys.argv[2]  # Ảnh đại diện người dùng

# Gọi hàm nhận diện và in kết quả
result = recognize_face_between_images(video_image_path, avatar_image_path)
result = convert_to_serializable(result)
print(json.dumps(result))