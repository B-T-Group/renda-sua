import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface AgentHomeFocusValue {
  isHomeFocused: boolean;
  setHomeFocused: (focused: boolean) => void;
  isOrderDetailFocused: boolean;
  setOrderDetailFocused: (focused: boolean) => void;
  isOrdersFocused: boolean;
  setOrdersFocused: (focused: boolean) => void;
}

const AgentHomeFocusContext = createContext<AgentHomeFocusValue>({
  isHomeFocused: false,
  setHomeFocused: () => undefined,
  isOrderDetailFocused: false,
  setOrderDetailFocused: () => undefined,
  isOrdersFocused: false,
  setOrdersFocused: () => undefined,
});

export function AgentHomeFocusProvider({ children }: { children: ReactNode }) {
  const [isHomeFocused, setHomeFocused] = useState(false);
  const [isOrderDetailFocused, setOrderDetailFocused] = useState(false);
  const [isOrdersFocused, setOrdersFocused] = useState(false);
  const value = useMemo(
    () => ({
      isHomeFocused,
      setHomeFocused,
      isOrderDetailFocused,
      setOrderDetailFocused,
      isOrdersFocused,
      setOrdersFocused,
    }),
    [isHomeFocused, isOrderDetailFocused, isOrdersFocused]
  );
  return (
    <AgentHomeFocusContext.Provider value={value}>
      {children}
    </AgentHomeFocusContext.Provider>
  );
}

export function useAgentHomeFocus(): AgentHomeFocusValue {
  return useContext(AgentHomeFocusContext);
}
