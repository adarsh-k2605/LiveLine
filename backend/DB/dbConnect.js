import mongoose from "mongoose";

const dbConnect = async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("DB connected Successfully")
    } catch (error) {
        console.error("DB connection Failed!!", error)
    }
}


export default dbConnect