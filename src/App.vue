<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="h-dvh flex flex-col">
    <header>
      <div class="bg-gray-800 p-3 text-center text-white">
        <nav class="flex gap-5 justify-center text-xl font-bold">
          <RouterLink
            class="hover:underline hover:text-white/50 transition-colors"
            :to="{ name: 'home' }"
            >Home</RouterLink
          >
          <RouterLink
            class="hover:underline hover:text-white/50 transition-colors"
            :to="{ name: 'game' }"
            >Game</RouterLink
          >
        </nav>
      </div>
    </header>

    <RouterView />
  </div>
</template>
