
import { Request,Response,NextFunction } from "express"

import jwt, { decode } from "jsonwebtoken"
import { config } from "./config";

export  function userMiddleware(req:Request,res:Response,next:NextFunction){


    const token=req.headers["authorization"];

    const decoded=jwt.verify(token  as string,config.JWT_SIGN);

    if(decoded){
        // @ts-ignore
        req.userId=decoded.id;
        next()
    }
    else {
        return res.status(404).json({
            message:"Incorrect Crendentials"
        })
    }

}