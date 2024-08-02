import * as compiler from "@vue/compiler-sfc";

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function toJsDataUri(raw) {
  return `data:application/javascript;base64,${toBase64(raw)}`;
}
function toJsonDataUri(obj) {
  return `data:application/json;base64,${toBase64(
    typeof obj === "string" ? obj : JSON.stringify(obj)
  )}`;
}
function toSourcemapComment(obj) {
  return `\n//# sourceMappingURL=${toJsonDataUri(obj)}`;
}

const console = {
  log(...args) {
    self.postMessage({
      type: "console",
      level: "log",
      args: JSON.parse(JSON.stringify(args)),
    });
  },
  error(...args) {
    self.postMessage({
      type: "console",
      level: "error",
      args: JSON.parse(JSON.stringify(args)),
    });
  },
  info(...args) {
    self.postMessage({
      type: "console",
      level: "info",
      args: JSON.parse(JSON.stringify(args)),
    });
  },
  warn(...args) {
    self.postMessage({
      type: "console",
      level: "warn",
      args: JSON.parse(JSON.stringify(args)),
    });
  },
};

async function transformVueSFC(id, source, filename) {
  const { descriptor, errors } = compiler.parse(source, { filename });
  if (errors.length) throw new Error(errors.toString());

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
  const isTs = (descriptor.script || descriptor.scriptSetup).lang === "ts";
  if (isTs) {
    const swc = await import("@swc/wasm-web");
    await swc.default();

    const { code, map } = await swc.transform(
      `${script.content}${toSourcemapComment(script.map)}`,
      {
        filename: descriptor.filename,
        sourceMaps: true,
        inputSourceMap: true,
        jsc: {
          parser: {
            syntax: "typescript",
          },
          transform: {},
        },
      }
    );
    script.content = `${code}${toSourcemapComment(map)}`;
  } else if (script.map) {
    script.content = `${script.content}${toSourcemapComment(script.map)}`;
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
    template.code = `${template.code}${toSourcemapComment(template.map)}`;
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
    import script from '${toJsDataUri(script.content)}';
    import {render} from '${toJsDataUri(template.code)}';
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
    const url = toJsDataUri(await transformVueSFC(...event.data));
    self.postMessage({ type: "transform", data: url });
  } catch (e) {
    console.error(e.message);
  }
};
