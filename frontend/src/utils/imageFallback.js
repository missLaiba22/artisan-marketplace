export function getImageFallbackDataUri({ width = 100, height = 100, fill = "#E0DCD0" } = {}) {
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='${width}' height='${height}' fill='${encodeURIComponent(fill)}'/></svg>`;
}