import mongoose, { model } from "mongoose"

import { Schema } from "mongoose"
import { config } from "./config"


mongoose.connect(config.mongoUrl)

const Users_Schema=new Schema({
    username:{type:String, required:true,unique:true},
    password:{type:String ,required:true}
})

const contentTypes=["audio","article","twitter","youtube"]

const Content_Schema=new Schema({
link: { type: String, required: true },
  type: { type: String, enum: contentTypes, required: true },
  title: { type: String, required: true },
  tags: [{ type: mongoose.Types.ObjectId, ref: 'Tag' }],
  userId: { type: mongoose.Types.ObjectId, ref: 'Users', required: true },
 embedding: { type: [Number], default: undefined }

})




const Tags_schema=new Schema({
    title:{type:String,required:true,unique:true}
})

const Link_schema=new Schema({
    hash:{type :String},
    userId:{type:mongoose.Types.ObjectId , ref:'Users',required:true}
})



export const link_model=model("links",Link_schema)
export const  user_model=model("Users",Users_Schema)
export const  content_model=model("content",Content_Schema)


