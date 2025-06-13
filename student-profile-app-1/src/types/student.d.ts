interface Student {
  id: string;
  name: string;
  avatar: string;
  scores: {
    [subject: string]: number;
  };
}

export default Student;