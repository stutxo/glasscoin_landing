const DRAG_SENSITIVITY = Math.PI * 1.2;
const DAMPING = 3.8;
const MAX_SPEED = 5;

// Inverse of Rx(pitch) * Ry(yaw), in WebGL's column-major order. The spin
// stays around a diameter of the tilted coin instead of precessing in space.
export function inverseCoinRotation(yaw: number, pitch: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  return new Float32Array([
    cy, 0, sy,
    sy * sx, cx, -cy * sx,
    -sy * cx, sx, cy * cx,
  ]);
}

export function createCoinMotion() {
  let yaw = 0, pitch = 0, velocity = 0, tiltVelocity = 0;
  let dragging = false, lastDrag = 0;

  function advance(seconds: number, reducedMotion = false) {
    if (reducedMotion) { velocity = 0; tiltVelocity = 0; }
    if (!dragging) {
      const decay = Math.exp(-DAMPING * seconds);
      // Integrate damped angular velocity exactly, independent of refresh rate.
      yaw += velocity * (1 - decay) / DAMPING;
      pitch += tiltVelocity * (1 - decay) / DAMPING;
      velocity *= decay;
      tiltVelocity *= decay;
      if (Math.abs(velocity) < .008) velocity = 0;
      if (Math.abs(tiltVelocity) < .008) tiltVelocity = 0;
    }
    yaw = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(pitch) > .3) { pitch = Math.sign(pitch) * .3; tiltVelocity = 0; }
  }

  return {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get moving() { return !dragging && (velocity !== 0 || tiltVelocity !== 0); },
    advance,
    start(now: number) { dragging = true; velocity = 0; tiltVelocity = 0; lastDrag = now; },
    drag(dx: number, dy: number, now: number) {
      const seconds = Math.max((now - lastDrag) / 1000, .008);
      const angle = dx * DRAG_SENSITIVITY;
      const tilt = dy * .8;
      const blend = 1 - Math.exp(-seconds * 22);
      yaw += angle;
      pitch = Math.max(-.3, Math.min(.3, pitch + tilt));
      velocity += (Math.max(-MAX_SPEED, Math.min(MAX_SPEED, angle / seconds)) - velocity) * blend;
      tiltVelocity += (Math.max(-1, Math.min(1, tilt / seconds)) - tiltVelocity) * blend;
      lastDrag = now;
    },
    release(now: number, reducedMotion: boolean) {
      dragging = false;
      if (now - lastDrag > 90 || reducedMotion) { velocity = 0; tiltVelocity = 0; }
    },
    stop() { dragging = false; velocity = 0; tiltVelocity = 0; },
    turn(direction: number) { yaw += direction * Math.PI / 8; velocity = 0; tiltVelocity = 0; },
  };
}
