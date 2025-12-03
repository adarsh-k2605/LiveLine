import express from "express"
import dotenv from "dotenv"
import dbConnect from "./DB/dbConnect.js";
import authRouter from "./rout/authUser.js"
import messageRouter from "./rout/messageRout.js"
import userRouter from "./rout/userRout.js"
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const app = express();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS so frontend (Vite dev) can talk to backend with cookies
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/api/auth', authRouter)
app.use('/api/message', messageRouter)
app.use('/api/user', userRouter)

app.get('/',(req,res)=>{
    res.send("Server is Working...")
})

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
    dbConnect();
    console.log(`Working at ${PORT}`);
    
})
