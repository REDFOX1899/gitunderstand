import { Key } from "lucide-react";
import { Button } from "./ui/button";

interface ApiKeyButtonProps {
  onClick: () => void;
}

export function ApiKeyButton({ onClick }: ApiKeyButtonProps) {
  return (
    <Button
      onClick={onClick}
      className="bg-cyan-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-cyan-700"
    >
      <Key className="mr-2 h-5 w-5" />
      Use Your API Key
    </Button>
  );
}
