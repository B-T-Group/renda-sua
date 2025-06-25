// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import NxWelcome from './nx-welcome';

import { Route, Routes, Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import LoginButton from '../components/auth/LoginButton';
import LogoutButton from '../components/auth/LogoutButton';
import UserProfile from '../components/auth/UserProfile';
import ProtectedRoute from '../components/auth/ProtectedRoute';

export function App() {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <header>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/profile">Profile</Link>
            </li>
            <li>
              <Link to="/protected">Protected Page</Link>
            </li>
          </ul>
          <div>
            {isAuthenticated ? <LogoutButton /> : <LoginButton />}
          </div>
        </nav>
      </header>

      <main>
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <h1>Welcome to Rendasua</h1>
                <p>This is the home page.</p>
                {!isAuthenticated && (
                  <p>Please log in to access protected features.</p>
                )}
              </div>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>
                  <h2>Protected Page</h2>
                  <p>This page is only visible to authenticated users.</p>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
