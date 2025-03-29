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
  
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  
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
        
        // Set default tenant if none is selected
        if (formattedTenants.length > 0 && !currentTenant) {
          console.log('Setting default tenant...');
          // Prefer personal tenant as default
          const personalTenant = formattedTenants.find(t => t.isPersonal);
          const defaultTenant = personalTenant || formattedTenants[0];
          console.log('Selected default tenant:', defaultTenant);
          setCurrentTenant(defaultTenant);
          
          // Dispatch a custom event for the initial tenant selection
          try {
            const event = new CustomEvent('tenantChanged', { 
              detail: defaultTenant 
            });
            window.dispatchEvent(event);
          } catch (err) {
            console.error('Error dispatching initial tenant event:', err);
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
      setCurrentTenant(selected);
      
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