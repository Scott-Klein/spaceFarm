// WGSL for the planet. Babylon Lite prepends its prelude (scene UBO, `shaderSystem`,
// `shaderUniforms`, texture/sampler bindings and `VertexInput`) to both stages.
//
// The planet is drawn as ONE pass over an atmosphere-sized shell: every fragment traces its
// view ray against the analytic planet, cloud and atmosphere spheres. That gives a perfectly
// round, analytically anti-aliased limb, clouds with parallax, and surface + haze + halo
// composited in HDR before a single tone map.
import { CLOUD_GRADIENT_MAX, RELIEF_MAX } from './gen/bake';

/** Radius of the shell mesh the planet is drawn on (planet radius = 1). */
export const SHELL_RADIUS = 1.08;

/** Cube-face lookup matching cubeSphere.ts. Gradients are derived from the continuous
 *  direction derivatives, so mip selection has no seams at face edges. */
const CUBE_WGSL = /* wgsl */ `
const PI: f32 = 3.14159265;

struct CubeUV { uv: vec2<f32>, face: i32, dx: vec2<f32>, dy: vec2<f32> };

fn cubeUV(d: vec3<f32>, ddx: vec3<f32>, ddy: vec3<f32>) -> CubeUV {
  let ad = abs(d);
  var F = vec3<f32>(0.0, 0.0, -1.0);
  var U = vec3<f32>(-1.0, 0.0, 0.0);
  var V = vec3<f32>(0.0, -1.0, 0.0);
  var face = 5;
  if (ad.x >= ad.y && ad.x >= ad.z) {
    if (d.x > 0.0) { face = 0; F = vec3<f32>(1.0, 0.0, 0.0); U = vec3<f32>(0.0, 0.0, -1.0); }
    else { face = 1; F = vec3<f32>(-1.0, 0.0, 0.0); U = vec3<f32>(0.0, 0.0, 1.0); }
  } else if (ad.y >= ad.z) {
    U = vec3<f32>(1.0, 0.0, 0.0);
    if (d.y > 0.0) { face = 2; F = vec3<f32>(0.0, 1.0, 0.0); V = vec3<f32>(0.0, 0.0, 1.0); }
    else { face = 3; F = vec3<f32>(0.0, -1.0, 0.0); V = vec3<f32>(0.0, 0.0, -1.0); }
  } else if (d.z > 0.0) {
    face = 4; F = vec3<f32>(0.0, 0.0, 1.0); U = vec3<f32>(1.0, 0.0, 0.0);
  }
  let f = dot(d, F);
  let a = dot(d, U) / f;
  let b = dot(d, V) / f;
  let k = 2.0 / PI; // 0.5 * 4/π: atan to [0, 1] uv
  var o: CubeUV;
  o.face = face;
  o.uv = vec2<f32>(atan(a), atan(b)) * k + 0.5;
  let ja = k / (1.0 + a * a);
  let jb = k / (1.0 + b * b);
  o.dx = vec2<f32>(ja * (dot(ddx, U) - a * dot(ddx, F)), jb * (dot(ddx, V) - b * dot(ddx, F))) / f;
  o.dy = vec2<f32>(ja * (dot(ddy, U) - a * dot(ddy, F)), jb * (dot(ddy, V) - b * dot(ddy, F))) / f;
  return o;
}

fn sampleCube(t: texture_2d_array<f32>, s: sampler, d: vec3<f32>, ddx: vec3<f32>, ddy: vec3<f32>) -> vec4<f32> {
  let c = cubeUV(d, ddx, ddy);
  return textureSampleGrad(t, s, c.uv, c.face, c.dx, c.dy);
}

/** Inverse of bake.ts encodeSigned: sqrt-companded signed values. */
fn decodeSigned(v: vec3<f32>) -> vec3<f32> {
  let t = v * 2.0 - 1.0;
  return sign(t) * t * t * ${RELIEF_MAX.toFixed(1)};
}

fn decodeCloudGradient(v: vec3<f32>) -> vec3<f32> {
  let t = v * 2.0 - 1.0;
  return sign(t) * t * t * ${CLOUD_GRADIENT_MAX.toFixed(1)};
}
`;

/** Single-scattering atmosphere (Rayleigh + Mie), distances in planet radii. Optical depth
 *  toward the sun uses Schüler's Chapman-function approximation, so only the view ray is
 *  marched. */
const ATMOSPHERE_WGSL = /* wgsl */ `
const R_ATMO: f32 = 1.065;
const H_R: f32 = 0.0075;
const H_M: f32 = 0.0011;
// Earth's sea-level coefficients (per metre × 6.371e6 m per planet radius), rescaled so the
// vertical optical depth stays Earth-like despite the exaggerated scale heights.
const BETA_R: vec3<f32> = vec3<f32>(5.8e-6, 13.5e-6, 33.1e-6) * 6.371e6 * (0.00126 / H_R) * 0.6;
const BETA_M: f32 = 21e-6 * 6.371e6 * (0.00019 / 0.0011) * 0.35;
const BETA_M_EXT: f32 = BETA_M * 1.11;
const MIE_G: f32 = 0.76;

fn chapman(X: f32, h: f32, mu: f32) -> f32 {
  let c = sqrt(X + h);
  if (mu >= 0.0) {
    return c / (c * mu + 1.0) * exp(-h);
  }
  let x0 = sqrt(1.0 - mu * mu) * (X + h);
  let c0 = sqrt(x0);
  return 2.0 * c0 * exp(min(X - x0, 60.0)) - c / (1.0 - c * mu) * exp(-h);
}

/** Optical depth from radius r along a direction whose cosine with the local zenith is mu. */
fn opticalDepth(r: f32, mu: f32) -> vec3<f32> {
  let h = max(r - 1.0, 0.0);
  let dr = H_R * chapman(1.0 / H_R, h / H_R, mu);
  let dm = H_M * chapman(1.0 / H_M, h / H_M, mu);
  return BETA_R * dr + vec3<f32>(BETA_M_EXT * dm);
}

fn sunTransmittance(r: f32, mu: f32) -> vec3<f32> {
  return exp(-opticalDepth(r, mu));
}

fn phaseRayleigh(c: f32) -> f32 { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
fn phaseMie(c: f32) -> f32 {
  let g2 = MIE_G * MIE_G;
  return 3.0 / (8.0 * PI) * (1.0 - g2) * (1.0 + c * c) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * MIE_G * c, 1.5));
}

struct Scatter { inscatter: vec3<f32>, transmittance: vec3<f32> };

/** In-scattered sunlight and transmittance along ro + rd·t for t in [t0, t1]. */
fn scatter(ro: vec3<f32>, rd: vec3<f32>, t0: f32, t1: f32, L: vec3<f32>) -> Scatter {
  const STEPS: i32 = 20;
  let ds = (t1 - t0) / f32(STEPS);
  var tauR = 0.0;
  var tauM = 0.0;
  var sumR = vec3<f32>(0.0);
  var sumM = vec3<f32>(0.0);
  for (var i = 0; i < STEPS; i++) {
    let p = ro + rd * (t0 + (f32(i) + 0.5) * ds);
    let r = length(p);
    let h = max(r - 1.0, 0.0);
    let dR = exp(-h / H_R) * ds;
    let dM = exp(-h / H_M) * ds;
    tauR += dR * 0.5;
    tauM += dM * 0.5;
    let mu = dot(p, L) / r;
    // planet shadow, softened over the sun's disc and a little refraction
    let b = dot(p, L);
    let ca = sqrt(max(r * r - b * b, 0.0));
    let lit = select(1.0, smoothstep(0.996, 1.004, ca), b < 0.0);
    let T = exp(-(BETA_R * tauR + vec3<f32>(BETA_M_EXT * tauM)) - opticalDepth(r, max(mu, -0.2)));
    sumR += T * dR * lit;
    sumM += T * dM * lit;
    tauR += dR * 0.5;
    tauM += dM * 0.5;
  }
  let c = dot(rd, L);
  var o: Scatter;
  o.inscatter = sumR * BETA_R * phaseRayleigh(c) + sumM * BETA_M * phaseMie(c);
  o.transmittance = exp(-(BETA_R * tauR + vec3<f32>(BETA_M_EXT * tauM)));
  return o;
}
`;

const VARYINGS_WGSL = /* wgsl */ `
struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};
`;

export const PLANET_VERTEX_WGSL = /* wgsl */ `
${VARYINGS_WGSL}

@vertex
fn mainVertex(input: VertexInput) -> VSOut {
  var o: VSOut;
  let wp = shaderSystem.world * vec4<f32>(input.position, 1.0);
  o.pos = scene.viewProjection * wp;
  o.worldPos = wp.xyz;
  return o;
}
`;

export const PLANET_FRAGMENT_WGSL = /* wgsl */ `
${VARYINGS_WGSL}
${CUBE_WGSL}
${ATMOSPHERE_WGSL}

const CLOUD_ALTITUDE: f32 = 0.0045;
const CLOUD_BUMP: f32 = 0.0055;
const SUN: vec3<f32> = vec3<f32>(1.0, 0.99, 0.97) * 4.2;
// in-scattered light is brightened beyond physical: the bright limb haze of the classic
// "planet from orbit" look, without the extra extinction a denser atmosphere would bring
const INSCATTER_BOOST: f32 = 2.6;

fn rotateY(v: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3<f32>(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

/** Nearest point on a sphere of radius rs to the ray: the hit when there is one, else the
 *  closest approach pushed onto the sphere. Continuous across the limb, so its screen-space
 *  derivatives stay sane there. */
fn spherePoint(ro: vec3<f32>, rd: vec3<f32>, rs: f32) -> vec3<f32> {
  let b = dot(ro, rd);
  let disc = b * b - (dot(ro, ro) - rs * rs);
  if (disc > 0.0) {
    return ro + rd * (-b - sqrt(disc));
  }
  return normalize(ro - rd * b) * rs;
}

/** Khronos PBR Neutral: base colours pass through faithfully, highlights roll off to white. */
fn tonemap(c: vec3<f32>) -> vec3<f32> {
  let startCompression = 0.76;
  let desaturation = 0.15;
  let x = min(c.r, min(c.g, c.b));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  var color = c - offset;
  let peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) {
    return color;
  }
  let d = 1.0 - startCompression;
  let newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  let g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3<f32>(newPeak), g);
}

fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3<f32>(0.0031308));
}

@fragment
fn mainFragment(in: VSOut) -> @location(0) vec4<f32> {
  let ro = shaderSystem.cameraPosition;
  let rd = normalize(in.worldPos - ro);
  let L = normalize(shaderUniforms.sunDirection);
  let world3 = mat3x3<f32>(shaderSystem.world[0].xyz, shaderSystem.world[1].xyz, shaderSystem.world[2].xyz);
  let toObject = transpose(world3);

  // ---- geometry: planet and cloud-deck hits (or their continuous limb extensions)
  let b = dot(ro, rd);
  let closest = sqrt(max(dot(ro, ro) - b * b, 0.0));
  let coverage = clamp((1.0 - closest) / max(fwidth(closest), 1e-6) + 0.5, 0.0, 1.0);
  let ps = spherePoint(ro, rd, 1.0);
  let pc = spherePoint(ro, rd, 1.0 + CLOUD_ALTITUDE);
  let ds = toObject * ps;
  let dc = rotateY(toObject * pc, shaderUniforms.cloudAngle);
  let dsx = dpdx(ds);
  let dsy = dpdy(ds);
  let dcx = dpdx(dc);
  let dcy = dpdy(dc);

  // ---- surface
  let albedoSample = sampleCube(albedoMap, albedoMapSampler, ds, dsx, dsy);
  let reliefSample = sampleCube(reliefMap, reliefMapSampler, ds, dsx, dsy);
  let albedo = albedoSample.rgb;
  let water = albedoSample.a;
  let g = decodeSigned(reliefSample.rgb) * shaderUniforms.reliefStrength;
  let Ng = normalize(ps);
  let N = normalize(world3 * (normalize(ds) - g));
  let V = -rd;
  let NgL = dot(Ng, L);
  // extinction toward the sun, only partly chromatic: enough for warm light at the terminator
  // without turning snowfields cream
  let sunT = sunTransmittance(1.0, NgL);
  let sunAtSurface = SUN * mix(vec3<f32>(dot(sunT, vec3<f32>(0.2126, 0.7152, 0.0722))), sunT, 0.55);

  // land: Lambert on the relief normal, faded across the terminator on the geometric normal
  let NL = max(dot(N, L), 0.0) * smoothstep(-0.02, 0.06, NgL);
  var surface = albedo * sunAtSurface * NL / PI;
  // sea: GGX sun glint on the smooth sphere plus Fresnel sky reflection
  let H = normalize(L + V);
  let NgV = max(dot(Ng, V), 1e-3);
  let NgH = max(dot(Ng, H), 0.0);
  let rough = 0.46;
  let a2 = rough * rough * rough * rough;
  let dTerm = a2 / (PI * pow(NgH * NgH * (a2 - 1.0) + 1.0, 2.0));
  let k = rough * rough * 0.5;
  let vis = 0.25 / ((NgV * (1.0 - k) + k) * (max(NgL, 0.0) * (1.0 - k) + k));
  let fres = 0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  let glint = dTerm * vis * fres * max(NgL, 0.0);
  let skyFres = 0.02 + 0.98 * pow(1.0 - NgV, 5.0);
  let sky = vec3<f32>(0.06, 0.12, 0.25) * smoothstep(-0.1, 0.4, NgL);
  surface += water * (sunAtSurface * glint + sky * skyFres);
  // a little skylight so the terminator is not a hard black cut
  surface += albedo * vec3<f32>(0.010, 0.018, 0.035) * smoothstep(-0.15, 0.3, NgL);

  // ---- clouds: density on the deck, shadows cast onto the ground along the sun ray
  let cloudSample = sampleCube(cloudMap, cloudMapSampler, dc, dcx, dcy);
  let cloud = cloudSample.r;
  let rc = 1.0 + CLOUD_ALTITUDE;
  let bs = dot(ps, L);
  let ts = -bs + sqrt(max(bs * bs - (dot(ps, ps) - rc * rc), 0.0));
  let dsh = rotateY(toObject * (ps + L * ts), shaderUniforms.cloudAngle);
  let shadowUV = cubeUV(dsh, vec3<f32>(0.0), vec3<f32>(0.0));
  let shadow = textureSampleLevel(cloudMap, cloudMapSampler, shadowUV.uv, shadowUV.face, 2.0).r;
  surface *= 1.0 - 0.65 * shadow;

  // cloud tops: the density gradient tilts the normal, so billows are lit on the sun side and
  // shaded on the far side; thin veils are translucent, thick decks opaque
  let cg = rotateY(decodeCloudGradient(cloudSample.gba), -shaderUniforms.cloudAngle);
  let Nc = normalize(pc);
  // thin edges stay flat: tilting them would rim-light every veil
  let Ncb = normalize(world3 * (normalize(toObject * pc) - cg * (CLOUD_BUMP * smoothstep(0.15, 0.7, cloud))));
  let NcL = dot(Nc, L);
  let lit = smoothstep(-0.06, 0.08, NcL);
  let cloudLight = lit * (0.2 + 0.8 * max(dot(Ncb, L), 0.0));
  let cloudColor = vec3<f32>(0.84, 0.86, 0.9) * SUN * sunTransmittance(rc, NcL) * cloudLight / PI
    + vec3<f32>(0.10, 0.15, 0.24) * smoothstep(-0.15, 0.25, NcL);
  let cloudAlpha = 1.0 - exp(-(cloud * 0.8 + cloud * cloud * 2.8));
  surface = mix(surface, cloudColor, cloudAlpha);

  // ---- atmosphere along the view ray: to the ground where we hit it, else through the shell
  let disc = b * b - (dot(ro, ro) - R_ATMO * R_ATMO);
  var color = vec3<f32>(0.0);
  if (disc > 0.0) {
    let sq = sqrt(disc);
    let t0 = max(-b - sq, 0.0);
    var t1 = -b + sq;
    let discP = b * b - (dot(ro, ro) - 1.0);
    if (discP > 0.0) {
      t1 = min(t1, -b - sqrt(discP));
    }
    let sc = scatter(ro, rd, t0, t1, L);
    let viewT = mix(vec3<f32>(dot(sc.transmittance, vec3<f32>(0.2126, 0.7152, 0.0722))), sc.transmittance, 0.4);
    // brighten the haze a little over the disc and most toward the limb, where the edge glows
    let boost = mix(1.35, INSCATTER_BOOST, smoothstep(0.45, 0.0, dot(Ng, V)));
    color = SUN * boost * sc.inscatter + coverage * surface * viewT;
  } else {
    color = coverage * surface;
  }

  return vec4<f32>(linearToSrgb(tonemap(color * shaderUniforms.exposure)), 1.0);
}
`;
