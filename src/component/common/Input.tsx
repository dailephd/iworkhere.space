import { forwardRef, type InputHTMLAttributes } from "react"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
    const { className = "", ...inputProps } = props

    return (
        <input
            ref={ref}
            className={`control-input ${className}`.trim()}
            {...inputProps}
        />
    )
})
