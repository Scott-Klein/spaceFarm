<template>
  <div class="relative bg-slate-900 select-auto text-green-400 p-4 w-full h-full text-xs font-mono overflow-y-auto break-all">
    <button
      class="sticky top-0 float-right ml-2 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-sans disabled:opacity-50"
      :disabled="!logs.length"
      @click="copyLogs"
    >
      {{ copied ? 'Copied!' : 'Copy' }}
    </button>
    <p v-for="log in logs" :key="log">{{ log }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import useLogStore from '@/stores/logs';

const logger = useLogStore();
const { logs } = storeToRefs(logger);

const copied = ref(false);
let timeout: ReturnType<typeof setTimeout> | undefined;

async function copyLogs() {
  try {
    await navigator.clipboard.writeText(logs.value.join('\n'));
    copied.value = true;
    clearTimeout(timeout);
    timeout = setTimeout(() => (copied.value = false), 1500);
  } catch (err) {
    console.error('Failed to copy logs:', err);
  }
}
</script>
