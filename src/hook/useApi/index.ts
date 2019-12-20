import useAsync from '../useAsync';

interface IProps<T> {
  url: string; 
  options?: RequestInit;
  manual?: boolean;
  pollingInterval?: number;
  method?: (url: string, options?: RequestInit) => Promise<T>;
  onSuccess?: (d: T) => void;
  onError?: (e: Error) => void;
}

let globalMethod: (url: string, options?: RequestInit) => Promise<any>;

const useAPI = <T = any>(opt: IProps<T>) => {
  const requestMethod = opt.method || globalMethod || fetch;
  return useAsync(
    async () => {
      const res = await requestMethod(opt.url, opt.options);
      return res.json && typeof res.json === 'function' ? res.json() : res; 
    },
    [JSON.stringify(opt)],
    {
      manual: opt.manual,
      onSuccess: opt.onSuccess,
      onError: opt.onError,
      pollingInterval: opt.pollingInterval
    }
  )
}

export default useAPI;