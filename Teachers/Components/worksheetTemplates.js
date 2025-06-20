// Each template is a function that returns HTML
const worksheetTemplates = [
  {
    name: "Classic",
    render: ({ title, instructions, puzzle, orientation }) => `
  <div style="
    width:794px;
    height:1123px;
    margin:auto;
    background:#fff;
    display:flex;
    align-items:center;
    justify-content:center;
  ">
    <div style="
      border: 6px solid #1a1940;
      border-radius: 18px;
      padding: 32px 24px;
      width: 100%;
      height: 100%;
      min-height: 1050px;
      box-sizing: border-box;
      position: relative;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    ">
      <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
        <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
        <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
      </div>
      <h1 style="font-size:2.2rem;font-weight:bold;text-align:center;margin-bottom:10px;color:#2e2b3f;letter-spacing:1px;">${title ?? ""}</h1>
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
    <div style="
      width:794px;
      height:1123px;
      margin:auto;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
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
        <h1 style="font-size:2rem;font-weight:bold;text-align:left;margin-bottom:8px;color:#222;">${title ?? ""}</h1>
        <div style="margin-bottom:20px;color:#333;">${instructions || ''}</div>
        <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
        <footer style="border-top:1px solid #eee;margin-top:auto;padding-top:12px;text-align:center;color:#888;font-size:0.95rem;font-family:'Glacial Indifference', Arial, sans-serif;">
          Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
        </footer>
      </div>
    </div>
  `
  },
  {
    name: "Line",
    render: ({ title, instructions, puzzle, orientation }) => `
    <div style="
      width:794px;
      height:1123px;
      margin:auto;
      background:#fff;
      display:flex;
      align-items:flex-start;
      justify-content:center;
    ">
      <div style="
        width:100%; height:100%;
        box-sizing:border-box;
        padding:32px 32px 32px 32px;
        background:#fff;
        font-family:Arial,sans-serif;
        display:flex; flex-direction:column; justify-content:flex-start;
        position:relative;
      ">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; position:relative;">
          <div style="display:flex; flex-direction:column; gap:8px;">
            <span style="font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
              Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span>
            </span>
            <span style="font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
              Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span>
            </span>
          </div>
          <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin-left:24px;width:110px;">
        </div>
        <div style="width:100%; height:4px; background:#b3e0ff; margin:18px 0 24px 0; border-radius:2px;"></div>
        <h1 style="font-size:2rem;font-weight:bold;text-align:left;margin-bottom:8px;color:#222;">${title ?? ""}</h1>
        <div style="margin-bottom:20px;color:#333;">${instructions || ''}</div>
        <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
        <footer style="border-top:1px solid #eee;margin-top:auto;padding-top:12px;text-align:center;color:#888;font-size:0.95rem;font-family:'Glacial Indifference', Arial, sans-serif;">
          Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
        </footer>
      </div>
    </div>
  `
  },
  {
    name: "Elegant Left Bar",
    render: ({ title, instructions, puzzle, orientation }) => `
    <div style="
      width:794px; height:1123px; margin:auto; background:#fff;
      display:flex; align-items:center; justify-content:center;
    ">
      <div style="
        width:100%; height:100%; box-sizing:border-box; display:flex;
        background:#fff;
      ">
        <div style="
          width:28px; height:100%; background:linear-gradient(180deg,#3b5998 0%,#8ac6d1 100%);
          border-radius:18px 0 0 18px; margin-right:32px;
        "></div>
        <div style="
          flex:1 1 auto; padding:36px 32px 32px 0; display:flex; flex-direction:column;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <div>
              <span style="font-size:1.1rem; color:#3b5998;">Name: <span style="border-bottom:1px solid #bbb; min-width:120px; display:inline-block;">&nbsp;</span></span>
              <span style="margin-left:24px; font-size:1.1rem; color:#3b5998;">Date: <span style="border-bottom:1px solid #bbb; min-width:90px; display:inline-block;">&nbsp;</span></span>
            </div>
            <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="width:90px;">
          </div>
          <h1 style="font-size:2.1rem; font-weight:700; color:#3b5998; margin-bottom:10px;">${title ?? ""}</h1>
          <div style="color:#4a5a6a; margin-bottom:22px;">${instructions || ''}</div>
          <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
          <footer style="border-top:1px solid #e0e6ed; margin-top:auto; padding-top:12px; text-align:center; color:#8fa1b3; font-size:0.97rem;">
            Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
          </footer>
        </div>
      </div>
    </div>
  `
  },
  {
    name: "Playful Dots",
    render: ({ title, instructions, puzzle, orientation }) => `
    <div style="
      width:794px; height:1123px; margin:auto; background:#fff;
      display:flex; align-items:center; justify-content:center; position:relative;
    ">
      <div style="
        width:95%; min-height:92%; background:#fffbe7; border-radius:24px;
        border:2.5px dashed #f9c846; padding:38px 34px 30px 34px;
        box-shadow:0 2px 12px rgba(249,200,70,0.08);
        display:flex; flex-direction:column; position:relative;
      ">
        <div style="position:absolute; top:18px; right:38px;">
          <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="width:80px;">
        </div>
        <div style="display:flex; gap:32px; margin-bottom:18px;">
          <span style="font-size:1.08rem; color:#b48a00;">Name: <span style="border-bottom:1.5px dotted #b48a00; min-width:120px; display:inline-block;">&nbsp;</span></span>
          <span style="font-size:1.08rem; color:#b48a00;">Date: <span style="border-bottom:1.5px dotted #b48a00; min-width:90px; display:inline-block;">&nbsp;</span></span>
        </div>
        <div style="height:10px; width:100%; background:repeating-radial-gradient(circle at 0 0, #ffe066, #ffe066 6px, transparent 7px, transparent 18px); margin-bottom:18px;"></div>
        <h1 style="font-size:2rem; font-weight:700; color:#b48a00; margin-bottom:8px; letter-spacing:1px;">${title ?? ""}</h1>
        <div style="margin-bottom:20px; color:#b48a00;">${instructions || ''}</div>
        <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
        <footer style="border-top:1.5px dashed #f9c846; margin-top:auto; padding-top:12px; text-align:center; color:#b48a00; font-size:0.97rem;">
          Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
        </footer>
      </div>
    </div>
  `
  },
  {
    name: "Modern Shadow Card",
    render: ({ title, instructions, puzzle, orientation }) => `
    <div style="
      width:794px; height:1123px; margin:auto; background:#f6f8fa;
      display:flex; align-items:center; justify-content:center;
    ">
      <div style="
        width:92%; min-height:90%; background:#fff; border-radius:18px;
        box-shadow:0 8px 32px rgba(44,62,80,0.13);
        padding:40px 36px 32px 36px; display:flex; flex-direction:column;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <div>
            <span style="font-size:1.1rem; color:#2d3a4a;">Name: <span style="border-bottom:1px solid #bbb; min-width:120px; display:inline-block;">&nbsp;</span></span>
            <span style="margin-left:24px; font-size:1.1rem; color:#2d3a4a;">Date: <span style="border-bottom:1px solid #bbb; min-width:90px; display:inline-block;">&nbsp;</span></span>
          </div>
          <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="width:90px;">
        </div>
        <h1 style="font-size:2.1rem; font-weight:700; color:#2d3a4a; margin-bottom:10px;">${title ?? ""}</h1>
        <div style="color:#4a5a6a; margin-bottom:22px;">${instructions || ''}</div>
        <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
        <footer style="border-top:1px solid #e0e6ed; margin-top:auto; padding-top:12px; text-align:center; color:#8fa1b3; font-size:0.97rem;">
          Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
        </footer>
      </div>
    </div>
  `
  },
  {
    name: "Classic Bottom",
    render: ({ title, instructions, puzzle, orientation }) => `
    <div style="
      width:794px;
      height:1123px;
      margin:auto;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        border: 6px solid #1a1940;
        border-radius: 18px;
        padding: 32px 24px 24px 24px;
        width: 100%;
        height: 100%;
        min-height: 1050px;
        box-sizing: border-box;
        position: relative;
        background: #fff;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      ">
        <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
          <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
          <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
        </div>
        ${title && title.trim() ? `<h1 style="font-size:1.2rem;font-weight:bold;text-align:center;margin-bottom:10px;color:#2e2b3f;letter-spacing:1px;">${title}</h1>` : ""}
        ${instructions && instructions.trim() ? `<div style="margin-bottom:28px;color:#444;font-size:1.1rem;text-align:center;">${instructions}</div>` : ""}
        <div style="flex:1 1 auto; margin-bottom:32px;">${puzzle || ''}</div>
        <footer style="border-top:1px solid #eee;margin-top:auto;padding-top:12px;text-align:center;color:#888;font-size:0.95rem;font-family:'Glacial Indifference', Arial, sans-serif;position:relative;">
          Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
          <div style="width:100%;text-align:center;margin-top:10px;">
            <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:inline-block;width:110px;">
          </div>
        </footer>
      </div>
    </div>
  `
  },
  {
    name: "Minimal Bottom",
    render: ({ title, instructions, puzzle, orientation }) => `
    <div style="
      width:794px;
      height:1123px;
      margin:auto;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <div style="
        width:100%; height:100%;
        box-sizing:border-box;
        padding:32px 24px 24px 24px;
        border:1.5mm solid rgb(34, 27, 71);
        background:#fff;
        font-family:Arial,sans-serif;
        display:flex; flex-direction:column; justify-content:flex-start;
      ">
        <div style="display:flex; justify-content:space-between; margin-bottom:14px; font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
          <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
          <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
        </div>
        ${title && title.trim() ? `<h1 style="font-size:1.2rem;font-weight:bold;text-align:left;margin-bottom:8px;color:#222;">${title}</h1>` : ""}
        ${instructions && instructions.trim() ? `<div style="margin-bottom:20px;color:#333;">${instructions}</div>` : ""}
        <div style="flex:1 1 auto; margin-bottom:24px;">${puzzle || ''}</div>
        <footer style="border-top:1px solid #eee;margin-top:auto;padding-top:12px;text-align:center;color:#888;font-size:0.95rem;font-family:'Glacial Indifference', Arial, sans-serif;position:relative;">
          Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
          <div style="width:100%;text-align:center;margin-top:10px;">
            <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:inline-block;width:110px;">
          </div>
        </footer>
      </div>
    </div>
  `
  }
];

// Make available globally
window.worksheetTemplates = worksheetTemplates;

// Template selection and rendering logic
const templateSelect = document.getElementById("wordsearchTemplate");
const previewArea = document.getElementById("templatePreview");

function renderTemplate() {
  const selectedOption = templateSelect.options[templateSelect.selectedIndex];
  const template = worksheetTemplates[selectedOption.value];
  previewArea.innerHTML = template.render({ title: "Sample Title", instructions: "Sample instructions.", puzzle: "Sample puzzle content." });
}

// Event listener for template selection
templateSelect.addEventListener("change", renderTemplate);

// Initial render
renderTemplate();

