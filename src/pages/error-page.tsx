import FlexContainer from "@/components/FlexContainer";
import { ErrorResponse, useRouteError } from "react-router-dom";

interface ErrorPageProps extends ErrorResponse {
  message: string;
  statusText: string;
}

export default function ErrorPage() {
  const error = useRouteError();
  const { message, statusText } = error as ErrorPageProps;
  console.error(error);

  return (
    <FlexContainer
      variant="column-center"
      className="h-screen w-full bg-white p-5"
    >
      <h1 className="text-3xl font-bold">Oops!</h1>
      <p className="text-lg">Sorry, an unexpected error has occurred.</p>
      <p className="text-lg">
        <i>{statusText || message}</i>
      </p>
    </FlexContainer>
  );
}
