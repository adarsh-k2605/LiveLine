import express from "express"
import { getMessages, sendMessage, deleteConversation, deleteMessages } from "../routControlers/messageroutControler.js";
import isLogin from "../middleware/isLogin.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Support text + optional single file attachment
router.post('/send/:id', isLogin, upload.single("file"), sendMessage)

router.get('/:id',isLogin,getMessages)

// Delete entire conversation between current user and :id
router.delete('/clear/:id', isLogin, deleteConversation)

// Delete selected messages (body: { messageIds: [] })
router.delete('/bulk/:id', isLogin, deleteMessages)



export default router;