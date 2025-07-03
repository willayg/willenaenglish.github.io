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
    const fontPicker = document.getElementById('fontPicker');
    const generateGameBtn = document.getElementById('generateGameBtn');
    const saveSetupBtn = document.getElementById('saveSetupBtn');
    const loadSetupBtn = document.getElementById('loadSetupBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');
    const gamePreviewArea = document.getElementById('gamePreviewArea');

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

        try {
            const baseUrl = getBaseUrl();
            const requiredCount = gridSize === '3x3' ? 9 : 16;
            
            // Fixed: Using the correct format for YOUR OpenAI proxy
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
                                content: `From the following passage, extract exactly ${requiredCount} vocabulary words and create ${requiredCount} simple questions about the passage. 

Format your response exactly like this:

WORDS:
word1
word2
word3

QUESTIONS:
What is word1?
What does word2 mean?
Where is word3?

Passage: ${passage}`
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
            console.log('OpenAI Response:', result);
            
            // Extract from the nested response structure
            const aiText = result.data?.choices?.[0]?.message?.content || 
                          result.choices?.[0]?.message?.content || 
                          result.data?.content || 
                          result.content;

            if (!aiText) {
                console.error('No AI text found in response:', result);
                throw new Error('No content received from AI service');
            }

            console.log('AI Text:', aiText);

            // Parse AI response with better regex
            const wordMatch = aiText.match(/WORDS:\s*([\s\S]*?)(?=QUESTIONS:|$)/i);
            const questionMatch = aiText.match(/QUESTIONS:\s*([\s\S]*?)$/i);

            if (wordMatch && questionMatch) {
                const words = wordMatch[1].trim().split('\n')
                    .map(w => w.replace(/^\d+\.?\s*/, '').trim())
                    .filter(w => w && w.length > 0)
                    .slice(0, requiredCount);
                
                const questions = questionMatch[1].trim().split('\n')
                    .map(q => q.replace(/^\d+\.?\s*/, '').trim())
                    .filter(q => q && q.length > 0)
                    .slice(0, requiredCount);

                vocabInput.value = words.join('\n');
                questionsInput.value = questions.join('\n');
                
                alert(`Successfully extracted ${words.length} words and ${questions.length} questions!`);
            } else {
                // Fallback parsing
                console.log('Fallback parsing for:', aiText);
                const lines = aiText.split('\n').map(l => l.trim()).filter(l => l);
                const midpoint = Math.ceil(lines.length / 2);
                const words = lines.slice(0, midpoint).slice(0, requiredCount);
                const questions = lines.slice(midpoint).slice(0, requiredCount);
                
                if (words.length > 0) {
                    vocabInput.value = words.join('\n');
                    questionsInput.value = questions.length > 0 ? questions.join('\n') : words.map(w => `What is ${w}?`).join('\n');
                    alert('Extracted content (auto-formatted)');
                } else {
                    throw new Error('Could not parse AI response');
                }
            }

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
            <div style="text-align: center; margin-bottom: 20px;">
                <h3>Grid Game - ${gridSize.toUpperCase()}</h3>
                <p style="font-size: 0.9rem; color: #666; margin: 10px 0;">
                    Click squares to reveal questions • Right-click to assign team colors
                </p>
                <button id="fullscreenBtn" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Enter Fullscreen
                </button>
                <button id="resetGridBtn" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px;">
                    Reset Grid
                </button>
            </div>
            <div id="gameGrid" class="game-grid ${gridSize === '3x3' ? 'grid-3x3' : 'grid-4x4'}" style="background-color: ${gridColorPicker.value}; font-family: ${fontPicker.value};">
            </div>
        `;

        gamePreviewArea.innerHTML = '';
        gamePreviewArea.appendChild(gridContainer);

        const gameGrid = document.getElementById('gameGrid');
        
        // Create grid squares
        currentWords.forEach((word, index) => {
            const square = document.createElement('div');
            square.className = 'grid-square showing-word';
            square.textContent = word;
            square.style.fontFamily = fontPicker.value;
            
            let isShowingWord = true;
            let teamColor = null;

            // Left click - toggle word/question
            square.addEventListener('click', function() {
                if (teamColor) return; // Don't toggle if team color is assigned
                
                isShowingWord = !isShowingWord;
                square.textContent = isShowingWord ? word : currentQuestions[index];
                square.className = `grid-square ${isShowingWord ? 'showing-word' : 'showing-question'}`;
            });

            // Right click - assign team color
            square.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                
                if (currentTeams.length === 0) {
                    alert('Please add teams first to assign colors.');
                    return;
                }

                // Create team selection menu
                showTeamSelectionMenu(e.clientX, e.clientY, function(selectedTeam) {
                    if (selectedTeam === 'reset') {
                        // Reset to original state
                        teamColor = null;
                        square.style.backgroundColor = 'white';
                        square.style.color = 'inherit';
                        square.className = 'grid-square showing-word';
                        square.textContent = word;
                        isShowingWord = true;
                    } else {
                        // Assign team color
                        teamColor = selectedTeam.color;
                        square.style.backgroundColor = selectedTeam.color;
                        square.style.color = 'white';
                        square.className = 'grid-square team-color';
                        square.textContent = selectedTeam.name;
                    }
                });
            });

            gameGrid.appendChild(square);
        });

        // Add fullscreen functionality
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
        
        // Hide original content
        document.querySelector('.container').style.display = 'none';
        
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

    // Save and load functionality
    async function saveSetup() {
        const title = prompt('Enter a name for this grid setup:');
        if (!title) return;

        const setupData = {
            title: title,
            type: 'grid_game',
            gridSize: gridSize,
            words: currentWords,
            questions: currentQuestions,
            teams: currentTeams,
            gridColor: gridColorPicker.value,
            font: fontPicker.value
        };

        try {
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/.netlify/functions/supabase_proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save_worksheet',
                    title: title,
                    type: 'grid_game',
                    content: setupData
                })
            });

            if (response.ok) {
                alert('Grid setup saved successfully!');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save grid setup. Saving to local storage instead.');
            
            // Fallback to localStorage
            localStorage.setItem(`grid_game_${title}`, JSON.stringify(setupData));
            alert('Grid setup saved to local storage!');
        }
    }

    async function loadSetup() {
        try {
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/.netlify/functions/supabase_proxy?action=list_worksheets&type=grid_game`);
            
            let setups = [];
            
            if (response.ok) {
                const data = await response.json();
                setups = data.worksheets || [];
            }

            // Also check localStorage
            const localSetups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('grid_game_')) {
                    const setupData = JSON.parse(localStorage.getItem(key));
                    localSetups.push({
                        title: key.replace('grid_game_', ''),
                        content: setupData,
                        source: 'local'
                    });
                }
            }

            setups = [...setups, ...localSetups];

            if (setups.length === 0) {
                alert('No saved grid setups found.');
                return;
            }

            // Create selection dialog
            const setupNames = setups.map(s => `${s.title} ${s.source ? '(local)' : ''}`);
            const selectedTitle = prompt(`Select a setup to load:\n${setupNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\nEnter the number:`);
            
            if (!selectedTitle) return;
            
            const setupIndex = parseInt(selectedTitle) - 1;
            if (setupIndex < 0 || setupIndex >= setups.length) {
                alert('Invalid selection');
                return;
            }

            const selectedSetup = setups[setupIndex];
            const content = selectedSetup.content;

            // Load the setup
            gridSize = content.gridSize || '3x3';
            currentWords = content.words || [];
            currentQuestions = content.questions || [];
            currentTeams = content.teams || [];

            gridSizeSelect.value = gridSize;
            vocabInput.value = currentWords.join('\n');
            questionsInput.value = currentQuestions.join('\n');
            gridColorPicker.value = content.gridColor || '#f0f0f0';
            fontPicker.value = content.font || 'Arial';

            updateTeamList();
            alert('Grid setup loaded successfully!');

        } catch (error) {
            console.error('Load error:', error);
            alert('Failed to load grid setups');
        }
    }

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
    generateGameBtn.addEventListener('click', generateGame);
    saveSetupBtn.addEventListener('click', saveSetup);
    loadSetupBtn.addEventListener('click', loadSetup);
    resetGameBtn.addEventListener('click', resetSetup);

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
