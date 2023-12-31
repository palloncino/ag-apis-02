import bodyParser from 'body-parser';
import cors from "cors";
import * as dotenv from 'dotenv';
import express from 'express';
import { RetrievalQAChain, loadQARefineChain } from "langchain/chains";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

// Deploy script
// eb deploy prod-2

dotenv.config()

const PORT = process.env.PORT || 4000;

const app = express();

app.use(bodyParser.json());

app.use(
  cors({
    origin: ["https://antonioguiotto.com", "http://localhost:3000"],
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
    optionsSuccessStatus: 204,
  })
);

// Load local files such as .json and .txt from ./docs
const loader = new DirectoryLoader("./docs", {
  ".json": (path) => new JSONLoader(path),
  ".txt": (path) => new TextLoader(path)
})


// Define a function to normalize the content of the documents
const normalizeDocuments = (docs) => {
  return docs.map((doc) => {
    if (typeof doc.pageContent === "string") {
      return doc.pageContent;
    } else if (Array.isArray(doc.pageContent)) {
      return doc.pageContent.join("\n");
    }
  });
}

const VECTOR_STORE_PATH = "Documents.index";

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Create a POST endpoint to handle run requests
app.post('/chat-local', async (req, res) => {
  try {
    // Get the prompt from the request body
    const { prompt } = req.body;
    
    if (!prompt) {
      // If prompt is not provided, send a bad request response
      res.status(400).send({ error: 'Prompt is required' });
      return;
    }
    
    // Call the run function with the prompt
    const response = await run([prompt]);
    
    // Send the response back to the client

    if (response.output_text) {
      res.send({response: response.output_text});
    }
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export const run = async (params) => {
  const prompt = params[0]
  console.log('Prompt:', prompt)

  console.log("Loading docs...")
  const docs = await loader.load();

  console.log('Processing...')
  const model = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY });

  let vectorStore;

  console.log('Creating new vector store...')
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
  });
  const normalizedDocs = normalizeDocuments(docs);
  const splitDocs = await textSplitter.createDocuments(normalizedDocs);

  // Generate the vector store from the documents
  vectorStore = await HNSWLib.fromDocuments(
    splitDocs,
    new OpenAIEmbeddings()
  );

  await vectorStore.save(VECTOR_STORE_PATH);
  console.log("Vector store created.")

  console.log("Creating retrieval chain...")
  // Query the retrieval chain with the specified question
  // const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever())

  const chain = new RetrievalQAChain({
    combineDocumentsChain: loadQARefineChain(model),
    retriever: vectorStore.asRetriever(),
  });

  console.log("Querying chain...");
  const res = await chain.call({ query: prompt });
  
  // Return the response instead of logging it
  return res;
}