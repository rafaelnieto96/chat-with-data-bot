from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import sys
from dotenv import load_dotenv
from langchain_cohere import CohereEmbeddings, ChatCohere
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import DocArrayInMemorySearch
from langchain.chains import ConversationalRetrievalChain
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader

# Load environment variables
load_dotenv()

# Flask app configuration
app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

# Cohere configuration
embedding_model = "embed-english-v3.0"
cohere_api_key = os.environ.get('COHERE_API_KEY')
model_name = "command"

# Global state variables
qa_chain = None
chat_history = []

def process_document(file_path, chain_type="stuff", k=4):
    # Determine file type by extension
    if file_path.lower().endswith('.pdf'):
        loader = PyPDFLoader(file_path)
    elif file_path.lower().endswith('.docx'):
        loader = Docx2txtLoader(file_path)
    else:
        raise ValueError("Unsupported file format. Only PDF or DOCX accepted.")
    
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    docs = text_splitter.split_documents(documents)
    
    # Create embeddings and vector database
    embeddings = CohereEmbeddings(model=embedding_model, cohere_api_key=cohere_api_key)
    db = DocArrayInMemorySearch.from_documents(docs, embeddings)
    
    # Configure retriever
    retriever = db.as_retriever(search_type="similarity", search_kwargs={"k": k})
    
    # Create conversational chain
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
    return render_template('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('front', path)

@app.route('/static/sample-document.pdf')
def serve_sample_document():
    return send_from_directory('static', 'sample-document.pdf')

@app.route('/upload', methods=['POST'])
def upload_file():
    global qa_chain, chat_history
    
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
            qa_chain = process_document(file_path)
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
    global chat_history, qa_chain

    # Verify that a chain is initialized
    if not qa_chain:
        return jsonify({"error": "Please upload a document first"})
    
    # Get the question from the request
    data = request.json
    if not data or 'question' not in data:
        return jsonify({"error": "No question provided"})
    
    question = data['question']
    
    try:
        # Invoke the chain with the question and history
        result = qa_chain.invoke({
            "question": question, 
            "chat_history": chat_history
        })
        
        # Update chat history
        chat_history.append((question, result["answer"]))
        
        # Format source documents for the response
        sources = []
        for doc in result["source_documents"]:
            # Full version without truncation
            full_content = doc.page_content
            # Truncated version for initial display
            content_preview = full_content[:300] + "..." if len(full_content) > 300 else full_content
            
            sources.append({
                "content": content_preview,
                "full_content": full_content,
                "metadata": doc.metadata
            })
        
        # Prepare the response
        response = {
            "answer": result["answer"],
            "sources": sources,
            "db_query": result.get("generated_question", "")
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