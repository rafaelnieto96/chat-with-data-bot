document.addEventListener('DOMContentLoaded', function () {
    // Elementos DOM
    const uploadForm = document.getElementById('upload-form');
    const pdfFile = document.getElementById('pdf-file');
    const fileInfo = document.getElementById('file-info');
    const chatMessages = document.getElementById('chat-messages');
    const questionInput = document.getElementById('question-input');
    const sendBtn = document.getElementById('send-btn');
    const sourcesContent = document.getElementById('sources-content');
    const queryContent = document.getElementById('query-content');
    const historyContent = document.getElementById('history-content');
    const tabBtns = document.querySelectorAll('.tab-btn');
    // Configuración del tema claro/oscuro
    const toggleSwitch = document.querySelector('#checkbox');
    const currentTheme = localStorage.getItem('theme') || 'light';
    // Variables de estado
    let isFileUploaded = false;

    // Establece el tema según la preferencia guardada
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggleSwitch.checked = true;
    }

    // Función para cambiar el tema
    function switchTheme(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }

    // Escucha el evento de cambio en el interruptor
    toggleSwitch.addEventListener('change', switchTheme);


    // Manejo de pestañas
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            // Desactivar todos los botones y contenidos
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content =>
                content.classList.remove('active')
            );

            // Activar el botón y contenido seleccionado
            this.classList.add('active');
            document.getElementById(`${this.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Manejar carga de archivo
    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!pdfFile.files[0]) {
            alert('Por favor selecciona un archivo PDF');
            return;
        }

        const file = pdfFile.files[0];
        if (!file.name.endsWith('.pdf')) {
            alert('Por favor sube un archivo PDF');
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
                    fileInfo.innerHTML = `<p class="success">Archivo cargado: ${file.name}</p>`;
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
                    queryContent.innerHTML = '<p class="placeholder">Aún no hay consultas...</p>';
                    historyContent.innerHTML = '<p class="placeholder">Aún no hay conversaciones...</p>';
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

                // Actualizar consulta
                if (data.db_query && queryContent) {
                    queryContent.innerHTML = `<pre>${data.db_query}</pre>`;
                }

                // Actualizar historial
                historyContent.innerHTML = '';
                document.querySelectorAll('.user-message, .bot-message:not(.typing)').forEach(msg => {
                    const isUser = msg.classList.contains('user-message');
                    const messageText = msg.querySelector('.message').textContent;
                    if (messageText) {
                        historyContent.innerHTML += `
                        <div class="history-item ${isUser ? 'user' : 'bot'}">
                            <span class="history-avatar">${isUser ? '👤' : '🤖'}</span>
                            <p>${messageText}</p>
                        </div>
                    `;
                    }
                });

                // Scroll al final
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Ya no necesitamos limpiar el input aquí
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