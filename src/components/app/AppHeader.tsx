import { Link } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { ThemeToggle } from "./theme";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <MessagesSquare className="h-4 w-4" />
      </span>
      TalktoPoint
    </Link>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 text-sm sm:flex">
          <Link
            to="/dashboard"
            className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "bg-muted text-foreground" }}
          >
            Dashboard
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
