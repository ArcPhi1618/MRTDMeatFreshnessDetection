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
MODEL_PATH = os.path.join(BASE, "models", "yolov8s-obb.pt")

DETECTED_DIR = os.path.join(BASE, "predicted_images")
os.makedirs(DETECTED_DIR, exist_ok=True)

if not os.path.exists(MODEL_PATH):
    print(json.dumps({'status': 'error', 'message': 'model not found'}))
    sys.exit(1)

# ================= LOAD MODEL =================
model = YOLO(MODEL_PATH)

# ================= RUN OBB INFERENCE WITH MULTIPLE ATTEMPTS =================
predictions = []
results = None
raw_detections_count = 0
raw_confidences = []

# Try multiple image sizes to improve detection
for attempt_size, imgsz in enumerate([640, 960]):
    try:
        results = model.predict(
            source=image_path,
            imgsz=imgsz,
            conf=threshold,
            verbose=False
        )
        
        # Count raw detections before filtering
        for r in results:
            if r.obb is not None:
                raw_detections_count += len(r.obb.conf) if r.obb.conf is not None else 0
                if r.obb.conf is not None:
                    raw_confidences.extend(r.obb.conf.cpu().numpy().tolist())
        
        print(json.dumps({'debug': {'attempt': f'default_{imgsz}', 'total_raw_detections': raw_detections_count, 'raw_confidences': raw_confidences}}), file=sys.stderr)
        
        # If we found detections, break out of retry loop
        if raw_detections_count > 0:
            break
    except Exception as e:
        print(json.dumps({'debug': {'attempt': f'size_{imgsz}_failed', 'error': str(e)}}), file=sys.stderr)
        continue

img = cv2.imread(image_path)
if img is None:
    print(json.dumps({'status': 'error', 'message': 'failed to read image'}))
    sys.exit(1)

# ================= DRAW OBB BOXES =================
# Log how many detections we're processing
print(json.dumps({'debug': {'kept_detections': len(predictions)}}), file=sys.stderr)

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
    'annotated_path': "predicted_images/" + annotated_name,
    'predictions': predictions
}))
