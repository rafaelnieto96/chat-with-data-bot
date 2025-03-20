document.addEventListener('DOMContentLoaded', function () {
    // Variables para el manejo de archivos
    const pdfFile = document.getElementById('pdf-file');
    const fileBtn = document.getElementById('file-btn');
    const chatMessages = document.getElementById('chat-messages');
    const questionInput = document.getElementById('question-input');
    const sendBtn = document.getElementById('send-btn');
    const sourcesContent = document.getElementById('sources-content');

    // Variables para el sidebar
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const showSidebarBtn = document.getElementById('show-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const chatMain = document.getElementById('chat-main');

    // Variables de estado
    let isFileUploaded = false;

    // Función para alternar el sidebar
    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        chatMain.classList.toggle('fullWidth');

        // Cambiar la visibilidad del botón flotante
        if (sidebar.classList.contains('collapsed')) {
            showSidebarBtn.style.display = 'flex'; // Mostrar solo el botón flotante
            toggleSidebarBtn.style.display = 'none'; // Ocultar el botón interno
        } else {
            showSidebarBtn.style.display = 'none'; // Ocultar el botón flotante
            toggleSidebarBtn.style.display = 'flex'; // Mostrar el botón interno
        }
    }

    // Event listeners para el sidebar
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    showSidebarBtn.addEventListener('click', toggleSidebar);

    // Función para crear los fragmentos con botones de expandir/contraer
    // Función para crear los fragmentos con botones de expandir/contraer
    function createFragmentItem(content, index) {
        const fragmentDiv = document.createElement('div');
        fragmentDiv.className = 'fragmentItem';

        // Guardamos el contenido completo como atributo de datos
        const fullContent = content;

        fragmentDiv.innerHTML = `
        <div class="fragmentContent" id="fragment-${index}" data-full-content="${encodeURIComponent(fullContent)}">${fullContent}</div>
        <span class="fragmentToggle" data-index="${index}">Mostrar más</span>
    `;

        // Agregar al contenedor de fragmentos
        sourcesContent.appendChild(fragmentDiv);

        // Agregar event listener para el botón de mostrar más/menos
        const toggleBtn = fragmentDiv.querySelector('.fragmentToggle');
        toggleBtn.addEventListener('click', function () {
            const index = this.getAttribute('data-index');
            const contentDiv = document.getElementById(`fragment-${index}`);

            contentDiv.classList.toggle('expanded');

            if (contentDiv.classList.contains('expanded')) {
                // Cuando expandimos, nos aseguramos de mostrar el contenido completo
                this.textContent = 'Mostrar menos';
            } else {
                // Versión truncada
                this.textContent = 'Mostrar más';
            }
        });
    }

    // Función para actualizar los fragmentos
    function updateFragments(sources) {
        if (sources && sources.length) {
            sourcesContent.innerHTML = '';
            sources.forEach((source, index) => {
                const content = source.content || source;
                createFragmentItem(content, index);
            });
        }
    }

    // Manejar el clic en el botón de archivo
    fileBtn.addEventListener('click', function () {
        pdfFile.click();
    });

    // Manejar carga de archivo cuando el usuario selecciona un archivo
    pdfFile.addEventListener('change', function () {
        if (!pdfFile.files[0]) {
            return;
        }

        const file = pdfFile.files[0];

        // Verificar si es un tipo de archivo válido
        const fileNameLower = file.name.toLowerCase();
        if (!fileNameLower.endsWith('.pdf') && !fileNameLower.endsWith('.docx')) {
            // Mostrar mensaje de error en el chat
            chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    Por favor, sube un archivo PDF o Word (DOCX).
                </div>
            `;
            // Scroll al final
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // Mostrar mensaje de procesamiento en el chat
        chatMessages.innerHTML += `
            <div class="message assistantMessage" id="processing-message">
                Procesando ${file.name}...
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        // Scroll al final
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Crear FormData para enviar al servidor
        const formData = new FormData();
        formData.append('file', file);

        // Enviar archivo al servidor
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                // Eliminar mensaje de procesamiento
                document.getElementById('processing-message').remove();

                if (data.success) {
                    // Mostrar mensaje de éxito en el chat
                    chatMessages.innerHTML += `
                        <div class="message assistantMessage">
                            He procesado tu documento "${data.filename}". ¡Ahora puedes hacerme preguntas sobre él!
                        </div>
                    `;
                    isFileUploaded = true;

                    // Habilitar chat
                    questionInput.disabled = false;
                    sendBtn.disabled = false;

                    // Limpiar contenidos
                    sourcesContent.innerHTML = '<p class="placeholder">Aún no hay consultas...</p>';
                } else {
                    // Mostrar error en el chat
                    chatMessages.innerHTML += `
                        <div class="message assistantMessage">
                            Error: ${data.error}
                        </div>
                    `;
                }

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                // Eliminar mensaje de procesamiento
                document.getElementById('processing-message').remove();

                // Mostrar error en el chat
                chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        Error al procesar el archivo: ${error.message}
                    </div>
                `;

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
    });

    // Función para enviar pregunta
    function sendQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        if (!isFileUploaded) {
            chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    Por favor sube un documento primero.
                </div>
            `;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // Limpiar el input inmediatamente después de obtener su valor
        questionInput.value = '';

        // Agregar mensaje del usuario
        chatMessages.innerHTML += `
            <div class="message userMessage">
                ${question}
            </div>
        `;

        // Mostrar mensaje de "escribiendo"
        chatMessages.innerHTML += `
            <div class="message assistantMessage" id="typing-message">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;

        // Scroll al final
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Enviar pregunta al servidor
        fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        })
            .then(response => response.json())
            .then(data => {
                // Eliminar indicador de escritura
                document.getElementById('typing-message').remove();

                // Mostrar respuesta
                chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        ${data.answer}
                    </div>
                `;

                // Actualizar fragmentos en el sidebar usando la nueva función
                if (data.sources && data.sources.length) {
                    updateFragments(data.sources);
                }

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                // Eliminar indicador de escritura
                document.getElementById('typing-message').remove();

                // Mostrar error
                chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        Lo siento, ocurrió un error: ${error.message}
                    </div>
                `;

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
    }

    // Eventos para enviar mensaje
    sendBtn.addEventListener('click', sendQuestion);
    questionInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendQuestion();
        }
    });
});