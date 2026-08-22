import { useEffect } from "react";

type CloseHandler = () => void;

const stack: CloseHandler[] = [];

export function closeTopModal(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

export function useBackCloseable(active: boolean, onClose: CloseHandler) {
  useEffect(() => {
    if (!active) return;
    stack.push(onClose);
    return () => {
      const index = stack.lastIndexOf(onClose);
      if (index !== -1) stack.splice(index, 1);
    };
  }, [active, onClose]);
}
