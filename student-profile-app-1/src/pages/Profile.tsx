import React from 'react';
import { useParams } from 'react-router-dom';
import ProfileCard from '../components/ProfileCard';
import { Student } from '../types/student';

const Profile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = React.useState<Student | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await fetch(`/api/students/${studentId}`);
        const data = await response.json();
        setStudent(data);
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [studentId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!student) {
    return <div>Student not found.</div>;
  }

  return (
    <div>
      <h1>{student.name}'s Profile</h1>
      <ProfileCard student={student} />
    </div>
  );
};

export default Profile;