/** Laplacian variance on grayscale pixel buffer (blur detection). */
export function computeLaplacianVariance(
  pixels: Uint8Array,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) return 0;
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let lap = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          lap += pixels[idx] * kernel[ki++];
        }
      }
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}
