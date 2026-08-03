import type { Metadata } from "next";
import { Breadcrumbs } from "../../components/SiteParts";
import { AssessmentFlow } from "./AssessmentFlow";
import "./assessment.css";

export const metadata: Metadata = {
  title: "Business Independence Assessment",
  description:
    "Identify where owner intervention, operating practices, or delayed information constrain business independence.",
};

export default function AssessmentPage() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Business Independence Assessment" }]} />
      <AssessmentFlow />
    </>
  );
}

