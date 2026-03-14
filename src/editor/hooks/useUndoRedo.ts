import { useCallback, useRef, useState } from "react";

type SetStateAction<T> = T | ((prev: T) => T);

export function useUndoRedo<T>(initial: T, maxHistory = 100) {
  const [state, setStateInternal] = useState<T>(initial);
  const stateRef = useRef<T>(initial);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const [pastLen, setPastLen] = useState(0);
  const [futureLen, setFutureLen] = useState(0);

  const setState = useCallback(
    (action: SetStateAction<T>) => {
      const prev = stateRef.current;
      const next =
        typeof action === "function"
          ? (action as (prev: T) => T)(prev)
          : action;
      if (next === prev) return;

      pastRef.current = [...pastRef.current, JSON.stringify(prev)].slice(
        -maxHistory,
      );
      futureRef.current = [];
      stateRef.current = next;
      setStateInternal(next);
      setPastLen(pastRef.current.length);
      setFutureLen(0);
    },
    [maxHistory],
  );

  const undo = useCallback((): T | null => {
    if (pastRef.current.length === 0) return null;
    const prevJson = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      JSON.stringify(stateRef.current),
      ...futureRef.current,
    ];
    const restored = JSON.parse(prevJson) as T;
    stateRef.current = restored;
    setStateInternal(restored);
    setPastLen(pastRef.current.length);
    setFutureLen(futureRef.current.length);
    return restored;
  }, []);

  const redo = useCallback((): T | null => {
    if (futureRef.current.length === 0) return null;
    const nextJson = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, JSON.stringify(stateRef.current)];
    const restored = JSON.parse(nextJson) as T;
    stateRef.current = restored;
    setStateInternal(restored);
    setPastLen(pastRef.current.length);
    setFutureLen(futureRef.current.length);
    return restored;
  }, []);

  const resetHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setPastLen(0);
    setFutureLen(0);
  }, []);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: pastLen > 0,
    canRedo: futureLen > 0,
    resetHistory,
  };
}
