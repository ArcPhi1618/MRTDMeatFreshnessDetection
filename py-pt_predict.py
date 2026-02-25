import sys, os, json, time
import cv2
import numpy as np

if len(sys.argv) < 4:
    print(json.dumps({'status':'error','message':'Usage: py-pt_predict.py <image_path> <threshold> <model_path>'}))
    sys.exit(1)

image_path = sys.argv[1]
threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
model_path = sys.argv[3]

t_start = time.time()

if not os.path.exists(image_path):
    print(json.dumps({'status':'error','message':'image not found'}))
    sys.exit(1)
if not os.path.exists(model_path):
    print(json.dumps({'status':'error','message':'model not found'}))
    sys.exit(1)

try:
    import torch
except Exception as e:
    print(json.dumps({'status':'error','message':'PyTorch not installed', 'detail': str(e)}))
    sys.exit(1)

BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, "models", "yolov8s-obb.pt")
UPLOADS_DIR = os.path.join(BASE, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Optional metadata
METADATA = {}
ENV_FILE = os.path.join(BASE, "3", "environment.json")
if os.path.exists(ENV_FILE):
    try:
        with open(ENV_FILE, "r") as f:
            METADATA = json.load(f)
    except Exception:
        METADATA = {}

CLASS_LIST = METADATA.get('CLASS_LIST', ['Class 0','Class 1','Class 2','Class 3','Class 4','Class 5'])
FRESH_INDICES = [2, 3, 5]

img = cv2.imread(image_path)
if img is None:
    print(json.dumps({'status':'error','message':'failed to read image'}))
    sys.exit(1)

orig = img.copy()
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
resized = cv2.resize(rgb, (224, 224))
x = resized.astype(np.float32) / 255.0
x = np.transpose(x, (2,0,1))  # CHW
x = np.expand_dims(x, axis=0) # NCHW

device = torch.device("cpu")
try:
    model = torch.jit.load(model_path, map_location=device)
except Exception as e:
    print(json.dumps({'status':'error','message':'Failed to load .pt (must be TorchScript)', 'detail': str(e)}))
    sys.exit(1)

model.eval()
with torch.no_grad():
    inp = torch.from_numpy(x).to(device)
    out = model(inp)
    if isinstance(out, (tuple, list)):
        out = out[0]
    logits = out.squeeze().cpu().numpy()

def softmax(v):
    e = np.exp(v - np.max(v))
    return e / e.sum()

probs = softmax(logits)

top_idx = int(np.argmax(probs))
top_conf = float(probs[top_idx])
top_name = CLASS_LIST[top_idx] if top_idx < len(CLASS_LIST) else f"Class {top_idx}"

predictions = []
all_classes = []
for i, p in enumerate(probs):
    cname = CLASS_LIST[i] if i < len(CLASS_LIST) else f"Class {i}"
    conf = float(p)
    is_fresh = (i in FRESH_INDICES)
    all_classes.append({'class_id': i, 'class_name': cname, 'confidence': round(conf,4), 'is_fresh': is_fresh})
    if i == top_idx or conf >= threshold:
        predictions.append({'class': i, 'name': cname, 'conf': round(conf,4), 'is_fresh': is_fresh})

label = f"{top_name}: {top_conf:.2%}"
img_bgr = orig.copy()
color = (0,255,0) if top_conf >= threshold else (0,0,255)
cv2.rectangle(img_bgr, (10, 5), (10 + 12*len(label), 40), color, -1)
cv2.putText(img_bgr, label, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255,255,255), 2)

base = os.path.basename(image_path)
name_no_ext = os.path.splitext(base)[0]
annot_name = f"{name_no_ext}_pred.jpg"
annot_full = os.path.join(UPLOADS_DIR, annot_name)
cv2.imwrite(annot_full, img_bgr)

t_total = (time.time() - t_start) * 1000.0

print(json.dumps({
    'status':'ok',
    'annotated_path': 'uploads/' + annot_name,
    'predictions': predictions,
    'all_classes': all_classes,
    'top_class': top_name,
    'top_confidence': round(top_conf,4),
    'is_fresh': (top_idx in FRESH_INDICES),
    'inference_time_ms': round(t_total, 2)
}))
