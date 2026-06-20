import { ref } from 'vue';
import { defineStore } from 'pinia';

const useLogStore = defineStore('logs', () => {
  const logs = ref<string[]>([]);

  const log = (message: string) => {
    logs.value.push(message);
  };
  return { logs, log };
});


export default useLogStore;
