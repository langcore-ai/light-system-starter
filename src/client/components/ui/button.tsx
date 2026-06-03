import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** shadcn 风格按钮 variant。 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-slate-950 text-white hover:bg-slate-800",
				secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
				destructive: "bg-rose-600 text-white hover:bg-rose-700",
				ghost: "text-slate-700 hover:bg-slate-100",
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
