/*
 * @Author: xuhao 
 * @Date: 2019-12-17 11:38:48 
 * @Last Modified by: xuhao
 * @Last Modified time: 2019-12-17 15:36:31
 * 抖动函数 hook
 */
import { useRef, useEffect, DependencyList, useCallback } from "react";
import useUpdateEffect from "../useUpdateEffect";

type noop = (...args: any[]) => any;

export interface ReturnValue<T extends any> {
  run: (...args: any) => void;
  cancel: () => void;
};

function useDebounceFn<T extends any>(
  fn: (...args: any[]) => any, 
  wait: number
): ReturnValue<T>;
function useDebounceFn<T extends any>(
  fn: (...args: any[]) => any,
  dept: DependencyList,
  wait: number
): ReturnValue<T>;
function useDebounceFn<T extends any>(
  fn: (...args: any[]) => any,
  dept: DependencyList | number,
  wait?: number
): ReturnValue<T> {
  const _dept: DependencyList = (Array.isArray(dept) ? dept : []) as DependencyList;
  const _wait: number = typeof dept === 'number' ? dept : wait || 0;
  const timer = useRef<any>();
  
  const fnRef = useRef<noop>(fn);
  fnRef.current = fn;
  
  const cancel = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
    }
  }, []);

  const run = useCallback((...args: any[]) => {
    cancel();
    timer.current = setTimeout(() => {
      fnRef.current();
    }, _wait);

  }, [_wait, cancel]);

  useUpdateEffect(() => {
    run();
  },[..._dept, run]);

  useEffect(() => cancel, [cancel]);

  return {
    run,
    cancel
  };
}

export default useDebounceFn;