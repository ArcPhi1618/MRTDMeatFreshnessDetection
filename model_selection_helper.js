// Helper for model selection state
window.getSelectedModelName = function() {
  return window.__selectedModelName || "";
};
window.setSelectedModelName = function(name) {
  window.__selectedModelName = name;
};
