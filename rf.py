import os
# Use a folder in your current directory instead of "/"
os.environ["MODEL_CACHE_DIR"] = "./roboflow_cache" 

from inference import get_model

# Clint zDEp40L65Y7nqVtLs2Q7
# Carmina KxKzFfECtJXjL4aNCals

model = get_model(
    model_id="cpe-phl/8", 
    api_key="KxKzFfECtJXjL4aNCals" # Use your actual API Key
)