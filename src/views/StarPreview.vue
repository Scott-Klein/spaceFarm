<template>
  <div class="w-full h-full bg-green-200 flex flex-col">
    <p>Stars</p>
    <canvas ref="canvas" class="w-1/2 h-1/2"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { makeStarMap } from '@/engine/starSkyBox';

const canvas = ref<HTMLCanvasElement>();

onMounted(() => {
  const cv = canvas.value;
  if (!cv) return;

  const starMap = makeStarMap();
  cv.width = starMap.width;
  cv.height = starMap.height;
  cv.getContext('2d')?.drawImage(starMap, 0, 0);
});
</script>
