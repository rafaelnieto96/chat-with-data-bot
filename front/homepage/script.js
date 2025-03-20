document.addEventListener('DOMContentLoaded', function () {
    const pdfFile = document.getElementById('pdf-file');
    const fileBtn = document.getElementById('file-btn');
    const chatMessages = document.getElementById('chat-messages');
    const questionInput = document.getElementById('question-input');
    const sendBtn = document.getElementById('send-btn');
    const sourcesContent = document.getElementById('sources-content');
    
    // Variables de estado
    let isFileUploaded = false;

    // Manejar el clic en el botón de archivo
    fileBtn.addEventListener('click', function() {
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
                <div class="bot-message">
                    <div class="avatar">🤖</div>
                    <div class="message">
                        Por favor, sube un archivo PDF o Word (DOCX).
                    </div>
                </div>
            `;
            // Scroll al final
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // Mostrar mensaje de procesamiento en el chat
        chatMessages.innerHTML += `
            <div class="bot-message" id="processing-message">
                <div class="avatar">🤖</div>
                <div class="message">
                    Procesando ${file.name}...
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
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
                        <div class="bot-message">
                            <div class="avatar">🤖</div>
                            <div class="message">
                                He procesado tu documento "${data.filename}". ¡Ahora puedes hacerme preguntas sobre él!
                            </div>
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
                        <div class="bot-message">
                            <div class="avatar">🤖</div>
                            <div class="message">
                                Error: ${data.error}
                            </div>
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
                    <div class="bot-message">
                        <div class="avatar">🤖</div>
                        <div class="message">
                            Error al procesar el archivo: ${error.message}
                        </div>
                    </div>
                `;
                
                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
    });

    // El resto de tu código para manejar las preguntas...
    function sendQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        if (!isFileUploaded) {
            chatMessages.innerHTML += `
                <div class="bot-message">
                    <div class="avatar">🤖</div>
                    <div class="message">
                        Por favor sube un documento primero.
                    </div>
                </div>
            `;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // Limpiar el input inmediatamente después de obtener su valor
        questionInput.value = '';

        // Agregar mensaje del usuario
        chatMessages.innerHTML += `
            <div class="user-message">
                <div class="message">${question}</div>
                <div class="avatar">👤</div>
            </div>
        `;

        // Mostrar mensaje de "escribiendo"
        chatMessages.innerHTML += `
            <div class="bot-message typing" id="typing-message">
                <div class="avatar">🤖</div>
                <div class="message">
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

                // Mostrar respuesta
                chatMessages.innerHTML += `
                    <div class="bot-message">
                        <div class="avatar">🤖</div>
                        <div class="message">${data.answer}</div>
                    </div>
                `;

                // Actualizar fuentes
                if (data.sources && data.sources.length) {
                    sourcesContent.innerHTML = '';
                    data.sources.forEach((source, index) => {
                        sourcesContent.innerHTML += `
                            <div class="source-item">
                                <h4>Fragmento ${index + 1}</h4>
                                <p>${source.content || source}</p>
                            </div>
                        `;
                    });
                }

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                // Eliminar indicador de escritura
                document.getElementById('typing-message').remove();

                // Mostrar error
                chatMessages.innerHTML += `
                    <div class="bot-message">
                        <div class="avatar">🤖</div>
                        <div class="message">Lo siento, ocurrió un error: ${error.message}</div>
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