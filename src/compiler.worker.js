import * as compiler from "https://unpkg.com/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js";

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function generateID() {
  return Math.random().toString(36).slice(2, 12);
}

function toDataUri(text) {
  return `data:text/javascript;base64,${toBase64(text)}`;
}

function transformVueSFC(source, filename) {
  const { descriptor, errors } = compiler.parse(source, { filename });
  if (errors.length) throw new Error(errors.toString());
  const id = generateID();
  const hasScoped = descriptor.styles.some((e) => e.scoped);
  const scopeId = hasScoped ? `data-v-${id}` : undefined;
  const templateOptions = {
    id,
    source: descriptor.template.content,
    filename: descriptor.filename,
    scoped: hasScoped,
    slotted: descriptor.slotted,
    compilerOptions: {
      scopeId: hasScoped ? scopeId : undefined,
      mode: "module",
    },
  };
  const script = compiler.compileScript(descriptor, {
    id,
    templateOptions,
    sourceMap: true,
  });
  if (script.map) {
    script.content = `${
      script.content
    }\n//# sourceMappingURL=data:application/json;base64,${toBase64(
      JSON.stringify(script.map)
    )}`;
  }
  const template = compiler.compileTemplate({
    ...templateOptions,
    sourceMap: true,
    compilerOptions: {
      ...templateOptions.compilerOptions,
      // https://github.com/vuejs/repl/blob/2daac718a212e61d200cecdfc3623535bd0196a9/src/transform.ts#L167C7-L167C15
      bindingMetadata: script.bindings,
    },
  });
  if (template.map) {
    template.map.sources[0] = `${template.map.sources[0]}?template`;
    template.code = `${
      template.code
    }\n//# sourceMappingURL=data:application/json;base64,${toBase64(
      JSON.stringify(template.map)
    )}`;
  }
  let cssInJS = "";
  if (descriptor.styles) {
    const styled = descriptor.styles.map((style) => {
      return compiler.compileStyle({
        id,
        source: style.content,
        scoped: style.scoped,
        preprocessLang: style.lang,
      });
    });
    if (styled.length) {
      const cssCode = styled.map((s) => `${s.code}`).join("\n");
      cssInJS = `(function(){const el = document.createElement('style');
el.innerHTML = \`${cssCode}\`;
document.body.appendChild(el);}());`;
    }
  }
  const moduleCode = `
    import script from '${toDataUri(script.content)}';
    import {render} from '${toDataUri(template.code)}';
    script.render = render;
    ${filename ? `script.__file = '${filename}'` : ""};
    ${scopeId ? `script.__scopeId = '${scopeId}'` : ""};
    ${cssInJS}
    export default script;
  `;
  return moduleCode;
}

self.onmessage = async function (event) {
  try {
    const url = toDataUri(await transformVueSFC(...event.data));
    self.postMessage(url);
  } catch (e) {}
};
