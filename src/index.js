import rawWorkerContent from "./compiler.worker.js?text";

// https://github.com/WICG/import-maps
const importmap = {
  imports: {
    vue: "https://unpkg.com/vue@3/dist/vue.esm-browser.js",
    "@vue/compiler-sfc":
      "https://unpkg.com/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js",
    "@swc/wasm-web": "https://unpkg.com/@swc/wasm-web/wasm.js",
  },
  scopes: {},
};

function generateID() {
  return Math.random().toString(36).slice(2, 12);
}
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function toJsDataUri(raw) {
  return `data:application/javascript;base64,${toBase64(raw)}`;
}

const replaceWorkerPkg = (raw, pkgs) => {
  return pkgs.reduce((acc, pkg) => {
    return acc
      .replace(
        RegExp(`from\\s*(['"])${pkg}\\1`, "g"),
        `from "${importmap.imports[pkg]}"`
      )
      .replace(
        RegExp(`import\\((['"])${pkg}\\1\\)`, "g"),
        `import("${importmap.imports[pkg]}")`
      );
  }, raw);
};

async function createWorker() {
  const raw = replaceWorkerPkg(rawWorkerContent, [
    "@vue/compiler-sfc",
    "@swc/wasm-web",
  ]);

  return new Worker(toJsDataUri(raw), {
    type: "module",
  });
}

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
    const identifier = `${imgId}_${imgIndex++}`;
    imageMap[identifier] = toJsDataUri(
      `export default '${new URL(g2, absSrc).href}'`
    );
    return `import ${g1} from '${identifier}'; // ${m}`;
  });

  return [
    await new Promise(async (resolve) => {
      const worker = await createWorker();
      worker.postMessage([generateID(), vueSource, moduleName]);
      worker.onmessage = (e) => {
        if (e.data.type === "transform") {
          resolve(e.data.data);
        } else if (e.data.type === "console") {
          console[e.data.level](...e.data.args);
        }
      };
    }),
    module,
    imageMap,
  ];
}

async function setup() {
  if (document.querySelector('script[type="importmap"]')) {
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

  const components = document.querySelectorAll(
    'noscript[vue], template[vue], noscript[type="vue-sfc"], template[type="vue-sfc"]'
  );
  const internalImportMap = {};
  const mountingInfo = [];
  await Promise.all(
    [...components].map(async (component) => {
      const [url, module, imageMap] = await makeComponent(component);
      if (component.hasAttribute("mount")) {
        mountingInfo.push([module, component.getAttribute("mount")]);
      }
      if (url) {
        internalImportMap[module] = url;
      }
      if (imageMap) {
        Object.assign(internalImportMap, imageMap);
      }
    })
  );

  Object.assign(importmap.imports, internalImportMap);

  const script = document.createElement("script");
  script.setAttribute("type", "importmap");
  script.textContent = JSON.stringify(importmap);
  (document.currentScript || document.querySelector("script")).after(script);

  if (mountingInfo) {
    const script = document.createElement("script");
    const apps = mountingInfo.map(
      (item, index) =>
        `import App${index} from '${item[0]}'; createApp(App${index}).mount('${item[1]}');`
    );

    script.setAttribute("type", "module");
    script.innerHTML = [`import { createApp } from 'vue';`, ...apps].join("\n");
    document.body.appendChild(script);
  }
}

setup();
