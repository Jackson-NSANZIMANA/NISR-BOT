const main = document.querySelector("main");
const emptyState = document.querySelector(".empty-state");
const userInputContainer = document.querySelector(".user-input");
const promptInput = document.querySelector(".prompt-input");
const chatsContainer = document.getElementById("chats");

const PROXY_URL = "https://nisr-bot-proxy.n-jacksonac.workers.dev";
let datasetText = "";

// 2. Load and parse the dataset (PHC5-2022_Main_Indicators.xlsx)
async function loadDataset() {
  try {
    const response = await fetch("./dataset/PHC5-2022_Main_Indicators.xlsx");
    const arrayBuffer = await response.arrayBuffer();

    // Read the file using SheetJS
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Loop through all sheets and convert the data into text (CSV format)
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      datasetText += `\n--- Sheet: ${sheetName} ---\n`;
      datasetText += XLSX.utils.sheet_to_csv(worksheet);
    });

    console.log("Dataset loaded successfully into memory!");
  } catch (error) {
    console.error(
      "Error loading dataset. Are you running a local web server?",
      error,
    );
  }
}
loadDataset(); // Run this immediately when the page loads

// 3. UI Function: Add a chat bubble to the screen
function appendMessage(role, text) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", role);

  if (role === "ai") {
    // Parse raw markdown into clean HTML elements
    msgDiv.innerHTML = marked.parse(text);
  } else {
    // Keep plain text for user messages
    msgDiv.textContent = text;
  }

  chatsContainer.appendChild(msgDiv);
  chatsContainer.scrollTop = chatsContainer.scrollHeight;
}

// 4. AI Function: Send the prompt + dataset to Gemini (via the proxy)
async function fetchAIResponse(userPrompt) {
  const loadingId = "loading-" + Date.now();
  const loadingDiv = document.createElement("div");
  loadingDiv.classList.add("message", "ai");
  loadingDiv.id = loadingId;
  loadingDiv.innerText = "Thinking...";
  chatsContainer.appendChild(loadingDiv);

  const systemInstruction = `You are NISR-BOT, an AI assistant for the National Institute of Statistics of Rwanda. 
    Answer the user's questions accurately based ONLY on the provided Census 2022 dataset below. 
    If the answer is not in the data, politely say you don't have that information.
    
    DATASET:
    ${datasetText}`;

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  };

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Log detailed error information if the response isn't OK
    if (!response.ok) {
      let message = "Request failed";
      try {
        const errorData = await response.json();
        console.error("API Response Error:", errorData);
        message = errorData.error?.message || message;
      } catch (e) {}
      throw new Error(`HTTP ${response.status}: ${message}`);
    }

    const data = await response.json();

    document.getElementById(loadingId).remove();

    if (data.candidates && data.candidates[0].content) {
      const aiText = data.candidates[0].content.parts[0].text;
      appendMessage("ai", aiText);
    } else {
      appendMessage("ai", "I couldn't process that response.");
    }
  } catch (error) {
    if (document.getElementById(loadingId)) {
      document.getElementById(loadingId).remove();
    }
    appendMessage("ai", `Error: ${error.message}`);
    console.error(error);
  }
}

// 5. Trigger the whole process
function handleSend() {
  const text = promptInput.value.trim();
  if (!text) return; // Don't do anything if input is empty

  // Switch UI to conversation mode
  main.classList.add("has-messages");
  main.appendChild(userInputContainer);

  // Show user message
  appendMessage("user", text);

  // Trigger AI Call
  fetchAIResponse(text);

  // Clear input box
  promptInput.value = "";
}

// Ensure button click works (Update the onclick in your HTML if needed)
document.querySelector(".btn-send").onclick = handleSend;

// Ensure Enter key works
promptInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSend();
  }
});
