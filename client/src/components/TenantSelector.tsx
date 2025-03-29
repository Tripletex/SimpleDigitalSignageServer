import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/TenantSelector.css';

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  role: string;
}

interface TenantSelectorProps {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  onTenantChange: (tenantId: string) => void;
}

const TenantSelector: React.FC<TenantSelectorProps> = ({
  tenants,
  currentTenant,
  onTenantChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleTenantSelect = (tenantId: string) => {
    onTenantChange(tenantId);
    setIsOpen(false);
  };

  return (
    <div className="tenant-selector" ref={dropdownRef}>
      <div className="tenant-selector-header" onClick={toggleDropdown}>
        <div className="current-tenant">
          {currentTenant ? (
            <>
              <span className="tenant-icon">
                {currentTenant.isPersonal ? '👤' : '🏢'}
              </span>
              <span className="tenant-name">{currentTenant.name}</span>
            </>
          ) : (
            <span className="tenant-name">Select Organization</span>
          )}
        </div>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="tenant-dropdown">
          <div className="tenant-dropdown-section">
            <h3>Your Organizations</h3>
            <ul className="tenant-list">
              {tenants.length > 0 ? (
                tenants.map(tenant => (
                  <li 
                    key={tenant.id}
                    className={`tenant-item ${currentTenant?.id === tenant.id ? 'active' : ''}`}
                    onClick={() => handleTenantSelect(tenant.id)}
                  >
                    <span className="tenant-icon">
                      {tenant.isPersonal ? '👤' : '🏢'}
                    </span>
                    <span className="tenant-info">
                      <span className="tenant-name">{tenant.name}</span>
                      {!tenant.isPersonal && (
                        <span className="tenant-role">{tenant.role}</span>
                      )}
                    </span>
                  </li>
                ))
              ) : (
                <li className="tenant-item no-tenants">
                  <span className="tenant-info">
                    <span className="tenant-name">No organizations found</span>
                    <span className="tenant-name-help">Please refresh the page or check your connection</span>
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Organization actions removed as requested */}
        </div>
      )}
    </div>
  );
};

export default TenantSelector;