<template>
  <div
    class="fixed bottom-8 left-1/2 -translate-x-1/2 select-none"
  >
    <!-- Main HUD Container -->
    <div
      class="relative flex items-center gap-1 rounded-2xl border bg-gray-800/50 p-1 backdrop-blur-md"
    >
      <!-- Speed Display -->
      <div class="flex flex-col items-end px-4 py-2">
        <div class="flex items-baseline gap-1.5">
          <span class="text-3xl font-bold tabular-nums leading-none text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]">
            {{ formattedSpeed }}
          </span>
          <span class="mb-0.5 text-xs font-medium text-cyan-400/70">m/s</span>
        </div>
        <!-- Speed Bar -->
        <div class="mt-2 h-1 w-32 overflow-hidden rounded-full bg-slate-800/80">
          <div
            class="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-400 shadow-[0_0_8px_rgba(103,232,249,0.6)] transition-all duration-150"
            :style="{ width: speedPercentage + '%' }"
          ></div>
        </div>
        <div class="mt-0.5 text-[8px] font-medium tabular-nums text-slate-500">
          MAX {{ maxSpeed.toFixed(0) }}
        </div>
      </div>

      <!-- Center Divider -->
      <div class="h-20 w-px bg-linear-to-b from-transparent via-slate-600/50 to-transparent"></div>

      <!-- Throttle Display -->
      <div class="grid gap-3 px-4 py-2">
        <!-- Vertical Throttle Bar -->
        <div class="flex flex-col items-center gap-2">
          <div class="text-[9px] font-semibold uppercase tracking-[3px] text-orange-400/60">
            Throttle
          </div>
        </div>

        <!-- Throttle Percentage -->
        <div class="flex gap-2 items-end">
          <div class="text-3xl font-bold tabular-nums leading-none text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]">
            {{ throttlePercentage.toFixed(0) }}
          </div>
          <div class="text-xs font-medium text-orange-400/70">%</div>
        </div>
      </div>
    </div>

    <!-- Bottom Status Light -->
    <div class="mt-1 flex justify-center">
      <div class="h-1 w-16 rounded-full bg-linear-to-r from-transparent via-emerald-500/40 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameState';

const gameStore = useGameStore();

const formattedSpeed = computed(() => {
  return gameStore.player.speed.toFixed(1);
});

const maxSpeed = computed(() => {
  return gameStore.player.maxSpeed;
});

const speedPercentage = computed(() => {
  return Math.min((gameStore.player.speed / gameStore.player.maxSpeed) * 100, 100);
});

const throttlePercentage = computed(() => {
  return Math.max(0, Math.min(gameStore.player.throttle * 100, 100));
});
</script>
