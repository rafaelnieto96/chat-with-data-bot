#!/usr/bin/env python
# coding: utf-8
import os
import sys
sys.path.append('../..')


import panel as pn  # GUI
pn.extension()

from dotenv import load_dotenv, find_dotenv
_ = load_dotenv(find_dotenv()) # read local .env file

from langchain_cohere import CohereEmbeddings
from langchain_cohere import ChatCohere
from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter
from langchain_community.vectorstores import DocArrayInMemorySearch
from langchain.chains import RetrievalQA,  ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain_community.document_loaders import TextLoader
from langchain_community.document_loaders import PyPDFLoader
import panel as pn
import param

embedding_model = "embed-english-v3.0"
cohere_api_key = os.environ['COHERE_API_KEY']
model_name = "command"

def load_db(file, chain_type, k, embedding_model=embedding_model, cohere_api_key=cohere_api_key):
    # load documents
    loader = PyPDFLoader(file)
    documents = loader.load()
    # split documents
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    docs = text_splitter.split_documents(documents)
    # define embedding
    embeddings = CohereEmbeddings(
        model=embedding_model, 
        cohere_api_key=cohere_api_key
    )    # create vector database from data
    db = DocArrayInMemorySearch.from_documents(docs, embeddings)
    # define retriever
    retriever = db.as_retriever(search_type="similarity", search_kwargs={"k": k})
    # create a chatbot chain. Memory is managed externally.
    qa = ConversationalRetrievalChain.from_llm(
        llm=ChatCohere(
            model=model_name, 
            temperature=0, 
            cohere_api_key=cohere_api_key
        ), 
        chain_type=chain_type, 
        retriever=retriever, 
        return_source_documents=True,
        return_generated_question=True,
    )
    return qa 

class cbfs(param.Parameterized):
    chat_history = param.List([])
    answer = param.String("")
    db_query  = param.String("")
    db_response = param.List([])
    
    def __init__(self,  **params):
        super(cbfs, self).__init__( **params)
        self.panels = []
        self.loaded_file = "./data/MachineLearning-Lecture01.pdf"
        self.qa = load_db(self.loaded_file,"stuff", 4)
    
    def call_load_db(self, count):
        if count == 0 or file_input.value is None:  # init or no file specified :
            return pn.pane.Markdown(f"Loaded File: {self.loaded_file}")
        else:
            file_input.save("temp.pdf")  # local copy
            self.loaded_file = file_input.filename
            button_load.button_style="outline"
            self.qa = load_db("temp.pdf", "stuff", 4)
            button_load.button_style="solid"
        self.clr_history()
        return pn.pane.Markdown(f"Loaded File: {self.loaded_file}")

    def convchain(self, query):
        if not query:
            # With ChatFeed, an empty message isn't necessary; it always shows the chat UI
            return
        
        # Send user's query to the chat feed
        chat_feed.send(query, user="User")
        # Invoke the backend process for the query
        result = self.qa.invoke({"question": query, "chat_history": self.chat_history})
        self.chat_history.extend([(query, result["answer"])])
        self.db_query = result["generated_question"]
        self.db_response = result["source_documents"]
        self.answer = result['answer']
        
        # Send system's response to the chat feed
        chat_feed.send(self.answer, user="Bot", avatar="🤖")

        # Assuming 'inp' is a TextInput widget you're using to capture user input
        # Clears the input field to be ready for the next query
        inp.value = ''

    @param.depends('db_query ', )
    def get_lquest(self):
        if not self.db_query :
            return pn.Column(
                pn.Row(pn.pane.Markdown(f"Last question to DB:", styles={'background-color': '#F6F6F6'})),
                pn.Row(pn.pane.Str("no DB accesses so far"))
            )
        return pn.Column(
            pn.Row(pn.pane.Markdown(f"DB query:", styles={'background-color': '#F6F6F6'})),
            pn.pane.Str(self.db_query )
        )

    @param.depends('db_response', )
    def get_sources(self):
        if not self.db_response:
            return 
        rlist=[pn.Row(pn.pane.Markdown(f"Result of DB lookup:", styles={'background-color': '#F6F6F6'}))]
        for doc in self.db_response:
            rlist.append(pn.Row(pn.pane.Str(doc)))
        return pn.WidgetBox(*rlist, width=600, scroll=True)

    @param.depends('convchain', 'clr_history') 
    def get_chats(self):
        if not self.chat_history:
            return pn.WidgetBox(pn.Row(pn.pane.Str("No History Yet")), width=600, scroll=True)
        rlist=[pn.Row(pn.pane.Markdown(f"Current Chat History variable", styles={'background-color': '#F6F6F6'}))]
        for exchange in self.chat_history:
            rlist.append(pn.Row(pn.pane.Str(exchange)))
        return pn.WidgetBox(*rlist, width=600, scroll=True)

    def clr_history(self,count=0):
        self.chat_history = []
        return 

cb = cbfs()

file_input = pn.widgets.FileInput(accept='.pdf')
button_send = pn.widgets.Button(name='Ask a question', button_type='primary', icon="ballpen")
button_load = pn.widgets.Button(name="Load DB", button_type='primary')
button_clearhistory = pn.widgets.Button(name="Clear History", button_type='warning')
button_clearhistory.on_click(cb.clr_history)
inp = pn.widgets.TextInput( placeholder='Enter text here…')
bound_button_send = pn.bind(cb.convchain, inp)

bound_button_load = pn.bind(cb.call_load_db, button_load.param.clicks)
current_dir = os.path.dirname(os.path.abspath(__file__))
jpg_pane = pn.pane.Image(os.path.join(current_dir, './assets/convchain.jpg'))

## Configure the chat Feed
chat_feed = pn.chat.ChatFeed()
tabs = pn.Tabs()

tab1 = pn.Column(
    pn.Row(inp, button_send, bound_button_send),
    pn.layout.Divider(),
    chat_feed,
    pn.layout.Divider(),
)
tab2= pn.Column(
    pn.panel(cb.get_lquest),
    pn.layout.Divider(),
    pn.panel(cb.get_sources ),
)
tab3= pn.Column(
    pn.panel(cb.get_chats),
    pn.layout.Divider(),
)
tab4=pn.Column(
    pn.Row( file_input, button_load, bound_button_load),
    pn.Row( button_clearhistory, pn.pane.Markdown("Clears chat history. Can use to start a new topic" )),
    pn.layout.Divider(),
    pn.Row(jpg_pane.clone(width=400))
)
for name, tab in zip(["Conversation", "Database", "Chat History", "Configure"], [tab1, tab2, tab3, tab4]):
    tabs.append((name, tab))

dashboard = pn.Column(
    pn.Row(pn.pane.Markdown('# ChatWithYourData - Bot')),
    tabs
)


def main():
    return dashboard

if __name__ == "__main__":

    pn.serve(main, port=8080, autoreload=True)