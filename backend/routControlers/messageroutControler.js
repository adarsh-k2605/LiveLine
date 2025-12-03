import Message from "../Models/messageModels.js";
import Conversation from "../Models/conversationModels.js";

export const sendMessage = async(req,res)=>{
    try {
        const { message } = req.body;
        const {id:receiverId} = req.params;
        const senderId = req.user._conditions._id;

        let chats = await Conversation.findOne({
            participants:{$all:[senderId, receiverId]}
        })

        if(!chats){
            chats = await Conversation.create({
                participants:[senderId, receiverId],
            })
        }

        const payload = {
            senderId,
            receiverId,
            conversationId:chats._id,
        };

        if (message && message.trim() !== "") {
            payload.message = message;
        }

        if (req.file) {
            payload.fileUrl = `/uploads/${req.file.filename}`;
            payload.fileType = req.file.mimetype;
            payload.fileName = req.file.originalname;
        }

        if (!payload.message && !payload.fileUrl) {
            return res.status(400).send({
                success: false,
                message: "Message text or file is required",
            });
        }

        const newMessages = new Message(payload)
        
        if(newMessages){
            chats.messages.push(newMessages._id)
        }

    //  SOCKET.IO Function
        await Promise.all([chats.save(), newMessages.save()])    

        res.status(200).send(newMessages)
    } catch (error) {
        console.error("Send message error:", error); // logs in console
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

export const getMessages = async(req,res)=>{
    try {
        const {id:receiverId} = req.params;
        const senderId = req.user._conditions._id;

        const chats = await Conversation.findOne({
            participants:{$all:[senderId,receiverId]}
        }).populate("messages")

        if(!chats)  return res.status(200).send([]);
        const message = chats.messages;

        // Mark all messages that the current user received in this conversation as seen
        await Message.updateMany(
            {
                conversationId: chats._id,
                receiverId: senderId,
                seen: false,
            },
            {
                $set: { seen: true, seenAt: new Date() },
            }
        );

        res.status(200).send(message)

    } catch (error) {
        console.error("Get message error:", error); // logs in console
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

// Delete entire conversation between current user and receiver
export const deleteConversation = async (req, res) => {
    try {
        const { id: receiverId } = req.params;
        const senderId = req.user._conditions._id;

        const chats = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] },
        });

        if (!chats) {
            return res.status(200).send({
                success: true,
                message: "No conversation to delete",
            });
        }

        await Message.deleteMany({ conversationId: chats._id });
        await chats.deleteOne();

        res.status(200).send({
            success: true,
            message: "Conversation deleted successfully",
        });
    } catch (error) {
        console.error("Delete conversation error:", error);
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

// Delete selected messages (only messages sent by current user)
export const deleteMessages = async (req, res) => {
    try {
        const senderId = req.user._conditions._id;
        const { messageIds } = req.body;

        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).send({
                success: false,
                message: "messageIds array is required",
            });
        }

        const messagesToDelete = await Message.find({
            _id: { $in: messageIds },
            senderId,
        }).select("_id");

        const ids = messagesToDelete.map((m) => m._id);

        if (ids.length === 0) {
            return res.status(200).send({
                success: true,
                message: "No messages deleted (not owned by user)",
                deletedCount: 0,
            });
        }

        await Message.deleteMany({ _id: { $in: ids } });
        await Conversation.updateMany(
            { messages: { $in: ids } },
            { $pull: { messages: { $in: ids } } }
        );

        res.status(200).send({
            success: true,
            message: "Selected messages deleted",
            deletedCount: ids.length,
        });
    } catch (error) {
        console.error("Delete messages error:", error);
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};