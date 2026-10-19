import { createServer } from 'node:http';
import { createApplication } from './app.mjs';

const port=Number(process.env.PORT??8791);
const host=process.env.HOST??'127.0.0.1';
const origin=process.env.PUBLIC_ORIGIN??`http://127.0.0.1:${port}`;
const application=await createApplication({origin,directory:process.env.REPLY_DATA_DIR??'./.reply-data',secret:process.env.AUTH_SECRET,encryptionKey:process.env.ACCOUNT_ENCRYPTION_KEY,resendKey:process.env.RESEND_API_KEY,emailFrom:process.env.EMAIL_FROM,dryRun:process.env.DRY_RUN!=='false'});
const server=createServer(async(incoming,outgoing)=>{
  try {
    const chunks=[];let size=0;
    for await(const chunk of incoming){size+=chunk.length;if(size>2_000_000){outgoing.writeHead(413);outgoing.end('Request too large');return;}chunks.push(chunk);}
    const headers=new Headers();for(const[key,value]of Object.entries(incoming.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
    const body=Buffer.concat(chunks),method=incoming.method??'GET';
    const request=new Request(new URL(incoming.url??'/',origin),{method,headers,...(!['GET','HEAD'].includes(method)?{body}:{})});
    const ip=process.env.TRUST_PROXY==='true'?String(incoming.headers['x-real-ip']??incoming.socket.remoteAddress):incoming.socket.remoteAddress;
    const response=await application.handle(request,{ip});
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('Request failed:',error?.code??error?.name??'Error');outgoing.writeHead(500,{'content-type':'text/plain; charset=utf-8'});outgoing.end('تعذّر تنفيذ الطلب. تواصل مع Helpdsek.');}
});
server.requestTimeout=30_000;server.headersTimeout=15_000;
server.listen(port,host,()=>console.log(`Reply: ${origin} — email OTP ${process.env.RESEND_API_KEY&&process.env.EMAIL_FROM?'configured':'not configured'}`));
const timer=setInterval(()=>application.scheduled().catch(error=>console.error('Scheduled check failed:',error?.name??'Error')),60_000);timer.unref();
function stop(){clearInterval(timer);server.close(()=>{application.close();process.exit(0);});setTimeout(()=>process.exit(1),10_000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
