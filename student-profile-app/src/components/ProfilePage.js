import React from 'react';

const ProfilePage = ({ userData, onEdit }) => {
  const handleEdit = () => {
    // Logic for editing the profile can be implemented here
    onEdit();
  };

  return (
    <div className="profile-page">
      <h1>Student Profile</h1>
      <div className="profile-info">
        <p><strong>Name:</strong> {userData.name}</p>
        <p><strong>Email:</strong> {userData.email}</p>
        <p><strong>Major:</strong> {userData.major}</p>
        <p><strong>Year:</strong> {userData.year}</p>
      </div>
      <button onClick={handleEdit}>Edit Profile</button>
    </div>
  );
};

export default ProfilePage;