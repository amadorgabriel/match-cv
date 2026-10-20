import type { Metadata } from "next";

import { MatchCvFlow } from "@/components/matchcv/matchcv-flow";

export const metadata: Metadata = {
  title: "Gerar candidatura | MatchCV",
};

export default function GerarPage() {
  return <MatchCvFlow />;
}
