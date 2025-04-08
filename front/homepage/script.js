document.addEventListener('DOMContentLoaded', function () {
    // File handling elements
    const pdfFile = document.getElementById('pdf-file');
    const fileBtn = document.getElementById('file-btn');
    const chatMessages = document.getElementById('chat-messages');
    const questionInput = document.getElementById('question-input');
    const sendBtn = document.getElementById('send-btn');
    const sourcesContent = document.getElementById('sources-content');

    // Sidebar elements
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const showSidebarBtn = document.getElementById('show-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const chatMain = document.getElementById('chat-main');

    // State variables
    let isFileUploaded = false;

    // Toggle sidebar visibility
    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        chatMain.classList.toggle('fullWidth');

        if (sidebar.classList.contains('collapsed')) {
            showSidebarBtn.style.display = 'flex';
            toggleSidebarBtn.style.display = 'none';
        } else {
            showSidebarBtn.style.display = 'none';
            toggleSidebarBtn.style.display = 'flex';
        }
    }

    // Sidebar event listeners
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    showSidebarBtn.addEventListener('click', toggleSidebar);

    // Create fragment items with expand/collapse functionality
    function createFragmentItem(source, index) {
        const fragmentDiv = document.createElement('div');
        fragmentDiv.className = 'fragmentItem';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'fragmentContent';
        contentDiv.id = `fragment-${index}`;

        const fullContent = source.full_content || source;
        const truncatedContent = source.content || source;

        fragmentDiv.dataset.fullContent = fullContent;
        fragmentDiv.dataset.truncatedContent = truncatedContent;

        contentDiv.textContent = truncatedContent;

        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'fragmentToggle';
        toggleBtn.textContent = 'Show more';

        fragmentDiv.appendChild(contentDiv);
        fragmentDiv.appendChild(toggleBtn);

        sourcesContent.appendChild(fragmentDiv);

        toggleBtn.addEventListener('click', function () {
            contentDiv.classList.toggle('expanded');

            if (contentDiv.classList.contains('expanded')) {
                contentDiv.textContent = fragmentDiv.dataset.fullContent;
                this.textContent = 'Show less';
            } else {
                contentDiv.textContent = fragmentDiv.dataset.truncatedContent;
                this.textContent = 'Show more';
            }
        });
    }

    function updateFragments(sources) {
        if (sources && sources.length) {
            sourcesContent.innerHTML = '';
            sources.forEach((source, index) => {
                createFragmentItem(source, index);
            });

            // Ensure sidebar is visible
            if (sidebar.classList.contains('collapsed')) {
                toggleSidebar();
            }
        } else {
            sourcesContent.innerHTML = '<p class="placeholder">No fragments available for this query.</p>';
        }
    }

    // Handle file button click
    fileBtn.addEventListener('click', function () {
        pdfFile.click();
    });

    // File upload handler
    pdfFile.addEventListener('change', function () {
        if (!pdfFile.files[0]) {
            return;
        }

        const file = pdfFile.files[0];

        // Validate file type
        const fileNameLower = file.name.toLowerCase();
        if (!fileNameLower.endsWith('.pdf') && !fileNameLower.endsWith('.docx')) {
            chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Please upload a PDF or Word (DOCX) file.</div>
                </div>
            `;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // Show processing message
        chatMessages.innerHTML += `
    <div class="message assistantMessage" id="processing-message">
        <div class="messageIcon">🤖</div>
        <div class="messageContent">
            <div class="processingContainer">
                <span>Processing ${file.name}</span>
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    </div>
`;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const formData = new FormData();
        formData.append('file', file);

        // Send file to server
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                document.getElementById('processing-message').remove();

                if (data.success) {
                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">I've processed your document "${data.filename}". You can now ask me questions about it!</div>
                    </div>
                `;
                    isFileUploaded = true;

                    // Enable chat
                    questionInput.disabled = false;
                    sendBtn.disabled = false;

                    sourcesContent.innerHTML = '<p class="placeholder">No queries yet...</p>';
                } else {
                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">Sorry, an error occurred while processing the file. Please try again later.</div>
                    </div>
                `;
                    console.error("Server error:", data.error);
                }

                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                document.getElementById('processing-message').remove();

                console.error("Error processing file:", error);

                chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Sorry, an error occurred while processing the file. Please try again later.</div>
                </div>
            `;

                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
    });

    // Send question to server
    function sendQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        if (!isFileUploaded) {
            chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Please upload a document first.</div>
                </div>
            `;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        questionInput.value = '';

        // Add user message
        chatMessages.innerHTML += `
            <div class="message userMessage">
                <div class="messageIcon">👤</div>
                <div class="messageContent">${question}</div>
            </div>
        `;

        // Show typing indicator
        chatMessages.innerHTML += `
            <div class="message assistantMessage" id="typing-message">
                <div class="messageIcon">🤖</div>
                <div class="messageContent">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;

        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Send question to server
        fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        })
            .then(response => response.json())
            .then(data => {
                document.getElementById('typing-message').remove();

                if (data.error) {
                    console.error("Server error:", data.error);

                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">Sorry, an error occurred while processing your question. Please try again.</div>
                    </div>
                    `;
                } else {
                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">${data.answer}</div>
                    </div>
                    `;

                    // Update fragments in sidebar
                    if (data.sources && data.sources.length) {
                        updateFragments(data.sources);
                    }
                }

                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                document.getElementById('typing-message').remove();

                console.error("Error processing question:", error);

                chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Sorry, an error occurred while processing your question. Please try again.</div>
                </div>
            `;

                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
    }

    // Message sending events
    sendBtn.addEventListener('click', sendQuestion);
    questionInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendQuestion();
        }
    });
});