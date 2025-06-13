import React from 'react';

interface ProfileCardProps {
  name: string;
  avatar: string;
  scores: number[];
}

const ProfileCard: React.FC<ProfileCardProps> = ({ name, avatar, scores }) => {
  return (
    <div className="profile-card">
      <img src={avatar} alt={`${name}'s avatar`} className="avatar" />
      <h2 className="student-name">{name}</h2>
      <div className="scores">
        <h3>Scores:</h3>
        <ul>
          {scores.map((score, index) => (
            <li key={index}>Score {index + 1}: {score}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProfileCard;