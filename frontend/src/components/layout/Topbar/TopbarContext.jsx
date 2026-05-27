import { createContext, useContext } from "react";

export const TopbarActionsContext = createContext({
  setTopbarActions: () => {},
});

export function useTopbarActions() {
  return useContext(TopbarActionsContext);
}
