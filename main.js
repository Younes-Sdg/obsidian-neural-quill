'use strict';

const obsidian = require('obsidian');

class LLMWritingPlugin extends obsidian.Plugin {
    async onload() {
        console.log('Loading LLM Writing Plugin');

        this.addRibbonIcon('bot', 'LLM Writing Assistant', (evt) => {
            this.activateSuggestionMode();
        });

        this.registerDomEvent(document, 'click', (evt) => {
            if (!evt.target.closest('.suggestion-bubble') && this.suggestionBubble) {
                this.suggestionBubble.remove();
                this.suggestionBubble = null;
            }
        });
    }

    onunload() {
        console.log('Unloading LLM Writing Plugin');
    }

    activateSuggestionMode() {
        const activeView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            this.createSuggestionBubble(editor);
        } else {
            new obsidian.Notice('Please open a markdown file first.');
        }
    }

    createSuggestionBubble(editor) {
        if (this.suggestionBubble) {
            this.suggestionBubble.remove();
        }

        const cursor = editor.getCursor();
        const cursorPos = editor.posToOffset(cursor);
        const editorRect = editor.getScrollInfo();

        this.suggestionBubble = document.createElement('div');
        this.suggestionBubble.addClass('suggestion-bubble');
        this.suggestionBubble.innerHTML = `
            <div class="context-selection">
                <label for="context-range">Context range:</label>
                <input type="range" id="context-range" min="50" max="500" value="200" step="50">
                <span id="context-value">200</span> characters
            </div>
            <textarea id="prompt-input" placeholder="Enter your prompt here..."></textarea>
            <button id="generate-btn">Generate Suggestion</button>
            <button id="regenerate-btn" style="display: none;">Regenerate</button>
            <div id="suggestion-output"></div>
        `;

        document.body.appendChild(this.suggestionBubble);

        const contextRange = this.suggestionBubble.querySelector('#context-range');
        const contextValue = this.suggestionBubble.querySelector('#context-value');
        const promptInput = this.suggestionBubble.querySelector('#prompt-input');
        const generateBtn = this.suggestionBubble.querySelector('#generate-btn');
        const regenerateBtn = this.suggestionBubble.querySelector('#regenerate-btn');
        const suggestionOutput = this.suggestionBubble.querySelector('#suggestion-output');

        contextRange.addEventListener('input', (e) => {
            contextValue.textContent = e.target.value;
        });

        generateBtn.addEventListener('click', () => this.generateSuggestion(editor, cursorPos, contextRange.value, promptInput.value, suggestionOutput, regenerateBtn));
        regenerateBtn.addEventListener('click', () => this.generateSuggestion(editor, cursorPos, contextRange.value, promptInput.value, suggestionOutput, regenerateBtn));

        // Position the bubble near the cursor
        const bubbleRect = this.suggestionBubble.getBoundingClientRect();
        this.suggestionBubble.style.top = `${cursor.line * editorRect.lineHeight + editorRect.top}px`;
        this.suggestionBubble.style.left = `${cursor.ch * 8 + editorRect.left}px`; // Approximate character width
    }

    async generateSuggestion(editor, cursorPos, contextLength, prompt, outputElement, regenerateBtn) {
        const context = editor.getValue().slice(Math.max(0, cursorPos - contextLength), cursorPos);
        
        try {
            const response = await fetch('http://localhost:5000/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ context, prompt }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const suggestion = data.generated_text;
            
            outputElement.innerHTML = `
                <p>${suggestion}</p>
                <button id="copy-btn">Copy</button>
            `;
            
            regenerateBtn.style.display = 'inline-block';
            
            outputElement.querySelector('#copy-btn').addEventListener('click', () => {
                editor.replaceRange(suggestion, editor.getCursor());
                new obsidian.Notice('Suggestion copied to editor!');
            });
        } catch (error) {
            console.error('Error getting suggestion:', error);
            new obsidian.Notice('Error getting suggestion. Please ensure the LLM backend is running.');
        }
    }
}

module.exports = LLMWritingPlugin;