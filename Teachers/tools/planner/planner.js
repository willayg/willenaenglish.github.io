// Lesson Planner Tool for Willena English - Netlify Functions Integration
document.addEventListener('DOMContentLoaded', function() {
  
  // Generate lesson plan with AI
  const generateLessonBtn = document.getElementById('generateLessonPlan');
  if (generateLessonBtn) {
    generateLessonBtn.addEventListener('click', async function() {
      const className = document.getElementById('plannerClassName').value.trim();
      const date = document.getElementById('plannerDate').value;
      const duration = document.getElementById('plannerDuration').value;
      const customDuration = document.getElementById('customDuration').value;
      const topic = document.getElementById('plannerTopic').value.trim();
      const activities = document.getElementById('plannerActivities').value.trim();
      
      if (!topic) {
        alert('Please enter a lesson topic.');
        return;
      }
      
      const actualDuration = duration === 'custom' ? customDuration : duration;
      
      this.disabled = true;
      this.textContent = '🤖 Generating with AI...';
      
      try {
        const lessonPlan = await generateAILessonPlan(className, date, actualDuration, topic, activities);
        document.getElementById('lessonPlanOutput').innerHTML = lessonPlan;
        
        // Show in preview area
        const previewArea = document.getElementById('worksheetPreviewArea-planner');
        if (previewArea) {
          previewArea.innerHTML = `
            <div style="padding: 40px; font-family: Arial, sans-serif; line-height: 1.8; background: white;">
              ${lessonPlan}
            </div>
          `;
        }
        
      } catch (error) {
        console.error('Error generating lesson plan:', error);
        alert('Failed to generate lesson plan. Please try again.');
      }
      
      this.disabled = false;
      this.textContent = '🤖 Generate Lesson Plan with AI';
    });
  }
  
  // Edit lesson plan
  const editBtn = document.getElementById('editLessonPlan');
  if (editBtn) {
    editBtn.addEventListener('click', function() {
      const output = document.getElementById('lessonPlanOutput');
      const currentContent = output.innerHTML;
      
      if (this.textContent === '✏️ Edit Plan') {
        // Create editable textarea
        const textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.height = '400px';
        textarea.style.padding = '10px';
        textarea.style.border = '1px solid #ccc';
        textarea.style.borderRadius = '4px';
        textarea.value = currentContent.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        
        output.innerHTML = '';
        output.appendChild(textarea);
        
        // Change button to save
        this.textContent = '💾 Save Changes';
      } else {
        // Save changes
        const textarea = output.querySelector('textarea');
        const newContent = textarea.value.replace(/\n/g, '<br>');
        output.innerHTML = newContent;
        this.textContent = '✏️ Edit Plan';
        
        // Update preview
        const previewArea = document.getElementById('worksheetPreviewArea-planner');
        if (previewArea) {
          previewArea.innerHTML = `
            <div style="padding: 40px; font-family: Arial, sans-serif; line-height: 1.8; background: white;">
              ${newContent}
            </div>
          `;
        }
      }
    });
  }
  
  // Print lesson plan
  const printBtn = document.getElementById('printLessonPlan');
  if (printBtn) {
    printBtn.addEventListener('click', function() {
      const content = document.getElementById('lessonPlanOutput').innerHTML;
      if (!content || content.includes('Your AI-generated lesson plan will appear here')) {
        alert('Please generate a lesson plan first.');
        return;
      }
        const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lesson Plan</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              margin: 20px; 
              color: #333;
              font-size: 14px;
            }
            h1 { 
              color: #2e2b3f; 
              border-bottom: 3px solid #2e2b3f; 
              padding-bottom: 10px;
              margin-bottom: 20px;
              page-break-after: avoid;
            }
            h2 { 
              color: #444; 
              margin-top: 30px; 
              margin-bottom: 15px;
              page-break-after: avoid;
              background: #f8f9fa;
              padding: 12px;
              border-left: 4px solid #2e2b3f;
              font-size: 16px;
            }
            .page-break { 
              page-break-before: always; 
              margin-top: 0; 
            }
            .page-break:first-of-type {
              page-break-before: auto;
            }
            ul { 
              margin: 10px 0 20px 0; 
              padding-left: 20px;
            }
            li { 
              margin: 6px 0; 
              line-height: 1.5;
            }
            .header-info { 
              background: #f0f0f0; 
              padding: 15px; 
              border-radius: 5px; 
              margin: 20px 0;
              page-break-after: avoid;
            }
            strong {
              font-weight: bold;
            }
            @media print {
              .page-break { 
                page-break-before: always; 
                margin-top: 0;
              }
              .page-break:first-of-type {
                page-break-before: auto;
              }
              body { 
                margin: 15px; 
                font-size: 12px;
              }
              h1 { font-size: 18px; }
              h2 { font-size: 14px; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    });
  }
});

// Generate AI lesson plan using Netlify Functions proxy
async function generateAILessonPlan(className, date, duration, topic, preferredActivities) {
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
  };
  
  const durationNum = parseInt(duration);
  
  // Create the prompt for OpenAI
  const prompt = `Create a practical, activity-focused lesson plan for English language teachers. Use this specific format:

Class: ${className || 'English Class'}
Date: ${formatDate(date)}
Duration: ${duration} minutes
Topic: ${topic}

The lesson plan should have 5 sections with specific timing:
- Warm-up (${Math.round(durationNum * 0.1)} minutes)
- Intro (${Math.round(durationNum * 0.15)} minutes)  
- Main (${Math.round(durationNum * 0.55)} minutes)
- Practice (${Math.round(durationNum * 0.15)} minutes)
- Wrap-up (${Math.round(durationNum * 0.05)} minutes)

For each section, provide 3-4 bullet points using this format:
• T: [what the teacher does]
• Ss: [what the students do]
• [brief explanation of purpose/benefit]

Keep it practical and action-oriented. Focus on what actually happens in the classroom, not educational theory. Make activities engaging and varied.${preferredActivities ? `\n\nTeacher preferences: ${preferredActivities}` : ''}

Generate creative, specific activities that teachers can actually implement. Avoid formal lesson plan language - keep it conversational and practical.`;

  try {
    const response = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert English language teacher and curriculum designer. Create practical, engaging lesson plans that teachers can immediately use in their classrooms. Focus on activities and actions, not theory. Be creative and specific.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.8
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }

    const result = await response.json();
    const aiContent = result.data.choices[0].message.content;
    
    // Format the AI response into HTML with proper page breaks
    return formatLessonPlanHTML(aiContent, className, date, duration, topic);
    
  } catch (error) {
    console.error('AI Generation Error:', error);
    throw error;
  }
}

function formatLessonPlanHTML(aiContent, className, date, duration, topic) {
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
  };
  
  // Parse AI content and format with page breaks
  const lines = aiContent.split('\n');
  let formattedContent = '';
  let inSection = false;
  let sectionCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line) continue;
    
    // Check if this is a section header
    if (line.match(/^(Warm-up|Intro|Main|Practice|Wrap-up)/i)) {
      if (sectionCount > 0) {
        formattedContent += '</ul></div>\n';
      }
      const pageBreakClass = sectionCount > 0 ? 'page-break' : '';
      formattedContent += `<div class="${pageBreakClass}"><h2>${line}</h2>\n<ul>\n`;
      inSection = true;
      sectionCount++;
    } else if (line.startsWith('•') || line.startsWith('-')) {
      // Format bullet points
      line = line.replace(/^[•-]\s*/, '');
      if (line.startsWith('T:') || line.startsWith('Ss:')) {
        formattedContent += `<li><strong>${line}</strong></li>\n`;
      } else {
        formattedContent += `<li>${line}</li>\n`;
      }
    } else if (line.includes(':') && !line.startsWith('Class:') && !line.startsWith('Date:')) {
      // Other content
      if (inSection) {
        formattedContent += `<li>${line}</li>\n`;
      }
    }
  }
  
  if (inSection) {
    formattedContent += '</ul></div>\n';
  }
  
  return `
    <h1>Lesson Plan: ${topic}</h1>
    <div class="header-info">
      <strong>Class:</strong> ${className || 'Class Name'} &nbsp;&nbsp;&nbsp; 
      <strong>Date:</strong> ${formatDate(date)} &nbsp;&nbsp;&nbsp; 
      <strong>Duration:</strong> ${duration} minutes
    </div>
    
    ${formattedContent}
  `;
}
