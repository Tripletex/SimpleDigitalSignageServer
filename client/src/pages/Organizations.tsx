import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import * as tenantService from '../services/tenantService';
import { csrfFetch } from '../utils/csrfFetch';
import '../styles/Organizations.css';

// Define enums locally to avoid importing from outside src directory
enum TenantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

enum TenantMemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending'
}

interface OrganizationsProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
}

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  role: string;
  members?: Member[];
  createdAt: Date;
}

interface Member {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  status: TenantMemberStatus.ACTIVE | TenantMemberStatus.PENDING;
}

const Organizations: React.FC<OrganizationsProps> = ({ user, setIsAuthenticated, setUser }) => {
  // State for tenant data
  const [organizations, setOrganizations] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedOrgId, setSelectedOrgId] = useState<string>('personal');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);
  
  // Fetch tenant data on load
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true);
        console.log("Fetching tenant data for user:", user);
        const tenants = await tenantService.getUserTenants();
        console.log("Received tenants from API:", tenants);
        
        if (tenants.length === 0) {
          console.warn("No tenants returned by the API for user:", user?.id);
        }
        
        // Get detailed information for each tenant
        const tenantsWithDetails = await Promise.all(
          tenants.map(async (tenant) => {
            try {
              console.log(`Fetching details for tenant ${tenant.id}`);
              const details = await tenantService.getTenantDetails(tenant.id);
              console.log(`Received details for tenant ${tenant.id}:`, details);
              return {
                id: details.id,
                name: details.name,
                isPersonal: details.isPersonal,
                role: details.userRole,
                createdAt: new Date(details.createdAt),
                members: details.members.map(m => ({
                  id: m.userId,
                  email: m.email,
                  displayName: m.displayName,
                  role: m.role,
                  status: m.status as TenantMemberStatus.ACTIVE | TenantMemberStatus.PENDING
                }))
              };
            } catch (err) {
              console.error(`Error fetching details for tenant ${tenant.id}:`, err);
              // Return basic tenant without members as fallback
              return {
                id: tenant.id,
                name: tenant.name,
                isPersonal: tenant.isPersonal,
                role: tenant.userRole,
                createdAt: new Date(tenant.createdAt),
                members: []
              };
            }
          })
        );
        
        console.log("Processed tenants with details:", tenantsWithDetails);
        setOrganizations(tenantsWithDetails);
        
        // Set the first org as selected if needed
        if (tenantsWithDetails.length > 0 && !selectedOrgId) {
          console.log("Setting first tenant as selected:", tenantsWithDetails[0].id);
          setSelectedOrgId(tenantsWithDetails[0].id);
        } else if (tenantsWithDetails.length === 0) {
          console.warn("No tenants available to select");
        }
        
        setError(null);
      } catch (err) {
        setError(`Error fetching tenants: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching tenants:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTenants();
  }, [selectedOrgId]);

  const handleLogout = async () => {
    try {
      const response = await csrfFetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setIsAuthenticated(false);
        setUser(null);
        navigate('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      setError('Please enter a valid organization name');
      return;
    }

    try {
      // Create the tenant
      const newTenant = await tenantService.createTenant(newOrgName);
      
      // Refetch the tenant list to get the updated data
      const tenants = await tenantService.getUserTenants();
      
      // Get details of the new tenant
      const details = await tenantService.getTenantDetails(newTenant.id);
      
      const newOrg: Tenant = {
        id: details.id,
        name: details.name,
        isPersonal: details.isPersonal,
        role: details.userRole,
        createdAt: new Date(details.createdAt),
        members: details.members.map(m => ({
          id: m.userId,
          email: m.email,
          displayName: m.displayName,
          role: m.role,
          status: m.status as TenantMemberStatus.ACTIVE | TenantMemberStatus.PENDING
        }))
      };

      setOrganizations([...organizations, newOrg]);
      setSelectedOrgId(newOrg.id);
      setNewOrgName('');
      setShowCreateOrgForm(false);
      setSuccess(`Organization "${newOrgName}" created successfully`);

      // Clear success message after a delay
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(`Failed to create organization: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error creating organization:', err);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      if (!selectedOrg) {
        throw new Error('No organization selected');
      }

      // Call the API to invite the user
      await tenantService.inviteUser(
        selectedOrgId, 
        inviteEmail, 
        inviteRole === 'admin' ? TenantRole.ADMIN : TenantRole.MEMBER
      );
      
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setError(null);
      
      // Refresh the tenant data to show the new member
      const details = await tenantService.getTenantDetails(selectedOrgId);
      
      const updatedOrgs = organizations.map(org => {
        if (org.id === selectedOrgId) {
          return {
            ...org,
            members: details.members.map(m => ({
              id: m.userId,
              email: m.email,
              displayName: m.displayName,
              role: m.role,
              status: m.status as TenantMemberStatus.ACTIVE | TenantMemberStatus.PENDING
            }))
          };
        }
        return org;
      });
      
      setOrganizations(updatedOrgs);
      setInviteEmail('');
      setShowInviteForm(false);
      
      // Clear success message after a delay
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(`Failed to invite user: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error inviting user:', err);
    }
  };

  const handleMemberAction = async (memberId: string, action: 'remove' | 'promote' | 'demote') => {
    try {
      if (!selectedOrg) {
        throw new Error('No organization selected');
      }
      
      if (action === 'remove') {
        // Call API to remove member
        await tenantService.removeMember(selectedOrgId, memberId);
      } else if (action === 'promote') {
        // Call API to promote member to admin
        await tenantService.updateMemberRole(selectedOrgId, memberId, TenantRole.ADMIN);
      } else if (action === 'demote') {
        // Call API to demote admin to member
        await tenantService.updateMemberRole(selectedOrgId, memberId, TenantRole.MEMBER);
      }
      
      // Refresh tenant data
      const details = await tenantService.getTenantDetails(selectedOrgId);
      
      const updatedOrgs = organizations.map(org => {
        if (org.id === selectedOrgId) {
          return {
            ...org,
            members: details.members.map(m => ({
              id: m.userId,
              email: m.email,
              displayName: m.displayName,
              role: m.role,
              status: m.status as TenantMemberStatus.ACTIVE | TenantMemberStatus.PENDING
            }))
          };
        }
        return org;
      });
      
      setOrganizations(updatedOrgs);
      setSuccess(`Member ${action === 'remove' ? 'removed' : action === 'promote' ? 'promoted' : 'demoted'} successfully`);
      
      // Clear success message after a delay
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(`Failed to ${action} member: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`Error ${action}ing member:`, err);
    }
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="organizations-container">
        <h1>Organization Management</h1>
        
        <div className="organizations-content">
          <div className="organizations-sidebar">
            <h2>Your Organizations</h2>
            <ul className="organization-list">
              {organizations.map(org => (
                <li 
                  key={org.id}
                  className={`organization-item ${selectedOrgId === org.id ? 'active' : ''}`}
                  onClick={() => setSelectedOrgId(org.id)}
                >
                  <span className="org-icon">
                    {org.isPersonal ? '👤' : '🏢'}
                  </span>
                  <div className="org-info">
                    <span className="org-name">{org.name}</span>
                    <span className="org-role">{org.role}</span>
                  </div>
                </li>
              ))}
            </ul>
            
            <button 
              className="new-organization-btn"
              onClick={() => setShowCreateOrgForm(true)}
            >
              Create New Organization
            </button>
          </div>
          
          <div className="organization-details">
            {selectedOrg && (
              <>
                <div className="organization-header">
                  <div className="organization-title">
                    <h2>{selectedOrg.name}</h2>
                    <span className="organization-type">
                      {selectedOrg.isPersonal ? 'Personal Workspace' : 'Team Organization'}
                    </span>
                  </div>
                  
                  {!selectedOrg.isPersonal && selectedOrg.role === 'owner' && (
                    <button 
                      className="delete-organization-btn"
                      onClick={() => {
                        // In a real app, this would be an API call with confirmation
                        const updatedOrgs = organizations.filter(org => org.id !== selectedOrgId);
                        setOrganizations(updatedOrgs);
                        setSelectedOrgId('personal');
                      }}
                    >
                      Delete Organization
                    </button>
                  )}
                </div>
                
                {success && (
                  <div className="success-message">{success}</div>
                )}
                
                {error && (
                  <div className="error-message">{error}</div>
                )}
                
                <div className="organization-section">
                  <div className="section-header">
                    <h3>Members</h3>
                    {!selectedOrg.isPersonal && (selectedOrg.role === 'owner' || selectedOrg.role === 'admin') && (
                      <button 
                        className="invite-btn"
                        onClick={() => setShowInviteForm(!showInviteForm)}
                      >
                        {showInviteForm ? 'Cancel' : 'Invite Member'}
                      </button>
                    )}
                  </div>
                  
                  {showInviteForm && (
                    <div className="invite-form">
                      <div className="invite-form-group">
                        <label htmlFor="inviteEmail">Email Address</label>
                        <input 
                          type="email"
                          id="inviteEmail"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@example.com"
                        />
                      </div>
                      
                      <div className="invite-form-group">
                        <label htmlFor="inviteRole">Role</label>
                        <select 
                          id="inviteRole"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      
                      <button 
                        className="send-invite-btn"
                        onClick={handleInviteUser}
                      >
                        Send Invitation
                      </button>
                    </div>
                  )}
                  
                  <table className="members-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        {(selectedOrg.role === 'owner' || selectedOrg.role === 'admin') && (
                          <th>Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrg.members?.map(member => (
                        <tr key={member.id}>
                          <td className="member-info">
                            <div className="member-name">
                              {member.displayName || member.email}
                            </div>
                            <div className="member-email">
                              {member.email}
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${member.role}`}>
                              {member.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${member.status}`}>
                              {member.status}
                            </span>
                          </td>
                          {(selectedOrg.role === 'owner' || selectedOrg.role === 'admin') && (
                            <td className="member-actions">
                              {/* Don't allow removing yourself if you're the owner */}
                              {!(member.id === user?.id && member.role === 'owner') && (
                                <button 
                                  className="member-action remove"
                                  onClick={() => handleMemberAction(member.id, 'remove')}
                                >
                                  Remove
                                </button>
                              )}
                              
                              {/* Only the owner can promote/demote, and you can't promote yourself */}
                              {selectedOrg.role === 'owner' && member.id !== user?.id && (
                                <>
                                  {member.role === 'member' && (
                                    <button 
                                      className="member-action promote"
                                      onClick={() => handleMemberAction(member.id, 'promote')}
                                    >
                                      Make Admin
                                    </button>
                                  )}
                                  
                                  {member.role === 'admin' && (
                                    <button 
                                      className="member-action demote"
                                      onClick={() => handleMemberAction(member.id, 'demote')}
                                    >
                                      Remove Admin
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Create Organization Modal */}
        {showCreateOrgForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Create New Organization</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowCreateOrgForm(false);
                    setNewOrgName('');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>Enter a name for your new organization:</p>
                <input
                  type="text"
                  className="tenant-name-input"
                  placeholder="Organization Name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                {error && (
                  <p className="error-message">{error}</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateOrgForm(false);
                    setNewOrgName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="create-button"
                  onClick={handleCreateOrganization}
                  disabled={!newOrgName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Organizations;