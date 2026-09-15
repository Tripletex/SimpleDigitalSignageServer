import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { csrfFetch } from '../utils/csrfFetch';
import '../styles/Devices.css'; // Reuse table/modal styles

interface SecretEntry {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  role: string;
}

interface SecretsProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
  currentTenant?: Tenant;
}

const Secrets: React.FC<SecretsProps> = ({ user, setIsAuthenticated, setUser, currentTenant: propCurrentTenant }) => {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(propCurrentTenant || null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretEntry | null>(null);
  const [formName, setFormName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const isAdminOrOwner = currentTenant?.role === 'owner' || currentTenant?.role === 'admin';

  useEffect(() => {
    if (propCurrentTenant) {
      setCurrentTenant(propCurrentTenant);
    }
  }, [propCurrentTenant]);

  useEffect(() => {
    const handleTenantChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setCurrentTenant(customEvent.detail);
    };
    window.addEventListener('tenantChanged', handleTenantChange as EventListener);
    return () => window.removeEventListener('tenantChanged', handleTenantChange as EventListener);
  }, []);

  useEffect(() => {
    if (!currentTenant || !isAdminOrOwner) {
      setSecrets([]);
      setLoading(false);
      return;
    }

    const fetchSecrets = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tenant/${currentTenant.id}/secrets`);
        if (!response.ok) throw new Error(`Failed to fetch secrets: ${response.status}`);
        const data = await response.json();
        setSecrets(data.secrets || []);
        setError(null);
      } catch (err) {
        setError(`Error fetching secrets: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSecrets();
  }, [currentTenant, isAdminOrOwner]);

  const handleLogout = async () => {
    try {
      const response = await csrfFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (response.ok) {
        setIsAuthenticated(false);
        setUser(null);
        navigate('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openCreateModal = () => {
    setEditingSecret(null);
    setFormName('');
    setFormValue('');
    setFormDomain('');
    setFormDescription('');
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (secret: SecretEntry) => {
    setEditingSecret(secret);
    setFormName(secret.name);
    setFormValue(''); // Never pre-fill the value
    setFormDomain(secret.domain || '');
    setFormDescription(secret.description || '');
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!currentTenant) return;
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    if (!editingSecret && !formValue.trim()) {
      setError('Value is required');
      return;
    }

    try {
      setSaving(true);

      if (editingSecret) {
        // Update
        const body: Record<string, string | null> = {};
        if (formName !== editingSecret.name) body.name = formName;
        if (formValue) body.value = formValue;
        if (formDomain !== (editingSecret.domain || '')) body.domain = formDomain || null;
        if (formDescription !== (editingSecret.description || '')) body.description = formDescription;

        if (Object.keys(body).length === 0) {
          setShowModal(false);
          return;
        }

        const response = await csrfFetch(`/api/tenant/${currentTenant.id}/secrets/${editingSecret.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update secret');
        }
      } else {
        // Create
        const response = await csrfFetch(`/api/tenant/${currentTenant.id}/secrets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, value: formValue, domain: formDomain || undefined, description: formDescription || undefined }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create secret');
        }
      }

      setShowModal(false);
      setSuccessMessage(editingSecret ? 'Secret updated' : 'Secret created');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Refresh list
      const response = await fetch(`/api/tenant/${currentTenant.id}/secrets`);
      if (response.ok) {
        const data = await response.json();
        setSecrets(data.secrets || []);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (secret: SecretEntry) => {
    if (!currentTenant) return;
    if (!window.confirm(`Delete secret "${secret.name}"? This cannot be undone.`)) return;

    try {
      const response = await csrfFetch(`/api/tenant/${currentTenant.id}/secrets/${secret.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete secret');
      }

      setSecrets(secrets.filter((s) => s.id !== secret.id));
      setSuccessMessage('Secret deleted');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="devices-container">
        <div className="devices-header">
          <h1>Secrets</h1>
          {isAdminOrOwner && (
            <button className="btn btn-primary" onClick={openCreateModal} disabled={!currentTenant}>
              Add Secret
            </button>
          )}
        </div>

        {!currentTenant && (
          <div className="notification-bar">
            Please select an organization from the sidebar to manage secrets.
          </div>
        )}

        {currentTenant && !isAdminOrOwner && (
          <div className="notification-bar">
            Only organization owners and admins can manage secrets.
          </div>
        )}

        {loading && <p>Loading secrets...</p>}
        {error && !showModal && <p className="error-message">{error}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}

        {!loading && isAdminOrOwner && secrets.length === 0 && currentTenant && (
          <div className="empty-state">
            <p>No secrets configured for this organization.</p>
            <p style={{ fontSize: '0.9em', color: '#888' }}>
              Secrets can store API tokens, passwords, and other sensitive values
              that can be referenced in playlist item headers.
            </p>
          </div>
        )}

        {secrets.length > 0 && (
          <div className="table-responsive">
            <table className="App-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Domain</th>
                  <th>Description</th>
                  <th>Created By</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((secret) => (
                  <tr key={secret.id}>
                    <td><code>{secret.name}</code></td>
                    <td>{secret.domain || '-'}</td>
                    <td>{secret.description || '-'}</td>
                    <td>{secret.createdByEmail || '-'}</td>
                    <td>{new Date(secret.updatedAt).toLocaleDateString()}</td>
                    <td className="action-buttons-cell">
                      <button className="btn btn-info btn-sm" onClick={() => openEditModal(secret)} title="Edit Secret">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(secret)} title="Delete Secret">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Secret Modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{editingSecret ? 'Edit Secret' : 'Add Secret'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="secret-name">Name *</label>
                  <input
                    id="secret-name"
                    className="form-input"
                    placeholder="e.g. GRAFANA_TOKEN"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="secret-value">
                    Value {editingSecret ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    id="secret-value"
                    type="password"
                    className="form-input"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder={editingSecret ? 'Enter new value to change' : 'Secret value'}
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="secret-domain">Domain</label>
                  <input
                    id="secret-domain"
                    className="form-input"
                    placeholder="e.g. grafana.example.com"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                  />
                  <span style={{ fontSize: '0.8em', color: '#888' }}>
                    The domain this secret applies to. Used to auto-match secrets to URLs.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="secret-description">Description</label>
                  <input
                    id="secret-description"
                    className="form-input"
                    placeholder="Optional description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {error && <p className="error-message">{error}</p>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editingSecret ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Secrets;
