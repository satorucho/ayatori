import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={[
      "peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full",
      "border border-transparent shadow-sm transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-300",
      "dark:data-[state=checked]:bg-blue-500 dark:data-[state=unchecked]:bg-gray-600",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={[
        "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-sm ring-0",
        "transition-transform data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0.5",
      ].join(" ")}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export { Switch };
