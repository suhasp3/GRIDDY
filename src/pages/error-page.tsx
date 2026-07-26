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
      className="h-screen w-full bg-paper p-5 font-sans"
    >
      <h1 className="font-serif text-3xl font-bold text-ink">Oops!</h1>
      <p className="text-lg text-ink-muted">Sorry, an unexpected error has occurred.</p>
      <p className="text-lg text-ink-faint">
        <i>{statusText || message}</i>
      </p>
    </FlexContainer>
  );
}
