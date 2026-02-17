import os
# Use a folder in your current directory instead of "/"
os.environ["MODEL_CACHE_DIR"] = "./roboflow_cache" 

from inference import get_model

model = get_model(
    model_id="cpe4a/2", 
    api_key="i6rlxUrfFu85G5zEffyI" # Use your actual API Key
)
