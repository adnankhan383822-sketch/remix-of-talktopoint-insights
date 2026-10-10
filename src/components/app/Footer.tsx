import { Link } from "@tanstack/react-router";
import { Heart, MessagesSquare } from "lucide-react";

const TEAM = ["Adnan Ali", "Ayaz Ahmad", "Waqar Ahmad"];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="no-print border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-sm font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
            <MessagesSquare className="h-3.5 w-3.5" />
          </span>
          TalktoPoint
        </Link>

        <p className="text-sm text-muted-foreground">
          Made by <span className="font-semibold text-foreground">Muhammad Abubakkar</span> and his team
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {TEAM.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-xs font-medium shadow-card transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {initials(name)}
              </span>
              {name}
            </span>
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Heart className="h-3 w-3 fill-current text-destructive" />
          <span>© {year} TalktoPoint</span>
        </p>
      </div>
    </footer>
  );
}
