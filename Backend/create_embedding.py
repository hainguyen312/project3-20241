import json
import os
from deepface import DeepFace
import numpy as np

def create_embedding(image_path, save_folder, person_name):
    try:
        # Tạo embedding từ ảnh
        analysis = DeepFace.represent(image_path, model_name="VGG-Face", enforce_detection=False)
        embedding = np.array(analysis[0]['embedding'], dtype=np.float32)
        
        # Lưu embedding vào tệp
        os.makedirs(save_folder, exist_ok=True)
        embedding_file = os.path.basename(image_path) + ".embedding"
        embedding_path = os.path.join(save_folder, embedding_file)
        with open(embedding_path, "wb") as f:
            f.write(embedding.tobytes())
        
        # Cập nhật metadata
        metadata_path = os.path.join(save_folder, "metadata.json")
        metadata = []
        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
        
        metadata.append({"name": person_name, "embedding_file": embedding_file})
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=4)

        print(f"Embedding for {person_name} saved as {embedding_file}")
    except Exception as e:
        print(f"Error creating embedding for {person_name}: {e}")

# Gọi hàm tạo embedding
create_embedding("/Users/haind/Documents/GitHub/project3-20241/Backend/images/DucHai.jpg", "/Users/haind/Documents/GitHub/project3-20241/Backend/embeddings", "HaiNguyen")
