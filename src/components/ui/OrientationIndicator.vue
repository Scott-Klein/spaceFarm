<template>
  <div
    class="fixed right-10 top-10 min-w-[200px] select-none rounded-lg border-2 border-emerald-400/60 bg-slate-900/85 p-4 font-mono text-emerald-400 shadow-[0_0_20px_rgba(0,255,136,0.3)] backdrop-blur-sm"
  >
    <div class="mb-3 text-center text-[11px] font-bold uppercase tracking-[2px] opacity-70">
      ORIENTATION
    </div>
    <div class="mb-3 flex justify-center">
      <svg
        viewBox="-50 -50 100 100"
        class="h-[120px] w-[120px] rounded-full border border-emerald-400/30 bg-slate-950/50"
      >
        <!-- Horizon line -->
        <line x1="-40" y1="0" x2="40" y2="0" stroke="rgba(0, 255, 136, 0.6)" stroke-width="1" />

        <!-- Pitch indicator -->
        <g :transform="`rotate(${-roll})`">
          <line
            v-for="i in pitchLines"
            :key="i"
            x1="-30"
            :y1="i * 10"
            x2="30"
            :y2="i * 10"
            stroke="rgba(255, 255, 255, 0.3)"
            stroke-width="0.5"
          />
        </g>

        <!-- Center marker -->
        <circle cx="0" cy="0" r="2" fill="#00ff88" opacity="0.8" />
        <line x1="-15" y1="0" x2="-5" y2="0" stroke="#00ff88" stroke-width="2" />
        <line x1="5" y1="0" x2="15" y2="0" stroke="#00ff88" stroke-width="2" />

        <!-- Roll indicator -->
        <line
          x1="0"
          y1="-45"
          x2="0"
          y2="-40"
          :stroke="rollColor"
          stroke-width="2"
          :transform="`rotate(${-roll})`"
        />
      </svg>
    </div>
    <div class="flex flex-col gap-1">
      <div class="flex justify-between text-xs">
        <span class="text-[10px] opacity-70">PITCH:</span>
        <span class="font-bold shadow-[0_0_8px_rgba(0,255,136,0.6)]">{{ pitch.toFixed(1) }}°</span>
      </div>
      <div class="flex justify-between text-xs">
        <span class="text-[10px] opacity-70">ROLL:</span>
        <span class="font-bold shadow-[0_0_8px_rgba(0,255,136,0.6)]">{{ roll.toFixed(1) }}°</span>
      </div>
      <div class="flex justify-between text-xs">
        <span class="text-[10px] opacity-70">YAW:</span>
        <span class="font-bold shadow-[0_0_8px_rgba(0,255,136,0.6)]">{{ yaw.toFixed(1) }}°</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameState';

const gameStore = useGameStore();

const pitch = computed(() => gameStore.player.pitch);
const roll = computed(() => gameStore.player.roll);
const yaw = computed(() => gameStore.player.yaw);

const pitchLines = computed(() => {
  return [-4, -3, -2, -1, 1, 2, 3, 4];
});

const rollColor = computed(() => {
  const absRoll = Math.abs(roll.value);
  if (absRoll > 60) return '#ff4444';
  if (absRoll > 30) return '#ffaa00';
  return '#00ff88';
});
</script>
