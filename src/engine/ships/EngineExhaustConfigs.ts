import { Color4 } from '@babylonjs/core';

/**
 * Color gradient point for particle lifecycle
 */
export interface ColorGradientPoint {
  gradient: number; // 0-1 lifecycle position
  color: Color4;
}

/**
 * Size gradient point for particle lifecycle
 */
export interface SizeGradientPoint {
  gradient: number; // 0-1 lifecycle position
  size: number;
}

/**
 * Complete configuration for an engine exhaust effect
 */
export interface EngineExhaustConfig {
  // Emission
  capacity: number;
  emitRate: number;

  // Particle properties
  minSize: number;
  maxSize: number;
  minSpeed: number;
  maxSpeed: number;
  minLifeTime: number;
  maxLifeTime: number;

  // Spread - affects direction cone (0 = tight, 1 = wide)
  spread: number;

  // Visual gradients at low throttle (blends toward highThrottleColors at full throttle)
  colorGradients: ColorGradientPoint[];

  // Colors shift toward these at high throttle (more intense/white-hot)
  highThrottleColorGradients: ColorGradientPoint[];

  // Size over lifetime
  sizeGradients: SizeGradientPoint[];
}

/**
 * Standard exhaust colors: white core → blue → orange → fade
 */
const STANDARD_COLORS: ColorGradientPoint[] = [
  { gradient: 0.0, color: new Color4(0.8, 0.85, 1, 0.8) },
  { gradient: 0.2, color: new Color4(0.4, 0.6, 1, 0.7) },
  { gradient: 0.5, color: new Color4(0.8, 0.4, 0.15, 0.5) },
  { gradient: 1.0, color: new Color4(0.6, 0.2, 0.05, 0) },
];

/**
 * High throttle colors: more white-hot, intense
 */
const STANDARD_HIGH_THROTTLE_COLORS: ColorGradientPoint[] = [
  { gradient: 0.0, color: new Color4(1, 1, 1, 1) },
  { gradient: 0.2, color: new Color4(0.7, 0.85, 1, 0.95) },
  { gradient: 0.5, color: new Color4(1, 0.6, 0.3, 0.7) },
  { gradient: 1.0, color: new Color4(1, 0.4, 0.1, 0) },
];

/**
 * Standard size gradient: grow then shrink
 */
const STANDARD_SIZE_GRADIENTS: SizeGradientPoint[] = [
  { gradient: 0.0, size: 0.5 },
  { gradient: 0.3, size: 1.0 },
  { gradient: 1.0, size: 0.2 },
];

/**
 * Engine presets by type - automatically selected based on node name
 */
export const ENGINE_PRESETS: Record<string, EngineExhaustConfig> = {
  ENGINE_SMALL: {
    capacity: 200,
    emitRate: 80,
    minSize: 0.05,
    maxSize: 0.15,
    minSpeed: 1.5,
    maxSpeed: 3,
    minLifeTime: 0.15,
    maxLifeTime: 0.35,
    spread: 0.05,
    colorGradients: STANDARD_COLORS,
    highThrottleColorGradients: STANDARD_HIGH_THROTTLE_COLORS,
    sizeGradients: STANDARD_SIZE_GRADIENTS,
  },

  ENGINE_MEDIUM: {
    capacity: 400,
    emitRate: 120,
    minSize: 0.1,
    maxSize: 0.25,
    minSpeed: 2,
    maxSpeed: 4.5,
    minLifeTime: 0.2,
    maxLifeTime: 0.45,
    spread: 0.08,
    colorGradients: STANDARD_COLORS,
    highThrottleColorGradients: STANDARD_HIGH_THROTTLE_COLORS,
    sizeGradients: STANDARD_SIZE_GRADIENTS,
  },

  ENGINE_LARGE: {
    capacity: 600,
    emitRate: 180,
    minSize: 0.15,
    maxSize: 0.4,
    minSpeed: 2.5,
    maxSpeed: 6,
    minLifeTime: 0.25,
    maxLifeTime: 0.55,
    spread: 0.1,
    colorGradients: STANDARD_COLORS,
    highThrottleColorGradients: STANDARD_HIGH_THROTTLE_COLORS,
    sizeGradients: STANDARD_SIZE_GRADIENTS,
  },

  ENGINE_MASSIVE: {
    capacity: 1000,
    emitRate: 300,
    minSize: 0.25,
    maxSize: 0.7,
    minSpeed: 3,
    maxSpeed: 8,
    minLifeTime: 0.3,
    maxLifeTime: 0.7,
    spread: 0.12,
    colorGradients: STANDARD_COLORS,
    highThrottleColorGradients: STANDARD_HIGH_THROTTLE_COLORS,
    sizeGradients: STANDARD_SIZE_GRADIENTS,
  },

  // Default fallback
  DEFAULT: {
    capacity: 500,
    emitRate: 150,
    minSize: 0.1,
    maxSize: 0.3,
    minSpeed: 2,
    maxSpeed: 5,
    minLifeTime: 0.2,
    maxLifeTime: 0.5,
    spread: 0.1,
    colorGradients: STANDARD_COLORS,
    highThrottleColorGradients: STANDARD_HIGH_THROTTLE_COLORS,
    sizeGradients: STANDARD_SIZE_GRADIENTS,
  },
};

/**
 * Color scheme presets for different engine styles
 */
export const COLOR_SCHEMES = {
  standard: {
    low: STANDARD_COLORS,
    high: STANDARD_HIGH_THROTTLE_COLORS,
  },

  ion: {
    low: [
      { gradient: 0.0, color: new Color4(0.6, 0.8, 1, 0.8) },
      { gradient: 0.3, color: new Color4(0.3, 0.6, 1, 0.7) },
      { gradient: 0.6, color: new Color4(0.1, 0.4, 0.9, 0.4) },
      { gradient: 1.0, color: new Color4(0.05, 0.2, 0.6, 0) },
    ],
    high: [
      { gradient: 0.0, color: new Color4(0.9, 1, 1, 1) },
      { gradient: 0.3, color: new Color4(0.5, 0.8, 1, 0.9) },
      { gradient: 0.6, color: new Color4(0.2, 0.6, 1, 0.6) },
      { gradient: 1.0, color: new Color4(0.1, 0.3, 0.8, 0) },
    ],
  },

  plasma: {
    low: [
      { gradient: 0.0, color: new Color4(0.9, 0.7, 1, 0.8) },
      { gradient: 0.3, color: new Color4(0.7, 0.3, 0.9, 0.7) },
      { gradient: 0.6, color: new Color4(0.5, 0.1, 0.7, 0.4) },
      { gradient: 1.0, color: new Color4(0.3, 0.05, 0.4, 0) },
    ],
    high: [
      { gradient: 0.0, color: new Color4(1, 0.9, 1, 1) },
      { gradient: 0.3, color: new Color4(0.9, 0.5, 1, 0.9) },
      { gradient: 0.6, color: new Color4(0.7, 0.2, 0.9, 0.6) },
      { gradient: 1.0, color: new Color4(0.5, 0.1, 0.6, 0) },
    ],
  },

  chemical: {
    low: [
      { gradient: 0.0, color: new Color4(1, 0.9, 0.6, 0.8) },
      { gradient: 0.3, color: new Color4(1, 0.6, 0.2, 0.7) },
      { gradient: 0.6, color: new Color4(0.8, 0.3, 0.1, 0.4) },
      { gradient: 1.0, color: new Color4(0.4, 0.1, 0.05, 0) },
    ],
    high: [
      { gradient: 0.0, color: new Color4(1, 1, 0.9, 1) },
      { gradient: 0.3, color: new Color4(1, 0.8, 0.4, 0.9) },
      { gradient: 0.6, color: new Color4(1, 0.5, 0.2, 0.6) },
      { gradient: 1.0, color: new Color4(0.6, 0.2, 0.1, 0) },
    ],
  },
};

/**
 * Get the preset config for an engine node based on its name
 */
export function getPresetForNode(nodeName: string): EngineExhaustConfig {
  if (nodeName.includes('ENGINE_SMALL')) return ENGINE_PRESETS.ENGINE_SMALL!;
  if (nodeName.includes('ENGINE_MEDIUM')) return ENGINE_PRESETS.ENGINE_MEDIUM!;
  if (nodeName.includes('ENGINE_LARGE')) return ENGINE_PRESETS.ENGINE_LARGE!;
  if (nodeName.includes('ENGINE_MASSIVE')) return ENGINE_PRESETS.ENGINE_MASSIVE!;
  return ENGINE_PRESETS.DEFAULT!;
}

/**
 * Create a modified config with a different color scheme
 */
export function withColorScheme(
  config: EngineExhaustConfig,
  scheme: keyof typeof COLOR_SCHEMES,
): EngineExhaustConfig {
  const colors = COLOR_SCHEMES[scheme];
  return {
    ...config,
    colorGradients: colors.low,
    highThrottleColorGradients: colors.high,
  };
}

/**
 * Deep clone a config for safe modification
 */
export function cloneConfig(config: EngineExhaustConfig): EngineExhaustConfig {
  return {
    ...config,
    colorGradients: config.colorGradients.map((g) => ({
      gradient: g.gradient,
      color: g.color.clone(),
    })),
    highThrottleColorGradients: config.highThrottleColorGradients.map((g) => ({
      gradient: g.gradient,
      color: g.color.clone(),
    })),
    sizeGradients: [...config.sizeGradients],
  };
}
