import { useRef, useCallback, DependencyList, useEffect } from "react";
import useUpdateEffect from "../useUpdateEffect";

type noop = (...args: any[]) => any;

export interface ReturnValue<T extends any[]> {
  run: (...args: T) => void;
  cancel: () => void;
};

function useThrottleFn<T extends any[]>(
  fn: (...args: T) => void,
  wait: number
): ReturnValue<T>;
function useThrottleFn<T extends any[]>(
  fn: (...args: T) => void,
  deps: DependencyList,
  wait: number
): ReturnValue<T>;
function useThrottleFn<T extends any[]>(
  fn: (...args: T) => void,
  deps: DependencyList | number,
  wait?: number
): ReturnValue<T> {
  const _deps: DependencyList = (Array.isArray(deps) ? deps : []) as DependencyList;
  const _wait: number = typeof deps === 'number' ? deps : wait || 0;
  const timer = useRef<any>();

  const fnRef = useRef<noop>(fn);
  fnRef.current = fn;

  const currentArgs = useRef<any>([]);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
    }
    timer.current = undefined;
  }, []);

  const run = useCallback(
    (...args: any[]) => {
      currentArgs.current = args;
      if (!timer.current) {
        timer.current = setTimeout(() => {
          fnRef.current();
          cancel();
        }, _wait);
      }
    },
    [_wait, cancel]
  );
  
  useUpdateEffect(() => {
    run();
  }, [..._deps, run]);
  
  useEffect(() => cancel, [cancel]);

  return {
    run,
    cancel
  }
}

export default useThrottleFn;