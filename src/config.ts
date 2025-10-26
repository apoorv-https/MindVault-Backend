

import dotenv from "dotenv";

dotenv.config(); 

export const config = {
 JWT_SIGN : process.env.JWT_SIGN as string,
  mongoUrl: process.env.MONGO_URL as string,
  port: process.env.PORT || 5000,
};
