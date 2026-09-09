import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoinMotion, inverseCoinRotation } from '../lib/coin-motion.ts';

const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const transform = (m, v) => [0, 1, 2].map(row => m[row] * v[0] + m[row + 3] * v[1] + m[row + 6] * v[2]);

test('initial pose faces the viewer without any tilt', () => {
  const coin = createCoinMotion();
  assert.equal(coin.yaw, 0);
  assert.equal(coin.pitch, 0);
  assert.equal(coin.moving, false);
  const normal = transform(inverseCoinRotation(coin.yaw, coin.pitch), [0, 0, 1]);
  normal.forEach((value, index) => close(value, [0, 0, 1][index]));
});

test('a tilted coin spins around its own diameter without precession', () => {
  for (const pitch of [-.3, -.12, 0, .22, .3]) {
    const fixedAxis = [0, Math.cos(pitch), Math.sin(pitch)];
    for (const yaw of [0, .7, Math.PI / 2, Math.PI, 5.1, Math.PI * 2]) {
      const matrix = inverseCoinRotation(yaw, pitch);
      transform(matrix, fixedAxis).forEach((value, index) => close(value, [0, 1, 0][index]));
      const point = [.31, -.27, .022];
      close(Math.hypot(...transform(matrix, point)), Math.hypot(...point));
    }
  }
});

function releasedCoin() {
  const coin = createCoinMotion();
  coin.start(0);
  for (let tick = 1; tick <= 8; tick++) coin.drag(.008, .001, tick * 16);
  coin.release(130, false);
  return coin;
}

test('release momentum is consistent across display refresh rates', () => {
  const slow = releasedCoin();
  const fast = releasedCoin();
  for (let i = 0; i < 30; i++) slow.advance(1 / 30);
  for (let i = 0; i < 144; i++) fast.advance(1 / 144);
  close(slow.yaw, fast.yaw, .0005);
  close(slow.pitch, fast.pitch, .003);
});

test('holding still before release does not produce a delayed flick', () => {
  const coin = createCoinMotion();
  coin.start(0);
  coin.drag(.08, .04, 20);
  const before = [coin.yaw, coin.pitch];
  coin.release(250, false);
  coin.advance(1);
  close(coin.yaw, before[0]);
  close(coin.pitch, before[1]);
  assert.equal(coin.moving, false);
});

test('reduced motion and cancellation stop momentum while retaining the pose', () => {
  for (const reduced of [true, false]) {
    const coin = releasedCoin();
    const before = [coin.yaw, coin.pitch];
    if (!reduced) coin.stop();
    coin.advance(.5, reduced);
    close(coin.yaw, before[0]);
    close(coin.pitch, before[1]);
    assert.equal(coin.moving, false);
  }
});
