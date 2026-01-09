"use client";

import { usePathname } from "next/navigation";
import { useState, useCallback, useMemo } from "react";
import SideNavigation from "@cloudscape-design/components/side-navigation";

type NavItem =
  | { type: "link"; text: string; href: string; active?: boolean; disabled?: boolean; info?: string }
  | { type: "divider" }
  | {
      type: "expandable-link-group";
      text: string;
      href: string;
      items: NavItem[];
      expanded?: boolean;
      active?: boolean;
    };

// Navigation section IDs for state management
type NavSection = "sessions" | "workflows" | "settings";

// Helper function to check if a path matches a route pattern
function isPathActive(pattern: string, pathname: string): boolean {
  // Exact match
  if (pattern === pathname) return true;
  // Wildcard match for /* patterns
  if (pattern.endsWith("/*") && pathname.startsWith(pattern.slice(0, -2))) return true;
  // Prefix match for nested routes (e.g., /sessions matches /sessions/foo)
  if (pattern !== "/" && pathname.startsWith(pattern + "/")) return true;
  return false;
}

export function SideNav() {
  const pathname = usePathname();

  // Track expanded state for each section - initialize with sessions expanded
  const [expandedItems, setExpandedItems] = useState<Set<NavSection>>(() => new Set<NavSection>(["sessions"]));

  const toggleExpanded = useCallback((sectionId: NavSection) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Determine active states for all navigation items
  const activeStates = useMemo(() => {
    return {
      isHome: pathname === "/",
      isSessionsList: pathname === "/sessions",
      isSessionsActive: isPathActive("/sessions", pathname),
      isSessionDetail: /^\/sessions\/[^/]+$/.test(pathname),
      isSessionChain: /^\/sessions\/[^/]+\/workflow/.test(pathname),
      isTerminalsActive: isPathActive("/terminals", pathname),
      isWorkflowsActive: isPathActive("/workflows", pathname),
      isWorkflowEditor: /^\/workflows\/[^/]+$/.test(pathname),
      isSettingsMain: pathname === "/settings",
      isSettingsActive: isPathActive("/settings", pathname),
      isAgentsPage: pathname === "/settings/agents",
    };
  }, [pathname]);

  // Build navigation items with hierarchy
  const buildNavItems = (): NavItem[] => {
    const {
      isHome,
      isSessionsList,
      isSessionsActive,
      isSessionDetail,
      isSessionChain,
      isTerminalsActive,
      isWorkflowsActive,
      isWorkflowEditor,
      isSettingsMain,
      isSettingsActive,
      isAgentsPage,
    } = activeStates;

    const sessionsExpanded = expandedItems.has("sessions") || isSessionsActive || isTerminalsActive;
    const workflowsExpanded = expandedItems.has("workflows") || isWorkflowsActive;
    const settingsExpanded = expandedItems.has("settings") || isSettingsActive;

    return [
      {
        type: "link",
        text: "Dashboard",
        href: "/",
        active: isHome,
      },
      {
        type: "divider",
      },
      {
        type: "expandable-link-group",
        text: "Sessions",
        href: "/sessions",
        items: [
          {
            type: "link",
            text: "Session List",
            href: "/sessions",
            active: isSessionsList,
          },
          {
            type: "link",
            text: "Terminals",
            href: "/sessions",
            active: isTerminalsActive,
            disabled: true,
            info: "Available within session details",
          },
        ],
        expanded: sessionsExpanded,
        active: isSessionsActive || isSessionsList || isSessionDetail || isSessionChain,
      },
      {
        type: "expandable-link-group",
        text: "Workflows",
        href: "/workflows",
        items: [
          {
            type: "link",
            text: "All Workflows",
            href: "/workflows",
            active: isWorkflowsActive && !isWorkflowEditor,
          },
          {
            type: "link",
            text: "Create New",
            href: "/workflows/new",
            active: false,
          },
        ],
        expanded: workflowsExpanded,
        active: isWorkflowsActive || isWorkflowEditor,
      },
      {
        type: "divider",
      },
      {
        type: "expandable-link-group",
        text: "Settings",
        href: "/settings",
        items: [
          {
            type: "link",
            text: "Agents",
            href: "/settings/agents",
            active: isAgentsPage,
          },
          {
            type: "link",
            text: "Configuration",
            href: "/settings",
            active: isSettingsMain,
          },
        ],
        expanded: settingsExpanded,
        active: isSettingsActive,
      },
    ] as const;
  };

  const items = buildNavItems();

  return (
    <SideNavigation
      items={items}
      onChange={(event) => {
        // Handle expand/collapse for expandable-link-group
        if (event.detail.item.type === "expandable-link-group") {
          const sectionId = event.detail.item.text.toLowerCase() as NavSection;
          toggleExpanded(sectionId);
        }
      }}
    />
  );
}
