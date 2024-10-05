// At the top of the file, add:
let sendLogUpdate;

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
const {
  TavilySearchResults,
} = require("@langchain/community/tools/tavily_search");
const { Document } = require("@langchain/core/documents");
const { Runnable } = require("@langchain/core/runnables");
const { retry } = require("@langchain/core/utils/async_caller");

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
    const result = await callOllama(
      "llama3.2:3b-instruct-fp16",
      promptString,
      true
    );
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
  return callOllama("llama3.2:3b-instruct-fp16", promptString);
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
    console.log("Starting vector store initialization");
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

// Update the webSearchTool initialization
const webSearchTool = new TavilySearchResults({
  maxResults: 3,
  apiKey: null, // We'll set this dynamically
});

// Define graph nodes
const retrieve = async (state) => {
  console.log("---RETRIEVE---");
  try {
    if (!retriever) {
      console.log("Initializing vector store");
      retriever = await initializeVectorStore();
    }
    if (!retriever) {
      throw new Error("Failed to initialize retriever");
    }
    console.log("Invoking retriever with question:", state.question);
    if (!state.question || typeof state.question !== "string") {
      throw new Error(`Invalid question: ${JSON.stringify(state.question)}`);
    }
    const documents = await retriever.invoke(state.question);
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

const webSearch = async (state) => {
  console.log("---WEB SEARCH---");
  try {
    if (!webSearchTool.apiKey) {
      throw new Error("Tavily API key is not set");
    }
    console.log("Performing web search with question:", state.question);
    const searchResults = await webSearchTool.invoke(state.question);
    console.log("Web search results:", searchResults);
    return {
      documents: [
        new Document({ pageContent: JSON.stringify(searchResults, null, 2) }),
      ],
    };
  } catch (error) {
    console.error("Web search error:", error);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return {
      documents: [
        new Document({ pageContent: `Web search failed: ${error.message}` }),
      ],
    };
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

// Update these functions to accept the model parameter
async function checkOllamaServer(model) {
  try {
    const result = await testOllama(model);
    console.log("Ollama server is running.");
    return result;
  } catch (error) {
    console.error("Error connecting to Ollama server:", error.message);
    return false;
  }
}

async function runRAG(
  question,
  model,
  sendStepUpdate,
  logUpdateFunction,
  tavilyApiKey
) {
  sendLogUpdate = logUpdateFunction;
  let relevantDocs = [];
  try {
    console.log("Starting RAG pipeline");
    sendLogUpdate("start", "Starting RAG pipeline");
    sendLogUpdate("start", JSON.stringify({ question, model }, null, 2));

    if (!question || typeof question !== "string") {
      throw new Error(`Invalid question: ${JSON.stringify(question)}`);
    }

    const serverStatus = await checkOllamaServer(model);
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
    sendLogUpdate("route", `Original question: "${question}"`);

    const routeResponse = await jsonModeLlm(
      `${QUESTION_ROUTER_SYSTEM_TEMPLATE}\n\nHuman: ${question}`
    );
    console.log("Route response:", routeResponse);
    sendLogUpdate(
      "route",
      `Router decision: ${JSON.stringify(routeResponse, null, 2)}`
    );

    const routeDecision = routeResponse.datasource;
    console.log("Route decision:", routeDecision);
    sendLogUpdate("route", `Routed to: ${routeDecision}`);

    if (routeDecision === "web_search") {
      console.log("Performing web search");
      sendStepUpdate("web_search");
      sendLogUpdate("web_search", "Performing web search...");

      if (!tavilyApiKey) {
        console.log("Tavily API key not set");
        sendLogUpdate("error", "Tavily API key not set");
        return {
          error:
            "Tavily API key not set. Please set the API key and try again.",
        };
      }

      webSearchTool.apiKey = tavilyApiKey;
      try {
        const searchResults = await webSearch({ question });
        console.log("Web search results:", searchResults);
        sendLogUpdate("web_search", JSON.stringify(searchResults, null, 2));
        // Update relevantDocs with the search results
        relevantDocs = searchResults.documents;
      } catch (error) {
        console.error("Web search error:", error);
        sendLogUpdate("error", `Web search error: ${error.message}`);
        return { error: `Web search failed: ${error.message}` };
      }
    } else {
      console.log("Retrieving documents");
      sendStepUpdate("retrieve");
      sendLogUpdate("retrieve", "Retrieving relevant documents...");
      try {
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
          relevantDocs = gradedDocs.documents; // Update relevantDocs here
          console.log("Relevant documents:", relevantDocs);
          sendLogUpdate("grade", JSON.stringify(gradedDocs, null, 2));

          if (relevantDocs.length === 0) {
            console.log("No relevant documents found, transforming query");
            sendStepUpdate("transform");
            sendLogUpdate("transform", "Transforming query...");
            const betterQuestion = await rewriter.invoke({ question });
            console.log("Transformed question:", betterQuestion);
            sendLogUpdate(
              "transform",
              JSON.stringify({ betterQuestion }, null, 2)
            );
            // Here you might want to restart the retrieval process with the better question
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

    console.log("Generating answer");
    sendStepUpdate("generate");
    sendLogUpdate("generate", "Generating answer...");
    const generatedAnswer = await llm(
      `Context: ${relevantDocs
        .map((doc) => doc.pageContent)
        .join("\n\n")}\n\nQuestion: ${question}\n\nAnswer:`
    );
    console.log("Generated answer:", generatedAnswer);
    sendLogUpdate("generate", JSON.stringify({ generatedAnswer }, null, 2));
    return { generation: generatedAnswer };
  } catch (error) {
    console.error("Error in RAG pipeline:", error);
    sendLogUpdate("error", `Error in RAG pipeline: ${error.message}`);
    sendLogUpdate("error", JSON.stringify({ error: error.message }, null, 2));
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
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    console.log("Available Ollama models:", data.models);
    return data.models.map((model) => model.name); // Return an array of model names
  } catch (error) {
    console.error("Error listing Ollama models:", error.message);
    return [];
  }
}

// Add this function to set the search URLs
function setSearchUrls(urls, logUpdateFunction) {
  searchUrls = urls;
  sendLogUpdate = logUpdateFunction;
}

// Update the module.exports
module.exports = {
  runRAG,
  checkOllamaServer,
  testOllama,
  listOllamaModels,
  setSearchUrls,
};
