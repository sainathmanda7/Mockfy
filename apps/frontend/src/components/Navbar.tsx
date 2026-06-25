import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
      <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none' }}>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/upload">Upload Resume</Link></li>
        <li><Link to="/interview">Live Interview</Link></li>
        <li><Link to="/results">Interview Results</Link></li>
        <li><Link to="/auth">Login/Signup</Link></li>
      </ul>
    </nav>
  );
}