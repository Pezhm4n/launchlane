import { parentPort, workerData } from "node:worker_threads";
import { Store } from "../../src/server/persistence/store.ts";

const store = new Store(workerData.path);
parentPort.on("message", () => {
  try {
    store.claim(
      workerData.action.id,
      workerData.session.actorId,
      workerData.session.id,
      workerData.action.spec,
    );
    parentPort.postMessage("claimed");
  } catch (error) {
    parentPort.postMessage(error.code || "unexpected");
  } finally {
    store.close();
    parentPort.close();
  }
});
parentPort.postMessage("ready");
