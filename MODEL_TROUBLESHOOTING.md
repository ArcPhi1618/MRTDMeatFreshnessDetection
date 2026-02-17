# Model Prediction Troubleshooting Guide

## Problem: Model Returns Empty Predictions (No Detections)

Your logs show the model is running but finding **zero objects** - this is the root cause of why predictions aren't working.

### Why This Happens

The YOLO OBB (Oriented Bounding Box) model isn't finding meat in your images for one of these reasons:

1. **Wrong Image Subject** - The model is trained to detect meat, but your test images don't contain meat
2. **Poor Image Quality** - Images are blurry, too dark, too bright, or low resolution
3. **Meat Position** - The meat is too small, too large, or partially outside the frame
4. **Threshold Too High** - Objects are detected but confidence is below your threshold
5. **Model Corruption** - The model file might be damaged or wrong version
6. **Model Wasn't Trained** - The `cpe-mfmrtd-03.pt` model hasn't been trained on your current data

---

## Quick Diagnostic Steps

### 1. Test Model Directly
Run the diagnostic script to see if the model can detect anything:

```powershell
cd C:\wamp64\www\MRTDMeatFreshnessDetection
python test_model_direct.py uploads/your_image.jpg 0.3
```

This will show:
- How many objects the model found (even with low confidence)
- What confidence levels were detected
- Why it's returning zero predictions

### 2. Check Model File Exists
```powershell
ls models/cpe-mfmrtd-03.pt
```

If this fails, the model file is missing or corrupted.

### 3. Lower the Threshold
Try with a much lower threshold to see if objects are being filtered out:

```powershell
python test_model_direct.py uploads/your_image.jpg 0.05
```

If this finds objects, your threshold is too high. Lower it in the UI slider.

### 4. Test with Different Images
- Try 3-5 different images
- Ensure they contain **clear, centered meat** (beef, pork, chicken)
- Try different angles, lighting, and distances
- Avoid blurry or out-of-focus images

---

## Solutions

### Solution 1: Lower the Confidence Threshold
The slider in the UI controls the confidence threshold. Try lowering it to:
- **0.2** (20%) if currently at 0.5
- **0.1** (10%) for testing
- **0.05** (5%) to find all detections including weak ones

### Solution 2: Check Image Quality
Ensure uploaded images:
- ✓ Have good lighting (not too dark/bright)
- ✓ Show meat clearly and centered
- ✓ Are in focus (not blurry)
- ✓ Have meat filling 30-80% of the frame
- ✓ Are common meat types (beef, pork, chicken)

### Solution 3: Verify Model Was Trained
Check if the model has been properly trained:

```powershell
# Look for training logs
ls -la *.txt
cat test_model_log.txt
cat php_yolo_log.txt
```

### Solution 4: Retrain or Replace Model
If the model isn't working:

1. **Check if training data is available**
   - Do you have labeled images for training?
   - Is there a training script?

2. **Keep working model available**
   - If you have a backup model that works, use that

3. **Switch to ONNX model**
   - Your system has `best.onnx` available
   - Edit `cpe-save_image.php` to use ONNX instead:
   ```php
   $isOnnxModel = true; // Force ONNX model
   ```

---

## Debugging with Logs

### Check PHP Logs
```powershell
cat php_yolo_log.txt | Select-Object -Last 20
```

Look for:
- `EMPTY_SHELL_EXEC` - Model script didn't return data
- `INVALID_JSON` - Model returned non-JSON
- `MODEL_ERROR` - Model found an error
- `EXEC_TIME` - How long inference took

### Check Python Environment
```powershell
# Verify Python and YOLO are installed
.venv\Scripts\python -c "import ultralytics; from ultralytics import YOLO; print('OK')"
```

If this fails, run:
```powershell
.venv\Scripts\pip install --upgrade ultralytics torch torchvision opencv-python
```

---

## Manual Testing

Test the model directly with a known good image:

```powershell
# Using the diagnostic script
python test_model_direct.py uploads/sample_meat.jpg 0.3

# Or manually using Python
.venv\Scripts\python -c "
from ultralytics import YOLO
model = YOLO('models/cpe-mfmrtd-03.pt')
results = model.predict('uploads/test.jpg', conf=0.1)
for r in results:
    if r.obb:
        print(f'Detections: {len(r.obb.conf)}')
        print(r.obb.conf)
"
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Zero predictions | Wrong image/no meat | Test with different images |
| Very slow predictions (30+ sec) | Large image size | Check image dimensions, reduce size |
| Python not found | Missing venv | Run `python setup_env.bat` |
| "model not found" error | Wrong path | Verify `models/cpe-mfmrtd-03.pt` exists |
| Inconsistent detections | Low confidence | Lower threshold or check image quality |
| Server won't start | Port in use | Change port in `yolo_server.py` |

---

## Still Not Working?

1. **Collect diagnostic data**:
   ```powershell
   cat php_yolo_log.txt
   python test_model_direct.py uploads/test.jpg 0.1
   ls -la models/
   ```

2. **Check if model is even trained**:
   - Look for training log files
   - Check model file size (should be >50MB)
   - Try using a backup model if available

3. **Switch to alternative model**:
   - Edit `cpe-save_image.php` to use `best.onnx`
   - Or check if there's a pre-trained model from another source

4. **Retrain the model**:
   - Collect images of fresh/spoiled meat
   - Label them properly
   - Run training script
   - Replace the `.pt` file

---

## Key Files Locations

- **Model**: `models/cpe-mfmrtd-03.pt`
- **Prediction script**: `py-model_predict.py`
- **PHP handler**: `cpe-save_image.php`
- **Logs**: `php_yolo_log.txt`
- **Uploaded images**: `uploads/`
- **Predictions**: `predicted_images/`

---

## Next Steps

1. Run the diagnostic script
2. Check the logs
3. Test with different images
4. Lower the threshold
5. Check Python environment
6. Consider switching models if needed
