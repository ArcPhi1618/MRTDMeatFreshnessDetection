import sys
import os
import json
import cv2
import numpy as np
from ultralytics import YOLO

# ================= ARGUMENTS =================
if len(sys.argv) < 2:
    print(json.dumps({'status': 'error', 'message': 'missing image path'}))
    sys.exit(1)

image_path = sys.argv[1]
threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3

if not os.path.exists(image_path):
    print(json.dumps({'status': 'error', 'message': 'image not found'}))
    sys.exit(1)

# ================= PATHS =================
BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, "models", "cpe-mfmrtd-03.pt")

DETECTED_DIR = os.path.join(BASE, "predicted images")
os.makedirs(DETECTED_DIR, exist_ok=True)

if not os.path.exists(MODEL_PATH):
    print(json.dumps({'status': 'error', 'message': 'model not found'}))
    sys.exit(1)

# ================= LOAD MODEL =================
model = YOLO(MODEL_PATH)

# ================= RUN OBB INFERENCE =================
results = model.predict(
    source=image_path,
    imgsz=640,
    conf=threshold,
    verbose=False
)

img = cv2.imread(image_path)
if img is None:
    print(json.dumps({'status': 'error', 'message': 'failed to read image'}))
    sys.exit(1)

predictions = []

# ================= DRAW OBB BOXES =================
for r in results:
    if r.obb is None:
        continue

    pts_all = r.obb.xyxyxyxy.cpu().numpy()   # (N, 4, 2)
    confs = r.obb.conf.cpu().numpy()
    classes = r.obb.cls.cpu().numpy()

    for pts, conf, cls in zip(pts_all, confs, classes):
        if conf < threshold:
            continue

        pts = pts.astype(int)

        name = model.names.get(int(cls), str(int(cls)))

        predictions.append({
            'name': name,
            'conf': round(float(conf), 3),
            'points': pts.tolist()
        })

        # Draw rotated box
        cv2.polylines(img, [pts], isClosed=True, color=(0, 255, 0), thickness=2)

        # Label position (top-left of polygon)
        x, y = pts[0]
        label = f"{name} {conf:.2f}"
        cv2.putText(
            img,
            label,
            (x, max(y - 10, 0)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

# ================= SAVE ANNOTATED IMAGE =================
base_name = os.path.basename(image_path)
name_no_ext = os.path.splitext(base_name)[0]

annotated_name = f"{name_no_ext}_detected.jpg"
annotated_path = os.path.join(DETECTED_DIR, annotated_name)

cv2.imwrite(annotated_path, img)

# ================= OUTPUT (ONE JSON ONLY) =================
print(json.dumps({
    'status': 'ok',
    'annotated_path': "predicted%20images/" + annotated_name,
    'predictions': predictions
}))
