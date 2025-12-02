window.addEventListener('DOMContentLoaded', function () {
  // Sidebar and Topbar toggle logic
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const sidebarBtn = document.getElementById('toggleSidebarBtn');
  const topbarBtn = document.getElementById('toggleTopbarBtn');
  if (sidebar && topbar && sidebarBtn && topbarBtn) {
    sidebarBtn.onclick = () => {
      sidebar.classList.toggle('sidebar-collapsed');
      sidebar.classList.toggle('sidebar-expanded');
    };
    topbarBtn.onclick = () => {
      topbar.classList.toggle('topbar-collapsed');
      topbar.classList.toggle('topbar-expanded');
    };
    sidebar.classList.add('sidebar-expanded');
    topbar.classList.add('topbar-expanded');
  }
  // Token meter placeholder
  const tokenMeter = document.getElementById('tokenMeter');
  if (tokenMeter) tokenMeter.textContent = '1234';

  // File upload logic
  const fileUpload = document.getElementById('fileUpload');
  const fileList = document.getElementById('fileList');
  if (fileUpload && fileList) {
    fileUpload.addEventListener('change', async function () {
      for (const file of fileUpload.files) {
        // Create list item with progress bar
        const li = document.createElement('li');
        li.className = 'bg-white rounded px-3 py-2 shadow text-[#2e2b3f] font-medium flex items-center gap-2';
        li.textContent = file.name;

        const progress = document.createElement('progress');
        progress.max = 100;
        progress.value = 0;
        progress.className = 'ml-2';
        li.appendChild(progress);
        fileList.appendChild(li);

        // Read file as base64 with progress
        const reader = new FileReader();
        reader.onprogress = function (e) {
          if (e.lengthComputable) {
            progress.value = Math.round((e.loaded / e.total) * 100);
          }
        };
        reader.onload = async function (e) {
          progress.value = 100;
          const base64 = e.target.result.split(',')[1];
          // Send to Netlify function
          const response = await fetch('/.netlify/functions/supabase_proxy/upload_teacher_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileDataBase64: base64,
            }),
          });
          const result = await response.json();
          progress.remove();
          if (result.error) {
            li.textContent = file.name + ' (Upload failed)';
            li.style.color = 'red';
          } else {
            // Add download link
            const a = document.createElement('a');
            a.href = result.publicUrl || '#';
            a.textContent = 'Download';
            a.className = 'ml-4 text-blue-600 underline';
            a.target = '_blank';
            li.appendChild(a);
          }
        };
        reader.readAsDataURL(file);
      }
      fileUpload.value = '';
    });
  }

  // File search logic
  const fileSearch = document.getElementById('fileSearch');
  fileSearch.addEventListener('input', function () {
    const search = fileSearch.value.toLowerCase();
    for (const li of fileList.children) {
      li.style.display = li.textContent.toLowerCase().includes(search) ? '' : 'none';
    }
  });

  // Pagination logic
  let currentOffset = 0;
  const limit = 20;

  async function loadFiles(offset = 0) {
    const response = await fetch(`/.netlify/functions/supabase_proxy/list_teacher_files?limit=20&offset=${offset}`);
    const files = await response.json();
    renderFileList(files);
  }

  // Add event listeners for next/prev buttons
  document.getElementById('nextBtn').onclick = () => {
    currentOffset += limit;
    loadFiles(currentOffset);
  };
  document.getElementById('prevBtn').onclick = () => {
    currentOffset = Math.max(0, currentOffset - limit);
    loadFiles(currentOffset);
  };

  // Initial load
  loadFiles();
});

function renderFileList(files) {
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';
  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'bg-white rounded px-3 py-2 shadow text-[#2e2b3f] font-medium flex items-center gap-2';
    li.textContent = file.name;
    // Add download link
    if (file.url) {
      const a = document.createElement('a');
      a.href = file.url;
      a.textContent = 'Download';
      a.className = 'ml-4 text-blue-600 underline';
      a.target = '_blank';
      li.appendChild(a);
    }
    fileList.appendChild(li);
  });
}

