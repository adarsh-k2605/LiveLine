import mongoose from "mongoose";
import Conversation from "./conversationModels.js";

const messageSchema = mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Text content of the message (optional if this is a pure file message)
    message: {
      type: String,
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: [],
    },

    // Optional file attachment metadata
    fileUrl: {
      type: String,
      default: null,
    },
    fileType: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },

    // Track whether the receiver has seen this message
    seen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
