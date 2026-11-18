/** Lets the real icon component paint on the first frame. The harness CSS loads the font. */
export function isLoaded() {
  return true;
}

export function loadAsync() {
  return Promise.resolve();
}

export function renderToImageAsync() {
  return Promise.resolve('');
}
