import type { RouteType } from "@shared/types";

type RouteHandler = (route: RouteType, url: URL) => void;

let currentRoute: RouteType = "other";
let handler: RouteHandler | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function classifyUrl(url: URL): RouteType {
  const { pathname } = url;
  if (pathname === "/" || pathname === "/feed/trending") return "home";
  if (pathname === "/feed/subscriptions") return "subs";
  if (pathname === "/watch") return "watch";
  if (pathname.startsWith("/shorts/")) return "shorts";
  return "other";
}

function dispatch(url: URL) {
  const route = classifyUrl(url);
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    currentRoute = route;
    handler?.(route, url);
  }, 50);
}

function handleNavigation() {
  dispatch(new URL(window.location.href));
}

let observerAttached = false;
let titleObserver: MutationObserver | null = null;

export function initRouter(onRoute: RouteHandler): void {
  handler = onRoute;

  if (observerAttached) return;
  observerAttached = true;

  // Primary: YouTube fires this on every internal nav
  document.addEventListener("yt-navigate-finish", handleNavigation);

  // Fallback 1: standard history API navigation
  window.addEventListener("popstate", handleNavigation);

  // Fallback 2: watch the <title> element change as a last resort
  const titleEl = document.querySelector("title");
  if (titleEl) {
    titleObserver = new MutationObserver(handleNavigation);
    titleObserver.observe(titleEl, { childList: true });
  }

  // Run once immediately for the initial page load
  handleNavigation();
}

export function currentRouteType(): RouteType {
  return currentRoute;
}

export function teardownRouter(): void {
  document.removeEventListener("yt-navigate-finish", handleNavigation);
  window.removeEventListener("popstate", handleNavigation);
  titleObserver?.disconnect();
  titleObserver = null;
  observerAttached = false;
  handler = null;
}
