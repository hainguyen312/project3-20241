import sys
import json
from deepface import DeepFace
import numpy as np
import os

# Lấy đường dẫn đến ảnh được truyền vào
image_path = sys.argv[1]
# Đường dẫn đến embeddings mẫu của người A
embeddings_folder = sys.argv[2]  # Thêm tham số thứ 2 cho đường dẫn đến folder lưu embeddings mẫu

# Hàm tính toán cosine similarity giữa 2 embeddings
def cosine_similarity(embedding1, embedding2):
    return np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))

# Trích xuất embeddings của người A từ ảnh mẫu
def load_embeddings(embedding_folder):
    embeddings = []
    for filename in os.listdir(embedding_folder):
        if filename.endswith(".embedding"):
            with open(os.path.join(embedding_folder, filename), "rb") as f:
                embeddings.append(np.frombuffer(f.read(), dtype=np.float32))
    return embeddings

# Hàm để so sánh ảnh được upload với người A
def recognize_face(image_path, embeddings_folder):
    # Trích xuất embeddings từ ảnh upload
    try:
        analysis = DeepFace.represent(image_path, model_name="VGG-Face", enforce_detection=False)
        detected_embedding = analysis[0]['embedding']
        
        # Load embeddings mẫu của người A
        embeddings = load_embeddings(embeddings_folder)

        # So sánh với từng embedding của người A
        for personA_embedding in embeddings:
            similarity = cosine_similarity(detected_embedding, personA_embedding)
            if similarity > 0.9:  # Ngưỡng tương đồng (có thể điều chỉnh)
                return {"recognized": True, "similarity": similarity}
        return {"recognized": False}
    except Exception as e:
        return {"error": str(e)}

# Gọi hàm nhận diện khuôn mặt
result = recognize_face(image_path, embeddings_folder)
print(json.dumps(result))  # Trả kết quả dưới dạng JSON
