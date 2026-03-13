import { useState, useCallback, useRef } from "react";

export function useUndoRedo<T>(
  initial: T,
  maxHistory = 50,
): {
  state: T;
  setState: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const [state, setStateInternal] = useState<T>(initial);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);

  const setState = useCallback(
    (newState: T) => {
      const currentJson = JSON.stringify(state);
      pastRef.current = [...pastRef.current, currentJson].slice(-maxHistory);
      futureRef.current = [];
      setStateInternal(newState);
    },
    [state, maxHistory],
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [JSON.stringify(state), ...futureRef.current];
    setStateInternal(JSON.parse(prev) as T);
  }, [state]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, JSON.stringify(state)];
    setStateInternal(JSON.parse(next) as T);
  }, [state]);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
