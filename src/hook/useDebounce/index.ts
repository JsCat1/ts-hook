/*
 * @Author: xuhao 
 * @Date: 2019-12-17 14:14:53 
 * @Last Modified by: xuhao
 * @Last Modified time: 2019-12-17 14:42:17
 *  防抖状态
 */


import { useState } from "react";
import useDebounceFn from "../useDebounceFn";


function useDebounce<T>(value: T, wait: number) {
  const [state, setState] = useState(value);

  useDebounceFn(
    () => {
      setState(value);
    }, 
    [value], 
    1000
  );
  return state;
}

export default useDebounce;