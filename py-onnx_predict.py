
import sys
import os
import json
import time
import numpy as np
from PIL import Image, ImageOps
import onnxruntime as ort

# --- CONFIG ---
ENV_PATH = os.path.join(os.path.dirname(__file__), 'roboflow_cache', 'cpe-phl', '5', 'environment.json')
with open(ENV_PATH, 'r') as f:
	env = json.load(f)

CLASS_MAP = env.get('CLASS_MAP', {})
CLASS_LIST = env.get('CLASS_LIST', [])
RESOLUTION = env.get('RESOLUTION', 224)
PREPROCESSING = env.get('PREPROCESSING', '{}')
try:
	PREPROCESSING = json.loads(PREPROCESSING) if isinstance(PREPROCESSING, str) else PREPROCESSING
except Exception:
	PREPROCESSING = {}

def preprocess_image(img_path):
	img = Image.open(img_path)
	# Auto-orient
	if PREPROCESSING.get('auto-orient', {}).get('enabled', False):
		img = ImageOps.exif_transpose(img)
	# Resize
	if PREPROCESSING.get('resize', {}).get('enabled', False):
		width = PREPROCESSING['resize'].get('width', RESOLUTION)
		height = PREPROCESSING['resize'].get('height', RESOLUTION)
		img = img.resize((width, height), Image.BILINEAR)
	# Convert to RGB
	img = img.convert('RGB')
	arr = np.asarray(img).astype(np.float32) / 255.0
	arr = arr.transpose(2, 0, 1)  # to CHW
	arr = np.expand_dims(arr, 0)  # add batch dim
	return arr


def softmax(x):
	e_x = np.exp(x - np.max(x))
	return e_x / e_x.sum(axis=-1, keepdims=True)

def postprocess_output(output, threshold):
	# Assume output is (1, num_classes)
	logits = output[0]
	probs = softmax(logits)
	top_idx = int(np.argmax(probs))
	top_conf = float(probs[top_idx])
	top_class = CLASS_MAP.get(str(top_idx), CLASS_LIST[top_idx] if top_idx < len(CLASS_LIST) else str(top_idx))
	predictions = []
	for i, conf in enumerate(probs):
		if float(conf) >= threshold:
			predictions.append({
				'name': CLASS_MAP.get(str(i), CLASS_LIST[i] if i < len(CLASS_LIST) else str(i)),
				'conf': float(conf)
			})
	predictions.sort(key=lambda x: x['conf'], reverse=True)
	return top_class, top_conf, predictions

def main():
	if len(sys.argv) < 4:
		print(json.dumps({'status': 'error', 'message': 'Usage: py-onnx_predict.py <image_path> <threshold> <model_path>'}))
		return
	img_path = sys.argv[1]
	threshold = float(sys.argv[2])
	model_path = sys.argv[3]

	try:
		arr = preprocess_image(img_path)
	except Exception as e:
		print(json.dumps({'status': 'error', 'message': f'Preprocessing failed: {e}'}))
		return

	try:
		sess = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
		input_name = sess.get_inputs()[0].name
		t0 = time.time()
		output = sess.run(None, {input_name: arr})
		t1 = time.time()
		# Output: usually a tuple/list, take first if needed
		if isinstance(output, (list, tuple)):
			output = output[0]
		top_class, top_conf, predictions = postprocess_output(output, threshold)
		result = {
			'status': 'ok',
			'top_class': top_class,
			'top_confidence': top_conf,
			'predictions': predictions,
			'all_classes': CLASS_LIST,
			'inference_time_ms': int((t1-t0)*1000)
		}
		print(json.dumps(result))
	except Exception as e:
		print(json.dumps({'status': 'error', 'message': f'Inference failed: {e}'}))

if __name__ == '__main__':
	main()
