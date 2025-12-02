import React, { useEffect, useState } from 'react';

// WorksheetManager: React-native rebuild of worksheet_manager.html
export default function WorksheetManager({ mode = 'load', openerData = {}, onClose }) {
  const [loading, setLoading] = useState(false);
  const [worksheets, setWorksheets] = useState([]);
  const [search, setSearch] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState({
    title: '',
    book: '',
    unit: '',
    languagePoint: '',
    notes: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (mode === 'load') {
      setLoading(true);
      WillenaAPI.fetch('/.netlify/functions/supabase_proxy/list_worksheets')
        .then(res => res.json())
        .then(result => {
          if (result.success && Array.isArray(result.data)) {
            setWorksheets(result.data);
          } else {
            setMessage('No worksheets found or error loading worksheets.');
          }
        })
        .catch(() => setMessage('Error loading worksheets.'))
        .finally(() => setLoading(false));
    }
  }, [mode]);

  // Save worksheet
  const handleSave = async e => {
    e.preventDefault();
    setLoading(true);
    let worksheet = { ...openerData, ...form };
    worksheet.title = form.title;
    worksheet.notes = form.notes;
    worksheet.book = form.book;
    worksheet.unit = form.unit;
    worksheet.language_point = form.languagePoint;
    // Add username from localStorage
    let username = localStorage.getItem('username') || '';
    if (!username) {
      const email = localStorage.getItem('userEmail');
      if (email) username = email.split('@')[0];
    }
    if (username) worksheet.username = username;
    // Defensive: convert words to array
    if (typeof worksheet.words === 'string') {
      worksheet.words = worksheet.words.split('\n').filter(w => w.trim() !== '');
    }
    worksheet.words = Array.isArray(worksheet.words)
      ? worksheet.words.map(w => w.trim()).filter(w => w !== '')
      : [];
    // Save worksheet
    try {
      const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy/save_worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(worksheet)
      });
      const result = await res.json();
      if (result.success) {
        setMessage('Worksheet saved!');
        if (onClose) onClose();
      } else {
        setMessage('Error saving worksheet: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('Error saving worksheet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load worksheet
  const handleLoad = ws => {
    if (onClose) onClose(ws);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <h2 className="text-xl font-bold mb-4">Worksheet Manager</h2>
      {loading && (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-white bg-opacity-60 z-50">
          <div className="border-4 border-gray-200 border-t-blue-500 rounded-full w-10 h-10 animate-spin"></div>
        </div>
      )}
      {message && <div className="mb-2 text-red-600">{message}</div>}
      {mode === 'save' && (
        <form className="space-y-2" onSubmit={handleSave}>
          <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Worksheet Title" className="border p-1 w-full" required />
          <input type="text" value={form.book} onChange={e => setForm(f => ({ ...f, book: e.target.value }))} placeholder="Book" className="border p-1 w-full" />
          <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unit" className="border p-1 w-full" />
          <input type="text" value={form.languagePoint} onChange={e => setForm(f => ({ ...f, languagePoint: e.target.value }))} placeholder="Language Point" className="border p-1 w-full" />
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="border p-1 w-full" />
          <button type="submit" className="bg-blue-500 text-white px-4 py-1 rounded">Save</button>
        </form>
      )}
      {mode === 'load' && (
        <div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search worksheets..." className="border p-1 w-full mb-2" />
          <div className="max-h-96 overflow-y-auto border-2 border-blue-200 rounded p-2">
            {worksheets.filter(ws => (ws.title || '').toLowerCase().includes(search.toLowerCase())).map(ws => (
              <div key={ws.id} className="p-2 border-b hover:bg-blue-50 cursor-pointer" onClick={() => handleLoad(ws)}>
                <div className="font-bold">{ws.title}</div>
                <div className="text-xs text-gray-600">{ws.worksheet_type} | {ws.book} | {ws.unit}</div>
              </div>
            ))}
            {!worksheets.length && <div className="text-gray-400 p-2">No worksheets found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
