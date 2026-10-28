import pg from "pg";
import http from "node:http";
export const auth = new pg.Pool({connectionString:process.env.AUTH_DB_URL});
export const profile = new pg.Pool({connectionString:process.env.PROFILE_DB_URL});
http.createServer((_request,response)=>response.end("Two managed data targets")).listen(Number(process.env.PORT??3000));
