import cv2
import numpy as np

# Create a test image with meat-like colors
img = np.zeros((224, 224, 3), dtype=np.uint8)
# Reddish color for meat-like appearance
img[50:170, 50:170] = [50, 50, 200]  # BGR format: red-ish
# Add noise for realism
noise = np.random.randint(-20, 20, img.shape)
img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

# Save test image
cv2.imwrite('uploads/test_image.jpg', img)
print("✓ Test image created: uploads/test_image.jpg")
