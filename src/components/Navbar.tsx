import React from 'react';
import { ActiveTab } from '../context/AuthContext';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export type { ActiveTab };
export { Sidebar, TopHeader };

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  cartCount: number;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

/**
 * Navbar component retained for backward compatibility, forwarding to TopHeader and Sidebar layout.
 */
export function Navbar({ activeTab, onTabChange, cartCount, isSidebarCollapsed = false, onToggleSidebar }: NavbarProps) {
  return (
    <>
      <TopHeader onToggleSidebar={onToggleSidebar || (() => {})} />
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar || (() => {})}
        cartCount={cartCount}
      />
    </>
  );
}
