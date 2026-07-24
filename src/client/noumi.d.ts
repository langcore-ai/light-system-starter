export {};

declare global {
	/** 轻系统可见的成员信息。 */
	interface NoumiMember {
		/** 成员邮箱。 */
		email: string;
		/** 成员展示名。 */
		displayName: string | null;
	}

	/** 主平台通过可信 iframe Bridge 注入的轻系统能力。 */
	interface NoumiBridge {
		/** 当前轻系统信息。 */
		app: {
			/** 轻系统展示名称。 */
			name: string;
		};
		/** 创建当前轻系统的成员。 */
		createByMember: NoumiMember;
		/** 当前登录成员；公开匿名访问时为空。 */
		currentMember: NoumiMember | null;
		/** 与主前端 localStorage 隔离、按当前轻系统分区的异步浏览器存储。 */
		localStorage: {
			/** 写入字符串值。 */
			setItem(key: string, value: string): Promise<void>;
			/** 读取字符串值；键不存在时返回 null。 */
			getItem(key: string): Promise<string | null>;
			/** 删除一个键。 */
			removeItem(key: string): Promise<void>;
			/** 仅清空当前轻系统的全部键。 */
			clear(): Promise<void>;
			/** 返回当前轻系统的键数量。 */
			length(): Promise<number>;
			/** 返回当前轻系统的全部键。 */
			keys(): Promise<string[]>;
			/** 判断当前轻系统是否存在指定键。 */
			has(key: string): Promise<boolean>;
		};
	}

	interface Window {
		/**
		 * 业务 bundle 执行前已完成初始化。
		 * 身份验证仍由主系统 Cookie/Session 负责，这里只包含显式只读上下文和受控能力。
		 */
		NoumiBridge: NoumiBridge;
	}
}
