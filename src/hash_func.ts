
export function genrate_hash(len:number):string{
 
       const str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
       let ans="";

       for(let i=0;i<len;i++){
                ans+=str[Math.floor(Math.random()*str.length)]
       }
       return ans;
}