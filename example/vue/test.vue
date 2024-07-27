<script setup>
import { ref } from "vue";
import logo from "../assets/logo.svg";
const msg = ref("Hello World!");
</script>

<template>
  <img :src="logo" width="100" alt="" />
  <h1>{{ msg }}</h1>
  <input v-model="msg" />
</template>
