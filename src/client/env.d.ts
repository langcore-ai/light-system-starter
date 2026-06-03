export {};

declare global {
	interface Window {
		/** React SPA 挂载完成标记，供部署后验证使用。 */
		__LIGHT_SYSTEM_REACT_SPA_READY__?: boolean;
	}
}
