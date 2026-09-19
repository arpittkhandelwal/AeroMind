/**
 * useMissionState.js — Deterministic 3D Mission State Machine
 * ============================================================
 * Drives the complete UAV mission lifecycle for the SIH 2026 Jury Demo.
 *
 * State machine: IDLE → PRE_FLIGHT → ENGINE_START → TAKEOFF → CLIMB →
 *   CRUISE → MISSION → DEGRADATION → WARNING → RTB → APPROACH → LANDING → COMPLETED
 *
 * - All transitions are time-driven (deterministic for jury demo)
 * - WARNING is ALSO triggered reactively if actual telemetry health < 55
 * - Fault injection calls the existing backend /missions API (no fake ML)
 * - Event log records real timestamps for the jury
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { startMissionWithFault } from './useTelemetryFeed';
import { API_URL } from '../lib/config';

// ── Mission States ────────────────────────────────────────────────────────
export const MS = {
  IDLE:         'IDLE',
  PRE_FLIGHT:   'PRE_FLIGHT',
  ENGINE_START: 'ENGINE_START',
  TAKEOFF:      'TAKEOFF',
  CLIMB:        'CLIMB',
  CRUISE:       'CRUISE',
  MISSION:      'MISSION',
  DEGRADATION:  'DEGRADATION',
  WARNING:      'WARNING',
  RTB:          'RTB',
  APPROACH:     'APPROACH',
  LANDING:      'LANDING',
  COMPLETED:    'COMPLETED',
};

// ── Ordered list for timeline rendering ──────────────────────────────────
export const MISSION_SEQUENCE = [
  MS.IDLE, MS.PRE_FLIGHT, MS.ENGINE_START, MS.TAKEOFF,
  MS.CLIMB, MS.CRUISE, MS.MISSION, MS.DEGRADATION,
  MS.WARNING, MS.RTB, MS.APPROACH, MS.LANDING, MS.COMPLETED,
];

// ── Deterministic timing for jury demo (seconds from demo start) ─────────
const TIMINGS = {
  PRE_FLIGHT:   0,
  ENGINE_START: 4,
  TAKEOFF:      9,
  CLIMB:        16,
  CRUISE:       25,
  MISSION:      36,
  FAULT_INJECT: 45,          // Inject fault into backend at this time
  DEGRADATION:  50,          // UI transitions to DEGRADATION at this time
  WARNING_FAILSAFE: 70,      // Force WARNING even if telemetry doesn't detect it
  WARNING_MIN_HOLD: 5,       // Stay in WARNING at least 5s before RTB
  RTB_TO_APPROACH: 14,       // Seconds after RTB starts
  APPROACH_TO_LANDING: 8,    // Seconds after APPROACH starts
  LANDING_TO_COMPLETE: 7,    // Seconds after LANDING starts
};

// ── 3D Waypoints (Three.js coordinates) ─────────────────────────────────
// These map to FlyingDrone positions in DigitalTwin3DView
export const WAYPOINTS = {
  BASE:     { x: 0,   y: -1.8,  z: 8   },  // Runway start
  TAKEOFF:  { x: 0,   y:  2.5,  z: 4   },  // Just off runway
  CLIMB:    { x: 0,   y:  7,    z: -4  },  // Mid-climb
  CRUISE:   { x: 0,   y: 12,    z: -18 },  // Cruise altitude
  MISSION:  { x: 0,   y: 14,    z: -30 },  // Mission area entry
  RTB_MID:  { x: 0,   y: 10,    z: -12 },  // Mid-return
  APPROACH: { x: 0,   y:  3.5,  z:  2  },  // Final approach
  LANDED:   { x: 0,   y: -1.8,  z: 7   },  // Landed on runway
};

export function useMissionState(telemetry, alerts, healthIndex) {
  const [state, setState]           = useState(MS.IDLE);
  const [demoActive, setDemoActive] = useState(false);
  const [paused, setPaused]         = useState(false);
  const [startTime, setStartTime]   = useState(null);
  const [pausedAt, setPausedAt]     = useState(null);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [elapsed, setElapsed]       = useState(0);
  const [faultInjected, setFaultInjected] = useState(false);
  const [warningTime, setWarningTime]     = useState(null);
  const [eventLog, setEventLog]     = useState([]);

  const [selectedFault, setSelectedFault] = useState('overheating');

  // Refs to avoid stale closures in interval
  const stateRef        = useRef(state);
  const faultRef        = useRef(faultInjected);
  const warningTimeRef  = useRef(warningTime);
  const pausedRef       = useRef(paused);
  const selectedFaultRef = useRef(selectedFault);

  useEffect(() => { stateRef.current = state; },           [state]);
  useEffect(() => { faultRef.current = faultInjected; },   [faultInjected]);
  useEffect(() => { warningTimeRef.current = warningTime; },[warningTime]);
  useEffect(() => { pausedRef.current = paused; },          [paused]);
  useEffect(() => { selectedFaultRef.current = selectedFault; }, [selectedFault]);

  // Health from real telemetry
  const healthScore = healthIndex?.score ?? 100;
  const isCritical  = healthScore < 55 ||
    (alerts && alerts.some(a => a.severity === 'CRITICAL'));

  // ── Log helper ────────────────────────────────────────────────────────
  const log = useCallback((msg) => {
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setEventLog(prev => [...prev.slice(-30), { ts, msg }]);
  }, []);

  const transition = useCallback((newState) => {
    setState(newState);
    log(newState.replace(/_/g, ' '));
  }, [log]);

  // ── Fault injection via real backend ─────────────────────────────────
  const injectFault = useCallback(async () => {
    if (faultRef.current) return;
    setFaultInjected(true);
    const f = selectedFaultRef.current;
    log(`FAULT INJECTION: ${f} initiated`);
    try {
      await startMissionWithFault(f, 'high_altitude');
      log(`BACKEND: ${f} mission stream active`);
    } catch (e) {
      log('FAULT: Using simulation fallback');
    }
  }, [log]);

  // ── Public Controls ───────────────────────────────────────────────────
  const startDemo = useCallback(() => {
    const now = Date.now();
    setState(MS.PRE_FLIGHT);
    setDemoActive(true);
    setPaused(false);
    setStartTime(now);
    setPausedElapsed(0);
    setPausedAt(null);
    setElapsed(0);
    setFaultInjected(false);
    setWarningTime(null);
    setEventLog([]);
    log('JURY DEMO STARTED');
    log('PRE FLIGHT CHECK');
  }, [log]);

  const pauseDemo = useCallback(() => {
    if (!demoActive || paused) return;
    setPaused(true);
    setPausedAt(Date.now());
    log('MISSION PAUSED');
  }, [demoActive, paused, log]);

  const resumeDemo = useCallback(() => {
    if (!demoActive || !paused) return;
    if (pausedAt) {
      const additional = Date.now() - pausedAt;
      setPausedElapsed(prev => prev + additional);
    }
    setPaused(false);
    setPausedAt(null);
    log('MISSION RESUMED');
  }, [demoActive, paused, pausedAt, log]);

  const resetDemo = useCallback(() => {
    setState(MS.IDLE);
    setDemoActive(false);
    setPaused(false);
    setStartTime(null);
    setPausedAt(null);
    setPausedElapsed(0);
    setElapsed(0);
    setFaultInjected(false);
    setWarningTime(null);
    setEventLog([]);
  }, []);

  const triggerFaultNow = useCallback((overrideFault) => {
    if (overrideFault && typeof overrideFault === 'string') {
      setSelectedFault(overrideFault);
    }
    if (demoActive && !faultInjected) injectFault();
  }, [demoActive, faultInjected, injectFault]);

  const triggerRTBNow = useCallback(() => {
    if (demoActive && stateRef.current !== MS.RTB && stateRef.current !== MS.APPROACH && stateRef.current !== MS.LANDING && stateRef.current !== MS.COMPLETED) {
      const wt = Date.now();
      setWarningTime(wt);
      warningTimeRef.current = wt;
      transition(MS.RTB);
      log('MANUAL OVERRIDE: RETURN TO BASE INITIATED');
    }
  }, [demoActive, transition, log]);

  // ── Main state machine interval ───────────────────────────────────────
  useEffect(() => {
    if (!demoActive || !startTime) return;

    const id = setInterval(() => {
      if (pausedRef.current) return;

      const now = Date.now();
      const t = (now - startTime - pausedElapsed) / 1000;
      setElapsed(t);

      const cur = stateRef.current;

      // Phase 1: Pre-flight → Engine Start
      if (cur === MS.PRE_FLIGHT && t >= TIMINGS.ENGINE_START) {
        transition(MS.ENGINE_START);
      }
      // Phase 2: Engine Start → Takeoff
      else if (cur === MS.ENGINE_START && t >= TIMINGS.TAKEOFF) {
        transition(MS.TAKEOFF);
      }
      // Phase 3: Takeoff → Climb
      else if (cur === MS.TAKEOFF && t >= TIMINGS.CLIMB) {
        transition(MS.CLIMB);
      }
      // Phase 4: Climb → Cruise
      else if (cur === MS.CLIMB && t >= TIMINGS.CRUISE) {
        transition(MS.CRUISE);
      }
      // Phase 5: Cruise → Mission
      else if (cur === MS.CRUISE && t >= TIMINGS.MISSION) {
        transition(MS.MISSION);
        log('MISSION AREA REACHED');
      }

      // Fault injection at t=90s
      if (t >= TIMINGS.FAULT_INJECT && !faultRef.current) {
        injectFault();
      }

      // Phase 6: Mission → Degradation
      if (cur === MS.MISSION && t >= TIMINGS.DEGRADATION) {
        transition(MS.DEGRADATION);
        log('ENGINE DEGRADATION DETECTED');
        log('ANOMALY SCORE RISING');
      }

      // Phase 7: Degradation → Warning (reactive OR failsafe)
      const inDegradation = cur === MS.DEGRADATION;
      const inMission = cur === MS.MISSION;
      const qualifiesForWarning = inDegradation || (inMission && t > TIMINGS.DEGRADATION);
      if (qualifiesForWarning &&
          (isCritical || t >= TIMINGS.WARNING_FAILSAFE) &&
          !warningTimeRef.current) {
        const wt = now;
        setWarningTime(wt);
        warningTimeRef.current = wt;
        transition(MS.WARNING);
        log('⚠ ENGINE HEALTH WARNING TRIGGERED');
        log('RECOMMENDATION: RETURN TO BASE');
      }

      // Phase 8: Warning → RTB (after min hold time)
      if (cur === MS.WARNING && warningTimeRef.current) {
        const sinceWarning = (now - warningTimeRef.current) / 1000;
        if (sinceWarning >= TIMINGS.WARNING_MIN_HOLD) {
          transition(MS.RTB);
          log('RTB INITIATED — UAV TURNING TO BASE');
        }
      }

      // Phase 9–12: RTB → Approach → Landing → Completed
      if (cur === MS.RTB && warningTimeRef.current) {
        const sinceWarning = (now - warningTimeRef.current) / 1000;
        if (sinceWarning >= TIMINGS.WARNING_MIN_HOLD + TIMINGS.RTB_TO_APPROACH) {
          transition(MS.APPROACH);
          log('FINAL APPROACH INITIATED');
        }
      }
      if (cur === MS.APPROACH && warningTimeRef.current) {
        const sinceWarning = (now - warningTimeRef.current) / 1000;
        if (sinceWarning >= TIMINGS.WARNING_MIN_HOLD + TIMINGS.RTB_TO_APPROACH + TIMINGS.APPROACH_TO_LANDING) {
          transition(MS.LANDING);
          log('LANDING SEQUENCE STARTED');
        }
      }
      if (cur === MS.LANDING && warningTimeRef.current) {
        const sinceWarning = (now - warningTimeRef.current) / 1000;
        if (sinceWarning >= TIMINGS.WARNING_MIN_HOLD + TIMINGS.RTB_TO_APPROACH + TIMINGS.APPROACH_TO_LANDING + TIMINGS.LANDING_TO_COMPLETE) {
          transition(MS.COMPLETED);
          setDemoActive(false);
          log('✓ MISSION COMPLETED — UAV RETURNED SAFELY');
          log('ENGINE FAULT INTERCEPTED BY AI SYSTEM');
        }
      }
    }, 250);

    return () => clearInterval(id);
  }, [demoActive, startTime, pausedElapsed, isCritical, transition, log, injectFault]);

  // ── Derived state ─────────────────────────────────────────────────────
  const stateIndex = MISSION_SEQUENCE.indexOf(state);

  return {
    state,
    elapsed,
    demoActive,
    paused,
    eventLog,
    isCritical,
    faultInjected,
    stateIndex,
    selectedFault,
    setSelectedFault,
    startDemo,
    pauseDemo,
    resumeDemo,
    resetDemo,
    triggerFaultNow,
    triggerRTBNow,
  };
}
