# NoScript SFC

Load vue3 SFC component with inline `<noscript>` or `<template>` tag. Funny :-) :Yeah:

```html
<!DOCTYPE html>
<script defer src="https://unpkg.com/vue-sfc-in-html"></script>
<noscript vue name="MyComponent" mount="#app">
  <script setup>
    import { ref } from "vue";
    const count = ref(0);
  </script>

  <template>
    <button @click="count++">Count is: {{ count }}</button>
  </template>

  <style scoped>
    button {
      font-weight: bold;
      color: red;
    }
  </style>
</noscript>
<body>
  <div id="app"></div>
</body>
```

You can also use `template` tag instead of `noscript`.

```html
<!DOCTYPE html>
<script defer src="https://unpkg.com/vue-sfc-in-html"></script>
<template vue name="MyComponent" mount="#app">
  <script setup>
    import { ref } from "vue";
    const count = ref(0);
  </script>

  <template>
    <button @click="count++">Count is: {{ count }}</button>
  </template>

  <style scoped>
    button {
      font-weight: bold;
      color: red;
    }
  </style>
</template>
<body>
  <div id="app"></div>
</body>
```

`src` is also supported.

```html
<!DOCTYPE html>
<script defer src="https://unpkg.com/vue-sfc-in-html"></script>
<body>
  <script type="sfc-importmap">
    {
      "imports": {
        "@tanstack/vue-virtual": "https://esm.sh/@tanstack/vue-virtual"
      }
    }
  </script>

  <template
    vue
    name="MyComponent"
    src="https://raw.githubusercontent.com/AngusFu/vue-sfc-in-html/fork-main/example/vue/test.vue"
    mount="#app"
  ></template>
  <div id="app"></div>
</body>
```
