<template>
  <div
    class="fixed left-10 top-10 min-w-[200px] select-none rounded-lg border-2 border-blue-400/60 bg-slate-900/85 p-4 font-mono text-blue-400 shadow-[0_0_20px_rgba(100,150,255,0.3)] backdrop-blur-sm"
  >
    <div class="mb-3 text-center text-[11px] font-bold uppercase tracking-[2px] opacity-70">
      CONTROLS
    </div>
    <div class="mb-3">
      <div
        class="mb-1.5 border-b border-blue-400/20 pb-1 text-[9px] font-bold uppercase tracking-[1.5px] opacity-50"
      >
        FLIGHT
      </div>
      <div class="mb-1 flex items-center justify-between py-0.5 text-[11px]">
        <span
          class="min-w-[50px] rounded border border-blue-400/40 bg-blue-400/20 px-1.5 py-0.5 text-center text-[10px] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          >W/S</span
        >
        <span class="ml-2 flex-1 text-right text-[10px] opacity-80">Pitch Up/Down</span>
      </div>
      <div class="mb-1 flex items-center justify-between py-0.5 text-[11px]">
        <span
          class="min-w-[50px] rounded border border-blue-400/40 bg-blue-400/20 px-1.5 py-0.5 text-center text-[10px] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          >A/D</span
        >
        <span class="ml-2 flex-1 text-right text-[10px] opacity-80">Yaw Left/Right</span>
      </div>
      <div class="mb-1 flex items-center justify-between py-0.5 text-[11px]">
        <span
          class="min-w-[50px] rounded border border-blue-400/40 bg-blue-400/20 px-1.5 py-0.5 text-center text-[10px] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          >Q/E</span
        >
        <span class="ml-2 flex-1 text-right text-[10px] opacity-80">Roll Left/Right</span>
      </div>
    </div>
    <div>
      <div
        class="mb-1.5 border-b border-blue-400/20 pb-1 text-[9px] font-bold uppercase tracking-[1.5px] opacity-50"
      >
        THROTTLE
      </div>
      <div class="mb-1 flex items-center justify-between py-0.5 text-[11px]">
        <span
          class="min-w-[50px] rounded border border-blue-400/40 bg-blue-400/20 px-1.5 py-0.5 text-center text-[10px] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          >SHIFT</span
        >
        <span class="ml-2 flex-1 text-right text-[10px] opacity-80">Hold to Increase</span>
      </div>
      <div class="mb-1 flex items-center justify-between py-0.5 text-[11px]">
        <span
          class="min-w-[50px] rounded border border-blue-400/40 bg-blue-400/20 px-1.5 py-0.5 text-center text-[10px] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          >CTRL</span
        >
        <span class="ml-2 flex-1 text-right text-[10px] opacity-80">Hold to Decrease</span>
      </div>
    </div>
    <div>
      <div
        class="mb-1.5 border-b border-blue-400/20 pb-1 text-[9px] font-bold uppercase tracking-[1.5px] opacity-50"
      >
        VIEW
      </div>
      <div class="mb-1 flex items-center justify-between py-0.5 text-[11px]">
        <span
          class="min-w-[50px] rounded border border-blue-400/40 bg-blue-400/20 px-1.5 py-0.5 text-center text-[10px] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          >C</span
        >
        <span class="ml-2 flex-1 text-right text-[10px] opacity-80">Toggle Camera</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props needed - static display
</script>
