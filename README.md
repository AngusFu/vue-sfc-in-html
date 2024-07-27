# NoScript SFC

Load vue3 SFC component with inline `<noscript>` or `<template>` tag. Funny :-) :Yeah:

```html
<!DOCTYPE html>
<script defer src="https://unpkg.com/vue-sfc-in-html"></script>
<noscript vue name="MyComponent" mount="#app">
  <script>
    export default {
      data() {
        return {
          count: 0,
        };
      },
    };
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
  <script>
    export default {
      data() {
        return {
          count: 0,
        };
      },
    };
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
  <noscript vue src="./example/vue/test.vue" mount="#app"></noscript>
  <div id="app"></div>
</body>
```
