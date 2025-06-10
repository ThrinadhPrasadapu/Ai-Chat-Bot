import React, { useState, useRef, useEffect, useCallback } from "react";
import { SunIcon, MoonIcon, PaperAirplaneIcon, StopIcon, PlusIcon } from "@heroicons/react/24/solid";

function App() {
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [botTypingText, setBotTypingText] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : true;
  });

  const [isAuthReady] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  const chatBoxRef = useRef(null);
  const abortControllerRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const botReplyAddedRef = useRef(false);
  const fileInputRef = useRef(null);

  // NEW: Ref to track if the user has scrolled up
  const isScrolledUpRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  // Modified useEffect for smart scrolling
  useEffect(() => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      // If user is not scrolled up, or if a new *full* message was just added, scroll to bottom
      // We check for `loading === false` to ensure a scroll after a response is fully displayed.
      // And we also scroll when a user sends a message (chatLog.length increases)
      // or if loading is false and botTypingText is empty (meaning the bot finished typing and the message was added)
      if (!isScrolledUpRef.current || (chatLog.length > 0 && chatLog[chatLog.length - 1].sender !== 'bot' && !loading) || (!loading && botTypingText === "" && botReplyAddedRef.current)) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }
  }, [chatLog, loading, botTypingText]); // Dependencies remain to react to state changes

  // NEW: useEffect to attach scroll listener
  useEffect(() => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      const handleScroll = () => {
        // Determine if the user has scrolled up from the very bottom
        const atBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 1; // A small tolerance
        isScrolledUpRef.current = !atBottom;
      };

      chatBox.addEventListener('scroll', handleScroll);
      // Clean up the event listener when the component unmounts or chatBoxRef changes
      return () => {
        chatBox.removeEventListener('scroll', handleScroll);
      };
    }
  }, []); // Empty dependency array means this runs once on mount

  const typeEffect = useCallback((fullText) => {
    return new Promise((resolve) => {
      let i = 0;
      setBotTypingText(""); // Start fresh for new typing
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      typingIntervalRef.current = setInterval(() => {
        // Check if interval should still run
        if (!abortControllerRef.current || !abortControllerRef.current.signal.aborted) {
            setBotTypingText((prev) => prev + fullText.charAt(i));
            i++;
            if (i >= fullText.length) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
                // Add the completed message to chatLog after typing effect finishes
                if (!botReplyAddedRef.current) {
                    setChatLog((prev) => [...prev, { sender: "bot", text: fullText, timestamp: new Date() }]);
                    botReplyAddedRef.current = true;
                }
                resolve();
            }
        } else {
            // If aborted during typing, clear interval and resolve
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            resolve();
        }
      }, 30);
    });
  }, []);

  const stopTyping = useCallback(() => {
    // Immediately clear the typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null; // Clear the ref after aborting
    }

    // Capture the current botTypingText and add it to chatLog if it's not empty
    // and hasn't been added yet.
    if (botTypingText.trim() !== "" && !botReplyAddedRef.current) {
      setChatLog((prev) => [...prev, { sender: "bot", text: botTypingText, timestamp: new Date() }]);
      botReplyAddedRef.current = true; // Mark as added
    }

    // Reset loading state and clear typing text
    setLoading(false);
    setBotTypingText("");

  }, [botTypingText]); // Dependency array for useCallback

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage(""); // Optional: Clear message input if a file is selected
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = useCallback(async () => {
    const messageText = message.trim();

    if ((!messageText && !selectedFile) || loading) {
      return;
    }

    let displayMessage = messageText;
    if (selectedFile) {
        displayMessage = messageText ? `${messageText} (File: ${selectedFile.name})` : `File: ${selectedFile.name}`;
    }
    setChatLog((prev) => [...prev, { sender: "user", text: displayMessage, timestamp: new Date() }]);

    setLoading(true);
    setBotTypingText("");
    setMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear file input value
    }

    botReplyAddedRef.current = false;
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const currentInputParts = [];
      if (messageText) {
        currentInputParts.push({ text: messageText });
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

      const chatHistoryForAPI = chatLog.map(msg => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      }));

      chatHistoryForAPI.push({ role: "user", parts: currentInputParts });

      const payload = {
        contents: chatHistoryForAPI,
        generationConfig: {},
      };

      // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      // WARNING: EXPOSING API KEY IN FRONTEND IS INSECURE FOR PRODUCTION.
      // USE A BACKEND PROXY TO PROTECT YOUR API KEY.
      // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      const apiKey = "AIzaSyC5xZZf8IxaylTBd90hWQ-VdiTVHQJ-gYQ";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      const result = await response.json();
      let replyText = "Sorry, I couldn't get a response from Muse.";

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        replyText = result.candidates[0].content.parts[0].text;
      } else if (result.error) {
        replyText = `Error from API: ${result.error.message}`;
      }

      // Check if the signal was aborted before starting typeEffect
      if (!signal.aborted) {
        await typeEffect(replyText); // Wait for typing effect to complete
        // The message is now added within typeEffect when it completes naturally
      } else {
        // If aborted before typing, ensure botTypingText is cleared
        setBotTypingText("");
      }

    } catch (error) {
      if (error.name !== "AbortError") {
        const errorMsg = `Error connecting to Muse: ${error.message || "Please check your network."}`;
        setChatLog((prev) => [...prev, { sender: "bot", text: errorMsg, timestamp: new Date() }]);
      }
    } finally {
      // Clean up, ensuring the botReplyAddedRef is reset for the next message
      if (!botReplyAddedRef.current && botTypingText.trim() !== "") {
          setChatLog((prev) => [...prev, { sender: "bot", text: botTypingText, timestamp: new Date() }]);
      }
      setLoading(false);
      setBotTypingText("");
      abortControllerRef.current = null;
      typingIntervalRef.current = null;
      botReplyAddedRef.current = false; // Reset for next message
    }
  }, [message, loading, chatLog, typeEffect, selectedFile, botTypingText]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-between p-4 pb-0 relative font-inter transition-all duration-500 ease-in-out cursor-default
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

      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 sm:mb-8 drop-shadow-lg select-none text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse-light text-center">
        Muse AI
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
            Start a conversation with Muse! Your chat history will be saved.
          </div>
        )}
        {chatLog.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col max-w-[90%] sm:max-w-[75%] text-sm sm:text-base ${
              msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
            }`}
          >
            <span className={`text-xs font-medium mb-1 opacity-70 ${
              msg.sender === "user"
                ? darkMode ? "text-blue-300" : "text-blue-600"
                : darkMode ? "text-purple-300" : "text-purple-600"
            }`}>
              {msg.sender === "user" ? "You" : "Muse"}
            </span>
            <div
              className={`px-4 py-2 sm:px-5 sm:py-3 rounded-2xl break-words whitespace-pre-wrap shadow-md transform transition-all duration-300 ease-out-back ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white"
                  : darkMode
                    ? "bg-gray-700 text-white"
                    : "bg-gray-200 text-gray-800"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && botTypingText && (
          <div className="flex flex-col max-w-[90%] sm:max-w-[75%] mr-auto items-start text-sm sm:text-base">
            <span className={`text-xs font-medium mb-1 opacity-70 ${darkMode ? "text-purple-300" : "text-purple-600"}`}>Muse</span>
            <div
              className={`px-4 py-2 sm:px-5 sm:py-3 rounded-2xl italic break-words whitespace-pre-wrap shadow-md ${
                darkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-800"
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
        transition-all duration-500 ease-in-out mb-4`}> {/* Added mb-4 for spacing */}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="image/*, application/pdf, .txt, audio/*, video/*" // Broaden accepted file types
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
          placeholder={"Type your message to Muse..."}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Only trigger sendMessage if not already loading and there's content or a file
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
          onClick={loading ? stopTyping : sendMessage}
          disabled={(!message.trim() && !selectedFile && !loading) || !isAuthReady} // Disabled if nothing to send AND not already loading
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
            // CORRECTED: Removed `transform rotate-90`
            <PaperAirplaneIcon className="h-5 w-5 inline-block sm:mr-1" />
          )}
          <span className="hidden sm:inline">{loading ? "Stop" : "Send"}</span>
        </button>
      </div>
      {selectedFile && (
          <div className="flex items-center justify-center space-x-2 bg-gray-200 dark:bg-gray-700 p-2 rounded-lg text-xs sm:text-sm mt-2 mb-4">
            <span className={darkMode ? "text-gray-200" : "text-gray-700"}>
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

        /* Hide scrollbar for Chrome, Safari and Opera */
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }

        /* Hide scrollbar for IE, Edge and Firefox */
        .scrollbar-hide {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
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