import { createContext, useContext, type AnchorHTMLAttributes } from "react";

const AppNavigationContext = createContext<((href: string) => void) | null>(null);

export function AppNavigationProvider({
  navigate,
  children,
}: {
  navigate: (href: string) => void;
  children: React.ReactNode;
}) {
  return <AppNavigationContext.Provider value={navigate}>{children}</AppNavigationContext.Provider>;
}

export function useAppNavigate() {
  return useContext(AppNavigationContext);
}

export function AppLink({
  href,
  onClick,
  target,
  download,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useAppNavigate();
  const isInternalSpa =
    Boolean(href) &&
    href!.startsWith("/") &&
    !href!.startsWith("/api/") &&
    !download &&
    (!target || target === "_self");

  return (
    <a
      {...props}
      href={href}
      target={target}
      download={download}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          !isInternalSpa ||
          !navigate ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        navigate(href!);
      }}
    />
  );
}
