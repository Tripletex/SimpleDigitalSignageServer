// Define enum locally to avoid importing from outside src directory
export enum TenantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
  userRole: string;
  memberCount?: number;
}

interface TenantMember {
  userId: string;
  email: string;
  displayName?: string;
  role: string;
  status: string;
  joinedAt: string;
}

interface TenantDetail {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
  userRole: string;
  members: TenantMember[];
}

// Get all tenants for the current user
export const getUserTenants = async (): Promise<Tenant[]> => {
  console.log('Fetching user tenants from API...');
  try {
    const response = await fetch('/api/tenants', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tenant API error:', response.status, errorText);
      throw new Error(`Failed to get tenants: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Tenants received:', data.tenants);
    return data.tenants || [];
  } catch (error) {
    console.error('Error fetching tenants:', error);
    throw error;
  }
};

// Force create a personal tenant (for troubleshooting)
export const forceCreatePersonalTenant = async (): Promise<any> => {
  console.log('Force creating personal tenant...');
  try {
    const response = await fetch('/api/tenants/personal/force-create', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Force create tenant error:', response.status, errorText);
      throw new Error(`Failed to force create personal tenant: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Force create tenant response:', data);
    return data;
  } catch (error) {
    console.error('Error force creating personal tenant:', error);
    throw error;
  }
};

// Get details of a specific tenant
export const getTenantDetails = async (tenantId: string): Promise<TenantDetail> => {
  const response = await fetch(`/api/tenants/${tenantId}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`Failed to get tenant details: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Failed to get tenant details');
  }
  return data.tenant;
};

// Create a new tenant
export const createTenant = async (name: string): Promise<Tenant> => {
  const response = await fetch('/api/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to create tenant: ${response.status}`);
  }
  
  const data = await response.json();
  return data.tenant;
};

// Update a tenant
export const updateTenant = async (tenantId: string, name: string): Promise<Tenant> => {
  const response = await fetch(`/api/tenants/${tenantId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to update tenant: ${response.status}`);
  }
  
  const data = await response.json();
  return data.tenant;
};

// Delete a tenant
export const deleteTenant = async (tenantId: string): Promise<void> => {
  const response = await fetch(`/api/tenants/${tenantId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to delete tenant: ${response.status}`);
  }
};

// Invite a user to a tenant
export const inviteUser = async (tenantId: string, email: string, role: TenantRole): Promise<void> => {
  const response = await fetch(`/api/tenants/${tenantId}/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, role }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to invite user: ${response.status}`);
  }
};

// Update a member's role
export const updateMemberRole = async (tenantId: string, userId: string, role: TenantRole): Promise<void> => {
  const response = await fetch(`/api/tenants/${tenantId}/members/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ role }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to update member role: ${response.status}`);
  }
};

// Remove a member from a tenant
export const removeMember = async (tenantId: string, userId: string): Promise<void> => {
  const response = await fetch(`/api/tenants/${tenantId}/members/${userId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to remove member: ${response.status}`);
  }
};

// Leave a tenant
export const leaveTenant = async (tenantId: string): Promise<void> => {
  const response = await fetch(`/api/tenants/${tenantId}/leave`, {
    method: 'POST',
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to leave tenant: ${response.status}`);
  }
};