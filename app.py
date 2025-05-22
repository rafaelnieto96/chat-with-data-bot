from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import sys
import json
import math
from dotenv import load_dotenv
import requests
import PyPDF2
import docx2txt

# Load environment variables
load_dotenv()

# Flask app configuration
app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

# Cohere configuration
cohere_api_key = os.environ.get('COHERE_API_KEY')

# Global state variables
document_chunks = []
document_embeddings = []
chat_history = []

def cosine_similarity_simple(vec1, vec2):
    """Calcular similitud coseno sin sklearn"""
    # Producto punto
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    
    # Magnitudes
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(a * a for a in vec2))
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0
    
    return dot_product / (magnitude1 * magnitude2)

def get_embeddings(texts):
    """Obtener embeddings usando Cohere API directamente"""
    try:
        api_key = os.environ.get('COHERE_API_KEY')
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "model": "embed-english-v3.0",
            "texts": texts,
            "input_type": "search_document"
        }
        
        response = requests.post(
            'https://api.cohere.ai/v1/embed',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['embeddings']
        else:
            print(f"Error getting embeddings: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Error en embeddings: {str(e)}")
        return None

def get_cohere_response(prompt):
    """Generar respuesta usando Cohere API directamente"""
    try:
        api_key = os.environ.get('COHERE_API_KEY')
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "model": "command-r",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
            "temperature": 0.1
        }
        
        response = requests.post(
            'https://api.cohere.ai/v2/chat',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['message']['content'][0]['text']
        else:
            print(f"Error getting response: {response.status_code} - {response.text}")
            return "Sorry, I encountered an issue processing your request."
            
    except Exception as e:
        print(f"Error en chat: {str(e)}")
        return "Sorry, I encountered an issue processing your request."

def split_text(text, chunk_size=1000, chunk_overlap=150):
    """Dividir texto en chunks"""
    chunks = []
    words = text.split()
    
    i = 0
    while i < len(words):
        # Tomar chunk_size palabras
        chunk_words = words[i:i + chunk_size]
        chunk = ' '.join(chunk_words)
        chunks.append(chunk)
        
        # Avanzar con overlap
        i += chunk_size - chunk_overlap
        if i >= len(words):
            break
    
    return chunks

def find_relevant_chunks(query, k=4):
    """Encontrar chunks más relevantes usando similitud de coseno"""
    if not document_embeddings or not document_chunks:
        return []
    
    # Obtener embedding de la query
    query_embedding = get_embeddings([query])
    if not query_embedding:
        return []
    
    query_vector = query_embedding[0]
    
    # Calcular similitudes con cada chunk
    similarities = []
    for doc_vector in document_embeddings:
        similarity = cosine_similarity_simple(query_vector, doc_vector)
        similarities.append(similarity)
    
    # Obtener top k indices
    indexed_similarities = [(i, sim) for i, sim in enumerate(similarities)]
    indexed_similarities.sort(key=lambda x: x[1], reverse=True)
    
    relevant_chunks = []
    for i, similarity in indexed_similarities[:k]:
        if similarity > 0.1:  # Umbral mínimo de similitud
            relevant_chunks.append({
                'content': document_chunks[i],
                'similarity': similarity
            })
    
    return relevant_chunks

def process_document(file_path):
    """Procesar documento y crear embeddings"""
    global document_chunks, document_embeddings
    
    # Leer contenido del archivo
    content = ""
    if file_path.lower().endswith('.pdf'):
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                content += page.extract_text() + "\n"
    elif file_path.lower().endswith('.docx'):
        content = docx2txt.process(file_path)
    else:
        raise ValueError("Unsupported file format. Only PDF or DOCX accepted.")
    
    # Dividir en chunks
    document_chunks = split_text(content)
    
    # Generar embeddings para todos los chunks
    embeddings = get_embeddings(document_chunks)
    if embeddings:
        document_embeddings = embeddings
        return True
    else:
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('front', path)

@app.route('/static/sample-document.pdf')
def serve_sample_document():
    return send_from_directory('static', 'sample-document.pdf')

@app.route('/status', methods=['GET'])
def status():
    """Simple endpoint to check API connectivity"""
    try:
        api_key = os.environ.get('COHERE_API_KEY')
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "model": "command-r",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 5
        }
        
        response = requests.post(
            'https://api.cohere.ai/v2/chat',
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            return f"API connection working! Response: {result['message']['content'][0]['text']}"
        else:
            return f"API error: {response.status_code} - {response.text}"
            
    except Exception as e:
        return f"API connection error: {str(e)}"

@app.route('/upload', methods=['POST'])
def upload_file():
    global chat_history
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"})
    
    # Check if file is PDF or DOCX
    if file and (file.filename.lower().endswith('.pdf') or file.filename.lower().endswith('.docx')):
        # Create uploads directory if it doesn't exist
        os.makedirs('uploads', exist_ok=True)
        
        # Save the file
        file_path = os.path.join('uploads', file.filename)
        file.save(file_path)
        
        try:
            # Process the document
            success = process_document(file_path)
            if success:
                # Reset history for new conversation
                chat_history = []
                
                # Delete the file after successful processing
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        print(f"Temporary file removed: {file_path}", file=sys.stderr)
                    except Exception as e:
                        print(f"Error removing temporary file (success): {str(e)}", file=sys.stderr)
                
                return jsonify({
                    "success": True, 
                    "filename": file.filename
                })
            else:
                raise Exception("Failed to process embeddings")
            
        except Exception as e:
            # Log detailed error to server console
            print(f"Error processing file: {str(e)}", file=sys.stderr)
            
            # Delete the file in case of error
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    print(f"Temporary file removed (error): {file_path}", file=sys.stderr)
                except Exception as e_remove:
                    print(f"Error removing temporary file (error): {str(e_remove)}", file=sys.stderr)
                
            return jsonify({
                "error": "Error processing the file. Please try again later."
            })

    return jsonify({"error": "File must be PDF or DOCX (Word)"})

@app.route('/ask', methods=['POST'])
def ask_question():
    global chat_history, document_chunks, document_embeddings

    # Verify that we have processed a document
    if not document_chunks or not document_embeddings:
        return jsonify({"error": "Please upload a document first"})
    
    # Get the question from the request
    data = request.json
    if not data or 'question' not in data:
        return jsonify({"error": "No question provided"})
    
    question = data['question']
    
    try:
        # Find relevant chunks
        relevant_chunks = find_relevant_chunks(question, k=4)
        
        if not relevant_chunks:
            return jsonify({"error": "No relevant information found in the document"})
        
        # Create context from relevant chunks
        context = "\n\n".join([chunk['content'] for chunk in relevant_chunks])
        
        # Create prompt with context and chat history
        history_text = ""
        if chat_history:
            history_text = "\n\nPrevious conversation:\n"
            for q, a in chat_history[-3:]:  # Last 3 exchanges
                history_text += f"Q: {q}\nA: {a}\n"
        
        prompt = f"""Based on the following document context, please answer the question. If the answer is not in the context, say so clearly.

Context from document:
{context}

{history_text}

Question: {question}

Answer:"""
        
        # Get response from Cohere
        answer = get_cohere_response(prompt)
        
        # Update chat history
        chat_history.append((question, answer))
        
        # Format sources for response
        sources = []
        for chunk in relevant_chunks:
            content_preview = chunk['content'][:300] + "..." if len(chunk['content']) > 300 else chunk['content']
            sources.append({
                "content": content_preview,
                "full_content": chunk['content'],
                "metadata": {"similarity": chunk['similarity']}
            })
        
        # Prepare the response
        response = {
            "answer": answer,
            "sources": sources,
            "db_query": question
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"Error processing question: {str(e)}", file=sys.stderr)
        
        return jsonify({
            "error": "Error processing the question. Please try again later."
        })

if __name__ == '__main__':
    # Verify API key presence
    if not cohere_api_key:
        print("Error: COHERE_API_KEY not found in environment variables")
        print("Please create a .env file with your Cohere API key")
        sys.exit(1)
    
    port = int(os.environ.get('PORT', 8080))
    
    print(f"Starting server at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)