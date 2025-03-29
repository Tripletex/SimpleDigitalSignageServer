import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';
import TenantSelector from './TenantSelector';

// Define menu item interface
interface MenuItem {
  name: string;
  path: string;
  icon: string; // We'll use emoji for simplicity
}

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  role: string;
}

interface SidebarProps {
  user: any;
  handleLogout: () => void;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  onTenantChange: (tenantId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  user, 
  handleLogout, 
  tenants, 
  currentTenant, 
  onTenantChange 
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Define the menu items
  const menuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Devices', path: '/devices', icon: '📱' },
    { name: 'Playlists', path: '/playlists', icon: '🎞️' },
    { name: 'Campaigns', path: '/campaigns', icon: '📋' },
    { name: 'Organizations', path: '/organizations', icon: '🏢' },
    { name: 'Profile', path: '/profile', icon: '👤' }
  ];

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          {collapsed ? 'DS' : 'Digital Signage'}
        </h2>
        <button className="toggle-btn" onClick={toggleSidebar}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Tenant selector below the Digital Signage title */}
      <div className="sidebar-tenant-selector">
        {!collapsed ? (
          <TenantSelector 
            tenants={tenants}
            currentTenant={currentTenant}
            onTenantChange={onTenantChange}
          />
        ) : (
          currentTenant && (
            <div className="collapsed-tenant">
              <span className="tenant-icon">
                {currentTenant.isPersonal ? '👤' : '🏢'}
              </span>
            </div>
          )
        )}
      </div>

      <div className="sidebar-menu">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="menu-icon">{item.icon}</span>
            {!collapsed && <span className="menu-text">{item.name}</span>}
          </Link>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <span className="logout-icon">🚪</span>
          {!collapsed && <span className="logout-text">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;