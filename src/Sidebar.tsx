import { useState, type CSSProperties, type ReactNode } from "react";

type SidebarRenderProps = {
  isOpen: boolean;
  toggle: () => void;
};

type SidebarProps = {
  defaultOpen?: boolean;
  width?: number;
  collapsedVisibleWidth?: number;
  toggleLabel?: string;
  sidebar?: ReactNode | ((props: SidebarRenderProps) => ReactNode);
  children?: ReactNode;
};

const layoutStyle: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
};

const mainContentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

export default function Sidebar({
  defaultOpen = true,
  width = 280,
  collapsedVisibleWidth = 52,
  toggleLabel = "Toggle sidebar",
  sidebar,
  children,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const hiddenWidth = Math.max(width - collapsedVisibleWidth, 0);

  const sidebarStyle: CSSProperties = {
    width,
    flexShrink: 0,
    position: "relative",
    padding: 16,
    overflowX: "hidden",
    overflowY: "auto",
    background: "rgba(255, 255, 255, 0.88)",
    backdropFilter: "blur(12px)",
    borderRight: "1px solid rgba(0, 0, 0, 0.06)",
    transition: "transform 0.35s ease, opacity 0.25s ease",
    transform: isOpen ? "translateX(0)" : `translateX(-${hiddenWidth}px)`,
  };

  const toggleStyle: CSSProperties = {
    all: "unset",
    width: 28,
    height: 28,
    display: "grid",
    placeItems: "center",
    position: "absolute",
    top: 16,
    right: 12,
    zIndex: 1,
    borderRadius: 8,
    cursor: "pointer",
    background: "rgba(0, 0, 0, 0.06)",
    color: "#111",
    fontSize: 18,
    lineHeight: 1,
    transition: "transform 0.25s ease, opacity 0.2s ease",
    opacity: 0.8,
  };

  const innerStyle: CSSProperties = {
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "translateX(0) scale(1)" : "translateX(-8px) scale(0.98)",
    filter: isOpen ? "blur(0)" : "blur(6px)",
    pointerEvents: isOpen ? "auto" : "none",
    transformOrigin: "left center",
    transition: "opacity 0.25s ease, transform 0.25s ease, filter 0.25s ease",
  };

  const renderProps: SidebarRenderProps = {
    isOpen,
    toggle: () => setIsOpen((value) => !value),
  };

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <button
          type="button"
          aria-label={toggleLabel}
          onClick={renderProps.toggle}
          style={toggleStyle}
        >
          {isOpen ? "←" : "→"}
        </button>

        <div style={innerStyle}>
          {typeof sidebar === "function" ? sidebar(renderProps) : sidebar}
        </div>
      </aside>

      <main style={mainContentStyle}>{children}</main>
    </div>
  );
}
