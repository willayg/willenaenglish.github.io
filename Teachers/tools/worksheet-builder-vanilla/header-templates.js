// header-templates.js
// Centralized header template definitions

(function() {
  // Define templates object outside the function so we can expose it
  const templates = {
    // 'basic' style removed
    'basic1': `
      <div style="padding:16px;border-bottom:1px solid #e1e8ed;display:flex;align-items:center;justify-content:center;border:2px solid #e1e8ed;border-radius:8px;background:#f8fafc;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Roboto,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:Roboto,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic1a': `
      <div style="padding:16px;border-bottom:1px solid #4ea8de;display:flex;align-items:center;justify-content:center;border:2px solid #4ea8de;border-radius:8px;background:#f0f8ff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;margin:0 auto;color:#4ea8de;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#4ea8de;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic1b': `
      <div style="padding:16px;border-bottom:1px solid #43aa8b;display:flex;align-items:center;justify-content:center;border:2px solid #43aa8b;border-radius:8px;background:#f0fff4;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Montserrat,sans-serif;white-space:nowrap;margin:0 auto;color:#43aa8b;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#43aa8b;font-family:Montserrat,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic1c': `
      <div style="padding:16px;border-bottom:1px solid #f9c74f;display:flex;align-items:center;justify-content:center;border:2px solid #f9c74f;border-radius:8px;background:#fffbf0;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Lato,sans-serif;white-space:nowrap;margin:0 auto;color:#f9c74f;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#f9c74f;font-family:Lato,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic1d': `
      <div style="padding:16px;border-bottom:1px solid #e76f51;display:flex;align-items:center;justify-content:center;border:2px solid #e76f51;border-radius:8px;background:#fff5f2;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Open Sans,sans-serif;white-space:nowrap;margin:0 auto;color:#e76f51;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#e76f51;font-family:Open Sans,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic1e': `
      <div style="padding:16px;border-bottom:1px solid #9b59b6;display:flex;align-items:center;justify-content:center;border:2px solid #9b59b6;border-radius:8px;background:#f8f4ff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Source Sans Pro,sans-serif;white-space:nowrap;margin:0 auto;color:#9b59b6;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#9b59b6;font-family:Source Sans Pro,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic2': `
      <div style="padding:16px;border-bottom:2px solid #045c63;display:flex;align-items:center;justify-content:center;border:2px solid #045c63;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#045c63;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic2a': `
      <div style="padding:16px;border-bottom:2px solid #d63384;display:flex;align-items:center;justify-content:center;border:2px solid #d63384;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Nunito,sans-serif;white-space:nowrap;margin:0 auto;color:#d63384;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#d63384;font-family:Nunito,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic2b': `
      <div style="padding:16px;border-bottom:2px solid #198754;display:flex;align-items:center;justify-content:center;border:2px solid #198754;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Inter,sans-serif;white-space:nowrap;margin:0 auto;color:#198754;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#198754;font-family:Inter,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic2c': `
      <div style="padding:16px;border-bottom:2px solid #fd7e14;display:flex;align-items:center;justify-content:center;border:2px solid #fd7e14;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Raleway,sans-serif;white-space:nowrap;margin:0 auto;color:#fd7e14;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#fd7e14;font-family:Raleway,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic2d': `
      <div style="padding:16px;border-bottom:2px solid #6f42c1;display:flex;align-items:center;justify-content:center;border:2px solid #6f42c1;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Work Sans,sans-serif;white-space:nowrap;margin:0 auto;color:#6f42c1;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#6f42c1;font-family:Work Sans,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic2e': `
      <div style="padding:16px;border-bottom:2px solid #20c997;display:flex;align-items:center;justify-content:center;border:2px solid #20c997;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:PT Sans,sans-serif;white-space:nowrap;margin:0 auto;color:#20c997;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#20c997;font-family:PT Sans,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic3': `
      <div style="padding:16px;border-bottom:1px dashed #e1e8ed;display:flex;align-items:center;justify-content:center;border:2px dashed #e1e8ed;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Georgia,serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:Georgia,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic3a': `
      <div style="padding:16px;border-bottom:1px dashed #dc3545;display:flex;align-items:center;justify-content:center;border:2px dashed #dc3545;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Playfair Display,serif;white-space:nowrap;margin:0 auto;color:#dc3545;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#dc3545;font-family:Playfair Display,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic3b': `
      <div style="padding:16px;border-bottom:1px dashed #0d6efd;display:flex;align-items:center;justify-content:center;border:2px dashed #0d6efd;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Merriweather,serif;white-space:nowrap;margin:0 auto;color:#0d6efd;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#0d6efd;font-family:Merriweather,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic3c': `
      <div style="padding:16px;border-bottom:1px dashed #ffc107;display:flex;align-items:center;justify-content:center;border:2px dashed #ffc107;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Libre Baskerville,serif;white-space:nowrap;margin:0 auto;color:#ffc107;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#ffc107;font-family:Libre Baskerville,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic3d': `
      <div style="padding:16px;border-bottom:1px dashed #6610f2;display:flex;align-items:center;justify-content:center;border:2px dashed #6610f2;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Crimson Text,serif;white-space:nowrap;margin:0 auto;color:#6610f2;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#6610f2;font-family:Crimson Text,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic3e': `
      <div style="padding:16px;border-bottom:1px dashed #198754;display:flex;align-items:center;justify-content:center;border:2px dashed #198754;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Lora,serif;white-space:nowrap;margin:0 auto;color:#198754;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#198754;font-family:Lora,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic4': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:3px solid #e1e8ed;border-radius:0px;background:#f0f4f8;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Verdana,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:Verdana,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic4a': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:3px solid #e91e63;border-radius:0px;background:#fce4ec;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Ubuntu,sans-serif;white-space:nowrap;margin:0 auto;color:#e91e63;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#e91e63;font-family:Ubuntu,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic4b': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:3px solid #00bcd4;border-radius:0px;background:#e0f2f1;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Oxygen,sans-serif;white-space:nowrap;margin:0 auto;color:#00bcd4;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#00bcd4;font-family:Oxygen,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic4c': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:3px solid #ff9800;border-radius:0px;background:#fff3e0;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Quicksand,sans-serif;white-space:nowrap;margin:0 auto;color:#ff9800;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#ff9800;font-family:Quicksand,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic4d': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:3px solid #673ab7;border-radius:0px;background:#f3e5f5;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Karla,sans-serif;white-space:nowrap;margin:0 auto;color:#673ab7;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#673ab7;font-family:Karla,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic4e': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:3px solid #4caf50;border-radius:0px;background:#e8f5e8;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Rubik,sans-serif;white-space:nowrap;margin:0 auto;color:#4caf50;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#4caf50;font-family:Rubik,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic5': `
      <div style="padding:16px;border-bottom:1px solid #cbd5e0;display:flex;align-items:center;justify-content:center;border:2px solid #cbd5e0;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:'Trebuchet MS',sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:'Trebuchet MS',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic5a': `
      <div style="padding:16px;border-bottom:1px solid #4ea8de;display:flex;align-items:center;justify-content:center;border:2px solid #4ea8de;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Verdana,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#4ea8de;font-family:Verdana,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic5b': `
      <div style="padding:16px;border-bottom:1px solid #00b4d8;display:flex;align-items:center;justify-content:center;border:2px solid #00b4d8;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#00b4d8;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic5c': `
      <div style="padding:16px;border-bottom:1px solid #43aa8b;display:flex;align-items:center;justify-content:center;border:2px solid #43aa8b;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Montserrat,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#43aa8b;font-family:Montserrat,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic5d': `
      <div style="padding:16px;border-bottom:1px solid #f9c74f;display:flex;align-items:center;justify-content:center;border:2px solid #f9c74f;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Lato,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#f9c74f;font-family:Lato,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic5e': `
      <div style="padding:16px;border-bottom:1px solid #e76f51;display:flex;align-items:center;justify-content:center;border:2px solid #e76f51;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:Arial,sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#e76f51;font-family:Arial,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic6': `
      <div style="padding:16px;border-bottom:1px solid #515b63;display:flex;align-items:center;justify-content:center;border:2px solid #515b63;border-radius:0px;background:#e1e8ed;">
        <img src="../../../../Assets/Images/Logo.png" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:'Courier New',monospace;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#515b63;font-family:'Courier New',monospace;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic7': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #045c63;border-radius:0px;background:#fff;">
        <img src="../../../../Assets/Images/Logo.png" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:'Segoe UI',sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#045c63;font-family:'Segoe UI',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic8': `
      <div style="padding:16px;border-bottom:1px dotted #e1e8ed;display:flex;align-items:center;justify-content:center;border:2px dotted #e1e8ed;border-radius:20px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:'Lucida Sans',sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:'Lucida Sans',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic9': `
      <div style="padding:16px;border-bottom:1px solid #e1e8ed;display:flex;align-items:center;justify-content:center;border:2px solid #e1e8ed;border-radius:0px;background:#f8fafc;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:'Tahoma',sans-serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:'Tahoma',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'basic10': `
      <div style="padding:16px;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #cbd5e0;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-right:6px;">
        <span style="font-size:1.5em;font-weight:600;font-family:'Palatino Linotype',serif;white-space:nowrap;margin:0 auto;">{title}</span>
        <div style="margin-left:auto;font-size:0.8em;color:#cbd5e0;font-family:'Palatino Linotype',serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'minimal': `
      <div style="padding:16px;border-bottom:1px solid #e1e8ed;border:2px solid #e1e8ed;border-radius:6px;background:#fff;">
        <span style="font-size:1.2em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;">{title}</span>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered': `
      <div style="padding:16px;border-bottom:1px solid #e1e8ed;text-align:center;border:2px solid #e1e8ed;border-radius:6px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centeredMint': `
      <div style="padding:16px;border-bottom:1px solid #b9f5d0;text-align:center;border:2px solid #b9f5d0;border-radius:8px;background:#e6fff7;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;color:#43aa8b;">{title}</div>
        <div style="font-size:0.8em;color:#43aa8b;margin-top:3px;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centeredPink': `
      <div style="padding:16px;border-bottom:1px solid #fce4ec;text-align:center;border:2px solid #e91e63;border-radius:8px;background:#fce4ec;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;color:#e91e63;">{title}</div>
        <div style="font-size:0.8em;color:#e91e63;margin-top:3px;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centeredBlue': `
      <div style="padding:16px;border-bottom:1px solid #e3f2fd;text-align:center;border:2px solid #2196f3;border-radius:8px;background:#e3f2fd;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;color:#2196f3;">{title}</div>
        <div style="font-size:0.8em;color:#2196f3;margin-top:3px;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered1': `
      <div style="padding:16px;border-bottom:1px solid #e1e8ed;text-align:center;border:2px solid #e1e8ed;border-radius:8px;background:#f8fafc;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Roboto,sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:Roboto,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered2': `
      <div style="padding:16px;border-bottom:2px solid #045c63;text-align:center;border:2px solid #045c63;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#045c63;margin-top:3px;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered3': `
      <div style="padding:16px;border-bottom:1px dashed #e1e8ed;text-align:center;border:2px dashed #e1e8ed;border-radius:12px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Georgia,serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:Georgia,serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered4': `
      <div style="padding:16px;text-align:center;border-bottom:3px solid #e1e8ed;border-radius:0px;background:#f0f4f8;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:Verdana,sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:Verdana,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered5': `
      <div style="padding:16px;border-bottom:1px solid #cbd5e0;text-align:center;border:2px solid #cbd5e0;border-radius:16px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:'Trebuchet MS',sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:'Trebuchet MS',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered6': `
      <div style="padding:16px;border-bottom:1px solid #515b63;text-align:center;border:2px solid #515b63;border-radius:0px;background:#e1e8ed;">
        <img src="../../../../Assets/Images/Logo.png" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:'Courier New',monospace;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#515b63;margin-top:3px;font-family:'Courier New',monospace;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered7': `
      <div style="padding:16px;text-align:center;border-bottom:2px solid #045c63;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:'Segoe UI',sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#045c63;margin-top:3px;font-family:'Segoe UI',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered8': `
      <div style="padding:16px;border-bottom:1px dotted #e1e8ed;text-align:center;border:2px dotted #e1e8ed;border-radius:20px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:'Lucida Sans',sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:'Lucida Sans',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered9': `
      <div style="padding:16px;border-bottom:1px solid #e1e8ed;text-align:center;border:2px solid #e1e8ed;border-radius:0px;background:#f8fafc;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:'Tahoma',sans-serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#666;margin-top:3px;font-family:'Tahoma',sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'centered10': `
      <div style="padding:16px;text-align:center;border-bottom:2px solid #cbd5e0;border-radius:0px;background:#fff;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;margin-bottom:4px;"><br>
        <div style="font-size:1.2em;font-weight:600;font-family:'Palatino Linotype',serif;white-space:nowrap;">{title}</div>
        <div style="font-size:0.8em;color:#cbd5e0;margin-top:3px;font-family:'Palatino Linotype',serif;white-space:nowrap;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative3': `
      <div style="padding:16px 24px;background:#fff;border-radius:32px 0 32px 0;border:4px double #00b4d8;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:grayscale(0.2);">
        <span style="font-size:2em;font-family:'Bauhaus 93',cursive;font-weight:700;color:#00b4d8;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#333;font-family:'Bauhaus 93',cursive;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative4': `
      <div style="padding:22px 18px;background:linear-gradient(135deg,#22223b 60%,#4ea8de 100%);border-radius:0 32px 0 32px;border:4px solid #4ea8de;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:brightness(1.2);">
        <span style="font-size:2em;font-family:'Futura',sans-serif;font-weight:800;color:#fff;letter-spacing:2px;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#4ea8de;font-family:'Futura',sans-serif;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative7': `
      <div style="padding:16px 24px;background:linear-gradient(135deg,#f8fafc 60%,#43aa8b 100%);border-radius:0 32px 0 32px;border:4px solid #43aa8b;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:brightness(1.1);">
        <span style="font-size:2em;font-family:'Futura',sans-serif;font-weight:800;color:#43aa8b;letter-spacing:2px;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#333;font-family:'Futura',sans-serif;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative8': `
      <div style="padding:22px 18px;background:linear-gradient(135deg,#22223b 60%,#f9c74f 100%);border-radius:32px 0 32px 0;border:4px solid #f9c74f;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:drop-shadow(0 0 4px #f9c74f);">
        <span style="font-size:2em;font-family:'Bauhaus 93',cursive;font-weight:700;color:#fff;letter-spacing:2px;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#f9c74f;font-family:'Bauhaus 93',cursive;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative11': `
      <div style="padding:16px 24px;background:#f8fafc;border-radius:32px 0 32px 0;border:4px double #43aa8b;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:grayscale(0.1);">
        <span style="font-size:2em;font-family:'Bauhaus 93',cursive;font-weight:700;color:#43aa8b;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#333;font-family:'Bauhaus 93',cursive;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative12': `
      <div style="padding:22px 18px;background:linear-gradient(135deg,#22223b 60%,#f9c74f 100%);border-radius:0 32px 0 32px;border:4px solid #f9c74f;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:brightness(1.3);">
        <span style="font-size:2em;font-family:'Futura',sans-serif;font-weight:800;color:#fff;letter-spacing:2px;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#f9c74f;font-family:'Futura',sans-serif;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative13': `
      <div style="padding:16px 24px;background:#fff;border-radius:32px 0 32px 0;border:4px double #4ea8de;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:grayscale(0.2);">
        <span style="font-size:2em;font-family:'Bauhaus 93',cursive;font-weight:700;color:#4ea8de;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#333;font-family:'Bauhaus 93',cursive;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative14': `
      <div style="padding:22px 18px;background:linear-gradient(135deg,#22223b 60%,#00b4d8 100%);border-radius:0 32px 0 32px;border:4px solid #00b4d8;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:brightness(1.2);">
        <span style="font-size:2em;font-family:'Futura',sans-serif;font-weight:800;color:#fff;letter-spacing:2px;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#00b4d8;font-family:'Futura',sans-serif;">Name: ______ Date: ______</div>
      </div>
    `,
    'creative15': `
      <div style="padding:16px 24px;background:#fff;border-radius:32px 0 32px 0;border:4px double #f9c74f;display:flex;align-items:center;gap:18px;">
        <img src="{logoSrc}" alt="Logo" style="height:75px;filter:grayscale(0.2);">
        <span style="font-size:2em;font-family:'Bauhaus 93',cursive;font-weight:700;color:#f9c74f;">{title}</span>
        <div style="margin-left:auto;font-size:1em;color:#333;font-family:'Bauhaus 93',cursive;">Name: ______ Date: ______</div>
      </div>
    `
  };

  // Header template generator function
  function generateHeaderHTML(style, title, logoSrc) {
    const template = templates[style] || templates['basic'];
    return template.replace(/{logoSrc}/g, logoSrc).replace(/{title}/g, title);
  }


  // --- Worksheet session-based title reset logic ---
  // Call this function when starting a new worksheet to reset the title
  function startNewWorksheetSession(defaultTitle = "Worksheet Title") {
    // Generate a new session ID (timestamp-based)
    const newSessionId = Date.now().toString();
    localStorage.setItem("worksheetSessionId", newSessionId);
    localStorage.setItem("worksheetTitle", defaultTitle);
  }

  // On load, check if session ID exists; if not, set it (first worksheet in this tab)
  if (!localStorage.getItem("worksheetSessionId")) {
    startNewWorksheetSession();
  }

  // Expose the function and templates globally
  window.headerTemplates = {
    generateHTML: generateHeaderHTML,
    templates: templates,
    startNewWorksheetSession: startNewWorksheetSession
  };
})();
