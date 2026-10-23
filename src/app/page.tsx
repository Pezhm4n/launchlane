import { Workbench } from "../components/workbench";
import { readConfig } from "../server/config.ts";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Workbench authMode={readConfig().authMode} />;
}
