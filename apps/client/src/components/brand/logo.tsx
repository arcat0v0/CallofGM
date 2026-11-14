import type * as React from "react";

function Logo({
	className,
	...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">) {
	return (
		<img
			src="/brand/cogm-logo.webp"
			alt="CoGM"
			width={1024}
			height={1024}
			className={className}
			{...props}
		/>
	);
}

export { Logo };
