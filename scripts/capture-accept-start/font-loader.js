const loaded = new Set();

function uriOf(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object') return source.uri || source.localUri || source.default || null;
  return null;
}

function inject(name, uri) {
  const id = 'capture-icon-font';
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  if (!style.textContent.includes(name)) {
    style.textContent += `@font-face{font-family:${JSON.stringify(name)};src:url(${JSON.stringify(uri)});font-display:block}`;
  }
}

const loader = {
  getLoadedFonts: () => [...loaded],
  isLoaded: (name) => loaded.has(name),
  loadAsync(name, resource) {
    const uri = uriOf(resource && resource.uri !== undefined ? resource.uri : resource);
    if (!uri) return Promise.resolve();
    inject(name, uri);
    const ready = document.fonts ? document.fonts.load(`16px "${name}"`) : Promise.resolve();
    return Promise.resolve(ready).then(() => {
      loaded.add(name);
    });
  },
  unloadAsync: () => Promise.resolve(),
  unloadAllAsync: () => Promise.resolve(),
};

export function getAssetForSource(source) {
  const uri = uriOf(source);
  if (!uri) throw new Error('Capture font source is missing a uri');
  return { uri, display: 'auto' };
}

export function loadSingleFontAsync(name, input) {
  return loader.loadAsync(name, input);
}

export default loader;
