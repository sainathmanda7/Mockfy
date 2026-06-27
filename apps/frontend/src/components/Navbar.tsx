import { Link } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';

export default function Navbar() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  return (
    <nav style={{ padding: '1rem', borderBottom: '1px solid #333', background: '#0a0a0a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <ul style={{ display: 'flex', gap: '1.5rem', listStyle: 'none', margin: 0, padding: 0 }}>
        <li><Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Home</Link></li>
        <li><Link to="/upload" style={{ color: 'white', textDecoration: 'none' }}>Upload Resume</Link></li>
        <li><Link to="/interview" style={{ color: 'white', textDecoration: 'none' }}>Live Interview</Link></li>
        <li><Link to="/results" style={{ color: 'white', textDecoration: 'none' }}>Interview Results</Link></li>
      </ul>
      <div>
        <UserButton />
      </div>
    </nav>
  );
}