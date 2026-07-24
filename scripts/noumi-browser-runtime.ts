/** iframe Bridge 协议版本；必须和主平台可信外壳保持一致。 */
const BRIDGE_VERSION = 1;

/** iframe 通知可信外壳已准备接收启动上下文。 */
const BRIDGE_READY_MESSAGE = "noumi:light-system:bridge:ready";

/** 可信外壳向 iframe 返回启动上下文。 */
const BRIDGE_BOOTSTRAP_MESSAGE = "noumi:light-system:bridge:bootstrap";

/** iframe 请求可信外壳执行受控能力。 */
const BRIDGE_REQUEST_MESSAGE = "noumi:light-system:bridge:request";

/** 可信外壳返回能力调用结果。 */
const BRIDGE_RESPONSE_MESSAGE = "noumi:light-system:bridge:response";

/** 启动上下文和单次能力调用的最长等待时间。 */
const BRIDGE_REQUEST_TIMEOUT_MS = 10_000;

/**
 * 生成运行在应用 bundle 之前的 Browser Runtime。
 * Runtime 先完成可信父窗口握手，再定义只读 `window.NoumiBridge`，因此业务入口无需处理未初始化状态。
 */
export function createNoumiBrowserRuntimeSource(): string {
	return `const __NOUMI_LIGHT_SYSTEM_API__=await(async()=>{
const bridgeVersion=${BRIDGE_VERSION};
const requestTimeoutMs=${BRIDGE_REQUEST_TIMEOUT_MS};
const channelId=Array.from(crypto.getRandomValues(new Uint32Array(4)),(value)=>value.toString(36)).join("-");
const pending=new Map();
let requestSequence=0;
let bootstrapResolve;
let bootstrapReject;
let bootstrapTimer;
const isRecord=(value)=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const isMember=(value)=>isRecord(value)&&typeof value.email==="string"&&(value.displayName===null||typeof value.displayName==="string");
const bootstrap=new Promise((resolve,reject)=>{
	bootstrapResolve=resolve;
	bootstrapReject=reject;
	bootstrapTimer=setTimeout(()=>reject(new Error("Noumi iframe bootstrap timed out")),requestTimeoutMs);
});
addEventListener("message",(event)=>{
	if(event.source!==window.parent||!isRecord(event.data)||event.data.version!==bridgeVersion||event.data.channelId!==channelId)return;
	if(event.data.type===${JSON.stringify(BRIDGE_BOOTSTRAP_MESSAGE)}){
		const payload=event.data.payload;
		if(!isRecord(payload)||!isRecord(payload.app)||typeof payload.app.name!=="string"||!isMember(payload.createByMember)||(payload.currentMember!==null&&!isMember(payload.currentMember))){
			bootstrapReject(new Error("Noumi iframe bootstrap payload is invalid"));
			return;
		}
		clearTimeout(bootstrapTimer);
		bootstrapResolve(payload);
		return;
	}
	if(event.data.type!==${JSON.stringify(BRIDGE_RESPONSE_MESSAGE)}||typeof event.data.requestId!=="string")return;
	const active=pending.get(event.data.requestId);
	if(!active)return;
	pending.delete(event.data.requestId);
	clearTimeout(active.timer);
	if(event.data.ok===true)active.resolve(event.data.result);
	else active.reject(new Error(typeof event.data.error==="string"?event.data.error:"Noumi capability call failed"));
});
window.parent.postMessage({type:${JSON.stringify(BRIDGE_READY_MESSAGE)},version:bridgeVersion,channelId},"*");
const payload=await bootstrap;
const call=(method,params)=>new Promise((resolve,reject)=>{
	const requestId=Date.now().toString(36)+":"+(++requestSequence).toString(36);
	const timer=setTimeout(()=>{
		pending.delete(requestId);
		reject(new Error("Noumi capability call timed out"));
	},requestTimeoutMs);
	pending.set(requestId,{resolve,reject,timer});
	window.parent.postMessage({type:${JSON.stringify(BRIDGE_REQUEST_MESSAGE)},version:bridgeVersion,channelId,requestId,method,params},"*");
});
const requireString=(value,name)=>{
	if(typeof value!=="string")throw new TypeError(name+" must be a string");
	return value;
};
const freezeMember=(member)=>Object.freeze({email:member.email,displayName:member.displayName});
return Object.freeze({
	app:Object.freeze({name:payload.app.name}),
	createByMember:freezeMember(payload.createByMember),
	currentMember:payload.currentMember===null?null:freezeMember(payload.currentMember),
	localStorage:Object.freeze({
		async setItem(key,value){await call("localStorage.setItem",{key:requireString(key,"key"),value:requireString(value,"value")});},
		async getItem(key){const value=await call("localStorage.getItem",{key:requireString(key,"key")});return typeof value==="string"?value:null;},
		async removeItem(key){await call("localStorage.removeItem",{key:requireString(key,"key")});},
		async clear(){await call("localStorage.clear",{});},
		async length(){const value=await call("localStorage.length",{});return typeof value==="number"?value:0;},
		async keys(){const value=await call("localStorage.keys",{});return Array.isArray(value)?value.filter((item)=>typeof item==="string"):[];},
		async has(key){return (await call("localStorage.has",{key:requireString(key,"key")}))===true;},
	}),
});
})();
Object.defineProperty(window,"NoumiBridge",{value:__NOUMI_LIGHT_SYSTEM_API__,writable:false,configurable:false,enumerable:true});
`;
}
