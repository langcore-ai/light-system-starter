import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** shadcn 风格按钮 variant。 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-primary text-white brightness-100 hover:brightness-90",
				secondary: "border bg-card text-foreground hover:bg-muted",
				destructive: "bg-rose-600 text-white hover:bg-rose-700",
				ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-8 px-3",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

/** Button 属性。 */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants>;

/**
 * 本地 shadcn-style Button，避免动态 app 依赖主应用组件源码。
 * @param props 按钮属性
 * @returns button 元素
 */
export function Button({ className, variant, size, ...props }: ButtonProps) {
	return (
		<button
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}
