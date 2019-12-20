/*
 * @Author: xuhao 
 * @Date: 2019-12-17 11:29:41 
 * @Last Modified by: xuhao
 * @Last Modified time: 2019-12-17 15:06:50
 * 模拟componentDidUpdate生命周期函数
 */

import { useEffect, useRef } from "react";
// typeof useEffect = (effect: EffectCallback, deps?: DependencyList | undefined) => void
const useUpdateEffect: typeof useEffect = (effect, deps) => {
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
    } else {
      return effect()
    }
  }, deps);
}

export default useUpdateEffect;
