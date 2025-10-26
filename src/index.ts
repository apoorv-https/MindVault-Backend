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

// ... rest of your routes (keep everything the same) ...

// For local development only
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => {
        console.log("✅ Server running on port 3000");
    });
}

// Export for Vercel
export default app;
