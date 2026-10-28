import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createProtocolState, monitorAssessment } from '../utils/assessmentProtocol';

export default function useAssessmentProtocol({ active, onForceSubmit, durationSeconds = 1800 }) {
  const state = useRef(createProtocolState());
  const monitor = useRef(null);
  const [warning, setWarning] = useState(null);
  const [warningCount, setWarningCount] = useState(0);
  const [endReason, setEndReason] = useState(null);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const submitLatest = useEffectEvent(() => onForceSubmit());

  useEffect(() => {
    if (!active || state.current.finished) return;
    monitor.current = monitorAssessment({ windowTarget: window, documentTarget: document,
      state: state.current, durationSeconds, onTick: setTimeLeft,
      onWarning: info => { setWarningCount(info.count); setWarning(info); },
      onFinish: reason => { setWarningCount(state.current.count); setEndReason(reason); submitLatest(); },
    });
    return () => monitor.current?.stop();
  }, [active, durationSeconds]);

  return { warning, endReason, timeLeft, warningCount,
    resume: () => { monitor.current?.resume(); setWarning(null); },
    retry: onForceSubmit,
  };
}
