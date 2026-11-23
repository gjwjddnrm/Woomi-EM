import { createContext, useContext } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'capture'; id: string }
  | { name: 'timeline'; id: string }
  | { name: 'settings' }
  | { name: 'report'; id: string };

export type Nav = {
  route: Route;
  push(r: Route): void;
  replace(r: Route): void;
  reset(r: Route): void;
  back(): void;
};

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavContext);
  if (!n) throw new Error('NavContext missing');
  return n;
}
