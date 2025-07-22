document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentWords = [];
    let currentQuestions = [];
    let currentTeams = [];
    let gridSize = '3x3';
    let gameGenerated = false;

    // DOM elements
    const gridSizeSelect = document.getElementById('gridSize');
    const passageInput = document.getElementById('passageInput');
    const extractBtn = document.getElementById('extractBtn');
    const vocabInput = document.getElementById('vocabInput');
    const questionsInput = document.getElementById('questionsInput');
    const teamNameInput = document.getElementById('teamNameInput');
    const teamColorInput = document.getElementById('teamColorInput');
    const addTeamBtn = document.getElementById('addTeamBtn');
    const teamList = document.getElementById('teamList');
    const gridColorPicker = document.getElementById('gridColorPicker');
    // Use fontSelect from toolbar as fontPicker
    const fontPicker = document.getElementById('fontSelect');
    const generateGameBtn = document.getElementById('generateGameBtn');
    // Get button elements - both top buttons and setup buttons
    const saveSetupBtn = document.getElementById('saveSetupBtn');
    const loadSetupBtn = document.getElementById('loadSetupBtn');
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');
    const gamePreviewArea = document.getElementById('gamePreviewArea');
    
    // AI button elements
    const aiGridInput = document.getElementById('aiGridInput');
    const extractFromPassageBtn = document.getElementById('extractFromPassageBtn');
    const generateFromPromptBtn = document.getElementById('generateFromPromptBtn');

    // Add Refresh Page button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh Page';
    refreshBtn.style = 'padding: 10px 16px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 10px;';
    refreshBtn.addEventListener('click', function() {
        window.location.reload();
    });
    // Insert the button at the top of the left setup panel
    const setupPanel = document.querySelector('.container .setup-panel, .setup-panel, #setupPanel, .grid-setup, .grid-setup-panel');
    if (setupPanel) {
        setupPanel.insertBefore(refreshBtn, setupPanel.firstChild);
    } else {
        // fallback: add to body if setup panel not found
        document.body.insertBefore(refreshBtn, document.body.firstChild);
    }

    // Utility functions
    function getBaseUrl() {
        return window.location.origin;
    }

    function showLoading(button) {
        const buttonText = button.querySelector('.button-text');
        const loadingSpinner = button.querySelector('.loading-spinner');
        if (buttonText) buttonText.textContent = 'Processing...';
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');
        button.disabled = true;
    }

    function hideLoading(button, originalText) {
        const buttonText = button.querySelector('.button-text');
        const loadingSpinner = button.querySelector('.loading-spinner');
        if (buttonText) buttonText.textContent = originalText;
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        button.disabled = false;
    }

    // AI Extraction - FIXED for your OpenAI proxy format
    async function extractWordsAndQuestions() {
        const passage = passageInput.value.trim();
        if (!passage) {
            alert('Please enter a reading passage first.');
            return;
        }

        showLoading(extractBtn);

        async function fetchAndParseAI(retryNum = 0) {
            const baseUrl = getBaseUrl();
            const requiredCount = gridSize === '3x3' ? 9 : 16;
            // Use a stricter prompt for the AI
            const prompt = `From the following passage, extract exactly ${requiredCount} vocabulary words and create exactly ${requiredCount} simple questions about the passage.\n\nFormat your response exactly like this (no extra text):\n\nWORDS:\nword1\nword2\n...\n\nQUESTIONS:\nWhat is word1?\nWhat does word2 mean?\n...\n\nIf you cannot find enough, repeat or invent simple words/questions to reach exactly ${requiredCount}.\n\nPassage: ${passage}`;
            const response = await fetch(`${baseUrl}/.netlify/functions/openai_proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    endpoint: 'chat/completions',
                    payload: {
                        model: "gpt-3.5-turbo",
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        max_tokens: 800,
                        temperature: 0.7
                    }
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI API Error:', response.status, errorText);
                throw new Error(`AI service failed: ${response.status}`);
            }
            const result = await response.json();
            // Extract from the nested response structure
            const aiText = result.data?.choices?.[0]?.message?.content || 
                          result.choices?.[0]?.message?.content || 
                          result.data?.content || 
                          result.content;
            let words = [];
            let questions = [];
            if (aiText) {
                // Parse AI response
                const wordMatch = aiText.match(/WORDS:\s*([\s\S]*?)(?=QUESTIONS:|$)/i);
                const questionMatch = aiText.match(/QUESTIONS:\s*([\s\S]*?)$/i);
                if (wordMatch && questionMatch) {
                    words = wordMatch[1].trim().split('\n')
                        .map(w => w.replace(/^\d+\.?\s*/, '').trim())
                        .filter(w => w && w.length > 0);
                    questions = questionMatch[1].trim().split('\n')
                        .map(q => q.replace(/^\d+\.?\s*/, '').trim())
                        .filter(q => q && q.length > 0);
                } else {
                    // Fallback parsing
                    const lines = aiText.split('\n').map(l => l.trim()).filter(l => l);
                    const midpoint = Math.ceil(lines.length / 2);
                    words = lines.slice(0, midpoint);
                    questions = lines.slice(midpoint);
                }
            }
            // If not enough, retry up to 2 more times (only if AI gave us something)
            if ((words.length < requiredCount || questions.length < requiredCount) && retryNum < 2 && aiText) {
                console.warn(`AI returned only ${words.length} words and ${questions.length} questions. Retrying... (Attempt ${retryNum + 2}/3)`);
                return await fetchAndParseAI(retryNum + 1);
            }
            // Always fill to requiredCount, even if arrays are empty
            for (let i = words.length; i < requiredCount; i++) {
                words.push(`Word${i + 1}`);
            }
            for (let i = questions.length; i < requiredCount; i++) {
                questions.push(`What is ${words[i]}?`);
            }
            // Truncate if too many
            words = words.slice(0, requiredCount);
            questions = questions.slice(0, requiredCount);
            // Extra: If in 4x4 mode, force 16 items
            if (gridSize === '4x4') {
                words = words.slice(0, 16);
                questions = questions.slice(0, 16);
            }
            vocabInput.value = words.join('\n');
            questionsInput.value = questions.join('\n');
            alert(`Successfully extracted ${words.length} words and ${questions.length} questions!`);
        }
        try {
            await fetchAndParseAI();
        } catch (error) {
            console.error('AI extraction error:', error);
            alert(`Failed to extract words and questions: ${error.message}`);
        } finally {
            hideLoading(extractBtn, 'Extract Words and Questions with AI');
        }
    }

    // Team management
    function addTeam() {
        const teamName = teamNameInput.value.trim();
        const teamColor = teamColorInput.value;

        if (!teamName) {
            alert('Please enter a team name.');
            return;
        }

        // Check if team already exists
        if (currentTeams.find(t => t.name === teamName)) {
            alert('Team name already exists.');
            return;
        }

        const team = { name: teamName, color: teamColor };
        currentTeams.push(team);

        // Clear inputs
        teamNameInput.value = '';
        teamColorInput.value = '#ff0000';

        updateTeamList();
    }

    function removeTeam(teamName) {
        currentTeams = currentTeams.filter(t => t.name !== teamName);
        updateTeamList();
    }

    function updateTeamList() {
        teamList.innerHTML = '';
        currentTeams.forEach(team => {
            const teamItem = document.createElement('div');
            teamItem.className = 'team-item';
            teamItem.innerHTML = `
                <div class="team-color-indicator" style="background-color: ${team.color};"></div>
                <span>${team.name}</span>
                <button onclick="removeTeam('${team.name}')" style="margin-left: auto; background: none; border: none; color: #dc2626; cursor: pointer;">×</button>
            `;
            teamList.appendChild(teamItem);
        });
    }

    // Make removeTeam globally accessible
    window.removeTeam = removeTeam;

    // Generate game
    function generateGame() {
        const words = vocabInput.value.trim().split('\n').map(w => w.trim()).filter(w => w);
        const questions = questionsInput.value.trim().split('\n').map(q => q.trim()).filter(q => q);
        
        const requiredCount = gridSize === '3x3' ? 9 : 16;
        
        if (words.length < requiredCount || questions.length < requiredCount) {
            alert(`Please enter at least ${requiredCount} words and ${requiredCount} questions for a ${gridSize} grid.`);
            return;
        }

        currentWords = words.slice(0, requiredCount);
        currentQuestions = questions.slice(0, requiredCount);

        generateGrid();
    }

    function generateGrid() {
        const gridContainer = document.createElement('div');
        gridContainer.innerHTML = `
            <div style="display: flex; gap: 20px; align-items: flex-start;">
                <div style="flex-shrink: 0; min-width: 200px;">
                    <p style="font-size: 0.9rem; color: #666; margin: 0 0 15px 0; line-height: 1.4;">
                        Click squares to reveal questions<br>
                        Right-click to assign team colors
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button id="fullscreenBtn" style="padding: 10px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            Enter Fullscreen
                        </button>
                        <button id="resetGridBtn" style="padding: 10px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            Reset Grid
                        </button>
                    </div>
                </div>
                <div id="gameGrid" class="game-grid ${gridSize === '3x3' ? 'grid-3x3' : 'grid-4x4'}" style="background-color: ${gridColorPicker ? gridColorPicker.value : '#f0f0f0'}; font-family: ${fontPicker ? fontPicker.value : 'Poppins'};">
                </div>
            </div>
        `;

        gamePreviewArea.innerHTML = '';
        gamePreviewArea.appendChild(gridContainer);

        const gameGrid = document.getElementById('gameGrid');
        
        // Card layout option
        const cardLayoutPicker = document.getElementById('cardLayoutPicker');
        const cardLayout = cardLayoutPicker ? cardLayoutPicker.value : 'word-top';

        // Use default colors for question/answer
        const questionColor = '#fff3e0';
        const answerColor = '#e3f2fd';

        // Create grid squares
        currentWords.forEach((word, index) => {
            const square = document.createElement('div');
            square.className = 'grid-square showing-word';
            square.style.fontFamily = fontPicker.value;

            // Card content
            let topText, bottomText;
            if (cardLayout === 'word-top') {
                topText = word;
                bottomText = currentQuestions[index];
            } else {
                topText = currentQuestions[index];
                bottomText = word;
            }

            // Initial state: show top
            let isShowingTop = true;
            let teamColor = null;

            // Render function
            function renderCard() {
                square.innerHTML = `<div style="font-size:1.1em;font-weight:600;">${isShowingTop ? topText : bottomText}</div>`;
                square.className = `grid-square ${isShowingTop ? 'showing-word' : 'showing-question'}`;
                if (teamColor) {
                    square.style.backgroundColor = teamColor;
                    square.style.color = 'white';
                } else {
                    if (isShowingTop) {
                        square.style.backgroundColor = answerColor;
                        square.style.color = '';
                    } else {
                        square.style.backgroundColor = questionColor;
                        square.style.color = '';
                    }
                }
            }
            renderCard();

            // Left click - toggle top/bottom
            square.addEventListener('click', function() {
                if (teamColor) return; // Don't toggle if team color is assigned
                isShowingTop = !isShowingTop;
                renderCard();
            });

            // Right click - assign team color
            square.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                if (currentTeams.length === 0) {
                    alert('Please add teams first to assign colors.');
                    return;
                }
                // Cycle through teams on each right-click
                let currentIndex = -1;
                if (teamColor) {
                    currentIndex = currentTeams.findIndex(t => t.color === teamColor);
                }
                let nextIndex = currentIndex + 1;
                if (nextIndex >= currentTeams.length) {
                    // Reset (no team)
                    teamColor = null;
                    isShowingTop = true;
                    renderCard();
                } else {
                    // Assign next team
                    const nextTeam = currentTeams[nextIndex];
                    teamColor = nextTeam.color;
                    renderCard();
                    square.className = 'grid-square team-color';
                    square.innerHTML = `<div style="font-size:1.1em;font-weight:600;">${nextTeam.name}</div>`;
                }
            });

            gameGrid.appendChild(square);
        });

        // Add fullscreen functionality
        document.getElementById('fullscreenBtn').classList.add('toolbar-action-btn');
        document.getElementById('resetGridBtn').classList.add('toolbar-action-btn');
        document.getElementById('fullscreenBtn').addEventListener('click', enterFullscreen);
        document.getElementById('resetGridBtn').addEventListener('click', resetGrid);

        gameGenerated = true;
    }

    function showTeamSelectionMenu(x, y, callback) {
        // Remove existing menu
        const existingMenu = document.getElementById('teamSelectionMenu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'teamSelectionMenu';
        menu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10001;
            padding: 8px;
            min-width: 120px;
        `;

        // Add team options
        currentTeams.forEach(team => {
            const option = document.createElement('div');
            option.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            option.innerHTML = `
                <div style="width: 16px; height: 16px; background-color: ${team.color}; border-radius: 3px;"></div>
                <span>${team.name}</span>
            `;
            option.addEventListener('click', () => {
                callback(team);
                menu.remove();
            });
            option.addEventListener('mouseenter', () => option.style.backgroundColor = '#f3f4f6');
            option.addEventListener('mouseleave', () => option.style.backgroundColor = 'transparent');
            menu.appendChild(option);
        });

        // Add reset option
        const resetOption = document.createElement('div');
        resetOption.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            border-top: 1px solid #e5e7eb;
            margin-top: 4px;
            color: #dc2626;
        `;
        resetOption.textContent = 'Reset';
        resetOption.addEventListener('click', () => {
            callback('reset');
            menu.remove();
        });
        resetOption.addEventListener('mouseenter', () => resetOption.style.backgroundColor = '#fef2f2');
        resetOption.addEventListener('mouseleave', () => resetOption.style.backgroundColor = 'transparent');
        menu.appendChild(resetOption);

        document.body.appendChild(menu);

        // Remove menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 0);
    }

    function enterFullscreen() {
        const gameGrid = document.getElementById('gameGrid');
        
        // Create massive fullscreen container
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.className = 'fullscreen-container';
        fullscreenContainer.id = 'fullscreenContainer';

        // Clone and append the grid
        const clonedGrid = gameGrid.cloneNode(true);
        clonedGrid.id = 'fullscreenGrid';
        clonedGrid.style.boxShadow = 'none'; // Remove drop shadow
        
        // Copy all event listeners to cloned squares
        const originalSquares = gameGrid.querySelectorAll('.grid-square');
        const clonedSquares = clonedGrid.querySelectorAll('.grid-square');
        
        originalSquares.forEach((originalSquare, index) => {
            const clonedSquare = clonedSquares[index];
            if (clonedSquare) {
                // Copy current state
                clonedSquare.className = originalSquare.className;
                clonedSquare.textContent = originalSquare.textContent;
                clonedSquare.style.backgroundColor = originalSquare.style.backgroundColor;
                clonedSquare.style.color = originalSquare.style.color;
                
                // Add click events
                clonedSquare.addEventListener('click', function() {
                    originalSquare.click();
                    // Sync back the changes
                    clonedSquare.className = originalSquare.className;
                    clonedSquare.textContent = originalSquare.textContent;
                    clonedSquare.style.backgroundColor = originalSquare.style.backgroundColor;
                    clonedSquare.style.color = originalSquare.style.color;
                });
                
                clonedSquare.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    // Trigger original right-click
                    const rightClickEvent = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    originalSquare.dispatchEvent(rightClickEvent);
                    
                    // Sync back the changes after a delay
                    setTimeout(() => {
                        clonedSquare.className = originalSquare.className;
                        clonedSquare.textContent = originalSquare.textContent;
                        clonedSquare.style.backgroundColor = originalSquare.style.backgroundColor;
                        clonedSquare.style.color = originalSquare.style.color;
                    }, 100);
                });
            }
        });
        
        fullscreenContainer.appendChild(clonedGrid);
        document.body.appendChild(fullscreenContainer);

        // Apply selected font and scaled font size to fullscreen grid squares
        const font = fontPicker ? fontPicker.value : 'Poppins';
        // Get preview font size (default 16)
        let previewFontSize = 16;
        const previewSquare = document.querySelector('.game-grid .grid-square');
        if (previewSquare) {
            const computed = window.getComputedStyle(previewSquare);
            previewFontSize = parseFloat(computed.fontSize) || 16;
        }
        const fullscreenFontSize = Math.round(previewFontSize * 1.7);
        clonedGrid.querySelectorAll('.grid-square').forEach(el => {
            el.style.fontFamily = font + ',sans-serif';
            el.style.fontSize = fullscreenFontSize + 'px';
        });

        // Hide original content
        document.querySelector('.container').style.display = 'none';

        // Helper to update fullscreen font size if preview font changes while fullscreen is open
        function updateFullscreenFont() {
            const fullscreenGrid = document.getElementById('fullscreenGrid');
            if (fullscreenGrid) {
                let previewFontSize = 16;
                const previewSquare = document.querySelector('.game-grid .grid-square');
                if (previewSquare) {
                    const computed = window.getComputedStyle(previewSquare);
                    previewFontSize = parseFloat(computed.fontSize) || 16;
                }
                const fullscreenFontSize = Math.round(previewFontSize * 1.7);
                fullscreenGrid.querySelectorAll('.grid-square').forEach(el => {
                    el.style.fontFamily = fontPicker.value + ',sans-serif';
                    el.style.fontSize = fullscreenFontSize + 'px';
                });
            }
        }
        // Listen for font or font size changes
        if (fontPicker) {
            fontPicker.addEventListener('change', updateFullscreenFont);
        }
        const qFontInput = document.getElementById('qFontSizeInput');
        const aFontInput = document.getElementById('aFontSizeInput');
        if (qFontInput) qFontInput.addEventListener('input', updateFullscreenFont);
        if (aFontInput) aFontInput.addEventListener('input', updateFullscreenFont);

        // Request fullscreen
        if (fullscreenContainer.requestFullscreen) {
            fullscreenContainer.requestFullscreen();
        } else if (fullscreenContainer.webkitRequestFullscreen) {
            fullscreenContainer.webkitRequestFullscreen();
        } else if (fullscreenContainer.msRequestFullscreen) {
            fullscreenContainer.msRequestFullscreen();
        } else if (fullscreenContainer.mozRequestFullScreen) {
            fullscreenContainer.mozRequestFullScreen();
        }

        // Listen for ESC key to exit fullscreen
        document.addEventListener('keydown', handleEscapeKey);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    // Update fullscreen font if fontPicker changes while fullscreen is open
    if (fontPicker) {
        fontPicker.addEventListener('change', function() {
            const fullscreenGrid = document.getElementById('fullscreenGrid');
            if (fullscreenGrid) {
                fullscreenGrid.querySelectorAll('.grid-square').forEach(el => {
                    el.style.fontFamily = fontPicker.value + ',sans-serif';
                });
            }
        });
    }
    }
    
    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            exitFullscreen();
        }
    }
    
    function handleFullscreenChange() {
        // If user exits fullscreen with ESC or F11, clean up our custom fullscreen
        if (!document.fullscreenElement && !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && !document.msFullscreenElement) {
            const fullscreenContainer = document.getElementById('fullscreenContainer');
            if (fullscreenContainer) {
                exitFullscreen();
            }
        }
    }
    
    function exitFullscreen() {
        // Remove event listeners
        document.removeEventListener('keydown', handleEscapeKey);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // Exit browser fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        const fullscreenContainer = document.getElementById('fullscreenContainer');
        if (fullscreenContainer) {
            // Show original content
            document.querySelector('.container').style.display = 'block';
            
            // Remove fullscreen container
            fullscreenContainer.remove();
        }
    }

    function resetGrid() {
        if (confirm('Are you sure you want to reset the grid? All team assignments will be lost.')) {
            generateGrid();
        }
    }

    // Save and load functionality - Updated to match wordtest pattern
    function saveSetup() {
        try {
            console.log('Save button clicked - opening worksheet manager');
            // Open worksheet manager for saving
            window.open('../../worksheet_manager.html?mode=save', 'WorksheetManager', 'width=1200,height=550');
        } catch (error) {
            console.error('Error in saveSetup:', error);
            alert('Error opening save dialog: ' + error.message);
        }
    }

    function loadSetup() {
        try {
            console.log('Load button clicked - opening worksheet manager');
            // Open worksheet manager for loading
            window.open('../../worksheet_manager.html?mode=load', 'WorksheetManager', 'width=1200,height=550');
        } catch (error) {
            console.error('Error in loadSetup:', error);
            alert('Error opening load dialog: ' + error.message);
        }
    }

    // Function to get current grid game data for saving
    window.getCurrentWorksheetData = function() {
        try {
            console.log('getCurrentWorksheetData called');
            console.log('Current words:', currentWords);
            console.log('Current questions:', currentQuestions);
            console.log('Current teams:', currentTeams);
            
            const passageElement = document.getElementById('passageInput');
            const vocabElement = document.getElementById('vocabInput');
            const questionsElement = document.getElementById('questionsInput');
            
            const data = {
                worksheet_type: 'grid_game',
                title: '', // Will be filled by worksheet manager
                passage_text: passageElement ? passageElement.value || '' : '',
                words: currentWords || [],
                layout: 'grid_game',
                settings: {
                    gridSize: gridSize || '3x3',
                    questions: currentQuestions || [],
                    teams: currentTeams || [],
                    gridColor: gridColorPicker ? gridColorPicker.value : '#ffffff',
                    font: fontPicker ? fontPicker.value : 'Arial',
                    vocabInput: vocabElement ? vocabElement.value || '' : '',
                    questionsInput: questionsElement ? questionsElement.value || '' : ''
                },
                notes: `Grid Game - ${gridSize || '3x3'} with ${(currentWords || []).length} words and ${(currentQuestions || []).length} questions`
            };
            
            console.log('Returning worksheet data:', data);
            return data;
        } catch (error) {
            console.error('Error in getCurrentWorksheetData:', error);
            alert('Error getting worksheet data: ' + error.message);
            return null;
        }
    };

    // Function to load worksheet data
    window.loadWorksheetData = function(worksheetData) {
        try {
            console.log('Loading worksheet data:', worksheetData);
            
            // Load basic data with null checks
            if (worksheetData.passage_text) {
                const passageInput = document.getElementById('passageInput');
                if (passageInput) {
                    passageInput.value = worksheetData.passage_text;
                } else {
                    console.warn('passageInput element not found');
                }
            }
            
            if (worksheetData.words && Array.isArray(worksheetData.words)) {
                currentWords = worksheetData.words;
                console.log('Loaded words:', currentWords);
            }

            // Load settings
            if (worksheetData.settings) {
                const settings = worksheetData.settings;
                console.log('Loading settings:', settings);
                
                // Grid size
                if (settings.gridSize) {
                    gridSize = settings.gridSize;
                    const gridSizeElement = document.getElementById('gridSize');
                    if (gridSizeElement) {
                        gridSizeElement.value = gridSize;
                    } else {
                        console.warn('gridSize element not found');
                    }
                }

                // Questions
                if (settings.questions && Array.isArray(settings.questions)) {
                    currentQuestions = settings.questions;
                    console.log('Loaded questions:', currentQuestions);
                }

                // Teams
                if (settings.teams && Array.isArray(settings.teams)) {
                    currentTeams = settings.teams;
                    updateTeamList();
                }

                // Grid color
                if (settings.gridColor && gridColorPicker) {
                    gridColorPicker.value = settings.gridColor;
                } else if (settings.gridColor) {
                    console.warn('gridColorPicker element not found');
                }

                // Font
                if (settings.font && fontPicker) {
                    fontPicker.value = settings.font;
                } else if (settings.font) {
                    console.warn('fontPicker element not found');
                }

                // Input fields
                if (settings.vocabInput) {
                    const vocabInput = document.getElementById('vocabInput');
                    if (vocabInput) {
                        vocabInput.value = settings.vocabInput;
                    } else {
                        console.warn('vocabInput element not found');
                    }
                }

                if (settings.questionsInput) {
                    const questionsInput = document.getElementById('questionsInput');
                    if (questionsInput) {
                        questionsInput.value = settings.questionsInput;
                    } else {
                        console.warn('questionsInput element not found');
                    }
                }
            }

            // Update the word and question lists in UI with null checks
            const vocabInputElement = document.getElementById('vocabInput');
            const questionsInputElement = document.getElementById('questionsInput');
            
            if (vocabInputElement) {
                vocabInputElement.value = currentWords.join('\n');
            } else {
                console.warn('vocabInput element not found for updating UI');
            }
            
            if (questionsInputElement) {
                questionsInputElement.value = currentQuestions.join('\n');
            } else {
                console.warn('questionsInput element not found for updating UI');
            }

            // Ensure we have enough questions for the words
            if (currentQuestions.length < currentWords.length) {
                console.log('Generating default questions for missing words');
                while (currentQuestions.length < currentWords.length) {
                    currentQuestions.push(`What does "${currentWords[currentQuestions.length]}" mean?`);
                }
            }

            // Update UI
            console.log('About to generate grid. Words count:', currentWords.length);
            if (currentWords.length > 0) {
                generateGrid();
                console.log('Grid generated successfully');
            } else {
                console.log('No words to generate grid');
            }
            alert('Grid game loaded successfully!');
            
        } catch (error) {
            console.error('Error loading worksheet data:', error);
            alert('Error loading grid game data: ' + error.message);
        }
    };

    // Function that worksheet manager expects (following wordtest pattern)
    window.loadWorksheet = function(worksheet) {
        console.log('loadWorksheet called with:', worksheet);
        window.loadWorksheetData(worksheet);
    };

    // Message handler for worksheet manager communication
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'worksheet_loaded' && event.data.worksheet) {
            window.loadWorksheetData(event.data.worksheet);
        }
    });

    function resetSetup() {
        if (confirm('Are you sure you want to reset all settings and clear the game?')) {
            passageInput.value = '';
            vocabInput.value = '';
            questionsInput.value = '';
            currentTeams = [];
            updateTeamList();
            gridColorPicker.value = '#f0f0f0';
            fontPicker.value = 'Arial';
            gamePreviewArea.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🎯</div>
                    <h3>Ready to Create Your Grid Game</h3>
                    <p>Enter vocabulary words and questions, then click "Generate Game" to start playing.</p>
                    <p style="font-size: 0.9rem; margin-top: 16px; opacity: 0.7;">
                        <strong>How to play:</strong><br>
                        • Click squares to reveal questions<br>
                        • Right-click to assign team colors<br>
                        • Use fullscreen mode for classroom projection
                    </p>
                </div>
            `;
            gameGenerated = false;
        }
    }

    // Event listeners
    gridSizeSelect.addEventListener('change', function() {
        gridSize = this.value;
    });

    extractBtn.addEventListener('click', extractWordsAndQuestions);
    addTeamBtn.addEventListener('click', addTeam);
    
    // Debug Generate Game Button
    console.log('Generate Game Button:', generateGameBtn);
    if (generateGameBtn) {
        generateGameBtn.addEventListener('click', function() {
            console.log('Generate Game button clicked!');
            generateGame();
        });
        console.log('Generate Game event listener attached');
    } else {
        console.error('Generate Game button not found!');
    }
    
    // Event listeners for save/load buttons (both sets)
    if (saveSetupBtn) {
        saveSetupBtn.addEventListener('click', saveSetup);
        console.log('Save setup button event listener attached');
    } else {
        console.error('Save setup button not found!');
    }
    
    if (loadSetupBtn) {
        loadSetupBtn.addEventListener('click', loadSetup);
        console.log('Load setup button event listener attached');
    } else {
        console.error('Load setup button not found!');
    }

    // Also attach to top save/load buttons
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSetup);
        console.log('Top save button event listener attached');
    } else {
        console.error('Top save button not found!');
    }
    
    if (loadBtn) {
        loadBtn.addEventListener('click', loadSetup);
        console.log('Top load button event listener attached');
    } else {
        console.error('Top load button not found!');
    }
    
    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', resetSetup);
    } else {
        console.error('Reset button not found!');
    }

    // Allow Enter key to add team
    teamNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTeam();
        }
    });

    // Initialize with some sample data for testing
    vocabInput.value = 'Apple\nBanana\nCherry\nDate\nElephant\nFox\nGiraffe\nHorse\nIgloo';
    questionsInput.value = 'Red fruit\nYellow fruit\nSmall red\nSweet brown\nBig animal\nSmart animal\nTall animal\nFast runner\nCold house';
});
