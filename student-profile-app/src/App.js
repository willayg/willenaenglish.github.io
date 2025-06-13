import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import ProfilePage from './components/ProfilePage';
import SignUpPage from './components/SignUpPage';
import './styles/main.css';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/profile" component={ProfilePage} />
        <Route path="/signup" component={SignUpPage} />
        <Route path="/" exact>
          <h1>Welcome to the Student Profile App</h1>
        </Route>
      </Switch>
    </Router>
  );
}

export default App;