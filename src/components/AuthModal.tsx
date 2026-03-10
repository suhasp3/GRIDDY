import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { useState } from "react";
import { useAuth } from "../lib/authContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        setError("Account created! Check your email to confirm before signing in.");
        setLoading(false);
        return;
      }
      onClose();
    } catch (e) {
      console.error("Auth error:", e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center">
      <ModalContent>
        <ModalHeader>{mode === "signin" ? "Sign In" : "Sign Up"}</ModalHeader>
        <ModalBody className="gap-3">
          <Input
            label="Email"
            type="email"
            value={email}
            onValueChange={setEmail}
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onValueChange={setPassword}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter className="flex-col gap-2">
          <Button color="primary" onPress={handleSubmit} isLoading={loading} className="w-full">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
