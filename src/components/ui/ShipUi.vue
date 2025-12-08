<template>
  <div
    class="fixed bottom-8 left-1/2 -translate-x-1/2 select-none"
  >
    <!-- Main HUD Container -->
    <div
      class="relative flex items-center gap-1 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-1 shadow-[0_0_40px_rgba(6,182,212,0.15)] backdrop-blur-md"
    >
      <!-- Left Accent Line -->
      <div class="h-16 w-0.5 rounded-full bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent"></div>

      <!-- Speed Display -->
      <div class="flex flex-col items-end px-4 py-2">
        <div class="mb-0.5 text-[9px] font-semibold uppercase tracking-[3px] text-cyan-400/60">
          Velocity
        </div>
        <div class="flex items-baseline gap-1.5">
          <span class="text-3xl font-bold tabular-nums leading-none text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]">
            {{ formattedSpeed }}
          </span>
          <span class="mb-0.5 text-xs font-medium text-cyan-400/70">m/s</span>
        </div>
        <!-- Speed Bar -->
        <div class="mt-2 h-1 w-32 overflow-hidden rounded-full bg-slate-800/80">
          <div
            class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_8px_rgba(103,232,249,0.6)] transition-all duration-150"
            :style="{ width: speedPercentage + '%' }"
          ></div>
        </div>
        <div class="mt-0.5 text-[8px] font-medium tabular-nums text-slate-500">
          MAX {{ maxSpeed.toFixed(0) }}
        </div>
      </div>

      <!-- Center Divider -->
      <div class="h-20 w-px bg-gradient-to-b from-transparent via-slate-600/50 to-transparent"></div>

      <!-- Throttle Display -->
      <div class="flex items-center gap-3 px-4 py-2">
        <!-- Vertical Throttle Bar -->
        <div class="flex flex-col items-center gap-2">
          <div class="text-[9px] font-semibold uppercase tracking-[3px] text-orange-400/60">
            Throttle
          </div>
          <div class="relative h-16 w-6 overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-orange-500/20">
            <!-- Throttle Fill -->
            <div
              class="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-orange-500 via-orange-400 to-amber-300 shadow-[0_0_12px_rgba(251,146,60,0.6)] transition-all duration-100"
              :style="{ height: throttlePercentage + '%' }"
            ></div>
            <!-- Grid Lines -->
            <div class="pointer-events-none absolute inset-0 flex flex-col justify-between p-1">
              <div v-for="i in 4" :key="i" class="h-px w-full bg-white/10"></div>
            </div>
          </div>
        </div>

        <!-- Throttle Percentage -->
        <div class="flex flex-col items-start">
          <div class="text-3xl font-bold tabular-nums leading-none text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]">
            {{ throttlePercentage.toFixed(0) }}
          </div>
          <div class="text-xs font-medium text-orange-400/70">%</div>
        </div>
      </div>

      <!-- Right Accent Line -->
      <div class="h-16 w-0.5 rounded-full bg-gradient-to-b from-transparent via-orange-400/50 to-transparent"></div>
    </div>

    <!-- Bottom Status Light -->
    <div class="mt-1 flex justify-center">
      <div class="h-1 w-16 rounded-full bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
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
