"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-foreground group-[.toaster]:shadow-md group-[.toaster]:border group-[.toaster]:border-stone-200 group-[.toaster]:rounded-lg group-[.toaster]:p-3 group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:justify-between group-[.toaster]:gap-4",
          title:
            "group-[.toast]:font-bold group-[.toast]:text-base group-[.toast]:m-0",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:!bg-cyan-600 group-[.toast]:!border group-[.toast]:!border-solid group-[.toast]:!border-cyan-700 group-[.toast]:!py-[14px] group-[.toast]:!px-6 group-[.toast]:!text-lg group-[.toast]:!text-white group-[.toast]:hover:!bg-cyan-700 group-[.toast]:!transition-colors group-[.toast]:!rounded-md",
          cancelButton:
            "group-[.toast]:text-stone-500 group-[.toast]:underline hover:group-[.toast]:text-stone-700",
        },
        duration: 5000,
      }}
      {...props}
    />
  );
};

export { Toaster };
