// At the top of the file, add:
let sendLogUpdate;

// Near the top of the file, add:
const log = require("electron-log");
const dotenv = require("dotenv");
dotenv.config();
const path = require("path");
const fs = require("fs").promises;
const _ = require("lodash");

// Replace console.log statements with this function
function debugLog(message) {
  if (process.env.DEBUG) {
    console.log(message);
  }
}

function tryRequire(moduleName) {
  try {
    if (moduleName === "langchain/document_loaders/fs/pdf") {
      const pdfParse = require("pdf-parse");
      return {
        PDFLoader: class PDFLoader {
          constructor(filePath) {
            this.filePath = filePath;
          }
          async load() {
            const dataBuffer = await fs.readFile(this.filePath);
            const pdfData = await pdfParse(dataBuffer);
            return [
              {
                pageContent: pdfData.text,
                metadata: { source: this.filePath },
              },
            ];
          }
        },
      };
    }
    return require(moduleName);
  } catch (e) {
    console.warn(
      `Optional dependency ${moduleName} is not installed or failed to load. Some functionality may be limited.`
    );
    return null;
  }
}

// Use tryRequire for optional dependencies
const { PDFLoader } = tryRequire("langchain/document_loaders/fs/pdf") || {};

const { StateGraph, END, START } = require("@langchain/langgraph");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { OllamaEmbeddings } = require("@langchain/community/embeddings/ollama");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  CheerioWebBaseLoader,
} = require("langchain/document_loaders/web/cheerio");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const {
  JsonOutputParser,
  StringOutputParser,
} = require("@langchain/core/output_parsers");
const { Document } = require("@langchain/core/documents");
const { Runnable } = require("@langchain/core/runnables");
const { retry } = require("@langchain/core/utils/async_caller");
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");

// Replace the existing FaissStore import with this:
let FaissStore;
try {
  const faissPath =
    process.env.NODE_ENV === "production"
      ? path.join(process.resourcesPath, "faiss-node")
      : "@langchain/community/vectorstores/faiss";
  const { FaissStore: ImportedFaissStore } = require(faissPath);
  FaissStore = ImportedFaissStore;
} catch (error) {
  console.error("Error importing FaissStore:", error);
  log.error("Error importing FaissStore:", error);
  throw new Error(
    `Failed to import FaissStore. Please ensure faiss-node is properly installed.`
  );
}

// Add this function near the top of the file, after the imports
async function checkOllamaServer(model) {
  try {
    log.info(`Checking Ollama server for model: ${model}`);
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: "Test",
        stream: false,
      }),
    });
    if (response.ok) {
      log.info("Ollama server is running.");
      return true;
    } else {
      log.error("Error connecting to Ollama server:", response.statusText);
      return false;
    }
  } catch (error) {
    log.error("Error connecting to Ollama server:", error.message);
    return false;
  }
}

// Replace the existing callOllama function with this updated version
async function callOllama(model, prompt, isJson = false) {
  try {
    // Ensure prompt is a string
    const promptString =
      typeof prompt === "string" ? prompt : JSON.stringify(prompt);

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: promptString,
        stream: false,
        options: isJson ? { num_predict: 1000 } : {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    if (isJson) {
      try {
        return JSON.parse(data.response);
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", data.response);
        return { error: "Invalid JSON response", rawResponse: data.response };
      }
    } else {
      return data.response;
    }
  } catch (error) {
    console.error("Error in callOllama:", error);
    console.error("Request details:", {
      model,
      prompt: typeof prompt === "string" ? prompt : JSON.stringify(prompt),
      isJson,
    });
    throw error;
  }
}

// Replace jsonModeLlm and llm with these functions
async function jsonModeLlm(input) {
  const promptString =
    typeof input === "string" ? input : JSON.stringify(input);
  try {
    const result = await callOllama(selectedModel, promptString, true);
    console.log("Raw jsonModeLlm result:", result);

    if (typeof result === "object" && result !== null) {
      return result;
    }

    if (typeof result === "string") {
      // Try to extract JSON from the string response
      const jsonMatch = result.match(
        /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g
      );
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e);
        }
      }
    }

    console.error("Unexpected jsonModeLlm result:", result);
    return { error: "Invalid response", rawResponse: result };
  } catch (error) {
    console.error("Error in jsonModeLlm:", error);
    return { error: error.message, rawResponse: error.toString() };
  }
}

async function llm(input) {
  const promptString =
    typeof input === "string" ? input : JSON.stringify(input);
  return callOllama(selectedModel, promptString);
}

// Update the getEmbeddings function
async function getEmbeddings(texts) {
  try {
    // If texts is a string, wrap it in an array
    const textArray = Array.isArray(texts) ? texts : [texts];

    const embeddings = [];
    for (const text of textArray) {
      const response = await fetch("http://localhost:11434/api/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mxbai-embed-large:latest",
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const data = await response.json();
      if (!data.embedding) {
        throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
      }
      embeddings.push(data.embedding);
    }

    // If the input was a single string, return a single embedding
    return Array.isArray(texts) ? embeddings : embeddings[0];
  } catch (error) {
    console.error("Error in getEmbeddings:", error);
    throw error;
  }
}

// Add this function to set the search URLs
let searchUrls = [];

// Update the initializeVectorStore function
async function initializeVectorStore() {
  try {
    log.info("Starting vector store initialization");
    console.log("Retrieved search URLs:", searchUrls);

    if (!searchUrls || searchUrls.length === 0) {
      throw new Error(
        "No search URLs provided. Please add some URLs to search."
      );
    }

    console.log("Loading documents from URLs");
    const docs = await Promise.all(
      searchUrls.map(async (url) => {
        try {
          const loader = new CheerioWebBaseLoader(url);
          return await loader.load();
        } catch (error) {
          console.error(`Error loading document from ${url}:`, error);
          return []; // Return an empty array for failed loads
        }
      })
    );

    const docsList = docs.flat();
    console.log(`Loaded ${docsList.length} documents`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 250,
      chunkOverlap: 0,
    });

    console.log("Splitting documents");
    const splitDocs = await textSplitter.splitDocuments(docsList);
    console.log(`Split into ${splitDocs.length} chunks`);

    console.log("Creating embeddings");
    const embeddings = {
      embedQuery: async (text) => {
        console.log("Embedding query:", text);
        return await getEmbeddings(text);
      },
      embedDocuments: async (documents) => {
        console.log(`Embedding ${documents.length} documents`);
        return await getEmbeddings(documents);
      },
    };

    console.log("Creating vector store");
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      embeddings
    );

    return vectorStore.asRetriever();
  } catch (error) {
    console.error("Error in initializeVectorStore:", error);
    throw error;
  }
}

let retriever;

// Define prompts
const QUESTION_ROUTER_SYSTEM_TEMPLATE = `You are an expert at routing a user question to a vectorstore or web search.
Use the vectorstore for questions on LLM agents, prompt engineering, and adversarial attacks.
You do not need to be stringent with the keywords in the question related to these topics.
Otherwise, use web-search. Give a binary choice 'web_search' or 'vectorstore' based on the question.
Return the a JSON with a single key 'datasource' and no preamble or explanation.`;

const questionRouterPrompt = ChatPromptTemplate.fromMessages([
  ["system", QUESTION_ROUTER_SYSTEM_TEMPLATE],
  ["human", "{question}"],
]);

const GRADER_TEMPLATE = `You are a grader assessing relevance of a retrieved document to a user question.
Here is the retrieved document:

<document>
{content}
</document>

Here is the user question:
<question>
{question}
</question>

If the document contains keywords related to the user question, grade it as relevant.
It does not need to be a stringent test. The goal is to filter out erroneous retrievals.
Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.
Provide the binary score as a JSON with a single key 'score' and no preamble or explanation.`;

const graderPrompt = ChatPromptTemplate.fromTemplate(GRADER_TEMPLATE);

const REWRITER_PROMPT_TEMPLATE = `You a question re-writer that converts an input question to a better version that is optimized
for vectorstore retrieval. Look at the initial and formulate an improved question.

Here is the initial question:

<question>
{question}
</question>

Respond only with an improved question. Do not include any preamble or explanation.`;

const rewriterPrompt = ChatPromptTemplate.fromTemplate(
  REWRITER_PROMPT_TEMPLATE
);

// Initialize components
const questionRouter = questionRouterPrompt
  .pipe(jsonModeLlm)
  .pipe(new JsonOutputParser());
const retrievalGrader = graderPrompt
  .pipe(jsonModeLlm)
  .pipe(new JsonOutputParser({ strict: false }));
const rewriter = rewriterPrompt.pipe(llm).pipe(new StringOutputParser());

// Instead, add this function to create the TavilySearchResults instance only when needed
function createTavilySearchTool(apiKey) {
  if (!apiKey) {
    throw new Error("Tavily API key is not set");
  }
  const {
    TavilySearchResults,
  } = require("@langchain/community/tools/tavily_search");
  return new TavilySearchResults({ apiKey });
}

// Define graph nodes
const retrieve = async (state) => {
  console.log("---RETRIEVE---");
  try {
    if (!global.vectorStore) {
      throw new Error(
        "Vector store not initialized. Please select a folder first."
      );
    }
    console.log("Invoking retriever with question:", state.question);
    if (!state.question || typeof state.question !== "string") {
      throw new Error(`Invalid question: ${JSON.stringify(state.question)}`);
    }
    const documents = await global.vectorStore.similaritySearch(
      state.question,
      5
    );
    console.log(`Retrieved ${documents.length} documents`);
    if (!Array.isArray(documents)) {
      throw new Error(
        `Invalid documents returned: ${JSON.stringify(documents)}`
      );
    }
    // Filter out invalid documents and log full text
    const validDocuments = documents.filter(
      (doc) => doc && typeof doc.pageContent === "string"
    );
    console.log(`${validDocuments.length} valid documents after filtering`);
    validDocuments.forEach((doc, index) => {
      console.log(`Document ${index + 1} full text:`, doc.pageContent);
      if (sendLogUpdate) {
        sendLogUpdate(
          "retrieve",
          `Document ${index + 1} full text: ${doc.pageContent}`
        );
      }
    });
    return { documents: validDocuments };
  } catch (error) {
    console.error("Error in retrieve function:", error);
    throw error;
  }
};

const generate = async (state) => {
  console.log("---GENERATE---");
  const context = state.documents.map((doc) => doc.pageContent).join("\n\n");
  const generation = await retryOllama(() =>
    llm.invoke(`Context: ${context}\n\nQuestion: ${state.question}\n\nAnswer:`)
  );
  return { generation };
};

const gradeDocuments = async (state) => {
  console.log("---CHECK DOCUMENT RELEVANCE TO QUESTION---");
  sendLogUpdate("grade", "Starting document grading process");
  const relevantDocs = [];
  if (!state.documents || !Array.isArray(state.documents)) {
    console.error("Invalid documents:", state.documents);
    sendLogUpdate("grade", "Error: Invalid documents received");
    return { documents: [] };
  }
  for (let i = 0; i < state.documents.length; i++) {
    const doc = state.documents[i];
    try {
      console.log(`Grading document ${i + 1}/${state.documents.length}`);
      sendLogUpdate(
        "grade",
        `Grading document ${i + 1}/${state.documents.length}`
      );
      if (!doc || typeof doc !== "object") {
        console.error("Invalid document object:", doc);
        sendLogUpdate(
          "grade",
          `Error: Invalid document object for document ${i + 1}`
        );
        continue;
      }
      if (typeof doc.pageContent !== "string") {
        console.error("Invalid pageContent:", doc.pageContent);
        sendLogUpdate(
          "grade",
          `Error: Invalid pageContent for document ${i + 1}`
        );
        continue;
      }
      const content = doc.pageContent;
      console.log(`\nDocument ${i + 1} content:`, content);
      sendLogUpdate("grade", `\nDocument ${i + 1} content: ${content}`);

      const promptForGrading = `
Question: ${state.question}

Document content: ${content}

Is this document relevant to the question? Respond with a JSON object with a single key 'score' and value 'yes' or 'no'.
`;
      console.log("Prompt for grading:", promptForGrading);
      sendLogUpdate("grade", `Prompt for grading:\n${promptForGrading}`);

      const gradeResponse = await jsonModeLlm(promptForGrading);
      console.log(`\nRaw grade response for document ${i + 1}:`, gradeResponse);
      sendLogUpdate(
        "grade",
        `\nRaw grade response for document ${i + 1}:\n${JSON.stringify(
          gradeResponse,
          null,
          2
        )}`
      );

      let grade;
      if (
        typeof gradeResponse === "object" &&
        gradeResponse !== null &&
        gradeResponse.score
      ) {
        grade = gradeResponse;
      } else {
        console.log(
          `Invalid JSON response for document ${i + 1}. Skipping this document.`
        );
        sendLogUpdate(
          "grade",
          `Invalid JSON response for document ${i + 1}. Skipping this document.`
        );
        continue;
      }

      console.log(`Document ${i + 1} grade:`, grade);
      sendLogUpdate(
        "grade",
        `\nFinal grade for document ${i + 1}: ${JSON.stringify(grade, null, 2)}`
      );

      if (grade.score === "yes") {
        console.log(`---GRADE: DOCUMENT ${i + 1} RELEVANT---`);
        sendLogUpdate("grade", `\nResult: DOCUMENT ${i + 1} RELEVANT`);
        relevantDocs.push(doc);
      } else {
        console.log(`---GRADE: DOCUMENT ${i + 1} NOT RELEVANT---`);
        sendLogUpdate("grade", `\nResult: DOCUMENT ${i + 1} NOT RELEVANT`);
      }

      // Log the full grading information
      const gradingLog = {
        documentIndex: i + 1,
        question: state.question,
        documentContent: content,
        promptForGrading: promptForGrading,
        gradeResponse: gradeResponse,
        finalGrade: grade,
      };
      console.log(
        `Full grading information for document ${i + 1}:`,
        gradingLog
      );
      sendLogUpdate(
        "grade",
        `\nFull grading information for document ${i + 1}:\n${JSON.stringify(
          gradingLog,
          null,
          2
        )}`
      );
    } catch (error) {
      console.error(`Error grading document ${i + 1}:`, error);
      sendLogUpdate(
        "grade",
        `\nError grading document ${i + 1}: ${error.message}`
      );
      console.error("Problematic document:", JSON.stringify(doc, null, 2));
    }
  }
  sendLogUpdate(
    "grade",
    `Grading process completed. ${relevantDocs.length} relevant documents found.`
  );
  return { documents: relevantDocs };
};

const transformQuery = async (state) => {
  console.log("---TRANSFORM QUERY---");
  const betterQuestion = await rewriter.invoke({ question: state.question });
  return { question: betterQuestion };
};

// Update the webSearch function to use the createTavilySearchTool function
const webSearch = async (state) => {
  console.log("---WEB SEARCH---");
  try {
    if (!state.tavilyApiKey) {
      throw new Error("Tavily API key is not set");
    }
    const webSearchTool = createTavilySearchTool(state.tavilyApiKey);
    console.log("Performing web search with question:", state.question);
    const searchResults = await webSearchTool.invoke(state.question);
    console.log("Web search completed");
    return {
      documents: [
        new Document({ pageContent: JSON.stringify(searchResults, null, 2) }),
      ],
    };
  } catch (error) {
    console.error("Web search error:", error);
    throw error;
  }
};

// Modify the routeQuestion function
const routeQuestion = async (state) => {
  const source = await questionRouter.invoke({
    question: state.question,
  });
  console.log(
    `---ROUTING QUESTION "${
      state.question
    }" TO ${source.datasource.toUpperCase()}---`
  );
  return { next: source.datasource };
};

// Modify the decideToGenerate function
const decideToGenerate = async (state) => {
  const filteredDocuments = state.documents;
  if (filteredDocuments.length === 0) {
    console.log(
      "---DECISION: ALL DOCUMENTS ARE NOT RELEVANT TO QUESTION, TRANSFORM QUERY---"
    );
    return { next: "transform_query" };
  } else {
    console.log("---DECISION: GENERATE---");
    return { next: "generate" };
  }
};

// Build the graph
const workflow = new StateGraph({
  channels: {
    question: Runnable,
    documents: Runnable,
    generation: Runnable,
    next: Runnable,
  },
});

// Add all nodes, including the entry point
workflow.addNode("route_question", routeQuestion);
workflow.addNode("web_search", webSearch);
workflow.addNode("retrieve", retrieve);
workflow.addNode("grade_documents", gradeDocuments);
workflow.addNode("generate", generate);
workflow.addNode("transform_query", transformQuery);

// Set the entry point
workflow.setEntryPoint("route_question");

// Add edges
workflow.addConditionalEdges("route_question", (state) => state.next, {
  web_search: "web_search",
  vectorstore: "retrieve",
});
workflow.addEdge("web_search", "generate");
workflow.addEdge("retrieve", "grade_documents");
workflow.addConditionalEdges("grade_documents", (state) => state.next, {
  transform_query: "transform_query",
  generate: "generate",
});
workflow.addEdge("transform_query", "retrieve");
workflow.addEdge("generate", END);

// Add edges from the entry point
workflow.addConditionalEdges("route_question", (state) => state, {
  web_search: "web_search",
  retrieve: "retrieve",
});

// Compile the graph
const app = workflow.compile();

// Export a function to run the RAG pipeline
const { Ollama } = require("@langchain/community/llms/ollama");

// Update the listOllamaModels function
async function listOllamaModels() {
  try {
    log.info("Attempting to list Ollama models");
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      log.error(`Failed to fetch Ollama models. Status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      log.error("Unexpected response format from Ollama API:", data);
      return [];
    }

    // Filter out non-embedding models
    const llmModels = data.models
      .filter(
        (model) =>
          !model.name.toLowerCase().includes("embed") &&
          !model.name.toLowerCase().includes("bge")
      )
      .map((model) => model.name);

    log.info("Available LLM models:", llmModels);
    return llmModels;
  } catch (error) {
    log.error("Error listing Ollama models:", error.message);
    return [];
  }
}

// Add this function to list embedding models
async function listEmbeddingModels() {
  try {
    log.info("Listing embedding models");
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      log.error(`Failed to fetch Ollama models. Status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      log.error("Unexpected response format from Ollama API:", data);
      return [];
    }

    // Filter out embedding models
    const embeddingModels = data.models
      .filter(
        (model) =>
          model.name.toLowerCase().includes("embed") ||
          model.name.toLowerCase().includes("bge")
      )
      .map((model) => model.name);

    log.info("Available embedding models:", embeddingModels);
    return embeddingModels;
  } catch (error) {
    log.error("Error listing embedding models:", error.message);
    return [];
  }
}

// Update the createEmbeddings function to use the selected model
async function createEmbeddings() {
  const selectedEmbeddingModel =
    global.selectedEmbeddingModel || "mxbai-embed-large:latest";
  return new OllamaEmbeddings({
    model: selectedEmbeddingModel,
    baseUrl: "http://localhost:11434",
  });
}

// Update the createVectorStore function
async function createVectorStore(folderPath, progressCallback) {
  console.log("Creating new vector store...");
  log.info(`Creating new vector store in folder: ${folderPath}`);

  const loaders = {
    ".txt": (path) => new TextLoader(path),
    ".json": (path) => new JSONLoader(path),
    ".csv": (path) => new CSVLoader(path),
  };

  if (PDFLoader) {
    loaders[".pdf"] = (path) => new PDFLoader(path);
  } else {
    console.warn("PDFLoader is not available. PDF files will be skipped.");
    log.warn("PDFLoader is not available. PDF files will be skipped.");
  }

  const loader = new DirectoryLoader(folderPath, loaders, {
    ignoreFiles: (file) => {
      const ignoredExtensions = [".DS_Store", ".yaml", ".pkl", ".npy", ".bin"];
      return ignoredExtensions.some((ext) => file.endsWith(ext));
    },
  });

  try {
    progressCallback({
      status: "loading",
      message: "Loading documents...",
      percentage: 0,
    });

    const docs = await loader.load();
    console.log(`Loaded ${docs.length} documents`);
    log.info(`Loaded ${docs.length} documents`);
    progressCallback({
      status: "processing",
      message: `Processing ${docs.length} documents...`,
      percentage: 10,
    });

    progressCallback({
      status: "embedding",
      message: "Creating embeddings...",
      percentage: 20,
    });

    const embeddings = await createEmbeddings();

    progressCallback({
      status: "vectorizing",
      message: "Creating vector store...",
      percentage: 40,
    });

    let vectorStore;
    try {
      vectorStore = await FaissStore.fromDocuments(docs, embeddings);
    } catch (faissError) {
      console.error("Error creating FaissStore:", faissError);
      log.error("Error creating FaissStore:", faissError);
      throw new Error(`Failed to create FaissStore: ${faissError.message}`);
    }

    console.log("Vector store created successfully");
    log.info("Vector store created successfully");
    progressCallback({
      status: "saving",
      message: "Saving vector store...",
      percentage: 99,
    });

    const vectorStorePath = path.join(folderPath, ".vector_store");
    console.log(`Attempting to save vector store to: ${vectorStorePath}`);
    log.info(`Attempting to save vector store to: ${vectorStorePath}`);

    try {
      await vectorStore.save(vectorStorePath);
      console.log(`Vector store saved to ${vectorStorePath}`);
      log.info(`Vector store saved to ${vectorStorePath}`);
    } catch (saveError) {
      console.error("Error saving vector store:", saveError);
      log.error("Error saving vector store:", saveError);
      throw new Error(`Failed to save vector store: ${saveError.message}`);
    }

    progressCallback({
      status: "saved",
      message: "Vector store processing completed",
      percentage: 100,
    });

    return vectorStore;
  } catch (error) {
    console.error("Error in createVectorStore:", error);
    log.error("Error in createVectorStore:", error);
    throw error;
  }
}

// Update the loadOrCreateVectorStore function
async function loadOrCreateVectorStore(folderPath, progressCallback) {
  const vectorStorePath = path.join(folderPath, ".vector_store");
  let vectorStore;

  try {
    // Check if vector store exists
    await fs.access(vectorStorePath);
    console.log("Loading existing vector store...");
    progressCallback({
      status: "loading",
      message: "Loading existing vector store...",
      percentage: 0,
    });
    const embeddings = await createEmbeddings();
    try {
      vectorStore = await FaissStore.load(vectorStorePath, embeddings);
    } catch (loadError) {
      console.error("Error loading existing vector store:", loadError);
      log.error("Error loading existing vector store:", loadError);
      throw new Error(
        `Failed to load existing vector store: ${loadError.message}`
      );
    }
  } catch (error) {
    console.log("No existing vector store found. Creating new one...");
    progressCallback({
      status: "creating",
      message: "Creating new vector store...",
      percentage: 0,
    });
    vectorStore = await createVectorStore(folderPath, progressCallback);
  }

  // Store the vectorStore in a global variable
  global.vectorStore = vectorStore;

  return {
    success: true,
    message: "Vector store loaded or created successfully",
  };
}

// Update the updateVectorStore function
async function updateVectorStore(folderPath, vectorStore, progressCallback) {
  const loaders = {
    ".txt": (path) => new TextLoader(path),
    ".json": (path) => new JSONLoader(path),
    ".csv": (path) => new CSVLoader(path),
  };

  if (PDFLoader) {
    loaders[".pdf"] = (path) => new PDFLoader(path);
  }

  const loader = new DirectoryLoader(folderPath, loaders, {
    ignoreFiles: (file) => {
      const ignoredExtensions = [
        ".DS_Store",
        ".yaml",
        ".pkl",
        ".npy",
        ".bin",
        ".index",
      ];
      return ignoredExtensions.some((ext) => file.endsWith(ext));
    },
  });

  try {
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} documents`);
    progressCallback({
      status: "checking",
      message: `Checking ${docs.length} documents...`,
      percentage: 20,
    });

    let needsReinitialization = false;
    try {
      await vectorStore.similaritySearch("test query", 1);
    } catch (error) {
      console.error("Error performing similarity search:", error);
      needsReinitialization = true;
    }

    if (needsReinitialization) {
      console.log("Reinitializing vector store due to error...");
      progressCallback({
        status: "reinitializing",
        message: "Reinitializing vector store...",
        percentage: 40,
      });
      const embeddings = await createEmbeddings();
      vectorStore = await FaissStore.fromDocuments(docs, embeddings);
      const vectorStorePath = path.join(folderPath, ".vector_store");
      await vectorStore.save(vectorStorePath);
      console.log("Vector store reinitialized and saved successfully");
      progressCallback({
        status: "reinitialized",
        message: "Vector store reinitialized and saved successfully",
        percentage: 100,
      });
      return vectorStore;
    }

    // If we don't need to reinitialize, proceed with updating
    const existingDocs = await vectorStore.similaritySearch("", docs.length);
    const newDocs = docs.filter(
      (doc) =>
        !existingDocs.some(
          (existingDoc) => existingDoc.metadata.source === doc.metadata.source
        )
    );

    if (newDocs.length > 0) {
      console.log(
        `Adding ${newDocs.length} new documents to the vector store...`
      );
      progressCallback({
        status: "updating",
        message: `Adding ${newDocs.length} new documents...`,
        percentage: 60,
      });
      const embeddings = await createEmbeddings();
      await vectorStore.addDocuments(newDocs);
      const vectorStorePath = path.join(folderPath, ".vector_store");
      await vectorStore.save(vectorStorePath);
      console.log("Vector store updated and saved successfully");
      progressCallback({
        status: "updated",
        message: "Vector store updated and saved successfully",
        percentage: 100,
      });
    } else {
      console.log("No new documents found. Vector store is up to date.");
      progressCallback({
        status: "upToDate",
        message: "Vector store is up to date",
        percentage: 100,
      });
    }
    return vectorStore;
  } catch (error) {
    console.error("Error in updateVectorStore:", error);
    throw error;
  }
}

// Update the runRAG function to use the new vector store
async function runRAG(
  question,
  llmModel,
  embeddingModel,
  sendStepUpdate,
  logUpdateFunction,
  tavilyApiKey,
  isTavilySearchEnabled,
  selectedFolderPath
) {
  // Set the selected model
  setSelectedModel(llmModel);

  sendLogUpdate = logUpdateFunction;
  let relevantDocs = [];
  try {
    console.log("Starting RAG pipeline");
    sendLogUpdate("start", "Starting RAG pipeline");
    console.log("Tavily search enabled:", isTavilySearchEnabled);
    console.log("Tavily API key present:", !!tavilyApiKey);

    sendLogUpdate(
      "start",
      JSON.stringify(
        { question, llmModel, embeddingModel, isTavilySearchEnabled },
        null,
        2
      )
    );

    if (!question || typeof question !== "string") {
      throw new Error(`Invalid question: ${JSON.stringify(question)}`);
    }

    const serverStatus = await checkOllamaServer(llmModel);
    console.log("Ollama server status:", serverStatus);
    sendLogUpdate("start", `Ollama server status: ${serverStatus}`);

    if (!serverStatus) {
      console.log("Ollama server not running or inaccessible");
      sendLogUpdate("error", "Ollama server not running or inaccessible");
      return {
        error:
          "Ollama server is not running or not accessible. Please start the Ollama server and try again.",
      };
    }

    console.log("Routing question");
    sendStepUpdate("route");
    sendLogUpdate("route", "Routing question");

    let routeDecision = "vectorstore";
    if (isTavilySearchEnabled && tavilyApiKey) {
      console.log("Tavily search is enabled and API key is provided");
      sendLogUpdate(
        "route",
        "Tavily search is enabled and API key is provided"
      );
      try {
        const routeResult = await routeQuestion({ question });
        routeDecision = routeResult.next;
      } catch (routeError) {
        console.error("Error in question routing:", routeError);
        sendLogUpdate(
          "route",
          `Routing error: ${routeError.message}. Using vectorstore.`
        );
      }
    } else {
      if (isTavilySearchEnabled && !tavilyApiKey) {
        console.log("Tavily search is enabled but API key is missing");
        sendLogUpdate(
          "route",
          "Tavily search is enabled but API key is missing. Using vectorstore."
        );
      } else {
        console.log("Tavily search is disabled");
        sendLogUpdate("route", "Tavily search is disabled. Using vectorstore.");
      }
    }

    console.log("Route decision:", routeDecision);
    sendLogUpdate("route", `Final route decision: ${routeDecision}`);

    if (
      routeDecision === "web_search" &&
      isTavilySearchEnabled &&
      tavilyApiKey
    ) {
      console.log("Performing web search");
      sendStepUpdate("web_search");
      sendLogUpdate("web_search", "Performing web search...");

      try {
        const searchResults = await webSearch({ question, tavilyApiKey });
        console.log("Web search completed");
        sendLogUpdate("web_search", "Web search completed");
        relevantDocs = searchResults.documents;
      } catch (error) {
        console.error("Web search error:", error);
        sendLogUpdate(
          "error",
          `Web search error: ${error.message}. Falling back to vectorstore.`
        );
        routeDecision = "vectorstore";
      }
    }

    if (routeDecision === "vectorstore") {
      console.log("Retrieving documents from vectorstore");
      sendStepUpdate("retrieve");
      sendLogUpdate("retrieve", "Retrieving relevant documents...");
      try {
        if (!selectedFolderPath) {
          throw new Error("No folder selected. Please select a folder first.");
        }
        const result = await loadOrCreateVectorStore(
          selectedFolderPath,
          (progress) => {
            sendLogUpdate("retrieve", progress.message);
          }
        );
        if (result.success) {
          retriever = result.retriever;
        } else {
          throw new Error(result.message);
        }
        const { documents } = await retrieve({ question });
        if (!documents || documents.length === 0) {
          throw new Error("No valid documents retrieved");
        }
        console.log("Retrieved documents:", documents);
        sendLogUpdate("retrieve", JSON.stringify(documents, null, 2));
        documents.forEach((doc, index) => {
          if (doc && doc.pageContent && typeof doc.pageContent === "string") {
            sendLogUpdate(
              "retrieve",
              `Document ${index + 1}: ${doc.pageContent.substring(0, 100)}...`
            );
          } else {
            console.error(`Invalid document at index ${index}:`, doc);
            sendLogUpdate("retrieve", `Invalid document at index ${index}`);
          }
        });

        console.log("Grading documents");
        sendStepUpdate("grade");
        sendLogUpdate("grade", "Grading retrieved documents...");
        try {
          console.log("Documents before grading:", documents);
          const gradedDocs = await gradeDocuments({
            question,
            documents,
          });
          console.log("Graded documents:", gradedDocs);
          relevantDocs = gradedDocs.documents;
          console.log("Relevant documents:", relevantDocs);
          sendLogUpdate("grade", JSON.stringify(gradedDocs, null, 2));

          if (relevantDocs.length === 0) {
            console.log("No relevant documents found, transforming query");
            sendStepUpdate("transform");
            sendLogUpdate("transform", "Transforming query...");
            const betterQuestion = await transformQuery({ question });
            console.log("Transformed question:", betterQuestion);
            sendLogUpdate(
              "transform",
              JSON.stringify({ betterQuestion }, null, 2)
            );

            // Retry retrieval with the transformed question
            console.log("Retrying retrieval with transformed question");
            sendStepUpdate("retrieve");
            sendLogUpdate(
              "retrieve",
              "Retrieving documents with transformed query..."
            );
            const { documents: newDocuments } = await retrieve({
              question: betterQuestion.question,
            });
            const newGradedDocs = await gradeDocuments({
              question: betterQuestion.question,
              documents: newDocuments,
            });
            relevantDocs = newGradedDocs.documents;
            console.log("New relevant documents:", relevantDocs);
            sendLogUpdate("grade", JSON.stringify(newGradedDocs, null, 2));
          }
        } catch (error) {
          console.error("Error in document grading:", error);
          sendLogUpdate("error", `Error in document grading: ${error.message}`);
          return { error: `Document grading failed: ${error.message}` };
        }
      } catch (error) {
        console.error("Error in document retrieval or grading:", error);
        sendLogUpdate("error", `Error: ${error.message}`);
        return { error: `Document processing failed: ${error.message}` };
      }
    }

    if (relevantDocs.length === 0) {
      console.log("No relevant documents found after transformation");
      sendLogUpdate(
        "generate",
        "No relevant documents found. Generating answer based on general knowledge."
      );
      // Proceed with generation using only the question
      const generatedAnswer = await llm(`Question: ${question}\n\nAnswer:`);
      console.log("Generated answer:", generatedAnswer);
      sendLogUpdate("generate", JSON.stringify({ generatedAnswer }, null, 2));
      return { generation: generatedAnswer };
    }

    console.log("Generating answer");
    sendStepUpdate("generate");
    sendLogUpdate("generate", "Generating answer...");
    const generatedAnswer = await llm(
      `Context: [${relevantDocs.length} relevant documents]\n\nQuestion: ${question}\n\nAnswer:`
    );
    console.log("Answer generated");
    sendLogUpdate("generate", "Answer generated");

    // Prepare sources information
    const sources = relevantDocs.map((doc) => ({
      fileName: path.basename(doc.metadata.source),
      filePath: doc.metadata.source,
    }));

    return { generation: generatedAnswer, sources };
  } catch (error) {
    console.error("Error in RAG pipeline:", error);
    sendLogUpdate("error", `Error in RAG pipeline: ${error.message}`);
    return { error: error.message || "An unknown error occurred" };
  }
}

async function testOllama(model) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: "What is the capital of France?",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Ollama test result:", data.response);
    return true;
  } catch (error) {
    console.error("Ollama test error:", error.message);
    return false;
  }
}

// Add this function near the end of the file
async function listOllamaModels() {
  try {
    log.info("Attempting to list Ollama models");
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      log.error(`Failed to fetch Ollama models. Status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      log.error("Unexpected response format from Ollama API:", data);
      return [];
    }
    log.info("Available Ollama models:", data.models);
    return data.models.map((model) => model.name);
  } catch (error) {
    log.error("Error listing Ollama models:", error.message);
    return [];
  }
}

// Add this function to set the search URLs
function setSearchUrls(urls, logUpdateFunction) {
  searchUrls = urls;
  sendLogUpdate = logUpdateFunction;
}

// Add this function to set the selected model
let selectedModel = "llama3.2:3b-instruct-fp16"; // Default model

function setSelectedModel(model) {
  selectedModel = model;
  console.log(`Selected model set to: ${selectedModel}`);
  log.info(`Selected model set to: ${selectedModel}`);
}

// Update the module.exports
module.exports = {
  runRAG,
  checkOllamaServer,
  testOllama,
  listOllamaModels,
  listEmbeddingModels,
  setSearchUrls,
  loadOrCreateVectorStore,
  setSelectedModel, // Add this line
};
