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
    function createFragmentItem(source, index) {
        const fragmentDiv = document.createElement('div');
        fragmentDiv.className = 'fragmentItem';

        // Crear el div para el contenido
        const contentDiv = document.createElement('div');
        contentDiv.className = 'fragmentContent';
        contentDiv.id = `fragment-${index}`;

        // Obtener el contenido completo y truncado
        const fullContent = source.full_content || source;
        const truncatedContent = source.content || source;

        // Almacenar el contenido como atributos de datos
        fragmentDiv.dataset.fullContent = fullContent;
        fragmentDiv.dataset.truncatedContent = truncatedContent;

        // Establecer el contenido inicial (truncado)
        contentDiv.textContent = truncatedContent;

        // Crear el botón de mostrar más/menos
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'fragmentToggle';
        toggleBtn.textContent = 'Mostrar más';

        // Agregar los elementos al fragmento
        fragmentDiv.appendChild(contentDiv);
        fragmentDiv.appendChild(toggleBtn);

        // Agregar al contenedor de fragmentos
        sourcesContent.appendChild(fragmentDiv);

        // Agregar event listener para el botón de mostrar más/menos
        toggleBtn.addEventListener('click', function () {
            contentDiv.classList.toggle('expanded');

            if (contentDiv.classList.contains('expanded')) {
                // Usar el contenido completo almacenado en el dataset
                contentDiv.textContent = fragmentDiv.dataset.fullContent;
                this.textContent = 'Mostrar menos';
            } else {
                // Volver a la versión resumida
                contentDiv.textContent = fragmentDiv.dataset.truncatedContent;
                this.textContent = 'Mostrar más';
            }
        });
    }

    function updateFragments(sources) {
        if (sources && sources.length) {
            sourcesContent.innerHTML = '';
            sources.forEach((source, index) => {
                createFragmentItem(source, index);
            });

            // Asegurarse de que el sidebar esté visible
            if (sidebar.classList.contains('collapsed')) {
                toggleSidebar(); // Expandir el sidebar para mostrar los fragmentos
            }
        } else {
            sourcesContent.innerHTML = '<p class="placeholder">No hay fragmentos disponibles para esta consulta.</p>';
        }
    }

    // Manejar el clic en el botón de archivo
    fileBtn.addEventListener('click', function () {
        pdfFile.click();
    });

    // ÚNICO manejador para la carga de archivos
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
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Por favor, sube un archivo PDF o Word (DOCX).</div>
                </div>
            `;
            // Scroll al final
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // Mostrar mensaje de procesamiento en el chat
        chatMessages.innerHTML += `
    <div class="message assistantMessage" id="processing-message">
        <div class="messageIcon">🤖</div>
        <div class="messageContent">
            <div class="processingContainer">
                <span>Procesando ${file.name}</span>
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
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
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">He procesado tu documento "${data.filename}". ¡Ahora puedes hacerme preguntas sobre él!</div>
                    </div>
                `;
                    isFileUploaded = true;

                    // Habilitar chat
                    questionInput.disabled = false;
                    sendBtn.disabled = false;

                    // Limpiar contenidos
                    sourcesContent.innerHTML = '<p class="placeholder">Aún no hay consultas...</p>';
                } else {
                    // Mostrar error genérico en el chat
                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">Lo siento, ha ocurrido un error al procesar el archivo. Por favor, inténtalo de nuevo más tarde.</div>
                    </div>
                `;
                    // Registrar el error detallado en la consola
                    console.error("Error del servidor:", data.error);
                }

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                // Eliminar mensaje de procesamiento
                document.getElementById('processing-message').remove();

                // Registrar el error detallado en la consola
                console.error("Error al procesar el archivo:", error);

                // Mostrar mensaje genérico en el chat
                chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Lo siento, ha ocurrido un error al procesar el archivo. Por favor, inténtalo de nuevo más tarde.</div>
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
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Por favor sube un documento primero.</div>
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
                <div class="messageIcon">👤</div>
                <div class="messageContent">${question}</div>
            </div>
        `;

        // Mostrar mensaje de "escribiendo"
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

                if (data.error) {
                    // Registrar el error detallado en la consola
                    console.error("Error del servidor:", data.error);
                    
                    // Mostrar mensaje genérico en el chat
                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">Lo siento, ha ocurrido un error al procesar tu pregunta. Por favor, inténtalo de nuevo.</div>
                    </div>
                    `;
                } else {
                    // Mostrar respuesta
                    chatMessages.innerHTML += `
                    <div class="message assistantMessage">
                        <div class="messageIcon">🤖</div>
                        <div class="messageContent">${data.answer}</div>
                    </div>
                    `;

                    // Actualizar fragmentos en el sidebar
                    if (data.sources && data.sources.length) {
                        updateFragments(data.sources);
                    }
                }

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                // Eliminar indicador de escritura
                document.getElementById('typing-message').remove();

                // Registrar el error detallado en la consola
                console.error("Error al procesar la pregunta:", error);

                // Mostrar mensaje genérico en el chat
                chatMessages.innerHTML += `
                <div class="message assistantMessage">
                    <div class="messageIcon">🤖</div>
                    <div class="messageContent">Lo siento, ha ocurrido un error al procesar tu pregunta. Por favor, inténtalo de nuevo.</div>
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