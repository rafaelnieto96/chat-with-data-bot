from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import sys
from dotenv import load_dotenv
from langchain_cohere import CohereEmbeddings, ChatCohere
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import DocArrayInMemorySearch
from langchain.chains import ConversationalRetrievalChain
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader

# Cargar variables de entorno
load_dotenv()

# Configuración de la aplicación Flask
app = Flask(__name__, 
            static_folder='front',
            template_folder='front')

# Configuración de Cohere
embedding_model = "embed-english-v3.0"  # Modelo de embeddings de Cohere
cohere_api_key = os.environ.get('COHERE_API_KEY')
model_name = "command"  # Modelo de chat de Cohere

# Variables globales para mantener estado
qa_chain = None
chat_history = []

def process_document(file_path, chain_type="stuff", k=4):
    """
    Procesa un archivo PDF o Word para crear una cadena de consulta conversacional.
    
    Args:
        file_path: Ruta al archivo
        chain_type: Tipo de cadena para la recuperación
        k: Número de fragmentos a recuperar
        
    Returns:
        ConversationalRetrievalChain: La cadena de consulta inicializada
    """
    # Determinar el tipo de archivo por su extensión
    if file_path.lower().endswith('.pdf'):
        loader = PyPDFLoader(file_path)
    elif file_path.lower().endswith('.docx'):
        loader = Docx2txtLoader(file_path)
    else:
        raise ValueError("Formato de archivo no soportado. Solo PDF o DOCX.")
    
    # El resto de la función permanece igual
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    docs = text_splitter.split_documents(documents)
    
    # Crear embeddings y base de datos vectorial
    embeddings = CohereEmbeddings(model=embedding_model, cohere_api_key=cohere_api_key)
    db = DocArrayInMemorySearch.from_documents(docs, embeddings)
    
    # Configurar recuperador
    retriever = db.as_retriever(search_type="similarity", search_kwargs={"k": k})
    
    # Crear cadena conversacional
    qa = ConversationalRetrievalChain.from_llm(
        llm=ChatCohere(model=model_name, temperature=0, cohere_api_key=cohere_api_key),
        chain_type=chain_type,
        retriever=retriever,
        return_source_documents=True,
        return_generated_question=True,
    )
    
    return qa

@app.route('/')
def index():
    """Ruta principal que sirve la página de inicio"""
    return render_template('homepage/index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Sirve archivos estáticos desde la carpeta front"""
    return send_from_directory('front', path)

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Ruta para cargar y procesar un archivo PDF o Word
    """
    global qa_chain, chat_history
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"})
    
    # Verificar si el archivo es PDF o DOCX
    if file and (file.filename.lower().endswith('.pdf') or file.filename.lower().endswith('.docx')):
        # Crear directorio de uploads si no existe
        os.makedirs('uploads', exist_ok=True)
        
        # Guardar el archivo
        file_path = os.path.join('uploads', file.filename)
        file.save(file_path)
        
        try:
            # Procesar el documento
            qa_chain = process_document(file_path)
            # Resetear historial para nueva conversación
            chat_history = []
            
            # Eliminar el archivo después de procesarlo
            os.remove(file_path)
            
            return jsonify({
                "success": True, 
                "filename": file.filename
            })
        except Exception as e:
            # Registrar el error detallado en la consola del servidor
            print(f"Error al procesar archivo: {str(e)}", file=sys.stderr)
            
            # Intentar eliminar el archivo en caso de error
            if os.path.exists(file_path):
                os.remove(file_path)
                
            return jsonify({
                "error": "Error al procesar el archivo. Por favor, inténtalo más tarde."
            })

    return jsonify({"error": "El archivo debe ser PDF o DOCX (Word)"})

@app.route('/ask', methods=['POST'])
def ask_question():
    """
    Ruta para procesar preguntas sobre el documento cargado
    """
    global chat_history, qa_chain

    # Verificar que hay una cadena inicializada
    if not qa_chain:
        return jsonify({"error": "Por favor, carga un documento primero"})
    
    # Obtener la pregunta del request
    data = request.json
    if not data or 'question' not in data:
        return jsonify({"error": "No se proporcionó una pregunta"})
    
    question = data['question']
    
    try:
        # Invocar la cadena con la pregunta y el historial
        result = qa_chain.invoke({
            "question": question, 
            "chat_history": chat_history
        })
        
        # Actualizar el historial de chat
        chat_history.append((question, result["answer"]))
        
        # Formatear los documentos fuente para la respuesta
        sources = []
        for doc in result["source_documents"]:
            # Versión completa sin truncar
            full_content = doc.page_content
            # Versión truncada para mostrar inicialmente
            content_preview = full_content[:300] + "..." if len(full_content) > 300 else full_content
            
            sources.append({
                "content": content_preview,
                "full_content": full_content,
                "metadata": doc.metadata
            })
        
        # Preparar la respuesta
        response = {
            "answer": result["answer"],
            "sources": sources,
            "db_query": result.get("generated_question", "")
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"Error al procesar pregunta: {str(e)}", file=sys.stderr)
        
        return jsonify({
            "error": "Error al procesar la pregunta. Por favor, inténtalo más tarde."
        })

if __name__ == '__main__':
    # Verificar la presencia de la API key
    if not cohere_api_key:
        print("Error: No se encontró COHERE_API_KEY en las variables de entorno")
        print("Por favor, crea un archivo .env con tu API key de Cohere")
        sys.exit(1)
    
    port = int(os.environ.get('PORT', 8080))
    
    print(f"Iniciando servidor en http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)