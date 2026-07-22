import * as React from "react";
import { cn } from "../../lib/utils";

/** Card 属性。 */
export type CardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * 简单卡片容器。
 * @param props div 属性
 * @returns card 元素
 */
export function Card({ className, ...props }: CardProps) {
	return (
		<div
			className={cn("rounded-lg border bg-card shadow-sm", className)}
			{...props}
		/>
	);
}
