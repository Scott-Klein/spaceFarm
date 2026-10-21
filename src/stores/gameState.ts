import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CameraMode, Command, CommandType, DroneState, Marker, PlayerState } from '@/types/game';
import type Drone from '@/engine/objects/ships/Drone';

/**
 * Game state store - Bridge between game engine and UI
 * The game engine writes to this store, UI components read from it
 * UI components can send commands back through action methods
 */
const useGameStore = defineStore('game', () => {
  // Player ship state
  const player = ref<PlayerState>({
    speed: 0,
    maxSpeed: 1,
    throttle: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
  });

  const commandQueue = ref<Command[]>([])
  const drones = ref<DroneState[]>([]);
  const markers = ref<Marker[]>([]);

  const frameRate = ref<string>();

  // Camera state
  const cameraMode = ref<CameraMode>('free');

  // Update methods called by game engine
  const updatePlayerSpeed = (speed: number) => {
    player.value.speed = speed;
  }

  const updatePlayerMaxSpeed = (maxSpeed: number) => {
    player.value.maxSpeed = maxSpeed;
  }

  const updatePlayerThrottle = (throttle: number) => {
    player.value.throttle = throttle;
  }

  /** Snapshot a bay's drones (keyed by engine object key) into UI-friendly state. */
  const updateDrones = (bayDrones: ReadonlyMap<string, Drone> | undefined) => {
    drones.value = [...(bayDrones ?? [])].map(([key, drone]) => toDroneState(key, drone));
  }

  const pushCommand = (key: string, command: CommandType) => {
    commandQueue.value.push({target: key, command})
  }

  const drainCommandQueue = (): Command[] => {
    const commands = commandQueue.value;
    commandQueue.value = [];

    return commands;
  }

  const updatePlayerOrientation = (pitch: number, roll: number, yaw: number) => {
    player.value.pitch = pitch;
    player.value.roll = roll;
    player.value.yaw = yaw;
  }

  // Batch update for efficiency - call this once per framezzzzzzzzz
  const updatePlayerState = (state: Partial<PlayerState>) => {
    if (state.speed !== undefined) player.value.speed = state.speed;
    if (state.maxSpeed !== undefined) player.value.maxSpeed = state.maxSpeed;
    if (state.throttle !== undefined) player.value.throttle = state.throttle;
    if (state.pitch !== undefined) player.value.pitch = state.pitch;
    if (state.roll !== undefined) player.value.roll = state.roll;
    if (state.yaw !== undefined) player.value.yaw = state.yaw;
  }

  // Camera control actions (called by UI)
  const setCameraMode = (mode: CameraMode) => {
    cameraMode.value = mode;
  }

  const toggleCameraMode = () => {
    cameraMode.value = cameraMode.value === 'free' ? 'follow' : 'free';
  }

  return {
    player,
    cameraMode,
    frameRate,
    markers,
    drones,
    updateDrones,
    updatePlayerSpeed,
    updatePlayerMaxSpeed,
    updatePlayerThrottle,
    updatePlayerOrientation,
    updatePlayerState,
    setCameraMode,
    toggleCameraMode,
    pushCommand,
    drainCommandQueue
  };
});

const toDroneState = (key: string, drone: Drone): DroneState => ({
  key,
  type: drone.droneType,
  health: drone.health,
  cargo: drone.cargo,
});

export default useGameStore;
