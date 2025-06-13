import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css'; // Assuming you will create a Home.css for specific styles

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <h1>Welcome to the Student Profile Application</h1>
      <p>This application allows you to view and manage student profiles.</p>
      <nav>
        <ul>
          <li>
            <Link to="/students">View Students</Link>
          </li>
          <li>
            <Link to="/profile">View Profile</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Home;