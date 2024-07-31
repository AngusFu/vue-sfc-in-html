import workerDataURI from "./compiler.worker.js";

// https://github.com/WICG/import-maps
const importmap = {
  imports: {
    vue: "https://unpkg.com/vue@3/dist/vue.esm-browser.js",
  },
  scopes: {},
};

async function makeComponent(el) {
  const module =
    el.getAttribute("name") || el.getAttribute("component") || generateID();
  let moduleName = module;
  if (!/\.vue$/.test(module)) {
    moduleName += ".vue";
  }
  el.setAttribute("module", moduleName);

  let vueSource = el.innerHTML;
  if (el.hasAttribute("src")) {
    vueSource = await fetch(el.getAttribute("src")).then((res) => res.text());
  }

  // TODO 使用更好的替代方案
  const imageImportRegex =
    /import\s+([^\s]+)\s+from\s+['"](.+\.(png|jpg|jpeg|gif|bmp|webp|svg))['"]/g;
  const imageMap = {};
  const imgId = "img_" + generateID();
  let imgIndex = 0;
  const src = el.getAttribute("src");
  const absSrc = src ? new URL(src, location.href).href : location.href;
  vueSource = vueSource.replace(imageImportRegex, (m, g1, g2) => {
    const imgIdentifier = `${imgId}_${imgIndex++}`;
    imageMap[imgIdentifier] = toDataUri(
      `export default '${new URL(g2, absSrc).href}'`
    );
    return `import ${g1} from '${imgIdentifier}'; // ${m}`;
  });

  return [
    await new Promise((resolve) => {
      const worker = new Worker(workerDataURI, { type: "module" });
      worker.postMessage([vueSource, moduleName]);
      worker.onmessage = (e) => resolve(e.data);
    }),
    module,
    imageMap,
  ];

  return [];
}

const currentScript =
  document.currentScript || document.querySelector("script");

async function setup() {
  const components = document.querySelectorAll(
    'noscript[vue], template[vue], noscript[type="vue-sfc"], template[type="vue-sfc"]'
  );
  const importMap = {};
  let mount = [];

  await Promise.all(
    [...components].map(async (component) => {
      const [url, module, imageMap] = await makeComponent(component);
      if (component.hasAttribute("mount")) {
        mount.push([module, component.getAttribute("mount")]);
      }
      if (url) {
        importMap[module] = url;
      }
      if (imageMap) {
        Object.assign(importMap, imageMap);
      }
    })
  );

  const importMapEl = document.querySelector('script[type="importmap"]');
  if (importMapEl) {
    throw new Error(
      'Cannot setup after importmap is set. Use <script type="sfc-importmap"> instead.'
    );
  }

  const externalMapEl = document.querySelector('script[type="sfc-importmap"]');

  if (externalMapEl) {
    const externalMap = JSON.parse(externalMapEl.textContent);
    Object.assign(importmap.imports, externalMap.imports);
    Object.assign(importmap.scopes, externalMap.scopes);
  }

  Object.assign(importmap.imports, importMap);

  const mapEl = document.createElement("script");
  mapEl.setAttribute("type", "importmap");
  mapEl.textContent = JSON.stringify(importmap);
  currentScript.after(mapEl);

  if (mount) {
    const script = document.createElement("script");
    script.setAttribute("type", "module");
    const apps = mount.map(
      (item, index) =>
        `import App${index} from '${item[0]}'; createApp(App${index}).mount('${item[1]}');`
    );
    script.innerHTML = [`import { createApp } from 'vue';`, ...apps].join("\n");
    document.body.appendChild(script);
  }
}

setup();

function generateID() {
  return Math.random().toString(36).slice(2, 12);
}
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function toDataUri(text) {
  return `data:text/javascript;base64,${toBase64(text)}`;
}
