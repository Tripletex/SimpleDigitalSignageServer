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
  userRole: string;
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
  const [showRenameOrgModal, setShowRenameOrgModal] = useState(false);
  const [showDeleteOrgModal, setShowDeleteOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [renameOrgName, setRenameOrgName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
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
                userRole: details.userRole,
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
                userRole: tenant.userRole,
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
        setError(`Error fetching organizations: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching organizations:', err);
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
        userRole: details.userRole,
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

  const handleRenameOrganization = async () => {
    if (!selectedOrg || !renameOrgName.trim()) return;

    try {
      await tenantService.updateTenant(selectedOrg.id, renameOrgName.trim());
      setOrganizations(organizations.map(org =>
        org.id === selectedOrg.id ? { ...org, name: renameOrgName.trim() } : org
      ));
      setShowRenameOrgModal(false);
      setRenameOrgName('');
      setSuccess(`Organization renamed to "${renameOrgName.trim()}"`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to rename organization: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrg || deleteConfirmName !== selectedOrg.name) return;

    try {
      await tenantService.deleteTenant(selectedOrg.id);
      const updatedOrgs = organizations.filter(org => org.id !== selectedOrg.id);
      setOrganizations(updatedOrgs);
      setSelectedOrgId(updatedOrgs.length > 0 ? updatedOrgs[0].id : '');
      setShowDeleteOrgModal(false);
      setDeleteConfirmName('');
      setSuccess('Organization deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to delete organization: ${err instanceof Error ? err.message : String(err)}`);
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
                    <span className="org-role">{org.userRole}</span>
                  </div>
                </li>
              ))}
            </ul>
            
            <button 
              className="btn btn-primary"
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
                  
                  {!selectedOrg.isPersonal && selectedOrg.userRole === 'owner' && (
                    <div className="organization-header-actions">
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => {
                          setRenameOrgName(selectedOrg.name);
                          setShowRenameOrgModal(true);
                        }}
                        title="Rename organization"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setDeleteConfirmName('');
                          setShowDeleteOrgModal(true);
                        }}
                        title="Delete organization"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
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
                    {!selectedOrg.isPersonal && (selectedOrg.userRole === 'owner' || selectedOrg.userRole === 'admin') && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setInviteEmail('');
                          setInviteRole('member');
                          setShowInviteForm(true);
                        }}
                      >
                        Invite Member
                      </button>
                    )}
                  </div>
                  
                  <table className="members-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        {(selectedOrg.userRole === 'owner' || selectedOrg.userRole === 'admin') && (
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
                          {(selectedOrg.userRole === 'owner' || selectedOrg.userRole === 'admin') && (
                            <td className="member-actions">
                              {/* Remove button: can't remove yourself, admins can't remove owners */}
                              {member.id !== user?.id &&
                               !(selectedOrg.userRole === 'admin' && member.role === 'owner') && (
                                <button
                                  className="member-action remove"
                                  onClick={() => handleMemberAction(member.id, 'remove')}
                                >
                                  Remove
                                </button>
                              )}

                              {/* Role management: owners can change any role, admins can promote/demote non-owners */}
                              {member.id !== user?.id &&
                               !(selectedOrg.userRole === 'admin' && member.role === 'owner') && (
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
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowCreateOrgForm(false);
                    setNewOrgName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleCreateOrganization}
                  disabled={!newOrgName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Rename Organization Modal */}
        {showRenameOrgModal && selectedOrg && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Rename Organization</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowRenameOrgModal(false);
                    setRenameOrgName('');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="rename-org">Organization Name</label>
                  <input
                    type="text"
                    id="rename-org"
                    className="form-input"
                    value={renameOrgName}
                    onChange={(e) => setRenameOrgName(e.target.value)}
                  />
                </div>
                {error && <p className="error-message">{error}</p>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowRenameOrgModal(false);
                    setRenameOrgName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleRenameOrganization}
                  disabled={!renameOrgName.trim() || renameOrgName.trim() === selectedOrg.name}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Organization Modal */}
        {showDeleteOrgModal && selectedOrg && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Delete Organization</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowDeleteOrgModal(false);
                    setDeleteConfirmName('');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '15px' }}>
                  This will permanently delete <strong>{selectedOrg.name}</strong> and all its data including playlists, campaigns, devices, and schedules. The organization must have no other members before it can be deleted.
                </p>
                <div className="form-group">
                  <label htmlFor="delete-confirm">
                    Type <strong>{selectedOrg.name}</strong> to confirm
                  </label>
                  <input
                    type="text"
                    id="delete-confirm"
                    className="form-input"
                    placeholder={selectedOrg.name}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
                {error && <p className="error-message">{error}</p>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowDeleteOrgModal(false);
                    setDeleteConfirmName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteOrganization}
                  disabled={deleteConfirmName !== selectedOrg.name}
                >
                  Delete Organization
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Member Modal */}
        {showInviteForm && selectedOrg && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Invite Member</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                    setInviteRole('member');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>Invite a new member to <strong>{selectedOrg.name}</strong>.</p>
                <div className="form-group">
                  <label htmlFor="inviteEmail">Email Address</label>
                  <input
                    type="email"
                    id="inviteEmail"
                    className="form-input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="inviteRole">Role</label>
                  <select
                    id="inviteRole"
                    className="form-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    {selectedOrg.userRole === 'owner' && (
                      <option value="owner">Owner</option>
                    )}
                  </select>
                </div>
                {error && <p className="error-message">{error}</p>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                    setInviteRole('member');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleInviteUser}
                  disabled={!inviteEmail.trim()}
                >
                  Send Invitation
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