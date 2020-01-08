import { useState, DependencyList, useCallback, useEffect, useMemo, useRef } from "react";
import useAsync from "../useAsync";
import useUpdateEffect from "../useUpdateEffect";

export interface ReturnValue<Item> {
  data: Item[];
  loading: boolean;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPage: number;
    onChange: (current: number, pageSize: number) => void;
    changeCurrent: (current: number) => void;
    changePageSize: (pageSize: number) => void;
  };
  refresh: () => void;
}

export interface FormattedResult<Item> {
  current?: number;
  pageSize?: number;
  total: number;
  data: Item[];
}

export interface Option<Result, Item> {
  defaultPageSize?: number;
  formattResult?: (result: Result) => FormattedResult<Item>;
}

export interface FnParams {
  current: number;
  pageSize: number;
  [key: string]: any;
}

function usePagination<Result, Item>(
  fn: (params: FnParams) => Promise<Result>,
  option?: Option<Result, Item>
): ReturnValue<Item>;
function usePagination<Result, Item>(
  fn: (params: FnParams) => Promise<Result>,
  deps?: DependencyList,
  option?: Option<Result, Item>
): ReturnValue<Item>;
function usePagination<Result, Item>(
  fn: (params: FnParams) => Promise<Result>,
  deps?: DependencyList | Option<Result, Item>,
  option?: Option<Result, Item>
): ReturnValue<Item> {
  const _dept: DependencyList = (Array.isArray(deps) ? deps : []) as DependencyList;
  const _option: Option<Result, Item> = (typeof deps === 'object' && !Array.isArray(deps) 
    ? deps 
    : option || {}) as Option<Result, Item>;
  const { defaultPageSize = 10, formattResult } = _option;

  const formattResultRef = useRef(formattResult);
  formattResultRef.current = formattResult;

  const [data, setData] = useState<Item[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [current, setCurrent] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [count, setCount] = useState<number>(0); // 用于强制渲染使用
  
  const { run, loading } = useAsync(fn, _dept, {
    manual: true
  });
  
  useEffect(() => {
    run({
      pageSize,
      current
    })
    .then(res => {
      if (!res) return;
      const formattedResult = formattResultRef.current
      ? formattResultRef.current(res)
      : (res as unknown) as FormattedResult<Item>;
      if (formattedResult) {
        if (typeof formattedResult.total === 'number') setTotal(formattedResult.total);
        if (typeof formattedResult.current === 'number') setCount(formattedResult.current);
        if (formattedResult.data) setData(formattedResult.data);
        if (typeof formattedResult.pageSize === 'number') setPageSize(formattedResult.pageSize);
      }
    });
  }, [current, pageSize, count, run]);

  useUpdateEffect(() => { // 外部请求依赖项变了以后，强制触发请求，并把页数重置为1
    setCurrent(1);
    setCount(c => c + 1);
  }, _dept);

  const totalPage = useMemo(() => Math.ceil(total / pageSize), [total, pageSize]);

  const onChange = useCallback(
    (c: number, p: number) => {
      let toCurrent = c <= 0 ? 1 : c;
      const toPageSize = p <= 0 ? 1 : p;
      
      const tempTotalPage = Math.ceil(total / toPageSize);
      toCurrent = Math.min(toCurrent, tempTotalPage);
      setCount(toCurrent);
      setPageSize(toPageSize);
    },
    [total]
  );

  const changeCurrent = useCallback(
    (c: number) => {
      onChange(c, pageSize);
    }, 
    [onChange, pageSize]
  );
  
  const changePageSize = useCallback(
    (p: number) => {
      onChange(current, p);
    },
    [onChange, current]
  );

  const refresh = useCallback(() => {
    setCount(count => count + 1);
  }, []);

  return {
    data,
    loading,
    pagination: {
      onChange,
      changeCurrent,
      changePageSize,
      pageSize,
      totalPage,
      total,
      current
    },
    refresh
  };
}

export default usePagination;