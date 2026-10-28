import type { Metadata } from "next";

import { ApplicationsDashboard } from "@/components/matchcv/applications-dashboard";

export const metadata: Metadata = {
  title: "Candidaturas | MatchCV",
  description: "Dashboard das vagas aplicadas, com status, anotações e os materiais gerados.",
};

export default function DashboardPage() {
  return <ApplicationsDashboard />;
}
