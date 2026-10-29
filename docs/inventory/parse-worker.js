import { createDatasetParser } from "./engine.js";

self.onmessage = async (event) => {
  const file = event.data.file;
  const parser = createDatasetParser({
    onProgress(rows) {
      self.postMessage({ type: "progress", rows, bytes: file.size, size: file.size });
    },
  });
  try {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder("utf-8");
    let bytes = 0;
    let last = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      parser.push(decoder.decode(value, { stream: true }));
      const now = Date.now();
      if (now - last > 150) {
        self.postMessage({ type: "progress", rows: parser.rowCount, bytes, size: file.size });
        last = now;
      }
    }
    parser.push(decoder.decode());
    const dataset = parser.finish();
    self.postMessage({ type: "done", dataset, bytes }, transferables(dataset));
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error && error.message ? error.message : String(error),
    });
  }
};

function transferables(dataset) {
  const list = [];
  const seen = new Set();
  function add(array) {
    if (!array || !array.buffer || seen.has(array.buffer)) return;
    seen.add(array.buffer);
    list.push(array.buffer);
  }
  for (const column of dataset.columns) {
    add(column.codes);
    add(column.values);
    add(column.bytes);
    add(column.offsets);
    add(column.lengths);
  }
  return list;
}
