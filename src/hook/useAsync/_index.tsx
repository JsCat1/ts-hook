import { DependencyList, useCallback, useRef, useEffect, useState } from 'react';

class Timer<T> {
  private remainting = 0;
  
  private delay = 0;

  private cb: ((...args: any[]) => Promise<T | undefined>) | null = null;
  
  private start = 0;

  private timerId:any = 0;

  constructor(cb: () => Promise<T | undefined>, delay: number) {
    this.delay = delay;
    this.remainting = delay;
    this.cb = cb;
    this.start = Date.now();
  }

  // 停止
  stop = () => {
    clearInterval(this.timerId);
    this.timerId = 0;
    this.remainting = this.delay;
  }
  // 暂停
  pause = () => {
    clearInterval(this.timerId);
    this.remainting -= Date.now() - this.start;
  }
  // 恢复
  resume = () => {
    this.start = Date.now();
    clearInterval(this.timerId);
    this.timerId = setTimeout(async () => {
      if (this.cb) {
        this.cb();
      }
    }, this.remainting);
  }
}

export interface Options<T> {
  manual?: boolean; // 是否初始化
  pollingInterval: number; // 轮询间隔时间
  onSuccess: (data: T, params?: any[]) => void; // 成功回调
  onError: (err: Error, params?: any[]) => void; // 失败回调
  autoCancel?: boolean; // 竞态处理开关
}

type noop = (...args: any[]) => void;
const noop: noop = () => {};

type promiseReturn<T> = (...args: any[]) => Promise<T | undefined>;
const promiseReturn: promiseReturn<any> = async () => null as any;

export interface ReturnValue<T> {
  loading: boolean;
  error?: Error | string;
  params: any[];
  data?: T;
  cancel: noop;
  run: promiseReturn<T | undefined>;
  timer: {
    stop: noop;
    resume: noop;
    pause: noop;
  };
}

function useAsync<Result = any>(
  fn: (...args: any[]) => Promise<Result>,
  options?: Options<Result>
): ReturnValue<Result>;
function useAsync<Result = any>(
  fn: (...args: any[]) => Promise<Result>,
  deps?: DependencyList,
  options?: Options<Result>
): ReturnValue<Result>;
function useAsync<Result = any>(
  fn: (...args: any[]) => Promise<Result>,
  deps?: DependencyList | Options<Result>,
  options?: Options<Result>
): ReturnValue<Result> {
  const _deps: DependencyList = (Array.isArray(deps) ? deps : []) as DependencyList;
  const _options: Options<Result> = (typeof deps === 'object' && !Array.isArray(deps)
  ? deps
  : options || {}) as Options<Result>;
  const params = useRef<any[]>([]);
  const { autoCancel = true } = _options;
  const time = useRef<Timer<Result> | undefined>(undefined);
  const omitNextResume = useRef(false);
  
  const count = useRef(0);
  const fnRef = useRef(fn);

  const onSuccessRef = useRef(_options.onSuccess);
  const onErrorRef = useRef(_options.onError);

  // 初始化状态
  const [state, set] = useState({
    data: undefined as (Result | undefined),
    error: undefined as (Error | string | undefined),
    loading: !_options.manual
  });

  // 请求
  const run = useCallback((...args: any[]): Promise<Result | undefined> => {
    // 确保不会返回被取消的数据
    const runCount = count.current;
    set(s => ({...s, loading: true}));
    return fnRef
    .current(...args)
    .then(data => {
      if (runCount === count.current) {
        set(s => ({...s, data, loading: false}));
        if (onSuccessRef.current) {
          onSuccessRef.current(data, args || []);
        }
      }
      return data;
    })
    .catch(error => {
      set(s => ({...s, loading: false, error}));
      if (onErrorRef.current) {
        onErrorRef.current(error, args || []);
      }
      throw error;
    });
  }, []);

  // 软取消，由于竞态，需要取消上一次请求
  const softCancel = useCallback(() => {
    if (autoCancel) {
      count.current++;
      set(s => ({...s, loading: false}));
    }
  }, [autoCancel]);
  
  // 强制取消，组件卸载，或者用户手动取消
  const forceCancel = useCallback(() => {
    count.current++;
    set(s => ({...s, loading: false}));
  }, []);

  // 停止
  const stop = useCallback(() => {
    if (time.current) {
      time.current.stop();
      omitNextResume.current = true;
    }
  }, []);

  // 重启
  const resume = useCallback(() => {
    if (time.current) {
      omitNextResume.current = false;
      time.current.resume();
    }
  }, []);

  // 暂停
  const pause = useCallback(() => {
    if (time.current) {
      time.current.pause();
      omitNextResume.current = true;
    }
    forceCancel();
  }, [forceCancel]);

  const start = useCallback(
  async (...args: any[]) => {
    // 有轮询
    if (_options.pollingInterval) {
      if (time.current) {
        stop();
      }
      omitNextResume.current = false;
      time.current = new Timer<Result>(() => start(...args), _options.pollingInterval);
      const ret = run(...args);
      ret.finally(() => {
        if (time.current && !omitNextResume.current) {
          time.current.resume();
        }
      });
      return ret;
    }
    // 如果上一次异步操作还在loading，则会尝试取消上一次的异步操作。
    softCancel();
    return run(...args);
  }, [run, _options.pollingInterval, softCancel, stop]);
  
  useEffect(() => {
    if (!_options.manual) {
      // 如果deps发生变化，重新执行
      start();
    }
    // 卸载时取消
    return () => {
      if (time.current) {
        time.current.stop();
      }
      forceCancel();
    }

  }, [start, forceCancel, _options.manual, ..._deps]);

  return {
    loading: state.loading,
    params: params.current,
    error: state.error,
    data: state.data,
    cancel: forceCancel,
    run: start,
    timer: {
      stop,
      resume,
      pause
    }
  }

}

export default useAsync;