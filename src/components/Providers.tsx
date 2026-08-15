import { NextUIProvider } from "@nextui-org/react";
import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { EditorProvider } from "../EditorContext";

interface ProvidersProps {
  children?: React.ReactNode;
}

const Providers = ({ children }: ProvidersProps) => {
  const navigate = useNavigate();
  return (
    <NextUIProvider navigate={navigate}>
      <EditorProvider>
        {children}
        <Outlet />
      </EditorProvider>
    </NextUIProvider>
  );
};

export default Providers;
