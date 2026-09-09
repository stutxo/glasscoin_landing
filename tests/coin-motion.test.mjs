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

test('arrival cue starts face-on, shows a bounded turn, and settles without momentum', () => {
  const coin = createCoinMotion();
  coin.hint();
  close(coin.yaw, 0);
  coin.advance(.5);
  close(coin.yaw, 0);
  let largestTurn = 0;
  let smallestTurn = 0;
  for (let i = 0; i < 240; i++) {
    coin.advance(1 / 60);
    largestTurn = Math.max(largestTurn, coin.yaw);
    smallestTurn = Math.min(smallestTurn, coin.yaw);
    close(coin.pitch, 0);
  }
  assert.ok(largestTurn > .5 && largestTurn < .7);
  assert.ok(smallestTurn < -.15 && smallestTurn > -.3);
  close(coin.yaw, 0);
  assert.equal(coin.moving, false);
  coin.hint();
  coin.advance(1.5);
  close(coin.yaw, 0);
  assert.equal(coin.moving, false);
});

test('arrival cue follows the same timing at different refresh rates', () => {
  const slow = createCoinMotion();
  const fast = createCoinMotion();
  slow.hint();
  fast.hint();
  for (let i = 0; i < 60; i++) slow.advance(1 / 30);
  for (let i = 0; i < 288; i++) fast.advance(1 / 144);
  close(slow.yaw, fast.yaw);
});

test('grabbing during the cue preserves the pose and permanently takes control', () => {
  for (const cueTime of [.3, 1.4, 2.5]) {
    const coin = createCoinMotion();
    coin.hint();
    coin.advance(cueTime);
    const before = coin.yaw;
    coin.start(100);
    close(coin.yaw, before);
    coin.drag(.04, 0, 116);
    const dragged = coin.yaw;
    assert.ok(dragged > before);
    coin.release(300, false);
    coin.advance(4);
    close(coin.yaw, dragged);
    coin.hint();
    coin.advance(2);
    close(coin.yaw, dragged);
  }
});

test('keyboard control or cancellation before the image loads suppresses a late cue', () => {
  for (const takeControl of [coin => coin.cancelHint(), coin => coin.turn(1), coin => coin.stop(), coin => coin.start(0)]) {
    const coin = createCoinMotion();
    takeControl(coin);
    const before = coin.yaw;
    coin.hint();
    coin.advance(2);
    close(coin.yaw, before);
    assert.equal(coin.moving, false);
  }
});

test('reduced motion stops an arrival cue without snapping or restarting it', () => {
  for (const cueTime of [0, 1.4]) {
    const coin = createCoinMotion();
    coin.hint();
    coin.advance(cueTime);
    const before = coin.yaw;
    coin.advance(.5, true);
    close(coin.yaw, before);
    assert.equal(coin.moving, false);
    coin.hint();
    coin.advance(4);
    close(coin.yaw, before);
  }
});
