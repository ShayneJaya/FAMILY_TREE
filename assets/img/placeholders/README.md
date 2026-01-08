Placeholders
- Optional directory for custom placeholder images (e.g., person-placeholder.svg).
- The app already includes a built-in inline SVG fallback when a person has no photo.
- If you prefer a custom placeholder asset, add it here and update getPhotoUrl in assets/js/render.js to reference it, e.g.:
  return 'assets/img/placeholders/person-placeholder.svg';
- Supported formats: svg (preferred), png, jpg, webp.
