// Intro easter egg: grab Roo by an ear (antenna) and drag it around. It dangles like a pendulum
// from the grabbed ear, swings with the cursor's acceleration, falls when released, then floats home.
import { Vector3 } from 'three';
import gsap from 'gsap';

type Phase = 'idle' | 'held' | 'falling' | 'returning';
const G = 9;

export class EarDrag {
  phase: Phase = 'idle';
  readonly pos = new Vector3(); // rig position (root space)
  rotZ = 0; // rig roll
  private tip = new Vector3(); // grabbed ear tip in rig-local space
  private theta0 = 0; // resting hang angle
  private len = 1;
  private omega = 0;
  private target = new Vector3();
  private prevTarget = new Vector3();
  private vel = new Vector3();
  private acc = new Vector3();
  private fallV = 0;
  private home = new Vector3();
  onLand: () => void = () => {};
  onHome: () => void = () => {};

  get active() {
    return this.phase !== 'idle';
  }

  /** `tip` and `com` are in rig-local space; `roll` is the rig's current z rotation. */
  grab(tip: Vector3, com: Vector3, roll: number, home: Vector3, pointer: Vector3) {
    gsap.killTweensOf(this.pos);
    gsap.killTweensOf(this);
    this.tip.copy(tip);
    this.home.copy(home);
    const d = com.clone().sub(tip);
    this.len = Math.max(0.3, d.length());
    // roll that puts the centre of mass straight below the ear
    this.theta0 = -Math.PI / 2 - Math.atan2(d.y, d.x);
    this.rotZ = roll;
    this.omega = 0;
    // snap the ear to the cursor so the first frame doesn't read as a huge jerk
    this.target.copy(pointer);
    this.prevTarget.copy(pointer);
    this.pos.copy(pointer).sub(tip.clone().applyAxisAngle(Z, roll));
    this.vel.set(0, 0, 0);
    this.acc.set(0, 0, 0);
    this.phase = 'held';
  }

  move(pointer: Vector3) {
    if (this.phase === 'held') this.target.copy(pointer);
  }

  release() {
    if (this.phase !== 'held') return;
    this.phase = 'falling';
    this.fallV = Math.min(this.vel.y, 2);
  }

  step(dt: number, floorY: number) {
    if (dt <= 0) return;
    if (this.phase === 'held') {
      // ear follows the pointer exactly; body swings below it, pushed by the cursor's acceleration
      const v = this.target.clone().sub(this.prevTarget).divideScalar(dt);
      this.prevTarget.copy(this.target);
      const a = v.clone().sub(this.vel).divideScalar(dt).clampLength(0, 40);
      this.acc.lerp(a, 0.25);
      this.vel.copy(v);
      const off = this.rotZ - this.theta0;
      const alpha = -(G / this.len) * Math.sin(off) - 2.4 * this.omega - (this.acc.x / this.len) * Math.cos(off) * 0.6;
      this.omega += Math.max(-80, Math.min(80, alpha)) * dt;
      this.rotZ += this.omega * dt;
      this.pos.copy(this.target).sub(this.tip.clone().applyAxisAngle(Z, this.rotZ));
    } else if (this.phase === 'falling') {
      this.fallV -= G * dt;
      this.pos.y += this.fallV * dt;
      this.rotZ += (0 - this.rotZ) * Math.min(1, dt * 6); // rights itself while falling
      if (this.pos.y <= floorY) {
        this.pos.y = floorY;
        this.phase = 'returning';
        this.onLand();
        gsap.to(this, { rotZ: 0, duration: 0.3, ease: 'power2.out' });
        gsap.to(this.pos, {
          x: this.home.x,
          y: this.home.y,
          z: this.home.z,
          duration: 1.1,
          delay: 0.9, // sulks for a moment first
          ease: 'sine.inOut',
          onComplete: () => {
            this.phase = 'idle';
            this.onHome();
          },
        });
      }
    }
  }
}

const Z = new Vector3(0, 0, 1);
