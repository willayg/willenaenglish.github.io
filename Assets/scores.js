import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://fiieuiktlsivwfgyivai.supabase.co';
const SUPABASE_KEY = 'YeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWV1aWt0bHNpdndmZ3lpdmFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTEyNTIsImV4cCI6MjA2NDE4NzI1Mn0.aMQN_U2aLvH7RzuT-dfzQF4RNA7YQ-Xn6upqJFr7eisOUR_PUBLIC_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Save a score
async function submitScore(name, score, game) {
  const { data, error } = await supabase
    .from('Scores')
    .insert([
      { name: name, score: score, game: game }
    ]);

  if (error) {
    console.error('Error submitting score:', error);
  } else {
    console.log('Score submitted:', data);
}


// Get top scores for a game
async function fetchHighScores(gameName) {
  const { data, error } = await supabase
    .from('Scores')
    .select('name, score')
    .eq('game', gameName)
    .order('score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching scores:', error);
    return [];
  }

  return data; // [{ name: 'Ellie', score: 200 }, ...]
}

}