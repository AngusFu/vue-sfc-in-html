import * as compiler from '@vue/compiler-sfc';

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function generateID() {
  return Math.random().toString(36).slice(2, 12);
}
function transformVueSFC(source, filename, mountname) {
  const {descriptor, errors} = compiler.parse(source, {filename});
  if(errors.length) throw new Error(errors.toString());
  const id = generateID();
  const hasScoped = descriptor.styles.some(e => e.scoped);
  const scopeId = hasScoped ? `data-v-${id}` : undefined;
  const templateOptions = {
    id,
    source: descriptor.template.content,
    filename: descriptor.filename,
    scoped: hasScoped,
    slotted: descriptor.slotted,
    compilerOptions: {
      scopeId: hasScoped ? scopeId : undefined,
      mode: 'module',
    },
  };
  const script = compiler.compileScript(descriptor, {id, templateOptions, sourceMap:true});
  if(script.map) {
    script.content = `${script.content}\n//# sourceMappingURL=data:application/json;base64,${toBase64(JSON.stringify(script.map))}`;
  }
  const template = compiler.compileTemplate({
    ...templateOptions,
    sourceMap: true,
    compilerOptions: {
      ...templateOptions.compilerOptions,
      // https://github.com/vuejs/repl/blob/2daac718a212e61d200cecdfc3623535bd0196a9/src/transform.ts#L167C7-L167C15
      bindingMetadata: script.bindings,
    }
  });
  if(template.map) {
    template.map.sources[0] = `${template.map.sources[0]}?template`;
    template.code = `${template.code}\n//# sourceMappingURL=data:application/json;base64,${toBase64(JSON.stringify(template.map))}`;
  }
  let cssInJS = '';
  if(descriptor.styles) {
    const styled = descriptor.styles.map((style) => {
      return compiler.compileStyle({
        id,
        source: style.content,
        scoped: style.scoped,
        preprocessLang: style.lang,
      });
    });
    if(styled.length) {
      const cssCode = styled.map(s => `${mountname} ${s.code}`).join('\n');
      cssInJS = `(function(){const el = document.createElement('style');
el.innerHTML = \`${cssCode}\`;
document.body.appendChild(el);}());`;
    }
  }
  const moduleCode = `
  import script from '${getBlobURL(script.content)}';
  import {render} from '${getBlobURL(template.code)}';
  script.render = render;
  ${filename ? `script.__file = '${filename}'` : ''};
  ${scopeId ? `script.__scopeId = '${scopeId}'` : ''};
  ${cssInJS}
  export default script;
  `;
  return moduleCode;
}

function getBlobURL(jsCode) {
  const blob = new Blob([jsCode], {type: 'text/javascript'});
  const blobURL = URL.createObjectURL(blob);
  return blobURL;
}

// https://github.com/WICG/import-maps
const map = {
  imports: {
    vue: 'https://unpkg.com/vue@3/dist/vue.esm-browser.js',
  },
  scopes: { },
};

async function makeComponent(el) {
  const module = el.getAttribute('component');
  let moduleName = module;
  if(!/\.vue$/.test(module)) {
    moduleName += '.vue';
  }
  el.setAttribute('module', moduleName);
  if(module) {
    let vueSource = el.innerHTML;
    if (el.hasAttribute('src')) {
      vueSource = await fetch(el.getAttribute('src')).then(res => res.text());
    }

    // TODO 使用更好的替代方案
    const imageImportRegex = /import\s+([^\s]+)\s+from\s+['"](.+\.(png|jpg|jpeg|gif|bmp|webp|svg))['"]/g;
    const imageMap = {};
    const imgId = 'img_' + generateID();
    let imgIndex = 0;
    const src = el.getAttribute('src');
    const absSrc = src ? new URL(src, location.href).href : location.href;
    vueSource = vueSource.replace(imageImportRegex, (m, g1, g2) => {
      const imgIdentifier = `${imgId}_${imgIndex++}`;
      imageMap[imgIdentifier] = `data:text/javascript;base64,${toBase64(`export default '${new URL(g2, absSrc).href}'`)}`;
      return `import ${g1} from '${imgIdentifier}'; // ${m}`;
    });
    
    return [getBlobURL(transformVueSFC(vueSource, moduleName, el.getAttribute('mount'))), module, imageMap];
  }
  return [];
}

const currentScript = document.currentScript || document.querySelector('script');

async function setup() {
  const components = document.querySelectorAll('noscript[type="vue-sfc"]');
  const importMap = {};
  let mount = [];


  await Promise.all(
    [...components].map(async (component) => {
      const [url, module, imageMap] = await makeComponent(component);
      if(component.hasAttribute('mount')) {
        mount.push([module, component.getAttribute('mount')]);
      }
      if(url) {
        importMap[module] = url;
      }
      if (imageMap) {
        Object.assign(importMap, imageMap);
      }
    })
  );

  const importMapEl = document.querySelector('script[type="importmap"]');
  if(importMapEl) {
    // map = JSON.parse(mapEl.innerHTML);
    throw new Error('Cannot setup after importmap is set. Use <script type="sfc-importmap"> instead.');
  }

  const externalMapEl = document.querySelector('script[type="sfc-importmap"]');

  if(externalMapEl) {
    const externalMap = JSON.parse(externalMapEl.textContent);
    Object.assign(map.imports, externalMap.imports);
    Object.assign(map.scopes, externalMap.scopes);
  }

  Object.assign(map.imports, importMap);

  const mapEl = document.createElement('script');
  mapEl.setAttribute('type', 'importmap');
  mapEl.textContent = JSON.stringify(map);
  currentScript.after(mapEl);

  if(mount) {
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    const apps = mount.map((item, index)=>`
    import App${index} from '${item[0]}';
    createApp(App${index}).mount('${item[1]}');`).join('');
    script.innerHTML = `
      import {createApp} from 'vue';
      ${apps}
    `;
    document.body.appendChild(script);
  }
}

setup();
