from rembg import remove
from PIL import Image

input_path = "uploads/2026-02-20-10-27-20-e73ccf_vit_classified.jpg"
output_path = "test_nobg.png"

input_image = Image.open(input_path)
output_image = remove(input_image)
output_image.save(output_path)

