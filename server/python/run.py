import os
import glob
import time
import argparse
from dotenv import load_dotenv
from typing import List
from multiprocessing import Pool
from tqdm import tqdm

from langchain.chains import RetrievalQA
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.llms import OpenAIChat
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
from constants import CHROMA_SETTINGS

load_dotenv()

open_ai_api_key = os.environ.get("OPENAI_API_KEY")

chunk_size = 500
chunk_overlap = 50

class MyElmLoader(UnstructuredEmailLoader):
    def load(self) -> List[Document]:
        try:
            try:
                doc = UnstructuredEmailLoader.load(self)
            except ValueError as e:
                if "text/html content not found in email" in str(e):
                    self.unstructured_kwargs["content_source"] = "text/plain"
                    doc = UnstructuredEmailLoader.load(self)
                else:
                    raise
        except Exception as e:
            raise type(e)(f"{self.file_path}: {e}") from e

        return doc

LOADER_MAPPING = {
    ".csv": (CSVLoader, {}),
    ".doc": (UnstructuredWordDocumentLoader, {}),
    ".docx": (UnstructuredWordDocumentLoader, {}),
    ".enex": (EverNoteLoader, {}),
    ".eml": (MyElmLoader, {}),
    ".epub": (UnstructuredEPubLoader, {}),
    ".html": (UnstructuredHTMLLoader, {}),
    ".md": (UnstructuredMarkdownLoader, {}),
    ".odt": (UnstructuredODTLoader, {}),
    ".pdf": (PyMuPDFLoader, {}),
    ".ppt": (UnstructuredPowerPointLoader, {}),
    ".pptx": (UnstructuredPowerPointLoader, {}),
    ".txt": (TextLoader, {"encoding": "utf8"}),
}

def load_single_document(file_path: str) -> List[Document]:
    ext = "." + file_path.rsplit(".", 1)[-1]
    if ext in LOADER_MAPPING:
        loader_class, loader_args = LOADER_MAPPING[ext]
        loader = loader_class(file_path, **loader_args)
        return loader.load()

    raise ValueError(f"Unsupported file extension '{ext}'")

def load_documents(source_paths: List[str], ignored_files: List[str] = []) -> List[Document]:
    all_files = []
    for file in source_paths:
        if LOADER_MAPPING.get(os.path.splitext(file)[1]):
            all_files.append(file)
    filtered_files = [file_path for file_path in all_files if file_path not in ignored_files]

    with Pool(processes=os.cpu_count()) as pool:
        results = []
        with tqdm(total=len(filtered_files), desc="Loading new documents", ncols=80) as pbar:
            for i, docs in enumerate(pool.imap_unordered(load_single_document, filtered_files)):
                results.extend(docs)
                pbar.update()

    return results

def process_documents(source_paths: List[str], ignored_files: List[str] = []) -> List[Document]:
    documents = load_documents(source_paths, ignored_files)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    texts = text_splitter.split_documents(documents)
    return texts

def does_vectorstore_exist(persist_directory: str) -> bool:
    if os.path.exists(os.path.join(persist_directory, "index")):
        if (
            os.path.exists(os.path.join(persist_directory, "chroma-collections.parquet"))
            and os.path.exists(os.path.join(persist_directory, "chroma-embeddings.parquet"))
        ):
            list_index_files = glob.glob(os.path.join(persist_directory, "index/*.bin"))
            list_index_files += glob.glob(os.path.join(persist_directory, "index/*.pkl"))
            if len(list_index_files) > 3:
                return True
    return False

def learn(args):
    source_paths = args.paths
    persist_directory = args.db_location
    openai_embeddings = OpenAIEmbeddings(openai_api_key=open_ai_api_key)

    if does_vectorstore_exist(persist_directory):
        db = Chroma(persist_directory=persist_directory, embedding_function=openai_embeddings, client_settings=CHROMA_SETTINGS)
        collection = db.get()
        texts = process_documents(source_paths, [metadata["source"] for metadata in collection["metadatas"]])
        db.add_documents(texts)
    else:
        texts = process_documents(source_paths)
        db = Chroma.from_documents(texts, openai_embeddings, persist_directory=persist_directory, client_settings=CHROMA_SETTINGS)
    db.persist()
    db = None

def ask(args):
    question = args.question
    persist_directory = args.db_location

    openai_embeddings = OpenAIEmbeddings(openai_api_key=open_ai_api_key)
    db = Chroma(persist_directory=persist_directory, embedding_function=openai_embeddings, client_settings=CHROMA_SETTINGS)
    retriever = db.as_retriever(search_kwargs={"k": args.target_source_chunks})

    llm = OpenAIChat(openai_api_key=open_ai_api_key)

    qa = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=False,
    )

    start = time.time()
    res = qa(question)
    answer = res["result"]
    end = time.time()

    print(f"Answer (took {round(end - start, 2)} s.):")
    print(answer)

def parse_arguments():
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers()

    learn_parser = subparsers.add_parser("learn")
    learn_parser.add_argument("paths", nargs="+", help="File paths to ingest.")
    learn_parser.add_argument("--db_location", required=True, help="Database location.")
    learn_parser.set_defaults(func=learn)

    ask_parser = subparsers.add_parser("ask")
    ask_parser.add_argument("question", help="The question to ask.")
    ask_parser.add_argument("--db_location", required=True, help="Database location.")
    ask_parser.add_argument(
        "--target-source-chunks",
        type=int,
        default=4,
        help="Number of source chunks to consider when generating the answer.",
    )
    ask_parser.set_defaults(func=ask)

    return parser.parse_args()

def main():
    args = parse_arguments()
    args.func(args)

if __name__ == "__main__":
    main()