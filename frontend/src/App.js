import React, { useState, useRef, useEffect, useCallback } from "react"; // 'useMemo' removed
import { SunIcon, MoonIcon, PaperAirplaneIcon, StopIcon, PlusIcon, SparklesIcon, ChevronDownIcon, BoltIcon, RocketLaunchIcon, UserIcon } from "@heroicons/react/24/solid";

// --- New Feature: AI Personalities & User Memory ---
const AI_PERSONALITIES = {
  DEFAULT: {
    name: " (Default)",
    prompt: "You are Nexus, a helpful and friendly AI assistant. Keep your responses concise and informative.",
    icon: <SparklesIcon className="h-4 w-4 mr-1" />,
  },
  CREATIVE: {
    name: "Nexus(Creative)",
    prompt: "You are Nexus, a highly creative and imaginative AI assistant. Explore novel ideas and think outside the box.",
    icon: <BoltIcon className="h-4 w-4 mr-1" />,
  },
  TECHNICAL: {
    name: "Nexus (Technical)", // Corrected name for consistency
    prompt: "You are Nexus, a precise and logical AI assistant. Focus on factual accuracy and technical details.",
    icon: <RocketLaunchIcon className="h-4 w-4 mr-1" />,
  },
};

function App() {
  const [message, setMessage] = useState("");

  const [chatLog, setChatLog] = useState(() => {
    try {
      const savedChat = localStorage.getItem("chatLog");
      if (savedChat) {
        return JSON.parse(savedChat).map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      return [];
    } catch (error) {
      console.error("Failed to parse chatLog from localStorage:", error);
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [botTypingText, setBotTypingText] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : true;
  });

  const [isAuthReady] = useState(true); // Assuming authentication is ready for demo
  const [selectedFile, setSelectedFile] = useState(null);

  // --- New Feature: User Memory ---
  const [userMemory, setUserMemory] = useState(() => {
    try {
      const savedMemory = localStorage.getItem("userMemory");
      return savedMemory ? JSON.parse(savedMemory) : {};
    } catch (error) {
      console.error("Failed to parse userMemory from localStorage:", error);
      return {};
    }
  });
  const [selectedPersonality, setSelectedPersonality] = useState(() => {
    const savedPersonality = localStorage.getItem("selectedPersonality");
    return savedPersonality && AI_PERSONALITIES[savedPersonality]
      ? savedPersonality
      : "DEFAULT";
  });
  const [showPersonalityDropdown, setShowPersonalityDropdown] = useState(false);

  const chatBoxRef = useRef(null);
  const abortControllerRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const botReplyAddedRef = useRef(false);
  const fileInputRef = useRef(null);

  const isScrolledUpRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // Save chatLog and userMemory to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("chatLog", JSON.stringify(chatLog));
  }, [chatLog]);

  useEffect(() => {
    localStorage.setItem("userMemory", JSON.stringify(userMemory));
  }, [userMemory]);

  useEffect(() => {
    localStorage.setItem("selectedPersonality", selectedPersonality);
  }, [selectedPersonality]);

  // Modified useEffect for smart scrolling
  useEffect(() => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      const atBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100; // 100px tolerance
      if (!isScrolledUpRef.current || atBottom) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }
  }, [chatLog, loading, botTypingText]);

  // useEffect to attach scroll listener
  useEffect(() => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      const handleScroll = () => {
        const atBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100; // 100px tolerance
        isScrolledUpRef.current = !atBottom;
      };

      chatBox.addEventListener('scroll', handleScroll);
      return () => {
        chatBox.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // --- UI/UX Enhancement: Typing Animation logic refined ---
  const typeEffect = useCallback((fullText) => {
    return new Promise((resolve) => {
      const words = fullText.split(' '); // Split the text into words
      let wordIndex = 0;
      setBotTypingText("");
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      typingIntervalRef.current = setInterval(() => {
        if (!abortControllerRef.current || !abortControllerRef.current.signal.aborted) {
            setBotTypingText((prev) => {
                if (wordIndex < words.length) {
                    // Append the next word, plus a space if it's not the first word
                    const newText = prev + (wordIndex > 0 ? ' ' : '') + words[wordIndex];
                    wordIndex++;
                    return newText;
                } else {
                    // All words typed
                    clearInterval(typingIntervalRef.current);
                    typingIntervalRef.current = null;
                    if (!botReplyAddedRef.current) {
                        setChatLog((prevLog) => [...prevLog, { sender: "bot", text: fullText, timestamp: new Date() }]);
                        botReplyAddedRef.current = true;
                    }
                    resolve();
                    return prev; // Return existing text as typing is complete
                }
            });
        } else {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            resolve();
        }
      }, 70); // Adjust this speed (e.g., 70ms-150ms per word)
    });
  }, []);

  const stopTyping = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Ensure any partially typed message is added to chatLog
    if (botTypingText.trim() !== "" && !botReplyAddedRef.current) {
      setChatLog((prev) => [...prev, { sender: "bot", text: botTypingText, timestamp: new Date() }]);
      botReplyAddedRef.current = true;
    }

    setLoading(false);
    setBotTypingText("");
    botReplyAddedRef.current = false; // Reset for next message
  }, [botTypingText]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Optional: Clear message input if a file is selected only if it's not already typed
      if (!message.trim()) {
        setMessage("");
      }
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = useCallback(async (predefinedMessage = null) => {
    const messageToSend = predefinedMessage !== null ? predefinedMessage : message.trim();

    if ((!messageToSend && !selectedFile) || loading) {
      return;
    }

    let displayMessage = messageToSend;
    if (selectedFile) {
        displayMessage = messageToSend ? `${messageToSend} (File: ${selectedFile.name})` : `File: ${selectedFile.name}`;
    }

    // Add user message to chat log immediately
    setChatLog((prev) => [...prev, { sender: "user", text: displayMessage, timestamp: new Date() }]);

    setLoading(true);
    setBotTypingText(""); // Clear any previous typing text
    setMessage(""); // Clear input field
    setSelectedFile(null); // Clear selected file
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    botReplyAddedRef.current = false;
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const currentInputParts = [];
      if (messageToSend) {
        currentInputParts.push({ text: messageToSend });
      }
      if (selectedFile) {
        setBotTypingText("Processing file..."); // Show "Processing file..."
        const reader = new FileReader();
        const fileBase64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        currentInputParts.push({
          inlineData: {
            mimeType: selectedFile.type,
            data: fileBase64,
          },
        });
      }

      const chatHistoryForAPI = [];

      // Construct the initial system message that will be prepended
      let systemInstruction = AI_PERSONALITIES[selectedPersonality].prompt;

      if (Object.keys(userMemory).length > 0) {
        systemInstruction += `\nUser's persistent memory: ${JSON.stringify(userMemory)}.`;
      }

      let firstMessageProcessed = false; // Flag to ensure system instruction is added only once to the first user message

      // Add previous conversation turns, prepending system instruction to the first user message
      chatLog.forEach(msg => {
          if (msg.sender === "user") {
              if (!firstMessageProcessed) {
                  chatHistoryForAPI.push({
                      role: "user",
                      parts: [{ text: `${systemInstruction}\n${msg.text}` }]
                  });
                  firstMessageProcessed = true;
              } else {
                  chatHistoryForAPI.push({
                      role: "user",
                      parts: [{ text: msg.text }]
                  });
              }
          } else if (msg.sender === "bot") { // Bot messages are converted to 'model' role
              chatHistoryForAPI.push({
                  role: "model",
                  parts: [{ text: msg.text }]
              });
          }
      });

      // Add the current user input
      // If no previous messages have been added (i.e., this is the very first turn),
      // prepend system instructions to the current user input.
      if (!firstMessageProcessed) { // This means chatLog was empty (brand new conversation)
          const firstUserMessageParts = [];
          if (messageToSend) { // If there's text input from the user
              firstUserMessageParts.push({ text: `${systemInstruction}\n${messageToSend}` });
          } else { // If no text, just the system instruction (e.g., first message is just a file)
              firstUserMessageParts.push({ text: systemInstruction });
          }

          // Append file if present
          if (selectedFile) {
              const reader = new FileReader();
              const fileBase64 = await new Promise((resolve, reject) => {
                  reader.onloadend = () => resolve(reader.result.split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(selectedFile);
              });
              firstUserMessageParts.push({
                  inlineData: {
                      mimeType: selectedFile.type,
                      data: fileBase64,
                  },
              });
          }
          chatHistoryForAPI.push({ role: "user", parts: firstUserMessageParts });

      } else { // Not the very first user message in the history, just add current input normally
          chatHistoryForAPI.push({ role: "user", parts: currentInputParts });
      }

      const payload = {
        contents: chatHistoryForAPI,
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
        },
      };

      const apiKey = "AIzaSyA9kMJt63VaOeWxr8gooyUJBWOVOd5ceII"; // Placeholder - REPLACE WITH YOUR ACTUAL API KEY
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      let replyText = "Sorry, I couldn't get a response from Nexus."; // Default error message

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        replyText = result.candidates[0].content.parts[0].text;
      } else if (result.error) {
        replyText = `Error from API: ${result.error.message}`;
      } else {
        replyText = "An unexpected response was received from Nexus. Please try again.";
      }

      if (!signal.aborted) {
        await typeEffect(replyText); // Wait for typing effect to complete
      } else {
        setBotTypingText("");
      }

      const nameMatch = messageToSend.match(/(?:my name is|I'm)\s+([A-Z][a-z]+)/i);
      if (nameMatch) {
        const userName = nameMatch[1];
        setUserMemory(prev => ({ ...prev, name: userName }));
      }

    } catch (error) {
      if (error.name !== "AbortError") {
        let errorMsg = `Error connecting to Nexus: ${error.message || "Please check your network."}`;
        if (error.message.includes("API Error")) {
            errorMsg = `Nexus encountered an issue: ${error.message}. Please try again later.`;
        }
        setChatLog((prev) => [...prev, { sender: "bot", text: errorMsg, timestamp: new Date() }]);
      }
    } finally {
      if (!botReplyAddedRef.current && botTypingText.trim() !== "") {
          setChatLog((prev) => [...prev, { sender: "bot", text: botTypingText, timestamp: new Date() }]);
      }
      setLoading(false);
      setBotTypingText("");
      abortControllerRef.current = null;
      typingIntervalRef.current = null;
      botReplyAddedRef.current = false; // Reset for next message
    }
  }, [message, loading, chatLog, typeEffect, selectedFile, botTypingText, selectedPersonality, userMemory]);

  return (
    <div
      className={`h-screen flex flex-col items-center p-4 pb-0 relative font-inter transition-all duration-500 ease-in-out cursor-default
        ${darkMode
          ? "bg-gradient-to-br from-gray-900 to-black text-gray-100"
          : "bg-gradient-to-br from-blue-100 to-purple-200 text-gray-900"
        }`}
    >
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setDarkMode((prev) => !prev)}
        aria-label="Toggle dark mode"
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 transform hover:scale-105 cursor-pointer shadow-lg z-10"
      >
        {darkMode ? (
          <SunIcon className="h-6 w-6 text-yellow-300" />
        ) : (
          <MoonIcon className="h-6 w-6 text-indigo-800" />
        )}
      </button>

      {/* --- New Feature: AI Personalities Dropdown --- */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => setShowPersonalityDropdown(!showPersonalityDropdown)}
          className={`flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 shadow-lg text-sm
            ${darkMode ? "text-gray-100" : "text-gray-800"}`}
        >
          {AI_PERSONALITIES[selectedPersonality].icon}
          {AI_PERSONALITIES[selectedPersonality].name}
          <ChevronDownIcon className={`h-4 w-4 ml-2 transition-transform ${showPersonalityDropdown ? 'rotate-180' : ''}`} />
        </button>
        {showPersonalityDropdown && (
          <div className={`absolute left-0 mt-2 w-48 rounded-lg shadow-lg z-20
            ${darkMode ? "bg-gray-700 text-gray-100" : "bg-white text-gray-800"}`}>
            {Object.entries(AI_PERSONALITIES).map(([key, value]) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedPersonality(key);
                  setShowPersonalityDropdown(false);
                }}
                className={`flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600
                  ${selectedPersonality === key ? "font-bold" : ""} rounded-md`}
              >
                {value.icon}
                {value.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 sm:mb-8 drop-shadow-lg select-none text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse-light text-center">
        Nexus AI
      </h1>

      {/* Chat Box */}
      <div
        ref={chatBoxRef}
        className={`w-full max-w-3xl flex-1 overflow-y-auto rounded-3xl shadow-inset-lg p-4 sm:p-6 mb-4 sm:mb-6 scrollbar-hide
          ${darkMode ? "bg-gray-800/60" : "bg-white/70"}
          backdrop-blur-xl space-y-4 sm:space-y-5 border border-transparent
          ${darkMode ? "border-t-purple-700/50 border-l-blue-700/50" : "border-t-blue-300/50 border-l-purple-300/50"}
          transition-all duration-500 ease-in-out`}
        aria-live="polite"
        tabIndex={0}
      >
        {chatLog.length === 0 && !loading && (
          <div className="text-center text-gray-400 italic mt-10 sm:mt-20 text-sm sm:text-base">
            Start a conversation with Nexus!
            {userMemory.name && (
              <p className="mt-2">Welcome back, {userMemory.name}!</p>
            )}
          </div>
        )}
        {chatLog.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col max-w-[90%] sm:max-w-[75%] text-sm sm:text-base ${
              msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
            }`}
          >
            <span className={`text-xs font-medium mb-1 opacity-70 flex items-center ${
              msg.sender === "user"
                ? darkMode ? "text-blue-300" : "text-blue-600"
                : darkMode ? "text-purple-300" : "text-purple-600"
            }`}>
              {msg.sender === "user" ? <UserIcon className="h-3 w-3 mr-1" /> : AI_PERSONALITIES[selectedPersonality].icon}
              {msg.sender === "user" ? (userMemory.name || "You") : "Nexus"}
              <span className="ml-2 text-xs opacity-50">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </span>
            <div
              className={`px-4 py-2 sm:px-5 sm:py-3 rounded-2xl break-words whitespace-pre-wrap shadow-md transform transition-all duration-300 ease-out-back ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white"
                  : darkMode
                    ? "bg-gray-700 text-gray-50" // Improved contrast for bot in dark mode
                    : "bg-gray-200 text-gray-800"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* --- UI/UX Enhancement: Loading Indicator (Thinking dots) and Typing Animation --- */}
        {loading && botTypingText && (
          <div className="flex flex-col max-w-[90%] sm:max-w-[75%] mr-auto items-start text-sm sm:text-base">
            <span className={`text-xs font-medium mb-1 opacity-70 flex items-center ${darkMode ? "text-purple-300" : "text-purple-600"}`}>
              {AI_PERSONALITIES[selectedPersonality].icon}Nexus
            </span>
            <div
              className={`px-4 py-2 sm:px-5 sm:py-3 rounded-2xl italic break-words whitespace-pre-wrap shadow-md ${
                darkMode ? "bg-gray-700 text-gray-50" : "bg-gray-200 text-gray-800"
              }`}
            >
              {botTypingText}
              <span className="blinking-cursor text-purple-400">|</span>
            </div>
          </div>
        )}

        {loading && !botTypingText && (
          <div className="flex items-center justify-start text-purple-400 text-xs sm:text-sm animate-pulse ml-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce-dot animation-delay-0"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full ml-1 animate-bounce-dot animation-delay-100"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full ml-1 animate-bounce-dot animation-delay-200"></div>
            <span className="ml-2">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`w-full max-w-3xl flex items-center gap-2 sm:gap-3 p-2 rounded-xl shadow-xl backdrop-blur-lg
        ${darkMode ? "bg-gray-800/70 border border-purple-700/50" : "bg-white/80 border border-blue-300/50"}
        transition-all duration-500 ease-in-out mb-4`}>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="image/*, application/pdf, .txt, audio/*, video/*"
        />

        {/* Plus Icon Button (for attachments) */}
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={loading || !isAuthReady}
          aria-label="Attach file"
          className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-lg
            ${darkMode
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        <input
          type="text"
          value={message}
          placeholder={"Type your message to Nexus..."}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (!loading && (message.trim() || selectedFile)) {
                sendMessage();
              }
            }
          }}
          disabled={loading || !isAuthReady}
          aria-label="Type your message"
          className={`flex-1 px-3 py-2 sm:px-5 sm:py-3 rounded-xl border-none focus:outline-none focus:ring-0 placeholder-gray-400 text-sm sm:text-base
            ${darkMode
              ? "bg-gray-700/50 text-gray-100 caret-purple-400 focus:bg-gray-700"
              : "bg-white/70 text-gray-900 caret-blue-600 focus:bg-white"}
            disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
        />
        <button
          onClick={loading ? stopTyping : () => sendMessage()}
          disabled={(!message.trim() && !selectedFile && !loading) || !isAuthReady}
          aria-label={loading ? "Stop generating response" : "Send message"}
          className={`flex-shrink-0 px-4 py-2 sm:px-6 sm:py-3 rounded-xl transition-all duration-300 transform active:scale-95 shadow-lg text-sm sm:text-base
            ${loading
              ? darkMode
                ? "bg-red-600 text-white hover:bg-red-500 animate-pulse"
                : "bg-red-500 text-white hover:bg-red-400"
              : darkMode
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500"
              : "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-400 hover:to-purple-400"}
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <StopIcon className="h-5 w-5 inline-block sm:mr-1" />
          ) : (
            <PaperAirplaneIcon className="h-5 w-5 inline-block sm:mr-1" />
          )}
          <span className="hidden sm:inline">{loading ? "Stop" : "Send"}</span>
        </button>
      </div>
      {selectedFile && (
          <div className={`flex items-center justify-center space-x-2 p-2 rounded-lg text-xs sm:text-sm mt-2 mb-4
            ${darkMode ? "bg-gray-700 text-gray-200" : "bg-gray-200 text-gray-700"}`}>
            <span>
              {selectedFile.type.startsWith('image/') ? 'Image' : 'File'}: {selectedFile.name}
            </span>
            <button onClick={removeSelectedFile} className="text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }

        /* General scrollbar styling */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        /* Track */
        ::-webkit-scrollbar-track {
            background: transparent;
        }

        /* Handle */
        ::-webkit-scrollbar-thumb {
            background: rgba(156, 163, 175, 0.5); /* gray-400 with opacity */
            border-radius: 10px;
        }

        /* Handle on hover */
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(156, 163, 175, 0.7); /* darker on hover */
        }

        /* Dark mode scrollbar */
        body.dark-mode ::-webkit-scrollbar-thumb {
            background: rgba(75, 85, 99, 0.5); /* gray-600 with opacity */
        }
        body.dark-mode ::-webkit-scrollbar-thumb:hover {
            background: rgba(75, 85, 99, 0.7); /* darker on hover */
        }

        /* Hide scrollbar for IE, Edge and Firefox */
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        .blinking-cursor {
          font-weight: 100;
          font-size: 1.2em;
          color: #a855f7;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .shadow-inset-lg {
            box-shadow: inset 0 0 15px rgba(0,0,0,0.2);
        }

        .animate-pulse-light {
          animation: pulse-light 3s infinite ease-in-out;
        }
        @keyframes pulse-light {
          0%, 100% { opacity: 1; text-shadow: 0 0 5px rgba(96, 165, 250, 0.7); }
          50% { opacity: 0.8; text-shadow: 0 0 20px rgba(168, 85, 247, 0.9); }
        }

        .animate-bounce-dot {
            animation: bounce-dot 1s infinite cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        .animation-delay-0 { animation-delay: 0s; }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }

        @keyframes bounce-dot {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

export default App;