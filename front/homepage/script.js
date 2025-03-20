document.addEventListener('DOMContentLoaded', function () {
    const pdfFile = document.getElementById('pdf-file');
    const fileInfo = document.getElementById('file-info');
    const chatMessages = document.getElementById('chat-messages');
    const questionInput = document.getElementById('question-input');
    const sendBtn = document.getElementById('send-btn');
    const sourcesContent = document.getElementById('sources-content');
    
    // Variables de estado
    let isFileUploaded = false;

    // Manejar carga de archivo cuando el usuario selecciona un archivo
    pdfFile.addEventListener('change', function () {
        if (!pdfFile.files[0]) {
            return;
        }

        const file = pdfFile.files[0];
        // Verificar si es un tipo de archivo válido
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.pdf') && !fileName.endsWith('.docx')) {
            alert('Por favor sube un archivo PDF o Word (DOCX)');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Mostrar estado de carga
        fileInfo.innerHTML = `<p class="loading">Procesando ${file.name}...</p>`;

        // Enviar archivo al servidor
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Mostrar mensaje de confirmación
                    fileInfo.innerHTML = `<p class="success">Archivo procesado correctamente: ${file.name}</p>`;
                    isFileUploaded = true;

                    // Habilitar chat
                    questionInput.disabled = false;
                    sendBtn.disabled = false;

                    // Mensaje de bienvenida
                    chatMessages.innerHTML = `
                  <div class="bot-message">
                      <div class="avatar">🤖</div>
                      <div class="message">
                          He procesado tu documento "${data.filename}". ¡Ahora puedes hacerme preguntas sobre él!
                      </div>
                  </div>
              `;

                    // Limpiar contenidos
                    sourcesContent.innerHTML = '<p class="placeholder">Aún no hay consultas...</p>';
                } else {
                    fileInfo.innerHTML = `<p class="error">Error: ${data.error}</p>`;
                }
            })
            .catch(error => {
                fileInfo.innerHTML = `<p class="error">Error al procesar el archivo: ${error.message}</p>`;
            });
    });

    // Manejar envío de preguntas
    function sendQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        if (!isFileUploaded) {
            alert('Por favor carga un documento primero');
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
                <div class="bot-message error">
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