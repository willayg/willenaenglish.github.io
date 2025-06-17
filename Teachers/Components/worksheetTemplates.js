// Each template is a function that returns HTML
const worksheetTemplates = [
  {
    name: "Classic",
    render: ({ title, instructions, puzzle, orientation }) => `
      <div class="${orientation === 'landscape' ? 'a4-landscape' : 'a4-portrait'}" style="width:100%; height:100%; box-sizing:border-box; padding:12px; background:#fff;">
        <div style="
          width:100%; height:100%;
          box-sizing:border-box;
          padding:40px 32px 32px 32px;
          border:1.5mm solid rgb(33, 25, 78);
          border-radius:18px;
          background:#fff;
          font-family:'Nanum Pen Script',Arial,sans-serif;
          display:flex; flex-direction:column; justify-content:flex-start;
        ">
          <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
            <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
            <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
          </div>
          <h1 style="font-size:2.2rem;font-weight:bold;text-align:center;margin-bottom:10px;color:#2e2b3f;letter-spacing:1px;">${title || 'Worksheet'}</h1>
          <div style="margin-bottom:28px;color:#444;font-size:1.1rem;text-align:center;">${instructions || ''}</div>
          <div style="flex:1 1 auto; margin-bottom:32px;">${puzzle || ''}</div>
          <footer style="border-top:1px solid #eee;margin-top:auto;padding-top:12px;text-align:center;color:#888;font-size:0.95rem;font-family:'Glacial Indifference', Arial, sans-serif;">
            Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
          </footer>
        </div>
      </div>
    `
  },
  {
    name: "Minimal",
    render: ({ title, instructions, puzzle, orientation }) => `
      <div class="${orientation === 'landscape' ? 'a4-landscape' : 'a4-portrait'}" style="width:100%; height:100%; box-sizing:border-box; padding:12px; background:#fff;">
        <div style="
          width:100%; height:100%;
          box-sizing:border-box;
          padding:32px 24px;
          border:1.5mm solid rgb(34, 27, 71);
          background:#fff;
          font-family:Arial,sans-serif;
          display:flex; flex-direction:column; justify-content:flex-start;
        ">
          <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:14px; font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
            <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
            <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
          </div>
          <h1 style="font-size:2rem;font-weight:bold;text-align:left;margin-bottom:8px;color:#222;">${title || 'Worksheet'}</h1>
          <div style="margin-bottom:20px;color:#333;">${instructions || ''}</div>
          <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
          <footer style="border-top:1px solid #eee;margin-top:auto;padding-top:12px;text-align:center;color:#888;font-size:0.95rem;font-family:'Glacial Indifference', Arial, sans-serif;">
            Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
          </footer>
        </div>
      </div>
    `
  }
];

// Make available globally
window.worksheetTemplates = worksheetTemplates;

