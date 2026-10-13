/**
 * Procedural Milky Way sky map: a 2:1 equirectangular texture meant to be wrapped on an
 * inverted sphere with mipmaps off, u repeating and v clamped.
 *
 * Mapping: u = longitude / 360 across the width, v = acos(y) / PI down the height, so a
 * texel looks along (sin(PI v) cos(2 PI u), cos(PI v), sin(PI v) sin(2 PI u)).
 *
 * How it is built, and why:
 * - Everything is evaluated per texel in the galactic frame from 3D noise sampled on the
 *   unit sphere. That makes the map seamless at u = 0/1 and free of pole pinch by
 *   construction, and lets the band be any great circle.
 * - Light is summed in linear floating point and tone mapped to 8 bits once at the end
 *   (soft shoulder, then gamma), so the core and stacked stars keep their structure.
 * - Stars are splatted analytically with their true angular footprint, so they stay round
 *   on the sphere right up to the poles, and their positions come from a per-star seeded
 *   generator: the same seed gives the same sky at every `size`, only sharper.
 *
 * Nothing here touches the DOM beyond OffscreenCanvas, so it runs in a worker.
 */

type RGB = [number, number, number];

/** A tunable: its default `value` and the range worth exploring (not a hard limit). */
export interface StarMapRange<T> {
  value: T;
  min: number;
  max: number;
  step: number;
}

const niceStep = (min: number, max: number) => 10 ** Math.floor(Math.log10((max - min) / 100));
/** num(default, min, max, step?) */
const num = (value: number, min: number, max: number, step = niceStep(min, max)) => ({
  value,
  min,
  max,
  step,
});
/** int(default, min, max, step?): whole numbers only */
const int = (value: number, min: number, max: number, step = 1) => ({ value, min, max, step });
/** rgb(r, g, b, min?, max?): per-channel triple */
const rgb = (r: number, g: number, b: number, min = 0, max = 1, step = 0.01) => ({
  value: [r, g, b] as RGB,
  min,
  max,
  step,
});

/**
 * Every option, as `name: num(default, min, max)`. This is the single source of truth:
 * StarMapOpts and STAR_MAP_DEFAULTS are derived from it, and the tuning view builds its
 * sliders from it.
 *
 * Units: angles are degrees. "px" lengths are texels at an 8192-wide map and scale with
 * `size`, so a look tuned at one size holds at another. Intensities are linear light where
 * 1.0 is display white before the tone curve. Noise frequencies are cells per radian of
 * sky (f = 3 gives features roughly 20 degrees across).
 */
export const STAR_MAP_RANGES = {
  /** Texture width in texels; the height is half of it. */
  size: int(8192, 512, 16384, 512),
  /** Seed for everything. Same seed, same sky. */
  seed: int(11, 0, 9999),

  band: {
    /** Inclination of the galactic plane to the texture equator. 0 runs it along v = 0.5. */
    tilt: num(0, 0, 90, 1),
    /** Longitude of the axis the plane is tilted about (where the band crosses the equator). */
    node: num(0, 0, 360, 1),
    /** Tightness: Gaussian sigma of the bright thin disk, in degrees of galactic latitude. */
    sigma: num(4.2, 1.5, 20),
    /** Sigma of the faint broad skirt under the thin disk. */
    wideSigma: num(13, 4, 45),
    /** Peak of the broad skirt relative to the thin disk. */
    wideLevel: num(0.03, 0, 1),
    /** Mid-plane brightness of the disk far from the core, before structure. */
    intensity: num(0.02, 0, 0.5, 0.001),
    /** How far the band centreline wanders off the great circle. */
    warp: num(1.2, 0, 6),
    /** Frequency of that wander along the band. */
    warpFrequency: num(2.2, 0.5, 8),
    /** Disk tint (linear RGB multipliers). */
    color: rgb(0.78, 0.83, 1.0, 0, 1.5),
  },

  core: {
    /** Position of the galactic centre along the band; with tilt 0 this is u * 360. */
    longitude: num(180, 0, 360, 1),
    /** Tight bulge: sigma along the band. */
    bulgeWidth: num(7.5, 2, 30),
    /** Tight bulge: sigma out of the plane. Larger than band.sigma, so it swells. */
    bulgeHeight: num(5, 2, 25),
    /** Tight bulge: peak brightness. */
    bulgeIntensity: num(0.55, 0, 2),
    /** How much of the glow structure the bulge inherits (0 = perfectly smooth). */
    bulgeStructure: num(0.35, 0, 1),
    /** Bulge tint: old stars, warmer than the disk. */
    bulgeColor: rgb(1.0, 0.83, 0.6, 0, 1.5),
    /** Wide brightening toward the core: sigma along the band. */
    wideWidth: num(55, 10, 120, 1),
    /** Wide brightening: extra disk brightness at the core, as a multiple of band.intensity. */
    wideIntensity: num(4.5, 0, 12),
    /** How much the thin disk thickens toward the core (0 = constant width). */
    flare: num(0.25, 0, 2),
  },

  /** Unresolved starlight: fbm that modulates the disk multiplicatively. */
  glow: {
    /** fbm octaves. Octaves finer than output.minFeature are dropped automatically. */
    octaves: int(9, 1, 10),
    /** Base frequency. Low values give star clouds tens of degrees long. */
    frequency: num(4, 0.5, 12),
    /** Frequency ratio between octaves. */
    lacunarity: num(2.03, 1.6, 3),
    /** Amplitude ratio between octaves. Higher is grainier. */
    gain: num(0.72, 0.3, 0.85),
    /** Contrast of the structure (std of log brightness is about a third of this). */
    amplitude: num(0.75, 0, 4),
    /** Coarse octaves are this much longer along the band than across it. */
    stretch: num(1.8, 1, 5),
    /** Overall strength of the whole diffuse glow. */
    alpha: num(0.85, 0, 3),
  },

  /** Resolved stars of the band. */
  stars: {
    /** Number of band stars. */
    count: int(1100000, 0, 3000000, 10000),
    /** Power-law base: each magnitude fainter holds this many times more stars. */
    magnitudeBase: num(2.45, 1.5, 4),
    /** Magnitudes between the brightest and the faintest star. */
    magnitudeRange: num(12, 4, 16),
    /** Outer radius of the faintest star, px. */
    sizeFloor: num(1.8, 1, 8),
    /** Outer radius of the brightest star, px. */
    sizeCeil: num(70, 10, 400, 1),
    /** Shapes size against magnitude: above 1 keeps all but the very brightest small. */
    sizeCurve: num(1.3, 0.3, 3),
    /** Peak intensity of the faintest star. */
    alphaFloor: num(0.045, 0.002, 1, 0.001),
    /** Peak intensity of the brightest star. Above 1 blows the core out to white. */
    alphaCeil: num(6, 0.5, 40, 0.1),
    /** Shapes peak intensity against magnitude. */
    alphaCurve: num(1, 0.3, 3),
    /** Colour saturation of the faintest stars (0 = white, 1 = true blackbody). */
    saturation: num(0.9, 0, 1.5),
    /** Fraction of that saturation removed from the brightest stars. */
    desaturate: num(0.8, 0, 1),
    /** Coolest star, kelvin. */
    tempMin: num(3200, 2000, 6000, 50),
    /** Hottest star, kelvin. */
    tempMax: num(20000, 7000, 40000, 100),
    /** Weighting toward the hot end (1 = even spread from orange to blue, more = bluer). */
    colorBias: num(1.6, 0.4, 4),
    /** Latitude spread of the stars relative to the glow (above 1 = wider than the glow). */
    bandSpread: num(1.8, 0.5, 4),
    /** How strongly star density follows the glow structure. */
    clustering: num(0.9, 0, 3),
    /** Extra star density toward the core, following core.wideWidth. */
    coreConcentration: num(1.5, 0, 6),
    /** Fraction of band stars that belong to the bulge. */
    bulgeFraction: num(0.12, 0, 0.6),
    /** Chance that the very brightest stars are placed anywhere on the sky. */
    brightIsotropy: num(0.7, 0, 1),

    /** Point spread function. Stops are fractions of the star's outer radius. */
    psf: {
      /** Sigma of the hot core. */
      core: num(0.035, 0.005, 0.3, 0.001),
      /** Smallest core sigma, px. Guards against aliasing with mipmaps off. */
      minCore: num(0.55, 0.4, 2),
      /** Knee stop: where the skirt starts to fall away. */
      knee: num(0.05, 0.01, 0.5),
      /** Skirt brightness at the centre, relative to the core peak. */
      skirtLevel: num(0.06, 0, 0.5, 0.005),
      /** How fast the skirt falls beyond the knee (power-law exponent). */
      skirtPower: num(2.4, 1, 5),
    },
    /** Diffraction spikes on the brightest few. */
    spikes: {
      /** Brightness along a spike relative to the core peak. 0 turns spikes off. */
      intensity: num(0.25, 0, 2),
      /** Normalised brightness (0 faintest, 1 brightest) above which a star gets spikes. */
      threshold: num(0.97, 0.5, 1),
      /** Number of points. */
      count: int(4, 2, 8),
      /** Length as a multiple of the star's outer radius. */
      length: num(0.55, 0.1, 4),
      /** Width (sigma), px. Never drawn thinner than half a texel. */
      width: num(0.9, 0.5, 4),
      /** Rotation of the spike pattern. */
      angle: num(12, 0, 90, 1),
      /** How quickly a spike fades along its length. */
      falloff: num(4, 0.5, 12),
    },
    /** Airy / halation ring on the brightest few. */
    rings: {
      /** Ring brightness relative to the core peak. 0 turns rings off. */
      intensity: num(0, 0, 0.3, 0.001),
      /** Normalised brightness above which a star gets a ring. */
      threshold: num(0.88, 0.5, 1),
      /** Ring radius as a fraction of the star's outer radius. */
      radius: num(0.3, 0.05, 0.9),
      /** Ring thickness (sigma) as a fraction of the star's outer radius. */
      width: num(0.06, 0.005, 0.2, 0.001),
    },
  },

  /** Dark nebulae, applied as wavelength-dependent extinction. */
  dust: {
    /** Sigma of the dust layer. Independent of, and thinner than, the star band. */
    sigma: num(6, 1.5, 20),
    /** Octaves of the cloud body. Octaves finer than output.minFeature are dropped. */
    octaves: int(9, 1, 10),
    /** Base frequency of the cloud body. */
    frequency: num(7, 1, 20),
    /** Frequency ratio between octaves. */
    lacunarity: num(2.1, 1.6, 3),
    /** Amplitude ratio between octaves. Higher gives more ragged edges. */
    gain: num(0.78, 0.3, 0.9),
    /** Coarse structure is this much longer along the band than across it. */
    stretch: num(1.35, 1, 6),
    /** How strongly ridged noise breaks the clouds up into filaments (0 = plain clouds). */
    ridgeMix: num(1.05, 0, 3),
    /** Base frequency of the ridged filaments. */
    ridgeFrequency: num(10, 1, 30),
    /** Octaves of ridged noise. */
    ridgeOctaves: int(3, 1, 8),
    /** Ridge sharpening exponent. Higher leaves only the crease of each ridge. */
    ridgeSharpness: num(4, 0.5, 10),
    /** How far finer ridges are confined to coarser ones (0 = everywhere). */
    ridgeCascade: num(0.5, 0, 1),
    /** Domain-warp strength per pass, in cells of that pass. This is what bends the
     *  filaments; much above 0.2 the dust stops looking torn and starts to marble. */
    warp: num(0.1, 0, 1),
    /** Frequency of the first warp pass. */
    warpFrequency: num(3, 0.5, 12),
    /** Number of warp passes, each one finer than the last. */
    warpPasses: int(3, 0, 6),
    /** 0 pushes along the noise gradient (billows and pinches), 1 slides along its level
     *  lines (swirls). */
    warpSwirl: num(0.5, 0, 1),
    /** How much of the warp the finest octaves follow. Low keeps detail from smearing. */
    warpDetail: num(0.3, 0, 1),
    /** How much of the mid-plane carries dust (threshold on the noise). */
    coverage: num(0.12, 0, 1),
    /** Width of the clear-to-dense ramp. Smaller is harder edged. */
    softness: num(0.35, 0.05, 1.5),
    /** Optical depth of the translucent veil around the dense dust. Dims and reddens. */
    veil: num(1, 0, 3),
    /** How much further than the dense dust the veil spreads (extra coverage, as a
     *  fraction). This thin, wide dust is what mottles the band. */
    veilReach: num(2.5, 0, 6),
    /** Shape of the dense ramp. Higher keeps cores compact and their edges crisp. */
    gamma: num(2.8, 0.5, 8),
    /** Optical depth the dense ramp adds where it reaches 1. */
    opacity: num(4.5, 0, 12),
    /** Ceiling on optical depth: how black the densest cores get. */
    tauMax: num(5.5, 0.5, 10),
    /** Extinction per unit optical depth, red. Blue is the largest, so thin dust reddens. */
    kR: num(0.55, 0, 3),
    /** Extinction per unit optical depth, green. */
    kG: num(0.82, 0, 3),
    /** Extinction per unit optical depth, blue. */
    kB: num(1.25, 0, 3),
    /** Fraction of the glow in front of the dust; lifts the lanes off pure black. */
    foregroundGlow: num(0.02, 0, 0.6),
    /** Extra dust coverage toward the core. */
    innerBoost: num(0.32, 0, 1),
    /** Sigma, along the band, of that extra coverage. */
    innerWidth: num(30, 10, 120, 1),
    /** Fraction of the faintest stars that sit in front of the dust. */
    foregroundStars: num(0.04, 0, 1),
    /** Normalised star brightness above which every star is in front of the dust. */
    foregroundBrightness: num(0.6, 0.05, 1),
    /** Shapes the rise between those two: above 1 keeps mid-brightness stars behind. */
    foregroundCurve: num(2, 0.3, 4),

    /** The long dark lane along the band axis. */
    rift: {
      /** Offset of the lane from the mid-plane. */
      position: num(2, -10, 10),
      /** Sigma of the lane. */
      width: num(2.2, 0.5, 10),
      /** How broken up the lane is along its length (0 = continuous). */
      patchiness: num(0.5, 0, 1),
      /** Extra dust coverage inside the lane. */
      strength: num(0.35, 0, 1.5),
      /** How far the lane wanders above and below its position. */
      wander: num(2, 0, 8),
      /** Frequency of the wander along the band. */
      frequency: num(3, 0.5, 12),
      /** Frequency of the breaks along the band. */
      patchFrequency: num(6, 0.5, 24),
      /** Sigma of the lane's reach along the band, centred on the core. */
      extent: num(85, 20, 180, 1),
    },
    /** Isolated dense clouds. */
    knots: {
      /** How many. */
      count: int(20, 0, 60),
      /** Smallest radius (sigma). */
      sizeMin: num(1, 0.3, 6),
      /** Largest radius (sigma). */
      sizeMax: num(5, 0.5, 12),
      /** Extra dust coverage at the centre of a knot. */
      strength: num(0.6, 0, 1.5),
      /** Latitude scatter (sigma) of the knots about the mid-plane. */
      latitude: num(8, 0, 25),
    },
  },

  /** Faint emission and reflection nebulosity. Meant to be felt, not seen. */
  nebulosity: {
    /** Peak brightness. A few percent at most. */
    alpha: num(0.008, 0, 0.2, 0.001),
    /** Base frequency of the patches. */
    frequency: num(3, 0.5, 12),
    /** fbm octaves. */
    octaves: int(3, 1, 8),
    /** Amplitude ratio between octaves. */
    gain: num(0.5, 0.3, 0.85),
    /** Patches are this much longer along the band than across it. */
    stretch: num(1.5, 1, 5),
    /** Frequency at which the hue changes from patch to patch. */
    hueFrequency: num(2, 0.5, 12),
    /** Fraction of the band that carries nebulosity. */
    coverage: num(0.4, 0, 1),
    /** Softness of the patch edges. */
    softness: num(0.5, 0.05, 1.5),
    /** Sigma of the latitude band it is confined to. */
    sigma: num(7, 2, 45),
    /** Hue weight of hydrogen-alpha emission. */
    red: num(1, 0, 2),
    /** Hue weight of reflection nebulae. */
    blue: num(0.6, 0, 2),
    /** Hue weight of oxygen emission. */
    teal: num(0.3, 0, 2),
    /** Hydrogen-alpha tint. */
    redColor: rgb(1.0, 0.25, 0.35),
    /** Reflection tint. */
    blueColor: rgb(0.35, 0.5, 1.0),
    /** Oxygen tint. */
    tealColor: rgb(0.3, 0.9, 0.8),
  },

  background: {
    /** Sky colour with nothing in it, as 8-bit display values. Never pure black. */
    color: rgb(6, 8, 13, 0, 40, 1),
  },

  /** Faint population spread evenly over the whole sphere, so the poles are not empty. */
  halo: {
    /** Number of halo stars. */
    count: int(250000, 0, 1000000, 5000),
    /** Brightness of halo stars relative to band stars of the same magnitude. */
    alpha: num(0.7, 0, 2),
  },

  /** Float to 8-bit conversion. */
  output: {
    /** Linear gain applied before the tone curve. */
    exposure: num(1, 0.2, 4),
    /** Level where the shoulder begins. 1 is a hard clip; lower protects more headroom. */
    knee: num(0.55, 0.05, 1),
    /** Display gamma. */
    gamma: num(2.2, 1, 3),
    /** Dither amplitude in 8-bit steps; hides banding in the dark gradients. */
    dither: num(1, 0, 2),
    /** Smallest noise cell allowed, in actual texels. Guards against aliasing. */
    minFeature: num(2.5, 1, 8),
  },
};

type Values<S> = {
  [K in keyof S]: S[K] extends StarMapRange<infer V> ? V : Values<S[K]>;
};
type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Every option, fully specified. See STAR_MAP_RANGES for what each one means. */
export type StarMapOpts = Values<typeof STAR_MAP_RANGES>;
/** Overrides for makeStarMap: any subset of StarMapOpts, at any depth. */
export type StarMapOverrides = DeepPartial<StarMapOpts>;

const isRange = (x: object): x is StarMapRange<number | RGB> => 'min' in x && 'value' in x;

const defaultsOf = <S extends object>(ranges: S): Values<S> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ranges)) {
    out[k] = isRange(v) ? (Array.isArray(v.value) ? [...v.value] : v.value) : defaultsOf(v);
  }
  return out as Values<S>;
};

/** The default options. Read-only by convention: clone before editing. */
export const STAR_MAP_DEFAULTS: StarMapOpts = defaultsOf(STAR_MAP_RANGES);

const merge = <T extends object>(base: T, over: unknown): T => {
  const o = (typeof over === 'object' && over !== null ? over : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) {
    const ov = o[k];
    if (Array.isArray(v)) {
      out[k] = Array.isArray(ov) && ov.length === v.length ? [...ov] : [...v];
    } else if (typeof v === 'object' && v !== null) out[k] = merge(v, ov);
    else out[k] = typeof ov === 'number' && Number.isFinite(ov) ? ov : v;
  }
  return out as T;
};

// ---------------------------------------------------------------------------------------
// Constants that are not looks: units, numerical guards and performance cut-offs.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** "px" options are quoted at this map width. */
const REF_WIDTH = 8192;
/** Rows rendered per pass; bounds the float buffer to a few MB whatever the map size. */
const STRIP = 64;
/** Linear light below this cannot change an 8-bit texel, so it is not computed. */
const CULL = 2e-5;
/** A star whose peak is below this cannot be told from the bare background. */
const STAR_CULL = 4e-4;
/** Anti-alias guard: no Gaussian (star core, spike, ring) is drawn with a sigma below this
 *  many actual texels, whatever the map size. At 8192 the defaults never reach it. */
const MIN_SIGMA = 0.5;
/** An octave doubles the frequency (nebulosity uses plain octaves). */
const OCTAVE = 2;
/** Two standard deviations of the noise: maps a 0..1 coverage onto its useful range. */
const TWO_SIGMA = 0.66;
/** A star's Gaussian core is windowed to exactly zero at this many sigma. */
const CORE_CUT = 3.6;
/** Resolution of the skirt profile table. */
const LUT_N = 2048;
/** Tone curve table: resolution and the linear value at which it has fully saturated. */
const TONE_N = 4096;
const TONE_MAX = 32;
/** Per-octave domain rotation, so octave lattices never line up (orthonormal). */
const ROT = [0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64];
/** Scales raw gradient noise to a standard deviation of about 1/3 (so ~[-1, 1]). */
const NOISE_NORM = 1.54;
/** Random value added at each lattice point, so the noise is not zero on the lattice. */
const NOISE_VALUE = 0.25;
/** |noise| that maps to the bottom of a ridge (2 sigma). */
const RIDGE_SPAN = 1.5;
/** Spreads fbm (std 1/3) across 0..1 for thresholding. */
const BODY_SPAN = 0.9;
/** A star this many footprint radii from a pole is drawn with the flat-sky footprint. */
const POLAR_REACH = 24;
/** Dust cover below this cannot reach the threshold, so the noise is skipped. */
const COVER_MIN = 0.02;
/** Largest value the noise takes in practice (about 3.6 sigma). */
const NOISE_PEAK = 1.2;
/** A knot's cover is dropped beyond this many sigma. */
const KNOT_REACH = 3;
/** Spreads the 1D noise that breaks up the rift across 0..1. */
const PATCH_CONTRAST = 1.5;
/** Nebulosity hues sit this far apart on the hue noise, with this sharpness. */
const HUE_STEP = 0.3;
const HUE_SHARP = 12.5;
/** Octaves of the glow structure that star density follows; finer ones cost more than they
 *  show. */
const CLUSTER_OCTAVES = 3;
/** Structure value (about 2.4 sigma) at which star clustering stops growing. */
const CLUSTER_CAP = 0.8;
/** Attempts at placing one band star before taking the last candidate. */
const MAX_TRIES = 32;
/** Nebulosity is not evaluated where its latitude envelope has fallen below this. */
const NEB_CUT = 0.02;
/** Samples used to measure the mean of the ridged noise at set-up. */
const RIDGE_SAMPLES = 4000;
/** RMS sky-tangent gradient of the noise per cell; makes warp strengths read in cells. */
const GRAD_RMS = 1.16;

// ---------------------------------------------------------------------------------------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// exp(-x) for x >= 0 from a table: the per-texel envelopes call it a dozen times, and a
// lookup is several times cheaper than Math.exp. Error is below 1e-6.
const EXP_N = 8192;
const EXP_MAX = 20;
const EXP_LUT = new Float64Array(EXP_N + 2);
for (let i = 0; i < EXP_N + 2; i++) EXP_LUT[i] = Math.exp((-i * EXP_MAX) / EXP_N);
const expNeg = (x: number) => {
  if (x >= EXP_MAX) return 0;
  const f = x * (EXP_N / EXP_MAX);
  const i = f | 0;
  return EXP_LUT[i] + (EXP_LUT[i + 1] - EXP_LUT[i]) * (f - i);
};
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** mulberry32 that can be re-seeded in place, so each star gets its own stream cheaply. */
const makeRand = (seed: number) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.seed = (s: number) => {
    a = s >>> 0;
  };
  return next;
};

const hash2 = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * 3D gradient noise with a value term, std about 1/3. `d` is the same noise but also
 * leaves its analytic gradient in `grad`, which is what the dust warp advects along.
 */
const makeNoise = (seed: number) => {
  const GX = new Float64Array(256);
  const GY = new Float64Array(256);
  const GZ = new Float64Array(256);
  const GV = new Float64Array(256);
  const rand = makeRand(hash2(seed, 0x51ed));
  for (let i = 0; i < 256; i++) {
    const z = 2 * rand() - 1;
    const a = TAU * rand();
    const s = Math.sqrt(1 - z * z);
    GX[i] = s * Math.cos(a) * NOISE_NORM;
    GY[i] = s * Math.sin(a) * NOISE_NORM;
    GZ[i] = z * NOISE_NORM;
    GV[i] = (2 * rand() - 1) * NOISE_VALUE * NOISE_NORM;
  }
  const A = 0x8da6b343 | 0;
  const B = 0xd8163841 | 0;
  const C = 0xcb1ab31f | 0;
  const M1 = 0x2c1b3c6d | 0;
  const M2 = 0x297a2d39 | 0;
  const grad = new Float64Array(3);

  const at = (x: number, y: number, z: number, wantGrad: boolean): number => {
    const xf = Math.floor(x);
    const yf = Math.floor(y);
    const zf = Math.floor(z);
    const fx = x - xf;
    const fy = y - yf;
    const fz = z - zf;
    const fx1 = fx - 1;
    const fy1 = fy - 1;
    const fz1 = fz - 1;
    const hx0 = Math.imul(xf, A);
    const hx1 = (hx0 + A) | 0;
    const hy0 = Math.imul(yf, B);
    const hy1 = (hy0 + B) | 0;
    const hz0 = Math.imul(zf, C);
    const hz1 = (hz0 + C) | 0;

    let h = hx0 ^ hy0 ^ hz0;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i000 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx1 ^ hy0 ^ hz0;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i100 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx0 ^ hy1 ^ hz0;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i010 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx1 ^ hy1 ^ hz0;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i110 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx0 ^ hy0 ^ hz1;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i001 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx1 ^ hy0 ^ hz1;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i101 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx0 ^ hy1 ^ hz1;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i011 = Math.imul(h ^ (h >>> 13), M2) >>> 24;
    h = hx1 ^ hy1 ^ hz1;
    h = Math.imul(h ^ (h >>> 15), M1);
    const i111 = Math.imul(h ^ (h >>> 13), M2) >>> 24;

    const a000 = GV[i000] + GX[i000] * fx + GY[i000] * fy + GZ[i000] * fz;
    const a100 = GV[i100] + GX[i100] * fx1 + GY[i100] * fy + GZ[i100] * fz;
    const a010 = GV[i010] + GX[i010] * fx + GY[i010] * fy1 + GZ[i010] * fz;
    const a110 = GV[i110] + GX[i110] * fx1 + GY[i110] * fy1 + GZ[i110] * fz;
    const a001 = GV[i001] + GX[i001] * fx + GY[i001] * fy + GZ[i001] * fz1;
    const a101 = GV[i101] + GX[i101] * fx1 + GY[i101] * fy + GZ[i101] * fz1;
    const a011 = GV[i011] + GX[i011] * fx + GY[i011] * fy1 + GZ[i011] * fz1;
    const a111 = GV[i111] + GX[i111] * fx1 + GY[i111] * fy1 + GZ[i111] * fz1;

    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

    const k1 = a100 - a000;
    const k2 = a010 - a000;
    const k3 = a001 - a000;
    const k4 = a000 - a100 - a010 + a110;
    const k5 = a000 - a010 - a001 + a011;
    const k6 = a000 - a100 - a001 + a101;
    const k7 = -a000 + a100 + a010 + a001 - a110 - a011 - a101 + a111;
    const value =
      a000 +
      k1 * ux +
      k2 * uy +
      k3 * uz +
      k4 * ux * uy +
      k5 * uy * uz +
      k6 * uz * ux +
      k7 * ux * uy * uz;
    if (!wantGrad) return value;

    const dux = 30 * fx * fx * fx1 * fx1;
    const duy = 30 * fy * fy * fy1 * fy1;
    const duz = 30 * fz * fz * fz1 * fz1;
    // trilinear blend of the corner gradients ...
    const w000 = (1 - ux) * (1 - uy) * (1 - uz);
    const w100 = ux * (1 - uy) * (1 - uz);
    const w010 = (1 - ux) * uy * (1 - uz);
    const w110 = ux * uy * (1 - uz);
    const w001 = (1 - ux) * (1 - uy) * uz;
    const w101 = ux * (1 - uy) * uz;
    const w011 = (1 - ux) * uy * uz;
    const w111 = ux * uy * uz;
    // ... plus the gradient of the blend weights themselves
    grad[0] =
      w000 * GX[i000] +
      w100 * GX[i100] +
      w010 * GX[i010] +
      w110 * GX[i110] +
      w001 * GX[i001] +
      w101 * GX[i101] +
      w011 * GX[i011] +
      w111 * GX[i111] +
      dux * (k1 + k4 * uy + k6 * uz + k7 * uy * uz);
    grad[1] =
      w000 * GY[i000] +
      w100 * GY[i100] +
      w010 * GY[i010] +
      w110 * GY[i110] +
      w001 * GY[i001] +
      w101 * GY[i101] +
      w011 * GY[i011] +
      w111 * GY[i111] +
      duy * (k2 + k4 * ux + k5 * uz + k7 * ux * uz);
    grad[2] =
      w000 * GZ[i000] +
      w100 * GZ[i100] +
      w010 * GZ[i010] +
      w110 * GZ[i110] +
      w001 * GZ[i001] +
      w101 * GZ[i101] +
      w011 * GZ[i011] +
      w111 * GZ[i111] +
      duz * (k3 + k5 * uy + k6 * ux + k7 * ux * uy);
    return value;
  };

  return {
    n: (x: number, y: number, z: number) => at(x, y, z, false),
    d: (x: number, y: number, z: number) => at(x, y, z, true),
    grad,
  };
};

/**
 * A stack of noise octaves. Each octave has its own 3x4 transform (frequency, rotation,
 * latitude stretch and offset) and an amplitude that already includes the fade that drops
 * octaves too fine for the output resolution.
 */
interface Layer {
  n: number;
  /** 12 numbers per octave: a row-major 3x3 followed by the offset. */
  m: Float64Array;
  amp: Float64Array;
  /** Frequency of each octave, cells per radian. */
  freq: Float64Array;
  /** 1 / sqrt(sum of squared amplitudes): keeps the std at ~1/3 whatever the octaves. */
  inv: number;
}

const makeLayer = (
  salt: number,
  seed: number,
  octaves: number,
  frequency: number,
  lacunarity: number,
  gain: number,
  stretch: number,
  /** texels per radian divided by output.minFeature: the finest frequency allowed */
  maxFreq: number,
): Layer => {
  const nominal = Math.max(1, Math.round(octaves));
  const rand = makeRand(hash2(seed, salt));
  const m = new Float64Array(nominal * 12);
  const amp = new Float64Array(nominal);
  const freq = new Float64Array(nominal);
  let r = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let n = 0;
  let sq = 0;
  for (let o = 0; o < nominal; o++) {
    const f = frequency * lacunarity ** o;
    // coarse octaves are stretched along the band; the finest is isotropic
    const s = nominal > 1 ? stretch + (1 - stretch) * (o / (nominal - 1)) : stretch;
    const a = gain ** o;
    sq += a * a;
    // full strength while a cell spans two minFeatures, gone by one
    const fade = clamp01(maxFreq / (f * Math.max(1, s)) - 1);
    if (fade > 0) {
      const j = n * 12;
      for (let i = 0; i < 3; i++) {
        m[j + i * 3] = r[i * 3] * f;
        m[j + i * 3 + 1] = r[i * 3 + 1] * f * s;
        m[j + i * 3 + 2] = r[i * 3 + 2] * f;
      }
      m[j + 9] = rand() * 256;
      m[j + 10] = rand() * 256;
      m[j + 11] = rand() * 256;
      amp[n] = a * fade;
      freq[n] = f;
      n++;
    } else {
      rand();
      rand();
      rand();
    }
    const q = new Array<number>(9);
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 3; k++) {
        q[i * 3 + k] = ROT[i * 3] * r[k] + ROT[i * 3 + 1] * r[3 + k] + ROT[i * 3 + 2] * r[6 + k];
      }
    }
    r = q;
  }
  return { n, m, amp, freq, inv: 1 / Math.sqrt(sq) };
};

/** Tanner Helland's fit to the blackbody locus, returned as linear RGB with max 1. */
const blackbody = (kelvin: number, gamma: number): RGB => {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  const lin = (c: number) => clamp01(c / 255) ** gamma;
  const out: RGB = [lin(r), lin(g), lin(b)];
  const mx = Math.max(out[0], out[1], out[2]) || 1;
  return [out[0] / mx, out[1] / mx, out[2] / mx];
};

/**
 * Renders the sky into an OffscreenCanvas `size` wide and `size / 2` tall.
 * Pass only the fields you want to change: `makeStarMap({ dust: { tauMax: 2 } })`.
 */
export const makeStarMap = (opts: StarMapOverrides = {}): OffscreenCanvas => {
  const o = merge(STAR_MAP_DEFAULTS, opts);
  const W = Math.max(4, Math.round(o.size / 2) * 2);
  const H = W / 2;
  const px = W / REF_WIDTH; // texels per reference px
  const K = W / TAU; // texels per radian
  const seed = Math.round(o.seed);
  const noise = makeNoise(seed);
  const nz = noise.n;
  const nd = noise.d;
  const grad = noise.grad;
  const maxFreq = K / Math.max(0.5, o.output.minFeature);

  // --- frames -------------------------------------------------------------------------
  // galactic = map rotated by -tilt about the node axis; with tilt 0 they coincide
  const { band, core, glow, stars, dust, nebulosity: neb, halo, output } = o;
  const an = band.node * DEG;
  const ax = Math.cos(an);
  const az = Math.sin(an);
  const ct = Math.cos(band.tilt * DEG);
  const st = Math.sin(-band.tilt * DEG);
  // Rodrigues, axis (ax, 0, az): rows of the map -> galactic matrix
  const g00 = ct + ax * ax * (1 - ct);
  const g01 = -az * st;
  const g02 = ax * az * (1 - ct);
  const g10 = az * st;
  const g11 = ct;
  const g12 = -ax * st;
  const g20 = ax * az * (1 - ct);
  const g21 = ax * st;
  const g22 = ct + az * az * (1 - ct);

  const cl = core.longitude * DEG;
  const ccx = Math.cos(cl); // direction of the core, in the plane
  const ccz = Math.sin(cl);
  const ctx_ = -ccz; // in-plane tangent at the core
  const ctz = ccx;

  // --- band and glow ------------------------------------------------------------------
  const sinDeg = (d: number) => Math.sin(Math.max(1e-3, d) * DEG);
  const bandSig = sinDeg(band.sigma);
  const invWideSig2 = 1 / (2 * sinDeg(band.wideSigma) ** 2);
  const warpAmp = Math.sin(band.warp * DEG);
  const warpRand = makeRand(hash2(seed, 0xb0b));
  const wo0 = warpRand() * 256;
  const wo1 = warpRand() * 256;
  const wo2 = warpRand() * 256;
  const invWide = 1 / (core.wideWidth * DEG) ** 2;
  const invBulgeW2 = 1 / (2 * sinDeg(core.bulgeWidth) ** 2);
  const invBulgeH2 = 1 / (2 * sinDeg(core.bulgeHeight) ** 2);
  const glowLayer = makeLayer(
    1,
    seed,
    glow.octaves,
    glow.frequency,
    glow.lacunarity,
    glow.gain,
    glow.stretch,
    maxFreq,
  );
  const bandI = band.intensity * glow.alpha;
  const bulgeI = core.bulgeIntensity * glow.alpha;
  // glow brightness below which octave i can no longer change an 8-bit texel
  const glowNeed = new Float64Array(glowLayer.n);
  for (let i = 0; i < glowLayer.n; i++) {
    glowNeed[i] = CULL / (Math.abs(glow.amplitude) * glowLayer.amp[i] * glowLayer.inv || 1e-9);
  }

  const fbm = (L: Layer, n: number, x: number, y: number, z: number) => {
    const m = L.m;
    const a = L.amp;
    let s = 0;
    for (let i = 0, j = 0; i < n; i++, j += 12) {
      s +=
        a[i] *
        nz(
          m[j] * x + m[j + 1] * y + m[j + 2] * z + m[j + 9],
          m[j + 3] * x + m[j + 4] * y + m[j + 5] * z + m[j + 10],
          m[j + 6] * x + m[j + 7] * y + m[j + 8] * z + m[j + 11],
        );
    }
    return s * L.inv;
  };

  /** How far the band centreline sits off the great circle, at the longitude whose unit
   *  vector in the plane is (cx, cz). Glow, dust and stars all follow it. */
  const wander = (cx: number, cz: number) =>
    warpAmp > 0
      ? warpAmp * nz(cx * band.warpFrequency + wo0, wo1, cz * band.warpFrequency + wo2)
      : 0;

  // --- dust ---------------------------------------------------------------------------
  const invDustSig2 = 1 / (2 * sinDeg(dust.sigma) ** 2);
  const invInner = 1 / (dust.innerWidth * DEG) ** 2;
  const bodyLayer = makeLayer(
    2,
    seed,
    dust.octaves,
    dust.frequency,
    dust.lacunarity,
    dust.gain,
    dust.stretch,
    maxFreq,
  );
  const ridgeLayer = makeLayer(
    3,
    seed,
    dust.ridgeOctaves,
    dust.ridgeFrequency,
    dust.lacunarity,
    dust.gain,
    dust.stretch,
    maxFreq,
  );
  const warpLayer = makeLayer(
    4,
    seed,
    Math.max(1, dust.warpPasses),
    dust.warpFrequency,
    dust.lacunarity,
    1,
    dust.stretch,
    maxFreq,
  );
  const warpN = dust.warpPasses >= 1 && dust.warp > 0 ? warpLayer.n : 0;
  const warpGain = new Float64Array(warpLayer.n);
  // a strength of 1 displaces by about one cell of that pass
  for (let i = 0; i < warpLayer.n; i++) {
    warpGain[i] = dust.warp / (GRAD_RMS * warpLayer.freq[i] ** 2);
  }
  let ridgeNorm = 0;
  for (let i = 0; i < ridgeLayer.n; i++) ridgeNorm += ridgeLayer.amp[i];
  ridgeNorm = ridgeNorm > 0 ? 1 / ridgeNorm : 0;

  const rift = dust.rift;
  const riftPos = Math.sin(rift.position * DEG);
  const riftWander = Math.sin(rift.wander * DEG);
  const invRiftW2 = 1 / (2 * sinDeg(rift.width) ** 2);
  const invRiftExt = 1 / (rift.extent * DEG) ** 2;
  const riftRand = makeRand(hash2(seed, 0x71f7));
  const ro = [0, 0, 0, 0, 0, 0].map(() => riftRand() * 256);

  const knots = dust.knots;
  const knotN = Math.max(0, Math.round(knots.count));
  const knotDir = new Float64Array(knotN * 3);
  const knotInv = new Float64Array(knotN); // 1 / (2 sigma^2), chord units
  const knotCos = new Float64Array(knotN); // cos of the cut-off radius
  let knotMaxZ = 0;
  {
    const r = makeRand(hash2(seed, 0x6b07));
    for (let i = 0; i < knotN; i++) {
      const lon = TAU * r();
      const u = 1 - r();
      const lat = Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()) * knots.latitude * DEG;
      const sig = (knots.sizeMin + (knots.sizeMax - knots.sizeMin) * r()) * DEG;
      const cb = Math.cos(lat);
      knotDir[i * 3] = cb * Math.cos(lon);
      knotDir[i * 3 + 1] = Math.sin(lat);
      knotDir[i * 3 + 2] = cb * Math.sin(lon);
      knotInv[i] = 1 / (2 * sig * sig);
      knotCos[i] = Math.cos(Math.min(Math.PI, KNOT_REACH * sig));
      knotMaxZ = Math.max(
        knotMaxZ,
        Math.abs(Math.sin(lat)) + Math.sin(Math.min(Math.PI / 2, KNOT_REACH * sig)),
      );
    }
  }

  // latitudes beyond which the dust layer and the rift cannot reach COVER_MIN
  const layerCut =
    dust.coverage + dust.innerBoost > COVER_MIN
      ? Math.sqrt(Math.log((dust.coverage + dust.innerBoost) / COVER_MIN) / invDustSig2)
      : 0;
  const riftCut =
    rift.strength > COVER_MIN
      ? Math.abs(riftPos) +
        NOISE_PEAK * Math.abs(riftWander) +
        Math.sqrt(Math.log(rift.strength / COVER_MIN) / invRiftW2)
      : 0;

  /** Ridged multifractal, 0..1: fold each octave into a crease, sharpen it, and let it gate
   *  the next octave so finer creases collect on the coarser ones. */
  const ridged = (x: number, y: number, z: number): number => {
    const rm = ridgeLayer.m;
    const ra = ridgeLayer.amp;
    let sum = 0;
    let gate = 1;
    for (let i = 0, j = 0; i < ridgeLayer.n; i++, j += 12) {
      const v = nz(
        rm[j] * x + rm[j + 1] * y + rm[j + 2] * z + rm[j + 9],
        rm[j + 3] * x + rm[j + 4] * y + rm[j + 5] * z + rm[j + 10],
        rm[j + 6] * x + rm[j + 7] * y + rm[j + 8] * z + rm[j + 11],
      );
      let r = 1 - Math.abs(v) * RIDGE_SPAN;
      r = r > 0 ? r ** dust.ridgeSharpness : 0;
      sum += ra[i] * r * gate;
      gate = 1 - dust.ridgeCascade + dust.ridgeCascade * Math.min(1, r * 2);
    }
    return sum * ridgeNorm;
  };
  // its mean depends on sharpness and cascade; measure it so that adding ridges moves
  // dust around without changing how much of it there is
  let ridgeMean = 0;
  {
    const r = makeRand(hash2(seed, 0x21d6));
    for (let i = 0; i < RIDGE_SAMPLES; i++) ridgeMean += ridged(r() * 9, r() * 9, r() * 9);
    ridgeMean /= RIDGE_SAMPLES;
  }

  /**
   * Optical depth of the dust toward galactic direction g. (cx, cz) is the unit vector
   * along the band at that longitude and lZ the latitude sine off the wandering centreline.
   */
  const dustTau = (
    gx: number,
    gy: number,
    gz: number,
    cx: number,
    cz: number,
    lZ: number,
  ): number => {
    const az = lZ < 0 ? -lZ : lZ;
    const cosL = cx * ccx + cz * ccz;
    let cover = 0;
    // each term is only worth evaluating inside its own latitude zone
    if (az < layerCut) {
      cover =
        expNeg(lZ * lZ * invDustSig2) *
        (dust.coverage + dust.innerBoost * expNeg((1 - cosL) * invInner));
    }
    if (az < riftCut) {
      const f = rift.frequency;
      const zr = riftPos + riftWander * nz(cx * f + ro[0], ro[1], cz * f + ro[2]);
      const dz = lZ - zr;
      const lane = expNeg(dz * dz * invRiftW2);
      if (lane > COVER_MIN) {
        const pf = rift.patchFrequency;
        const patch = clamp01(0.5 + PATCH_CONTRAST * nz(cx * pf + ro[3], ro[4], cz * pf + ro[5]));
        cover +=
          rift.strength *
          lane *
          (1 - rift.patchiness * (1 - patch)) *
          expNeg((1 - cosL) * invRiftExt);
      }
    }
    if (knots.strength > 0 && (gy < 0 ? -gy : gy) < knotMaxZ) {
      for (let i = 0; i < knotN; i++) {
        const dot = gx * knotDir[i * 3] + gy * knotDir[i * 3 + 1] + gz * knotDir[i * 3 + 2];
        if (dot > knotCos[i]) cover += knots.strength * expNeg((2 - 2 * dot) * knotInv[i]);
      }
    }
    // the noise below is at most 1, so with no cover there can be no dust
    if (cover < COVER_MIN) return 0;

    // multi-pass domain warp. Each pass moves the sample point by the gradient of a noise
    // field: along it (clouds billow and pinch) and across it (they shear and curl).
    let x = gx;
    let y = gy;
    let z = gz;
    const wm = warpLayer.m;
    for (let i = 0, j = 0; i < warpN; i++, j += 12) {
      nd(
        wm[j] * x + wm[j + 1] * y + wm[j + 2] * z + wm[j + 9],
        wm[j + 3] * x + wm[j + 4] * y + wm[j + 5] * z + wm[j + 10],
        wm[j + 6] * x + wm[j + 7] * y + wm[j + 8] * z + wm[j + 11],
      );
      let ex = wm[j] * grad[0] + wm[j + 3] * grad[1] + wm[j + 6] * grad[2];
      let ey = wm[j + 1] * grad[0] + wm[j + 4] * grad[1] + wm[j + 7] * grad[2];
      let ez = wm[j + 2] * grad[0] + wm[j + 5] * grad[1] + wm[j + 8] * grad[2];
      // keep only the part of the gradient that lies in the sky
      const radial = ex * gx + ey * gy + ez * gz;
      ex -= radial * gx;
      ey -= radial * gy;
      ez -= radial * gz;
      const push = warpGain[i] * (1 - dust.warpSwirl);
      const slide = warpGain[i] * dust.warpSwirl;
      x += push * ex + slide * (gy * ez - gz * ey);
      y += push * ey + slide * (gz * ex - gx * ez);
      z += push * ez + slide * (gx * ey - gy * ex);
    }
    // fine octaves follow the warp less: fully warped detail smears into striations
    const fx = gx + (x - gx) * dust.warpDetail;
    const fy = gy + (y - gy) * dust.warpDetail;
    const fz = gz + (z - gz) * dust.warpDetail;

    // cloud body: plain fbm, ragged at the edges
    const bm = bodyLayer.m;
    const ba = bodyLayer.amp;
    const bn = bodyLayer.n;
    let sum = 0;
    for (let i = 0, j = 0; i < bn; i++, j += 12) {
      const k = bn > 1 ? i / (bn - 1) : 0;
      const px = x + (fx - x) * k;
      const py = y + (fy - y) * k;
      const pz = z + (fz - z) * k;
      sum +=
        ba[i] *
        nz(
          bm[j] * px + bm[j + 1] * py + bm[j + 2] * pz + bm[j + 9],
          bm[j + 3] * px + bm[j + 4] * py + bm[j + 5] * pz + bm[j + 10],
          bm[j + 6] * px + bm[j + 7] * py + bm[j + 8] * pz + bm[j + 11],
        );
    }
    // filaments are added in the same (log-density-like) space as the body, so they show
    // wherever there is nearly enough cloud to make them from and trail off its edges
    const field = clamp01(
      0.5 + BODY_SPAN * sum * bodyLayer.inv + dust.ridgeMix * (ridged(x, y, z) - ridgeMean),
    );

    // a wide veil that only dims and reddens, with cores inside it that climb steeply
    // toward black. The veil fades in from its own outer edge and is complete where the
    // dense ramp is.
    const veil = clamp01(
      (field + cover * (1 + dust.veilReach) - 1) / (cover * dust.veilReach + dust.softness),
    );
    const dens = (field + cover - 1) / dust.softness;
    if (veil <= 0) return 0;
    const raw = dust.veil * veil + (dens > 0 ? dust.opacity * dens ** dust.gamma : 0);
    return dust.tauMax * (1 - expNeg(raw / dust.tauMax));
  };

  // --- nebulosity ---------------------------------------------------------------------
  const nebLayer = makeLayer(
    5,
    seed,
    neb.octaves,
    neb.frequency,
    OCTAVE,
    neb.gain,
    neb.stretch,
    maxFreq,
  );
  const invNebSig2 = 1 / (2 * sinDeg(neb.sigma) ** 2);
  const nebThreshold = (1 - 2 * neb.coverage) * TWO_SIGMA;
  const nebRand = makeRand(hash2(seed, 0x4eb));
  const ho = [0, 0, 0].map(() => nebRand() * 256);
  const hueF = neb.hueFrequency;

  // --- diffuse sky --------------------------------------------------------------------
  const lin = (c: number) => clamp01(c / 255) ** output.gamma;
  const bgR = lin(o.background.color[0]);
  const bgG = lin(o.background.color[1]);
  const bgB = lin(o.background.color[2]);
  const [bandR, bandG, bandB] = band.color;
  const [bulR, bulG, bulB] = core.bulgeColor;
  const fgGlow = clamp01(dust.foregroundGlow);

  // Beyond this |sin latitude| every diffuse term is below CULL, so half the sphere can
  // skip straight to the background colour. Derived from the options, not a look.
  const reach = (peak: number, inv2: number) =>
    peak > CULL ? Math.sqrt(Math.log(peak / CULL) / inv2) : 0;
  const diskPeak = bandI * (1 + core.wideIntensity) * Math.exp(Math.abs(glow.amplitude));
  const skyCut =
    warpAmp +
    Math.max(
      reach(diskPeak, 1 / (2 * (bandSig * (1 + Math.max(0, core.flare))) ** 2)),
      reach(diskPeak * band.wideLevel, invWideSig2),
      reach(bulgeI * Math.exp(Math.abs(glow.amplitude) * core.bulgeStructure), invBulgeH2),
      neb.alpha > 0 ? Math.sqrt(Math.log(1 / NEB_CUT) / invNebSig2) : 0,
    );
  const skyCut2 = skyCut * skyCut;

  /** Writes the linear colour of everything that is not a resolved star to out[k..k+2]. */
  const shade = (gx: number, gy: number, gz: number, out: Float32Array, k: number) => {
    out[k] = bgR;
    out[k + 1] = bgG;
    out[k + 2] = bgB;
    if (gy * gy > skyCut2) return;
    const rho = Math.sqrt(gx * gx + gz * gz);
    const inv = rho > 1e-9 ? 1 / rho : 0;
    const cx = gx * inv;
    const cz = gz * inv;
    // the wander fades out toward the galactic poles, where longitude means nothing
    const lZ = gy - rho * wander(cx, cz);
    const z2 = lZ * lZ;
    const cosCore = gx * ccx + gz * ccz;
    const wide = expNeg((1 - cosCore) * invWide);
    const sg = bandSig * (1 + core.flare * wide);
    const along = bandI * (1 + core.wideIntensity * wide);
    let disk = along * expNeg(z2 / (2 * sg * sg));
    const skirt = along * band.wideLevel * expNeg(z2 * invWideSig2);
    let bulge = 0;
    if (cosCore > 0) {
      const xt = gx * ctx_ + gz * ctz;
      bulge = bulgeI * expNeg(xt * xt * invBulgeW2 + z2 * invBulgeH2);
    }
    const en = neb.alpha > 0 ? expNeg(z2 * invNebSig2) : 0;
    const lit = disk + skirt + bulge > CULL;
    if (!lit && en < NEB_CUT) return;

    let r = bgR;
    let g = bgG;
    let b = bgB;
    let tr = 1;
    let tg = 1;
    let tb = 1;
    const tau = dustTau(gx, gy, gz, cx, cz, lZ);
    if (tau > 0) {
      tr = fgGlow + (1 - fgGlow) * expNeg(tau * dust.kR);
      tg = fgGlow + (1 - fgGlow) * expNeg(tau * dust.kG);
      tb = fgGlow + (1 - fgGlow) * expNeg(tau * dust.kB);
    }

    if (lit) {
      // star clouds live in the thin disk; the broad skirt under it stays smooth
      const bright = disk + bulge;
      let octaves = 0;
      while (octaves < glowLayer.n && bright > glowNeed[octaves]) octaves++;
      const f = octaves > 0 ? fbm(glowLayer, octaves, gx, gy, gz) : 0;
      disk = disk * Math.exp(glow.amplitude * f) + skirt;
      bulge *= Math.exp(glow.amplitude * core.bulgeStructure * f);
      r += (disk * bandR + bulge * bulR) * tr;
      g += (disk * bandG + bulge * bulG) * tg;
      b += (disk * bandB + bulge * bulB) * tb;
    }

    if (en >= NEB_CUT) {
      const n = fbm(nebLayer, nebLayer.n, gx, gy, gz);
      const patch = smoothstep(nebThreshold, nebThreshold + neb.softness, n);
      if (patch > 0) {
        const h = nz(gx * hueF + ho[0], gy * hueF + ho[1], gz * hueF + ho[2]);
        // three overlapping bumps along the hue noise: red, teal, blue
        const wr = neb.red * expNeg((h - HUE_STEP) ** 2 * HUE_SHARP);
        const wt = neb.teal * expNeg(h * h * HUE_SHARP);
        const wb = neb.blue * expNeg((h + HUE_STEP) ** 2 * HUE_SHARP);
        const a = neb.alpha * patch * en;
        r += a * tr * (wr * neb.redColor[0] + wt * neb.tealColor[0] + wb * neb.blueColor[0]);
        g += a * tg * (wr * neb.redColor[1] + wt * neb.tealColor[1] + wb * neb.blueColor[1]);
        b += a * tb * (wr * neb.redColor[2] + wt * neb.tealColor[2] + wb * neb.blueColor[2]);
      }
    }
    out[k] = r;
    out[k + 1] = g;
    out[k + 2] = b;
  };

  // --- stars --------------------------------------------------------------------------
  const nBand = Math.max(0, Math.round(stars.count));
  const nHalo = Math.max(0, Math.round(halo.count));
  const nAll = nBand + nHalo;
  const sX = new Float32Array(nAll); // texel position
  const sY = new Float32Array(nAll);
  const sSin = new Float64Array(nAll); // of the colatitude
  const sCos = new Float64Array(nAll);
  const sRad = new Float32Array(nAll); // outer radius, texels
  const sSig = new Float32Array(nAll); // core sigma, texels
  const sT = new Float32Array(nAll); // normalised brightness
  const sR = new Float32Array(nAll); // peak linear colour
  const sG = new Float32Array(nAll);
  const sB = new Float32Array(nAll);
  let nStars = 0;
  {
    const rand = makeRand(0);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
    const base = Math.max(1.0001, stars.magnitudeBase);
    const range = stars.magnitudeRange;
    const span = base ** range - 1;
    const logBase = Math.log(base);

    // size and peak intensity against normalised brightness: geometric from floor to
    // ceiling, as flux is in magnitude
    const sizeOf = new Float64Array(LUT_N + 2);
    const alphaOf = new Float64Array(LUT_N + 2);
    for (let i = 0; i <= LUT_N + 1; i++) {
      const t = Math.min(1, i / LUT_N);
      sizeOf[i] = stars.sizeFloor * (stars.sizeCeil / stars.sizeFloor) ** (t ** stars.sizeCurve);
      alphaOf[i] =
        stars.alphaFloor * (stars.alphaCeil / stars.alphaFloor) ** (t ** stars.alphaCurve);
    }
    // blackbody colour against a uniform random number. Spacing temperatures evenly in
    // mired (1e6 / T) spaces the colours evenly to the eye.
    const mMin = 1e6 / stars.tempMax;
    const mMax = 1e6 / stars.tempMin;
    const bbR = new Float64Array(LUT_N);
    const bbG = new Float64Array(LUT_N);
    const bbB = new Float64Array(LUT_N);
    for (let i = 0; i < LUT_N; i++) {
      const mired = mMin + (mMax - mMin) * ((i + 0.5) / LUT_N) ** stars.colorBias;
      [bbR[i], bbG[i], bbB[i]] = blackbody(1e6 / mired, output.gamma);
    }
    // inverse CDF of star density along the band, so longitude needs no rejection
    const lonOf = new Float64Array(LUT_N + 1);
    {
      const cdf = new Float64Array(LUT_N + 1);
      for (let i = 0; i < LUT_N; i++) {
        const l = ((i + 0.5) / LUT_N) * TAU;
        const wide = Math.exp((Math.cos(l - cl) - 1) * invWide);
        cdf[i + 1] = cdf[i] + 1 + stars.coreConcentration * wide;
      }
      for (let k = 0, i = 0; k <= LUT_N; k++) {
        const target = (k / LUT_N) * cdf[LUT_N];
        while (i < LUT_N - 1 && cdf[i + 1] < target) i++;
        lonOf[k] = ((i + (target - cdf[i]) / (cdf[i + 1] - cdf[i])) / LUT_N) * TAU;
      }
    }
    const spread = stars.bandSpread;
    const thinSig = bandSig * spread;
    const wideSig = sinDeg(band.wideSigma) * spread;
    // share of stars in the broad skirt = its share of the area under the profile
    const wideShare = (band.wideLevel * wideSig) / (band.wideLevel * wideSig + thinSig || 1);
    const bulgeW = sinDeg(core.bulgeWidth);
    const bulgeH = sinDeg(core.bulgeHeight);
    const clusterN = Math.min(glowLayer.n, CLUSTER_OCTAVES);
    const minSig = Math.max(stars.psf.minCore * px, MIN_SIGMA);

    for (let i = 0; i < nAll; i++) {
      const isHalo = i >= nBand;
      rand.seed(hash2(seed ^ (isHalo ? 0x4a10 : 0x57a2), isHalo ? i - nBand : i));

      // magnitude: exponentially more stars per step fainter
      const dm = Math.log(1 + rand() * span) / logBase;
      const t = 1 - dm / range;

      // direction, galactic frame
      let gx = 0;
      let gy = 0;
      let gz = 0;
      if (isHalo || rand() < stars.brightIsotropy * t) {
        gy = 2 * rand() - 1; // uniform in the axis coordinate = uniform on the sphere
        const l = TAU * rand();
        const s = Math.sqrt(1 - gy * gy);
        gx = s * Math.cos(l);
        gz = s * Math.sin(l);
      } else if (rand() < stars.bulgeFraction) {
        const xt = bulgeW * gauss();
        const zt = bulgeH * gauss();
        gx = ccx + xt * ctx_;
        gy = zt;
        gz = ccz + xt * ctz;
        const inv = 1 / Math.sqrt(gx * gx + gy * gy + gz * gz);
        gx *= inv;
        gy *= inv;
        gz *= inv;
      } else {
        // rejection-sample the band so density follows the core and the glow structure
        gx = 1;
        for (let tries = 0; tries < MAX_TRIES; tries++) {
          const q = rand() * LUT_N;
          const qi = q | 0;
          const l = lonOf[qi] + (lonOf[qi + 1] - lonOf[qi]) * (q - qi);
          const cx = Math.cos(l);
          const cz = Math.sin(l);
          const wide = expNeg((1 - cx * ccx - cz * ccz) * invWide);
          const sig = (rand() < wideShare ? wideSig : thinSig) * (1 + core.flare * wide);
          const y = sig * gauss() + wander(cx, cz);
          if (y <= -1 || y >= 1) continue;
          const s = Math.sqrt(1 - y * y);
          gx = s * cx;
          gy = y;
          gz = s * cz;
          // accept in proportion to exp(clustering * structure), capped at CLUSTER_CAP
          if (clusterN === 0 || stars.clustering <= 0) break;
          const f = fbm(glowLayer, clusterN, gx, gy, gz);
          if (f >= CLUSTER_CAP || Math.log(1 - rand()) < stars.clustering * (f - CLUSTER_CAP)) {
            break;
          }
        }
      }

      // colour: blackbody, saturation falling as brightness rises
      const ci = (rand() * LUT_N) | 0;
      const sat = stars.saturation * (1 - stars.desaturate * t);
      let cr = Math.max(0, 1 + (bbR[ci] - 1) * sat);
      let cg = Math.max(0, 1 + (bbG[ci] - 1) * sat);
      let cb = Math.max(0, 1 + (bbB[ci] - 1) * sat);
      const mx = Math.max(cr, cg, cb) || 1;
      const tq = t * LUT_N;
      const ti = tq | 0;
      let alpha = (alphaOf[ti] + (alphaOf[ti + 1] - alphaOf[ti]) * (tq - ti)) / mx;
      if (isHalo) alpha *= halo.alpha;

      // dust: a star is either in front of it or behind all of it
      const inFront =
        rand() <
        dust.foregroundStars +
          (1 - dust.foregroundStars) *
            Math.min(1, t / dust.foregroundBrightness) ** dust.foregroundCurve;
      if (!inFront) {
        const rho = Math.sqrt(gx * gx + gz * gz);
        const inv = rho > 1e-9 ? 1 / rho : 0;
        const cx = gx * inv;
        const cz = gz * inv;
        const tau = dustTau(gx, gy, gz, cx, cz, gy - rho * wander(cx, cz));
        if (tau > 0) {
          cr *= expNeg(tau * dust.kR);
          cg *= expNeg(tau * dust.kG);
          cb *= expNeg(tau * dust.kB);
        }
      }

      const rad = (sizeOf[ti] + (sizeOf[ti + 1] - sizeOf[ti]) * (tq - ti)) * px;
      // the core keeps its design width in px; if the map is too coarse to hold it, widen
      // it to the anti-alias floor and dim it so its total light is unchanged
      const want = Math.max(rad * stars.psf.core, stars.psf.minCore * px);
      const sig = Math.max(want, minSig);
      alpha *= (want * want) / (sig * sig);
      if (alpha * Math.max(cr, cg, cb) < STAR_CULL) continue;

      // galactic -> map (transpose of the matrix above)
      const dx = g00 * gx + g10 * gy + g20 * gz;
      const dy = g01 * gx + g11 * gy + g21 * gz;
      const dz = g02 * gx + g12 * gy + g22 * gz;
      let lon = Math.atan2(dz, dx);
      if (lon < 0) lon += TAU;
      const cy = dy > 1 ? 1 : dy < -1 ? -1 : dy;
      const k = nStars++;
      sX[k] = (lon / TAU) * W;
      sY[k] = (Math.acos(cy) / Math.PI) * H; // Archimedes: uniform in y, row by acos(y)
      sCos[k] = cy;
      sSin[k] = Math.sqrt(1 - cy * cy);
      sRad[k] = rad;
      sSig[k] = sig;
      sT[k] = t;
      sR[k] = cr * alpha;
      sG[k] = cg * alpha;
      sB[k] = cb * alpha;
    }
  }

  // skirt profile over normalised radius: flat inside the knee, power-law beyond it, and
  // windowed so that it and its slope reach exactly zero at the outer radius
  const psf = stars.psf;
  const skirt = new Float64Array(LUT_N + 2);
  for (let i = 0; i <= LUT_N; i++) {
    const r = i / LUT_N;
    const w = 1 - r * r;
    skirt[i] = psf.skirtLevel * (1 + (r / psf.knee) ** 2) ** (-psf.skirtPower / 2) * w * w;
  }

  const spikes = stars.spikes;
  const rings = stars.rings;
  const spikeN = Math.max(0, Math.round(spikes.count));
  const spikeCos = new Float64Array(spikeN);
  const spikeSin = new Float64Array(spikeN);
  for (let i = 0; i < spikeN; i++) {
    const a = spikes.angle * DEG + (i * TAU) / spikeN;
    spikeCos[i] = Math.cos(a);
    spikeSin[i] = Math.sin(a);
  }
  // nothing is drawn thinner than a texel-and-a-bit, whatever the options ask for
  const thinnest = MIN_SIGMA;
  const spikeSig = Math.max(spikes.width * px, thinnest);
  const invSpikeSig2 = 1 / (2 * spikeSig * spikeSig);
  // normalised brightness below which a star has neither spikes nor a ring
  const fancyFrom = Math.min(
    spikes.intensity > 0 ? spikes.threshold : 2,
    rings.intensity > 0 ? rings.threshold : 2,
  );

  // footprint radius of each star, and the strips it touches
  const nStrips = Math.ceil(H / STRIP);
  const sExt = new Float32Array(nStars);
  const stripStart = new Uint32Array(nStrips + 1);
  for (let k = 0; k < nStars; k++) {
    let ext = Math.max(sRad[k], sSig[k] * CORE_CUT);
    if (spikes.intensity > 0 && sT[k] >= spikes.threshold) {
      ext = Math.max(ext, sRad[k] * spikes.length);
    }
    sExt[k] = ext;
    const a = Math.max(0, Math.floor((sY[k] - ext - 1) / STRIP));
    const b = Math.min(nStrips - 1, Math.floor((sY[k] + ext + 1) / STRIP));
    for (let s = a; s <= b; s++) stripStart[s + 1]++;
  }
  for (let s = 0; s < nStrips; s++) stripStart[s + 1] += stripStart[s];
  const stripStars = new Uint32Array(stripStart[nStrips]);
  {
    const fill = stripStart.slice(0, nStrips);
    for (let k = 0; k < nStars; k++) {
      const ext = sExt[k];
      const a = Math.max(0, Math.floor((sY[k] - ext - 1) / STRIP));
      const b = Math.min(nStrips - 1, Math.floor((sY[k] + ext + 1) / STRIP));
      for (let s = a; s <= b; s++) stripStars[fill[s]++] = k;
    }
  }

  // --- tone curve ---------------------------------------------------------------------
  // linear below the knee, exponential shoulder above it that only reaches white at
  // infinity, then display gamma. Indexed by sqrt so the darks keep their precision.
  const tone = new Float32Array(TONE_N + 2);
  const knee = Math.min(0.999, Math.max(0, output.knee));
  for (let i = 0; i <= TONE_N + 1; i++) {
    const x = (i / TONE_N) ** 2 * TONE_MAX;
    const y = x <= knee ? x : knee + (1 - knee) * (1 - Math.exp(-(x - knee) / (1 - knee)));
    tone[i] = 255 * clamp01(y) ** (1 / output.gamma);
  }
  const toneScale = (TONE_N * Math.sqrt(output.exposure)) / Math.sqrt(TONE_MAX);
  const toneMap = (v: number) => {
    const s = Math.sqrt(v > 0 ? v : 0) * toneScale;
    if (s >= TONE_N) return 255;
    const i = s | 0;
    return tone[i] + (tone[i + 1] - tone[i]) * (s - i);
  };

  // --- render -------------------------------------------------------------------------
  const sinT = new Float64Array(H);
  const cosT = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    sinT[y] = Math.sin(((y + 0.5) / H) * Math.PI);
    cosT[y] = Math.cos(((y + 0.5) / H) * Math.PI);
  }
  const sinP = new Float64Array(W);
  const cosP = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    sinP[x] = Math.sin(((x + 0.5) / W) * TAU);
    cosP[x] = Math.cos(((x + 0.5) / W) * TAU);
  }

  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const buf = new Float32Array(W * STRIP * 3);
  const halfW = W >> 1;
  const dPhi = TAU / W;
  const ditherSeed = hash2(seed, 0xd17e);
  let img: ImageData | undefined;

  for (let strip = 0; strip < nStrips; strip++) {
    const y0 = strip * STRIP;
    const rows = Math.min(STRIP, H - y0);

    // 1. diffuse sky
    for (let r = 0; r < rows; r++) {
      const sp = sinT[y0 + r];
      const cp = cosT[y0 + r];
      let k = r * W * 3;
      for (let x = 0; x < W; x++, k += 3) {
        const dx = sp * cosP[x];
        const dz = sp * sinP[x];
        shade(
          g00 * dx + g01 * cp + g02 * dz,
          g10 * dx + g11 * cp + g12 * dz,
          g20 * dx + g21 * cp + g22 * dz,
          buf,
          k,
        );
      }
    }

    // 2. stars. Distances are true angles on the sphere, expressed in equatorial texels,
    // so a star covers more columns near a pole and still comes out round.
    for (let q = stripStart[strip]; q < stripStart[strip + 1]; q++) {
      const k = stripStars[q];
      const sx = sX[k];
      const sy = sY[k];
      const ss = sSin[k];
      const cs = sCos[k];
      const ext = sExt[k];
      const rad = sRad[k];
      const sig = sSig[k];
      const cr = sR[k];
      const cg = sG[k];
      const cb = sB[k];
      const t = sT[k];
      const ext2 = ext * ext;
      const cut2 = (sig * CORE_CUT) ** 2;
      const invCut2 = 1 / cut2;
      const invSig2 = 1 / (2 * sig * sig);
      const rad2 = rad * rad;
      const lutScale = LUT_N / rad;
      const peak = Math.max(cr, cg, cb);
      // the skirt only shows where it reaches past the core, and only if it is bright enough
      const hasSkirt = peak * psf.skirtLevel > CULL && rad > sig * CORE_CUT;
      // spikes and rings: only the brightest few get here
      let spikeAmt = 0;
      let spikeLen = 0;
      let ringAmt = 0;
      let ringR = 0;
      let invRingSig2 = 0;
      if (t >= fancyFrom) {
        if (spikes.intensity > 0 && t >= spikes.threshold && spikeN > 0) {
          spikeAmt = spikes.intensity * ((t - spikes.threshold) / (1 - spikes.threshold || 1));
          spikeLen = rad * spikes.length;
        }
        const ringSig = Math.max(rad * rings.width, thinnest);
        // a ring narrower than its own thickness would just be a blob
        if (rings.intensity > 0 && t >= rings.threshold && rad * rings.radius > 2 * ringSig) {
          ringAmt = rings.intensity;
          ringR = rad * rings.radius;
          invRingSig2 = 1 / (2 * ringSig * ringSig);
        }
      }
      const ang = ext / K;
      const cosExt = ang < 0.02 ? 1 - ang * ang * (0.5 - (ang * ang) / 24) : Math.cos(ang);
      // far from a pole the footprint is a plain ellipse; near one it needs the exact form
      const flat = ss * K > POLAR_REACH * ext;

      // texel centres sit at +0.5, and a row further than ext in latitude cannot be nearer
      const ra = Math.max(y0, Math.ceil(sy - ext - 0.5));
      const rb = Math.min(y0 + rows - 1, Math.floor(sy + ext - 0.5));
      for (let row = ra; row <= rb; row++) {
        const sp = sinT[row];
        const cp = cosT[row];
        // columns within `ext` of the star on this row
        let half: number;
        if (flat) {
          const dy = row + 0.5 - sy;
          half = Math.sqrt(ext2 - dy * dy) / sp + 1;
        } else {
          // spherical law of cosines; covers the whole row once the footprint holds the pole
          const den = sp * ss;
          const c = den > 1e-12 ? (cosExt - cp * cs) / den : cp * cs >= cosExt ? -2 : 2;
          if (c >= 1) continue;
          half = c <= -1 ? halfW : Math.min(halfW, (Math.acos(c) * W) / TAU);
        }
        const xa = half >= halfW ? Math.floor(sx) - halfW : Math.ceil(sx - half - 0.5);
        const xb = half >= halfW ? xa + W - 1 : Math.floor(sx + half - 0.5);
        const xk = sp * K;
        const yk = cp * ss * K;
        const yc = sp * cs * K;
        const base = (row - y0) * W * 3;
        for (let x = xa; x <= xb; x++) {
          const dp = (x + 0.5 - sx) * dPhi;
          let sn: number;
          let cn: number;
          if (dp < 0.03 && dp > -0.03) {
            const d2 = dp * dp;
            sn = dp * (1 - d2 * (1 / 6));
            cn = 1 - d2 * (0.5 - d2 * (1 / 24));
          } else {
            sn = Math.sin(dp);
            cn = Math.cos(dp);
          }
          // tangent-plane offset from the star: east, north
          const ex = xk * sn;
          const ey = yk - yc * cn;
          const r2 = ex * ex + ey * ey;
          if (r2 >= ext2) continue;
          let v = 0;
          if (r2 < cut2) {
            const w = 1 - r2 * invCut2;
            v = expNeg(r2 * invSig2) * w * w;
          }
          if (r2 < rad2) {
            const r = Math.sqrt(r2);
            if (hasSkirt) {
              const f = r * lutScale;
              const i = f | 0;
              v += skirt[i] + (skirt[i + 1] - skirt[i]) * (f - i);
            }
            if (ringAmt > 0) {
              const d = r - ringR;
              const w = 1 - r2 / rad2;
              v += ringAmt * expNeg(d * d * invRingSig2) * w * w;
            }
          }
          if (spikeAmt > 0) {
            for (let i = 0; i < spikeN; i++) {
              const along = ex * spikeCos[i] + ey * spikeSin[i];
              if (along <= 0 || along >= spikeLen) continue;
              const across = ey * spikeCos[i] - ex * spikeSin[i];
              const s = along / spikeLen;
              const w = 1 - s * s;
              v += spikeAmt * expNeg(across * across * invSpikeSig2 + s * spikes.falloff) * w * w;
            }
          }
          if (v <= 0) continue;
          const col = x < 0 ? x + W : x >= W ? x - W : x; // wrap across the seam
          const j = base + col * 3;
          buf[j] += v * cr;
          buf[j + 1] += v * cg;
          buf[j + 2] += v * cb;
        }
      }
    }

    // 3. tone map, dither, store
    if (!img || img.height !== rows) img = ctx.createImageData(W, rows);
    const out = img.data;
    for (let r = 0; r < rows; r++) {
      let k = r * W * 3;
      let j = r * W * 4;
      const rowHash = hash2(ditherSeed, y0 + r);
      for (let x = 0; x < W; x++, k += 3, j += 4) {
        let h = Math.imul(rowHash ^ x, 0x9e3779b1);
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
        h ^= h >>> 13;
        // triangular noise from two 16-bit halves, the same for all three channels
        const d = (((h & 0xffff) + (h >>> 16)) / 65536 - 1) * output.dither;
        out[j] = toneMap(buf[k]) + d; // the clamped array rounds to nearest
        out[j + 1] = toneMap(buf[k + 1]) + d;
        out[j + 2] = toneMap(buf[k + 2]) + d;
        out[j + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
  }

  return canvas;
};
