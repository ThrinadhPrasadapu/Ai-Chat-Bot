from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)


API_KEY = "AIzaSyC5xZZf8IxaylTBd90hWQ-VdiTVHQJ-gYQ"
genai.configure(api_key=API_KEY)

# Initialize the Generative Model.
# gemini-2.0-flash is a good choice for fast, conversational responses.
model = genai.GenerativeModel("gemini-2.0-flash")

@app.route("/")
def home():
    """
    Simple home route to confirm the Flask backend is running.
    """
    return "Flask backend is running! Go to /api/chat to chat."

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Handles incoming chat messages, formats them for the Gemini API,
    and sends them to the generative model.
    """
    data = request.get_json()
    # Expects a list of message objects, each with 'sender' (user/bot) and 'text'.
    messages = data.get("messages")

    # Validate incoming messages
    if not messages or not isinstance(messages, list):
        return jsonify({"error": "No messages provided or invalid format"}), 400

    # Build contents with the correct Gemini API format (using 'role' instead of 'author')
    contents = []
    for msg in messages:

        role = "user" if msg.get("sender") == "user" else "model"
        text = msg.get("text", "")

        # Append the message in the format expected by model.generate_content()
        contents.append({
            "role": role,  # Corrected from 'author' to 'role'
            "parts": [{"text": text}]
        })

    try:

        response = model.generate_content(contents=contents)

        # Return the generated text response from the model
        return jsonify({"reply": response.text})
    except Exception as e:
        # Catch any exceptions during the API call and return an error
        print(f"Error calling Gemini API: {e}") # Log the error for debugging
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
