import { type Vec3 } from '@babylonjs/lite';

export default class MathBro {
  static randomPointInSphere(center: Vec3, radius: number): Vec3 {
    let x: number, y: number, z: number;
    do {
      x = MathBro.RandomRange(-1, 1);
      y = MathBro.RandomRange(-1, 1);
      z = MathBro.RandomRange(-1, 1);
    } while (x * x + y * y + z * z > 1);
    return { x: center.x + x * radius, y: center.y + y * radius, z: center.z + z * radius };
  }

  static vec3Length(input: Vec3): number {
    return Math.sqrt(input.x * input.x + input.y * input.y + input.z * input.z);
  }

  static RandomRange(min: number, max: number): number {
    return (Math.random() * (max - min)) + min;
  }
}
