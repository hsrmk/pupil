import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../Button";
import { EyeLogo } from "../brand";
import { PlusIcon } from "../icons/PlusIcon";
import { SearchIcon } from "../icons/SearchIcon";
import styles from "./AppTitlebar.module.css";
import cardsIcon from "./symbols/book.pages.png";
import dashboardIcon from "./symbols/building.columns.png";
import settingsIcon from "./symbols/gear.png";
import importIcon from "./symbols/pencil.tip.crop.circle.badge.plus.png";

export type AppTabId = "dashboard" | "cards" | "import" | "settings";

export type AppTab = {
  id: AppTabId;
  label: string;
};

const tabIcons: Record<AppTabId, string> = {
  dashboard: dashboardIcon,
  cards: cardsIcon,
  import: importIcon,
  settings: settingsIcon,
};

type AppTitlebarProps = {
  activeTab: AppTabId;
  globalStreak?: number | null;
  mobileNavigationOnly?: boolean;
  onInstallUpdate?: () => void;
  onOpenCreateDialog: () => void;
  onOpenNewCard?: () => void;
  onOpenPalette: () => void;
  onSelectTab: (tabId: AppTabId) => void;
  tabs: AppTab[];
  updateActionLabel?: string | null;
  updateBusy?: boolean;
};

export function AppTitlebar({
  activeTab,
  globalStreak,
  mobileNavigationOnly = false,
  onInstallUpdate,
  onOpenCreateDialog,
  onOpenNewCard,
  onOpenPalette,
  onSelectTab,
  tabs,
  updateActionLabel,
  updateBusy = false,
}: AppTitlebarProps) {
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const createActionsRef = useRef<HTMLDivElement | null>(null);
  const createToggleRef = useRef<HTMLButtonElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const focusCreateActionRef = useRef(false);
  const createPanelId = useId();
  const tabRefs = useRef<Partial<Record<AppTabId, HTMLButtonElement>>>({});
  const [activeIndicatorStyle, setActiveIndicatorStyle] = useState<CSSProperties | null>(null);
  const [createExpanded, setCreateExpanded] = useState(false);

  useEffect(() => {
    if (!createExpanded) return;
    if (focusCreateActionRef.current) {
      createPanelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    function dismissOnOutside(event: PointerEvent) {
      if (!createActionsRef.current?.contains(event.target as Node)) setCreateExpanded(false);
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreateExpanded(false);
        createToggleRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOnOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [createExpanded]);

  useLayoutEffect(() => {
    const tabsElement = tabsRef.current;
    const activeTabElement = tabRefs.current[activeTab];

    if (!tabsElement || !activeTabElement) {
      return;
    }

    function updateActiveIndicator() {
      if (!tabsElement || !activeTabElement) {
        return;
      }

      const tabsRect = tabsElement.getBoundingClientRect();
      const activeRect = activeTabElement.getBoundingClientRect();

      setActiveIndicatorStyle({
        height: activeRect.height,
        transform: `translate(${activeRect.left - tabsRect.left}px, ${activeRect.top - tabsRect.top}px)`,
        width: activeRect.width,
      });
    }

    updateActiveIndicator();
    const frame = window.requestAnimationFrame(updateActiveIndicator);
    const resizeObserver = new ResizeObserver(updateActiveIndicator);
    resizeObserver.observe(tabsElement);
    resizeObserver.observe(activeTabElement);
    window.addEventListener("resize", updateActiveIndicator);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateActiveIndicator);
    };
  }, [activeTab]);

  return (
    <div
      className={`${styles.titlebar}${mobileNavigationOnly ? ` ${styles.mobileNavigationOnly}` : ""}`}
      data-window-drag
    >
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <div className={styles.titlebarTabs} ref={tabsRef}>
          {activeIndicatorStyle ? (
            <span className={styles.titlebarTabIndicator} style={activeIndicatorStyle} />
          ) : null}
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              aria-label={tab.label}
              data-tab={tab.id}
              className={`${styles.titlebarTab}${activeTab === tab.id ? ` ${styles.active}` : ""}`}
              key={tab.id}
              onClick={() => {
                setCreateExpanded(false);
                onSelectTab(tab.id);
              }}
              ref={(element) => {
                if (element) {
                  tabRefs.current[tab.id] = element;
                } else {
                  delete tabRefs.current[tab.id];
                }
              }}
              type="button"
            >
              <span
                aria-hidden="true"
                className={styles.mobileTabIcon}
                style={{
                  maskImage: `url(${tabIcons[tab.id]})`,
                  WebkitMaskImage: `url(${tabIcons[tab.id]})`,
                }}
              />
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.titlebarRight}>
        {updateActionLabel && onInstallUpdate ? (
          <Button disabled={updateBusy} onClick={onInstallUpdate} size="compact" variant="ghost">
            {updateActionLabel}
          </Button>
        ) : null}
        {globalStreak !== undefined && globalStreak !== null ? (
          <div
            className={`${styles.titlebarStatus}${activeTab !== "dashboard" ? ` ${styles.mobileOnlyStatus}` : ""}`}
          >
            <span className="streak-dot" />
            {globalStreak > 0 ? `${globalStreak} day streak` : "No streak yet"}
          </div>
        ) : null}
        <div className={styles.createActions} ref={createActionsRef}>
          <button
            aria-controls={createPanelId}
            aria-expanded={createExpanded}
            aria-hidden={createExpanded || undefined}
            aria-label={createExpanded ? "Close create menu" : "Create"}
            className={`${styles.mobileCreateToggle}${createExpanded ? ` ${styles.toggleExpanded}` : ""}`}
            onClick={(event) => {
              focusCreateActionRef.current = event.detail === 0;
              setCreateExpanded((expanded) => !expanded);
            }}
            ref={createToggleRef}
            tabIndex={createExpanded ? -1 : undefined}
            type="button"
          >
            <PlusIcon />
          </button>
          <div
            className={`${styles.createActionPanel}${createExpanded ? ` ${styles.expanded}` : ""}`}
            id={createPanelId}
            ref={createPanelRef}
          >
            {onOpenNewCard ? (
              <Button
                onClick={() => {
                  setCreateExpanded(false);
                  onOpenNewCard();
                }}
                size="compact"
                variant="outline"
              >
                <PlusIcon />
                New Card
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setCreateExpanded(false);
                onOpenCreateDialog();
              }}
              size="compact"
              variant="outline"
            >
              <PlusIcon />
              New Space
            </Button>
          </div>
        </div>
        <Button aria-label="Search" onClick={onOpenPalette} size="iconCompact" variant="outline">
          <SearchIcon />
        </Button>
      </div>
    </div>
  );
}
