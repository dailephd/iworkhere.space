import { forwardRef, type ButtonHTMLAttributes } from "react"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
}

const variantClassName: Record<ButtonVariant, string> = {
    primary: "button-primary",
    secondary: "button-secondary",
    ghost: "button-ghost",
    danger: "button-danger",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    props,
    ref,
) {
    const { className = "", variant = "primary", type = "button", ...buttonProps } = props

    return (
        <button
            ref={ref}
            type={type}
            className={`button-base ${variantClassName[variant]} ${className}`.trim()}
            {...buttonProps}
        />
    )
})
