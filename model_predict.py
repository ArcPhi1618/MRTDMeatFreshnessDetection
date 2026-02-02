from ultralytics import YOLO
import sys
import cv2
import os

image_path = sys.argv[1]

if not os.path.exists(image_path):
    print("Image not found")
    sys.exit(1)

model = YOLO("models/cpe-mf0937-01.pt")

img = cv2.imread(image_path)

# Resize for speed
img = cv2.resize(img, (640,480))

results = model.predict(img, device='cpu', imgsz=640)

for r in results:
    if r.boxes is None:
        continue

    for box in r.boxes:
        x1,y1,x2,y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])
        cls = int(box.cls[0])

        label = f"{model.names[cls]} {conf:.2f}"

        cv2.rectangle(img,(x1,y1),(x2,y2),(0,255,0),2)
        cv2.putText(img,label,(x1,max(y1-10,0)),
                    cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,255,0),2)

cv2.imwrite(image_path,img)

print("done")