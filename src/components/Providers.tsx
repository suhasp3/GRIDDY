import { NextUIProvider } from "@nextui-org/react";
import React from "react";
import { Outlet, useNavigate } from "react-router-dom";

interface ProvidersProps {
  children?: React.ReactNode;
}

const Providers = ({ children }: ProvidersProps) => {
  const navigate = useNavigate();
  return (
    <NextUIProvider navigate={navigate}>
      {children}
      <Outlet />
    </NextUIProvider>
  );
};

export default Providers;
