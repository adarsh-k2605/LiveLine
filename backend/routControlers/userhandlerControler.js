import User from "../Models/userModels.js";
import Conversation from "../Models/conversationModels.js";
import Message from "../Models/messageModels.js";

export const getUserBySearch = async (req, res) => {
    try {
        const search = req.query.search || '';
        const currentUserID = req.user._conditions._id;
        const user = await User.find({
            $and: [
                {
                    $or: [
                        { username: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { fullname: { $regex: '.*' + search + '.*', $options: 'i' } }
                    ]
                }, {
                    _id: { $ne: currentUserID }
                }
            ]
        }).select("-password").select("email")

        res.status(200).send(user)

    } catch (error) {
        console.error("User Search error:", error);
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

export const getCurrentChatters = async(req,res)=>{
    try {
        const currentUserID = req.user._conditions._id;
        const currenTChatters = await Conversation.find({
            participants:currentUserID
        }).sort({
            updatedAt: -1
            });

            if(!currenTChatters || currenTChatters.length === 0)  return res.status(200).send([]);

            const partcipantsIDS = currenTChatters.reduce((ids,conversation)=>{
                const otherParticipents = conversation.participants.filter(id => id !== currentUserID);
                return [...ids , ...otherParticipents]
            },[])

            const otherParticipentsIDS = partcipantsIDS.filter(id => id.toString() !== currentUserID.toString());

            const user = await User.find({_id:{$in:otherParticipentsIDS}}).select("-password").select("-email");

            const users = otherParticipentsIDS.map(id => user.find(user => user._id.toString() === id.toString()));

            // For each participant, compute how many unseen messages for the current user
            const unseen = await Message.aggregate([
                {
                    $match: {
                        receiverId: currentUserID,
                        senderId: { $in: otherParticipentsIDS },
                        seen: false,
                    },
                },
                {
                    $group: {
                        _id: "$senderId",
                        count: { $sum: 1 },
                    },
                },
            ]);

            const unseenMap = unseen.reduce((map, item) => {
                map[item._id.toString()] = item.count;
                return map;
            }, {});

            const usersWithMeta = users.map((u) => {
                if (!u) return u;
                const obj = u.toObject();
                return {
                    ...obj,
                    unseenCount: unseenMap[u._id.toString()] || 0,
                };
            });

            res.status(200).send(usersWithMeta)
    } catch (error) {
        console.error("Current Chatters Search error:", error);
        res.status(500).send({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}