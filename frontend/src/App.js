import React, { useState, useRef, useEffect, useCallback } from "react";
import { SunIcon, MoonIcon, PaperAirplaneIcon, StopIcon, PlusIcon } from "@heroicons/react/24/solid";
// SpeechRecognition imports are still excluded based on your last request

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

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatLog, loading, botTypingText]);

  const typeEffect = useCallback((fullText) => {
    return new Promise((resolve) => {
      let i = 0;
      setBotTypingText("");
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      typingIntervalRef.current = setInterval(() => {
        setBotTypingText((prev) => prev + fullText.charAt(i));
        i++;
        if (i >= fullText.length) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
          resolve();
        }
      }, 30);
    });
  }, []);

  const stopTyping = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (botTypingText.trim() !== "" && !botReplyAddedRef.current) {
      setChatLog((prev) => [...prev, { sender: "bot", text: botTypingText, timestamp: new Date() }]);
      botReplyAddedRef.current = true;
    }
    setLoading(false);
    setBotTypingText("");
  }, [botTypingText]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Optional: Clear message input if a file is selected to focus on file-based prompt
      setMessage("");
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

    botReplyAddedRef.current = false;
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const currentInputParts = [];
      if (messageText) {
        currentInputParts.push({ text: messageText });
      }
      if (selectedFile) {
        setBotTypingText("Processing file...");
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

      await typeEffect(replyText);

      botReplyAddedRef.current = true;
      setChatLog((prev) => [...prev, { sender: "bot", text: replyText, timestamp: new Date() }]);

    } catch (error) {
      if (error.name !== "AbortError") {
        const errorMsg = `Error connecting to Muse: ${error.message || "Please check your network."}`;
        setChatLog((prev) => [...prev, { sender: "bot", text: errorMsg, timestamp: new Date() }]);
      }
    } finally {
      setLoading(false);
      setBotTypingText("");
      abortControllerRef.current = null;
      typingIntervalRef.current = null;
    }
    // FIXED: Removed 'stopTyping' from dependency array as it's an unnecessary dependency.
  }, [message, loading, chatLog, typeEffect, selectedFile]);


  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative font-inter transition-all duration-500 ease-in-out cursor-default
        ${darkMode
          ? "bg-gradient-to-br from-gray-900 to-black text-gray-100"
          : "bg-gradient-to-br from-blue-100 to-purple-200 text-gray-900"
        }`}
    >
      <button
        onClick={() => setDarkMode((prev) => !prev)}
        aria-label="Toggle dark mode"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 transform hover:scale-105 cursor-pointer shadow-lg z-10"
      >
        {darkMode ? (
          <SunIcon className="h-6 w-6 text-yellow-300" />
        ) : (
          <MoonIcon className="h-6 w-6 text-indigo-800" />
        )}
      </button>

      <h1 className="text-5xl font-extrabold mb-8 drop-shadow-lg select-none text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse-light">
        Muse AI
      </h1>

      <div
        ref={chatBoxRef}
        className={`w-full max-w-3xl h-[500px] sm:h-[600px] overflow-y-auto rounded-3xl shadow-inset-lg p-6 mb-6 scrollbar-hide
          ${darkMode ? "bg-gray-800/60" : "bg-white/70"}
          backdrop-blur-xl space-y-5 border border-transparent
          ${darkMode ? "border-t-purple-700/50 border-l-blue-700/50" : "border-t-blue-300/50 border-l-purple-300/50"}
          transition-all duration-500 ease-in-out`}
        aria-live="polite"
        tabIndex={0}
      >
        {chatLog.length === 0 && !loading && (
          <div className="text-center text-gray-400 italic mt-20">
            Start a conversation with Muse! Your chat history will be saved.
          </div>
        )}
        {chatLog.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col max-w-[85%] sm:max-w-[75%] text-base ${
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
              className={`px-5 py-3 rounded-2xl break-words whitespace-pre-wrap shadow-md transform transition-all duration-300 ease-out-back ${
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
          <div className="flex flex-col max-w-[85%] sm:max-w-[75%] mr-auto items-start text-base">
            <span className={`text-xs font-medium mb-1 opacity-70 ${darkMode ? "text-purple-300" : "text-purple-600"}`}>Muse</span>
            <div
              className={`px-5 py-3 rounded-2xl italic break-words whitespace-pre-wrap shadow-md ${
                darkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              {botTypingText}
              <span className="blinking-cursor text-purple-400">|</span>
            </div>
          </div>
        )}

        {loading && !botTypingText && (
          <div className="flex items-center justify-start text-purple-400 text-sm animate-pulse ml-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce-dot animation-delay-0"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full ml-1 animate-bounce-dot animation-delay-100"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full ml-1 animate-bounce-dot animation-delay-200"></div>
            <span className="ml-2">Thinking...</span>
          </div>
        )}
      </div>

      <div className={`w-full max-w-3xl flex gap-3 p-2 rounded-xl shadow-xl backdrop-blur-lg
        ${darkMode ? "bg-gray-800/70 border border-purple-700/50" : "bg-white/80 border border-blue-300/50"}
        transition-all duration-500 ease-in-out`}>

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
          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-lg
            ${darkMode
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <PlusIcon className="h-6 w-6" />
        </button>

        <input
          type="text"
          value={message}
          placeholder={"Type your message to Muse..."}
          onChange={(e) => setMessage(e.target.value)}
          // FIXED: Added parentheses to clarify the order of operations for '&&' and '||'
          onKeyDown={(e) => (e.key === "Enter" && ((!message.trim() && !selectedFile) || loading)) ? null : (e.key === "Enter" && sendMessage())}
          disabled={loading || !isAuthReady}
          aria-label="Type your message"
          className={`flex-1 px-5 py-3 rounded-xl border-none focus:outline-none focus:ring-0 placeholder-gray-400
            ${darkMode
              ? "bg-gray-700/50 text-gray-100 caret-purple-400 focus:bg-gray-700"
              : "bg-white/70 text-gray-900 caret-blue-600 focus:bg-white"}
            disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
        />
        <button
          onClick={loading ? stopTyping : sendMessage}
          disabled={(!message.trim() && !selectedFile) || loading || !isAuthReady}
          aria-label={loading ? "Stop generating response" : "Send message"}
          className={`flex-shrink-0 px-6 py-3 rounded-xl transition-all duration-300 transform active:scale-95 shadow-lg
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
            <StopIcon className="h-5 w-5 inline-block mr-1" />
          ) : (
            <PaperAirplaneIcon className="h-5 w-5 inline-block mr-1 transform rotate-90" />
          )}
          {loading ? "Stop" : "Send"}
        </button>
      </div>
      {selectedFile && (
          <div className="flex items-center justify-center space-x-2 bg-gray-200 dark:bg-gray-700 p-2 rounded-lg text-sm mt-2">
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