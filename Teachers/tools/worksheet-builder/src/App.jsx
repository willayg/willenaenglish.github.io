import React, { useState } from 'react';
import './App.css';
import WorksheetManager from './WorksheetManager';

function App() {
  const [pages, setPages] = useState([{}]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerMode, setManagerMode] = useState('load');

  const handleAddPage = () => {
    setPages([...pages, {}]);
  };

  // Dummy worksheet data for save (replace with your actual worksheet state)
  const getCurrentWorksheetData = () => ({
    title: 'Untitled',
    worksheet_type: 'wordtest',
    words: ['example', 'test'],
    // ...other fields
  });

  return (
    <div className="container">
      <div className="app-card">
        {/* Header */}
        <div className="header">
          <div className="logo">
            <img src="../../../../Assets/Images/Logo.png" alt="Willena" className="logo-img" />
          </div>
          <h1>Worksheet Builder</h1>
          <div id="burger-menu-mount">
            <span style={{width: '24px', height: '3px', background: 'white', borderRadius: '2px', display: 'block'}}></span>
            <span style={{width: '24px', height: '3px', background: 'white', borderRadius: '2px', display: 'block'}}></span>
            <span style={{width: '24px', height: '3px', background: 'white', borderRadius: '2px', display: 'block'}}></span>
          </div>
        </div>

        {/* Top Action Bar */}
        <div className="top-actions">
          <span className="action-link">New</span>
          <span
            className="action-link"
            onClick={() => { setManagerMode('load'); setManagerOpen(true); }}
          >
            Load
          </span>
          <span
            className="action-link"
            onClick={() => { setManagerMode('save'); setManagerOpen(true); }}
          >
            Save
          </span>
          <span className="action-link">Print</span>
          <span className="action-link">PDF</span>
          <span className="action-link" style={{marginLeft: 'auto'}}>More</span>
        </div>

        {/* Pastel Toolbar (empty for now) */}
        <div className="pastel-toolbar"></div>

        {/* Page Preview Area (A4 aspect ratio) */}
        {pages.map((_, idx) => (
          <div className="page-preview-wrapper" key={idx} style={{marginBottom: idx === pages.length - 1 ? '16px' : '8px'}}>
            <div className="page-preview-a4">
              <div className="page-preview-placeholder">
                <p>Worksheet preview (A4 paper)</p>
                <p>Content will appear here</p>
                <p style={{fontSize:'0.9em', color:'#bbb'}}>Page {idx + 1}</p>
              </div>
            </div>
          </div>
        ))}
        <div
          className="add-page-text"
          style={{
            textAlign: 'center',
            color: '#4a5568',
            fontWeight: 500,
            fontSize: '1.1em',
            cursor: 'pointer',
            margin: '0 0 16px 0',
            userSelect: 'none',
            transition: 'color 0.2s',
          }}
          onClick={handleAddPage}
          onMouseOver={e => (e.currentTarget.style.color = '#2d3748')}
          onMouseOut={e => (e.currentTarget.style.color = '#4a5568')}
        >
          + Add New Page
        </div>
        {/* Worksheet Manager Modal */}
        {managerOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(60,60,80,0.18)', minWidth: 340, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
              <button
                style={{ position: 'absolute', top: 12, right: 16, fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
                onClick={() => setManagerOpen(false)}
                aria-label="Close"
              >×</button>
              <WorksheetManager
                mode={managerMode}
                openerData={managerMode === 'save' ? getCurrentWorksheetData() : {}}
                onClose={() => setManagerOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
