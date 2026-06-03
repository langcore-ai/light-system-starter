import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind class，兼容 shadcn/ui 常见组件写法。
 * @param inputs class 值列表
 * @returns 去冲突后的 class 字符串
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
