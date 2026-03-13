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
              <button className="add-user-btn">Add New User</button>
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
                      <td>
                        <button className="action-button edit">Edit</button>
                        {user.id !== userData.id && (
                          <button className="action-button delete">Delete</button>
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