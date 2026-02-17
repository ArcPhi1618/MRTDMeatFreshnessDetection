import sys
import os
import json
import cv2
import numpy as np
import onnxruntime as ort
import time

# ================= ARGUMENTS =================
if len(sys.argv) < 2:
    print(json.dumps({'status': 'error', 'message': 'missing image path'}))
    sys.exit(1)

image_path = sys.argv[1]
threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3
skip_annotate = (sys.argv[3].lower() == 'true') if len(sys.argv) > 3 else False
t_start = time.time()

if not os.path.exists(image_path):
    print(json.dumps({'status': 'error', 'message': 'image not found'}))
    sys.exit(1)

# ================= PATHS =================
BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, "models", "best.onnx")

UPLOADS_DIR = os.path.join(BASE, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

if not os.path.exists(MODEL_PATH):
    print(json.dumps({'status': 'error', 'message': 'model not found'}))
    sys.exit(1)

# Optional metadata (safe if missing)
METADATA = {}
ENV_FILE = os.path.join(BASE, "3", "environment.json")
if os.path.exists(ENV_FILE):
    try:
        with open(ENV_FILE, 'r') as f:
            METADATA = json.load(f)
    except Exception:
        METADATA = {}

CLASS_LIST = METADATA.get('CLASS_LIST', ['Class 0', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'])

# ================= LOAD MODEL =================
session = ort.InferenceSession(MODEL_PATH)

# ================= PREPROCESS IMAGE =================
def preprocess(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return None, None
    original_img = img.copy()
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (224, 224))
    img_input = img_resized.astype(np.float32) / 255.0
    img_input = np.transpose(img_input, (2, 0, 1))
    img_input = np.expand_dims(img_input, axis=0)
    return original_img, img_input

original_img, input_tensor = preprocess(image_path)
if original_img is None:
    print(json.dumps({'status': 'error', 'message': 'failed to read image'}))
    sys.exit(1)

# ================= RUN INFERENCE =================
input_name = session.get_inputs()[0].name
outputs = session.run(None, {input_name: input_tensor})
output = outputs[0]

if len(output.shape) == 2:
    logits = output[0]
else:
    logits = output

def softmax(x):
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum()

probs = softmax(logits)

top_class_idx = int(np.argmax(probs))
top_confidence = float(probs[top_class_idx])
top_class_name = CLASS_LIST[top_class_idx] if top_class_idx < len(CLASS_LIST) else f"Class {top_class_idx}"

# Example: mark some indices as "fresh"
FRESH_INDICES = [2, 3, 5]

predictions = []
class_results = []
for class_idx, prob in enumerate(probs):
    class_name = CLASS_LIST[class_idx] if class_idx < len(CLASS_LIST) else f"Class {class_idx}"
    confidence = float(prob)
    is_fresh = (class_idx in FRESH_INDICES)

    class_results.append({
        'class_id': int(class_idx),
        'class_name': class_name,
        'confidence': round(confidence, 4),
        'is_fresh': is_fresh
    })

    # include top always; include others if above threshold
    if class_idx == top_class_idx or confidence >= threshold:
        predictions.append({
            'class': int(class_idx),
            'name': class_name,
            'conf': round(confidence, 4),
            'is_fresh': is_fresh
        })

# ================= SAVE ANNOTATED IMAGE =================
annotated_path = None
if not skip_annotate:
    img_bgr = original_img.copy()

    label_text = f"{top_class_name}: {top_confidence:.2%}"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    thickness = 2
    color = (0, 255, 0) if top_confidence >= threshold else (0, 0, 255)

    text_size = cv2.getTextSize(label_text, font, font_scale, thickness)[0]
    cv2.rectangle(img_bgr, (10, 30 - text_size[1]), (10 + text_size[0] + 10, 40), color, -1)
    cv2.putText(img_bgr, label_text, (15, 25), font, font_scale, (255, 255, 255), thickness)

    base_name = os.path.basename(image_path)
    name_no_ext = os.path.splitext(base_name)[0]
    annotated_name = f"{name_no_ext}_onnx_classified.jpg"

    annotated_full = os.path.join(UPLOADS_DIR, annotated_name)
    cv2.imwrite(annotated_full, img_bgr)

    # web-loadable relative URL
    annotated_path = "uploads/" + annotated_name

t_total = time.time() - t_start
top_class_fresh = (top_class_idx in FRESH_INDICES)

print(json.dumps({
    'status': 'ok',
    'annotated_path': annotated_path,
    'predictions': predictions,
    'all_classes': class_results,
    'top_class': top_class_name,
    'top_confidence': round(top_confidence, 4),
    'is_fresh': top_class_fresh,
    'inference_time_ms': round(t_total * 1000, 2)
}))
