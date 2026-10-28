import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtocolState, monitorAssessment } from './assessmentProtocol.js';

function setup(state = createProtocolState(), clockStart = 0) {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.hidden = false;
  doc.focused = true;
  doc.hasFocus = () => doc.focused;
  let pauses = 0;
  doc.querySelectorAll = () => [{ pause: () => { pauses += 1; } }];
  let tick;
  let clock = clockStart;
  win.setInterval = callback => { tick = callback; return 1; };
  win.clearInterval = () => { tick = null; };
  const warnings = [], finished = [], times = [];
  const monitor = monitorAssessment({ windowTarget: win, documentTarget: doc,
    state, durationSeconds: 30, now: () => clock,
    onWarning: warning => warnings.push(warning), onFinish: reason => finished.push(reason), onTick: time => times.push(time),
  });
  return { win, doc, state, warnings, finished, times, monitor,
    pauses: () => pauses,
    advance: ms => { clock += ms; tick?.(); },
    leave: () => { doc.focused = false; win.dispatchEvent(new Event('blur')); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); },
    back: () => { doc.hidden = false; doc.focused = true; doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('focus')); },
  };
}

test('one departure counts once when blur and hidden both fire', () => {
  const f = setup();
  f.leave();
  assert.equal(f.state.count, 1);
  assert.equal(f.warnings.length, 1);
  assert.equal(f.pauses(), 1);
  f.monitor.stop();
});

test('ordinary window focus loss is detected even when the tab stays visible', () => {
  const f = setup();
  f.win.dispatchEvent(new Event('blur'));
  assert.equal(f.doc.hidden, false);
  assert.equal(f.state.count, 1);
  f.monitor.stop();
});

test('third separate departure ends and submits only once', () => {
  const f = setup();
  for (let i = 0; i < 4; i += 1) { f.leave(); f.back(); }
  f.advance(60000);
  assert.equal(f.state.count, 3);
  assert.equal(f.finished.length, 1);
  assert.equal(f.warnings.length, 2);
  f.monitor.stop();
});

test('copy, cut, paste, drag, drop and context menu are blocked without a focus penalty', () => {
  const f = setup();
  for (const type of ['copy', 'cut', 'paste', 'dragstart', 'drop', 'contextmenu']) {
    const event = new Event(type, { cancelable: true });
    f.doc.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, type);
  }
  assert.equal(f.state.count, 0);
  f.monitor.stop();
});

test('typing is allowed while paste and refresh shortcuts are blocked', () => {
  const f = setup();
  for (const [key, ctrlKey, blocked] of [['a', false, false], ['v', true, true], ['F5', false, true], ['r', true, true]]) {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key, ctrlKey });
    f.doc.dispatchEvent(event);
    assert.equal(event.defaultPrevented, blocked);
  }
  f.monitor.stop();
});

test('deadline expires after background throttling, with a single submission', () => {
  const f = setup();
  f.advance(31000);
  f.advance(60000);
  assert.deepEqual(f.times, [0]);
  assert.equal(f.finished.length, 1);
  assert.match(f.finished[0], /time limit/);
  f.monitor.stop();
});

test('warnings and deadline survive a listener restart', () => {
  const first = setup();
  first.leave(); first.back(); first.monitor.stop();
  const resumed = setup(first.state, 5000);
  resumed.advance(1000);
  assert.equal(resumed.times[0], 24);
  resumed.leave();
  assert.equal(resumed.state.count, 2);
  resumed.monitor.stop();
});

test('leaving an active page prompts, and cleanup removes all handlers', () => {
  const f = setup();
  const event = new Event('beforeunload', { cancelable: true });
  Object.defineProperty(event, 'returnValue', { value: undefined, writable: true });
  f.win.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  f.monitor.stop();
  const copy = new Event('copy', { cancelable: true });
  f.doc.dispatchEvent(copy); f.leave();
  assert.equal(copy.defaultPrevented, false);
  assert.equal(f.state.count, 0);
});
