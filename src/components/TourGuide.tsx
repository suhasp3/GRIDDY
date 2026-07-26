import { Joyride, STATUS } from "react-joyride";
import type { Controls, EventData, Step } from "react-joyride";

const STEPS: Step[] = [
  {
    target: '[data-tour="study-name"]',
    title: "Name your study",
    content: "Give your survey a name here so it's easy to find later in My Surveys.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-tour="section-question-grid"]',
    title: "Question & grid",
    content: "Write the question text and set the grid's row/column dimensions.",
    placement: "right",
  },
  {
    target: '[data-tour="section-categories"]',
    title: "Categories",
    content: "Add the categories respondents can place on the grid, each with its own color or image.",
    placement: "right",
  },
  {
    target: '[data-tour="section-selection-mode"]',
    title: "How respondents answer",
    content: "Choose whether respondents select-and-click, use a dropdown per cell, or drag and drop.",
    placement: "right",
  },
  {
    target: '[data-tour="preview"]',
    title: "Live preview",
    content: "This preview updates as you edit — it's exactly what respondents will see.",
    placement: "left",
  },
  {
    target: '[data-tour="section-experiment"]',
    title: "Optional: add an experiment",
    content: "Pre-fill the grid yourself, then collect respondent reactions to your pre-filled cells.",
    placement: "top",
  },
  {
    target: '[data-tour="export-button"]',
    title: "Export to Qualtrics",
    content: "When you're ready, export a .qsf file to import directly into a Qualtrics project.",
    placement: "top",
  },
];

interface TourGuideProps {
  run: boolean;
  onFinish: () => void;
}

export default function TourGuide({ run, onFinish }: TourGuideProps) {
  const handleEvent = (data: EventData, _controls: Controls) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        primaryColor: "#8a2e3b",
        textColor: "#2a241c",
        backgroundColor: "#fbf8f1",
        arrowColor: "#fbf8f1",
        overlayColor: "rgba(42, 36, 28, 0.55)",
        zIndex: 10000,
        showProgress: true,
        buttons: ["back", "close", "skip", "primary"],
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          fontFamily: "'Hanken Grotesk', sans-serif",
        },
        tooltipTitle: {
          fontFamily: "'Source Serif 4', serif",
          fontWeight: 700,
          fontSize: 17,
        },
        buttonPrimary: {
          borderRadius: 8,
          fontWeight: 600,
        },
        buttonBack: {
          color: "#8a8170",
        },
      }}
    />
  );
}
