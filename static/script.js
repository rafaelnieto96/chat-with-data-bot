document.addEventListener('DOMContentLoaded', function () {
    const questionInput = document.getElementById('question-input');
    const sendButton = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const fileButton = document.getElementById('file-btn');
    const fileInput = document.getElementById('pdf-file');
    const sidebarToggle = document.getElementById('toggle-sidebar');
    const showSidebarBtn = document.getElementById('show-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const chatMain = document.getElementById('chat-main');
    const sourcesContent = document.getElementById('sources-content');

    // Toggle sidebar functionality
    sidebarToggle.addEventListener('click', function () {
        sidebar.classList.toggle('collapsed');
        chatMain.classList.toggle('fullWidth');
        showSidebarBtn.style.display = sidebar.classList.contains('collapsed') ? 'flex' : 'none';
    });

    showSidebarBtn.addEventListener('click', function () {
        sidebar.classList.remove('collapsed');
        chatMain.classList.remove('fullWidth');
        showSidebarBtn.style.display = 'none';
    });

    // File upload logic
    fileButton.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', async function (e) {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            // Show processing message
            addAssistantMessage(`Processing ${file.name}...`);

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.error) {
                    addAssistantMessage(`Error: ${result.error}`);
                } else {
                    addAssistantMessage(`${file.name} has been processed. You can now ask questions about it.`);

                    // Enable the input and send button
                    questionInput.disabled = false;
                    sendButton.disabled = false;
                    questionInput.focus();

                    // Clear sources
                    clearSources();
                }
            } catch (error) {
                console.error('Error:', error);
                addAssistantMessage('Error uploading file. Please try again.');
            }
        }
    });

    // Question handling logic
    sendButton.addEventListener('click', sendQuestion);
    questionInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendQuestion();
        }
    });

    async function sendQuestion() {
        const question = questionInput.value.trim();
        if (question === '') return;

        // Add user message
        addUserMessage(question);

        // Clear input field
        questionInput.value = '';

        // Show typing indicator
        const typingIndicator = addAssistantTypingIndicator();

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: question })
            });

            const result = await response.json();

            // Remove typing indicator
            typingIndicator.remove();

            if (result.error) {
                addAssistantMessage(`Error: ${result.error}`);
            } else {
                // Add the answer
                addAssistantMessage(result.answer);

                // Update sources in sidebar
                updateSources(result.sources);
            }
        } catch (error) {
            console.error('Error:', error);
            // Remove typing indicator
            typingIndicator.remove();
            addAssistantMessage('Error processing your question. Please try again.');
        }
    }

    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message userMessage';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'messageIcon';
        iconDiv.innerHTML = '👤';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'messageContent';
        contentDiv.textContent = text;

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(iconDiv);

        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addAssistantMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistantMessage';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'messageIcon';
        iconDiv.innerHTML = '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'messageContent';
        contentDiv.innerHTML = text;

        messageDiv.appendChild(iconDiv);
        messageDiv.appendChild(contentDiv);

        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageDiv;
    }

    function addAssistantTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistantMessage';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'messageIcon';
        iconDiv.innerHTML = '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'messageContent processingContainer';

        const processingText = document.createElement('span');
        processingText.textContent = 'Thinking';

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';

        contentDiv.appendChild(processingText);
        contentDiv.appendChild(typingIndicator);

        messageDiv.appendChild(iconDiv);
        messageDiv.appendChild(contentDiv);

        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageDiv;
    }

    function updateSources(sources) {
        // Clear existing sources
        clearSources();

        if (!sources || sources.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.className = 'placeholder';
            placeholder.textContent = 'No relevant document fragments found.';
            sourcesContent.appendChild(placeholder);
            return;
        }

        // Add each source
        sources.forEach((source, index) => {
            const sourceDiv = document.createElement('div');
            sourceDiv.className = 'fragmentItem';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'fragmentContent';
            contentDiv.textContent = source.content;

            const toggleButton = document.createElement('span');
            toggleButton.className = 'fragmentToggle';
            toggleButton.textContent = 'Show more';
            toggleButton.dataset.expanded = 'false';
            toggleButton.dataset.fullContent = source.full_content;
            toggleButton.dataset.preview = source.content;

            toggleButton.addEventListener('click', function () {
                const isExpanded = this.dataset.expanded === 'true';
                if (isExpanded) {
                    // Collapse
                    contentDiv.textContent = this.dataset.preview;
                    contentDiv.classList.remove('expanded');
                    this.textContent = 'Show more';
                    this.dataset.expanded = 'false';
                } else {
                    // Expand
                    contentDiv.textContent = this.dataset.fullContent;
                    contentDiv.classList.add('expanded');
                    this.textContent = 'Show less';
                    this.dataset.expanded = 'true';
                }
            });

            sourceDiv.appendChild(contentDiv);
            sourceDiv.appendChild(toggleButton);

            sourcesContent.appendChild(sourceDiv);
        });
    }

    function clearSources() {
        while (sourcesContent.firstChild) {
            sourcesContent.removeChild(sourcesContent.firstChild);
        }
    }
}); 