import React from "react";

interface Message {
  type: "user" | "system";
  text: string;
}

interface ChatMessagesProps {
  messages: Message[];
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages }) => (
  <div className="mt-8 mb-4">
    <div className="max-w-3xl mx-auto">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex items-start ${
            message.type === "user" ? "justify-end" : ""
          }`}
        >
          <div
            className={`flex-1 max-w-[80%] ${
              message.type === "system" ? "bg-blue-50" : "bg-gray-100"
            } rounded-[5px] p-5 mb-4`}
          >
            <p
              className={`text-sm text-gray-800 ${
                message.type === "user" ? "text-right" : "text-left"
              }`}
            >
              {message.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ChatMessages;
