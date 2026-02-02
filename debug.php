<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YOLO Debugger</title>
<style>
body { font-family: sans-serif; padding: 20px; }
#preview { max-width: 100%; margin-top: 20px; border: 1px solid #ccc; }
#spinner { display:none; }
#success { color: green; display:none; margin-top:10px; }
</style>
</head>
<body>

<h2>YOLO Debugger - Manual Upload</h2>

<form id="uploadForm">
    <input type="file" name="image" id="imageInput" accept="image/*" required>
    <button type="submit">Upload & Detect</button>
</form>

<div id="spinner">Processing...</div>
<div id="success">Annotation Complete!</div>
<img id="preview" src="" alt="Annotated Image">

<script>
const form = document.getElementById('uploadForm');
const input = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const spinner = document.getElementById('spinner');
const success = document.getElementById('success');

form.addEventListener('submit', e => {
    e.preventDefault();
    if(!input.files[0]) return;

    const formData = new FormData();
    formData.append('image', input.files[0]);

    spinner.style.display = 'block';
    success.style.display = 'none';

    fetch('save_image.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.text())
    .then(path => {
        preview.src = path.trim() + '?t=' + Date.now();
        spinner.style.display = 'none';
        success.style.display = 'block';
    })
    .catch(err => {
        console.error(err);
        spinner.style.display = 'none';
        alert('Error running YOLO');
    });
});
</script>

</body>
</html>