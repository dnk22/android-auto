import {
  forwardRef,
  useCallback,
  useRef,
  type ButtonHTMLAttributes,
  type ForwardRefExoticComponent,
  type MouseEventHandler,
  type RefAttributes,
} from "react";

type DebouncedButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  debounceMs?: number;
};

export function withDebouncedClick(
  WrappedComponent: ForwardRefExoticComponent<
    DebouncedButtonBaseProps & RefAttributes<HTMLButtonElement>
  >,
) {
  return forwardRef<HTMLButtonElement, DebouncedButtonBaseProps>(function DebouncedClickWrapper(
    props,
    ref,
  ) {
    const { onClick, disabled, debounceMs = 400, ...rest } = props;
    const lastClickAtRef = useRef(0);

    const handleClick = useCallback<MouseEventHandler<HTMLButtonElement>>(
      (event) => {
        if (!onClick || disabled) {
          return;
        }

        const now = Date.now();
        if (now - lastClickAtRef.current < debounceMs) {
          return;
        }

        lastClickAtRef.current = now;
        onClick(event);
      },
      [debounceMs, disabled, onClick],
    );

    return (
      <WrappedComponent
        {...rest}
        ref={ref}
        onClick={handleClick}
        disabled={disabled}
        debounceMs={debounceMs}
      />
    );
  });
}

const RawButton = forwardRef<HTMLButtonElement, DebouncedButtonBaseProps>(
  function RawButton({ debounceMs: _debounceMs, ...props }, ref) {
    return <button ref={ref} {...props} />;
  },
);

const DebouncedButton = withDebouncedClick(RawButton);

export default DebouncedButton;
