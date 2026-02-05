#!/usr/bin/env python3
"""
yolo_server.py
Lightweight Flask server that keeps YOLO model in memory for fast inference.
Listens on localhost:5555

Usage:
  Start server: python yolo_server.py
  Call from PHP: curl http://localhost:5555/predict -F "image=@path.jpg" -F "threshold=0.3"
"""

import os
import sys
import json
import cv2
import traceback
from pathlib import Path
from ultralytics import YOLO
import torch
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load model once at startup
BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, "models", "cpe-mf0937-01.pt")
DETECTED_DIR = os.path.join(BASE, "predicted images")
os.makedirs(DETECTED_DIR, exist_ok=True)

# Simple per-client smoothing state
SMOOTHING_STATE = {}
SMOOTHING_ALPHA = 0.4  # EMA weight for new values
DEFAULT_IMG_SIZE = 256  # smaller for speed (helps reach higher fps)


print(f"Loading model from {MODEL_PATH}...", file=sys.stderr)
try:
    # detect device
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    use_half = True if device.startswith('cuda') else False

    model = YOLO(MODEL_PATH)
    # pre-warm: run a dummy inference to load weights into memory
    print(f"Model instantiated. warming up on device={device}, half={use_half}", file=sys.stderr)
    try:
        imgsz = 480
        dummy = np.zeros((imgsz, imgsz, 3), dtype=np.uint8)
        # run a single warm-up prediction (non-blocking for startup)
        _ = model.predict(dummy, device=device, imgsz=imgsz, verbose=False)
    except Exception as e:
        # ignore warmup errors but log them
        print(f"Warmup failed: {e}", file=sys.stderr)

    print(f"Model loaded. Classes: {model.names}", file=sys.stderr)
except Exception as e:
    print(f"Failed to load model: {e}", file=sys.stderr)
    sys.exit(1)


@app.route('/predict', methods=['POST'])
def predict():
    """
    Expects multipart POST with:
      - image: image file
      - threshold: confidence threshold (0.0-1.0), default 0.3
    Returns JSON with annotated_path and predictions.
    """
    try:
        if 'image' not in request.files:
            return jsonify({'status': 'error', 'message': 'no image'}), 400

        file = request.files['image']
        threshold = float(request.form.get('threshold', 0.3))

        # Read image from upload
        img_bytes = file.read()
        nparr = cv2.imdecode(__import__('numpy').frombuffer(img_bytes, __import__('numpy').uint8), cv2.IMREAD_COLOR)
        if nparr is None:
            return jsonify({'status': 'error', 'message': 'invalid image'}), 400

        # Run inference (use GPU if available; smaller imgsz for speed)
        imgsz = int(request.form.get('imgsz', DEFAULT_IMG_SIZE))
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        use_half = True if device.startswith('cuda') else False
        results = model.predict(nparr, device=device, imgsz=imgsz, conf=threshold, half=use_half, verbose=False)

        predictions = []
        img_annotated = nparr.copy()

        # optional client id and boxes_only flag
        client_id = request.form.get('client_id', request.remote_addr)
        boxes_only = str(request.form.get('boxes_only', '0')) in ['1','true','True']

        # helper: compute IoU for box matching (axis-aligned fallback)
        def iou(a,b):
            xa1,ya1,xa2,ya2 = a
            xb1,yb1,xb2,yb2 = b
            xi1 = max(xa1, xb1); yi1 = max(ya1, yb1)
            xi2 = min(xa2, xb2); yi2 = min(ya2, yb2)
            inter = max(0, xi2-xi1) * max(0, yi2-yi1)
            areaA = max(0, xa2-xa1) * max(0, ya2-ya1)
            areaB = max(0, xb2-xb1) * max(0, yb2-yb1)
            denom = areaA + areaB - inter
            return inter/denom if denom>0 else 0

        # apply smoothing using exponential moving average per client
        state = SMOOTHING_STATE.setdefault(client_id, {})

        for r in results:
            if r.obb is None:
                continue

            pts_all = r.obb.xyxyxyxy.cpu().numpy()
            confs = r.obb.conf.cpu().numpy()
            classes = r.obb.cls.cpu().numpy()

            for pts, conf, cls in zip(pts_all, confs, classes):
                if conf < threshold:
                    continue

                pts = pts.astype(int)
                # Convert OBB to axis-aligned bbox for simpler smoothing and drawing
                xs = pts[:,0]; ys = pts[:,1]
                x1,y1,x2,y2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

                name = model.names.get(int(cls), str(int(cls)))
                entry = {'name': name, 'conf': round(float(conf), 3), 'bbox': [x1,y1,x2,y2]}

                # Smoothing: match existing state entries by name and IoU
                updated = False
                for k, v in list(state.items()):
                    if v['name'] == name:
                        if iou(v['bbox'], entry['bbox']) > 0.3:
                            # EMA update
                            old_bbox = v['bbox']
                            new_bbox = [
                                int(SMOOTHING_ALPHA * entry['bbox'][i] + (1-SMOOTHING_ALPHA) * old_bbox[i])
                                for i in range(4)
                            ]
                            v['bbox'] = new_bbox
                            v['conf'] = SMOOTHING_ALPHA * entry['conf'] + (1-SMOOTHING_ALPHA) * v['conf']
                            v['seen'] = v.get('seen',0) + 1
                            updated = True
                            break
                if not updated:
                    # create new smoothed entry
                    state_key = f"{name}_{len(state)}"
                    state[state_key] = {'name': name, 'bbox': entry['bbox'], 'conf': entry['conf'], 'seen':1}

        # Prepare output predictions from smoothing state (decay old ones)
        out_preds = []
        for k, v in list(state.items()):
            # decay confidence if not seen recently
            v['conf'] = v.get('conf',0) * 0.98
            if v['conf'] < 0.05:
                del state[k]
                continue
            out_preds.append({'id': k, 'name': v['name'], 'conf': round(float(v['conf']),3), 'bbox': v['bbox']})

        # If boxes_only requested, return boxes JSON directly (faster)
        if boxes_only:
            return jsonify({
                'status': 'ok',
                'predictions': out_preds
            })

        # Draw stabilized boxes on annotated image
        for p in out_preds:
            x1,y1,x2,y2 = p['bbox']
            cv2.rectangle(img_annotated,(x1,y1),(x2,y2),(0,255,0),2)
            cv2.putText(img_annotated,f"{p['name']} {p['conf']:.2f}",(x1,max(y1-10,0)),cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,255,0),2)

        # Save annotated image with unique name
        import time
        ts = str(int(time.time() * 1000))
        annotated_name = f"server_{ts}_detected.jpg"
        annotated_path = os.path.join(DETECTED_DIR, annotated_name)
        cv2.imwrite(annotated_path, img_annotated)

        return jsonify({
            'status': 'ok',
            'annotated_path': f"predicted%20images/{annotated_name}",
            'predictions': predictions
        })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model_ready': True})


if __name__ == '__main__':
    print("Starting YOLO server on http://localhost:5555", file=sys.stderr)
    app.run(host='localhost', port=5555, debug=False, threaded=True)
