import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, Sun } from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes } from "react-router";
import type { User } from "./api.ts";
import { signOut as endSession } from "./auth.ts";
import { Button } from "./components/ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./components/ui/dropdown-menu.tsx";
import { Skeleton } from "./components/ui/skeleton.tsx";
import { useMe } from "./hooks.ts";
import { Dashboard } from "./pages/Dashboard.tsx";
import { setThemePreference, useTheme } from "./theme.ts";

// The dashboard is where the app opens, so it ships with it. The other pages load on first visit: someone signed in
// never needs the sign-in screens, and the profile page waits until it's opened.
const authPages = () => import("./pages/Auth.tsx");
const profilePage = () => import("./pages/Profile.tsx");
const Login = lazy(() => authPages().then((m) => ({ default: m.Login })));
const Signup = lazy(() => authPages().then((m) => ({ default: m.Signup })));
const SetupProfile = lazy(() => authPages().then((m) => ({ default: m.SetupProfile })));
const Profile = lazy(() => profilePage().then((m) => ({ default: m.Profile })));

// Opening a sign-in screen directly: download it alongside the session check instead of after it.
if (location.pathname === "/login" || location.pathname === "/signup") void authPages().catch(() => {});

export function App() {
  const me = useMe();

  // Until the account arrives, the outline painted from index.html (#boot-shell) stays on screen; it goes in the
  // same frame the app's first real screen is committed, so nothing flashes in between.
  const settled = !me.isPending;
  useLayoutEffect(() => {
    if (settled) document.getElementById("boot-shell")?.remove();
  }, [settled]);

  if (me.isPending) return null;
  if (me.isError) return <p className="py-24 text-center text-sm text-destructive">Couldn't reach the server. Is it running?</p>;
  if (me.data && !me.data.user)
    return (
      <Suspense fallback={null}>
        <SetupProfile account={me.data.account} />
      </Suspense>
    );
  const user = me.data?.user;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Suspense fallback={null}><Login /></Suspense>} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Suspense fallback={null}><Signup /></Suspense>} />
      <Route element={user ? <Layout user={user} /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** The check sign in miniature: the app's mark in the header and on the sign-in screens. */
export function SignMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-lg bg-sign p-[3px] ${className}`}>
      <span className="grid size-full place-items-center rounded-[5px] border-[1.5px] border-white/90 font-display text-[0.8rem] leading-none font-semibold text-white">$</span>
    </span>
  );
}

function Layout({ user }: { user: User }) {
  // Fetch the profile page once the dashboard has settled, so opening it later doesn't wait on the download.
  useEffect(() => {
    const timer = setTimeout(() => void profilePage().catch(() => {}), 2000);
    return () => clearTimeout(timer);
  }, []);

  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors pointer-fine:h-9 ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2 sm:px-6">
          <Link to="/" className="mr-2 flex items-center gap-2.5 rounded-md sm:mr-4" aria-label="Commission Tracker, dashboard">
            <SignMark />
            <span className="hidden font-semibold sm:inline">Commission Tracker</span>
          </Link>
          <nav className="flex gap-1">
            <NavLink to="/" end className={tab}>
              Dashboard
            </NavLink>
            <NavLink to="/profile" className={tab}>
              Profile
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 pt-5 pb-16 sm:px-6 sm:pt-8">
        {/* A page still downloading (Profile) fills only this area, so the header stays put. */}
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

/** Flips between light and dark. Going back to following the OS is on the Profile page. */
function ThemeToggle() {
  const { theme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setThemePreference(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

function UserMenu({ user }: { user: User }) {
  const qc = useQueryClient();
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  async function signOut() {
    await endSession();
    // Null the account first, then drop the rest. clear() would also remove ["me"] and detach useMe from it, so the null never rendered.
    qc.setQueryData(["me"], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Account: ${user.name}`}>
          <span className="grid size-8 place-items-center rounded-full bg-positive-soft text-xs font-semibold text-positive">{initials || "?"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
