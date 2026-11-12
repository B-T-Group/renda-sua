import { createContext, useContext } from 'react';

/** To-do count for the client Rentals tab. The tab navigator owns the fetch. */
export const ClientRentalsTabCountContext = createContext(0);

export function useClientRentalsTabCount(): number {
  return useContext(ClientRentalsTabCountContext);
}
