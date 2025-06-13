import axios from 'axios';

const API_BASE_URL = 'https://api.example.com/students';

export const fetchStudentData = async (studentId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching student data:', error);
    throw error;
  }
};

export const submitRegistration = async (studentData) => {
  try {
    const response = await axios.post(API_BASE_URL, studentData);
    return response.data;
  } catch (error) {
    console.error('Error submitting registration:', error);
    throw error;
  }
};