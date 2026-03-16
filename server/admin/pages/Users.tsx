import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { csrfFetch } from '../utils/csrfFetch';
import '../styles/Users.css';

interface UsersProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
}

interface User {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: Date;
  authenticatorCount?: number;
}

const Users: React.FC<UsersProps> = ({ user, setIsAuthenticated, setUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }
        const data = await response.json();
        setUsers(data);
        setError(null);
      } catch (err) {
        setError(`Error fetching users: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

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

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="users-container">
        <h1>User Management</h1>
        
        {loading && <p>Loading users...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {!loading && !error && users.length === 0 && (
          <p>No users found.</p>
        )}
        
        {users.length > 0 && (
          <div className="users-list">
            <div className="users-header">
              <h2>System Users</h2>
              <button className="btn btn-primary">Add New User</button>
            </div>
            
            <p>Total: {users.length} user(s)</p>
            
            <div className="table-responsive">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Authenticators</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userData) => (
                    <tr key={userData.id}>
                      <td>{userData.email}</td>
                      <td>{userData.displayName || '-'}</td>
                      <td>
                        <span className={`role-badge ${userData.role}`}>
                          {userData.role}
                        </span>
                      </td>
                      <td>{new Date(userData.createdAt).toLocaleDateString()}</td>
                      <td>{userData.authenticatorCount || 0}</td>
                      <td className="action-buttons-cell">
                        <button className="btn btn-info btn-sm" title="Edit User">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {user.id !== userData.id && (
                          <button className="btn btn-danger btn-sm" title="Delete User">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Users;