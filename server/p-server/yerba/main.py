import os
import glob
import time
from typing import List, Optional
from multiprocessing import Pool
from tqdm import tqdm
from fastapi import FastAPI, Body, Header
from pydantic import BaseModel
from langchain.chains import RetrievalQA
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma

# from langchain.llms import OpenAIChat
from langchain.document_loaders import (
    CSVLoader,
    EverNoteLoader,
    PyMuPDFLoader,
    TextLoader,
    UnstructuredEmailLoader,
    UnstructuredEPubLoader,
    UnstructuredHTMLLoader,
    UnstructuredMarkdownLoader,
    UnstructuredODTLoader,
    UnstructuredPowerPointLoader,
    UnstructuredWordDocumentLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
from chromadb.config import Settings
from langchain.chat_models import ChatOpenAI
from langchain.chains.conversational_retrieval.base import ConversationalRetrievalChain
import json


def does_vectorstore_exist(persist_directory: str) -> bool:
    if os.path.exists(os.path.join(persist_directory, "index")):
        if os.path.exists(
            os.path.join(persist_directory, "chroma-collections.parquet")
        ) and os.path.exists(
            os.path.join(persist_directory, "chroma-embeddings.parquet")
        ):
            list_index_files = glob.glob(os.path.join(persist_directory, "index/*.bin"))
            list_index_files += glob.glob(
                os.path.join(persist_directory, "index/*.pkl")
            )
            if len(list_index_files) > 3:
                return True
    return False


def process_documents(
    source_paths: List[str], ignored_files: List[str] = []
) -> List[Document]:
    documents = load_documents(source_paths, ignored_files)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap
    )
    texts = text_splitter.split_documents(documents)
    return texts


def load_single_document(file_path: str) -> List[Document]:
    ext = "." + file_path.rsplit(".", 1)[-1]
    if ext in LOADER_MAPPING:
        loader_class, loader_args = LOADER_MAPPING[ext]
        loader = loader_class(file_path, **loader_args)
        return loader.load()

    raise ValueError(f"Unsupported file extension '{ext}'")


def load_documents(
    source_paths: List[str], ignored_files: List[str] = []
) -> List[Document]:
    all_files = []
    for file in source_paths:
        if LOADER_MAPPING.get(os.path.splitext(file)[1]):
            all_files.append(file)
    filtered_files = [
        file_path for file_path in all_files if file_path not in ignored_files
    ]

    with Pool(processes=os.cpu_count()) as pool:
        results = []
        with tqdm(
            total=len(filtered_files), desc="Loading new documents", ncols=80
        ) as pbar:
            for i, docs in enumerate(
                pool.imap_unordered(load_single_document, filtered_files)
            ):
                results.extend(docs)
                pbar.update()

    return results


LOADER_MAPPING = {
    ".csv": (CSVLoader, {}),
    ".doc": (UnstructuredWordDocumentLoader, {}),
    ".docx": (UnstructuredWordDocumentLoader, {}),
    ".enex": (EverNoteLoader, {}),
    ".epub": (UnstructuredEPubLoader, {}),
    ".html": (UnstructuredHTMLLoader, {}),
    ".md": (UnstructuredMarkdownLoader, {}),
    ".odt": (UnstructuredODTLoader, {}),
    ".pdf": (PyMuPDFLoader, {}),
    ".ppt": (UnstructuredPowerPointLoader, {}),
    ".pptx": (UnstructuredPowerPointLoader, {}),
    ".txt": (TextLoader, {"encoding": "utf8"}),
}


OPEN_AI_API_KEY = os.environ.get("OPEN_AI_API_KEY")

chunk_size = 500
chunk_overlap = 50


class LearnRequest(BaseModel):
    vector_db_path: str
    file_path: str


class LearnResponse(BaseModel):
    success: bool
    error: Optional[str] = None


class AskRequest(BaseModel):
    vector_db_path: str
    question: str
    # chat history is a json array formatted as follows:
    # [
    #   {
    #     "HUMAN": "foo",
    #     "AI": "bar"
    #   },
    # ]
    chat_history: str


class AskResponse(BaseModel):
    success: bool
    error: Optional[str] = None
    result: Optional[str] = None


app = FastAPI()


@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    try:
        print("ask")
        print(request)

        question = request.question
        persist_directory = request.vector_db_path

        history = json.loads(request.chat_history or "[]")
        print(f"history: {history}")
        # need history formatted as [(foo, bar), (foo, bar)]. if is empty string, then []
        if history == "":
            history = []
        chat_history = [(x["HUMAN"], x["AI"]) for x in history]
        print(f"chat_history: {chat_history}")

        openai_embeddings = OpenAIEmbeddings(openai_api_key=OPEN_AI_API_KEY)

        chroma_settings = Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_directory,
            anonymized_telemetry=False,
        )
        db = Chroma(
            persist_directory=persist_directory,
            embedding_function=openai_embeddings,
            client_settings=chroma_settings,
        )
        retriever = db.as_retriever(search_kwargs={"k": 6})

        llm = ChatOpenAI(openai_api_key=OPEN_AI_API_KEY)

        qa = ConversationalRetrievalChain.from_llm(llm, retriever, verbose=True)

        start = time.time()
        result = qa({"question": question, "chat_history": chat_history})
        print(f"result: {result}")
        # pr
        # res = qa(question)
        answer = result["answer"]
        end = time.time()

        print(f"Answer: {result} generated in {end - start} seconds")

        return AskResponse(success=True, result=answer)
    except Exception as e:
        print(f"Error: {e}")
        return AskResponse(success=False, error=str(e))


@app.post("/learn", response_model=LearnResponse)
async def learn(request: LearnRequest):
    try:
        source_paths = [request.file_path]
        persist_directory = request.vector_db_path
        openai_embeddings = OpenAIEmbeddings(openai_api_key=OPEN_AI_API_KEY)

        chroma_settings = Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_directory,
            anonymized_telemetry=False,
        )

        print(f"persist_directory: {persist_directory}")

        if does_vectorstore_exist(persist_directory):
            print("vectorstore exists")
            db = Chroma(
                persist_directory=persist_directory,
                embedding_function=openai_embeddings,
                client_settings=chroma_settings,
            )
            collection = db.get()
            texts = process_documents(
                source_paths,
                [metadata["source"] for metadata in collection["metadatas"]],
            )
            db.add_documents(texts)
        else:
            print("vectorstore does not exist")
            texts = process_documents(source_paths)
            db = Chroma.from_documents(
                texts,
                openai_embeddings,
                persist_directory=persist_directory,
                client_settings=chroma_settings,
            )
        db.persist()
        db = None
        print("done")

        return LearnResponse(success=True)
    except Exception as e:
        return LearnResponse(success=False, error=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001)
