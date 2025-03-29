import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TenantSelector from './TenantSelector';
import * as tenantService from '../services/tenantService';
import '../styles/Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  handleLogout: () => void;
}

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  role: string; // user's role in this tenant
}

const Layout: React.FC<LayoutProps> = ({ children, user, handleLogout }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  // Initialize from localStorage if available
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => {
    const savedTenant = localStorage.getItem('currentTenant');
    return savedTenant ? JSON.parse(savedTenant) : null;
  });
  
  // Fetch tenants when component mounts or user changes
  useEffect(() => {
    const fetchTenants = async () => {
      if (!user) return;
      
      console.log('User is logged in, fetching tenants...');
      try {
        // First try normal tenant loading
        const userTenants = await tenantService.getUserTenants();
        console.log('Got tenants from API:', userTenants);
        
        if (!userTenants || userTenants.length === 0) {
          console.warn('No tenants returned from API, attempting to force create personal tenant...');
          
          // If no tenants, try to force create a personal tenant
          try {
            const forceResult = await tenantService.forceCreatePersonalTenant();
            console.log('Force create tenant result:', forceResult);
            
            // Try fetching tenants again after force creation
            const newUserTenants = await tenantService.getUserTenants();
            console.log('Got tenants after force create:', newUserTenants);
            
            if (!newUserTenants || newUserTenants.length === 0) {
              console.error('Still no tenants after force create attempt');
              setTenants([]);
              setCurrentTenant(null);
              // Also clear localStorage
              localStorage.removeItem('currentTenant');
              return;
            }
            
            // Process tenants from second attempt
            const formattedTenants = newUserTenants.map(t => ({
              id: t.id,
              name: t.name,
              isPersonal: t.isPersonal,
              role: t.userRole
            }));
            
            console.log('Formatted tenants after force create:', formattedTenants);
            setTenants(formattedTenants);
            
            // Set default tenant
            if (formattedTenants.length > 0) {
              // Prefer personal tenant as default
              const personalTenant = formattedTenants.find(t => t.isPersonal);
              const defaultTenant = personalTenant || formattedTenants[0];
              console.log('Selected default tenant after force create:', defaultTenant);
              setCurrentTenant(defaultTenant);
              
              // Save to localStorage for persistence
              localStorage.setItem('currentTenant', JSON.stringify(defaultTenant));
              
              // Dispatch tenant changed event
              const event = new CustomEvent('tenantChanged', { 
                detail: defaultTenant 
              });
              window.dispatchEvent(event);
            }
            
            return;
          } catch (forceError) {
            console.error('Error force creating tenant:', forceError);
            setTenants([]);
            setCurrentTenant(null);
            // Also clear localStorage
            localStorage.removeItem('currentTenant');
            return;
          }
        }
        
        // Process tenants from first attempt
        const formattedTenants = userTenants.map(t => ({
          id: t.id,
          name: t.name,
          isPersonal: t.isPersonal,
          role: t.userRole
        }));
        console.log('Formatted tenants:', formattedTenants);
        
        setTenants(formattedTenants);
        
        if (formattedTenants.length > 0) {
          // Check if current tenant from localStorage still exists in fetched tenants
          let tenantToUse: Tenant | null = null;
          
          if (currentTenant) {
            const tenantExists = formattedTenants.some(t => t.id === currentTenant.id);
            if (tenantExists) {
              // Use the updated tenant data but keep the same ID
              tenantToUse = formattedTenants.find(t => t.id === currentTenant.id) || null;
              console.log('Using existing tenant from localStorage:', tenantToUse);
            } else {
              console.log('Tenant from localStorage no longer exists, selecting new default');
              // Tenant no longer exists, fall back to default
              tenantToUse = null;
            }
          }
          
          // If we need to select a default tenant
          if (!tenantToUse) {
            console.log('Setting default tenant...');
            // Prefer personal tenant as default
            const personalTenant = formattedTenants.find(t => t.isPersonal);
            tenantToUse = personalTenant || formattedTenants[0];
            console.log('Selected default tenant:', tenantToUse);
          }
          
          // Update current tenant
          setCurrentTenant(tenantToUse);
          
          // Save to localStorage for persistence
          localStorage.setItem('currentTenant', JSON.stringify(tenantToUse));
          
          // Dispatch a custom event for the tenant selection
          try {
            const event = new CustomEvent('tenantChanged', { 
              detail: tenantToUse 
            });
            window.dispatchEvent(event);
          } catch (err) {
            console.error('Error dispatching tenant event:', err);
          }
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      }
    };
    
    fetchTenants();
  }, [user]); // Only depend on user, not currentTenant to avoid infinite loops
  
  const handleTenantChange = (tenantId: string) => {
    const selected = tenants.find(t => t.id === tenantId);
    if (selected) {
      // Save to state
      setCurrentTenant(selected);
      
      // Save to localStorage for persistence across page navigation
      localStorage.setItem('currentTenant', JSON.stringify(selected));
      
      // Dispatch a custom event to notify other components
      try {
        const event = new CustomEvent('tenantChanged', { 
          detail: selected 
        });
        window.dispatchEvent(event);
      } catch (err) {
        console.error('Error dispatching tenant change event:', err);
      }
    }
  };
  
  // Organization creation handled in Organizations page now
  
  return (
    <div className="layout">
      <div className="layout-main">
        <Sidebar 
          user={user} 
          handleLogout={handleLogout} 
          tenants={tenants}
          currentTenant={currentTenant}
          onTenantChange={handleTenantChange}
        />
        <div className="content">
          {/* Pass the current tenant to the child component if needed */}
          {React.Children.map(children, child => {
            // Clone the child element and add the currentTenant prop
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                currentTenant: currentTenant
              });
            }
            return child;
          })}
        </div>
      </div>
    </div>
  );
};

export default Layout;