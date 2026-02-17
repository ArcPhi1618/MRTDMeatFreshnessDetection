import cv2
import sys

# Usage: python capture_frame.py <stream_url> <output_path>
if len(sys.argv) < 3:
    print("Usage: python capture_frame.py <stream_url> <output_path>")
    sys.exit(1)

stream_url = sys.argv[1]
output_path = sys.argv[2]

cap = cv2.VideoCapture(stream_url)
ret, frame = cap.read()
cap.release()

if ret:
    cv2.imwrite(output_path, frame)
    print(f"Saved frame to {output_path}")
else:
    print("Failed to capture frame.")
