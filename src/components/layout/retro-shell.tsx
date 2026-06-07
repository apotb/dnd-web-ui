interface RetroShellProps {
  children: React.ReactNode;
}

export function RetroShell({ children }: RetroShellProps) {
  return <div className="retro-shell">{children}</div>;
}
