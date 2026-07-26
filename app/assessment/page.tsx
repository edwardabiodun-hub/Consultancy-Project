import type { Metadata } from "next";
import { AssessmentFlow } from "./AssessmentFlow";
import "./assessment.css";

export const metadata: Metadata = {
  title: "Business Independence Assessment",
  description:
    "Identify where owner intervention, operating practices, or delayed information constrain business independence.",
};

export default function AssessmentPage() {
  return <AssessmentFlow />;
}
