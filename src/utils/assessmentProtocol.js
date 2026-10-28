export const MAX_WARNINGS = 3;

export function createProtocolState() {
  return { count: 0, away: false, finished: false, deadline: null };
}

// Browser events are injected so departure counting and deadlines can be tested
// without changing real tabs or waiting for a complete assessment timer.
export function monitorAssessment({ windowTarget, documentTarget, state,
  onWarning, onFinish, onTick, durationSeconds, now = Date.now }) {
  const listeners = [];
  const listen = (target, name, handler, capture = false) => {
    target.addEventListener(name, handler, capture);
    listeners.push(() => target.removeEventListener(name, handler, capture));
  };
  const pauseMedia = () => documentTarget.querySelectorAll?.('audio, video').forEach(media => media.pause());
  const finish = reason => {
    if (state.finished) return;
    state.finished = true;
    pauseMedia();
    onFinish(reason);
  };
  const depart = () => {
    if (state.finished || state.away) return;
    state.away = true;
    state.count += 1;
    pauseMedia();
    if (state.count >= MAX_WARNINGS) finish('Three test-window departures were recorded.');
    else onWarning({ count: state.count, message: 'Stay in this assessment tab and window. Do not switch tabs or applications.' });
  };
  const returnToTest = () => {
    if (!documentTarget.hidden && documentTarget.hasFocus()) state.away = false;
  };
  const block = event => {
    event.preventDefault();
    onWarning({ count: state.count, message: 'Copying, pasting, dragging content and right-click are blocked during this assessment.' });
  };
  listen(windowTarget, 'blur', depart);
  listen(windowTarget, 'focus', returnToTest);
  listen(documentTarget, 'visibilitychange', () => documentTarget.hidden ? depart() : returnToTest());
  for (const name of ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'drop']) listen(documentTarget, name, block);
  listen(documentTarget, 'keydown', event => {
    if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'p', 's', 'r'].includes(event.key.toLowerCase()))) block(event);
  });
  listen(windowTarget, 'beforeunload', event => {
    if (state.finished) return;
    event.preventDefault();
    event.returnValue = '';
  });
  listen(documentTarget, 'click', event => {
    if (!event.target.closest?.('[data-assessment-navigation]')) return;
    event.preventDefault();
    event.stopPropagation();
    onWarning({ count: state.count, message: 'Submit your assessment before leaving this page.' });
  }, true);
  if (state.deadline === null) state.deadline = now() + durationSeconds * 1000;
  const tick = () => {
    if (state.finished) return;
    const remaining = Math.max(0, Math.ceil((state.deadline - now()) / 1000));
    onTick(remaining);
    if (remaining === 0) finish('The assessment time limit has been reached.');
  };
  const interval = windowTarget.setInterval(tick, 1000);
  return {
    resume: returnToTest,
    stop() { listeners.forEach(remove => remove()); windowTarget.clearInterval(interval); },
  };
}
