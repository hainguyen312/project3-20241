import sys
import json
from deepface import DeepFace

def analyze_image(image_path):
    try:
        # Phân tích ảnh với các hành động: tuổi, giới tính, cảm xúc, chủng tộc
        result = DeepFace.analyze(img_path=image_path, actions=['age', 'gender', 'emotion', 'race'])
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    # Nhận đường dẫn file từ tham số dòng lệnh
    image_path = sys.argv[1]
    print(analyze_image(image_path))
