import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface AgentHomeFocusValue {
  isHomeFocused: boolean;
  setHomeFocused: (focused: boolean) => void;
}

const AgentHomeFocusContext = createContext<AgentHomeFocusValue>({
  isHomeFocused: false,
  setHomeFocused: () => undefined,
});

export function AgentHomeFocusProvider({ children }: { children: ReactNode }) {
  const [isHomeFocused, setHomeFocused] = useState(false);
  const value = useMemo(
    () => ({ isHomeFocused, setHomeFocused }),
    [isHomeFocused]
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
