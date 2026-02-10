"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function useStarReminder() {
  useEffect(() => {
    // Check if we've already shown the toast
    const hasShownStarReminder = localStorage.getItem("hasShownStarReminder");

    if (!hasShownStarReminder) {
      // Set a timeout to show the toast after 3 seconds
      const timeoutId = setTimeout(() => {
        toast("Enjoying GitUnderstand Diagrams?", {
          action: {
            label: "Star ★",
            onClick: () =>
              window.open(
                "https://github.com/REDFOX1899/gitunderstand",
                "_blank",
              ),
          },
          duration: 5000,
          dismissible: true,
        });

        // Set flag in localStorage to prevent showing again
        localStorage.setItem("hasShownStarReminder", "true");
      }, 5000);

      // Clean up the timeout if the component unmounts
      return () => clearTimeout(timeoutId);
    }
  }, []);
}
