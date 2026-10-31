const button=document.getElementById('runCheck'),output=document.getElementById('checkResult');
async function request(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000),start=performance.now();
 try{const r=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error(`HTTP ${r.status}`);return {body:await r.json(),ms:Math.round(performance.now()-start)};}
 finally{clearTimeout(timer);}
}
button.addEventListener('click',async()=>{
 button.disabled=true;output.textContent=`检查时间：${new Date().toISOString()}\n`;
 let stage='网站配置';
 try{
  const {body:config,ms}=await request('./collection_config.json');
  if(!/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(config.endpoint))throw Error('保存地址配置无效');
  output.textContent+=`✓ 网站配置可达（${ms} ms）\n保存地址：${config.endpoint}\n`;
  stage='公开统计接口';
  const endpoint=config.endpoint.replace(/\/$/,'');
  const result=await request(`${endpoint}/experience/community?pairs=4b2ed93255b86179`);
  if(!result.body.pairs || typeof result.body.pairs!=='object')throw Error('接口响应格式不符');
  output.textContent+=`✓ 公开统计接口可达（${result.ms} ms）\n\n未提交作答。此结果仅说明当前网络下读取成功；仍需单独验证真实保存。`;
 }catch(e){output.textContent+=`✕ ${stage}失败：${e.name==='AbortError'?'12 秒内未收到响应':e.message}\n\n浏览器网络错误可能来自连接、域名解析或跨域限制，不能仅凭此信息确定根因。选画可继续，尚未上传的选择请保留在原浏览器中。`;}
 finally{button.disabled=false;}
});
