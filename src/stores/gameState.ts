import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface PlayerState {
  speed: number;
  maxSpeed: number;
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
}

export type CameraMode = 'free' | 'follow';

/**
 * Game state store - Bridge between game engine and UI
 * The game engine writes to this store, UI components read from it
 * UI components can send commands back through action methods
 */
export const useGameStore = defineStore('game', () => {
  // Player ship state
  const player = ref<PlayerState>({
    speed: 0,
    maxSpeed: 1,
    throttle: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
  });

  // Camera state
  const cameraMode = ref<CameraMode>('free');

  // Update methods called by game engine
  function updatePlayerSpeed(speed: number) {
    player.value.speed = speed;
  }

  function updatePlayerMaxSpeed(maxSpeed: number) {
    player.value.maxSpeed = maxSpeed;
  }

  function updatePlayerThrottle(throttle: number) {
    player.value.throttle = throttle;
  }

  function updatePlayerOrientation(pitch: number, roll: number, yaw: number) {
    player.value.pitch = pitch;
    player.value.roll = roll;
    player.value.yaw = yaw;
  }

  // Batch update for efficiency - call this once per frame
  function updatePlayerState(state: Partial<PlayerState>) {
    if (state.speed !== undefined) player.value.speed = state.speed;
    if (state.maxSpeed !== undefined) player.value.maxSpeed = state.maxSpeed;
    if (state.throttle !== undefined) player.value.throttle = state.throttle;
    if (state.pitch !== undefined) player.value.pitch = state.pitch;
    if (state.roll !== undefined) player.value.roll = state.roll;
    if (state.yaw !== undefined) player.value.yaw = state.yaw;
  }

  // Camera control actions (called by UI)
  function setCameraMode(mode: CameraMode) {
    cameraMode.value = mode;
  }

  function toggleCameraMode() {
    cameraMode.value = cameraMode.value === 'free' ? 'follow' : 'free';
  }

  return {
    player,
    cameraMode,
    updatePlayerSpeed,
    updatePlayerMaxSpeed,
    updatePlayerThrottle,
    updatePlayerOrientation,
    updatePlayerState,
    setCameraMode,
    toggleCameraMode,
  };
});
