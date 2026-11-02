<script setup>
import { computed, ref } from 'vue';
import { invoiceTotal } from './invoice.js';
const lines = ref([{price:17,quantity:3},{price:11,quantity:2}]);
const total = computed(() => invoiceTotal(lines.value));
const orders = ref(location.pathname === '/orders');
function openOrders() { history.pushState({}, '', '/orders'); orders.value = true; }
</script>
<template>
  <main><h1>{{ orders ? 'Orders total: ' : 'Vue component total: ' }}{{ total }}</h1>
  <button @click="lines.push({price:8,quantity:1})">Add item</button>
  <button @click="openOrders">Open orders</button></main>
</template>
