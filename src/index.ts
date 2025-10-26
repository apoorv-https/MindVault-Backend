import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import Jwt from "jsonwebtoken";
import { z } from "zod";
import bcrpyt from "bcrypt";
import mongoose from 'mongoose';
import cors from "cors";
import { content_model, link_model, user_model } from "./db";
import { config } from "./config";
import { userMiddleware } from "./middleware";
import { genrate_hash } from "./hash_func";
import { getEmbedding } from "./utils/embedding";

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection state
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log("Using existing MongoDB connection");
        return;
    }
    
    try {
        const db = await mongoose.connect(config.mongoUrl);
        isConnected = db.connection.readyState === 1;
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
        isConnected = false;
        throw err;
    }
};

// Middleware to ensure connection before each request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        res.status(500).json({ 
            message: "Database connection failed",
            error: "Could not connect to MongoDB"
        });
    }
});

// ROOT ROUTE - For testing deployment
app.get("/", (req, res) => {
    res.json({ 
        message: "MindVault API is running!",
        version: "1.0.0",
        status: "active",
        endpoints: [
            "POST /api/v1/signup",
            "POST /api/v1/signin",
            "POST /api/v1/content",
            "GET /api/v1/content",
            "DELETE /api/v1/content",
            "GET /api/v1/search",
            "POST /api/v1/brain/share",
            "GET /api/v1/brain/:shareLink"
        ]
    });
});

// FOR SIGNUP
app.post("/api/v1/signup", async (req, res) => {
    const required_body = z.object({
        username: z.string().min(3).max(10),
        password: z.string().min(6).max(20)
            .refine((val) => /[a-z]/.test(val), {
                "message": "Password must contain at least 1 lowercase letter"
            })
            .refine((val) => /[A-Z]/.test(val), {
                "message": "Password must contain at least 1 uppercase letter"
            })
            .refine((val) => /[0-9]/.test(val), {
                "message": "Password must contain at least 1 digit"
            })
            .refine((val) => /[^a-zA-Z0-9]/.test(val), {
                "message": "Password must contain at least 1 special character"
            })
    });

    const parse_data = required_body.safeParse(req.body);
    if (!parse_data.success) {
       return res.status(400).json({
            errors: parse_data.error
        });
    }

    const username = req.body.username;
    const password = req.body.password;
    const hashpassword = await bcrpyt.hash(password, 5);

    try {
        await user_model.create({
            username: username,
            password: hashpassword
        });

        return res.status(200).json({
            message: "Sign-up Successfully"
        });
    } catch (e) {
        return res.status(403).json({
            message: "User Already Exists"
        });
    }
});

// FOR SIGNIN
app.post("/api/v1/signin", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const user = await user_model.findOne({
            username: username
        });

        if (user) {
            let temp = user.password;
            const password_verify = await bcrpyt.compare(password, temp);
            
            if (password_verify) {
                const token = Jwt.sign({id: user._id}, config.JWT_SIGN);
                return res.status(200).json({
                    message: "Sign In Successfully",
                    "token": token
                });
            } else {
                return res.status(403).json({
                    message: "Wrong email password"
                });
            }
        } else {
            return res.status(404).json({
                message: "User Not found"
            });
        }
    } catch(e) {
        return res.status(500).json({
            message: "Internal Server error"
        });
    }
});

// FOR ADDING CONTENT
app.post("/api/v1/content", userMiddleware, async (req, res) => {
    const link = req.body.link;
    const type = req.body.type;
    const title = req.body.title;

    try {
        const content = await content_model.create({
            link,
            type,
            title,
            //@ts-ignore
            userId: req.userId,
            tags: [],
            embedding: undefined
        });

        res.status(200).json({
            message: "Content Added"
        });

        let embeddingText = title;
        
        if (type === 'youtube') {
            embeddingText = `${title} youtube video content tutorial`;
        } else if (type === 'twitter') {
            embeddingText = `${title} twitter tweet post social media`;
        }
        
        getEmbedding(embeddingText)
            .then(async (embedding) => {
                await content_model.updateOne(
                    { _id: content._id },
                    { $set: { embedding } }
                );
            })
            .catch((error) => {
                return res.status(404).json({
                    message: "Embedding failed:"
                });
            });

    } catch (e) {
        console.error("❌ Error:", e);
        return res.status(500).json({
            message: "Error Content not added"
        });
    }
});

// FOR GETTING CONTENT
app.get("/api/v1/content", userMiddleware, async(req, res) => {
    //@ts-ignore
    const userId = req.userId;
     
    try {
        const content = await content_model.find({
            userId
        }).populate("userId", "username").sort({ createdAt: -1 });
        
        res.json({
            content
        });
    } catch(e) {
        res.json({
            message: "Content Not found"
        });
    }
});

// FOR DELETING CONTENT
app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    const content_id = req.body.content_id;
    //@ts-ignore
    const userId = req.userId;

    try {
        await content_model.deleteOne({
            _id: content_id,
            userId
        });
        
        res.json({
            message: "Content Deleted"
        });
    } catch(e) {
        res.json({
            message: "Content not deleted"
        });
    }
});

// FOR SEARCHING
app.get("/api/v1/search", userMiddleware, async (req, res) => {
    try {
        const query = req.query.q as string;
        const userThreshold = 0.75;
      
        if (!query || query.trim().length === 0) {
            return res.status(400).json({ 
                error: "Search query is required" 
            });
        }

        const queryEmbedding = await getEmbedding(query);

        const results = await content_model.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 200, 
                    limit: 50, 
                    filter: { 
                        //@ts-ignore
                        userId: new mongoose.Types.ObjectId(req.userId) 
                    }
                }
            },
            {
                $project: {
                    title: 1,
                    link: 1,
                    type: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]);

        const filteredResults = results
            .filter(r => r.score >= userThreshold) 
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        res.json({ 
            query,
            threshold: userThreshold,
            totalResults: results.length,
            count: filteredResults.length,
            results: filteredResults
        });

    } catch (error: any) {
        res.status(500).json({ 
            error: "Search failed",
            message: error.message 
        });
    }
});

// SHARE ENDPOINT
app.post("/api/v1/brain/share", userMiddleware, async(req, res) => {
    const share = req.body.share;

    if (share) {
        const exist = await link_model.findOne({
            //@ts-ignore
            userId: req.userId,
        });

        if (exist) {
            return res.json({
                hash: exist.hash
            });
        } else {
            const hash = genrate_hash(10);
            await link_model.create({
                //@ts-ignore
                userId: req.userId,
                hash
            });
            return res.json({
                hash
            });
        }
    } else {
        await link_model.deleteOne({
            //@ts-ignore
            userId: req.userId
        });
        return res.json({
            message: "Entry Deleted"
        });
    }
});

// SHARE LINK ENDPOINT
app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const hash = req.params.shareLink;
    const link = await link_model.findOne({
        hash
    });

    if (!link) {
        return res.status(411).json({
            "message": "hash is incorrect"
        });
    }

    const content = await content_model.find({
        userId: link.userId
    });

    const user = await user_model.findOne({
        _id: link.userId
    });

    if (!user) {
        return res.status(411).json({
            "message": "user not found Unexpected"
        });
    }
       
    res.json({
        content,
        username: user?.username
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// Export for Vercel
export default app;