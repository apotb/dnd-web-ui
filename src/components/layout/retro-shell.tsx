interface RetroShellProps {
  children: React.ReactNode;
  wide?: boolean;
}

export function RetroShell({ children, wide = false }: RetroShellProps) {
  return (
    <div className={`retro-shell${wide ? " retro-shell-wide" : ""}`}>
      {children}
    </div>
  );
}
