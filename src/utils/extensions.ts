import { addVec3, crossVec3, scaleVec3, type Quat, type Vec3 } from '@babylonjs/lite';

/*
multiply quat algorithm
x = a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y
y = a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x
z = a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w
w = a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z
*/

const multiplyQuat = (target: Quat, b: Quat): Quat => {
  const x = target.w * b.x + target.x * b.w + target.y * b.z - target.z * b.y;
  const y = target.w * b.y - target.x * b.z + target.y * b.w + target.z * b.x;
  const z = target.w * b.z + target.x * b.y - target.y * b.x + target.z * b.w;
  const w = target.w * b.w - target.x * b.x - target.y * b.y - target.z * b.z;

  return { x, y, z, w };
};
/*
cx = cos(rx/2), sx = sin(rx/2)   (same for y, z)

x = sx*cy*cz + cx*sy*sz
y = cx*sy*cz - sx*cy*sz
z = cx*cy*sz + sx*sy*cz
w = cx*cy*cz - sx*sy*sz*/

const quatFromEuler = (rot: Vec3): Quat => {
  const rx2 = rot.x / 2;
  const ry2 = rot.y / 2;
  const rz2 = rot.z / 2;

  const cx = Math.cos(rx2);
  const sx = Math.sin(rx2);
  const cy = Math.cos(ry2);
  const sy = Math.sin(ry2);

  const cz = Math.cos(rz2);
  const sz = Math.sin(rz2);

  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
};

const normalizeQuat = (q: Quat): Quat => {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len === 0) {
    throw new Error(
      'Quaternion had no length, theres a bug somewhere calculating the quats, but it is not here in the normalize quat function',
    );
  }
  const w = q.w / len;
  const x = q.x / len;
  const y = q.y / len;
  const z = q.z / len;
  return { w, x, y, z };
};

const toDegrees = (rad: number) => (rad * 180) / Math.PI;

const invertQuat = (q: Quat): Quat => {
  return { x: q.x * -1, y: q.y * -1, z: q.z * -1, w: q.w };
};

const rotateVec3ByQuat = (q: Quat, v: Vec3): Vec3 => {
  const u = { x: q.x, y: q.y, z: q.z };
  const t = scaleVec3(crossVec3(u, v), 2);
  return addVec3(addVec3(v, scaleVec3(t, q.w)), crossVec3(u, t));
};

const vec3Length = (input: Vec3): number => {
  return Math.sqrt(input.x * input.x + input.y * input.y + input.z * input.z);
};


const quatIdentity = (): Quat => {
  return { x: 0, y: 0, z: 0, w: 1}
}

export {
  quatIdentity,
  vec3Length,
  rotateVec3ByQuat,
  invertQuat,
  multiplyQuat,
  quatFromEuler,
  normalizeQuat,
  toDegrees,
};
