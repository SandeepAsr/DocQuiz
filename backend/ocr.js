// backend/ocr.js
const vision = require('@google-cloud/vision')

const client = new vision.ImageAnnotatorClient() // relies on GOOGLE_APPLICATION_CREDENTIALS env var

async function extractTextFromFile(filePath) {
  // filePath = local path to uploaded PDF or image
  // Google Vision can accept PDF, images. For simplicity, process images or first page image.
  const [result] = await client.textDetection(filePath)
  const detections = result.textAnnotations
  if (!detections || detections.length === 0) return ''
  return detections[0].description || ''
}

module.exports = { extractTextFromFile }
