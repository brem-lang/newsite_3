/**
 * Minimal react-router-dom compatibility layer on top of TanStack Router.
 * The project's pages were written against react-router's API; this keeps
 * them working unchanged. `react-router-dom` is aliased to this module.
 */
import React, { createContext, useContext, useCallback, useMemo } from "react";
import {
  Link as TanstackLink,
  Outlet as TanstackOutlet,
  useNavigate as useTanstackNavigate,
  useRouterState,
  useParams as useTanstackParams,
} from "@tanstack/react-router";

/* -------------------------------- Link -------------------------------- */

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  replace?: boolean;
  state?: unknown;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state: _state, ...rest },
  ref,
) {
  // TanStack's Link is typed against the generated route tree; these are
  // runtime string paths coming from the ported pages.
  const AnyLink = TanstackLink as unknown as React.ComponentType<any>;
  return <AnyLink ref={ref} to={to} replace={replace} {...rest} />;
});

export const NavLink = Link;

/* ------------------------------- Outlet ------------------------------- */

const OutletContext = createContext<unknown>(undefined);

export function Outlet({ context }: { context?: unknown }) {
  if (context === undefined) return <TanstackOutlet />;
  return (
    <OutletContext.Provider value={context}>
      <TanstackOutlet />
    </OutletContext.Provider>
  );
}

export function useOutletContext<T = any>(): T {
  return useContext(OutletContext) as T;
}

/* -------------------------------- hooks ------------------------------- */

export function useLocation() {
  return useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      search: s.location.searchStr,
      hash: s.location.hash ? `#${s.location.hash}` : "",
      state: s.location.state,
    }),
  });
}

export function useNavigationType() {
  return "PUSH";
}

export function useParams<T = Record<string, string>>(): T {
  return (useTanstackParams as unknown as (o: any) => T)({ strict: false });
}

export function useNavigate() {
  const navigate = useTanstackNavigate();
  return useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === "number") {
        if (to < 0) window.history.go(to);
        return;
      }
      navigate({ to, replace: options?.replace } as any);
    },
    [navigate],
  );
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>) => void] {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useTanstackNavigate();

  const params = useMemo(() => new URLSearchParams(searchStr || ""), [searchStr]);

  const setParams = useCallback(
    (next: URLSearchParams | Record<string, string>) => {
      const usp = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const query = usp.toString();
      navigate({ to: `${pathname}${query ? `?${query}` : ""}`, replace: true } as any);
    },
    [navigate, pathname],
  );

  return [params, setParams];
}

/* ------------------------------- Navigate ----------------------------- */

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useTanstackNavigate();
  React.useEffect(() => {
    navigate({ to, replace } as any);
  }, [navigate, to, replace]);
  return null;
}

export function createSearchParams(init?: Record<string, string>) {
  return new URLSearchParams(init);
}
